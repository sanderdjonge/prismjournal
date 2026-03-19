import prisma from '@/lib/prisma';
import { notifyRuleViolation } from '@/lib/notifications';
import { updateTradingDaysCount, autoAdvancePhaseIfNeeded } from '@/lib/prop-firm/challenge-service';
import { RuleType, ViolationSeverity } from '@prisma/client';

let running = false;

/**
 * Acquire a PostgreSQL advisory lock for distributed snapshot execution.
 * This prevents multiple instances from running the snapshot simultaneously.
 * Returns true if lock was acquired, false otherwise.
 */
async function acquireAdvisoryLock(): Promise<boolean> {
    try {
        // Use a fixed lock ID (hash of 'prismjournal-daily-snapshot')
        const lockId = 0x505249534d534e41; // 'PRISMSNA' in hex
        const result = await prisma.$queryRaw<[{ acquired: boolean }]>`
            SELECT pg_try_advisory_lock(${lockId}::bigint) as acquired
        `;
        return result[0]?.acquired === true;
    } catch {
        return false;
    }
}

async function releaseAdvisoryLock(): Promise<void> {
    try {
        const lockId = 0x505249534d534e41;
        await prisma.$executeRaw`SELECT pg_advisory_unlock(${lockId}::bigint)`;
    } catch {
        // Ignore unlock errors
    }
}

export async function runDailySnapshot(): Promise<void> {
    if (running) return; // prevent overlap within same process
    running = true;

    // Try to acquire distributed lock for multi-instance deployments
    const lockAcquired = await acquireAdvisoryLock();
    if (!lockAcquired) {
        console.log('[snapshot] Another instance is already running, skipping');
        running = false;
        return;
    }

    try {
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);

        await updateTradingDaysCount();

        const accounts = await prisma.tradingAccount.findMany({
            where: { isActive: true, propFirmId: { not: null } },
            include: {
                propFirm: {
                    select: { dailyLossLimit: true, maxDrawdown: true, drawdownType: true, phasesConfig: true },
                },
            },
        });

        for (const account of accounts) {
            try {
                if (!account.propFirm) continue;

                const dayStart = new Date(yesterday);
                dayStart.setHours(0, 0, 0, 0);
                const dayEnd = new Date(yesterday);
                dayEnd.setHours(23, 59, 59, 999);

                const trades = await prisma.trade.findMany({
                    where: { accountId: account.id, status: 'CLOSED', exitTime: { gte: dayStart, lte: dayEnd } },
                });

                const dailyPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
                const accountSize = account.accountSize || 10000;
                const startingBalance = account.balance || accountSize;
                const currentBalance = account.currentBalance || startingBalance;
                const currentEquity = account.currentEquity || currentBalance;

                const dailyPnlPercent = (dailyPnl / startingBalance) * 100;
                const highWaterMark = Math.max(startingBalance, currentBalance);
                const currentDrawdown = Math.max(0, ((highWaterMark - currentEquity) / startingBalance) * 100);

                const dailyLossLimit = account.propFirm.dailyLossLimit;
                const dailyLossUsed = dailyPnl < 0 ? (Math.abs(dailyPnl) / startingBalance) * 100 : 0;
                const dailyLossPercentOfLimit = (dailyLossUsed / dailyLossLimit) * 100;

                const isDailyLimitBreached = dailyLossUsed >= dailyLossLimit;
                const isMaxDrawdownBreached = currentDrawdown >= account.propFirm.maxDrawdown;
                const profitProgress = ((currentBalance - startingBalance) / startingBalance) * 100;

                const existingSnapshot = await prisma.dailyAccountSnapshot.findUnique({
                    where: { accountId_snapshotDate: { accountId: account.id, snapshotDate: yesterday } },
                });

                if (!existingSnapshot) {
                    await prisma.dailyAccountSnapshot.create({
                        data: {
                            accountId: account.id,
                            snapshotDate: yesterday,
                            startingBalance,
                            endingBalance: currentBalance,
                            endingEquity: currentEquity,
                            dailyPnl,
                            dailyPnlPercent,
                            currentDrawdown,
                            maxDrawdown: currentDrawdown,
                            highWaterMark,
                            dailyLossUsed: dailyLossPercentOfLimit,
                            isDailyLimitBreached,
                            isMaxDrawdownBreached,
                            profitProgress,
                        },
                    });

                    const notifyViolation = async (ruleType: RuleType, severity: ViolationSeverity, limitValue: number, actualValue: number, description: string) => {
                        const v = await prisma.ruleViolation.create({
                            data: { accountId: account.id, ruleType, severity, limitValue, actualValue, description },
                        });
                        await notifyRuleViolation(account.userId, { accountName: account.name, ruleType, severity, description, accountId: account.id, violationId: v.id });
                    };

                    if (isDailyLimitBreached)
                        await notifyViolation(RuleType.DAILY_LOSS_LIMIT, ViolationSeverity.BREACH, dailyLossLimit, dailyLossUsed, `Daily loss limit breached: ${dailyLossUsed.toFixed(2)}% of ${dailyLossLimit}%`);
                    else if (dailyLossPercentOfLimit >= 80)
                        await notifyViolation(RuleType.DAILY_LOSS_LIMIT, ViolationSeverity.WARNING, dailyLossLimit, dailyLossUsed, `Approaching daily loss limit: ${dailyLossUsed.toFixed(2)}% of ${dailyLossLimit}%`);

                    if (isMaxDrawdownBreached)
                        await notifyViolation(RuleType.MAX_DRAWDOWN, ViolationSeverity.BREACH, account.propFirm.maxDrawdown, currentDrawdown, `Max drawdown breached: ${currentDrawdown.toFixed(2)}% of ${account.propFirm.maxDrawdown}%`);
                    else if (currentDrawdown >= account.propFirm.maxDrawdown * 0.8)
                        await notifyViolation(RuleType.MAX_DRAWDOWN, ViolationSeverity.WARNING, account.propFirm.maxDrawdown, currentDrawdown, `Approaching max drawdown: ${currentDrawdown.toFixed(2)}% of ${account.propFirm.maxDrawdown}%`);

                    await autoAdvancePhaseIfNeeded(account.id);
                }
            } catch (err) {
                console.error(`[snapshot] Account ${account.id}:`, err);
            }
        }

        // EquitySnapshot retention: delete rows older than 90 days
        const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        await prisma.equitySnapshot.deleteMany({
            where: {
                timestamp: { lt: cutoff },
            },
        });

        console.log(`[snapshot] Done — ${new Date().toISOString()}`);
    } catch (err) {
        console.error('[snapshot] Fatal error:', err);
    } finally {
        running = false;
        await releaseAdvisoryLock();
    }
}
