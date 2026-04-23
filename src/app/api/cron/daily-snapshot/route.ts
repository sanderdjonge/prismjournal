import { NextRequest, NextResponse } from 'next/server';
import { runDailySnapshot } from '@/lib/cron/snapshot';
import { verifyCronSecret } from '@/lib/api/verifyCronSecret';

async function handleCronRequest(request: NextRequest) {
    const unauthorized = verifyCronSecret(request);
    if (unauthorized) return unauthorized;

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
