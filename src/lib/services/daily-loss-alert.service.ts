/**
 * Daily Loss Alert Service
 *
 * Checks if daily loss is approaching the limit and sends alerts.
 * Designed to warn traders before they breach their prop firm daily loss limit.
 */

import prisma from '@/lib/prisma';
import logger from '@/lib/logger';
import { createNotification } from '@/lib/notifications';
import { sendTelegramMessage } from '@/lib/telegram';

interface DailyLossStatus {
    currentLoss: number;
    lossLimit: number;
    usagePercent: number;
    shouldAlert: boolean;
    remaining: number;
}

/**
 * Calculate today's P&L for an account
 */
export async function calculateTodayPnl(accountId: string): Promise<number> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const trades = await prisma.trade.findMany({
        where: {
            accountId,
            status: 'CLOSED',
            exitTime: {
                gte: today,
                lt: tomorrow,
            },
        },
        select: {
            pnl: true,
            commission: true,
            swap: true,
        },
    });

    return trades.reduce((sum, trade) => {
        const pnl = trade.pnl || 0;
        const commission = trade.commission || 0;
        const swap = trade.swap || 0;
        return sum + pnl + commission + swap;
    }, 0);
}

/**
 * Check if account is approaching daily loss limit
 */
export async function checkDailyLossAlert(
    accountId: string,
    userId: string,
): Promise<DailyLossStatus | null> {
    // Get account with daily loss config
    const account = await prisma.tradingAccount.findUnique({
        where: { id: accountId },
        select: {
            id: true,
            name: true,
            currency: true,
            accountSize: true,
            maxDailyLoss: true,
            dailyLossAlertThreshold: true,
            dailyLossAlertSentAt: true,
            propFirmId: true,
            propFirm: {
                select: {
                    dailyLossLimit: true,
                },
            },
        },
    });

    if (!account) {
        return null;
    }

    // Determine the daily loss limit (account override or prop firm default)
    const lossLimitPercent = account.maxDailyLoss ?? account.propFirm?.dailyLossLimit;
    if (!lossLimitPercent) {
        // No daily loss limit configured
        return null;
    }

    // Get the alert threshold (default to 80% if not configured)
    const alertThreshold = account.dailyLossAlertThreshold ?? 80;

    // Calculate account size for dollar limit
    const accountSize = account.accountSize ?? 10000;
    const lossLimitDollars = (accountSize * lossLimitPercent) / 100;

    // Get today's P&L
    const todayPnl = await calculateTodayPnl(accountId);
    const currentLoss = Math.abs(Math.min(todayPnl, 0)); // Only count losses

    // Calculate usage percentage (loss as % of limit)
    const usagePercent = (currentLoss / lossLimitDollars) * 100;
    const remaining = lossLimitDollars - currentLoss;

    // Check if we should alert
    const shouldAlert = usagePercent >= alertThreshold;

    return {
        currentLoss,
        lossLimit: lossLimitDollars,
        usagePercent,
        shouldAlert,
        remaining,
    };
}

/**
 * Send daily loss approach alert if conditions are met
 * Called from trade sync after a closed trade
 */
export async function sendDailyLossAlertIfNeeded(
    accountId: string,
    userId: string,
): Promise<{ sent: boolean; status?: DailyLossStatus }> {
    try {
        const status = await checkDailyLossAlert(accountId, userId);

        if (!status || !status.shouldAlert) {
            return { sent: false, status: status ?? undefined };
        }

        // Check if we already sent an alert today
        const account = await prisma.tradingAccount.findUnique({
            where: { id: accountId },
            select: { dailyLossAlertSentAt: true },
        });

        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

        if (account?.dailyLossAlertSentAt && account.dailyLossAlertSentAt >= today) {
            // Already sent alert today
            logger.debug({ accountId }, '[daily-loss-alert] already sent today, skipping');
            return { sent: false, status };
        }

        // Get alert config for Telegram
        const alertConfig = await prisma.alertConfig.findUnique({
            where: { userId },
        });

        // Send notification
        const message = `⚠️ <b>Daily Loss Alert</b>\n\nYou've used ${status.usagePercent.toFixed(1)}% of your daily loss limit.\n\n<b>Current Loss:</b> $${status.currentLoss.toFixed(2)}\n<b>Limit:</b> $${status.lossLimit.toFixed(2)}\n<b>Remaining:</b> $${status.remaining.toFixed(2)}`;

        // Store notification
        await createNotification({
            userId,
            type: 'RULE_VIOLATION',
            title: '⚠️ Daily Loss Alert',
            message: `You've used ${status.usagePercent.toFixed(1)}% of your daily loss limit. $${status.remaining.toFixed(2)} remaining.`,
            sendTelegram: alertConfig?.enableRisk ?? false,
            telegramId: alertConfig?.telegramId,
        });

        // Update last alert time
        await prisma.tradingAccount.update({
            where: { id: accountId },
            data: { dailyLossAlertSentAt: new Date() },
        });

        logger.info({ accountId, usagePercent: status.usagePercent }, '[daily-loss-alert] alert sent');
        return { sent: true, status };
    } catch (err) {
        logger.error({ err, accountId, userId }, '[daily-loss-alert] failed to check/send alert');
        return { sent: false };
    }
}