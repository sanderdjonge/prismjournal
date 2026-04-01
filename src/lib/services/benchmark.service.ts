/**
 * Benchmark Service - Phase 24
 * Fetches SPY/QQQ benchmark data and compares with user performance
 */

import prisma from '@/lib/prisma';
import logger from '@/lib/logger';


interface BenchmarkPoint {
  date: Date;
  price: number;
  equity: number; // What $1 invested would be worth
}

export interface BenchmarkData {
  symbol: string;
  startingPrice: number;
  currentPrice: number;
  returnPercent: number;
  equityCurve: BenchmarkPoint[];
}

export interface BenchmarkComparison {
  account: {
    startingBalance: number;
    currentBalance: number;
    returnPercent: number;
    equityCurve: Array<{ date: Date; equity: number }>;
  };
  benchmarks: {
    SPY?: BenchmarkData;
    QQQ?: BenchmarkData;
  };
  comparison: {
    outperformingSPY: boolean | null;
    outperformingQQQ: boolean | null;
    spyDifferencePercent: number | null;
    qqqDifferencePercent: number | null;
  };
}

// Cache for benchmark data (15 minutes)
const benchmarkCache = new Map<string, { data: BenchmarkData; timestamp: number }>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

/**
 * Fetch historical prices from Yahoo Finance for a symbol
 */
async function fetchYahooPrices(
  symbol: string,
  startDate: Date,
  endDate: Date
): Promise<Array<{ date: Date; close: number }>> {
  const period1 = Math.floor(startDate.getTime() / 1000);
  const period2 = Math.floor(endDate.getTime() / 1000);

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&period1=${period1}&period2=${period2}`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Yahoo Finance HTTP ${res.status} for ${symbol}`);
  }

  const data = await res.json() as {
    chart: {
      result?: Array<{
        timestamp?: number[];
        indicators?: { quote?: Array<{ close?: (number | null)[] }> };
      }>;
      error?: { description?: string } | null;
    };
  };

  if (data.chart.error) {
    throw new Error(`Yahoo Finance error: ${data.chart.error.description}`);
  }

  const result = data.chart.result?.[0];
  if (!result?.timestamp || !result.indicators?.quote?.[0]?.close) {
    throw new Error(`No data from Yahoo Finance for ${symbol}`);
  }

  const timestamps = result.timestamp;
  const closes = result.indicators.quote[0].close;
  const prices: Array<{ date: Date; close: number }> = [];

  for (let i = 0; i < timestamps.length; i++) {
    const close = closes[i];
    if (close != null) {
      prices.push({ date: new Date(timestamps[i] * 1000), close });
    }
  }

  return prices;
}

/**
 * Get benchmark data for a symbol (with caching)
 */
async function getBenchmarkData(
  symbol: string,
  startDate: Date,
  endDate: Date
): Promise<BenchmarkData> {
  const cacheKey = `${symbol}-${startDate.toISOString().split('T')[0]}-${endDate.toISOString().split('T')[0]}`;
  
  // Check cache
  const cached = benchmarkCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  // Fetch from Yahoo Finance
  const prices = await fetchYahooPrices(symbol, startDate, endDate);
  
  if (prices.length === 0) {
    throw new Error(`No prices for ${symbol}`);
  }
  
  const startingPrice = prices[0].close;
  const currentPrice = prices[prices.length - 1].close;
  const returnPercent = ((currentPrice - startingPrice) / startingPrice) * 100;
  
  // Build equity curve (what $1 invested would be worth)
  const equityCurve: BenchmarkPoint[] = prices.map((p) => ({
    date: p.date,
    price: p.close,
    equity: p.close / startingPrice,
  }));
  
  const data: BenchmarkData = {
    symbol,
    startingPrice,
    currentPrice,
    returnPercent,
    equityCurve,
  };
  
  // Cache it
  benchmarkCache.set(cacheKey, { data, timestamp: Date.now() });
  
  return data;
}

/**
 * Get user's equity curve from daily snapshots
 */
async function getUserEquityCurve(
  userId: string,
  accountId?: string
): Promise<Array<{ date: Date; equity: number }>> {
  const snapshots = await prisma.dailyAccountSnapshot.findMany({
    where: {
      account: { userId },
      ...(accountId && { accountId }),
    },
    orderBy: { snapshotDate: 'asc' },
    select: {
      snapshotDate: true,
      endingBalance: true,
      endingEquity: true,
    },
  });
  
  if (snapshots.length === 0) {
    return [];
  }
  
  return snapshots.map((s) => ({
    date: s.snapshotDate,
    equity: s.endingEquity ?? s.endingBalance,
  }));
}

/**
 * Calculate benchmark comparison for user's account
 */
export async function getBenchmarkComparison(
  userId: string,
  accountId?: string,
  benchmarks: ('SPY' | 'QQQ')[] = ['SPY']
): Promise<BenchmarkComparison> {
  // Get user's equity curve
  const userEquity = await getUserEquityCurve(userId, accountId);
  
  if (userEquity.length === 0) {
    throw new Error('No equity data available for comparison');
  }
  
  const startDate = userEquity[0].date;
  const endDate = userEquity[userEquity.length - 1].date;
  const startingBalance = userEquity[0].equity;
  const currentBalance = userEquity[userEquity.length - 1].equity;
  const userReturn = startingBalance > 0
    ? ((currentBalance - startingBalance) / startingBalance) * 100
    : 0;
  
  // Fetch benchmark data
  const benchmarkData: { SPY?: BenchmarkData; QQQ?: BenchmarkData } = {};
  
  const benchmarkPromises = benchmarks.map(async (symbol) => {
    try {
      const data = await getBenchmarkData(symbol, startDate, endDate);
      return { symbol, data };
    } catch (error) {
      logger.warn({ symbol, error }, '[benchmark] Failed to fetch benchmark data');
      return null;
    }
  });
  
  const results = await Promise.all(benchmarkPromises);
  
  for (const result of results) {
    if (result) {
      benchmarkData[result.symbol as 'SPY' | 'QQQ'] = result.data;
    }
  }
  
  // Calculate comparison
  const comparison: BenchmarkComparison['comparison'] = {
    outperformingSPY: null,
    outperformingQQQ: null,
    spyDifferencePercent: null,
    qqqDifferencePercent: null,
  };
  
  if (benchmarkData.SPY) {
    comparison.outperformingSPY = userReturn > benchmarkData.SPY.returnPercent;
    comparison.spyDifferencePercent = userReturn - benchmarkData.SPY.returnPercent;
  }
  
  if (benchmarkData.QQQ) {
    comparison.outperformingQQQ = userReturn > benchmarkData.QQQ.returnPercent;
    comparison.qqqDifferencePercent = userReturn - benchmarkData.QQQ.returnPercent;
  }
  
  return {
    account: {
      startingBalance,
      currentBalance,
      returnPercent: userReturn,
      equityCurve: userEquity,
    },
    benchmarks: benchmarkData,
    comparison,
  };
}

/**
 * Get benchmark prices for a date range (for chart overlay)
 */
export async function getBenchmarkPrices(
  symbol: string,
  startDate: Date,
  endDate: Date,
  normalizedStartValue: number = 100
): Promise<Array<{ date: Date; value: number }>> {
  const data = await getBenchmarkData(symbol, startDate, endDate);
  
  // Normalize to start at the given value
  return data.equityCurve.map((point) => ({
    date: point.date,
    value: point.equity * normalizedStartValue,
  }));
}