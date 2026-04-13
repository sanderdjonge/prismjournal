import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { readFile } from '@/lib/storage';
import { withAuth } from '@/lib/api/withAuth';
import { notFound, forbidden } from '@/lib/api/responses';
import logger from '@/lib/logger';

export const GET = withAuth(async (_req, ctx, session) => {
    const { id } = await (ctx as { params: Promise<{ id: string }> }).params;

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
        return notFound('Media');
    }

    if (media.trade.account.userId !== session.user.id) {
        return forbidden();
    }

    try {
        const fileBuffer = await readFile(media.filename);

        return new NextResponse(new Uint8Array(fileBuffer), {
            headers: {
                'Content-Type': media.mimetype,
                'Content-Length': media.size.toString(),
                'Cache-Control': 'private, max-age=3600',
            },
        });
    } catch (error) {
        logger.error({ err: error }, 'Error reading file');
        return notFound('File');
    }
});

export const runtime = 'nodejs';
