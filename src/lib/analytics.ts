/**
 * Prism Analytical Compute Engine
 * Provides server-side logic for statistical and psychological edge audit.
 */

interface TradeData {
    pnl: number;
    rMultiple?: number;
    entryRating?: number;
    exitRating?: number;
    managementRating?: number;
}

/**
 * Calculates the Profit Factor for a set of trades.
 * (Sum of Profits / Sum of Losses)
 */
export function calculateProfitFactor(trades: TradeData[]): number {
    let grossProfits = 0;
    let grossLosses = 0;

    trades.forEach(t => {
        if (t.pnl > 0) grossProfits += t.pnl;
        else if (t.pnl < 0) grossLosses += Math.abs(t.pnl);
    });

    return grossLosses === 0 ? grossProfits : Number((grossProfits / grossLosses).toFixed(2));
}

/**
 * Calculates the Average R-Multiple (Expectancy).
 */
export function calculateExpectancy(trades: TradeData[]): number {
    const validR = trades.filter(t => t.rMultiple !== undefined && t.rMultiple !== null);
    if (validR.length === 0) return 0;

    const sumR = validR.reduce((acc, curr) => acc + (curr.rMultiple || 0), 0);
    return Number((sumR / validR.length).toFixed(2));
}

/**
 * Calculates the Tiltmeter Score (0-100).
 * Based on weighted average of trade ratings (Entry, Exit, Management).
 * Ratings are assumed to be 1-5 scale.
 */
export function calculateTiltmeterScore(trades: TradeData[]): number {
    const ratedTrades = trades.filter(t =>
        t.entryRating !== undefined ||
        t.exitRating !== undefined ||
        t.managementRating !== undefined
    );

    if (ratedTrades.length === 0) return 100; // Assume perfect discipline if no data

    let totalRatingSum = 0;
    let ratingCount = 0;

    ratedTrades.forEach(t => {
        if (t.entryRating) { totalRatingSum += t.entryRating; ratingCount++; }
        if (t.exitRating) { totalRatingSum += t.exitRating; ratingCount++; }
        if (t.managementRating) { totalRatingSum += t.managementRating; ratingCount++; }
    });

    if (ratingCount === 0) return 100;

    const averageRating = totalRatingSum / ratingCount;

    // Normalize 1-5 to 0-100. (5 = 100, 1 = 0)
    const normalizedScore = ((averageRating - 1) / 4) * 100;
    return Number(normalizedScore.toFixed(0));
}

/**
 * Analyzes Edge Stability by calculating the standard deviation of R-Multiples.
 * Low deviation indicates a consistent edge (Edge Stability).
 */
export function calculateEdgeStability(trades: TradeData[]): number {
    const rMultiples = trades
        .filter(t => t.rMultiple !== undefined && t.rMultiple !== null)
        .map(t => t.rMultiple as number);

    if (rMultiples.length < 2) return 100;

    const mean = rMultiples.reduce((a, b) => a + b) / rMultiples.length;
    const variance = rMultiples.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / rMultiples.length;
    const stdDev = Math.sqrt(variance);

    // Inverse score: High std dev means low stability. 
    // This is a naive heuristic for visual representation.
    const stability = Math.max(0, 100 - (stdDev * 50));
    return Number(stability.toFixed(0));
}
