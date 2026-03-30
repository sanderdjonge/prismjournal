import { withAuth } from '@/lib/api/withAuth';
import { ok, badRequest } from '@/lib/api/responses';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { evaluateAndRecordCompliance, TradeContext } from '@/lib/services/strategy-compliance.service';

const bulkDeleteSchema = z.object({
    action: z.literal('delete'),
    tradeIds: z.array(z.string()).min(1).max(100),
});

const bulkTagSchema = z.object({
    action: z.literal('tag'),
    tradeIds: z.array(z.string()).min(1).max(100),
    tagId: z.string(),
});

const bulkAccountSchema = z.object({
    action: z.literal('account'),
    tradeIds: z.array(z.string()).min(1).max(100),
    accountId: z.string(),
});

const bulkStrategySchema = z.object({
    action: z.literal('setStrategy'),
    tradeIds: z.array(z.string()).min(1).max(100),
    strategyId: z.string().nullable(),
});

const bulkSchema = z.discriminatedUnion('action', [
    bulkDeleteSchema,
    bulkTagSchema,
    bulkAccountSchema,
    bulkStrategySchema,
]);

export const POST = withAuth(async (req, _ctx, session) => {
    const body = await req.json().catch(() => null);
    const parsed = bulkSchema.safeParse(body);
    if (!parsed.success) return badRequest('Invalid request body');

    // Verify all tradeIds belong to this user (any of their accounts)
    const trades = await prisma.trade.findMany({
        where: { id: { in: parsed.data.tradeIds }, account: { userId: session.user.id } },
        select: { id: true },
    });
    const validIds = trades.map((t) => t.id);

    if (validIds.length === 0) {
        return badRequest('No valid trades found');
    }

    if (parsed.data.action === 'delete') {
        await prisma.trade.deleteMany({ where: { id: { in: validIds } } });
        return ok({ deleted: validIds.length });
    }

    if (parsed.data.action === 'tag') {
        const { tagId } = parsed.data;
        // Verify tag belongs to user
        const tag = await prisma.tag.findFirst({
            where: { id: tagId, userId: session.user.id },
        });
        if (!tag) return badRequest('Tag not found');

        // Upsert TradeTag for each trade (skip if already tagged)
        await Promise.all(
            validIds.map((tradeId) =>
                prisma.tradeTag.upsert({
                    where: { tradeId_tagId: { tradeId, tagId } },
                    create: { tradeId, tagId },
                    update: {},
                })
            )
        );
        return ok({ tagged: validIds.length });
    }

    if (parsed.data.action === 'account') {
        const { accountId } = parsed.data;
        // Verify account belongs to this user
        const account = await prisma.tradingAccount.findFirst({
            where: { id: accountId, userId: session.user.id, isActive: true },
        });
        if (!account) return badRequest('Account not found');

        await prisma.trade.updateMany({
            where: { id: { in: validIds } },
            data: { accountId },
        });
        return ok({ moved: validIds.length });
    }

    if (parsed.data.action === 'setStrategy') {
        const { strategyId } = parsed.data;

        // Verify strategy ownership if strategyId is provided
        if (strategyId) {
            const strategy = await prisma.strategy.findFirst({
                where: { id: strategyId, userId: session.user.id },
            });
            if (!strategy) return badRequest('Strategy not found');
        }

        // Fetch full trade data needed for compliance evaluation
        const fullTrades = await prisma.trade.findMany({
            where: { id: { in: validIds } },
            include: { account: { select: { userId: true } } },
        });

        // Update strategyId on all selected trades
        await prisma.trade.updateMany({
            where: { id: { in: validIds } },
            data: { strategyId },
        });

        // Re-evaluate compliance for each closed trade (fire-and-forget per trade)
        for (const trade of fullTrades) {
            if (trade.status !== 'CLOSED' || !trade.exitTime) continue;
            // Delete old violations for this trade first
            await prisma.strategyViolation.deleteMany({ where: { tradeId: trade.id } });
            if (strategyId) {
                const tradeContext: TradeContext = {
                    id: trade.id,
                    accountId: trade.accountId,
                    userId: trade.account.userId,
                    strategyId,
                    symbol: trade.symbol,
                    direction: trade.direction,
                    entryPrice: trade.entryPrice,
                    exitPrice: trade.exitPrice,
                    stopLoss: trade.stopLoss,
                    takeProfit: trade.takeProfit,
                    volume: trade.volume,
                    entryTime: trade.entryTime,
                    exitTime: trade.exitTime,
                    pnl: trade.pnl,
                    initialStopLoss: trade.initialStopLoss,
                };
                await evaluateAndRecordCompliance(tradeContext, strategyId).catch(() => {});
            }
        }

        return ok({ updated: validIds.length });
    }

    return badRequest('Unknown action');
});
