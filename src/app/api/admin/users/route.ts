import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { z } from 'zod';

// Audit log action types
export enum AuditAction {
  USER_ROLE_CHANGE = 'USER_ROLE_CHANGE',
  USER_STATUS_CHANGE = 'USER_STATUS_CHANGE',
  USER_DELETE = 'USER_DELETE',
  SETTINGS_CHANGE = 'SETTINGS_CHANGE',
  ADMIN_LOGIN = 'ADMIN_LOGIN',
  ADMIN_ACCESS = 'ADMIN_ACCESS',
  SECURITY_VIOLATION = 'SECURITY_VIOLATION',
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
    const userAgent = request.headers.get('user-agent') || 'unknown';

    await prisma.auditLog.create({
      data: {
        action,
        details: JSON.stringify(details),
        ipAddress: Array.isArray(ip) ? ip[0] : ip,
        userAgent,
        userId: session?.user?.id || null,
      },
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
}

// Check if user is admin
async function isAdmin(): Promise<{ isAdmin: boolean; userId?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { isAdmin: false };
  
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isSuperuser: true, totpEnabled: true },
  });
  
  // Require 2FA for admin access
  if (user?.isSuperuser !== true) return { isAdmin: false };
  // Note: In production, you may want to require 2FA verification before admin actions
  // For now, we just check if 2FA is enabled
  
  return { isAdmin: true, userId: session.user.id };
}

// Rate limiting - simple in-memory store (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(
  key: string,
  maxRequests: number = 10,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const record = rateLimitStore.get(key);
  
  if (!record || now > record.resetTime) {
    const resetTime = now + windowMs;
    rateLimitStore.set(key, { count: 1, resetTime });
    return { allowed: true, remaining: maxRequests - 1, resetTime };
  }
  
  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetTime: record.resetTime };
  }
  
  record.count++;
  return { allowed: true, remaining: maxRequests - record.count, resetTime: record.resetTime };
}

// GET - List all users with pagination
export async function GET(request: NextRequest) {
  const adminCheck = await isAdmin();
  if (!adminCheck.isAdmin) {
    await createAuditLog(AuditAction.SECURITY_VIOLATION, {
      action: 'UNAUTHORIZED_ADMIN_ACCESS_ATTEMPT',
      endpoint: '/api/admin/users',
    }, request);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  // Rate limiting
  const rateLimit = checkRateLimit(`admin-users-${adminCheck.userId}`, 30, 60000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests', resetTime: rateLimit.resetTime },
      { status: 429 }
    );
  }

  await createAuditLog(AuditAction.ADMIN_ACCESS, {
    action: 'VIEW_USERS_LIST',
  }, request);

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const search = searchParams.get('search') || '';

  const where = search
    ? {
        OR: [
          { email: { contains: search, mode: 'insensitive' as const } },
          { name: { contains: search, mode: 'insensitive' as const } },
          { username: { contains: search, mode: 'insensitive' as const } },
        ],
      }
    : {};

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

  return NextResponse.json({
    users,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

// PATCH - Update user role or status
const updateUserSchema = z.object({
  userId: z.string(),
  action: z.enum(['makeAdmin', 'removeAdmin', 'activate', 'deactivate']),
});

export async function PATCH(request: NextRequest) {
  const adminCheck = await isAdmin();
  if (!adminCheck.isAdmin) {
    await createAuditLog(AuditAction.SECURITY_VIOLATION, {
      action: 'UNAUTHORIZED_ADMIN_UPDATE_ATTEMPT',
    }, request);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  // Stricter rate limiting for modifications
  const rateLimit = checkRateLimit(`admin-modify-${adminCheck.userId}`, 10, 60000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests', resetTime: rateLimit.resetTime },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { userId, action } = updateUserSchema.parse(body);

    // Prevent self-modification of admin status
    if (userId === adminCheck.userId && (action === 'removeAdmin' || action === 'deactivate')) {
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

    let updateData: Record<string, boolean> = {};
    let auditAction: AuditAction;
    let auditDetails: Record<string, unknown> = {
      targetUserId: userId,
      targetEmail: user.email,
    };

    switch (action) {
      case 'makeAdmin':
        if (user.isSuperuser) {
          return NextResponse.json({ error: 'User is already an admin' }, { status: 400 });
        }
        updateData = { isSuperuser: true };
        auditAction = AuditAction.USER_ROLE_CHANGE;
        auditDetails.previousValue = false;
        auditDetails.newValue = true;
        break;

      case 'removeAdmin':
        if (!user.isSuperuser) {
          return NextResponse.json({ error: 'User is not an admin' }, { status: 400 });
        }
        updateData = { isSuperuser: false };
        auditAction = AuditAction.USER_ROLE_CHANGE;
        auditDetails.previousValue = true;
        auditDetails.newValue = false;
        break;

      case 'activate':
        if (user.isActive) {
          return NextResponse.json({ error: 'User is already active' }, { status: 400 });
        }
        updateData = { isActive: true };
        auditAction = AuditAction.USER_STATUS_CHANGE;
        auditDetails.previousValue = false;
        auditDetails.newValue = true;
        break;

      case 'deactivate':
        if (!user.isActive) {
          return NextResponse.json({ error: 'User is already inactive' }, { status: 400 });
        }
        updateData = { isActive: false };
        auditAction = AuditAction.USER_STATUS_CHANGE;
        auditDetails.previousValue = true;
        auditDetails.newValue = false;
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        isSuperuser: true,
        isActive: true,
      },
    });

    await createAuditLog(auditAction, auditDetails, request);

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
}

// DELETE - Soft delete user (set isActive to false)
export async function DELETE(request: NextRequest) {
  const adminCheck = await isAdmin();
  if (!adminCheck.isAdmin) {
    await createAuditLog(AuditAction.SECURITY_VIOLATION, {
      action: 'UNAUTHORIZED_ADMIN_DELETE_ATTEMPT',
    }, request);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  // Very strict rate limiting for deletions
  const rateLimit = checkRateLimit(`admin-delete-${adminCheck.userId}`, 5, 60000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests', resetTime: rateLimit.resetTime },
      { status: 429 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Prevent self-deletion
    if (userId === adminCheck.userId) {
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin user delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}
