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

    // Use timingSafeEqual exclusively — the previous length check leaked timing info
    // by fast-rejecting wrong-length inputs. Pad shorter value to match longer so
    // timingSafeEqual always compares buffers of equal length.
    const providedBuf = Buffer.from(provided);
    const expectedBuf = Buffer.from(expectedSecret);
    const maxLen = Math.max(providedBuf.length, expectedBuf.length);

    const paddedProvided = Buffer.alloc(maxLen);
    providedBuf.copy(paddedProvided);
    const paddedExpected = Buffer.alloc(maxLen);
    expectedBuf.copy(paddedExpected);

    if (!timingSafeEqual(paddedProvided, paddedExpected)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return null;
}
