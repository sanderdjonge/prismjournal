import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { calculateTiltmeter, getTiltmeterHistory } from '@/lib/services/tiltmeter.service';

// GET /api/analytics/tiltmeter - Get tiltmeter score or history
export const GET = withAuth(async (req: NextRequest, _ctx, session) => {
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get('accountId') || undefined;
  const periodDays = parseInt(searchParams.get('periodDays') || '30');
  const history = searchParams.get('history') === 'true';

  if (history) {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - periodDays * 24 * 60 * 60 * 1000);
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
    periodDays
  );
  return NextResponse.json(score);
});
