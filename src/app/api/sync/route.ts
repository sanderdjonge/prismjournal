import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendTelegramMessage } from '@/lib/telegram';
import { sendMddAlertEmail } from '@/lib/email';
import { notifyTrade, checkMddAlert } from '@/lib/notifications';
import { validateBody, syncPayloadSchema, type SyncTrade, planComplianceEnum } from '@/lib/validations';

export async function POST(request: Request) {
    const bridgeKey = request.headers.get('X-Bridge-Key');
    if (!bridgeKey) {
        return NextResponse.json({ error: 'Missing X-Bridge-Key' }, { status: 400 });
    }

    const account = await prisma.tradingAccount.findUnique({
        where: { bridgeKey },
        select: { id: true, userId: true },
    });

    if (!account) {
        return NextResponse.json({ error: 'Invalid bridge key' }, { status: 401 });
    }

    // Validate the payload using Zod schema
    const validation = await validateBody(request, syncPayloadSchema);
    if (!validation.success) {
        return validation.response;
    }

    const payload = validation.data;

    try {
        if (payload.type === 'TRADE_UPDATE') {
            // Cast trade to SyncTrade to ensure type is 'BUY' | 'SELL' (transformed by Zod)
            const trade = payload.trade as SyncTrade;

            // --- Strategy DNA Mapping ---
            let strategyId = null;
            if (trade.strategy) {
                let strat = await prisma.strategy.findFirst({
                    where: { name: trade.strategy, userId: account.userId },
                });
                if (!strat) {
                    strat = await prisma.strategy.create({
                        data: { name: trade.strategy, userId: account.userId },
                    });
                }
                strategyId = strat.id;
            }

            // Build update object — only include fields that are provided
            // so entry deals don't overwrite exit data with nulls
            const updateData: Record<string, unknown> = {};
            if (trade.exitPrice != null) updateData.exitPrice = trade.exitPrice;
            if (trade.pnl != null) updateData.pnl = trade.pnl;
            if (trade.exitTime) updateData.exitTime = new Date(trade.exitTime);
            if (trade.commission != null) updateData.commission = trade.commission;
            if (trade.swap != null) updateData.swap = trade.swap;
            if (trade.stopLoss != null) updateData.stopLoss = trade.stopLoss;
            if (trade.takeProfit != null) updateData.takeProfit = trade.takeProfit;
            if (strategyId) updateData.strategyId = strategyId;
            if (trade.mood) updateData.mood = trade.mood;
            if (trade.planCompliance) updateData.planCompliance = trade.planCompliance;

            const existing = await prisma.trade.findUnique({ where: { ticket: trade.ticket }, select: { id: true } });
            const isNew = !existing;
            const isClosed = !!trade.exitTime && !!trade.exitPrice;

            // Map BUY/SELL to LONG/SHORT for TradeDirection enum
            const direction = trade.type === 'BUY' ? 'LONG' : 'SHORT';

            await prisma.trade.upsert({
                where: { ticket: trade.ticket },
                create: {
                    accountId: account.id,
                    ticket: trade.ticket,
                    symbol: trade.symbol,
                    direction: direction,
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
                    strategyId: strategyId,
                    mood: trade.mood,
                    planCompliance: trade.planCompliance
                },
                update: updateData,
            });

            // --- Telegram alerts ---
            sendTradeAlert(account.userId, trade, isNew, isClosed).catch(() => {});
            
            // --- Create notification for trade ---
            if (isNew || isClosed) {
                notifyTrade(account.userId, {
                    symbol: trade.symbol,
                    type: trade.type,
                    volume: trade.volume,
                    pnl: trade.pnl,
                }, isNew ? 'OPEN' : 'CLOSE').catch(() => {});
            }
        } else if (payload.type === 'EQUITY_SNAPSHOT') {
            const { snapshot } = payload;
            await prisma.equitySnapshot.create({
                data: {
                    accountId: account.id,
                    balance: snapshot.balance,
                    equity: snapshot.equity,
                    timestamp: new Date(snapshot.timestamp),
                },
            });

            // --- Drawdown alert with email support ---
            sendDrawdownAlert(account.userId, snapshot.balance, snapshot.equity).catch(() => {});
            
            // --- Check MDD and create notification if threshold breached ---
            // Get peak equity from recent snapshots
            const recentSnapshots = await prisma.equitySnapshot.findMany({
                where: { accountId: account.id },
                orderBy: { timestamp: 'desc' },
                take: 100,
                select: { equity: true },
            });
            const peakEquity = Math.max(...recentSnapshots.map(s => s.equity));
            checkMddAlert(account.userId, account.id, snapshot.equity, peakEquity).catch(() => {});
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Sync Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

async function sendTradeAlert(
    userId: string,
    trade: SyncTrade,
    isNew: boolean,
    isClosed: boolean,
) {
    const config = await prisma.alertConfig.findUnique({ where: { userId } });
    if (!config?.telegramId || !config.enableTrades) return;

    // Only alert on new entries and closes, not live P&L updates
    if (!isNew && !isClosed) return;

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

async function sendDrawdownAlert(userId: string, balance: number, equity: number) {
    const config = await prisma.alertConfig.findUnique({ where: { userId } });
    if (!config?.mddThreshold) return;

    if (balance <= 0) return;
    const drawdownPct = ((balance - equity) / balance) * 100;
    if (drawdownPct >= config.mddThreshold) {
        // Send Telegram alert
        if (config.telegramId && config.enableRisk) {
            await sendTelegramMessage(
                config.telegramId,
                `⚠️ <b>Drawdown Alert</b>\nEquity drawdown at <b>${drawdownPct.toFixed(1)}%</b> — threshold ${config.mddThreshold}%\nBalance: $${balance.toFixed(2)} | Equity: $${equity.toFixed(2)}`
            );
        }
        
        // Send email alert
        if (config.email && config.enableMddAlerts) {
            await sendMddAlertEmail(config.email, drawdownPct, config.mddThreshold);
        }
    }
}

export const runtime = 'nodejs';
