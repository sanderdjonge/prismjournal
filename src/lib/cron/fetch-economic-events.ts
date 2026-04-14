import prisma from '@/lib/prisma';
import logger from '@/lib/logger';
import { formatDateKey } from '@/lib/formatTime';

const TRADING_ECONOMICS_API = 'https://api.tradingeconomics.com/calendar';

const COUNTRIES = [
  'united states',
  'euro area',
  'united kingdom',
  'japan'
];

const CURRENCY_MAP: Record<string, string> = {
  'united states': 'USD',
  'euro area': 'EUR',
  'united kingdom': 'GBP',
  'japan': 'JPY',
};

interface TradingEconomicsEvent {
  CalendarId: string;
  Date: string;
  Country: string;
  Event: string;
  Importance: string;
  Actual?: string;
  Forecast?: string;
  Previous?: string;
}

export async function fetchEconomicEvents() {
  const apiKey = process.env.TRADING_ECONOMICS_API_KEY;

  if (!apiKey) {
    logger.warn('TRADING_ECONOMICS_API_KEY not configured, skipping economic events sync');
    return { success: false, error: 'API key not configured' };
  }

  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 30);

  try {
    const params = new URLSearchParams({
      country: COUNTRIES.join(','),
      importance: 'High',
      start_date: formatDateKey(startDate),
      end_date: formatDateKey(endDate),
      c: apiKey,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    let response: Response;
    try {
      response = await fetch(`${TRADING_ECONOMICS_API}?${params}`, {
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = (await response.json()) as TradingEconomicsEvent[];

    if (!Array.isArray(data)) {
      throw new Error('API returned non-array response');
    }

    // Validate and batch upsert events — use allSettled so one bad record
    // doesn't abort the entire sync
    const upserts = data
      .filter(event => event.CalendarId && event.Date && !isNaN(new Date(event.Date).getTime()))
      .map(event => {
        const currency = CURRENCY_MAP[event.Country?.toLowerCase()] || 'USD';
        const eventDate = new Date(event.Date);
        const timeStr = eventDate.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          timeZoneName: 'short'
        });

        return prisma.economicEvent.upsert({
          where: { externalId: event.CalendarId },
          create: {
            externalId: event.CalendarId,
            name: event.Event,
            currency,
            date: eventDate,
            time: timeStr,
            impact: 'HIGH',
            actual: event.Actual || null,
            forecast: event.Forecast || null,
            previous: event.Previous || null,
            source: 'TradingEconomics',
          },
          update: {
            actual: event.Actual || null,
            forecast: event.Forecast || null,
            previous: event.Previous || null,
          },
        });
      });

    const results = await Promise.allSettled(upserts);
    const upserted = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    if (failed > 0) {
      logger.warn(`${failed} event(s) failed to upsert`);
    }

    // Delete old events (older than 7 days)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);

    const { count: deleted } = await prisma.economicEvent.deleteMany({
      where: {
        date: { lt: cutoffDate },
      },
    });

    logger.info(`Economic events sync complete: ${upserted} upserted, ${deleted} deleted`);

    return { success: true, upserted, deleted };
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch economic events');
    return { success: false, error: 'Fetch failed' };
  }
}
