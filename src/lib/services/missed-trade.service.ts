/**
 * Missed Trade Service - Phase 24
 * Handles creation and analysis of hypothetical/missed trades
 */

import prisma from '@/lib/prisma';
import { TradeDirection, TradeSource } from '@prisma/client';

export interface CreateMissedTradeInput {
  accountId: string;
  symbol: string;
  direction: TradeDirection;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  exitPrice?: number;
  entryTime: Date;
  exitTime?: Date;
  notes?: string;
  reasonNotTaken?: string;
}

export interface MissedTradeStats {
  totalMissed: number;
  wouldBeWinners: number;
  wouldBeLosers: number;
  wouldBeBreakeven: number;
  totalWouldBePnl: number;
  avgWouldBeRr: number;
  regretScore: number; // How much profit was left on the table
}

export interface MissedTradeWithCalc extends CreateMissedTradeInput {
  id: string;
  wouldBePnl?: number;
  wouldBeRr?: number;
  wouldBeResult: 'WIN' | 'LOSS' | 'BREAKEVEN' | 'UNKNOWN';
  createdAt: Date;
}

/**
 * Calculate what the P&L would have been for a missed trade
 */
export function calculateHypotheticalPnl(
  direction: TradeDirection,
  entryPrice: number,
  exitPrice: number | undefined,
  stopLoss: number,
  takeProfit: number,
  riskAmount: number = 100 // Default risk for calculation
): { pnl: number; rr: number; result: 'WIN' | 'LOSS' | 'BREAKEVEN' | 'UNKNOWN' } {
  if (!exitPrice) {
    // If no exit price, check if TP or SL would have been hit first
    // Simple assumption: if price moved beyond TP, it's a win; beyond SL, it's a loss
    // This is a simplification - in reality, we'd need price data
    return { pnl: 0, rr: 0, result: 'UNKNOWN' };
  }

  const isLong = direction === TradeDirection.LONG;
  const priceDiff = isLong ? exitPrice - entryPrice : entryPrice - exitPrice;
  
  // Calculate R:R
  const stopDistance = Math.abs(entryPrice - stopLoss);
  const rr = stopDistance > 0 ? priceDiff / stopDistance : 0;
  
  // Calculate P&L based on risk
  const pnl = rr * riskAmount;
  
  // Determine result
  let result: 'WIN' | 'LOSS' | 'BREAKEVEN';
  if (isLong) {
    if (exitPrice >= takeProfit) {
      result = 'WIN';
    } else if (exitPrice <= stopLoss) {
      result = 'LOSS';
    } else if (Math.abs(exitPrice - entryPrice) < stopDistance * 0.1) {
      result = 'BREAKEVEN';
    } else {
      result = exitPrice > entryPrice ? 'WIN' : 'LOSS';
    }
  } else {
    if (exitPrice <= takeProfit) {
      result = 'WIN';
    } else if (exitPrice >= stopLoss) {
      result = 'LOSS';
    } else if (Math.abs(exitPrice - entryPrice) < stopDistance * 0.1) {
      result = 'BREAKEVEN';
    } else {
      result = exitPrice < entryPrice ? 'WIN' : 'LOSS';
    }
  }
  
  return { pnl, rr, result };
}

/**
 * Create a missed/hypothetical trade
 */
export async function createMissedTrade(
  userId: string,
  input: CreateMissedTradeInput
): Promise<MissedTradeWithCalc> {
  // Verify account belongs to user
  const account = await prisma.tradingAccount.findFirst({
    where: { id: input.accountId, userId },
  });
  
  if (!account) {
    throw new Error('Account not found or does not belong to user');
  }
  
  // Calculate hypothetical outcome
  const { pnl, rr, result } = calculateHypotheticalPnl(
    input.direction,
    input.entryPrice,
    input.exitPrice,
    input.stopLoss,
    input.takeProfit
  );
  
  // Create the hypothetical trade
  const trade = await prisma.trade.create({
    data: {
      accountId: input.accountId,
      symbol: input.symbol,
      direction: input.direction,
      source: TradeSource.HYPOTHETICAL,
      entryPrice: input.entryPrice,
      exitPrice: input.exitPrice,
      stopLoss: input.stopLoss,
      takeProfit: input.takeProfit,
      entryTime: input.entryTime,
      exitTime: input.exitTime,
      notes: input.notes,
      hypotheticalData: {
        reasonNotTaken: input.reasonNotTaken,
        wouldBePnl: pnl,
        wouldBeRr: rr,
        wouldBeResult: result,
      },
      status: 'CLOSED',
    },
  });
  
  return {
    id: trade.id,
    accountId: trade.accountId,
    symbol: trade.symbol,
    direction: trade.direction,
    entryPrice: trade.entryPrice,
    stopLoss: trade.stopLoss ?? input.stopLoss,
    takeProfit: trade.takeProfit ?? input.takeProfit,
    exitPrice: trade.exitPrice ?? undefined,
    entryTime: trade.entryTime,
    exitTime: trade.exitTime ?? undefined,
    notes: trade.notes ?? undefined,
    reasonNotTaken: input.reasonNotTaken,
    wouldBePnl: pnl,
    wouldBeRr: rr,
    wouldBeResult: result,
    createdAt: trade.createdAt,
  };
}

/**
 * Get all missed trades for an account
 */
export async function getMissedTrades(
  userId: string,
  accountId?: string
): Promise<MissedTradeWithCalc[]> {
  const trades = await prisma.trade.findMany({
    where: {
      source: TradeSource.HYPOTHETICAL,
      account: { userId },
      ...(accountId && { accountId }),
    },
    orderBy: { entryTime: 'desc' },
  });
  
  return trades.map((trade) => {
    // Type assertion for hypotheticalData field (added in Phase 24)
    const tradeWithHypothetical = trade as unknown as {
      hypotheticalData?: {
        reasonNotTaken?: string;
        wouldBePnl?: number;
        wouldBeRr?: number;
        wouldBeResult?: 'WIN' | 'LOSS' | 'BREAKEVEN' | 'UNKNOWN';
      } | null;
    };
    const hypotheticalData = tradeWithHypothetical.hypotheticalData;
    
    return {
      id: trade.id,
      accountId: trade.accountId,
      symbol: trade.symbol,
      direction: trade.direction,
      entryPrice: trade.entryPrice,
      stopLoss: trade.stopLoss ?? 0,
      takeProfit: trade.takeProfit ?? 0,
      exitPrice: trade.exitPrice ?? undefined,
      entryTime: trade.entryTime,
      exitTime: trade.exitTime ?? undefined,
      notes: trade.notes ?? undefined,
      reasonNotTaken: hypotheticalData?.reasonNotTaken,
      wouldBePnl: hypotheticalData?.wouldBePnl,
      wouldBeRr: hypotheticalData?.wouldBeRr,
      wouldBeResult: hypotheticalData?.wouldBeResult ?? 'UNKNOWN',
      createdAt: trade.createdAt,
    };
  });
}

/**
 * Calculate statistics for missed trades
 */
export async function getMissedTradeStats(
  userId: string,
  accountId?: string
): Promise<MissedTradeStats> {
  const trades = await getMissedTrades(userId, accountId);
  
  const totalMissed = trades.length;
  const wouldBeWinners = trades.filter((t) => t.wouldBeResult === 'WIN').length;
  const wouldBeLosers = trades.filter((t) => t.wouldBeResult === 'LOSS').length;
  const wouldBeBreakeven = trades.filter((t) => t.wouldBeResult === 'BREAKEVEN').length;
  
  const totalWouldBePnl = trades.reduce((sum, t) => sum + (t.wouldBePnl ?? 0), 0);
  const avgWouldBeRr = trades.length > 0
    ? trades.reduce((sum, t) => sum + (t.wouldBeRr ?? 0), 0) / trades.length
    : 0;
  
  // Regret score: positive would-be P&L from missed winners
  const regretScore = trades
    .filter((t) => t.wouldBeResult === 'WIN')
    .reduce((sum, t) => sum + (t.wouldBePnl ?? 0), 0);
  
  return {
    totalMissed,
    wouldBeWinners,
    wouldBeLosers,
    wouldBeBreakeven,
    totalWouldBePnl,
    avgWouldBeRr,
    regretScore,
  };
}

/**
 * Delete a missed trade
 */
export async function deleteMissedTrade(
  userId: string,
  tradeId: string
): Promise<void> {
  const trade = await prisma.trade.findFirst({
    where: {
      id: tradeId,
      source: TradeSource.HYPOTHETICAL,
      account: { userId },
    },
  });
  
  if (!trade) {
    throw new Error('Missed trade not found or does not belong to user');
  }
  
  await prisma.trade.delete({
    where: { id: tradeId },
  });
}