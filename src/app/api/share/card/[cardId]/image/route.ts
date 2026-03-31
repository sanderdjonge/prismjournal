import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { readFile } from '@/lib/storage';
import { auth } from '@/lib/auth';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ cardId: string }> }
) {
    try {
        const { cardId } = await params;

        // Get share card with ownership info
        const shareCard = await prisma.shareCard.findUnique({
            where: { id: cardId },
            include: {
                media: true,
            },
        });

        if (!shareCard || !shareCard.media) {
            return NextResponse.json({ error: 'Card not found or expired' }, { status: 404 });
        }

        // Check expiration
        const isExpired = new Date() > shareCard.expiresAt;
        if (isExpired) {
            return NextResponse.json({ error: 'Card has expired' }, { status: 410 });
        }

        // Private cards require the owner's session
        if (!shareCard.isPublic) {
            const session = await auth();
            if (!session?.user?.id || session.user.id !== shareCard.userId) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
        }

        // Read the image file
        const imageBuffer = await readFile(shareCard.media.filename);

        return new NextResponse(new Uint8Array(imageBuffer), {
            headers: {
                'Content-Type': 'image/png',
                'Cache-Control': 'public, max-age=3600', // 1 hour cache
                'Expires': new Date(Date.now() + 3600000).toUTCString(),
            },
        });
    } catch (error) {
        console.error('[share-card-image] Failed to get image:', error);
        return NextResponse.json(
            { error: 'Failed to retrieve image' },
            { status: 500 }
        );
    }
}