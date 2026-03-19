import { NextRequest, NextResponse } from 'next/server';
import { runDailySnapshot } from '@/lib/cron/snapshot';

/**
 * Daily Snapshot Cron Job
 *
 * Can be triggered externally via GET or POST with the x-cron-secret header.
 * Periodic scheduling is delegated to an external HTTP cron service.
 */

async function handleCronRequest(request: NextRequest) {
    const cronSecret = request.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;

    // Fail-closed: require the secret to be configured and to match.
    if (!expectedSecret || cronSecret !== expectedSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await runDailySnapshot();

    return NextResponse.json({ success: true, timestamp: new Date().toISOString() });
}

export async function GET(request: NextRequest) {
    return handleCronRequest(request);
}

export async function POST(request: NextRequest) {
    return handleCronRequest(request);
}

export const runtime = 'nodejs';
