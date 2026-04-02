/**
 * Market-based filters for What-If Simulator
 * Volatility Filter, News Event Filter
 * 
 * These filters require external data sources:
 * - Volatility: Twelve Data API (ATR)
 * - News Events: MT5 Bridge calendar
 */

import { TradeData } from '../types';
import logger from '@/lib/logger';

/**
 * Volatility data structure
 */
export interface VolatilityData {
  symbol: string;
  atr: number;           // Average True Range value
  atrPercent: number;    // ATR as percentage of price
  timestamp: Date;
}

/**
 * News event structure
 */
export interface NewsEvent {
  id: string;
  title: string;
  currency: string;      // e.g., 'USD', 'EUR'
  impact: 'high' | 'medium' | 'low';
  datetime: Date;
  forecast?: string;
  previous?: string;
  actual?: string;
}

/**
 * Volatility filter parameters
 */
export interface VolatilityFilterParams {
  mode: 'avoid' | 'prefer';     // Avoid high vol or prefer high vol
  atrThreshold?: number;        // ATR threshold in pips
  atrPercentThreshold?: number; // ATR as % threshold
}

/**
 * News event filter parameters  
 */
export interface NewsEventFilterParams {
  avoidHighImpact: boolean;
  avoidMediumImpact: boolean;
  windowMinutes: number;        // Minutes before/after news to avoid
}

/**
 * Volatility data provider interface
 * To be implemented with actual API integration
 */
export type VolatilityDataProvider = (symbol: string, date: Date) => Promise<VolatilityData | null>;

/**
 * News events provider interface
 * To be implemented with MT5 Bridge integration
 */
export type NewsEventsProvider = (currencies: string[], startDate: Date, endDate: Date) => Promise<NewsEvent[]>;

/**
 * Apply volatility filter (synchronous with pre-loaded data)
 * Filters trades based on market volatility at entry time
 */
export function applyVolatilityFilterSync(
  trades: TradeData[],
  params: VolatilityFilterParams,
  volatilityData: Map<string, VolatilityData>  // Key: symbol-date
): TradeData[] {
  return trades.filter(trade => {
    if (!trade.entryTime) return true;
    
    const dateKey = `${trade.symbol}-${new Date(trade.entryTime).toDateString()}`;
    const volatility = volatilityData.get(dateKey);
    
    if (!volatility) return true; // Fail open
    
    const meetsThreshold = params.atrPercentThreshold
      ? volatility.atrPercent >= params.atrPercentThreshold
      : params.atrThreshold
        ? volatility.atr >= params.atrThreshold
        : true;
    
    if (params.mode === 'avoid' && meetsThreshold) return false;
    if (params.mode === 'prefer' && !meetsThreshold) return false;
    
    return true;
  });
}

/**
 * Apply volatility filter (async with provider)
 */
export async function applyVolatilityFilter(
  trades: TradeData[],
  params: VolatilityFilterParams,
  volatilityProvider?: VolatilityDataProvider
): Promise<TradeData[]> {
  if (!volatilityProvider) {
    logger.warn('[What-If] No volatility provider configured, returning all trades');
    return trades;
  }
  
  const result: TradeData[] = [];
  
  for (const trade of trades) {
    if (!trade.entryTime) {
      result.push(trade);
      continue;
    }
    
    try {
      const volatility = await volatilityProvider(trade.symbol, new Date(trade.entryTime));
      
      if (!volatility) {
        // If no data, include trade (fail open)
        result.push(trade);
        continue;
      }
      
      const meetsThreshold = params.atrPercentThreshold
        ? volatility.atrPercent >= params.atrPercentThreshold
        : params.atrThreshold
          ? volatility.atr >= params.atrThreshold
          : true;
      
      // Apply mode
      if (params.mode === 'avoid' && meetsThreshold) {
        // High volatility, skip
        continue;
      }
      if (params.mode === 'prefer' && !meetsThreshold) {
        // Low volatility, skip
        continue;
      }
      
      result.push(trade);
    } catch (error) {
      logger.warn({ symbol: trade.symbol, error }, '[What-If] Volatility lookup failed');
      result.push(trade); // Fail open
    }
  }
  
  return result;
}

/**
 * Check if a news event is relevant to a trade's symbol
 */
function isEventRelevantToSymbol(event: NewsEvent, symbol: string): boolean {
  // Normalize symbol (remove separators)
  const normalizedSymbol = symbol.replace(/[/_-]/g, '');
  
  // Extract currencies from pair (e.g., EURUSD -> EUR, USD)
  if (normalizedSymbol.length >= 6) {
    const baseCurrency = normalizedSymbol.substring(0, 3);
    const quoteCurrency = normalizedSymbol.substring(3, 6);
    
    // Event is relevant if it affects either currency in the pair
    return event.currency === baseCurrency || event.currency === quoteCurrency;
  }
  
  // If we can't parse the symbol, include the event (fail open)
  return true;
}

/**
 * Apply news event filter (synchronous with pre-loaded data)
 */
export function applyNewsEventFilterSync(
  trades: TradeData[],
  params: NewsEventFilterParams,
  newsEvents: NewsEvent[]
): TradeData[] {
  // Filter relevant events
  const relevantEvents = newsEvents.filter(event => 
    (params.avoidHighImpact && event.impact === 'high') ||
    (params.avoidMediumImpact && event.impact === 'medium')
  );
  
  return trades.filter(trade => {
    if (!trade.entryTime) return true;
    
    const entryTime = new Date(trade.entryTime).getTime();
    const windowMs = params.windowMinutes * 60 * 1000;
    
    for (const event of relevantEvents) {
      // Task 7: Check currency relevance
      if (!isEventRelevantToSymbol(event, trade.symbol)) {
        continue;
      }
      
      const eventTime = new Date(event.datetime).getTime();
      
      if (entryTime >= eventTime - windowMs && entryTime <= eventTime + windowMs) {
        return false;
      }
    }
    
    return true;
  });
}

/**
 * Apply news event filter (async with provider)
 */
export async function applyNewsEventFilter(
  trades: TradeData[],
  params: NewsEventFilterParams,
  newsProvider?: NewsEventsProvider
): Promise<TradeData[]> {
  if (!newsProvider) {
    logger.warn('[What-If] No news provider configured, returning all trades');
    return trades;
  }
  
  if (!params.avoidHighImpact && !params.avoidMediumImpact) {
    return trades; // No filtering needed
  }
  
  // Get date range from trades
  // Task 3: Fixed sort bug - was sorting by exitTime, should be entryTime
  const sortedTrades = [...trades]
    .filter(t => t.entryTime)
    .sort((a, b) => new Date(a.entryTime!).getTime() - new Date(b.entryTime!).getTime());
  
  if (sortedTrades.length === 0) return trades;
  
  const startDate = new Date(sortedTrades[0].entryTime!);
  startDate.setHours(startDate.getHours() - 24); // Buffer for timezone
  
  const endDate = new Date(sortedTrades[sortedTrades.length - 1].entryTime!);
  endDate.setHours(endDate.getHours() + 24);
  
  // Get currencies from trades
  const currencies = new Set<string>();
  for (const trade of sortedTrades) {
    // Extract currencies from pair (e.g., EURUSD -> EUR, USD)
    const symbol = trade.symbol.replace(/[/_-]/g, '');
    if (symbol.length >= 6) {
      currencies.add(symbol.substring(0, 3));
      currencies.add(symbol.substring(3, 6));
    }
  }
  
  // Fetch news events
  let newsEvents: NewsEvent[];
  try {
    newsEvents = await newsProvider(Array.from(currencies), startDate, endDate);
  } catch (error) {
    logger.warn({ error }, '[What-If] Failed to fetch news events');
    return trades; // Fail open
  }
  
  // Use sync version with fetched data
  return applyNewsEventFilterSync(trades, params, newsEvents);
}

/**
 * Get volatility data from Twelve Data API
 * Helper for building volatility data cache
 * 
 * PLACEHOLDER: Not implemented - requires Twelve Data API integration
 */
export async function fetchVolatilityFromTwelveData(
  symbol: string,
  date: Date,
  apiKey: string
): Promise<VolatilityData | null> {
  try {
    // PLACEHOLDER: This would call Twelve Data API
    // For now, return null
    // Implementation would use: https://api.twelvedata.com/atr
    logger.debug({ symbol, date: date.toDateString() }, '[What-If] Would fetch ATR (placeholder)');
    return null;
  } catch (error) {
    logger.error({ symbol, error }, '[What-If] Failed to fetch volatility');
    return null;
  }
}

/**
 * Get news events from MT5 Bridge
 * Helper for building news data cache
 * 
 * PLACEHOLDER: Not implemented - requires MT5 Bridge integration
 */
export async function fetchNewsFromMT5(
  currencies: string[],
  startDate: Date,
  endDate: Date,
  bridgeUrl: string
): Promise<NewsEvent[]> {
  try {
    // PLACEHOLDER: This would call MT5 Bridge calendar endpoint
    // For now, return empty array
    // Implementation would use: GET /api/calendar
    logger.debug(
      { currencies, startDate, endDate },
      '[What-If] Would fetch news from MT5 (placeholder)'
    );
    return [];
  } catch (error) {
    logger.error({ currencies, error }, '[What-If] Failed to fetch news');
    return [];
  }
}