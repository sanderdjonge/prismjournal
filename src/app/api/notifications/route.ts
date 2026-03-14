import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getDefaultAccount } from '@/lib/getAccount';

/**
 * GET /api/notifications
 * Get all notifications for the current user
 */
export async function GET() {
  try {
    const account = await getDefaultAccount();
    if (!account) {
      return NextResponse.json({ notifications: [], unreadCount: 0 });
    }

    const notifications = await prisma.notification.findMany({
      where: { userId: account.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const unreadCount = notifications.filter(n => !n.isRead).length;

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    console.error('Failed to fetch notifications:', error);
    return NextResponse.json({ notifications: [], unreadCount: 0 });
  }
}

/**
 * POST /api/notifications
 * Create a new notification
 */
export async function POST(request: Request) {
  try {
    const account = await getDefaultAccount();
    if (!account) {
      return NextResponse.json({ error: 'No account' }, { status: 401 });
    }

    const body = await request.json();
    const { type, title, message } = body;

    if (!type || !title || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const notification = await prisma.notification.create({
      data: {
        userId: account.userId,
        type,
        title,
        message,
      },
    });

    return NextResponse.json(notification);
  } catch (error) {
    console.error('Failed to create notification:', error);
    return NextResponse.json({ error: 'Failed to create notification' }, { status: 500 });
  }
}

/**
 * PATCH /api/notifications
 * Mark notifications as read
 */
export async function PATCH(request: Request) {
  try {
    const account = await getDefaultAccount();
    if (!account) {
      return NextResponse.json({ error: 'No account' }, { status: 401 });
    }

    const body = await request.json();
    const { ids, markAll } = body;

    if (markAll) {
      await prisma.notification.updateMany({
        where: { userId: account.userId, isRead: false },
        data: { isRead: true },
      });
    } else if (ids && Array.isArray(ids)) {
      await prisma.notification.updateMany({
        where: { id: { in: ids }, userId: account.userId },
        data: { isRead: true },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update notifications:', error);
    return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 });
  }
}

/**
 * DELETE /api/notifications
 * Delete notifications
 */
export async function DELETE(request: Request) {
  try {
    const account = await getDefaultAccount();
    if (!account) {
      return NextResponse.json({ error: 'No account' }, { status: 401 });
    }

    const body = await request.json();
    const { ids, clearAll } = body;

    if (clearAll) {
      await prisma.notification.deleteMany({
        where: { userId: account.userId },
      });
    } else if (ids && Array.isArray(ids)) {
      await prisma.notification.deleteMany({
        where: { id: { in: ids }, userId: account.userId },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete notifications:', error);
    return NextResponse.json({ error: 'Failed to delete notifications' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
