'use client';

import { useQuery } from '@tanstack/react-query';

export type EconomicEvent = {
    id: string;
    name: string;
    date: string;
    time: string | null;
    currency: string;
    impact: 'LOW' | 'MEDIUM' | 'HIGH';
    forecast: string | null;
    actual: string | null;
    previous: string | null;
    source: string | null;
};

type EconomicEventsParams = {
    startDate?: string;
    endDate?: string;
    currency?: string;
    impact?: string;
};

export function useEconomicEvents(params: EconomicEventsParams = {}) {
    const searchParams = new URLSearchParams();
    if (params.startDate) searchParams.set('startDate', params.startDate);
    if (params.endDate) searchParams.set('endDate', params.endDate);
    if (params.currency) searchParams.set('currency', params.currency);
    if (params.impact) searchParams.set('impact', params.impact);

    const queryString = searchParams.toString();
    const url = `/api/economic-events${queryString ? `?${queryString}` : ''}`;

    return useQuery({
        queryKey: ['economic-events', params],
        queryFn: async () => {
            const res = await fetch(url);
            if (!res.ok) throw new Error('Failed to fetch economic events');
            return res.json() as Promise<EconomicEvent[]>;
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

export function useEventsByDate(events: EconomicEvent[] | undefined): Map<string, EconomicEvent[]> {
    const byDate = new Map<string, EconomicEvent[]>();
    
    if (!events) return byDate;
    
    for (const event of events) {
        const date = event.date.split('T')[0]; // Handle ISO date strings
        const existing = byDate.get(date) || [];
        existing.push(event);
        byDate.set(date, existing);
    }
    
    return byDate;
}