interface DrawdownParams {
    drawdownType: 'STATIC' | 'TRAILING';
    accountSize: number;
    currentBalance: number;
    highWaterMark: number | null;
}

export function calculateDrawdown({
    drawdownType,
    accountSize,
    currentBalance,
    highWaterMark,
}: DrawdownParams): number {
    if (drawdownType === 'TRAILING') {
        const hwm = highWaterMark ?? accountSize;
        const drawdown = ((hwm - currentBalance) / hwm) * 100;
        return Math.max(0, Math.min(100, drawdown));
    }

    // STATIC (default)
    const drawdown = ((accountSize - currentBalance) / accountSize) * 100;
    return Math.max(0, Math.min(100, drawdown));
}
