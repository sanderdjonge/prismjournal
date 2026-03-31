/**
 * Benchmark Comparison API - Phase 24
 * Compares user performance against SPY/QQQ benchmarks
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import type { Session } from 'next-auth';
import { getBenchmarkComparison, getBenchmarkPrices } from '@/lib/services/benchmark.service';

type AuthedSession = Session & { user: { id: string } };

// GET /api/analytics/benchmark - Get benchmark comparison data
export const GET = withAuth(async (
  request: NextRequest,
  _ctx: Record<string, unknown>,
  session: AuthedSession
) => {
  const userId = session.user.id;
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId') ?? undefined;
  const benchmarks = (searchParams.get('benchmarks')?.split(',').filter(Boolean) as ('SPY' | 'QQQ')[]) || ['SPY'];
  const pricesOnly = searchParams.get('pricesOnly') === 'true';
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const normalizedStart = searchParams.get('normalizedStart');

  try {
    // If only prices requested (for chart overlay)
    if (pricesOnly && startDate && endDate) {
      const symbol = benchmarks[0] || 'SPY';
      const prices = await getBenchmarkPrices(
        symbol,
        new Date(startDate),
        new Date(endDate),
        normalizedStart ? parseFloat(normalizedStart) : 100
      );
      
      return NextResponse.json({
        symbol,
        prices,
      });
    }

    // Full comparison
    const comparison = await getBenchmarkComparison(userId, accountId, benchmarks);
    
    return NextResponse.json(comparison);
  } catch (error) {
    console.error('Error fetching benchmark data:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch benchmark data';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
});