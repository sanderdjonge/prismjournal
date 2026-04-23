import { NextRequest, NextResponse } from 'next/server';
import { processScheduledScreenshots } from '@/lib/services/auto-screenshot.service';
import { verifyCronSecret } from '@/lib/api/verifyCronSecret';

export const dynamic = 'force-dynamic';

async function handleCronRequest(request: NextRequest) {
    const unauthorized = verifyCronSecret(request);
    if (unauthorized) return unauthorized;

    await processScheduledScreenshots();
    return NextResponse.json({ ok: true });
}

export { handleCronRequest as GET, handleCronRequest as POST };
