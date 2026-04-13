import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import type { Session } from 'next-auth';
import { z } from 'zod';
import { runWhatIfSimulation, runMultipleScenarios, WhatIfFilters } from '@/lib/services/what-if.service';
import logger from '@/lib/logger';
import { ok, badRequest, internalError } from '@/lib/api/responses';

const timeFiltersSchema = z.object({
  maxDurationHours: z.number().positive().optional(),
  minDurationHours: z.number().nonnegative().optional(),
  marketSession: z.array(z.enum(['LONDON', 'NEW_YORK', 'ASIA', 'OVERLAP_LN', 'OVERLAP_NA'])).optional(),
  excludeDays: z.array(z.number().min(0).max(6)).optional(),
  excludeHours: z.array(z.number().min(0).max(23)).optional(),
}).optional();

const riskFiltersSchema = z.object({
  stopLossMultiplier: z.number().positive().optional(),
  maeMultiplier: z.number().positive().optional(),
  mfeMultiplier: z.number().positive().optional(),
  breakevenTrigger: z.number().positive().optional(),
  positionSizeMethod: z.enum(['FIXED_R', 'FIXED_DOLLAR', 'ADAPTIVE']).optional(),
  riskPerTrade: z.number().positive().optional(),
  trailingPercent: z.number().min(0).max(100).optional(),
  partialExitAt: z.object({
    rLevel: z.number().positive(),
    percent: z.number().min(1).max(100),
  }).optional(),
}).optional();

const psychologyFiltersSchema = z.object({
  dailyLossLimit: z.number().positive().optional(),
  weeklyLossLimit: z.number().positive().optional(),
  stopAfterLosses: z.number().int().positive().optional(),
  avoidAfterBigLoss: z.object({
    rThreshold: z.number().positive(),
    cooldownHours: z.number().positive(),
  }).optional(),
}).optional();

const marketFiltersSchema = z.object({
  minVolatility: z.number().nonnegative().optional(),
  maxVolatility: z.number().positive().optional(),
  avoidNewsEvents: z.boolean().optional(),
  newsBufferMinutes: z.number().int().positive().optional(),
}).optional();

const whatIfSchema = z.object({
  excludeDays: z.array(z.number().min(0).max(6)).optional(),
  excludeHours: z.array(z.number().min(0).max(23)).optional(),
  minRR: z.number().optional(),
  maxRR: z.number().optional(),
  minProfit: z.number().optional(),
  maxProfit: z.number().optional(),
  symbols: z.array(z.string()).optional(),
  stopLossMultiplier: z.number().positive().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  accountIds: z.array(z.string()).optional(),
  direction: z.enum(['LONG', 'SHORT']).optional(),

  time: timeFiltersSchema,
  risk: riskFiltersSchema,
  psychology: psychologyFiltersSchema,
  market: marketFiltersSchema,
});

const multiScenarioSchema = z.object({
    scenarios: z.array(whatIfSchema).min(1).max(5),
});

function parseJsonParam(param: string | null): unknown {
  if (!param) return undefined;
  try {
    return JSON.parse(param);
  } catch {
    return undefined;
  }
}

export const GET = withAuth(async (
    request: NextRequest,
    _ctx: Record<string, unknown>,
    session: Session & { user: { id: string } }
) => {
    const { searchParams } = new URL(request.url);

    const filters: WhatIfFilters = {};

    if (searchParams.get('excludeDays')) {
        filters.excludeDays = searchParams.get('excludeDays')!.split(',').map(Number);
    }
    if (searchParams.get('excludeHours')) {
        filters.excludeHours = searchParams.get('excludeHours')!.split(',').map(Number);
    }
    if (searchParams.get('minRR')) {
        filters.minRR = parseFloat(searchParams.get('minRR')!);
    }
    if (searchParams.get('maxRR')) {
        filters.maxRR = parseFloat(searchParams.get('maxRR')!);
    }
    if (searchParams.get('minProfit')) {
        filters.minProfit = parseFloat(searchParams.get('minProfit')!);
    }
    if (searchParams.get('maxProfit')) {
        filters.maxProfit = parseFloat(searchParams.get('maxProfit')!);
    }
    if (searchParams.get('symbols')) {
        filters.symbols = searchParams.get('symbols')!.split(',');
    }
    if (searchParams.get('stopLossMultiplier')) {
        filters.stopLossMultiplier = parseFloat(searchParams.get('stopLossMultiplier')!);
    }
    if (searchParams.get('startDate')) {
        filters.startDate = new Date(searchParams.get('startDate')!);
    }
    if (searchParams.get('endDate')) {
        filters.endDate = new Date(searchParams.get('endDate')!);
    }
    if (searchParams.get('accountIds')) {
        filters.accountIds = searchParams.get('accountIds')!.split(',');
    }
    if (searchParams.get('direction')) {
        filters.direction = searchParams.get('direction') as 'LONG' | 'SHORT';
    }

    if (searchParams.get('maxDurationHours')) {
        filters.time = { ...filters.time, maxDurationHours: parseFloat(searchParams.get('maxDurationHours')!) };
    }
    if (searchParams.get('minDurationHours')) {
        filters.time = { ...filters.time, minDurationHours: parseFloat(searchParams.get('minDurationHours')!) };
    }
    if (searchParams.get('marketSession')) {
        filters.time = {
            ...filters.time,
            marketSession: searchParams.get('marketSession')!.split(',') as ('LONDON' | 'NEW_YORK' | 'ASIA' | 'OVERLAP_LN' | 'OVERLAP_NA')[]
        };
    }

    if (searchParams.get('maeMultiplier')) {
        filters.risk = { ...filters.risk, maeMultiplier: parseFloat(searchParams.get('maeMultiplier')!) };
    }
    if (searchParams.get('mfeMultiplier')) {
        filters.risk = { ...filters.risk, mfeMultiplier: parseFloat(searchParams.get('mfeMultiplier')!) };
    }
    if (searchParams.get('breakevenTrigger')) {
        filters.risk = { ...filters.risk, breakevenTrigger: parseFloat(searchParams.get('breakevenTrigger')!) };
    }
    if (searchParams.get('positionSizeMethod')) {
        filters.risk = { ...filters.risk, positionSizeMethod: searchParams.get('positionSizeMethod') as 'FIXED_R' | 'FIXED_DOLLAR' | 'ADAPTIVE' };
    }
    if (searchParams.get('riskPerTrade')) {
        filters.risk = { ...filters.risk, riskPerTrade: parseFloat(searchParams.get('riskPerTrade')!) };
    }
    if (searchParams.get('trailingPercent')) {
        filters.risk = { ...filters.risk, trailingPercent: parseFloat(searchParams.get('trailingPercent')!) };
    }
    if (searchParams.get('partialExitAt')) {
        const parsed = parseJsonParam(searchParams.get('partialExitAt'));
        if (parsed && typeof parsed === 'object') {
            filters.risk = { ...filters.risk, partialExitAt: parsed as { rLevel: number; percent: number } };
        }
    }

    if (searchParams.get('dailyLossLimit')) {
        filters.psychology = { ...filters.psychology, dailyLossLimit: parseFloat(searchParams.get('dailyLossLimit')!) };
    }
    if (searchParams.get('weeklyLossLimit')) {
        filters.psychology = { ...filters.psychology, weeklyLossLimit: parseFloat(searchParams.get('weeklyLossLimit')!) };
    }
    if (searchParams.get('stopAfterLosses')) {
        filters.psychology = { ...filters.psychology, stopAfterLosses: parseInt(searchParams.get('stopAfterLosses')!, 10) };
    }
    if (searchParams.get('avoidAfterBigLoss')) {
        const parsed = parseJsonParam(searchParams.get('avoidAfterBigLoss'));
        if (parsed && typeof parsed === 'object') {
            filters.psychology = { ...filters.psychology, avoidAfterBigLoss: parsed as { rThreshold: number; cooldownHours: number } };
        }
    }

    if (searchParams.get('minVolatility')) {
        filters.market = { ...filters.market, minVolatility: parseFloat(searchParams.get('minVolatility')!) };
    }
    if (searchParams.get('maxVolatility')) {
        filters.market = { ...filters.market, maxVolatility: parseFloat(searchParams.get('maxVolatility')!) };
    }
    if (searchParams.get('avoidNewsEvents')) {
        filters.market = { ...filters.market, avoidNewsEvents: searchParams.get('avoidNewsEvents') === 'true' };
    }
    if (searchParams.get('newsBufferMinutes')) {
        filters.market = { ...filters.market, newsBufferMinutes: parseInt(searchParams.get('newsBufferMinutes')!, 10) };
    }

    const validated = whatIfSchema.safeParse(filters);
    if (!validated.success) {
        return badRequest('Validation failed');
    }

    try {
        const filtersWithDates = {
            ...validated.data,
            startDate: validated.data.startDate ? new Date(validated.data.startDate) : undefined,
            endDate: validated.data.endDate ? new Date(validated.data.endDate) : undefined,
        };
        const result = await runWhatIfSimulation(session.user.id, filtersWithDates);
        return ok(result);
    } catch (error) {
        logger.error({ error, userId: session.user.id }, '[what-if] Error running simulation');
        return internalError();
    }
});

export const POST = withAuth(async (
    request: NextRequest,
    _ctx: Record<string, unknown>,
    session: Session & { user: { id: string } }
) => {
    try {
        const body = await request.json();
        const validated = multiScenarioSchema.safeParse(body);

        if (!validated.success) {
            return badRequest('Validation failed');
        }

        const { scenarios } = validated.data;

        const parsedScenarios = scenarios.map(s => ({
            ...s,
            startDate: s.startDate ? new Date(s.startDate) : undefined,
            endDate: s.endDate ? new Date(s.endDate) : undefined,
        })) as WhatIfFilters[];

        const results = await runMultipleScenarios(session.user.id, parsedScenarios);
        return ok(results);
    } catch (error) {
        logger.error({ error, userId: session.user.id }, '[what-if] Error running multi-scenario');
        return internalError();
    }
});
