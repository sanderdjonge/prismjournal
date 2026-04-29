/**
 * Prism Analytical Compute Engine
 * Single source of truth for all trading metric calculations.
 *
 * Edge case decisions:
 *   - Profit Factor: grossLoss=0 → Infinity (no losses = perfect ratio)
 *   - Profit Factor: grossLoss=0 & grossProfit=0 → Infinity (no trades = breakeven)
 *   - Win Rate: 0 trades → 0
 *   - Win definition: pnl > 0 (strict — breakeven is NOT a win)
 *   - Max Drawdown: calculateMaxDrawdownPercent returns percentage (0–100);
 *   calculateMaxDrawdownAbsolute returns absolute currency amount
 *   - Dollar Expectancy: 0 trades → 0
 *   - R-Expectancy: denominator = trades WITH rMultiple (nulls excluded)
 *   - Avg R-Multiple: denominator = trades WITH rMultiple (nulls excluded)
 *   - Standard Deviation: population (N), not sample (N-1)
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TradeData {
    pnl: number;
    rMultiple?: number | null;
    entryRating?: number;
    exitRating?: number;
    managementRating?: number;
}

// ── Profit Factor ───────────────────────────────────────────────────────────────

export function calculateProfitFactor(grossProfit: number, grossLoss: number): number {
    const absLoss = Math.abs(grossLoss);
    if (absLoss === 0) return Infinity;
    return Math.max(0, grossProfit / absLoss);
}

export function calculateProfitFactorFromTrades(trades: TradeData[]): number {
    let grossProfit = 0;
    let grossLoss = 0;
    for (const t of trades) {
        if (t.pnl > 0) grossProfit += t.pnl;
        else if (t.pnl < 0) grossLoss += Math.abs(t.pnl);
    }
    return calculateProfitFactor(grossProfit, grossLoss);
}

/**
 * Serializes a profit factor for JSON responses.
 * Infinity → null (JSON-safe). Finite values rounded to 2dp.
 */
export function serializeProfitFactor(pf: number): number | null {
    if (!isFinite(pf)) return null;
    return Math.round(pf * 100) / 100;
}

/**
 * Formats profit factor for display (HTML, Telegram, etc).
 * Infinity → '∞'. Finite values to 2dp.
 */
export function formatProfitFactor(pf: number): string {
    if (!isFinite(pf)) return '∞';
    return pf.toFixed(2);
}

// ── Win Rate ────────────────────────────────────────────────────────────────────

export function calculateWinRate(winCount: number, totalCount: number): number {
    if (totalCount === 0) return 0;
    return winCount / totalCount;
}

export function calculateWinRateFromTrades(trades: TradeData[]): number {
    const wins = trades.filter(t => t.pnl > 0).length;
    return calculateWinRate(wins, trades.length);
}

export function calculateWinRatePercent(winCount: number, totalCount: number): number {
    return calculateWinRate(winCount, totalCount) * 100;
}

// ── Max Drawdown ────────────────────────────────────────────────────────────────

/**
 * Calculate max drawdown percentage from an ordered PnL series.
 * Returns percentage (0–100).
 */
export function calculateMaxDrawdownPercent(pnlValues: number[]): number {
    if (pnlValues.length === 0) return 0;
    let peak = 0;
    let maxDD = 0;
    let runningSum = 0;
    for (const pnl of pnlValues) {
        runningSum += pnl;
        if (runningSum > peak) peak = runningSum;
        const dd = peak > 0 ? ((peak - runningSum) / peak) * 100 : 0;
        if (dd > maxDD) maxDD = dd;
    }
    return maxDD;
}

export function calculateMaxDrawdownAbsolute(pnlValues: number[]): number {
    if (pnlValues.length === 0) return 0;
    let peak = 0;
    let maxDD = 0;
    let runningSum = 0;
    for (const pnl of pnlValues) {
        runningSum += pnl;
        if (runningSum > peak) peak = runningSum;
        const dd = peak - runningSum;
        if (dd > maxDD) maxDD = dd;
    }
    return maxDD;
}

/**
 * Calculate max drawdown percentage from a pre-built equity curve.
 * Each point has a numeric `.value` property.
 */
export function calculateMaxDrawdownFromEquity(
    equityCurve: Array<{ value: number }>,
): number {
    if (equityCurve.length === 0) return 0;
    let peak = equityCurve[0].value;
    let maxDrawdown = 0;
    for (const point of equityCurve) {
        if (point.value > peak) peak = point.value;
        const drawdown = peak > 0 ? ((peak - point.value) / peak) * 100 : 0;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }
    return maxDrawdown;
}

/**
 * Calculate max drawdown percentage starting from account balance baseline.
 * The first peak is set to the starting balance.
 */
export function calculateMaxDrawdownFromBalance(
    pnlValues: number[],
    startingBalance: number,
): number {
    if (pnlValues.length === 0) return 0;
    let peak = startingBalance;
    let running = startingBalance;
    let maxDrawdown = 0;
    for (const pnl of pnlValues) {
        running += pnl;
        if (running > peak) peak = running;
        const dd = peak > 0 ? ((peak - running) / peak) * 100 : 0;
        if (dd > maxDrawdown) maxDrawdown = dd;
    }
    return maxDrawdown;
}

// ── Expectancy ──────────────────────────────────────────────────────────────────

export function calculateDollarExpectancy(trades: TradeData[]): number {
    if (trades.length === 0) return 0;
    const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
    return totalPnl / trades.length;
}

export function calculateDollarExpectancyFromValues(totalPnl: number, tradeCount: number): number {
    if (tradeCount === 0) return 0;
    return totalPnl / tradeCount;
}

export function calculateRExpectancy(trades: TradeData[]): number {
    const validR = trades.filter(t => t.rMultiple != null);
    if (validR.length === 0) return 0;
    const sumR = validR.reduce((acc, curr) => acc + (curr.rMultiple ?? 0), 0);
    return sumR / validR.length;
}

// ── Average R-Multiple ──────────────────────────────────────────────────────────

export function calculateAvgRMultiple(trades: TradeData[]): number {
    const tradesWithR = trades.filter(t => t.rMultiple != null);
    if (tradesWithR.length === 0) return 0;
    return tradesWithR.reduce((sum, t) => sum + (t.rMultiple ?? 0), 0) / tradesWithR.length;
}

// ── Standard Deviation (Population) ────────────────────────────────────────────

export function calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
}

// ── Tiltmeter Score ─────────────────────────────────────────────────────────────

export function calculateTiltmeterScore(trades: TradeData[]): number {
    const ratedTrades = trades.filter(t =>
        t.entryRating !== undefined ||
        t.exitRating !== undefined ||
        t.managementRating !== undefined
    );

    if (ratedTrades.length === 0) return 100;

    let totalRatingSum = 0;
    let ratingCount = 0;

    ratedTrades.forEach(t => {
        if (t.entryRating) { totalRatingSum += t.entryRating; ratingCount++; }
        if (t.exitRating) { totalRatingSum += t.exitRating; ratingCount++; }
        if (t.managementRating) { totalRatingSum += t.managementRating; ratingCount++; }
    });

    if (ratingCount === 0) return 100;

    const averageRating = totalRatingSum / ratingCount;
    const normalizedScore = ((averageRating - 1) / 4) * 100;
    return Number(normalizedScore.toFixed(0));
}

// ── Edge Stability ─────────────────────────────────────────────────────────────

export function calculateEdgeStability(trades: TradeData[]): number {
    const rMultiples = trades
        .filter(t => t.rMultiple !== undefined && t.rMultiple !== null)
        .map(t => t.rMultiple as number);

    if (rMultiples.length < 2) return 100;

    const mean = rMultiples.reduce((a, b) => a + b) / rMultiples.length;
    const variance = rMultiples.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / rMultiples.length;
    const stdDev = Math.sqrt(variance);

    const stability = Math.max(0, 100 - (stdDev * 50));
    return Number(stability.toFixed(0));
}
