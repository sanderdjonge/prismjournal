import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { z } from 'zod';
import { withAdmin } from '@/lib/api/withAdmin';
import type { AdminSession } from '@/lib/api/withAdmin';
import { deleteFile } from '@/lib/storage';

// Audit log action types
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

// Create audit log entry
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
    console.error('Failed to create audit log:', error);
  }
}

// Rate limiting - simple in-memory store (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 5 * 60 * 1000;

function cleanupExpired() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, record] of rateLimitStore) {
    if (now > record.resetTime) rateLimitStore.delete(key);
  }
}

const getRateLimit = (key: string, maxRequests: number, windowMs: number) => {
  cleanupExpired();
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetTime: now + windowMs };
  }

  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetTime: record.resetTime };
  }

  record.count++;
  return { allowed: true, remaining: maxRequests - record.count, resetTime: record.resetTime };
};

// GET - List all users with pagination
export const GET = withAdmin(async (request: NextRequest, _ctx: Record<string, unknown>, session: AdminSession) => {
  if (!getRateLimit(`admin-users-${session.user.id}`, 30, 60000).allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20') || 20));
  const search = searchParams.get('search') || '';
  const includeInactive = searchParams.get('includeInactive') === 'true';

  // Build where clause - by default only show active users (soft-deleted users are hidden)
  const where: { isActive?: boolean; OR?: Array<{ email?: { contains: string; mode: 'insensitive' }; name?: { contains: string; mode: 'insensitive' }; username?: { contains: string; mode: 'insensitive' } }> } = {};
  
  // Only filter by isActive if not explicitly including inactive users
  if (!includeInactive) {
    where.isActive = true;
  }
  
  // Add search filter if provided
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

  // Audit log user enumeration
  await createAuditLog(AuditAction.ADMIN_ACCESS, { action: 'VIEW_USERS_LIST', page, limit, search }, request).catch(console.error);

  return NextResponse.json({
    users,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// PATCH - Update user role or status
const updateUserSchema = z.object({
  userId: z.string(),
  action: z.enum(['makeAdmin', 'removeAdmin', 'activate', 'deactivate']),
});

export const PATCH = withAdmin(async (request: NextRequest, _ctx: Record<string, unknown>, session: AdminSession) => {
  if (!getRateLimit(`admin-modify-${session.user.id}`, 10, 60000).allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { userId, action } = updateUserSchema.parse(body);

    // Prevent self-modification of admin status
    if (userId === session.user.id && (action === 'removeAdmin' || action === 'deactivate')) {
      await createAuditLog(AuditAction.SECURITY_VIOLATION, {
        action: 'SELF_DEMODIFICATION_ATTEMPT',
        targetAction: action,
      }, request);
      return NextResponse.json(
        { error: 'Cannot modify your own admin status or active state' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, isSuperuser: true, isActive: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isRoleAction = action === 'makeAdmin' || action === 'removeAdmin';
    const field = isRoleAction ? 'isSuperuser' : 'isActive';
    const newValue = action === 'makeAdmin' || action === 'activate';
    const currentValue = user[field];

    if (currentValue === newValue) {
      return NextResponse.json({ error: `User is already ${newValue ? (isRoleAction ? 'an admin' : 'active') : (isRoleAction ? 'not an admin' : 'inactive')}` }, { status: 400 });
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

    return NextResponse.json({
      success: true,
      user: updatedUser,
    });
  } catch (error) {
    console.error('Admin user update error:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
});

// POST - Send password reset email on behalf of a user
const sendResetSchema = z.object({
  userId: z.string(),
});

export const POST = withAdmin(async (request: NextRequest, _ctx: Record<string, unknown>, session: AdminSession) => {
  if (!getRateLimit(`admin-reset-${session.user.id}`, 5, 60000).allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { userId } = sendResetSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, isActive: true },
    });

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (!user.email) return NextResponse.json({ error: 'User has no email address' }, { status: 400 });

    const baseUrl = process.env.NEXTAUTH_URL;
    if (!baseUrl) {
      return NextResponse.json(
        { error: 'NEXTAUTH_URL is not configured — cannot send reset email' },
        { status: 503 }
      );
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
      return NextResponse.json(
        { error: `Failed to send email: ${emailResult.error ?? 'Unknown error'}` },
        { status: 502 }
      );
    }

    await createAuditLog(AuditAction.SETTINGS_CHANGE, {
      action: 'ADMIN_PASSWORD_RESET_EMAIL',
      targetUserId: userId,
      targetEmail: user.email,
      initiatedBy: session.user.id,
    }, request);

    return NextResponse.json({ success: true, message: `Password reset email sent to ${user.email}` });
  } catch (error) {
    console.error('Admin send reset error:', error);
    return NextResponse.json({ error: 'Failed to send reset email' }, { status: 500 });
  }
});

// DELETE - Soft delete (default) or hard delete (?mode=hard) user
export const DELETE = withAdmin(async (request: NextRequest, _ctx: Record<string, unknown>, session: AdminSession) => {
  if (!getRateLimit(`admin-delete-${session.user.id}`, 5, 60000).allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const mode = searchParams.get('mode') || 'soft';

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Prevent self-deletion
    if (userId === session.user.id) {
      await createAuditLog(AuditAction.SECURITY_VIOLATION, {
        action: 'SELF_DELETION_ATTEMPT',
      }, request);
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (mode === 'hard') {
      // Hard delete - remove user and all related data in correct FK order
      await prisma.$transaction(async (tx) => {
        const accounts = await tx.tradingAccount.findMany({
          where: { userId },
          select: { id: true },
        });
        const accountIds = accounts.map(a => a.id);

        // Layer 1: Trade-level data (references Trade RESTRICT)
        if (accountIds.length > 0) {
          const trades = await tx.trade.findMany({
            where: { accountId: { in: accountIds } },
            select: { id: true },
          });
          const tradeIds = trades.map(t => t.id);

          if (tradeIds.length > 0) {
            // Clean up screenshot files from disk before deleting Media records
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

        // Layer 2: Strategy data (references Strategy CASCADE)
        const strategies = await tx.strategy.findMany({
          where: { userId },
          select: { id: true },
        });
        const strategyIds = strategies.map(s => s.id);
        if (strategyIds.length > 0) {
          await tx.strategyViolation.deleteMany({ where: { strategyId: { in: strategyIds } } });
        }
        await tx.strategy.deleteMany({ where: { userId } });

        // Layer 3: Account-level data (references TradingAccount RESTRICT)
        if (accountIds.length > 0) {
          await tx.equitySnapshot.deleteMany({ where: { accountId: { in: accountIds } } });
          await tx.dailyAccountSnapshot.deleteMany({ where: { accountId: { in: accountIds } } });

          // ChallengePhase -> RuleViolation (SET NULL on phaseId, but delete explicitly)
          const phases = await tx.challengePhase.findMany({
            where: { accountId: { in: accountIds } },
            select: { id: true },
          });
          const phaseIds = phases.map(p => p.id);
          if (phaseIds.length > 0) {
            await tx.ruleViolation.deleteMany({ where: { phaseId: { in: phaseIds } } });
          }
          await tx.challengePhase.deleteMany({ where: { accountId: { in: accountIds } } });

          // TradingChallenge -> ChallengeEvaluation (CASCADE, but delete explicitly)
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

        // Layer 4: User-level data (references User RESTRICT)
        await tx.alertConfig.deleteMany({ where: { userId } });
        await tx.customStat.deleteMany({ where: { userId } });
        await tx.notification.deleteMany({ where: { userId } });
        await tx.userSettings.deleteMany({ where: { userId } });
        await tx.passwordResetToken.deleteMany({ where: { userId } });
        await tx.tiltmeterSnapshot.deleteMany({ where: { userId } });

        // Checklist -> ChecklistItem has CASCADE, Checklist -> User has CASCADE
        // But delete explicitly for safety
        const checklists = await tx.checklist.findMany({
          where: { userId },
          select: { id: true },
        });
        const checklistIds = checklists.map(c => c.id);
        if (checklistIds.length > 0) {
          await tx.checklistItem.deleteMany({ where: { checklistId: { in: checklistIds } } });
          await tx.checklist.deleteMany({ where: { id: { in: checklistIds } } });
        }

        // Tags auto-cascade but delete explicitly
        await tx.tag.deleteMany({ where: { userId } });
        // ShareCard remaining (userId-linked, not tradeId-linked)
        await tx.shareCard.deleteMany({ where: { userId } });
        // PreTradeNote references Trade (SET NULL) and TradingAccount (SET NULL)
        await tx.preTradeNote.deleteMany({ where: { userId } });

        // AuditLog has no FK to User in schema, but we store userId
        await tx.auditLog.deleteMany({ where: { userId } });

        // Finally delete the user
        await tx.user.delete({ where: { id: userId } });
      });

      await createAuditLog(AuditAction.USER_DELETE, {
        targetUserId: userId,
        targetEmail: user.email,
        targetName: user.name,
        deletionType: 'hard',
      }, request);

      return NextResponse.json({ success: true, deleted: true });
    }

    // Soft delete - deactivate user
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

    return NextResponse.json({ success: true, deactivated: true });
  } catch (error) {
    console.error('Admin user delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
});
