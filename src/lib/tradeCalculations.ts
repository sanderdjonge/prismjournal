/**
 * Shared trade calculation utilities.
 * Single source of truth for contract sizes, P&L, and R:R calculations.
 */

export const CONTRACT_SIZES: Record<string, number> = {
    // Forex
    EURUSD: 100000, GBPUSD: 100000, USDJPY: 100000, AUDUSD: 100000,
    NZDUSD: 100000, USDCAD: 100000, USDCHF: 100000, EURGBP: 100000,
    // Metals
    XAUUSD: 100, XAGUSD: 5000,
    // Indices (per point)
    NAS100: 1, US30: 1, SPX500: 1, UK100: 1, GER40: 1, JPN225: 1,
    // Oil
    USOIL: 1000, UKOIL: 1000,
};

export function getContractSize(symbol: string): number {
    const upper = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return CONTRACT_SIZES[upper] ?? 1;
}

export function calcPnl(
    side: 'LONG' | 'SHORT',
    entry: number,
    exit: number,
    volume: number,
    contractSize: number
): number {
    const direction = side === 'LONG' ? 1 : -1;
    return direction * (exit - entry) * volume * contractSize;
}

export function calcRR(trade: {
    entry: number;
    exit: number;
    stopLoss?: number | null;
    takeProfit?: number | null;
    pnl: number;
    exitTime?: string | null;
}): number | null {
    if (!trade.stopLoss || !trade.entry || trade.entry === 0) return null;
    const risk = Math.abs(trade.entry - trade.stopLoss);
    if (risk === 0) return null;
    if (!trade.exitTime) {
        if (!trade.takeProfit) return null;
        return Math.abs(trade.takeProfit - trade.entry) / risk;
    }
    return trade.pnl >= 0
        ? Math.abs(trade.exit - trade.entry) / risk
        : -(Math.abs(trade.exit - trade.entry) / risk);
}

/** Returns 0 (for sorting) when RR cannot be calculated */
export function calcRROrZero(trade: {
    entry: number;
    exit: number;
    stopLoss?: number | null;
    takeProfit?: number | null;
    pnl: number;
    exitTime?: string | null;
}): number {
    return calcRR(trade) ?? 0;
}
