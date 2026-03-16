import { withAuth } from '@/lib/api/withAuth';
import { ok, notFound, badRequest } from '@/lib/api/responses';
import prisma from '@/lib/prisma';

// Get challenge progress for an account
export const GET = withAuth(async (req, ctx, session) => {
    const userId = session.user.id;
    const params = ctx.params as { id: string };
    const accountId = params.id;

    // Verify account belongs to user
    const account = await prisma.tradingAccount.findFirst({
        where: { id: accountId, userId },
    });

    if (!account) {
        return notFound('Account not found');
    }

    // Get challenge phases
    const phases = await (prisma as any).challengePhase.findMany({
        where: { accountId },
        orderBy: { phaseNumber: 'asc' },
    });

    // Get current phase
    const currentPhase = phases?.find((p: any) => p.status === 'IN_PROGRESS');

    // Get violations for this account
    const violations = await (prisma as any).ruleViolation.findMany({
        where: { accountId },
        orderBy: { occurredAt: 'desc' },
        take: 20,
    });

    // Get latest snapshot
    const latestSnapshot = await (prisma as any).dailyAccountSnapshot.findFirst({
        where: { accountId },
        orderBy: { snapshotDate: 'desc' },
    });

    // Calculate current progress
    const accountSize = account.accountSize || 10000;
    const currentBalance = account.currentBalance || accountSize;
    const progressPercent = currentPhase 
        ? ((currentBalance - accountSize) / accountSize * 100)
        : 0;

    return ok({
        phases,
        currentPhase: currentPhase ? {
            ...currentPhase,
            calculatedProgress: progressPercent,
        } : null,
        violations,
        latestSnapshot,
        accountInfo: {
            accountSize,
            currentBalance,
            profitSplit: account.profitSplit,
            currency: account.currency,
        },
    });
});
