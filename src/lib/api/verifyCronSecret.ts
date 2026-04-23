import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export function verifyCronSecret(request: NextRequest): NextResponse | null {
    const cronSecret = request.headers.get('x-cron-secret');
    const authHeader = request.headers.get('authorization');
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const provided = cronSecret ?? (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);

    if (!provided) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (provided.length !== expectedSecret.length ||
        !timingSafeEqual(Buffer.from(provided), Buffer.from(expectedSecret))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return null;
}
