import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import type { Session } from 'next-auth';
import { getBenchmarkComparison, getBenchmarkPrices } from '@/lib/services/benchmark.service';
import { ok, internalError } from '@/lib/api/responses';
import logger from '@/lib/logger';

type AuthedSession = Session & { user: { id: string } };

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
    if (pricesOnly && startDate && endDate) {
      const symbol = benchmarks[0] || 'SPY';
      const prices = await getBenchmarkPrices(
        symbol,
        new Date(startDate),
        new Date(endDate),
        normalizedStart ? parseFloat(normalizedStart) : 100
      );
      
      return ok({
        symbol,
        prices,
      });
    }

    const comparison = await getBenchmarkComparison(userId, accountId, benchmarks);
    
    return ok(comparison);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching benchmark data');
    return internalError();
  }
});
