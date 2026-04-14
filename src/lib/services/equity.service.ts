import prisma from '@/lib/prisma';
import { sendTelegramMessage } from '@/lib/telegram';
import { sendMddAlertEmail } from '@/lib/email';
import { checkMddAlert } from '@/lib/notifications';
import { formatPercent } from '@/lib/formatNumber';
import type { SyncEquitySnapshot } from '@/lib/validations';
import logger from '@/lib/logger';

/**
 * Send drawdown alerts via Telegram and/or email if the threshold is breached.
 */
async function sendDrawdownAlert(userId: string, balance: number, equity: number) {
    const config = await prisma.alertConfig.findUnique({ where: { userId } });
    if (!config?.mddThreshold || balance <= 0) return;

    const drawdownPct = ((balance - equity) / balance) * 100;
    if (drawdownPct < config.mddThreshold) return;

    if (config.telegramId && config.enableRisk) {
        await sendTelegramMessage(
            config.telegramId,
            `⚠️ <b>Drawdown Alert</b>\nEquity drawdown at <b>${formatPercent(drawdownPct, 1)}</b> — threshold ${config.mddThreshold}%\nBalance: $${balance.toFixed(2)} | Equity: $${equity.toFixed(2)}`
        );
    }

    if (config.email && config.enableMddAlerts) {
        await sendMddAlertEmail(config.email, drawdownPct, config.mddThreshold);
    }
}

/**
 * Persist an equity snapshot and fire drawdown/MDD alerts asynchronously.
 */
export async function saveEquitySnapshot(
    accountId: string,
    userId: string,
    snapshot: SyncEquitySnapshot,
): Promise<void> {
    await Promise.all([
        prisma.equitySnapshot.create({
            data: {
                accountId,
                balance: snapshot.balance,
                equity: snapshot.equity,
                timestamp: new Date(snapshot.timestamp),
            },
        }),
        // Keep live balance/equity on the account record for display in accounts page etc.
        prisma.tradingAccount.update({
            where: { id: accountId },
            data: {
                currentBalance: snapshot.balance,
                currentEquity: snapshot.equity,
            },
        }),
    ]);

    // Fire alerts asynchronously — errors must not fail the sync
    sendDrawdownAlert(userId, snapshot.balance, snapshot.equity).catch((err) => { logger.error({ err }, 'Failed to create snapshot') });

    const peakResult = await prisma.equitySnapshot.aggregate({
        _max: { equity: true },
        where: { accountId },
    });
    const peakEquity = peakResult._max.equity ?? 0;
    checkMddAlert(userId, accountId, snapshot.equity, peakEquity).catch((err) => { logger.error({ err }, 'Failed to create snapshot') });
}
