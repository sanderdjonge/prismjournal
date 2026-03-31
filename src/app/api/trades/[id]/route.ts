import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { validateBody, tradeUpdateSchema } from '@/lib/validations';
import { deleteFile } from '@/lib/storage';
import { getAllUserAccounts } from '@/lib/getAccount';
import { withAuth } from '@/lib/api/withAuth';
import { evaluateAndRecordCompliance, TradeContext } from '@/lib/services/strategy-compliance.service';

export const GET = withAuth(async (_req, ctx, session) => {
    const { id } = await (ctx as { params: Promise<{ id: string }> }).params;

    // Verify ownership before returning media
    const trade = await prisma.trade.findFirst({
        where: { id, account: { userId: session.user.id } },
        select: { id: true },
    });
    if (!trade) {
        return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
    }

    const media = await prisma.media.findMany({
        where: {
            tradeId: id,
            type: { not: 'SHARE_CARD' }, // Exclude share cards from screenshot view
        },
        select: { id: true, filename: true, timeframe: true, event: true },
    });

    const mediaWithUrls = media.map(m => ({
        id: m.id,
        url: `/api/media/${m.id}/file`,
        timeframe: m.timeframe,
        event: m.event,
    }));

    return NextResponse.json({ media: mediaWithUrls });
});

export const PATCH = withAuth(async (req, ctx, session) => {
    const { id } = await (ctx as { params: Promise<{ id: string }> }).params;

    const validation = await validateBody(req, tradeUpdateSchema);
    if (!validation.success) {
        return validation.response;
    }

    const body = validation.data;

    // Verify ownership
    const existingTrade = await prisma.trade.findFirst({
        where: { id, account: { userId: session.user.id } },
        include: { account: true },
    });
    if (!existingTrade) {
        return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
    }

    // Handle strategy - use existing strategyId or find by name
    let strategyId: string | null | undefined = undefined;
    if (body.strategyId !== undefined) {
        // If strategyId is explicitly provided, use it directly
        strategyId = body.strategyId || null;
    } else if (body.strategy !== undefined) {
        // Legacy: strategy field contains name - find existing strategy by name
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

    // Account reassignment
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

    // Re-evaluate compliance only when strategyId is explicitly changed on a closed trade.
    // Always clear existing violations for this trade first (clean slate), then evaluate
    // with the new strategy. If strategy is removed (null), violations are simply cleared.
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
            console.error('[trades] Failed to evaluate compliance:', err);
        }
    }

    return NextResponse.json({ success: true, id: trade.id });
});

export const DELETE = withAuth(async (_req, ctx, session) => {
    const { id } = await (ctx as { params: Promise<{ id: string }> }).params;

    // Verify ownership before deleting
    const trade = await prisma.trade.findFirst({
        where: { id, account: { userId: session.user.id } },
        select: { id: true },
    });
    if (!trade) {
        return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
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

    return NextResponse.json({ success: true });
});

export const runtime = 'nodejs';
