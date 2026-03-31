import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import prisma from '@/lib/prisma';
import type { Session } from 'next-auth';
import { backfillChallengeEvaluations } from '@/lib/services/challenge-backfill.service';

// POST /api/challenges/[id]/backfill - Backfill evaluations for existing challenge
export const POST = withAuth(async (
    req: NextRequest,
    _ctx: Record<string, unknown>,
    session: Session & { user: { id: string } }
) => {
    // Extract id from URL (../challenges/[id]/backfill)
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const challengesIndex = pathParts.indexOf('challenges');
    const id = challengesIndex >= 0 ? pathParts[challengesIndex + 1] : null;

    if (!id) {
        return NextResponse.json({ error: 'Challenge ID required' }, { status: 400 });
    }

    // Verify challenge belongs to user
    const challenge = await prisma.tradingChallenge.findFirst({
        where: {
            id,
            userId: session.user.id,
        },
    });

    if (!challenge) {
        return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    const result = await backfillChallengeEvaluations(id);

    if (!result.success) {
        return NextResponse.json(
            { error: result.error || 'Backfill failed' },
            { status: 500 }
        );
    }

    return NextResponse.json({
        success: true,
        daysEvaluated: result.daysEvaluated,
    });
});