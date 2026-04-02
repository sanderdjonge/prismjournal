/**
 * usePeriodComparison Hook
 *
 * Fetches comparison data between two periods for analytics.
 * Supports presets like "this week vs last week" or custom date ranges.
 */

import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import isoWeek from 'dayjs/plugin/isoWeek';

// Extend dayjs with plugins
dayjs.extend(weekOfYear);
dayjs.extend(isoWeek);

export type ComparisonPreset = 
    | 'today_vs_yesterday'
    | 'this_week_vs_last_week'
    | 'this_month_vs_last_month'
    | 'this_year_vs_last_year'
    | 'custom';

export interface PeriodRange {
    start: Date;
    end: Date;
    label: string;
}

export interface ComparisonMetrics {
    profitFactor: number | null;
    winRate: number | null;
    totalPnl: number | null;
    totalTrades: number | null;
    avgRR: number | null;
    expectancy: number | null;
    bestTrade: number | null;
    worstTrade: number | null;
    avgTrade: number | null;
}

export interface PeriodComparisonResult {
    period1: PeriodRange;
    period2: PeriodRange;
    metrics1: ComparisonMetrics;
    metrics2: ComparisonMetrics;
    delta: {
        profitFactor: number | null;
        winRate: number | null;
        totalPnl: number | null;
        totalTrades: number | null;
        avgRR: number | null;
        expectancy: number | null;
    };
}

/**
 * Get date ranges for comparison presets
 */
export function getComparisonRanges(preset: ComparisonPreset, customRange?: { start1: Date; end1: Date; start2: Date; end2: Date }): {
    period1: PeriodRange;
    period2: PeriodRange;
} {
    const now = dayjs();
    const today = now.startOf('day');

    switch (preset) {
        case 'today_vs_yesterday': {
            const yesterday = today.subtract(1, 'day');
            return {
                period1: { start: today.toDate(), end: now.endOf('day').toDate(), label: 'Today' },
                period2: { start: yesterday.toDate(), end: yesterday.endOf('day').toDate(), label: 'Yesterday' },
            };
        }
        case 'this_week_vs_last_week': {
            const startOfThisWeek = today.startOf('isoWeek');
            const endOfThisWeek = today.endOf('isoWeek');
            const startOfLastWeek = startOfThisWeek.subtract(1, 'week');
            const endOfLastWeek = startOfLastWeek.endOf('isoWeek');
            return {
                period1: { start: startOfThisWeek.toDate(), end: endOfThisWeek.toDate(), label: 'This Week' },
                period2: { start: startOfLastWeek.toDate(), end: endOfLastWeek.toDate(), label: 'Last Week' },
            };
        }
        case 'this_month_vs_last_month': {
            const startOfThisMonth = today.startOf('month');
            const endOfThisMonth = today.endOf('month');
            const startOfLastMonth = startOfThisMonth.subtract(1, 'month');
            const endOfLastMonth = startOfLastMonth.endOf('month');
            return {
                period1: { start: startOfThisMonth.toDate(), end: endOfThisMonth.toDate(), label: 'This Month' },
                period2: { start: startOfLastMonth.toDate(), end: endOfLastMonth.toDate(), label: 'Last Month' },
            };
        }
        case 'this_year_vs_last_year': {
            const startOfThisYear = today.startOf('year');
            const endOfThisYear = today.endOf('year');
            const startOfLastYear = startOfThisYear.subtract(1, 'year');
            const endOfLastYear = startOfLastYear.endOf('year');
            return {
                period1: { start: startOfThisYear.toDate(), end: endOfThisYear.toDate(), label: 'This Year' },
                period2: { start: startOfLastYear.toDate(), end: endOfLastYear.toDate(), label: 'Last Year' },
            };
        }
        case 'custom': {
            if (!customRange) {
                throw new Error('Custom preset requires customRange parameter');
            }
            const p1Start = dayjs(customRange.start1);
            const p1End = dayjs(customRange.end1);
            const p2Start = dayjs(customRange.start2);
            const p2End = dayjs(customRange.end2);
            return {
                period1: { 
                    start: customRange.start1, 
                    end: customRange.end1, 
                    label: `${p1Start.format('MMM D')} - ${p1End.format('MMM D')}`,
                },
                period2: { 
                    start: customRange.start2, 
                    end: customRange.end2, 
                    label: `${p2Start.format('MMM D')} - ${p2End.format('MMM D')}`,
                },
            };
        }
    }
}

/**
 * Fetch period comparison data
 */
async function fetchPeriodComparison(
    accountId: string | null,
    period1: PeriodRange,
    period2: PeriodRange
): Promise<PeriodComparisonResult> {
    const params = new URLSearchParams({
        period1Start: period1.start.toISOString(),
        period1End: period1.end.toISOString(),
        period2Start: period2.start.toISOString(),
        period2End: period2.end.toISOString(),
    });
    if (accountId) params.append('accountId', accountId);

    const res = await fetch(`/api/analytics/compare?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch comparison data');
    return res.json();
}

/**
 * Hook for fetching period comparison analytics
 */
export function usePeriodComparison(
    accountId: string | null,
    preset: ComparisonPreset = 'this_week_vs_last_week',
    customRange?: { start1: Date; end1: Date; start2: Date; end2: Date },
    options?: { enabled?: boolean }
) {
    const { enabled = true } = options ?? {};

    // Get date ranges based on preset
    const ranges = getComparisonRanges(preset, customRange);

    return useQuery({
        queryKey: ['periodComparison', accountId, preset, customRange],
        queryFn: () => fetchPeriodComparison(accountId, ranges.period1, ranges.period2),
        enabled,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}