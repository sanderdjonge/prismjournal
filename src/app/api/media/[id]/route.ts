import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { deleteFile } from '@/lib/storage';
import { withAuth } from '@/lib/api/withAuth';

export const DELETE = withAuth(async (_req, ctx, session) => {
    const { id } = (ctx as { params: { id: string } }).params;

    // Get media record with trade and account info
    const media = await prisma.media.findUnique({
        where: { id },
        include: {
            trade: {
                include: {
                    account: true
                }
            }
        }
    });

    if (!media) {
        return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    }

    // Verify user owns the trade
    if (media.trade.account.userId !== session.user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete file from storage
    await deleteFile(media.filename);

    // Delete media record from database
    await prisma.media.delete({
        where: { id }
    });

    return NextResponse.json({ success: true });
});

export const runtime = 'nodejs';
