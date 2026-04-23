import { useQuery } from '@tanstack/react-query';
import type { DailyCalendarDay } from '@/app/api/analytics/daily-calendar/route';

interface DailyCalendarFilters {
    accountId?: string;
    from?: string;
    to?: string;
}

async function fetchDailyCalendar(filters: DailyCalendarFilters = {}) {
    const params = new URLSearchParams();
    if (filters.accountId) params.set('accountId', filters.accountId);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);

    const res = await fetch(`/api/analytics/daily-calendar?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch daily calendar');
    return res.json() as Promise<{ days: DailyCalendarDay[] }>;
}

export function useDailyCalendar(filters: DailyCalendarFilters = {}) {
    return useQuery({
        queryKey: ['daily-calendar', filters],
        queryFn: () => fetchDailyCalendar(filters),
        staleTime: 5 * 60 * 1000,
    });
}
