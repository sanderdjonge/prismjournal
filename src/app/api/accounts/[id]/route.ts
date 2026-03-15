import { withAuth } from '@/lib/api/withAuth';
import { ok, notFound } from '@/lib/api/responses';
import prisma from '@/lib/prisma';
import { validateBody, updateAccountSchema } from '@/lib/validations';

export const GET = withAuth(async (_req, ctx, session) => {
    const id = (ctx.params as { id: string }).id;

    const account = await prisma.tradingAccount.findFirst({
        where: { id, userId: session.user.id },
        include: { _count: { select: { trades: true } } },
    });
    if (!account) return notFound('');

    const stats = await prisma.trade.aggregate({
        where: { accountId: account.id, status: 'CLOSED' },
        _sum: { pnl: true },
        _count: true,
    });

    return ok({
        account: {
            ...account,
            tradeCount: account._count.trades,
            closedTradeCount: stats._count,
            totalPnl: stats._sum?.pnl ?? 0,
        },
    });
});

export const PATCH = withAuth(async (req, ctx, session) => {
    const id = (ctx.params as { id: string }).id;

    const existing = await prisma.tradingAccount.findFirst({
        where: { id, userId: session.user.id },
    });
    if (!existing) return notFound('');

    const validation = await validateBody(req, updateAccountSchema);
    if (!validation.success) return validation.response;

    const account = await prisma.tradingAccount.update({
        where: { id },
        data: validation.data,
    });

    return ok({ account });
});

export const DELETE = withAuth(async (_req, ctx, session) => {
    const id = (ctx.params as { id: string }).id;

    const existing = await prisma.tradingAccount.findFirst({
        where: { id, userId: session.user.id },
    });
    if (!existing) return notFound('');

    const account = await prisma.tradingAccount.update({
        where: { id },
        data: { isActive: false },
    });

    return ok({ account });
});

export const runtime = 'nodejs';
