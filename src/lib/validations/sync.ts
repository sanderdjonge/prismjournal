import { z } from 'zod';
import { moodEnum } from './trade';

/**
 * Trade platform enum for multi-account sync
 */
export const syncPlatformEnum = z.enum(['METATRADER5', 'CTRADER', 'TRADINGVIEW', 'MANUAL']);

/**
 * Trade type enum for MT5 sync
 */
export const syncTradeTypeEnum = z.enum(['BUY', 'SELL', 'buy', 'sell']);

/**
 * Plan compliance enum (matches Prisma enum)
 */
export const planComplianceEnum = z.enum(['FOLLOWED', 'DEVIATED', 'PARTIAL']);

/**
 * Schema for a single trade in TRADE_UPDATE payload
 */
export const syncTradeSchema = z.object({
  ticket: z.string().min(1, 'Ticket is required'),
  symbol: z.string().min(1, 'Symbol is required').max(20, 'Symbol too long'),
  type: syncTradeTypeEnum.transform((val) => val.toUpperCase() as 'BUY' | 'SELL'),
  volume: z.number().positive('Volume must be positive'),
  entryPrice: z.number().optional(),
  exitPrice: z.number().nullable().optional(),
  pnl: z.number().nullable().optional(),
  entryTime: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid entry time format',
  }),
  exitTime: z.string().nullable().optional(),
  commission: z.number().nullable().optional(),
  swap: z.number().nullable().optional(),
  stopLoss: z.number().nullable().optional(),
  takeProfit: z.number().nullable().optional(),
  strategy: z.string().max(100, 'Strategy name too long').optional(),
  mood: moodEnum.optional().catch(undefined),
  planCompliance: planComplianceEnum.optional(),
});

/**
 * Schema for TRADE_UPDATE payload from MT5 bridge
 * Includes optional platform info for multi-account routing
 */
export const tradeUpdatePayloadSchema = z.object({
  type: z.literal('TRADE_UPDATE'),
  trade: syncTradeSchema,
  // Multi-account routing fields (optional for backwards compatibility)
  platform: syncPlatformEnum.optional().default('METATRADER5'),
  platformAccountId: z.string().optional(), // MT5 login ID, cTrader account ID, etc.
});

/**
 * Schema for equity snapshot in EQUITY_SNAPSHOT payload
 */
export const syncEquitySnapshotSchema = z.object({
  balance: z.number().min(0, 'Balance cannot be negative'),
  equity: z.number(),
  timestamp: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid timestamp format',
  }),
});

/**
 * Schema for EQUITY_SNAPSHOT payload from MT5 bridge
 * Includes optional platform info for multi-account routing
 */
export const equitySnapshotPayloadSchema = z.object({
  type: z.literal('EQUITY_SNAPSHOT'),
  snapshot: syncEquitySnapshotSchema,
  // Multi-account routing fields (optional for backwards compatibility)
  platform: syncPlatformEnum.optional().default('METATRADER5'),
  platformAccountId: z.string().optional(), // MT5 login ID, cTrader account ID, etc.
});

/**
 * Combined schema for sync endpoint (accepts either type)
 */
export const syncPayloadSchema = z.discriminatedUnion('type', [
  tradeUpdatePayloadSchema,
  equitySnapshotPayloadSchema,
]);

export type SyncPayload = z.output<typeof syncPayloadSchema>;
export type TradeUpdatePayload = z.output<typeof tradeUpdatePayloadSchema>;
export type EquitySnapshotPayload = z.output<typeof equitySnapshotPayloadSchema>;
// SyncTrade uses z.output to get the transformed type (type is uppercased)
export type SyncTrade = z.output<typeof syncTradeSchema>;
export type SyncEquitySnapshot = z.output<typeof syncEquitySnapshotSchema>;
