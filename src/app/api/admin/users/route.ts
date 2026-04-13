import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { validateBody } from '@/lib/validations/common';
import { z } from 'zod';
import { withAdmin } from '@/lib/api/withAdmin';
import type { AdminSession } from '@/lib/api/withAdmin';
import { deleteFile } from '@/lib/storage';
import { checkLimit, Limiters } from '@/lib/rate-limit-redis';
import { ok, badRequest, notFound, internalError } from '@/lib/api/responses';
import logger from '@/lib/logger';

export enum AuditAction {
  USER_ROLE_CHANGE = 'USER_ROLE_CHANGE',
  USER_STATUS_CHANGE = 'USER_STATUS_CHANGE',
  USER_DELETE = 'USER_DELETE',
  SETTINGS_CHANGE = 'SETTINGS_CHANGE',
  ADMIN_LOGIN = 'ADMIN_LOGIN',
  ADMIN_ACCESS = 'ADMIN_ACCESS',
  SECURITY_VIOLATION = 'SECURITY_VIOLATION',
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  FAILED_LOGIN = 'FAILED_LOGIN',
  API_ERROR = 'API_ERROR',
  SYNC_ERROR = 'SYNC_ERROR',
}

async function createAuditLog(
  action: AuditAction,
  details: Record<string, unknown>,
  request: NextRequest
) {
  try {
    const session = await auth();
    const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               'unknown';

    await prisma.auditLog.create({
      data: {
        action,
        details: JSON.stringify(details),
        ipAddress: typeof ip === 'string' ? ip.split(',')[0].trim() : ip,
        userAgent: request.headers.get('user-agent') || 'unknown',
        userId: session?.user?.id || null,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to create audit log');
  }
}

export const GET = withAdmin(async (request: NextRequest, _ctx: Record<string, unknown>, session: AdminSession) => {
  const rateLimitResponse = await checkLimit(request, Limiters.admin);
  if (rateLimitResponse) return rateLimitResponse;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20') || 20));
  const search = searchParams.get('search') || '';
  const includeInactive = searchParams.get('includeInactive') === 'true';

  const where: { isActive?: boolean; OR?: Array<{ email?: { contains: string; mode: 'insensitive' }; name?: { contains: string; mode: 'insensitive' }; username?: { contains: string; mode: 'insensitive' } }> } = {};
  
  if (!includeInactive) {
    where.isActive = true;
  }
  
  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' as const } },
      { name: { contains: search, mode: 'insensitive' as const } },
      { username: { contains: search, mode: 'insensitive' as const } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        isSuperuser: true,
        isActive: true,
        totpEnabled: true,
        createdAt: true,
        lastLoginAt: true,
        _count: {
          select: {
            accounts: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  await createAuditLog(AuditAction.ADMIN_ACCESS, { action: 'VIEW_USERS_LIST', page, limit, search }, request).catch(() => logger.error('Audit log creation failed'));

  return ok({
    users,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

const updateUserSchema = z.object({
  userId: z.string(),
  action: z.enum(['makeAdmin', 'removeAdmin', 'activate', 'deactivate']),
});

export const PATCH = withAdmin(async (request: NextRequest, _ctx: Record<string, unknown>, session: AdminSession) => {
  const rateLimitResponse = await checkLimit(request, Limiters.admin);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const bodyValidation = await validateBody(request, updateUserSchema);
    if (!bodyValidation.success) return bodyValidation.response;
    const { userId, action } = bodyValidation.data;

    if (userId === session.user.id && (action === 'removeAdmin' || action === 'deactivate')) {
      await createAuditLog(AuditAction.SECURITY_VIOLATION, {
        action: 'SELF_DEMODIFICATION_ATTEMPT',
        targetAction: action,
      }, request);
      return badRequest('Cannot modify your own admin status or active state');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, isSuperuser: true, isActive: true },
    });

    if (!user) {
      return notFound('User');
    }

    const isRoleAction = action === 'makeAdmin' || action === 'removeAdmin';
    const field = isRoleAction ? 'isSuperuser' : 'isActive';
    const newValue = action === 'makeAdmin' || action === 'activate';
    const currentValue = user[field];

    if (currentValue === newValue) {
      return badRequest(`User is already ${newValue ? (isRoleAction ? 'an admin' : 'active') : (isRoleAction ? 'not an admin' : 'inactive')}`);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { [field]: newValue },
      select: { id: true, email: true, name: true, isSuperuser: true, isActive: true },
    });

    await createAuditLog(
      isRoleAction ? AuditAction.USER_ROLE_CHANGE : AuditAction.USER_STATUS_CHANGE,
      { targetUserId: userId, targetEmail: user.email, previousValue: currentValue, newValue },
      request
    );

    return ok({
      success: true,
      user: updatedUser,
    });
  } catch (error) {
    logger.error({ err: error }, 'Admin user update error');
    return internalError();
  }
});

const sendResetSchema = z.object({
  userId: z.string(),
});

export const POST = withAdmin(async (request: NextRequest, _ctx: Record<string, unknown>, session: AdminSession) => {
  const rateLimitResponse = await checkLimit(request, Limiters.admin);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const bodyValidation = await validateBody(request, sendResetSchema);
    if (!bodyValidation.success) return bodyValidation.response;
    const { userId } = bodyValidation.data;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, isActive: true },
    });

    if (!user) return notFound('User');
    if (!user.email) return badRequest('User has no email address');

    const baseUrl = process.env.NEXTAUTH_URL;
    if (!baseUrl) {
      return badRequest('NEXTAUTH_URL is not configured — cannot send reset email');
    }

    const { randomBytes } = await import('crypto');
    const bcrypt = await import('bcryptjs');
    const { sendPasswordResetEmail } = await import('@/lib/email');

    const resetToken = randomBytes(32).toString('hex');
    const tokenId = resetToken.slice(0, 8);
    const hashedToken = await bcrypt.hash(resetToken, 12);

    await prisma.passwordResetToken.deleteMany({ where: { userId } });
    await prisma.passwordResetToken.create({
      data: {
        userId,
        tokenId,
        token: hashedToken,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const emailResult = await sendPasswordResetEmail(user.email, resetToken, `${baseUrl}/reset-password`);
    if (!emailResult.success) {
      return badRequest(`Failed to send email: ${emailResult.error ?? 'Unknown error'}`);
    }

    await createAuditLog(AuditAction.SETTINGS_CHANGE, {
      action: 'ADMIN_PASSWORD_RESET_EMAIL',
      targetUserId: userId,
      targetEmail: user.email,
      initiatedBy: session.user.id,
    }, request);

    return ok({ success: true, message: `Password reset email sent to ${user.email}` });
  } catch (error) {
    logger.error({ err: error }, 'Admin send reset error');
    return internalError();
  }
});

export const DELETE = withAdmin(async (request: NextRequest, _ctx: Record<string, unknown>, session: AdminSession) => {
  const rateLimitResponse = await checkLimit(request, Limiters.admin);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const mode = searchParams.get('mode') || 'soft';

    if (!userId) {
      return badRequest('User ID required');
    }

    if (userId === session.user.id) {
      await createAuditLog(AuditAction.SECURITY_VIOLATION, {
        action: 'SELF_DELETION_ATTEMPT',
      }, request);
      return badRequest('Cannot delete your own account');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      return notFound('User');
    }

    if (mode === 'hard') {
      await prisma.$transaction(async (tx) => {
        const accounts = await tx.tradingAccount.findMany({
          where: { userId },
          select: { id: true },
        });
        const accountIds = accounts.map(a => a.id);

        if (accountIds.length > 0) {
          const trades = await tx.trade.findMany({
            where: { accountId: { in: accountIds } },
            select: { id: true },
          });
          const tradeIds = trades.map(t => t.id);

          if (tradeIds.length > 0) {
            const mediaFiles = await tx.media.findMany({
              where: { tradeId: { in: tradeIds } },
              select: { filename: true },
            });
            for (const m of mediaFiles) {
              try { await deleteFile(m.filename); } catch {}
            }

            await tx.shareCard.deleteMany({ where: { tradeId: { in: tradeIds } } });
            await tx.media.deleteMany({ where: { tradeId: { in: tradeIds } } });
            await tx.pendingScreenshot.deleteMany({ where: { tradeId: { in: tradeIds } } });
            await tx.tradeTag.deleteMany({ where: { tradeId: { in: tradeIds } } });
            await tx.checklistCompletion.deleteMany({ where: { tradeId: { in: tradeIds } } });
          }
          await tx.trade.deleteMany({ where: { accountId: { in: accountIds } } });
        }

        const strategies = await tx.strategy.findMany({
          where: { userId },
          select: { id: true },
        });
        const strategyIds = strategies.map(s => s.id);
        if (strategyIds.length > 0) {
          await tx.strategyViolation.deleteMany({ where: { strategyId: { in: strategyIds } } });
        }
        await tx.strategy.deleteMany({ where: { userId } });

        if (accountIds.length > 0) {
          await tx.equitySnapshot.deleteMany({ where: { accountId: { in: accountIds } } });
          await tx.dailyAccountSnapshot.deleteMany({ where: { accountId: { in: accountIds } } });

          const phases = await tx.challengePhase.findMany({
            where: { accountId: { in: accountIds } },
            select: { id: true },
          });
          const phaseIds = phases.map(p => p.id);
          if (phaseIds.length > 0) {
            await tx.ruleViolation.deleteMany({ where: { phaseId: { in: phaseIds } } });
          }
          await tx.challengePhase.deleteMany({ where: { accountId: { in: accountIds } } });

          const challenges = await tx.tradingChallenge.findMany({
            where: { accountId: { in: accountIds } },
            select: { id: true },
          });
          const challengeIds = challenges.map(c => c.id);
          if (challengeIds.length > 0) {
            await tx.challengeEvaluation.deleteMany({ where: { challengeId: { in: challengeIds } } });
          }
          await tx.tradingChallenge.deleteMany({ where: { accountId: { in: accountIds } } });

          await tx.tradingAccount.deleteMany({ where: { id: { in: accountIds } } });
        }

        await tx.alertConfig.deleteMany({ where: { userId } });
        await tx.customStat.deleteMany({ where: { userId } });
        await tx.notification.deleteMany({ where: { userId } });
        await tx.userSettings.deleteMany({ where: { userId } });
        await tx.passwordResetToken.deleteMany({ where: { userId } });
        await tx.tiltmeterSnapshot.deleteMany({ where: { userId } });

        const checklists = await tx.checklist.findMany({
          where: { userId },
          select: { id: true },
        });
        const checklistIds = checklists.map(c => c.id);
        if (checklistIds.length > 0) {
          await tx.checklistItem.deleteMany({ where: { checklistId: { in: checklistIds } } });
          await tx.checklist.deleteMany({ where: { id: { in: checklistIds } } });
        }

        await tx.tag.deleteMany({ where: { userId } });
        await tx.shareCard.deleteMany({ where: { userId } });
        await tx.preTradeNote.deleteMany({ where: { userId } });

        await tx.auditLog.deleteMany({ where: { userId } });

        await tx.user.delete({ where: { id: userId } });
      });

      await createAuditLog(AuditAction.USER_DELETE, {
        targetUserId: userId,
        targetEmail: user.email,
        targetName: user.name,
        deletionType: 'hard',
      }, request);

      return ok({ success: true, deleted: true });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });

    await createAuditLog(AuditAction.USER_DELETE, {
      targetUserId: userId,
      targetEmail: user.email,
      targetName: user.name,
      deletionType: 'soft',
    }, request);

    return ok({ success: true, deactivated: true });
  } catch (error) {
    logger.error({ err: error }, 'Admin user delete error');
    return internalError();
  }
});
