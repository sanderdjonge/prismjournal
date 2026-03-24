import { z } from 'zod';

export const VALID_TIMEFRAMES = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1'] as const;
export type Timeframe = typeof VALID_TIMEFRAMES[number];

export const autoScreenshotConfigSchema = z.object({
    enabled: z.boolean().default(false),
    openTimeframes: z.array(z.enum(VALID_TIMEFRAMES)).default([]),
    closeTimeframes: z.array(z.enum(VALID_TIMEFRAMES)).default([]),
    barsOfContext: z.number().int().min(1).max(100).default(25),
    /** Bars to wait after the trade event before anchoring the chart end_date (0 = live/immediate). */
    screenshotDelayBars: z.number().int().min(0).max(25).default(0),
});

export type AutoScreenshotConfig = z.infer<typeof autoScreenshotConfigSchema>;
