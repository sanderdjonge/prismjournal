import { headers } from 'next/headers';
import { timingSafeEqual } from 'crypto';
import { fetchEconomicEvents } from '@/lib/cron/fetch-economic-events';
import { ok, unauthorized, internalError } from '@/lib/api/responses';
import logger from '@/lib/logger';

export async function POST() {
  const headersList = await headers();
  const authHeader = headersList.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || !authHeader) {
    return unauthorized();
  }

  const expected = `Bearer ${cronSecret}`;
  if (authHeader.length !== expected.length || !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))) {
    return unauthorized();
  }

  try {
    const result = await fetchEconomicEvents();

    if (!result.success) {
      return internalError();
    }

    return ok({ message: 'Economic events sync complete', upserted: result.upserted, deleted: result.deleted });
  } catch (error) {
    logger.error({ err: error }, '[economic-events-cron] Error');
    return internalError();
  }
}

export const runtime = 'nodejs';
