import prisma from '@/lib/prisma';
import logger from '@/lib/logger';
import { formatPercent } from '@/lib/formatNumber';

type ChallengeRule = {
    type: 'MAX_DAILY_LOSS' | 'MAX_TRADES_PER_DAY' | 'MIN_RR' | 'TIME_WINDOW' | 'MAX_DRAWDOWN' | 'WIN_RATE_TARGET';
    value: number | string;
    operator?: 'LT' | 'LTE' | 'GT' | 'GTE' | 'EQ';
};

/**
 * Backfill challenge evaluations for existing trades.
 * Called when a new challenge is created to evaluate historical data.
 */
export async function backfillChallengeEvaluations(challengeId: string): Promise<{
    success: boolean;
    daysEvaluated: number;
    error?: string;
}> {
    try {
        const challenge = await prisma.tradingChallenge.findUnique({
            where: { id: challengeId },
            include: { account: true },
        });

        if (!challenge) {
            return { success: false, daysEvaluated: 0, error: 'Challenge not found' };
        }

        const rules = challenge.rules as ChallengeRule[];
        const startDate = new Date(challenge.startDate);
        const endDate = challenge.endDate ? new Date(challenge.endDate) : new Date();

        // Get all closed trades within the challenge period
        const whereClause: Record<string, unknown> = {
            account: { userId: challenge.userId },
            exitTime: { not: null }, // Only closed trades
        };

        if (challenge.scope === 'PER_ACCOUNT' && challenge.accountId) {
            whereClause.accountId = challenge.accountId;
        }

        const trades = await prisma.trade.findMany({
            where: whereClause,
            select: {
                id: true,
                pnl: true,
                rMultiple: true,
                direction: true,
                exitTime: true,
            },
        });

        // Filter trades within challenge date range
        const relevantTrades = trades.filter(t => {
            if (!t.exitTime) return false;
            const exitDate = new Date(t.exitTime);
            return exitDate >= startDate && exitDate <= endDate;
        });

        // Group trades by day
        const tradesByDay = new Map<string, typeof relevantTrades>();
        for (const trade of relevantTrades) {
            if (!trade.exitTime) continue;
            const dayKey = new Date(trade.exitTime);
            dayKey.setUTCHours(0, 0, 0, 0);
            const key = dayKey.toISOString();

            if (!tradesByDay.has(key)) {
                tradesByDay.set(key, []);
            }
            tradesByDay.get(key)!.push(trade);
        }

        let daysEvaluated = 0;

        // Evaluate each day
        for (const [dateStr, dayTrades] of tradesByDay) {
            const dateKey = new Date(dateStr);
            const failureReasons: string[] = [];
            let passed = true;

            for (const rule of rules) {
                const ruleResult = evaluateRule(rule, dayTrades);
                if (!ruleResult.passed) {
                    passed = false;
                    failureReasons.push(ruleResult.reason || rule.type);
                }
            }

            // Create or update evaluation
            await prisma.challengeEvaluation.upsert({
                where: {
                    challengeId_date: {
                        challengeId: challenge.id,
                        date: dateKey,
                    },
                },
                create: {
                    challengeId: challenge.id,
                    date: dateKey,
                    passed,
                    failureReasons: failureReasons.length > 0 ? failureReasons : undefined,
                    tradeIds: dayTrades.map(t => t.id),
                },
                update: {
                    passed,
                    failureReasons: failureReasons.length > 0 ? failureReasons : undefined,
                    tradeIds: dayTrades.map(t => t.id),
                },
            });

            daysEvaluated++;
        }

        // Update challenge stats
        const totalEvaluations = await prisma.challengeEvaluation.count({
            where: { challengeId: challenge.id },
        });
        const passedEvaluations = await prisma.challengeEvaluation.count({
            where: { challengeId: challenge.id, passed: true },
        });

        await prisma.tradingChallenge.update({
            where: { id: challenge.id },
            data: {
                totalDays: totalEvaluations,
                daysPassed: passedEvaluations,
                daysFailed: totalEvaluations - passedEvaluations,
            },
        });

        logger.info({ challengeId, daysEvaluated }, '[challenge-backfill] backfilled challenge evaluations');

        return { success: true, daysEvaluated };
    } catch (err) {
        logger.error({ err, challengeId }, '[challenge-backfill] failed to backfill challenge');
        return {
            success: false,
            daysEvaluated: 0,
            error: err instanceof Error ? err.message : 'Unknown error',
        };
    }
}

/**
 * Evaluate a single challenge rule against the day's trades.
 */
function evaluateRule(
    rule: ChallengeRule,
    dayTrades: Array<{ id: string; pnl: number | null; rMultiple: number | null; direction: string }>,
): { passed: boolean; reason?: string } {
    switch (rule.type) {
        case 'MAX_DAILY_LOSS': {
            const maxLoss = typeof rule.value === 'number' ? rule.value : parseFloat(rule.value);
            const dailyPnl = dayTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
            if (dailyPnl < -maxLoss) {
                return { passed: false, reason: `Daily loss $${Math.abs(dailyPnl).toFixed(2)} exceeds max $${maxLoss}` };
            }
            return { passed: true };
        }

        case 'MAX_TRADES_PER_DAY': {
            const maxTrades = typeof rule.value === 'number' ? rule.value : parseInt(rule.value as string);
            if (dayTrades.length > maxTrades) {
                return { passed: false, reason: `${dayTrades.length} trades exceeds max ${maxTrades}` };
            }
            return { passed: true };
        }

        case 'MIN_RR': {
            const minRR = typeof rule.value === 'number' ? rule.value : parseFloat(rule.value as string);
            const tradesWithRR = dayTrades.filter(t => t.rMultiple !== null);
            if (tradesWithRR.length > 0) {
                const avgRR = tradesWithRR.reduce((sum, t) => sum + (t.rMultiple ?? 0), 0) / tradesWithRR.length;
                if (avgRR < minRR) {
                    return { passed: false, reason: `Avg R:R ${avgRR.toFixed(2)} below min ${minRR}` };
                }
            }
            return { passed: true };
        }

        case 'TIME_WINDOW': {
            // Time window validation would need entryTime data
            return { passed: true };
        }

        case 'MAX_DRAWDOWN': {
            // This would need account equity tracking
            return { passed: true };
        }

        case 'WIN_RATE_TARGET': {
            const targetWR = typeof rule.value === 'number' ? rule.value : parseFloat(rule.value as string);
            const closedTrades = dayTrades.filter(t => t.pnl !== null);
            if (closedTrades.length > 0) {
                const wins = closedTrades.filter(t => (t.pnl ?? 0) > 0).length;
                const winRate = (wins / closedTrades.length) * 100;
                if (winRate < targetWR) {
                    return { passed: false, reason: `Win rate ${formatPercent(winRate, 1)} below target ${targetWR}%` };
                }
            }
            return { passed: true };
        }

        default:
            return { passed: true };
    }
}