import { NextRequest, NextResponse } from 'next/server';
import { generateWidget } from '@/lib/services/widget.service';
import logger from '@/lib/logger';

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ profileId: string }> }
) {
    try {
        const { profileId } = await params;
        const imageBuffer = await generateWidget(profileId);

        return new NextResponse(new Uint8Array(imageBuffer), {
            headers: {
                'Content-Type': 'image/png',
                // Cache for 1 hour — regenerated daily by cron
                'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message.includes('not found') || message.includes('not enabled')) {
            return new NextResponse('Profile not found', { status: 404 });
        }
        logger.error({ err: error }, '[widget.png] Generation error');
        return new NextResponse('Failed to generate widget', { status: 500 });
    }
}

export const runtime = 'nodejs';
