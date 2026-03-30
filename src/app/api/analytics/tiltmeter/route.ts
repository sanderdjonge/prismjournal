import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { calculateTiltmeter, getTiltmeterHistory } from '@/lib/services/tiltmeter.service';

// GET /api/analytics/tiltmeter - Get tiltmeter score or history
export const GET = withAuth(async (req: NextRequest, _ctx, session) => {
  const { searchParams } = new URL(req.url);
  // Support both 'accountId' and 'account' for backwards compatibility
  const accountId = searchParams.get('accountId') || searchParams.get('account') || undefined;
  const strategyId = searchParams.get('strategyId') || undefined;
  const periodDays = parseInt(searchParams.get('periodDays') || '30');
  const history = searchParams.get('history') === 'true';
  const persist = searchParams.get('persist') === 'true';

  if (history) {
    // Parse startDate and endDate if provided
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const startDate = startDateStr ? new Date(startDateStr) : new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
    const endDate = endDateStr ? new Date(endDateStr) : new Date();
    
    const historyData = await getTiltmeterHistory(
      session.user.id,
      accountId,
      startDate,
      endDate
    );
    return NextResponse.json(historyData);
  }

  const score = await calculateTiltmeter(
    session.user.id,
    accountId,
    periodDays,
    persist, // Only persist when explicitly requested
    strategyId
  );
  return NextResponse.json(score);
});
