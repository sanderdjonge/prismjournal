/**
 * React Query hook for benchmark comparison data
 */

import { useQuery } from '@tanstack/react-query';

interface BenchmarkPoint {
  date: string;
  price: number;
  equity: number;
}

interface BenchmarkData {
  symbol: string;
  startingPrice: number;
  currentPrice: number;
  returnPercent: number;
  equityCurve: BenchmarkPoint[];
}

interface BenchmarkComparison {
  account: {
    startingBalance: number;
    currentBalance: number;
    returnPercent: number;
    equityCurve: Array<{ date: string; equity: number }>;
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

interface UseBenchmarkOptions {
  accountId?: string;
  benchmarks?: ('SPY' | 'QQQ')[];
  enabled?: boolean;
}

export function useBenchmark(options: UseBenchmarkOptions = {}) {
  const { accountId, benchmarks = ['SPY'], enabled = true } = options;

  return useQuery<BenchmarkComparison>({
    queryKey: ['benchmark', accountId, benchmarks],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (accountId) params.set('accountId', accountId);
      if (benchmarks.length > 0) params.set('benchmarks', benchmarks.join(','));

      const res = await fetch(`/api/analytics/benchmark?${params.toString()}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to fetch benchmark data');
      }
      return res.json();
    },
    enabled,
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}

interface UseBenchmarkPricesOptions {
  symbol: 'SPY' | 'QQQ';
  startDate: Date;
  endDate: Date;
  normalizedStart?: number;
  enabled?: boolean;
}

export function useBenchmarkPrices(options: UseBenchmarkPricesOptions) {
  const { symbol, startDate, endDate, normalizedStart = 100, enabled = true } = options;

  return useQuery<{
    symbol: string;
    prices: Array<{ date: string; value: number }>;
  }>({
    queryKey: ['benchmark-prices', symbol, startDate.toISOString(), endDate.toISOString(), normalizedStart],
    queryFn: async () => {
      const params = new URLSearchParams({
        pricesOnly: 'true',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        normalizedStart: normalizedStart.toString(),
      });

      const res = await fetch(`/api/analytics/benchmark?${params.toString()}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to fetch benchmark prices');
      }
      return res.json();
    },
    enabled,
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}