import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import prisma from '@/lib/prisma';
import type { Session } from 'next-auth';
import { validateBody } from '@/lib/validations/common';
import { z } from 'zod';
import { backfillChallengeEvaluations } from '@/lib/services/challenge-backfill.service';
import { ok, created, badRequest, notFound } from '@/lib/api/responses';
import logger from '@/lib/logger';

const ruleSchema = z.object({
    type: z.enum(['MAX_DAILY_LOSS', 'MAX_TRADES_PER_DAY', 'MIN_RR', 'TIME_WINDOW', 'MAX_DRAWDOWN', 'WIN_RATE_TARGET']),
    value: z.union([z.number(), z.string()]),
    operator: z.enum(['LT', 'LTE', 'GT', 'GTE', 'EQ']).optional(),
});

const challengeSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    scope: z.enum(['GLOBAL', 'PER_ACCOUNT']).default('GLOBAL'),
    accountId: z.string().optional(),
    rules: z.array(ruleSchema).min(1),
    startDate: z.string(),
    endDate: z.string().optional(),
});

export const GET = withAuth(async (
    request: NextRequest,
    _ctx: Record<string, unknown>,
    session: Session & { user: { id: string } }
) => {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') === 'true';

    const where: Record<string, unknown> = {
        userId: session.user.id,
    };

    if (activeOnly) {
        where.isActive = true;
    }

    const challenges = await prisma.tradingChallenge.findMany({
        where,
        include: {
            _count: {
                select: { evaluations: true },
            },
        },
        orderBy: { createdAt: 'desc' },
    });

    return ok(challenges.map(c => ({
        ...c,
        evaluationCount: c._count.evaluations,
        _count: undefined,
    })));
});

export const POST = withAuth(async (
    request: NextRequest,
    _ctx: Record<string, unknown>,
    session: Session & { user: { id: string } }
) => {
    const validation = await validateBody(request, challengeSchema);
    if (!validation.success) return validation.response;
    const data = validation.data;

    if (data.accountId) {
        const account = await prisma.tradingAccount.findFirst({
            where: {
                id: data.accountId,
                userId: session.user.id,
            },
        });
        if (!account) {
            return notFound('Account');
        }
    }

    const challenge = await prisma.tradingChallenge.create({
        data: {
            userId: session.user.id,
            name: data.name,
            description: data.description,
            scope: data.scope,
            accountId: data.accountId,
            rules: data.rules,
            startDate: new Date(data.startDate),
            endDate: data.endDate ? new Date(data.endDate) : null,
            isActive: true,
        },
    });

    backfillChallengeEvaluations(challenge.id).catch(err => {
        logger.error({ err }, '[challenges] Backfill failed');
    });

    return created(challenge);
});
