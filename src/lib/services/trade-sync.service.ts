import prisma from '@/lib/prisma';
import logger from '@/lib/logger';
import { createNotification } from '@/lib/notifications';
import { sendTelegramMessage } from '@/lib/telegram';
import type { SyncTrade } from '@/lib/validations';
import { captureAutoScreenshots } from './auto-screenshot.service';

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

function formatDateTime(date: Date | string | null | undefined): string {
    if (!date) return '—';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('en-GB', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
        timeZone: 'UTC',
        hour12: false,
    }) + ' UTC';
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
 * Parse a broker time string into a UTC Date.
 * Handles MT5 dot-separated format ("2026.03.23 14:20:35"), ISO strings,
 * and strings with or without timezone suffixes.
 * Used only for history syncs — live trades use server time instead.
 */
function parseBrokerTime(timeStr: string): Date {
    // MT5 sends "YYYY.MM.DD HH:MM:SS" — normalise dots to dashes
    const normalised = timeStr.replace(/^(\d{4})\.(\d{2})\.(\d{2})/, '$1-$2-$3');
    // If the string already has timezone info, parse directly
    if (/Z$|[+-]\d{2}:?\d{2}$/.test(normalised)) {
        return new Date(normalised);
    }
    // Otherwise treat as UTC
    const d = new Date(normalised.replace(' ', 'T') + 'Z');
    return isNaN(d.getTime()) ? new Date(normalised) : d;
}

/**
 * Upsert a trade received from the MT5 bridge and fire notifications.
 *
 * Time strategy:
 *  - Live syncs: use server time (new Date()) for entry/exit — avoids all broker
 *    timezone ambiguity, works correctly regardless of broker server UTC offset.
 *  - History syncs: use parsed broker time (best-effort, no offset correction).
 */
export async function upsertSyncTrade(
    accountId: string,
    userId: string,
    trade: SyncTrade,
    isHistorySync = false,
): Promise<void> {
    const strategyId = trade.strategy
        ? await resolveStrategy(trade.strategy, userId)
        : null;

    const existing = await prisma.trade.findUnique({
        where: { ticket: trade.ticket },
        select: { id: true, entryTime: true, initialStopLoss: true, entryPrice: true },
    });
    const isNew = !existing;
    const isClosed = !!trade.exitTime && !!trade.exitPrice;
    logger.info({ ticket: trade.ticket, isNew, isClosed, isHistorySync, hasExitTime: !!trade.exitTime, hasExitPrice: !!trade.exitPrice }, '[trade-sync] trade event detected');


    // Always parse broker time directly — the EA sends UTC timestamps (TimeGMT-based)
    // so parseBrokerTime gives the correct UTC time for both live and history syncs.
    // For live trade updates (not new), preserve the original entryTime.
    const entryTime = isNew
        ? parseBrokerTime(trade.entryTime)
        : existing!.entryTime;

    const exitTime = trade.exitTime
        ? parseBrokerTime(trade.exitTime)
        : null;

    // Build update payload — only include fields present in the payload
    // so live P&L updates don't overwrite exit data with nulls
    const updateData: Record<string, unknown> = {};
    if (trade.exitPrice != null) updateData.exitPrice = trade.exitPrice;
    if (trade.pnl != null) updateData.pnl = trade.pnl;
    if (trade.exitTime) {
        updateData.exitTime = exitTime;
        updateData.status = 'CLOSED';
    }
    if (trade.commission != null) updateData.commission = trade.commission;
    if (trade.swap != null) updateData.swap = trade.swap;
    if (trade.stopLoss != null) updateData.stopLoss = trade.stopLoss;
    if (trade.takeProfit != null) updateData.takeProfit = trade.takeProfit;
    if (strategyId) updateData.strategyId = strategyId;
    if (trade.mood) updateData.mood = trade.mood;
    if (trade.planCompliance) updateData.planCompliance = trade.planCompliance;
    if (trade.closeReason != null) updateData.closeReason = trade.closeReason;
    if (trade.max_adverse_excursion != null && trade.max_adverse_excursion > 0) updateData.mae = trade.max_adverse_excursion;
    if (trade.max_favorable_excursion != null && trade.max_favorable_excursion > 0) updateData.mfe = trade.max_favorable_excursion;

    // BUY/SELL → LONG/SHORT
    const direction = trade.type === 'BUY' ? 'LONG' : 'SHORT';

    // On update: detect breakeven — never overwrite initialStopLoss
    if (!isNew && trade.stopLoss != null && existing!.initialStopLoss != null && existing!.entryPrice != null) {
        const initialRisk = Math.abs(existing!.initialStopLoss - existing!.entryPrice);
        const currentDistance = Math.abs(trade.stopLoss - existing!.entryPrice);
        if (initialRisk > 0 && currentDistance <= initialRisk * 0.05) {
            updateData.beTriggered = true;
        }
    }

    // On update: recalculate rMultiple using initialStopLoss when available
    if (!isNew && trade.exitPrice != null) {
        const exitPriceVal = trade.exitPrice;
        const entryPriceVal = existing!.entryPrice ?? trade.entryPrice ?? null;
        const initialSL = existing!.initialStopLoss;
        if (entryPriceVal != null && initialSL != null) {
            const risk = Math.abs(entryPriceVal - initialSL);
            if (risk > 0) {
                const rawR = direction === 'LONG'
                    ? (exitPriceVal - entryPriceVal) / risk
                    : (entryPriceVal - exitPriceVal) / risk;
                updateData.rMultiple = Math.round(rawR * 100) / 100;
            }
        }
    }

    // Compute rMultiple for new trades that have both exit and initial SL data
    const createInitialSL = trade.initialStopLoss ?? trade.stopLoss ?? null;
    let createRMultiple: number | null = null;
    if (trade.exitPrice != null && trade.entryPrice != null && createInitialSL != null) {
        const risk = Math.abs(trade.entryPrice - createInitialSL);
        if (risk > 0) {
            const rawR = direction === 'LONG'
                ? (trade.exitPrice - trade.entryPrice) / risk
                : (trade.entryPrice - trade.exitPrice) / risk;
            createRMultiple = Math.round(rawR * 100) / 100;
        }
    }

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
            entryTime,
            exitTime,
            commission: trade.commission,
            swap: trade.swap,
            stopLoss: trade.stopLoss,
            takeProfit: trade.takeProfit,
            initialStopLoss: createInitialSL,
            rMultiple: createRMultiple,
            strategyId,
            mood: trade.mood,
            planCompliance: trade.planCompliance,
            closeReason: trade.closeReason ?? null,
            mae: (trade.max_adverse_excursion != null && trade.max_adverse_excursion > 0) ? trade.max_adverse_excursion : undefined,
            mfe: (trade.max_favorable_excursion != null && trade.max_favorable_excursion > 0) ? trade.max_favorable_excursion : undefined,
        },
        update: updateData,
    });

    // Auto-apply MT5 platform tag for synced trades
    if (isNew) {
        applyPlatformTag(userId, upsertedTrade.id, 'MT5').catch(() => {});
    }

    // Skip notifications during history replay to avoid flooding Telegram
    if (!isHistorySync) {
        sendTradeAlert(userId, trade, isNew, isClosed).catch(() => {});

        if (isNew || isClosed) {
            const notifTitle = isNew
                ? `🔔 Trade Opened: ${trade.symbol}`
                : `📊 Trade Closed: ${trade.symbol}`;
            const notifMessage = isNew
                ? `${trade.type} ${trade.volume} lots @ ${trade.entryPrice}`
                : `${trade.type} ${trade.volume} lots — P&L: ${trade.pnl != null ? `$${trade.pnl.toFixed(2)}` : 'N/A'}`;
            createNotification({
                userId,
                type: isNew ? 'TRADE_OPEN' : 'TRADE_CLOSE',
                title: notifTitle,
                message: notifMessage,
            }).catch(() => {});
        }
    }

    // Fire auto screenshots asynchronously — must not block sync or affect notifications
    if (!isHistorySync && (isNew || isClosed)) {
        logger.info({ ticket: trade.ticket, event: isNew ? 'OPEN' : 'CLOSE' }, '[trade-sync] firing captureAutoScreenshots');
        captureAutoScreenshots(
            upsertedTrade.id,
            accountId,
            userId,
            isNew ? 'OPEN' : 'CLOSE',
            {
                symbol: trade.symbol,
                // Use upsertedTrade values — at close, the EA payload may omit SL/TP/exitPrice
                // but the DB record always has the complete picture after the upsert.
                entryPrice: upsertedTrade.entryPrice,
                exitPrice: upsertedTrade.exitPrice,
                stopLoss: upsertedTrade.stopLoss,
                takeProfit: upsertedTrade.takeProfit,
                entryTime: parseBrokerTime(trade.entryTime).toISOString(),
                exitTime: trade.exitTime ? parseBrokerTime(trade.exitTime).toISOString() : undefined,
            },
        ).catch((err) => {
            logger.error({ err, tradeId: upsertedTrade.id }, '[trade-sync] captureAutoScreenshots rejected unexpectedly');
        });
    }
}

