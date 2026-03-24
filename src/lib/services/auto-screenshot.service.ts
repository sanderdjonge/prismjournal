import prisma from '@/lib/prisma';
import logger from '@/lib/logger';
import { normaliseSymbol, mapTimeframe, isTwelveDataSymbolNotFound } from '@/lib/symbol-normaliser';
import { renderCandlestickChart } from './chart-renderer.service';
import { saveFile, deleteFile, generateFilename } from '@/lib/storage';
import { autoScreenshotConfigSchema } from '@/lib/validations/screenshot-config';

interface TradeSnapshot {
    symbol: string;
    entryPrice: number;
    stopLoss?: number | null;
    takeProfit?: number | null;
    entryTime?: string;   // ISO string — used as chart end_date anchor
    exitTime?: string;    // ISO string — used as chart end_date anchor for CLOSE event
}

/** Maps Twelve Data interval strings to milliseconds. */
function intervalToMs(interval: string): number {
    const m = interval.match(/^(\d+)(min|h|day|week)$/);
    if (!m) return 0;
    const n = parseInt(m[1], 10);
    switch (m[2]) {
        case 'min':  return n * 60_000;
        case 'h':    return n * 3_600_000;
        case 'day':  return n * 86_400_000;
        case 'week': return n * 604_800_000;
        default:     return 0;
    }
}

/**
 * Capture automatic chart screenshots for a trade on all configured timeframes.
 *
 * - Reads the account's autoScreenshotConfig
 * - Silently skips if TWELVE_DATA_API_KEY is not set or config is disabled
 * - Each timeframe screenshot is saved as a Media record (type: "AUTO")
 * - Errors on individual timeframes are logged but do not stop the others
 *
 * This function is fire-and-forget — always call with .catch().
 */
export async function captureAutoScreenshots(
    tradeId: string,
    accountId: string,
    userId: string,
    event: 'OPEN' | 'CLOSE',
    trade: TradeSnapshot,
): Promise<void> {
    if (!process.env.TWELVE_DATA_API_KEY) return;

    const [account, userSettings] = await Promise.all([
        prisma.tradingAccount.findUnique({
            where: { id: accountId },
            select: { autoScreenshotConfig: true },
        }),
        prisma.userSettings.findUnique({
            where: { userId },
            select: { timezone: true },
        }),
    ]);
    const timezone = userSettings?.timezone ?? 'Europe/Amsterdam';

    if (!account?.autoScreenshotConfig) return;

    const parseResult = autoScreenshotConfigSchema.safeParse(account.autoScreenshotConfig);
    if (!parseResult.success) {
        logger.warn({ accountId }, '[auto-screenshot] Invalid autoScreenshotConfig, skipping');
        return;
    }

    const config = parseResult.data;
    if (!config.enabled) return;

    const timeframes = event === 'OPEN' ? config.openTimeframes : config.closeTimeframes;
    if (timeframes.length === 0) return;

    const normalisedSymbol = normaliseSymbol(trade.symbol);

    // Anchor the chart end to the trade event time.
    // For OPEN: use entryTime so the chart ends at (or just after) the entry candle.
    // For CLOSE: use exitTime so the chart ends at (or just after) the exit candle.
    // We add a small 1-bar buffer (computed per-timeframe) so the event candle itself
    // is fully formed and visible as the last bar. No long in-process wait needed.
    const baseTime = event === 'CLOSE' ? (trade.exitTime ?? trade.entryTime) : trade.entryTime;

    for (const tf of timeframes) {
        const interval = mapTimeframe(tf);
        if (!interval) {
            logger.warn({ tf }, '[auto-screenshot] Unknown timeframe, skipping');
            continue;
        }

        // endDate = event time + 1 bar, capped at now+30s so we never request the future.
        // This shows the event candle as the last bar on the chart.
        const oneCandleMs = intervalToMs(interval);
        const rawEndMs = baseTime
            ? new Date(baseTime).getTime() + oneCandleMs
            : Date.now();
        const endDate = new Date(Math.min(rawEndMs, Date.now() + 30_000)).toISOString();

        try {
            const pngBuffer = await renderCandlestickChart({
                symbol: normalisedSymbol,
                interval,
                entryPrice: trade.entryPrice,
                stopLoss: trade.stopLoss,
                takeProfit: trade.takeProfit,
                barsOfContext: config.barsOfContext,
                timezone,
                endDate,
            });

            const filename = generateFilename('chart.png');
            await saveFile(pngBuffer, filename);

            try {
                await prisma.media.create({
                    data: {
                        tradeId,
                        filename,
                        filepath: `screenshots/${filename}`,
                        mimetype: 'image/png',
                        size: pngBuffer.length,
                        type: 'AUTO',
                        timeframe: tf,
                        event,
                    },
                });
            } catch (dbErr) {
                try { await deleteFile(filename); } catch (cleanupErr) {
                    logger.warn({ cleanupErr, filename }, '[auto-screenshot] Failed to clean up orphaned file');
                }
                throw dbErr;
            }

            logger.info({ tradeId, tf, event, symbol: normalisedSymbol }, '[auto-screenshot] Captured');
        } catch (err) {
            if (isTwelveDataSymbolNotFound(err)) {
                logger.warn({ tradeId, tf, event, symbol: normalisedSymbol, rawSymbol: trade.symbol }, '[auto-screenshot] Symbol not available in Twelve Data — skipping (add mapping to TWELVE_DATA_SYMBOL_MAP in symbol-normaliser.ts if needed)');
            } else {
                logger.error({ err, tradeId, tf, event, symbol: normalisedSymbol, rawSymbol: trade.symbol }, '[auto-screenshot] Failed to capture screenshot');
            }
        }
    }
}
