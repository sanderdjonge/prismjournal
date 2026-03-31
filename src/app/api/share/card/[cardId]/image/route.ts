import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { readFile } from '@/lib/storage';

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

        // Check if card is public or expired
        const isExpired = new Date() > shareCard.expiresAt;
        if (isExpired) {
            return NextResponse.json({ error: 'Card has expired' }, { status: 410 });
        }

        // For private cards, we allow access via the unique card ID
        // The ID itself is the "key" - it's a cuid that's hard to guess
        // If more security is needed, we can add auth check here

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