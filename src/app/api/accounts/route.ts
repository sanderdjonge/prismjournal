import { withAuth } from '@/lib/api/withAuth';
import { ok, created, badRequest } from '@/lib/api/responses';
import prisma from '@/lib/prisma';
import { validateBody, createAccountSchema } from '@/lib/validations';

export const GET = withAuth(async (_req, _ctx, session) => {
    const userId = session.user.id;

    const accounts = await prisma.tradingAccount.findMany({
        where: { userId },
        orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
        include: { _count: { select: { trades: true } } },
    });

    const accountsWithStats = await Promise.all(
        accounts.map(async (account) => {
            const stats = await prisma.trade.aggregate({
                where: { accountId: account.id, status: 'CLOSED' },
                _sum: { pnl: true },
                _count: true,
            });
            return {
                ...account,
                tradeCount: account._count.trades,
                closedTradeCount: stats._count,
                totalPnl: stats._sum?.pnl ?? 0,
            };
        })
    );

    return ok({ accounts: accountsWithStats });
});

export const POST = withAuth(async (req, _ctx, session) => {
    const userId = session.user.id;

    const validation = await validateBody(req, createAccountSchema);
    if (!validation.success) return validation.response;

    const data = validation.data;

    if (data.platformAccountId) {
        const existing = await prisma.tradingAccount.findFirst({
            where: { userId, platform: data.platform, platformAccountId: data.platformAccountId },
        });
        if (existing) return badRequest('Account with this platform ID already exists');
    }

    const account = await prisma.tradingAccount.create({
        data: {
            userId,
            name: data.name,
            broker: data.broker,
            accountNumber: data.accountNumber ?? data.platformAccountId,
            platform: data.platform,
            platformAccountId: data.platformAccountId,
            currency: data.currency,
            leverage: data.leverage,
            accountType: data.accountType,
        },
    });

    return created({ account });
});

export const runtime = 'nodejs';
