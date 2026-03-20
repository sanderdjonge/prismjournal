import prisma from '@/lib/prisma';
import logger from '@/lib/logger';
import { normaliseSymbol, mapTimeframe } from '@/lib/symbol-normaliser';
import { renderCandlestickChart } from './chart-renderer.service';
import { saveFile, deleteFile, generateFilename } from '@/lib/storage';
import { autoScreenshotConfigSchema } from '@/lib/validations/screenshot-config';

interface TradeSnapshot {
    symbol: string;
    entryPrice: number;
    stopLoss?: number | null;
    takeProfit?: number | null;
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
    event: 'OPEN' | 'CLOSE',
    trade: TradeSnapshot,
): Promise<void> {
    if (!process.env.TWELVE_DATA_API_KEY) return;

    const account = await prisma.tradingAccount.findUnique({
        where: { id: accountId },
        select: { autoScreenshotConfig: true },
    });

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

    for (const tf of timeframes) {
        const interval = mapTimeframe(tf);
        if (!interval) {
            logger.warn({ tf }, '[auto-screenshot] Unknown timeframe, skipping');
            continue;
        }

        try {
            const pngBuffer = await renderCandlestickChart({
                symbol: normalisedSymbol,
                interval,
                entryPrice: trade.entryPrice,
                stopLoss: trade.stopLoss,
                takeProfit: trade.takeProfit,
                barsOfContext: config.barsOfContext,
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
            logger.error({ err, tradeId, tf, event }, '[auto-screenshot] Failed to capture screenshot');
        }
    }
}
