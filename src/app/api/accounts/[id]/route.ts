import { withAuth } from '@/lib/api/withAuth';
import { ok, notFound, internalError, badRequest } from '@/lib/api/responses';
import prisma from '@/lib/prisma';
import { validateBody, updateAccountSchema } from '@/lib/validations';

export const GET = withAuth(async (_req, ctx, session) => {
    const { id } = await (ctx.params as Promise<{ id: string }>);

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
    const { id } = await (ctx.params as Promise<{ id: string }>);

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

export const DELETE = withAuth(async (req, ctx, session) => {
    const { id } = await (ctx.params as Promise<{ id: string }>);
    const userId = session.user.id;
    const permanent = new URL(req.url).searchParams.get('permanent') === 'true';

    try {
        const accountExists = await prisma.tradingAccount.findUnique({
            where: { id },
            select: { id: true, userId: true, name: true, isActive: true, _count: { select: { trades: true } } },
        });

        if (!accountExists || accountExists.userId !== userId) {
            return notFound('Account');
        }

        if (permanent) {
            // Must be archived first before permanent deletion
            if (accountExists.isActive) {
                return badRequest('Account must be archived before it can be permanently deleted');
            }

            // Hard delete: remove all related data then the account
            await prisma.$transaction([
                prisma.equitySnapshot.deleteMany({ where: { accountId: id } }),
                prisma.dailyAccountSnapshot.deleteMany({ where: { accountId: id } }),
                prisma.ruleViolation.deleteMany({ where: { accountId: id } }),
                prisma.challengePhase.deleteMany({ where: { accountId: id } }),
                prisma.trade.deleteMany({ where: { accountId: id } }),
                prisma.tradingAccount.delete({ where: { id } }),
            ]);

            return ok({ deleted: true });
        }

        // Soft delete (archive)
        if (!accountExists.isActive) {
            return ok({ account: accountExists, message: 'Account was already archived' });
        }

        const account = await prisma.tradingAccount.update({
            where: { id },
            data: { isActive: false },
        });

        return ok({ account });
    } catch (error) {
        console.error('[DELETE /api/accounts/[id]] Error:', error);
        return internalError();
    }
});

export const runtime = 'nodejs';
