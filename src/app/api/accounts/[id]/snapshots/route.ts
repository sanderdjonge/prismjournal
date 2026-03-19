import { withAuth } from '@/lib/api/withAuth';
import { ok, notFound } from '@/lib/api/responses';
import prisma from '@/lib/prisma';

/**
 * GET /api/accounts/[id]/snapshots
 * Returns all daily snapshots for an account
 */
export const GET = withAuth(async (_req, ctx, session) => {
    const { id } = await (ctx.params as Promise<{ id: string }>);

    // Verify the account belongs to the user
    const account = await prisma.tradingAccount.findFirst({
        where: { id, userId: session.user.id },
        select: { id: true, name: true, currency: true, accountSize: true },
    });

    if (!account) {
        return notFound('Account');
    }

    // Get all daily snapshots for the account
    let snapshots: any[] = [];
    try {
        snapshots = await prisma.dailyAccountSnapshot.findMany({
            where: { accountId: id },
            orderBy: { snapshotDate: 'asc' },
        });
    } catch (error) {
        console.error('Error fetching snapshots:', error);
        // Table might not exist yet, return empty array
    }

    // Calculate cumulative P&L
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
