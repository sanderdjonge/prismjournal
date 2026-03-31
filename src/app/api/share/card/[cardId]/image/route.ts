import { NextRequest, NextResponse } from 'next/server';
import { getShareCardImage } from '@/lib/services/share-card.service';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ cardId: string }> }
) {
    try {
        const { cardId } = await params;
        const imageBuffer = await getShareCardImage(cardId);

        if (!imageBuffer) {
            return NextResponse.json({ error: 'Card not found or expired' }, { status: 404 });
        }

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