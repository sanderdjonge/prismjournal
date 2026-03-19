import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAdmin } from '@/lib/api/withAdmin';
import type { AdminSession } from '@/lib/api/withAdmin';
import { sendBroadcastEmail } from '@/lib/email';
import { z } from 'zod';

const broadcastSchema = z.object({
  title: z.string().min(1).max(100),
  message: z.string().min(1).max(500),
  type: z.enum(['INFO', 'WARNING', 'SUCCESS']).default('INFO'),
});

export const POST = withAdmin(async (request: NextRequest, _ctx, session: AdminSession) => {
  try {
    const body = await request.json();
    const validation = broadcastSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    const { title, message, type } = validation.data;

    // Get all active users
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, email: true },
    });

    if (users.length === 0) {
      return NextResponse.json({ success: true, sent: 0, emailed: 0 });
    }

    // Create in-app notification for each user
    await prisma.notification.createMany({
      data: users.map(user => ({
        userId: user.id,
        title,
        message,
        type,
        isRead: false,
      })),
    });

    // Send email to users who have an email address (fire-and-forget, don't block on failures)
    const usersWithEmail = users.filter(u => u.email);
    let emailed = 0;
    await Promise.allSettled(
      usersWithEmail.map(async user => {
        const result = await sendBroadcastEmail(user.email!, title, message, type);
        if (result.success) emailed++;
      })
    );

    return NextResponse.json({
      success: true,
      sent: users.length,
      emailed,
      message: `Broadcast sent to ${users.length} user${users.length === 1 ? '' : 's'} (${emailed} emailed)`,
    });
  } catch (error) {
    console.error('Broadcast error:', error);
    return NextResponse.json({ error: 'Failed to send broadcast' }, { status: 500 });
  }
});
