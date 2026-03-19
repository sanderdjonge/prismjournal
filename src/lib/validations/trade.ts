import { z } from 'zod';

/**
 * Trade type enum
 */
export const tradeTypeEnum = z.enum(['LONG', 'SHORT', 'long', 'short']);

/**
 * Trade status enum
 */
export const tradeStatusEnum = z.enum(['OPEN', 'CLOSED']);

/**
 * Mood enum
 */
export const moodEnum = z.enum(['CALM', 'CONFIDENT', 'NEUTRAL', 'ANXIOUS', 'FOMO', 'REVENGE']);

/**
 * Plan compliance enum
 */
export const planComplianceEnum = z.enum(['FOLLOWED', 'DEVIATED', 'PARTIAL']);

/**
 * Timeframe enum for screenshots
 */
export const timeframeEnum = z.enum(['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN', 'UNKNOWN']);

/**
 * Schema for creating a new trade (POST /api/trades)
 */
export const tradeCreateSchema = z.object({
  symbol: z.string().min(1, 'Symbol is required').max(20, 'Symbol too long'),
  type: tradeTypeEnum.transform((val) => val.toUpperCase() as 'LONG' | 'SHORT'),
  volume: z.number().positive('Volume must be positive'),
  entryPrice: z.number().positive('Entry price must be positive'),
  exitPrice: z.number().optional(),
  pnl: z.number().optional(),
  status: tradeStatusEnum.optional().default('OPEN'),
  strategy: z.string().max(100, 'Strategy name too long').optional(),
  mood: moodEnum.optional(),
  planCompliance: planComplianceEnum.optional(),
  notes: z.string().max(5000, 'Notes too long').optional(),
  takeProfit: z.number().positive('Take profit must be positive').optional(),
  stopLoss: z.number().positive('Stop loss must be positive').optional(),
  accountId: z.string().optional(),
});

export type TradeCreateInput = z.infer<typeof tradeCreateSchema>;

/**
 * Schema for updating a trade (PATCH /api/trades/[id])
 */
export const tradeUpdateSchema = z.object({
  symbol: z.string().min(1, 'Symbol is required').max(20, 'Symbol too long').optional(),
  type: tradeTypeEnum.transform((val) => val.toUpperCase() as 'LONG' | 'SHORT').optional(),
  volume: z.number().positive('Volume must be positive').optional(),
  entryPrice: z.number().positive('Entry price must be positive').optional(),
  exitPrice: z.number().optional(),
  pnl: z.number().optional(),
  status: tradeStatusEnum.optional(),
  strategy: z.string().max(100, 'Strategy name too long').optional(),
  mood: moodEnum.optional(),
  planCompliance: planComplianceEnum.optional(),
  notes: z.string().max(5000, 'Notes too long').optional(),
  takeProfit: z.number().positive('Take profit must be positive').optional().nullable(),
  stopLoss: z.number().positive('Stop loss must be positive').optional().nullable(),
  entryRating: z.number().int().min(1).max(5).optional(),
  exitRating: z.number().int().min(1).max(5).optional(),
  managementRating: z.number().int().min(1).max(5).optional(),
  accountId: z.string().optional(),
});

export type TradeUpdateInput = z.infer<typeof tradeUpdateSchema>;

/**
 * Schema for file upload (POST /api/trades/[id]/upload)
 * Note: File validation happens separately in the route handler
 */
export const tradeUploadSchema = z.object({
  file: z.custom<File>((v) => v instanceof File, 'File is required'),
  timeframe: timeframeEnum.default('UNKNOWN'),
});

/**
 * Schema for validating file upload metadata
 */
export const uploadMetadataSchema = z.object({
  timeframe: timeframeEnum.default('UNKNOWN'),
});

export type UploadMetadataInput = z.infer<typeof uploadMetadataSchema>;

/**
 * Allowed file types for trade screenshots
 */
export const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Validate file for upload
 */
export function validateFileUpload(file: File | null): { success: true } | { success: false; error: string } {
  if (!file) {
    return { success: false, error: 'No file provided' };
  }

  if (!ALLOWED_FILE_TYPES.includes(file.type as (typeof ALLOWED_FILE_TYPES)[number])) {
    return { success: false, error: `Invalid file type. Allowed: ${ALLOWED_FILE_TYPES.join(', ')}` };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { success: false, error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB` };
  }

  return { success: true };
}
