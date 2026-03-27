import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { calculateTiltmeter, getTiltmeterHistory } from '@/lib/services/tiltmeter.service';

// GET /api/analytics/tiltmeter - Get current tiltmeter score or history
export async function GET(req: NextRequest) {
  return withAuth(req, async (session) => {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get('accountId') || undefined;
    const periodDays = parseInt(searchParams.get('periodDays') || '30');
    const history = searchParams.get('history') === 'true';
    const startDate = searchParams.get('startDate') 
      ? new Date(searchParams.get('startDate')!) 
      : undefined;
    const endDate = searchParams.get('endDate') 
      ? new Date(searchParams.get('endDate')!) 
      : undefined;

    if (history) {
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
}
