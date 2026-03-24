import prisma from '@/lib/prisma';
import logger from '@/lib/logger';
import { normaliseSymbol, mapTimeframe, isTwelveDataSymbolNotFound, isTwelveDataPriceMismatch } from '@/lib/symbol-normaliser';
import { renderCandlestickChart } from './chart-renderer.service';
import { saveFile, deleteFile, generateFilename } from '@/lib/storage';
import { autoScreenshotConfigSchema } from '@/lib/validations/screenshot-config';

interface TradeSnapshot {
    symbol: string;
    entryPrice: number;
    exitPrice?: number | null;
    stopLoss?: number | null;
    takeProfit?: number | null;
    entryTime?: string;   // ISO string
    exitTime?: string;    // ISO string
}

/** Milliseconds per Twelve Data interval string. */
const TF_MS: Record<string, number> = {
    '1min': 60_000, '5min': 300_000, '15min': 900_000, '30min': 1_800_000,
    '1h': 3_600_000, '4h': 14_400_000, '1day': 86_400_000, '1week': 604_800_000,
};

/**
 * Capture a single chart screenshot and save it as a Media record.
 * Used both for immediate captures and by the pending screenshot processor.
 */
async function captureOne(opts: {
    tradeId: string;
    event: 'OPEN' | 'CLOSE';
    timeframe: string;
    interval: string;
    symbol: string;
    entryPrice: number;
    exitPrice?: number | null;
    stopLoss?: number | null;
    takeProfit?: number | null;
    barsOfContext: number;
    timezone: string;
    endDate?: string;
}): Promise<void> {
    const { tradeId, event, timeframe, interval, symbol, entryPrice, exitPrice, stopLoss, takeProfit, barsOfContext, timezone, endDate } = opts;

    const pngBuffer = await renderCandlestickChart({
        symbol,
        interval,
        entryPrice,
        exitPrice,
        stopLoss,
        takeProfit,
        barsOfContext,
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
                timeframe,
                event,
            },
        });
    } catch (dbErr) {
        try { await deleteFile(filename); } catch (cleanupErr) {
            logger.warn({ cleanupErr, filename }, '[auto-screenshot] Failed to clean up orphaned file');
        }
        throw dbErr;
    }

    logger.info({ tradeId, timeframe, event, symbol }, '[auto-screenshot] Captured');
}

/**
 * Capture automatic chart screenshots for a trade on all configured timeframes.
 *
 * - When screenshotDelayBars = 0: captures immediately (no end_date — most recent live data).
 * - When screenshotDelayBars > 0: creates PendingScreenshot records; the processor
 *   picks them up once the scheduled time has passed.
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

    // When a close event fires, cancel any pending OPEN screenshots for this trade —
    // the exit screenshot already shows entry + exit lines, making them redundant.
    if (event === 'CLOSE') {
        await prisma.pendingScreenshot.deleteMany({
            where: { tradeId, event: 'OPEN' },
        }).catch(() => {});
    }

    const normalisedSymbol = normaliseSymbol(trade.symbol);
    // Exit screenshots are always immediate — delay only makes sense for entries.
    const delayBars = event === 'CLOSE' ? 0 : (config.screenshotDelayBars ?? 0);

    for (const tf of timeframes) {
        const interval = mapTimeframe(tf);
        if (!interval) {
            logger.warn({ tf }, '[auto-screenshot] Unknown timeframe, skipping');
            continue;
        }

        if (delayBars === 0) {
            // Immediate capture — no end_date, Twelve Data returns most recent N candles.
            try {
                await captureOne({
                    tradeId, event, timeframe: tf, interval, symbol: normalisedSymbol,
                    entryPrice: trade.entryPrice, exitPrice: trade.exitPrice,
                    stopLoss: trade.stopLoss, takeProfit: trade.takeProfit,
                    barsOfContext: config.barsOfContext, timezone,
                });
            } catch (err) {
                if (isTwelveDataSymbolNotFound(err) || isTwelveDataPriceMismatch(err)) {
                    logger.warn({ tradeId, tf, event, symbol: normalisedSymbol, rawSymbol: trade.symbol }, '[auto-screenshot] Symbol not available on current Twelve Data plan — skipping');
                } else {
                    logger.error({ err, tradeId, tf, event, symbol: normalisedSymbol, rawSymbol: trade.symbol }, '[auto-screenshot] Failed to capture screenshot');
                }
            }
        } else {
            // Delayed capture — schedule for eventTime + delay * barDuration.
            const eventTime = event === 'OPEN' ? trade.entryTime : trade.exitTime;
            if (!eventTime) {
                logger.warn({ tradeId, tf, event }, '[auto-screenshot] No event time for delayed capture, skipping');
                continue;
            }
            const barMs = TF_MS[interval];
            if (!barMs) {
                logger.warn({ tf, interval }, '[auto-screenshot] Unknown bar duration, skipping');
                continue;
            }
            const scheduledFor = new Date(new Date(eventTime).getTime() + delayBars * barMs);
            try {
                await prisma.pendingScreenshot.create({
                    data: {
                        tradeId, accountId, userId, event,
                        timeframe: tf, interval,
                        symbol: normalisedSymbol,
                        entryPrice: trade.entryPrice,
                        stopLoss: trade.stopLoss ?? null,
                        takeProfit: trade.takeProfit ?? null,
                        entryTime: trade.entryTime ?? null,
                        exitTime: trade.exitTime ?? null,
                        scheduledFor,
                        timezone,
                        barsOfContext: config.barsOfContext,
                    },
                });
                logger.info({ tradeId, tf, event, scheduledFor }, '[auto-screenshot] Screenshot scheduled');
            } catch (err) {
                logger.error({ err, tradeId, tf }, '[auto-screenshot] Failed to schedule screenshot');
            }
        }
    }
}

/**
 * Process all pending screenshots whose scheduledFor time has passed.
 * Call this from instrumentation.ts on a setInterval or from a cron endpoint.
 */
export async function processScheduledScreenshots(): Promise<void> {
    if (!process.env.TWELVE_DATA_API_KEY) return;

    const due = await prisma.pendingScreenshot.findMany({
        where: { scheduledFor: { lte: new Date() } },
        orderBy: { scheduledFor: 'asc' },
        take: 20, // process at most 20 per run to avoid long-running jobs
    });

    if (due.length === 0) return;
    logger.info({ count: due.length }, '[auto-screenshot] Processing scheduled screenshots');

    for (const pending of due) {
        // Refresh SL/TP from the trade — they may have been set after the pending record was created.
        const trade = await prisma.trade.findUnique({
            where: { id: pending.tradeId },
            select: { stopLoss: true, takeProfit: true, exitPrice: true },
        });

        try {
            await captureOne({
                tradeId: pending.tradeId,
                event: pending.event as 'OPEN' | 'CLOSE',
                timeframe: pending.timeframe,
                interval: pending.interval,
                symbol: pending.symbol,
                entryPrice: pending.entryPrice,
                stopLoss: trade?.stopLoss ?? pending.stopLoss,
                takeProfit: trade?.takeProfit ?? pending.takeProfit,
                exitPrice: trade?.exitPrice ?? null,
                barsOfContext: pending.barsOfContext,
                timezone: pending.timezone,
                // Anchor the chart to the scheduled time so it shows X bars after the event.
                endDate: pending.scheduledFor.toISOString(),
            });
        } catch (err) {
            if (isTwelveDataSymbolNotFound(err) || isTwelveDataPriceMismatch(err)) {
                logger.warn({ id: pending.id, symbol: pending.symbol }, '[auto-screenshot] Symbol not available on current Twelve Data plan — discarding pending record');
            } else {
                logger.error({ err, id: pending.id }, '[auto-screenshot] Failed to process scheduled screenshot');
            }
        }

        // Delete the pending record regardless of success/failure so it doesn't retry forever.
        await prisma.pendingScreenshot.delete({ where: { id: pending.id } }).catch(() => {});
    }
}
