import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/api/withAuth';
import { ok, badRequest, internalError } from '@/lib/api/responses';
import logger from '@/lib/logger';

export const GET = withAuth(async (_req, _ctx, session) => {
  try {
    const userId = session.user.id;

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const unreadCount = notifications.filter(n => !n.isRead).length;

    return ok({ notifications, unreadCount });
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch notifications');
    return ok({ notifications: [], unreadCount: 0 });
  }
});

export const POST = withAuth(async (req, _ctx, session) => {
  try {
    const userId = session.user.id;

    const body = await req.json();
    const { type, title, message } = body;

    if (!type || !title || !message) {
      return badRequest('Missing required fields');
    }

    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
      },
    });

    return ok(notification);
  } catch (error) {
    logger.error({ err: error }, 'Failed to create notification');
    return internalError();
  }
});

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

    return ok({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Failed to update notifications');
    return internalError();
  }
});

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

    return ok({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Failed to delete notifications');
    return internalError();
  }
});

export const runtime = 'nodejs';
