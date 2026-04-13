import prisma from '@/lib/prisma';
import { validateBody, tradeUpdateSchema } from '@/lib/validations';
import { deleteFile } from '@/lib/storage';
import { getAllUserAccounts } from '@/lib/getAccount';
import { withAuth } from '@/lib/api/withAuth';
import { evaluateAndRecordCompliance, TradeContext } from '@/lib/services/strategy-compliance.service';
import { ok, notFound } from '@/lib/api/responses';
import logger from '@/lib/logger';

export const GET = withAuth(async (_req, ctx, session) => {
    const { id } = await (ctx as { params: Promise<{ id: string }> }).params;

    const trade = await prisma.trade.findFirst({
        where: { id, account: { userId: session.user.id } },
        include: {
            account: { select: { id: true, name: true } },
            strategy: { select: { id: true, name: true } },
            tags: { select: { id: true, name: true, color: true } },
        },
    });
    if (!trade) {
        return notFound('Trade');
    }

    const media = await prisma.media.findMany({
        where: {
            tradeId: id,
            type: { not: 'SHARE_CARD' },
        },
        select: { id: true, filename: true, timeframe: true, event: true },
    });

    return ok({
        id: trade.id,
        symbol: trade.symbol,
        direction: trade.direction,
        type: trade.direction,
        volume: trade.volume,
        entry: trade.entryPrice,
        exit: trade.exitPrice,
        entryTime: trade.entryTime?.toISOString() ?? null,
        exitTime: trade.exitTime?.toISOString() ?? null,
        takeProfit: trade.takeProfit,
        stopLoss: trade.stopLoss,
        pnl: trade.pnl,
        rMultiple: trade.rMultiple,
        mae: trade.mae,
        mfe: trade.mfe,
        notes: trade.notes,
        mood: trade.mood,
        planCompliance: trade.planCompliance,
        entryRating: trade.entryRating,
        exitRating: trade.exitRating,
        managementRating: trade.managementRating,
        closeReason: trade.closeReason,
        strategy: trade.strategy?.name ?? null,
        accountName: trade.account?.name ?? null,
        tags: trade.tags,
        media: media.map(m => ({
            id: m.id,
            url: `/api/media/${m.id}/file`,
            timeframe: m.timeframe,
            event: m.event,
        })),
    });
});

export const PATCH = withAuth(async (req, ctx, session) => {
    const { id } = await (ctx as { params: Promise<{ id: string }> }).params;

    const validation = await validateBody(req, tradeUpdateSchema);
    if (!validation.success) {
        return validation.response;
    }

    const body = validation.data;

    const existingTrade = await prisma.trade.findFirst({
        where: { id, account: { userId: session.user.id } },
        include: { account: true },
    });
    if (!existingTrade) {
        return notFound('Trade');
    }

    let strategyId: string | null | undefined = undefined;
    if (body.strategyId !== undefined) {
        strategyId = body.strategyId || null;
    } else if (body.strategy !== undefined) {
        if (body.strategy) {
            const existingStrategy = await prisma.strategy.findFirst({
                where: {
                    name: body.strategy,
                    userId: existingTrade.account.userId,
                },
            });
            strategyId = existingStrategy?.id || null;
        } else {
            strategyId = null;
        }
    }

    const updateData: Record<string, unknown> = {};

    if (body.symbol !== undefined) updateData.symbol = body.symbol;
    if (body.type !== undefined) updateData.direction = body.type;
    if (body.volume !== undefined) updateData.volume = body.volume;
    if (body.entryPrice !== undefined) updateData.entryPrice = body.entryPrice;
    if (body.exitPrice !== undefined) updateData.exitPrice = body.exitPrice;
    if (body.pnl !== undefined) updateData.pnl = body.pnl;
    if (body.status !== undefined) {
        updateData.status = body.status;
        if (body.status === 'CLOSED' && !existingTrade.exitTime) {
            updateData.exitTime = new Date();
        } else if (body.status === 'OPEN') {
            updateData.exitTime = null;
            updateData.exitPrice = null;
            updateData.pnl = null;
        }
    }
    if (strategyId !== undefined) updateData.strategyId = strategyId;
    if (body.mood !== undefined) updateData.mood = body.mood;
    if (body.planCompliance !== undefined) updateData.planCompliance = body.planCompliance;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.takeProfit !== undefined) updateData.takeProfit = body.takeProfit;
    if (body.stopLoss !== undefined) updateData.stopLoss = body.stopLoss;
    if (body.entryRating !== undefined) updateData.entryRating = body.entryRating;
    if (body.exitRating !== undefined) updateData.exitRating = body.exitRating;
    if (body.managementRating !== undefined) updateData.managementRating = body.managementRating;

    if (body.accountId && body.accountId !== existingTrade.accountId) {
        const userAccounts = await getAllUserAccounts(existingTrade.account.userId);
        const targetAccount = userAccounts.find(a => a.id === body.accountId);
        if (targetAccount) updateData.accountId = targetAccount.id;
    }

    const trade = await prisma.trade.update({
        where: { id },
        data: updateData,
        include: { strategy: true },
    });

    const strategyChanged = strategyId !== undefined;
    const isClosedTrade = trade.status === 'CLOSED' && trade.exitTime;

    if (strategyChanged && isClosedTrade) {
        try {
            await prisma.strategyViolation.deleteMany({ where: { tradeId: trade.id } });

            if (strategyId) {
                const tradeContext: TradeContext = {
                    id: trade.id,
                    accountId: trade.accountId,
                    userId: existingTrade.account.userId,
                    strategyId,
                    symbol: trade.symbol,
                    direction: trade.direction,
                    entryPrice: trade.entryPrice,
                    exitPrice: trade.exitPrice,
                    stopLoss: trade.stopLoss,
                    takeProfit: trade.takeProfit,
                    volume: trade.volume,
                    entryTime: trade.entryTime,
                    exitTime: trade.exitTime!,
                    pnl: trade.pnl,
                    initialStopLoss: trade.initialStopLoss,
                };
                await evaluateAndRecordCompliance(tradeContext, strategyId);
            }
        } catch (err) {
            logger.error({ err }, '[trades] Failed to evaluate compliance');
        }
    }

    return ok({ success: true, id: trade.id });
});

export const DELETE = withAuth(async (_req, ctx, session) => {
    const { id } = await (ctx as { params: Promise<{ id: string }> }).params;

    const trade = await prisma.trade.findFirst({
        where: { id, account: { userId: session.user.id } },
        select: { id: true },
    });
    if (!trade) {
        return notFound('Trade');
    }

    const mediaFiles = await prisma.media.findMany({
        where: { tradeId: id },
        select: { filename: true },
    });

    for (const media of mediaFiles) {
        await deleteFile(media.filename);
    }

    await prisma.media.deleteMany({ where: { tradeId: id } });
    await prisma.trade.delete({ where: { id } });

    return ok({ success: true });
});

export const runtime = 'nodejs';
