import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import prisma from '@/lib/prisma';
import type { Session } from 'next-auth';
import { backfillChallengeEvaluations } from '@/lib/services/challenge-backfill.service';
import { ok, badRequest, notFound, internalError } from '@/lib/api/responses';

export const POST = withAuth(async (
    req: NextRequest,
    _ctx: Record<string, unknown>,
    session: Session & { user: { id: string } }
) => {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const challengesIndex = pathParts.indexOf('challenges');
    const id = challengesIndex >= 0 ? pathParts[challengesIndex + 1] : null;

    if (!id) {
        return badRequest('Challenge ID required');
    }

    const challenge = await prisma.tradingChallenge.findFirst({
        where: {
            id,
            userId: session.user.id,
        },
    });

    if (!challenge) {
        return notFound('Challenge');
    }

    const result = await backfillChallengeEvaluations(id);

    if (!result.success) {
        return internalError();
    }

    return ok({ success: true, daysEvaluated: result.daysEvaluated });
});
