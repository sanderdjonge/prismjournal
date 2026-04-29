/**
 * Prism Score — composite 0–100 trading performance score.
 *
 * Components and weights:
 *   Profit Factor      25% — min(PF / 2.5, 1) × 100
 *   Win/Loss Ratio     20% — min(avgWin / avgLoss / 2.5, 1) × 100
 *   Max Drawdown       20% — max(0, 100 − maxDrawdownPct)
 *   Win Rate           15% — min(winRate% / 60, 1) × 100
 *   Recovery Factor    10% — min(totalPnl / maxDrawdown / 3.5, 1) × 100
 *   Consistency        10% — max(0, 100 − stdDevDailyPnl / |totalPnl| × 100)
 *
 * Pure function — no DB access. Caller is responsible for filtering trades.
 */

import { formatDateKey } from '@/lib/formatTime'

export interface TradeForScore {
    pnl: number | null;
    exitTime: Date | null;
    entryTime?: Date;
}

export interface PrismScoreComponents {
    profitFactor: number;
    winLossRatio: number;
    maxDrawdown: number;
    winRate: number;
    recoveryFactor: number;
    consistency: number;
}

export interface PrismScoreResult {
    score: number;
    components: PrismScoreComponents;
}

function stdDev(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    return Math.sqrt(variance);
}

function clamp(v: number): number {
    return Math.min(100, Math.max(0, v));
}

export function computePrismScore(trades: TradeForScore[]): PrismScoreResult {
    // Only closed trades with a real P&L contribute
    const closed = trades.filter(t => t.exitTime !== null && t.pnl !== null) as (TradeForScore & { pnl: number; exitTime: Date })[];

    if (closed.length === 0) {
        return {
            score: 0,
            components: { profitFactor: 0, winLossRatio: 0, maxDrawdown: 0, winRate: 0, recoveryFactor: 0, consistency: 0 },
        };
    }

    const wins   = closed.filter(t => t.pnl > 0);
    const losses = closed.filter(t => t.pnl < 0);

    // --- Profit Factor ---
    const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
    const grossLoss   = losses.reduce((s, t) => s + Math.abs(t.pnl), 0);
    const pf          = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 10 : 1);
    const pfScore     = clamp((pf / 2.5) * 100);

    // --- Win/Loss Ratio ---
    const avgWin  = wins.length   > 0 ? grossProfit / wins.length   : 0;
    const avgLoss = losses.length > 0 ? grossLoss   / losses.length : 0;
    const wlRatio = avgLoss > 0 ? avgWin / avgLoss : (avgWin > 0 ? 10 : 1);
    const wlScore = clamp((wlRatio / 2.5) * 100);

    // --- Win Rate ---
    const winRatePct = (wins.length / closed.length) * 100;
    const wrScore    = clamp((winRatePct / 60) * 100);

    // --- Max Drawdown (on cumulative P&L curve) ---
    const sorted = [...closed].sort((a, b) => a.exitTime.getTime() - b.exitTime.getTime());
    let peak = 0;
    let running = 0;
    let maxDD = 0;
    for (const t of sorted) {
        running += t.pnl;
        if (running > peak) peak = running;
        const dd = peak - running;
        if (dd > maxDD) maxDD = dd;
    }
    // Express drawdown as % of peak; if there is no positive peak, use the absolute DD value scaled to 100%.
    // Cap at 100% — when equity starts near zero, the ratio divides by a tiny peak and produces
    // astronomical percentages (e.g. peak=0.50 → 2697%). Capping mirrors the same fix applied
    // to calculateMaxDrawdownPercent() in analytics.ts.
    const maxDDPct = peak > 0 ? Math.min((maxDD / peak) * 100, 100) : (maxDD > 0 ? 100 : 0);
    const ddScore  = clamp(100 - maxDDPct);

    // --- Recovery Factor ---
    const totalPnl = sorted.reduce((s, t) => s + t.pnl, 0);
    const recFactor = maxDD > 0 ? Math.abs(totalPnl) / maxDD : (totalPnl > 0 ? 10 : 1);
    const recScore  = clamp((recFactor / 3.5) * 100);

    // --- Consistency (stdDev of daily P&L relative to |totalPnl|) ---
    const byDay = new Map<string, number>();
    for (const t of sorted) {
        const key = formatDateKey(t.exitTime);
        byDay.set(key, (byDay.get(key) ?? 0) + t.pnl);
    }
    const dailyPnls  = Array.from(byDay.values());
    const sd         = stdDev(dailyPnls);
    const absNet     = Math.abs(totalPnl);
    // When net P&L is negligible, consistency is hard to define — default to 50
    const consScore  = absNet > 0.01
        ? clamp(100 - (sd / absNet) * 100)
        : 50;

    const components: PrismScoreComponents = {
        profitFactor:  Math.round(pfScore),
        winLossRatio:  Math.round(wlScore),
        maxDrawdown:   Math.round(ddScore),
        winRate:       Math.round(wrScore),
        recoveryFactor: Math.round(recScore),
        consistency:   Math.round(consScore),
    };

    const score = Math.round(
        pfScore  * 0.25 +
        wlScore  * 0.20 +
        ddScore  * 0.20 +
        wrScore  * 0.15 +
        recScore * 0.10 +
        consScore * 0.10
    );

    return { score: clamp(score), components };
}

/**
 * Compute weekly Prism Scores for the last `weeks` weeks (rolling 4-week window).
 * Returns an array of { week: "YYYY-WW", score } sorted oldest → newest.
 */
export function computeWeeklyHistory(
    trades: TradeForScore[],
    weeks = 12,
): { week: string; score: number }[] {
    const closed = trades.filter(t => t.exitTime !== null && t.pnl !== null);
    if (closed.length === 0) return [];

    const now = new Date();
    const result: { week: string; score: number }[] = [];

    for (let i = weeks - 1; i >= 0; i--) {
        // Window: 4 weeks ending at the Monday of (currentWeek − i)
        const endOfWeek = new Date(now);
        endOfWeek.setDate(now.getDate() - i * 7);
        // Snap to Sunday 23:59:59 of that week
        endOfWeek.setHours(23, 59, 59, 999);

        const startOfWindow = new Date(endOfWeek);
        startOfWindow.setDate(endOfWeek.getDate() - 28); // 4 weeks back

        const windowTrades = closed.filter(t => {
            const et = t.exitTime!.getTime();
            return et >= startOfWindow.getTime() && et <= endOfWeek.getTime();
        });

        const { score } = computePrismScore(windowTrades);

        // Label: ISO week of the end date
        const weekLabel = getISOWeekLabel(endOfWeek);
        result.push({ week: weekLabel, score });
    }

    return result;
}

function getISOWeekLabel(date: Date): string {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}
