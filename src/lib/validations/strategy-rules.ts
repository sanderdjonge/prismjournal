import { z } from 'zod';

// ============================================
// Strategy Rule Types
// ============================================

export const StrategyRuleTypeSchema = z.enum([
  'MAX_DAILY_LOSS',
  'MAX_DAILY_TRADES',
  'MIN_RR_RATIO',
  'ALLOWED_TIME_WINDOWS',
  'ALLOWED_SYMBOLS',
  'MAX_POSITION_SIZE',
  'NO_OVERTRADING',
  'MANDATORY_STOP_LOSS',
  'MAX_HOLDING_TIME',
  'MIN_HOLDING_TIME',
]);

export type StrategyRuleType = z.infer<typeof StrategyRuleTypeSchema>;

// ============================================
// Individual Rule Schemas
// ============================================

export const MaxDailyLossRuleSchema = z.object({
  id: z.string(),
  type: z.literal('MAX_DAILY_LOSS'),
  enabled: z.boolean().default(true),
  limit: z.number().positive(),
  isPercentage: z.boolean().default(false),
  description: z.string().optional(),
});

export const MaxDailyTradesRuleSchema = z.object({
  id: z.string(),
  type: z.literal('MAX_DAILY_TRADES'),
  enabled: z.boolean().default(true),
  limit: z.number().int().positive(),
  description: z.string().optional(),
});

export const MinRRRatioRuleSchema = z.object({
  id: z.string(),
  type: z.literal('MIN_RR_RATIO'),
  enabled: z.boolean().default(true),
  limit: z.number().positive(),
  description: z.string().optional(),
});

export const AllowedTimeWindowsRuleSchema = z.object({
  id: z.string(),
  type: z.literal('ALLOWED_TIME_WINDOWS'),
  enabled: z.boolean().default(true),
  windows: z.array(
    z.object({
      start: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
      end: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
      days: z.array(z.number().min(0).max(6)).optional(),
    })
  ),
  timezone: z.string().default('UTC'),
  description: z.string().optional(),
});

export const AllowedSymbolsRuleSchema = z.object({
  id: z.string(),
  type: z.literal('ALLOWED_SYMBOLS'),
  enabled: z.boolean().default(true),
  symbols: z.array(z.string()),
  mode: z.enum(['ALLOW', 'BLOCK']).default('ALLOW'),
  description: z.string().optional(),
});

export const MaxPositionSizeRuleSchema = z.object({
  id: z.string(),
  type: z.literal('MAX_POSITION_SIZE'),
  enabled: z.boolean().default(true),
  limit: z.number().positive(),
  description: z.string().optional(),
});

export const NoOvertradingRuleSchema = z.object({
  id: z.string(),
  type: z.literal('NO_OVERTRADING'),
  enabled: z.boolean().default(true),
  maxTradesPerHour: z.number().int().positive(),
  cooldownMinutes: z.number().int().positive().optional(),
  description: z.string().optional(),
});

export const MandatoryStopLossRuleSchema = z.object({
  id: z.string(),
  type: z.literal('MANDATORY_STOP_LOSS'),
  enabled: z.boolean().default(true),
  maxDistancePips: z.number().positive().optional(),
  requireBeforeEntry: z.boolean().default(false),
  description: z.string().optional(),
});

export const MaxHoldingTimeRuleSchema = z.object({
  id: z.string(),
  type: z.literal('MAX_HOLDING_TIME'),
  enabled: z.boolean().default(true),
  maxMinutes: z.number().int().positive(),
  description: z.string().optional(),
});

export const MinHoldingTimeRuleSchema = z.object({
  id: z.string(),
  type: z.literal('MIN_HOLDING_TIME'),
  enabled: z.boolean().default(true),
  minMinutes: z.number().int().positive(),
  description: z.string().optional(),
});

// ============================================
// Union of All Rule Types
// ============================================

export const StrategyRuleSchema = z.discriminatedUnion('type', [
  MaxDailyLossRuleSchema,
  MaxDailyTradesRuleSchema,
  MinRRRatioRuleSchema,
  AllowedTimeWindowsRuleSchema,
  AllowedSymbolsRuleSchema,
  MaxPositionSizeRuleSchema,
  NoOvertradingRuleSchema,
  MandatoryStopLossRuleSchema,
  MaxHoldingTimeRuleSchema,
  MinHoldingTimeRuleSchema,
]);

export type StrategyRule = z.infer<typeof StrategyRuleSchema>;

// ============================================
// Full Strategy Rules Configuration
// ============================================

export const StrategyRulesConfigSchema = z.object({
  version: z.literal(1),
  rules: z.array(StrategyRuleSchema),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export type StrategyRulesConfig = z.infer<typeof StrategyRulesConfigSchema>;

// ============================================
// Helper Functions
// ============================================

export function createDefaultRules(): StrategyRulesConfig {
  return {
    version: 1,
    rules: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function validateRules(config: unknown): StrategyRulesConfig | null {
  const result = StrategyRulesConfigSchema.safeParse(config);
  if (result.success) {
    return result.data;
  }
  console.error('Strategy rules validation failed:', result.error.errors);
  return null;
}

export function getEnabledRules(config: StrategyRulesConfig): StrategyRule[] {
  return config.rules.filter(rule => rule.enabled);
}

export function getRulesByType<T extends StrategyRuleType>(
  config: StrategyRulesConfig,
  type: T
): Extract<StrategyRule, { type: T }>[] {
  return config.rules.filter(
    rule => rule.type === type && rule.enabled
  ) as Extract<StrategyRule, { type: T }>[];
}
