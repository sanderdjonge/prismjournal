/**
 * Psychology-based filters for What-If Simulator
 * Loss Limits, Streak Breaks, Big Loss Cooldown
 */

import { TradeData } from '../types';

/** Apply daily loss limit - stop trading after hitting limit */
export function applyDailyLossLimit(trades: TradeData[], limit: number): TradeData[] {
  // Sort trades by exit time
  const sortedTrades = [...trades]
    .filter(t => t.exitTime)
    .sort((a, b) => new Date(a.exitTime!).getTime() - new Date(b.exitTime!).getTime());
  
  // Group by day
  const tradesByDay = new Map<string, TradeData[]>();
  for (const trade of sortedTrades) {
    const day = new Date(trade.exitTime!).toDateString();
    if (!tradesByDay.has(day)) tradesByDay.set(day, []);
    tradesByDay.get(day)!.push(trade);
  }
  
  // Process each day
  const result: TradeData[] = [];
  for (const [, dayTrades] of tradesByDay) {
    let dayPnl = 0;
    for (const trade of dayTrades) {
      if (dayPnl <= -limit) break; // Stop after limit hit
      result.push(trade);
      dayPnl += trade.pnl ?? 0;
    }
  }
  return result;
}

/** Get ISO week string (YYYY-WW) */
function getISOWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
}

/** Apply weekly loss limit - stop trading after hitting limit */
export function applyWeeklyLossLimit(trades: TradeData[], limit: number): TradeData[] {
  // Sort trades by exit time
  const sortedTrades = [...trades]
    .filter(t => t.exitTime)
    .sort((a, b) => new Date(a.exitTime!).getTime() - new Date(b.exitTime!).getTime());
  
  // Group by ISO week
  const tradesByWeek = new Map<string, TradeData[]>();
  for (const trade of sortedTrades) {
    const date = new Date(trade.exitTime!);
    const weekKey = getISOWeek(date);
    if (!tradesByWeek.has(weekKey)) tradesByWeek.set(weekKey, []);
    tradesByWeek.get(weekKey)!.push(trade);
  }
  
  // Process each week
  const result: TradeData[] = [];
  for (const [, weekTrades] of tradesByWeek) {
    let weekPnl = 0;
    for (const trade of weekTrades) {
      if (weekPnl <= -limit) break;
      result.push(trade);
      weekPnl += trade.pnl ?? 0;
    }
  }
  return result;
}

/** Apply streak break - HARD STOP after X consecutive losses */
export function applyStreakBreak(trades: TradeData[], stopAfterLosses: number): TradeData[] {
  const sortedTrades = [...trades]
    .filter(t => t.exitTime)
    .sort((a, b) => new Date(a.exitTime!).getTime() - new Date(b.exitTime!).getTime());
  
  const result: TradeData[] = [];
  let consecutiveLosses = 0;
  let stopped = false;
  
  for (const trade of sortedTrades) {
    // Once stopped, no more trades are taken (hard stop for psychology)
    if (stopped) break;
    
    result.push(trade);
    
    // Track consecutive losses
    if ((trade.pnl ?? 0) < 0) {
      consecutiveLosses++;
      if (consecutiveLosses >= stopAfterLosses) {
        stopped = true;
      }
    } else {
      // Win resets the counter
      consecutiveLosses = 0;
    }
  }
  return result;
}

/** Apply big loss cooldown - avoid trading X hours after >Y R loss */
export function applyBigLossCooldown(
  trades: TradeData[],
  params: { rThreshold: number; cooldownHours: number }
): TradeData[] {
  const sortedTrades = [...trades]
    .filter(t => t.exitTime)
    .sort((a, b) => new Date(a.exitTime!).getTime() - new Date(b.exitTime!).getTime());
  
  const result: TradeData[] = [];
  let cooldownUntil: Date | null = null;
  
  for (const trade of sortedTrades) {
    const entryTime = new Date(trade.entryTime);
    
    // Check if still in cooldown
    if (cooldownUntil && entryTime < cooldownUntil) {
      continue;
    }
    
    result.push(trade);
    
    // Check if this trade triggers cooldown
    // Task 6: Fixed - cooldown should start from exitTime, not entryTime
    const rMultiple = trade.rMultiple ?? 0;
    if (rMultiple < -params.rThreshold && trade.exitTime) {
      const exitTime = new Date(trade.exitTime);
      cooldownUntil = new Date(exitTime.getTime() + params.cooldownHours * 60 * 60 * 1000);
    }
  }
  return result;
}