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
    const delayBars = config.screenshotDelayBars ?? 5;

    // The base time anchor for the chart: entryTime for OPEN, exitTime for CLOSE
    const baseTime = event === 'CLOSE' ? (trade.exitTime ?? trade.entryTime) : trade.entryTime;

    for (const tf of timeframes) {
        const interval = mapTimeframe(tf);
        if (!interval) {
            logger.warn({ tf }, '[auto-screenshot] Unknown timeframe, skipping');
            continue;
        }

        // Compute end_date: base event time + delayBars * interval duration
        // This anchors the chart to the trade event and shows post-event context.
        const delayMs = delayBars * intervalToMs(interval);
        const endDate = baseTime
            ? new Date(new Date(baseTime).getTime() + delayMs).toISOString()
            : undefined;

        // Wait for the delay before capturing so the bars actually exist in Twelve Data
        if (delayMs > 0) {
            const now = Date.now();
            const eventMs = baseTime ? new Date(baseTime).getTime() : now;
            const captureAt = eventMs + delayMs;
            const remainingMs = captureAt - now;
            if (remainingMs > 0) {
                await new Promise<void>((resolve) => setTimeout(resolve, remainingMs));
            }
        }

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
