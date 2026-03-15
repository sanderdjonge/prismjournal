import { z } from 'zod';

/**
 * Trade platform enum for account creation
 */
export const accountPlatformEnum = z.enum(['METATRADER5', 'CTRADER', 'TRADINGVIEW', 'MANUAL']);

/**
 * Account type enum
 */
export const accountTypeEnum = z.enum(['PROPFIRM', 'OWN_MONEY']);

/**
 * Schema for creating a new trading account
 */
export const createAccountSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  broker: z.string().max(100).optional(),
  accountNumber: z.string().max(50).optional(),
  platform: accountPlatformEnum.optional().default('METATRADER5'),
  platformAccountId: z.string().max(50).optional(),
  currency: z.string().length(3, 'Currency must be 3 characters').optional().default('USD'),
  leverage: z.number().int().min(1).max(1000).optional().default(100),
  accountType: accountTypeEnum.optional().default('OWN_MONEY'),
});

/**
 * Schema for updating a trading account
 */
export const updateAccountSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long').optional(),
  broker: z.string().max(100).optional(),
  accountNumber: z.string().max(50).optional(),
  isActive: z.boolean().optional(),
  notes: z.string().max(1000).optional(),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
