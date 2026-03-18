import { NextRequest, NextResponse } from 'next/server';
import { runDailySnapshot } from '@/lib/cron/snapshot';

/**
 * Daily Snapshot Cron Job
 *
 * Called automatically every hour by the internal scheduler (src/instrumentation.ts).
 * Can also be triggered externally with the x-cron-secret header.
 */

export async function GET(request: NextRequest) {
    const cronSecret = request.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;

    // Fail-closed: require the secret to be configured and to match.
    if (!expectedSecret || cronSecret !== expectedSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await runDailySnapshot();

    return NextResponse.json({ success: true, timestamp: new Date().toISOString() });
}

export const runtime = 'nodejs';
