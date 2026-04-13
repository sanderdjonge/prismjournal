import { withAuth } from '@/lib/api/withAuth';
import { ok, notFound } from '@/lib/api/responses';
import prisma from '@/lib/prisma';
import logger from '@/lib/logger';

export const GET = withAuth(async (_req, ctx, session) => {
    const { id } = await (ctx.params as Promise<{ id: string }>);

    const account = await prisma.tradingAccount.findFirst({
        where: { id, userId: session.user.id },
        select: { id: true, name: true, currency: true, accountSize: true },
    });

    if (!account) {
        return notFound('Account');
    }

    let snapshots: any[] = [];
    try {
        snapshots = await prisma.dailyAccountSnapshot.findMany({
            where: { accountId: id },
            orderBy: { snapshotDate: 'asc' },
        });
    } catch (error) {
        logger.error({ err: error }, 'Error fetching snapshots');
    }

    let cumulativePnl = 0;
    const snapshotsWithCumulative = snapshots.map((snapshot: any) => {
        cumulativePnl += snapshot.dailyPnl || 0;
        return {
            ...snapshot,
            cumulativePnl,
        };
    });

    return ok({
        account: {
            id: account.id,
            name: account.name,
            currency: account.currency,
            accountSize: account.accountSize,
        },
        snapshots: snapshotsWithCumulative,
        totalSnapshots: snapshots.length,
    });
});

export const runtime = 'nodejs';
