/**
 * Time-based filters for What-If Simulator
 * Duration, Market Sessions, Hours/Days
 */

import { TradeData } from '../types';

/** Market session UTC hour ranges */
const SESSION_HOURS = {
  LONDON: { start: 8, end: 16 },
  NEW_YORK: { start: 13, end: 21 },
  ASIA: { start: 23, end: 7 },  // Overnight
  OVERLAP_LN: { start: 13, end: 16 },
  OVERLAP_NA: { start: 23, end: 1 },
} as const;

/** Apply duration filter - exclude trades outside duration range */
export function applyDurationFilter(
  trades: TradeData[],
  params: { maxHours?: number; minHours?: number }
): TradeData[] {
  if (!params.maxHours && !params.minHours) return trades;
  
  return trades.filter(trade => {
    if (!trade.exitTime) return true; // Include open trades
    
    const durationHours = 
      (new Date(trade.exitTime).getTime() - new Date(trade.entryTime).getTime()) / (1000 * 60 * 60);
    
    if (params.maxHours !== undefined && durationHours > params.maxHours) return false;
    if (params.minHours !== undefined && durationHours < params.minHours) return false;
    return true;
  });
}

/** Apply market session filter */
export function applyMarketSessionFilter(
  trades: TradeData[],
  sessions: string[]
): TradeData[] {
  if (!sessions.length) return trades;
  
  return trades.filter(trade => {
    const entryHour = new Date(trade.entryTime).getUTCHours();
    
    return sessions.some(session => {
      const hours = SESSION_HOURS[session as keyof typeof SESSION_HOURS];
      if (!hours) return false;
      
      // Handle overnight sessions (Asia: 23-7)
      if (hours.start > hours.end) {
        return entryHour >= hours.start || entryHour < hours.end;
      }
      return entryHour >= hours.start && entryHour < hours.end;
    });
  });
}

/** Apply day filter - exclude trades on specific days */
export function applyDayFilter(trades: TradeData[], excludeDays: number[]): TradeData[] {
  if (!excludeDays.length) return trades;
  
  return trades.filter(trade => {
    const dayOfWeek = new Date(trade.entryTime).getDay();
    return !excludeDays.includes(dayOfWeek);
  });
}

/** Apply hour filter - exclude trades during specific hours (UTC) */
export function applyHourFilter(trades: TradeData[], excludeHours: number[]): TradeData[] {
  if (!excludeHours.length) return trades;
  
  return trades.filter(trade => {
    const hour = new Date(trade.entryTime).getUTCHours();
    return !excludeHours.includes(hour);
  });
}