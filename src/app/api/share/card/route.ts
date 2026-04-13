import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import type { Session } from 'next-auth';
import { validateBody } from '@/lib/validations/common';
import { z } from 'zod';
import { generateShareCard } from '@/lib/services/share-card.service';
import { ok, badRequest, notFound, forbidden, internalError } from '@/lib/api/responses';
import logger from '@/lib/logger';

const generateCardSchema = z.object({
    tradeId: z.string(),
    includeScreenshot: z.boolean(),
    showPrismScore: z.boolean(),
    isPublic: z.boolean(),
    platform: z.enum(['discord', 'twitter', 'reddit', 'general']),
    comment: z.string().max(200).optional(),
});

export const POST = withAuth(async (
    request: NextRequest,
    _ctx: Record<string, unknown>,
    session: Session & { user: { id: string } }
) => {
    const validation = await validateBody(request, generateCardSchema);
    if (!validation.success) return validation.response;
    const validated = validation.data;

    try {
        const result = await generateShareCard({
            tradeId: validated.tradeId,
            userId: session.user.id,
            includeScreenshot: validated.includeScreenshot,
            showPrismScore: validated.showPrismScore,
            isPublic: validated.isPublic,
            platform: validated.platform,
            comment: validated.comment,
        });

        return ok(result);
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes('not found')) {
                return notFound('Trade');
            }
            if (error.message.includes('Unauthorized')) {
                return forbidden();
            }
        }

        logger.error({ err: error }, '[share-card] Generation error');
        return internalError();
    }
});
