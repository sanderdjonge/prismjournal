import { NextRequest, NextResponse } from 'next/server';
import { processScheduledScreenshots } from '@/lib/services/auto-screenshot.service';

export const dynamic = 'force-dynamic';

async function handleCronRequest(request: NextRequest) {
    const cronSecret = request.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret || cronSecret !== expectedSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await processScheduledScreenshots();
    return NextResponse.json({ ok: true });
}

export { handleCronRequest as GET, handleCronRequest as POST };
