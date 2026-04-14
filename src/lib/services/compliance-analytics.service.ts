/**
 * Compliance Analytics Service
 *
 * Analyzes the correlation between checklist completion and trade outcomes.
 * Answers: "Does completing my checklist improve my results?"
 */

import prisma from '@/lib/prisma';
export type { ComplianceMetrics, ComplianceMetricsGroup } from '@/types/analytics'
import type { ComplianceMetrics } from '@/types/analytics'

interface TradeWithCompletion {
    id: string;
    pnl: number | null;
    rMultiple: number | null;
    exitTime: Date | null;
    checklistCompletion: {
        completionPct: number;
    } | null;
}

/**
 * Calculate compliance metrics for a user
 */
export async function getComplianceMetrics(
    userId: string,
    options?: {
        accountId?: string;
        strategyId?: string;
        startDate?: Date;
        endDate?: Date;
    }
): Promise<ComplianceMetrics> {
    // Build where clause for trades
    const whereClause: Record<string, unknown> = {
        account: { userId },
        status: 'CLOSED',
        exitTime: { not: null },
    };

    if (options?.accountId) {
        whereClause.accountId = options.accountId;
    }

    if (options?.strategyId) {
        whereClause.strategyId = options.strategyId;
    }

    if (options?.startDate || options?.endDate) {
        const exitTimeFilter: Record<string, Date> = {};
        if (options?.startDate) exitTimeFilter.gte = options.startDate;
        if (options?.endDate) exitTimeFilter.lte = options.endDate;
        whereClause.exitTime = { ...exitTimeFilter, not: null };
    }

    // Fetch trades with their checklist completions
    const trades = await prisma.trade.findMany({
        where: whereClause,
        select: {
            id: true,
            pnl: true,
            rMultiple: true,
            exitTime: true,
            checklistCompletion: {
                select: {
                    completionPct: true,
                },
            },
        },
    });

    return calculateComplianceMetrics(trades);
}

/**
 * Calculate compliance metrics from trade data
 */
function calculateComplianceMetrics(trades: TradeWithCompletion[]): ComplianceMetrics {
    // Categorize trades by completion level
    const fullCompletion: TradeWithCompletion[] = [];
    const partialCompletion: TradeWithCompletion[] = [];
    const noCompletion: TradeWithCompletion[] = [];

    let totalCompletionPct = 0;

    for (const trade of trades) {
        const completionPct = trade.checklistCompletion?.completionPct ?? 0;
        totalCompletionPct += completionPct;

        if (completionPct === 100) {
            fullCompletion.push(trade);
        } else if (completionPct > 0) {
            partialCompletion.push(trade);
        } else {
            noCompletion.push(trade);
        }
    }

    const totalTrades = trades.length;
    const avgCompletionPct = totalTrades > 0 ? totalCompletionPct / totalTrades : 0;
    const completionRate = totalTrades > 0 ? (fullCompletion.length / totalTrades) * 100 : 0;

    return {
        fullCompletion: calculateGroupMetrics(fullCompletion),
        partialCompletion: calculateGroupMetrics(partialCompletion),
        noCompletion: calculateGroupMetrics(noCompletion),
        overall: {
            totalTrades,
            avgCompletionPct,
            completionRate,
        },
    };
}

/**
 * Calculate metrics for a group of trades
 */
function calculateGroupMetrics(trades: TradeWithCompletion[]) {
    if (trades.length === 0) {
        return {
            tradeCount: 0,
            winRate: 0,
            avgRR: 0,
            totalPnl: 0,
            avgPnl: 0,
        };
    }

    const pnls = trades.map(t => t.pnl ?? 0);
    const rMultiples = trades.map(t => t.rMultiple ?? 0).filter(r => r !== 0);
    const wins = pnls.filter(p => p > 0);
    const totalPnl = pnls.reduce((sum, p) => sum + p, 0);
    const totalRR = rMultiples.reduce((sum, r) => sum + r, 0);

    return {
        tradeCount: trades.length,
        winRate: (wins.length / trades.length) * 100,
        avgRR: rMultiples.length > 0 ? totalRR / rMultiples.length : 0,
        totalPnl,
        avgPnl: totalPnl / trades.length,
    };
}

/**
 * Get compliance metrics by strategy
 */
export async function getComplianceByStrategy(
    userId: string,
    strategyId: string
): Promise<ComplianceMetrics> {
    return getComplianceMetrics(userId, { strategyId });
}

/**
 * Get compliance trend over time (monthly breakdown)
 */
export async function getComplianceTrend(
    userId: string,
    months: number = 6
): Promise<Array<{ month: string; metrics: ComplianceMetrics }>> {
    const result: Array<{ month: string; metrics: ComplianceMetrics }> = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
        const endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0); // Last day of month
        const startDate = new Date(now.getFullYear(), now.getMonth() - i, 1); // First day of month
        
        const monthStr = startDate.toLocaleString('default', { month: 'short', year: 'numeric' });
        const metrics = await getComplianceMetrics(userId, { startDate, endDate });
        
        result.push({ month: monthStr, metrics });
    }

    return result;
}