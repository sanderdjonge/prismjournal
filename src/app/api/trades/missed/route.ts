import { NextRequest } from 'next/server';
import { TradeDirection } from '@prisma/client';
import { withAuth } from '@/lib/api/withAuth';
import type { Session } from 'next-auth';
import {
  createMissedTrade,
  getMissedTrades,
  getMissedTradeStats,
  CreateMissedTradeInput,
} from '@/lib/services/missed-trade.service';
import { validateBody } from '@/lib/validations/common';
import { z } from 'zod';
import { ok, created, badRequest, internalError } from '@/lib/api/responses';
import logger from '@/lib/logger';

type AuthedSession = Session & { user: { id: string } };

const createMissedTradeSchema = z.object({
  accountId: z.string().min(1),
  symbol: z.string().min(1),
  direction: z.nativeEnum(TradeDirection),
  entryPrice: z.coerce.number(),
  stopLoss: z.coerce.number(),
  takeProfit: z.coerce.number(),
  exitPrice: z.coerce.number().optional(),
  entryTime: z.string().min(1),
  exitTime: z.string().optional(),
  notes: z.string().optional(),
  reasonNotTaken: z.string().optional(),
});

export const GET = withAuth(async (
  request: NextRequest,
  _ctx: Record<string, unknown>,
  session: AuthedSession
) => {
  const userId = session.user.id;
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId') ?? undefined;
  const includeStats = searchParams.get('includeStats') === 'true';

  try {
    const trades = await getMissedTrades(userId, accountId);

    const response: {
      trades: Awaited<ReturnType<typeof getMissedTrades>>;
      stats?: Awaited<ReturnType<typeof getMissedTradeStats>>;
    } = { trades };

    if (includeStats) {
      response.stats = await getMissedTradeStats(userId, accountId);
    }

    return ok(response);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching missed trades');
    return internalError();
  }
});

export const POST = withAuth(async (
  request: NextRequest,
  _ctx: Record<string, unknown>,
  session: AuthedSession
) => {
  const userId = session.user.id;
  
  try {
    const validation = await validateBody(request, createMissedTradeSchema);
    if (!validation.success) return validation.response;

    const {
      accountId,
      symbol,
      direction,
      entryPrice,
      stopLoss,
      takeProfit,
      exitPrice,
      entryTime,
      exitTime,
      notes,
      reasonNotTaken,
    } = validation.data;

    const input: CreateMissedTradeInput = {
      accountId,
      symbol: symbol.toUpperCase(),
      direction,
      entryPrice,
      stopLoss,
      takeProfit,
      exitPrice,
      entryTime: new Date(entryTime),
      exitTime: exitTime ? new Date(exitTime) : undefined,
      notes,
      reasonNotTaken,
    };

    const missedTrade = await createMissedTrade(userId, input);

    return created(missedTrade);
  } catch (error) {
    logger.error({ err: error }, 'Error creating missed trade');
    return internalError();
  }
});
