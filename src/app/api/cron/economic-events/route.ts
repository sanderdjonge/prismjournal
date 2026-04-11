import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { timingSafeEqual } from 'crypto';
import { fetchEconomicEvents } from '@/lib/cron/fetch-economic-events';

/**
 * Cron endpoint to sync economic events from TradingEconomics API
 * 
 * Requires CRON_SECRET env var. Set it in .env for local testing.
 * Trigger: POST with Authorization: Bearer <CRON_SECRET>
 * 
 * Runs daily to fetch next 30 days of high-impact events (FOMC, NFP, CPI, GDP)
 */

export async function POST() {
  const headersList = await headers();
  const authHeader = headersList.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || !authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const expected = `Bearer ${cronSecret}`;
  if (authHeader.length !== expected.length || !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await fetchEconomicEvents();

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Sync failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Economic events sync complete',
      upserted: result.upserted,
      deleted: result.deleted,
    });
  } catch (error) {
    console.error('[economic-events-cron] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
