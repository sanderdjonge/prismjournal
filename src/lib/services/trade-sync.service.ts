import prisma from '@/lib/prisma';
import { notifyTrade } from '@/lib/notifications';
import { sendTelegramMessage } from '@/lib/telegram';
import type { SyncTrade } from '@/lib/validations';

/**
 * Ensure a tag named `tagName` exists for the user and apply it to the trade.
 * Safe to call multiple times — idempotent via upsert.
 */
async function applyPlatformTag(userId: string, tradeId: string, tagName: string): Promise<void> {
    try {
        const tag = await prisma.tag.upsert({
            where: { userId_name: { userId, name: tagName } },
            create: { userId, name: tagName, color: '#00f2ff' },
            update: {},
        });
        await prisma.tradeTag.upsert({
            where: { tradeId_tagId: { tradeId, tagId: tag.id } },
            create: { tradeId, tagId: tag.id },
            update: {},
        });
    } catch {
        // Silently ignore errors — tagging must not fail the sync
    }
}

/**
 * Find or create a strategy by name for the given user.
 */
async function resolveStrategy(name: string, userId: string): Promise<string> {
    let strat = await prisma.strategy.findFirst({
        where: { name, userId },
    });
    if (!strat) {
        strat = await prisma.strategy.create({
            data: { name, userId },
        });
    }
    return strat.id;
}

/**
 * Send a Telegram trade alert for new or closed trades.
 */
async function sendTradeAlert(
    userId: string,
    trade: SyncTrade,
    isNew: boolean,
    isClosed: boolean,
) {
    if (!isNew && !isClosed) return;

    const config = await prisma.alertConfig.findUnique({ where: { userId } });
    if (!config?.telegramId || !config.enableTrades) return;

    let msg: string;
    if (isClosed) {
        const pnl = trade.pnl ?? 0;
        const sign = pnl >= 0 ? '+' : '';
        msg = `📊 <b>Trade Closed</b>\n${trade.type} ${trade.symbol} ${trade.volume} lots\nP&L: <b>${sign}$${pnl.toFixed(2)}</b>`;
    } else {
        msg = `🔔 <b>Trade Opened</b>\n${trade.type} ${trade.symbol} ${trade.volume} lots @ ${trade.entryPrice}`;
        if (trade.stopLoss) msg += `\nSL: ${trade.stopLoss}`;
        if (trade.takeProfit) msg += ` | TP: ${trade.takeProfit}`;
    }

    await sendTelegramMessage(config.telegramId, msg);
}

/**
 * Upsert a trade received from the MT5 bridge and fire notifications.
 */
export async function upsertSyncTrade(
    accountId: string,
    userId: string,
    trade: SyncTrade,
): Promise<void> {
    const strategyId = trade.strategy
        ? await resolveStrategy(trade.strategy, userId)
        : null;

    // Build update payload — only include fields present in the payload
    // so live P&L updates don't overwrite exit data with nulls
    const updateData: Record<string, unknown> = {};
    if (trade.exitPrice != null) updateData.exitPrice = trade.exitPrice;
    if (trade.pnl != null) updateData.pnl = trade.pnl;
    if (trade.exitTime) {
        updateData.exitTime = new Date(trade.exitTime);
        updateData.status = 'CLOSED';
    }
    if (trade.commission != null) updateData.commission = trade.commission;
    if (trade.swap != null) updateData.swap = trade.swap;
    if (trade.stopLoss != null) updateData.stopLoss = trade.stopLoss;
    if (trade.takeProfit != null) updateData.takeProfit = trade.takeProfit;
    if (strategyId) updateData.strategyId = strategyId;
    if (trade.mood) updateData.mood = trade.mood;
    if (trade.planCompliance) updateData.planCompliance = trade.planCompliance;

    const existing = await prisma.trade.findUnique({
        where: { ticket: trade.ticket },
        select: { id: true },
    });
    const isNew = !existing;
    const isClosed = !!trade.exitTime && !!trade.exitPrice;

    // BUY/SELL → LONG/SHORT
    const direction = trade.type === 'BUY' ? 'LONG' : 'SHORT';

    const upsertedTrade = await prisma.trade.upsert({
        where: { ticket: trade.ticket },
        create: {
            accountId,
            ticket: trade.ticket,
            symbol: trade.symbol,
            direction,
            status: trade.exitTime ? 'CLOSED' : 'OPEN',
            volume: trade.volume,
            entryPrice: trade.entryPrice ?? 0,
            exitPrice: trade.exitPrice,
            pnl: trade.pnl,
            entryTime: new Date(trade.entryTime),
            exitTime: trade.exitTime ? new Date(trade.exitTime) : null,
            commission: trade.commission,
            swap: trade.swap,
            stopLoss: trade.stopLoss,
            takeProfit: trade.takeProfit,
            strategyId,
            mood: trade.mood,
            planCompliance: trade.planCompliance,
        },
        update: updateData,
    });

    // Auto-apply MT5 platform tag for synced trades
    if (isNew) {
        applyPlatformTag(userId, upsertedTrade.id, 'MT5').catch(() => {});
    }

    // Fire notifications asynchronously — errors must not fail the sync
    sendTradeAlert(userId, trade, isNew, isClosed).catch(() => {});

    if (isNew || isClosed) {
        notifyTrade(userId, {
            symbol: trade.symbol,
            type: trade.type,
            volume: trade.volume,
            pnl: trade.pnl,
        }, isNew ? 'OPEN' : 'CLOSE').catch(() => {});
    }
}
