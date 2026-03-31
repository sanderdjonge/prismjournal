/**
 * Missed Trades API - Phase 24
 * Handles CRUD operations for hypothetical/missed trades
 */

import { NextRequest, NextResponse } from 'next/server';
import { TradeDirection } from '@prisma/client';
import { withAuth } from '@/lib/api/withAuth';
import type { Session } from 'next-auth';
import {
  createMissedTrade,
  getMissedTrades,
  getMissedTradeStats,
  CreateMissedTradeInput,
} from '@/lib/services/missed-trade.service';

type AuthedSession = Session & { user: { id: string } };

// GET /api/trades/missed - List missed trades with stats
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

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching missed trades:', error);
    return NextResponse.json(
      { error: 'Failed to fetch missed trades' },
      { status: 500 }
    );
  }
});

// POST /api/trades/missed - Create a missed trade
export const POST = withAuth(async (
  request: NextRequest,
  _ctx: Record<string, unknown>,
  session: AuthedSession
) => {
  const userId = session.user.id;
  
  try {
    const body = await request.json();

    // Validate required fields
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
    } = body;

    if (!accountId || !symbol || !direction || !entryPrice || !stopLoss || !takeProfit || !entryTime) {
      return NextResponse.json(
        { error: 'Missing required fields: accountId, symbol, direction, entryPrice, stopLoss, takeProfit, entryTime' },
        { status: 400 }
      );
    }

    // Validate direction
    if (!Object.values(TradeDirection).includes(direction)) {
      return NextResponse.json(
        { error: 'Invalid direction. Must be LONG or SHORT' },
        { status: 400 }
      );
    }

    const input: CreateMissedTradeInput = {
      accountId,
      symbol: symbol.toUpperCase(),
      direction,
      entryPrice: parseFloat(entryPrice),
      stopLoss: parseFloat(stopLoss),
      takeProfit: parseFloat(takeProfit),
      exitPrice: exitPrice ? parseFloat(exitPrice) : undefined,
      entryTime: new Date(entryTime),
      exitTime: exitTime ? new Date(exitTime) : undefined,
      notes,
      reasonNotTaken,
    };

    const missedTrade = await createMissedTrade(userId, input);

    return NextResponse.json(missedTrade, { status: 201 });
  } catch (error) {
    console.error('Error creating missed trade:', error);
    const message = error instanceof Error ? error.message : 'Failed to create missed trade';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
});