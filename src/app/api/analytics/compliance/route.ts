import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { getComplianceStats, getDollarCostOfViolations } from '@/lib/services/tiltmeter.service';

// GET /api/analytics/compliance - Get compliance statistics
export async function GET(req: NextRequest) {
  return withAuth(req, async (session) => {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get('accountId') || undefined;
    const strategyId = searchParams.get('strategyId') || undefined;
    const periodDays = parseInt(searchParams.get('periodDays') || '30');

    const stats = await getComplianceStats(
      session.user.id,
      accountId,
      strategyId,
      periodDays
    );

    return NextResponse.json(stats);
  });
}
