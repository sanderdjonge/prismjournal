import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/api/withAuth';

/**
 * GET /api/notifications
 * Get all notifications for the current user
 */
export const GET = withAuth(async (_req, _ctx, session) => {
  try {
    const userId = session.user.id;

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const unreadCount = notifications.filter(n => !n.isRead).length;

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    console.error('Failed to fetch notifications:', error);
    return NextResponse.json({ notifications: [], unreadCount: 0 });
  }
});

/**
 * POST /api/notifications
 * Create a new notification
 */
export const POST = withAuth(async (req, _ctx, session) => {
  try {
    const userId = session.user.id;

    const body = await req.json();
    const { type, title, message } = body;

    if (!type || !title || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const notification = await prisma.notification.create({
      data: {
        userId,
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
});

/**
 * PATCH /api/notifications
 * Mark notifications as read
 */
export const PATCH = withAuth(async (req, _ctx, session) => {
  try {
    const userId = session.user.id;

    const body = await req.json();
    const { ids, markAll } = body;

    if (markAll) {
      await prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      });
    } else if (ids && Array.isArray(ids)) {
      await prisma.notification.updateMany({
        where: { id: { in: ids }, userId },
        data: { isRead: true },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update notifications:', error);
    return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 });
  }
});

/**
 * DELETE /api/notifications
 * Delete notifications
 */
export const DELETE = withAuth(async (req, _ctx, session) => {
  try {
    const userId = session.user.id;

    const body = await req.json();
    const { ids, clearAll } = body;

    if (clearAll) {
      await prisma.notification.deleteMany({
        where: { userId },
      });
    } else if (ids && Array.isArray(ids)) {
      await prisma.notification.deleteMany({
        where: { id: { in: ids }, userId },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete notifications:', error);
    return NextResponse.json({ error: 'Failed to delete notifications' }, { status: 500 });
  }
});

export const runtime = 'nodejs';
