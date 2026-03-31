import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import type { Session } from 'next-auth';
import { z } from 'zod';
import { generateShareCard } from '@/lib/services/share-card.service';

const generateCardSchema = z.object({
    tradeId: z.string(),
    includeScreenshot: z.boolean().default(true),
    showPrismScore: z.boolean().default(false),
    isPublic: z.boolean().default(false),
    platform: z.enum(['discord', 'twitter', 'reddit', 'general']).default('general'),
});

export const POST = withAuth(async (
    request: NextRequest,
    _ctx: Record<string, unknown>,
    session: Session & { user: { id: string } }
) => {
    try {
        const body = await request.json();
        const validated = generateCardSchema.parse(body);

        const result = await generateShareCard({
            tradeId: validated.tradeId,
            userId: session.user.id,
            includeScreenshot: validated.includeScreenshot,
            showPrismScore: validated.showPrismScore,
            isPublic: validated.isPublic,
            platform: validated.platform,
        });

        return NextResponse.json(result);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Invalid request', details: error.errors },
                { status: 400 }
            );
        }

        if (error instanceof Error) {
            if (error.message.includes('not found')) {
                return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
            }
            if (error.message.includes('Unauthorized')) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
            }
        }

        console.error('[share-card] Generation error:', error);
        return NextResponse.json(
            { error: 'Failed to generate share card' },
            { status: 500 }
        );
    }
});