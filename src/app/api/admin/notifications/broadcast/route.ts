import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { withAdmin } from '@/lib/api/withAdmin';
import type { AdminSession } from '@/lib/api/withAdmin';
import { sendBroadcastEmail } from '@/lib/email';
import { validateBody } from '@/lib/validations/common';
import { z } from 'zod';
import { ok, badRequest, internalError } from '@/lib/api/responses';
import logger from '@/lib/logger';

const broadcastSchema = z.object({
  title: z.string().min(1).max(100),
  message: z.string().min(1).max(500),
  type: z.enum(['INFO', 'WARNING', 'SUCCESS']),
});

export const POST = withAdmin(async (request: NextRequest, _ctx, session: AdminSession) => {
  const bodyValidation = await validateBody(request, broadcastSchema);
  if (!bodyValidation.success) return bodyValidation.response;
  const { title, message, type } = bodyValidation.data;

  try {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, email: true },
    });

    if (users.length === 0) {
      return ok({ success: true, sent: 0, emailed: 0 });
    }

    await prisma.notification.createMany({
      data: users.map(user => ({
        userId: user.id,
        title,
        message,
        type,
        isRead: false,
      })),
    });

    const usersWithEmail = users.filter(u => u.email);
    let emailed = 0;
    await Promise.allSettled(
      usersWithEmail.map(async user => {
        const result = await sendBroadcastEmail(user.email!, title, message, type);
        if (result.success) emailed++;
      })
    );

    return ok({
      success: true,
      sent: users.length,
      emailed,
      message: `Broadcast sent to ${users.length} user${users.length === 1 ? '' : 's'} (${emailed} emailed)`,
    });
  } catch (error) {
    logger.error({ err: error }, 'Broadcast error');
    return internalError();
  }
});
