'use client';

import { cn } from '@/lib/cn';

interface EconomicEvent {
  id: string;
  name: string;
  currency: string;
  date: string;
  time: string | null;
  impact: string;
  actual?: string | null;
  forecast?: string | null;
  previous?: string | null;
}

const CURRENCY_COLORS: Record<string, string> = {
  USD: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  EUR: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  GBP: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  JPY: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
};

const SHORT_NAMES: Record<string, string> = {
  'Federal Interest Rate Decision': 'FOMC',
  'Fed Interest Rate Decision': 'FOMC',
  'FOMC Meeting': 'FOMC',
  'Non Farm Payrolls': 'NFP',
  'Non-Farm Payrolls': 'NFP',
  'Consumer Price Index': 'CPI',
  'CPI': 'CPI',
  'CPI Flash Estimate': 'CPI',
  'Gross Domestic Product': 'GDP',
  'GDP': 'GDP',
  'GDP Growth Rate': 'GDP',
  'ECB Interest Rate Decision': 'ECB',
  'ECB Main Refinancing Rate': 'ECB',
  'BOE Interest Rate Decision': 'BOE',
  'BOE Official Bank Rate': 'BOE',
  'BOJ Interest Rate Decision': 'BOJ',
  'BOJ Policy Rate': 'BOJ',
  'ADP Non-Farm Employment Change': 'ADP',
  'Unemployment Rate': 'UNEMP',
  'Initial Jobless Claims': 'JOBS',
  'Retail Sales': 'RETAIL',
  'ISM Manufacturing PMI': 'ISM',
  'ISM Services PMI': 'ISM',
};

export function EventBadge({ event }: { event: EconomicEvent }) {
  const displayName = SHORT_NAMES[event.name] || event.name.slice(0, 8);
  const colorClass = CURRENCY_COLORS[event.currency] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';

  return (
    <span
      className={cn(
        'text-[8px] font-black px-1 py-0.5 rounded border',
        colorClass
      )}
      title={`${event.name} (${event.currency})${event.time ? ` - ${event.time}` : ''}`}
    >
      {displayName}
    </span>
  );
}

const DOT_COLORS: Record<string, string> = {
  USD: 'bg-blue-400',
  EUR: 'bg-purple-400',
  GBP: 'bg-cyan-400',
};

export function EventDot({ currency }: { currency: string }) {
  return (
    <span
      className={cn('inline-block w-1 h-1 rounded-full', DOT_COLORS[currency] || 'bg-orange-400')}
      title={`${currency} event`}
    />
  );
}
