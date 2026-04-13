import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { readFile } from '@/lib/storage';
import { auth } from '@/lib/auth';
import { notFound, unauthorized, internalError } from '@/lib/api/responses';
import logger from '@/lib/logger';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ cardId: string }> }
) {
    try {
        const { cardId } = await params;

        const shareCard = await prisma.shareCard.findUnique({
            where: { id: cardId },
            include: {
                media: true,
            },
        });

        if (!shareCard || !shareCard.media) {
            return notFound('Card');
        }

        const isExpired = new Date() > shareCard.expiresAt;
        if (isExpired) {
            return notFound('Card');
        }

        if (!shareCard.isPublic) {
            const session = await auth();
            if (!session?.user?.id || session.user.id !== shareCard.userId) {
                return unauthorized();
            }
        }

        const imageBuffer = await readFile(shareCard.media.filename);

        return new NextResponse(new Uint8Array(imageBuffer), {
            headers: {
                'Content-Type': 'image/png',
                'Cache-Control': 'public, max-age=3600',
                'Expires': new Date(Date.now() + 3600000).toUTCString(),
            },
        });
    } catch (error) {
        logger.error({ err: error }, '[share-card-image] Failed to get image');
        return internalError();
    }
}
