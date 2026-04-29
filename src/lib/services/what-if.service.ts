import prisma from '@/lib/prisma';
import { calculateProfitFactor } from '@/lib/analytics';
import { formatDateKey } from '@/lib/formatTime';
import {
  WhatIfFilters,
  TradeData,
  normalizeFilters,
} from './what-if/types';
import {
  applyDurationFilter,
  applyMarketSessionFilter,
} from './what-if/filters/time-filters';
import {
  applyDailyLossLimit,
  applyWeeklyLossLimit,
  applyStreakBreak,
  applyBigLossCooldown,
} from './what-if/filters/psychology-filters';
import {
  applyMaeMfeStopOptimization,
  applyPositionSizing,
  applyTrailingStop,
  applyPartialExit,
} from './what-if/filters/risk-filters';
import {
  applyVolatilityFilter,
  applyNewsEventFilter,
  fetchVolatilityFromTwelveData,
  fetchNewsFromEconomicEvents,
} from './what-if/filters/market-filters';
import type { EquityPointDetailed } from '@/types/trade'

export type { EquityPointDetailed as EquityPoint } from '@/types/trade'
export type { WhatIfFilters, TradeData } from './what-if/types'

type EquityPoint = EquityPointDetailed

export interface SimulationResult {
    totalTrades: number;
    totalPnl: number;
    winRate: number;
    profitFactor: number;
    avgRR: number;
    avgWin: number;
    avgLoss: number;
    maxDrawdown: number;
    equityCurve: EquityPoint[];
}

export interface WhatIfResult {
    actual: SimulationResult;
    simulated: SimulationResult;
    difference: {
        tradesRemoved: number;
        pnlDifference: number;
        winRateDifference: number;
        profitFactorDifference: number;
        improvement: boolean;
    };
    filters: WhatIfFilters;
}

function calculateEquityCurve(trades: TradeData[], startingBalance = 10000): EquityPoint[] {
    const sortedTrades = [...trades]
        .filter(t => t.exitTime && t.pnl !== null)
        .sort((a, b) => new Date(a.exitTime!).getTime() - new Date(b.exitTime!).getTime());

    const curve: EquityPoint[] = [];
    let runningPnl = 0;

    for (const trade of sortedTrades) {
        runningPnl += trade.pnl ?? 0;
        curve.push({
            date: formatDateKey(trade.exitTime!),
            value: startingBalance + runningPnl,
            actualValue: startingBalance + runningPnl,
            simulatedValue: startingBalance + runningPnl,
        });
    }

    return curve;
}

function calculateMaxDrawdown(equityCurve: EquityPoint[]): number {
    if (equityCurve.length === 0) return 0;

    let maxDrawdown = 0;
    let peak = equityCurve[0].value;

    for (const point of equityCurve) {
        if (point.value > peak) {
            peak = point.value;
        }
        const drawdown = (peak - point.value) / peak;
        if (drawdown > maxDrawdown) {
            maxDrawdown = drawdown;
        }
    }

    return maxDrawdown * 100;
}

function calculateMetrics(trades: TradeData[]): SimulationResult {
    const closedTrades = trades.filter(t => t.pnl !== null);
    const wins = closedTrades.filter(t => (t.pnl ?? 0) > 0);
    const losses = closedTrades.filter(t => (t.pnl ?? 0) < 0);

    const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
    const grossProfit = wins.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
    const grossLoss = Math.abs(losses.reduce((sum, t) => sum + (t.pnl ?? 0), 0));

    const profitFactor = calculateProfitFactor(grossProfit, grossLoss);

    const tradesWithRR = closedTrades.filter(t => t.rMultiple !== null);
    const avgRR = tradesWithRR.length > 0
        ? tradesWithRR.reduce((sum, t) => sum + (t.rMultiple ?? 0), 0) / tradesWithRR.length
        : 0;

    const equityCurve = calculateEquityCurve(trades);
    const maxDrawdown = calculateMaxDrawdown(equityCurve);

    return {
        totalTrades: closedTrades.length,
        totalPnl,
        winRate: closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0,
        profitFactor,
        avgRR,
        avgWin: wins.length > 0 ? wins.reduce((sum, t) => sum + (t.pnl ?? 0), 0) / wins.length : 0,
        avgLoss: losses.length > 0 ? Math.abs(losses.reduce((sum, t) => sum + (t.pnl ?? 0), 0) / losses.length) : 0,
        maxDrawdown,
        equityCurve,
    };
}

function applySyncFilters(trades: TradeData[], filters: WhatIfFilters): TradeData[] {
    const normalized = normalizeFilters(filters);
    
    let filtered = trades.filter(trade => {
        if (normalized.time?.excludeDays?.length) {
            const dayOfWeek = new Date(trade.entryTime).getDay();
            if (normalized.time.excludeDays.includes(dayOfWeek)) {
                return false;
            }
        }

        if (normalized.time?.excludeHours?.length) {
            const hour = new Date(trade.entryTime).getHours();
            if (normalized.time.excludeHours.includes(hour)) {
                return false;
            }
        }

        if (filters.minRR !== undefined && trade.rMultiple !== null && trade.rMultiple < filters.minRR) {
            return false;
        }
        if (filters.maxRR !== undefined && trade.rMultiple !== null && trade.rMultiple > filters.maxRR) {
            return false;
        }

        if (filters.minProfit !== undefined && trade.pnl !== null && trade.pnl < filters.minProfit) {
            return false;
        }
        if (filters.maxProfit !== undefined && trade.pnl !== null && trade.pnl > filters.maxProfit) {
            return false;
        }

        if (filters.symbols?.length) {
            if (!filters.symbols.includes(trade.symbol)) {
                return false;
            }
        }

        if (filters.direction && trade.direction !== filters.direction) {
            return false;
        }

        return true;
    });

    if (normalized.time?.minDurationHours !== undefined || normalized.time?.maxDurationHours !== undefined) {
        filtered = applyDurationFilter(filtered, {
            minHours: normalized.time.minDurationHours,
            maxHours: normalized.time.maxDurationHours,
        });
    }

    if (normalized.time?.marketSession?.length) {
        filtered = applyMarketSessionFilter(filtered, normalized.time.marketSession);
    }

    if (normalized.psychology?.dailyLossLimit !== undefined) {
        filtered = applyDailyLossLimit(filtered, normalized.psychology.dailyLossLimit);
    }

    if (normalized.psychology?.weeklyLossLimit !== undefined) {
        filtered = applyWeeklyLossLimit(filtered, normalized.psychology.weeklyLossLimit);
    }

    if (normalized.psychology?.stopAfterLosses !== undefined) {
        filtered = applyStreakBreak(filtered, normalized.psychology.stopAfterLosses);
    }

    if (normalized.psychology?.avoidAfterBigLoss !== undefined) {
        filtered = applyBigLossCooldown(filtered, normalized.psychology.avoidAfterBigLoss);
    }

    if (normalized.risk?.maeMultiplier !== undefined || normalized.risk?.mfeMultiplier !== undefined) {
        const maeR = normalized.risk?.maeMultiplier !== undefined ? -normalized.risk.maeMultiplier : undefined;
        const mfeRatio = normalized.risk?.mfeMultiplier !== undefined ? normalized.risk.mfeMultiplier : undefined;
        filtered = applyMaeMfeStopOptimization(filtered, {
            newStopR: maeR ?? -2,
            targetRatio: mfeRatio,
        });
    }

    if (normalized.risk?.riskPerTrade !== undefined) {
        filtered = applyPositionSizing(filtered, {
            originalRiskPercent: 1.0,
            newRiskPercent: normalized.risk.riskPerTrade,
        });
    }

    if (normalized.risk?.trailingPercent !== undefined) {
        filtered = applyTrailingStop(filtered, {
            trailPercent: normalized.risk.trailingPercent,
        });
    }

    if (normalized.risk?.partialExitAt !== undefined) {
        filtered = applyPartialExit(filtered, {
            exitSchedule: [normalized.risk.partialExitAt],
        });
    }

    return filtered;
}

async function applyAsyncMarketFilters(
    trades: TradeData[],
    filters: WhatIfFilters
): Promise<TradeData[]> {
    let filtered = trades
    const hasMarketFilters = filters.market && (
        filters.market.minVolatility !== undefined ||
        filters.market.maxVolatility !== undefined ||
        filters.market.avoidNewsEvents
    )

    if (!hasMarketFilters) return filtered

    const apiKey = process.env.TWELVE_DATA_API_KEY

    if (filters.market!.minVolatility !== undefined || filters.market!.maxVolatility !== undefined) {
        const mode = filters.market!.minVolatility !== undefined ? 'prefer' : 'avoid'
        const threshold = mode === 'prefer'
            ? filters.market!.minVolatility!
            : filters.market!.maxVolatility!

        const volatilityProvider = apiKey
            ? (symbol: string, date: Date) => fetchVolatilityFromTwelveData(symbol, date, apiKey)
            : undefined

        filtered = await applyVolatilityFilter(filtered, {
            mode,
            atrPercentThreshold: threshold,
        }, volatilityProvider)
    }

    if (filters.market!.avoidNewsEvents) {
        filtered = await applyNewsEventFilter(filtered, {
            avoidHighImpact: true,
            avoidMediumImpact: true,
            windowMinutes: filters.market!.newsBufferMinutes ?? 30,
        }, fetchNewsFromEconomicEvents)
    }

    return filtered
}

function simulateStopLossMultiplier(trades: TradeData[], multiplier: number): TradeData[] {
    return trades.map(trade => {
        if (!trade.initialStopLoss || !trade.exitPrice) return trade;

        const newSL = trade.direction === 'LONG'
            ? trade.entryPrice - (trade.entryPrice - trade.initialStopLoss) * multiplier
            : trade.entryPrice + (trade.initialStopLoss - trade.entryPrice) * multiplier;

        return {
            ...trade,
            stopLoss: newSL,
        };
    });
}

export async function runWhatIfSimulation(
    userId: string,
    filters: WhatIfFilters
): Promise<WhatIfResult> {
    const whereClause: Record<string, unknown> = {
        account: { userId },
        exitTime: { not: null },
    };

    if (filters.startDate) {
        whereClause.exitTime = { ...whereClause.exitTime as object, gte: filters.startDate };
    }
    if (filters.endDate) {
        whereClause.exitTime = { ...whereClause.exitTime as object, lte: filters.endDate };
    }
    if (filters.accountIds?.length) {
        whereClause.accountId = { in: filters.accountIds };
    }

    const trades = await prisma.trade.findMany({
        where: whereClause,
        select: {
            id: true,
            symbol: true,
            direction: true,
            entryPrice: true,
            exitPrice: true,
            stopLoss: true,
            takeProfit: true,
            pnl: true,
            rMultiple: true,
            entryTime: true,
            exitTime: true,
            initialStopLoss: true,
            mae: true,
            mfe: true,
            volume: true,
        },
    });

    const tradeData: TradeData[] = trades.map(t => ({
        ...t,
        direction: t.direction as string,
        entryTime: new Date(t.entryTime),
        exitTime: t.exitTime ? new Date(t.exitTime) : null,
        mae: t.mae,
        mfe: t.mfe,
        volume: t.volume ?? undefined,
    }));

    const actualMetrics = calculateMetrics(tradeData);

    let simulatedTrades = tradeData;
    if (filters.stopLossMultiplier && filters.stopLossMultiplier !== 1) {
        simulatedTrades = simulateStopLossMultiplier(tradeData, filters.stopLossMultiplier);
    }

    let filteredTrades = applySyncFilters(simulatedTrades, filters)
    filteredTrades = await applyAsyncMarketFilters(filteredTrades, filters)

    const simulatedMetrics = calculateMetrics(filteredTrades);

    const actualCurve = actualMetrics.equityCurve;
    const simulatedCurve = simulatedMetrics.equityCurve;

    const comparisonCurve: EquityPoint[] = [];
    const simulatedByDate = new Map(simulatedCurve.map(p => [p.date, p.value]));

    for (const actualPoint of actualCurve) {
        comparisonCurve.push({
            date: actualPoint.date,
            value: actualPoint.value,
            actualValue: actualPoint.value,
            simulatedValue: simulatedByDate.get(actualPoint.date) ?? actualPoint.simulatedValue,
        });
    }

    actualMetrics.equityCurve = comparisonCurve;
    simulatedMetrics.equityCurve = comparisonCurve;

    const pnlDiff = simulatedMetrics.totalPnl - actualMetrics.totalPnl;
    const wrDiff = simulatedMetrics.winRate - actualMetrics.winRate;
    const pfDiff = simulatedMetrics.profitFactor - actualMetrics.profitFactor;

    return {
        actual: actualMetrics,
        simulated: simulatedMetrics,
        difference: {
            tradesRemoved: actualMetrics.totalTrades - simulatedMetrics.totalTrades,
            pnlDifference: pnlDiff,
            winRateDifference: wrDiff,
            profitFactorDifference: pfDiff,
            improvement: pnlDiff > 0 || (pnlDiff === 0 && wrDiff > 0),
        },
        filters,
    };
}

export async function runMultipleScenarios(
    userId: string,
    scenarios: WhatIfFilters[]
): Promise<WhatIfResult[]> {
    return Promise.all(scenarios.map(filters => runWhatIfSimulation(userId, filters)));
}
