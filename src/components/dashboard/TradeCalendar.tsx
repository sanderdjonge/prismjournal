'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import dayjs from 'dayjs';
import { useCurrency } from '@/lib/currency';
import { cn } from '@/lib/cn';
import { formatPercent } from '@/lib/formatNumber';
import { useEconomicEvents, useEventsByDate, type EconomicEvent } from '@/hooks/useEconomicEvents';
import { EventBadge, EventDot } from './EventBadge';

type TradeDay = {
    date: string;
    pnl: number;
    trades: number;
    wins: number;
    losses: number;
    avgRR?: number | null;
    events?: EconomicEvent[];
};

type TradeCalendarProps = {
    data: TradeDay[];
    accountBalance?: number;
};

type DayCell = {
    date: number;
    pnl: number;
    trades: number;
    wins: number;
    losses: number;
    avgRR?: number | null;
    events: EconomicEvent[];
} | null;

type Week = DayCell[];

type MiniMonthProps = {
    year: number;
    month: number; // 0-indexed
    dataByDate: Map<string, TradeDay>;
    eventsByDate: Map<string, EconomicEvent[]>;
    getMetricValue: (day: TradeDay) => number | null;
    formatMetricValue: (val: number | null) => string;
    getYearDayBg: (val: number | null) => React.CSSProperties;
    onDayClick: (year: number, month: number) => void;
};

// React.memo prevents all 12 instances re-rendering on unrelated TradeCalendar state changes
const MiniMonth = React.memo(function MiniMonth({ year, month, dataByDate, eventsByDate, getMetricValue, formatMetricValue, getYearDayBg, onDayClick }: MiniMonthProps) {
    const d = dayjs().year(year).month(month).startOf('month');
    const daysInMonth = d.daysInMonth();
    const startDay = d.day(); // 0=Sun

    const cells: (number | null)[] = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let i = 1; i <= daysInMonth; i++) cells.push(i);
    while (cells.length % 7 !== 0) cells.push(null);

    return (
        <div className="flex flex-col gap-0.5">
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 text-center mb-1">
                {d.format('MMMM')}
            </div>
            <div className="grid grid-cols-7 gap-px mb-0.5">
                {['S','M','T','W','T','F','S'].map((l, i) => (
                    <div key={i} className="text-[9px] text-gray-400 font-black text-center">{l}</div>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-px">
                {cells.map((day, i) => {
                    if (day === null) return <div key={i} className="aspect-square" />;
                    const dateStr = d.date(day).format('YYYY-MM-DD');
                    const tradeDay = dataByDate.get(dateStr);
                    const dayEvents = eventsByDate.get(dateStr) || [];
                    const metricVal = tradeDay ? getMetricValue(tradeDay) : null;
                    const hasData = tradeDay && tradeDay.trades > 0;
                    const hasEvents = dayEvents.length > 0;
                    const tooltipText = hasData
                        ? `${tradeDay!.trades} trade${tradeDay!.trades > 1 ? 's' : ''} · ${formatMetricValue(metricVal)}`
                        : hasEvents
                            ? `${dayEvents.length} event${dayEvents.length > 1 ? 's' : ''}`
                            : undefined;

                    return (
                        <div
                            key={i}
                            onClick={() => onDayClick(year, month)}
                            className="aspect-square rounded-sm flex items-center justify-center cursor-pointer hover:opacity-75 transition-opacity relative"
                            style={hasData ? getYearDayBg(metricVal) : { backgroundColor: 'rgba(255,255,255,0.03)' }}
                            title={tooltipText}
                        >
                            <span className="text-[9px] font-bold text-gray-400 leading-none">{day}</span>
                            {hasEvents && !hasData && (
                                <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                                    {dayEvents.slice(0, 3).map((e, idx) => (
                                        <EventDot key={idx} currency={e.currency} />
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
});

export default function TradeCalendar({ data, accountBalance }: TradeCalendarProps) {
    const { symbol } = useCurrency();
    const now = dayjs();
    const [viewMode, setViewMode] = useState<'month' | 'year'>('month');
    const [viewYear, setViewYear] = useState(now.year());
    const [viewMonth, setViewMonth] = useState(now.month()); // 0-indexed
    const [metric, setMetric] = useState<'pnl' | 'pct' | 'rr'>('pnl');
    const [metricOpen, setMetricOpen] = useState(false);
    const metricDropdownRef = useRef<HTMLDivElement>(null);

    // Fetch economic events for current view period
    const viewDate = dayjs().year(viewYear).month(viewMonth).startOf('month');
    const daysInMonth = viewDate.daysInMonth();
    const startDay = viewDate.day();

    // Get date range for events fetching
    const eventsStartDate = viewDate.startOf('month').format('YYYY-MM-DD');
    const eventsEndDate = viewDate.endOf('month').format('YYYY-MM-DD');
    const yearEventsStartDate = dayjs().year(viewYear).month(0).date(1).format('YYYY-MM-DD');
    const yearEventsEndDate = dayjs().year(viewYear).month(11).date(31).format('YYYY-MM-DD');

    const { data: monthEvents } = useEconomicEvents({
        startDate: eventsStartDate,
        endDate: eventsEndDate,
        impact: 'HIGH',
    });

    const { data: yearEvents } = useEconomicEvents({
        startDate: yearEventsStartDate,
        endDate: yearEventsEndDate,
        impact: 'HIGH',
    });

    const monthEventsByDate = useEventsByDate(monthEvents);
    const yearEventsByDate = useEventsByDate(yearEvents);

    // Navigation helpers
    const prevMonth = () => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
        else setViewMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
        else setViewMonth(m => m + 1);
    };
    const prevYear = () => setViewYear(y => y - 1);
    const nextYear = () => setViewYear(y => y + 1);

    // Click-outside handler for metric dropdown
    useEffect(() => {
        if (!metricOpen) return;
        const handleMouseDown = (e: MouseEvent) => {
            if (metricDropdownRef.current && !metricDropdownRef.current.contains(e.target as Node)) {
                setMetricOpen(false);
            }
        };
        document.addEventListener('mousedown', handleMouseDown);
        return () => document.removeEventListener('mousedown', handleMouseDown);
    }, [metricOpen]);

    // Metric value helpers
    const getMetricValue = useCallback((day: { pnl: number; trades: number; avgRR?: number | null }): number | null => {
        if (day.trades === 0) return null;
        if (metric === 'pnl') return day.pnl;
        if (metric === 'pct') {
            if (!accountBalance || accountBalance === 0) return null;
            return (day.pnl / Math.abs(accountBalance)) * 100;
        }
        if (metric === 'rr') return day.avgRR ?? null;
        return null;
    }, [metric, accountBalance]);

    const formatMetricValue = useCallback((val: number | null): string => {
        if (val === null) return '';
        if (metric === 'pnl') return `${val >= 0 ? '+' : ''}${symbol}${Math.abs(val).toFixed(0)}`;
        if (metric === 'pct') return `${val >= 0 ? '+' : ''}${formatPercent(val, 1)}`;
        if (metric === 'rr') return `${val.toFixed(1)}R`;
        return '';
    }, [metric, symbol]);

    const dataByDate = useMemo(() => {
        const map = new Map<string, TradeDay>();
        data.forEach(d => map.set(d.date, d));
        return map;
    }, [data]);

    // Build flat array of cells (nulls for padding + day objects)
    const flatCells: DayCell[] = [];
    for (let i = 0; i < startDay; i++) flatCells.push(null);
    for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = viewDate.date(i).format('YYYY-MM-DD');
        const dayData = dataByDate.get(dateStr);
        const dayEvents = monthEventsByDate.get(dateStr) || [];
        flatCells.push({
            date: i,
            pnl: dayData?.pnl ?? 0,
            trades: dayData?.trades ?? 0,
            wins: dayData?.wins ?? 0,
            losses: dayData?.losses ?? 0,
            avgRR: dayData?.avgRR ?? null,
            events: dayEvents,
        });
    }

    // Pad to full weeks
    while (flatCells.length % 7 !== 0) flatCells.push(null);

    // Split into weeks
    const weeks: Week[] = [];
    for (let i = 0; i < flatCells.length; i += 7) {
        weeks.push(flatCells.slice(i, i + 7));
    }

    // Monthly totals (always based on current view month)
    const monthData = data.filter(d => d.date.startsWith(viewDate.format('YYYY-MM')));
    const monthlyPnl = monthData.reduce((s, d) => s + d.pnl, 0);
    const monthlyTrades = monthData.reduce((s, d) => s + d.trades, 0);
    const monthlyWins = monthData.reduce((s, d) => s + d.wins, 0);
    const monthlyLosses = monthData.reduce((s, d) => s + d.losses, 0);
    const monthlyWinRate = monthlyTrades > 0 ? Math.round((monthlyWins / monthlyTrades) * 100) : 0;

    const getPnlStyle = (metricVal: number | null, hasTrades: boolean) => {
        if (!hasTrades || metricVal === null) return {
            bg: "bg-white/5 hover:bg-white/10",
            border: "border-white/5",
            text: "text-gray-500",
        };
        const isPositive = metric === 'rr' ? metricVal >= 1.0 : metricVal > 0;
        const isNegative = metric === 'rr' ? metricVal < 1.0 : metricVal < 0;
        if (isPositive) return { bg: "bg-profit/15 hover:bg-profit/25", border: "border-profit/30", text: "text-profit" };
        if (isNegative) return { bg: "bg-loss/15 hover:bg-loss/25", border: "border-loss/30", text: "text-loss" };
        return { bg: "bg-secondary/15 hover:bg-secondary/25", border: "border-secondary/30", text: "text-secondary" };
    };

    const pnlColor = (pnl: number) =>
        pnl > 0 ? 'text-profit' : pnl < 0 ? 'text-loss' : 'text-gray-400';

    // 95th-percentile of absolute metric values for the viewed year (for colour intensity scaling)
    const p95 = useMemo(() => {
        const absVals = data
            .filter(d => d.date.startsWith(String(viewYear)))
            .map(d => {
                const v = getMetricValue(d);
                return v !== null ? Math.abs(v) : null;
            })
            .filter((v): v is number => v !== null);
        if (absVals.length === 0) return 1;
        const sorted = [...absVals].sort((a, b) => a - b);
        return sorted[Math.floor(sorted.length * 0.95)] || 1;
    }, [data, viewYear, getMetricValue]);

    const getYearDayBg = useCallback((metricVal: number | null): React.CSSProperties => {
        if (metricVal === null) return {};
        const intensity = Math.min(Math.abs(metricVal) / p95, 1);
        const alpha = 0.06 + intensity * 0.35;
        // For R:R: green if >= 1.0, red if < 1.0
        const isPositive = metric === 'rr' ? metricVal >= 1.0 : metricVal > 0;
        if (isPositive) return {
            backgroundColor: `rgba(74, 222, 128, ${alpha})`,
            border: `1px solid rgba(74, 222, 128, ${Math.min(alpha * 1.5, 0.6)})`,
        };
        return {
            backgroundColor: `rgba(248, 113, 113, ${alpha})`,
            border: `1px solid rgba(248, 113, 113, ${Math.min(alpha * 1.5, 0.6)})`,
        };
    }, [p95, metric]);

    return (
        <div className="p-5 h-full flex flex-col group/calendar overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between mb-3 shrink-0">
                {/* Left: metric dropdown + nav */}
                <div className="flex items-center gap-3">
                    {/* Metric dropdown */}
                    <div className="relative" ref={metricDropdownRef}>
                        <button
                            onClick={() => setMetricOpen(o => !o)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/10 text-xs font-bold text-gray-300 hover:bg-white/10 transition-colors"
                        >
                            {metric === 'pnl' ? 'Dollar Profit' : metric === 'pct' ? '% Profit' : 'R:R'}
                            <span className="text-gray-500 text-[10px]">{metricOpen ? '▲' : '▼'}</span>
                        </button>
                        {metricOpen && (
                            <div className="absolute top-full left-0 mt-1 bg-black/95 border border-white/10 rounded-lg py-1 z-50 min-w-[120px] shadow-xl">
                                {(['pnl', 'pct', 'rr'] as const)
                                    .filter(m => m !== 'pct' || (accountBalance != null && accountBalance !== 0))
                                    .map(m => (
                                        <button
                                            key={m}
                                            onClick={() => { setMetric(m); setMetricOpen(false); }}
                                            className={`w-full text-left px-3 py-2 text-xs font-semibold hover:bg-white/10 transition-colors ${metric === m ? 'text-primary' : 'text-gray-300'}`}
                                        >
                                            {m === 'pnl' ? 'Dollar Profit' : m === 'pct' ? '% Profit' : 'R:R'}
                                        </button>
                                    ))
                                }
                            </div>
                        )}
                    </div>

                    {/* Month nav (Month view only) */}
                    {viewMode === 'month' && (
                        <div className="flex items-center gap-1.5">
                            <button onClick={prevMonth} className="w-6 h-6 flex items-center justify-center rounded-md bg-white/[0.06] border border-white/10 text-gray-400 hover:bg-white/10 transition-colors text-xs">‹</button>
                            <span className="text-sm font-bold text-gray-100 min-w-[72px] text-center">{viewDate.format('MMMM')}</span>
                            <button onClick={nextMonth} className="w-6 h-6 flex items-center justify-center rounded-md bg-white/[0.06] border border-white/10 text-gray-400 hover:bg-white/10 transition-colors text-xs">›</button>
                        </div>
                    )}

                    {/* Year nav (always shown) */}
                    <div className="flex items-center gap-1.5">
                        <button onClick={prevYear} className="w-6 h-6 flex items-center justify-center rounded-md bg-white/[0.06] border border-white/10 text-gray-400 hover:bg-white/10 transition-colors text-xs">‹</button>
                        <span className="text-sm font-semibold text-gray-500 min-w-[40px] text-center">{viewYear}</span>
                        <button onClick={nextYear} className="w-6 h-6 flex items-center justify-center rounded-md bg-white/[0.06] border border-white/10 text-gray-400 hover:bg-white/10 transition-colors text-xs">›</button>
                    </div>
                </div>

                {/* Right: Month | Year toggle — desktop only */}
                <div className="hidden sm:flex bg-white/[0.06] border border-white/[0.08] rounded-lg p-0.5 gap-0.5">
                    {(['month', 'year'] as const).map(mode => (
                        <button
                            key={mode}
                            onClick={() => setViewMode(mode)}
                            className={`px-3 py-1 rounded-md text-[11px] font-black uppercase tracking-widest transition-colors ${
                                viewMode === mode
                                    ? 'bg-primary/20 border border-primary/40 text-primary/90'
                                    : 'text-gray-500 hover:text-gray-300'
                            }`}
                        >
                            {mode}
                        </button>
                    ))}
                </div>
            </div>

            {viewMode === 'month' ? (
                /* Month view — existing grid logic */
                <div className="flex-1 min-h-0 flex flex-col gap-1">
                    {/* Column headers — 7 days on mobile, 9 cols on desktop (7 days + spacer + weekly) */}
                    <div className="hidden md:grid grid-cols-[repeat(7,minmax(0,1fr))_12px_minmax(0,1.3fr)] gap-1 shrink-0">
                        {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((d) => (
                            <div key={d} className="text-center text-[10px] font-black text-gray-600 pb-1 tracking-tighter">
                                {d}
                            </div>
                        ))}
                        {/* spacer */}
                        <div />
                        <div className="text-center text-[10px] font-black text-gray-500 pb-1 tracking-tighter">
                            WEEK
                        </div>
                    </div>
                    {/* Mobile column headers - just 7 days */}
                    <div className="grid grid-cols-7 gap-1 shrink-0 md:hidden">
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => (
                            <div key={d} className="text-center text-[10px] font-black text-gray-600 pb-1 tracking-tighter">
                                {d}
                            </div>
                        ))}
                    </div>

                    {/* Week rows */}
                    <div className="flex-1 min-h-0 flex flex-col gap-1">
                        {weeks.map((week, wi) => {
                            const weekDays = week.filter(Boolean) as NonNullable<DayCell>[];
                            const weekPnl = weekDays.reduce((s, d) => s + d.pnl, 0);
                            const weekTrades = weekDays.reduce((s, d) => s + d.trades, 0);
                            const weekWins = weekDays.reduce((s, d) => s + d.wins, 0);
                            const weekLosses = weekDays.reduce((s, d) => s + d.losses, 0);
                            const weekWinRate = weekTrades > 0 ? Math.round((weekWins / weekTrades) * 100) : null;

                            return (
                                <div key={wi} className="grid grid-cols-7 md:grid-cols-[repeat(7,minmax(0,1fr))_12px_minmax(0,1.3fr)] gap-1 flex-1 min-h-[64px]">
                                    {/* 7 day cells */}
                                    {week.map((day, di) => {
                                        if (!day) return <div key={`empty-${wi}-${di}`} />;
                                        const metricVal = getMetricValue(day);
                                        const style = getPnlStyle(metricVal, day.trades > 0);

                                        return (
                                            <div
                                                key={di}
                                                className={cn(
                                                    "rounded-lg flex flex-col items-center justify-center transition-all duration-300 border min-h-0 relative group/day cursor-pointer",
                                                    style.bg,
                                                    style.border
                                                )}
                                            >
                                                <span className={cn("text-[10px] font-bold", day.trades > 0 ? "text-gray-400" : style.text)}>
                                                    {day.date}
                                                </span>
                                                {day.trades > 0 && (
                                                    <>
                                                        <span className={cn("text-[11px] font-black leading-tight mt-0.5", style.text)}>
                                                            {formatMetricValue(metricVal)}
                                                        </span>
                                                        <div className="flex gap-1 mt-0.5">
                                                            {day.wins > 0 && (
                                                                <span className="text-[8px] font-black text-profit">{day.wins}W</span>
                                                            )}
                                                            {day.losses > 0 && (
                                                                <span className="text-[8px] font-black text-loss">{day.losses}L</span>
                                                            )}
                                                            {day.wins === 0 && day.losses === 0 && (
                                                                <span className="text-[8px] font-black text-secondary">BE</span>
                                                            )}
                                                        </div>
                                                    </>
                                                )}
                                                {day.events.length > 0 && (
                                                    <div className="flex flex-wrap gap-0.5 mt-0.5 justify-center max-w-full px-0.5">
                                                        {day.events.slice(0, 3).map((event, idx) => (
                                                            <EventBadge key={idx} event={event} />
                                                        ))}
                                                        {day.events.length > 3 && (
                                                            <span className="text-[7px] text-gray-500 font-bold">+{day.events.length - 3}</span>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Hover Tooltip */}
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover/day:opacity-100 pointer-events-none transition-opacity duration-200 z-50">
                                                    <div className="bg-black/95 border border-white/20 rounded-lg px-3 py-2 shadow-xl whitespace-nowrap">
                                                        <p className="text-[10px] font-bold text-white">{viewDate.date(day.date).format('MMM D, YYYY')}</p>
                                                        <p className={cn("text-xs font-black mt-1", style.text)}>
                                                            {day.trades === 0 ? 'No trades' : `${day.trades} trade${day.trades > 1 ? 's' : ''} · ${formatMetricValue(metricVal)}`}
                                                        </p>
                                                        {day.trades > 0 && (
                                                            <p className="text-[9px] text-gray-400 mt-0.5">
                                                                {day.wins} win{day.wins !== 1 ? 's' : ''}, {day.losses} loss{day.losses !== 1 ? 'es' : ''}
                                                                {day.wins === 0 && day.losses === 0 && ' • Breakeven'}
                                                            </p>
                                                        )}
                                                        {day.events.length > 0 && (
                                                            <div className="mt-1 pt-1 border-t border-white/10">
                                                                <p className="text-[8px] font-bold text-gray-500 uppercase tracking-wide mb-0.5">Economic Events</p>
                                                                {day.events.map((event, idx) => (
                                                                    <p key={idx} className="text-[9px] text-gray-300">
                                                                        {event.name} ({event.currency}){event.time ? ` - ${event.time}` : ''}
                                                                    </p>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                                                        <div className="w-2 h-2 bg-black/95 border-r border-b border-white/20 transform rotate-45 -translate-y-1/2" />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* Spacer column - desktop only */}
                                    <div className="hidden md:block" />

                                    {/* Weekly summary cell - desktop only */}
                                    <div className={cn(
                                        "hidden md:flex rounded-lg flex-col items-center justify-center border min-h-0 px-1",
                                        weekTrades > 0
                                            ? weekPnl > 0
                                                ? "bg-profit/10 border-profit/20"
                                                : weekPnl < 0
                                                    ? "bg-loss/10 border-loss/20"
                                                    : "bg-secondary/10 border-secondary/20"
                                            : "bg-white/[0.03] border-white/5"
                                    )}>
                                        {weekTrades > 0 ? (
                                            <>
                                                <span className={cn("text-[12px] font-black leading-tight", pnlColor(weekPnl))}>
                                                    {weekPnl > 0 ? '+' : weekPnl < 0 ? '-' : ''}{symbol}{Math.abs(weekPnl).toFixed(0)}
                                                </span>
                                                <span className="text-[9px] font-black text-gray-400 mt-0.5">
                                                    {weekTrades}T
                                                </span>
                                                <div className="flex gap-0.5 mt-0.5">
                                                    {weekWins > 0 && <span className="text-[8px] font-black text-profit">{weekWins}W</span>}
                                                    {weekWins > 0 && weekLosses > 0 && <span className="text-[8px] text-gray-600">/</span>}
                                                    {weekLosses > 0 && <span className="text-[8px] font-black text-loss">{weekLosses}L</span>}
                                                </div>
                                                {weekWinRate !== null && (
                                                    <span className={cn("text-[8px] font-black mt-0.5", weekWinRate >= 50 ? "text-profit" : "text-loss")}>
                                                        {weekWinRate}%
                                                    </span>
                                                )}
                                            </>
                                        ) : (
                                            <span className="text-[9px] text-gray-700 font-bold">—</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Monthly summary footer - desktop only */}
                    <div className="shrink-0 mt-1 hidden md:grid grid-cols-[repeat(7,minmax(0,1fr))_12px_minmax(0,1.3fr)] gap-1">
                        {/* Spacer for 7 day columns + separator */}
                        <div className="col-span-7" />
                        <div />
                        {/* Monthly total cell */}
                        <div className={cn(
                            "rounded-lg flex flex-col items-center justify-center border py-2 px-1",
                            monthlyTrades > 0
                                ? monthlyPnl > 0
                                    ? "bg-profit/15 border-profit/30"
                                    : monthlyPnl < 0
                                        ? "bg-loss/15 border-loss/30"
                                        : "bg-secondary/15 border-secondary/30"
                                : "bg-white/[0.03] border-white/5"
                        )}>
                            <div className="text-[7px] font-black uppercase tracking-widest text-gray-600 mb-0.5">MTD</div>
                            {monthlyTrades > 0 ? (
                                <>
                                    <span className={cn("text-[12px] font-black leading-tight", pnlColor(monthlyPnl))}>
                                        {monthlyPnl > 0 ? '+' : monthlyPnl < 0 ? '-' : ''}{symbol}{Math.abs(monthlyPnl).toFixed(0)}
                                    </span>
                                    <span className="text-[9px] font-black text-gray-400 mt-0.5">
                                        {monthlyTrades}T
                                    </span>
                                    <div className="flex gap-0.5 mt-0.5">
                                        {monthlyWins > 0 && <span className="text-[8px] font-black text-profit">{monthlyWins}W</span>}
                                        {monthlyWins > 0 && monthlyLosses > 0 && <span className="text-[8px] text-gray-600">/</span>}
                                        {monthlyLosses > 0 && <span className="text-[8px] font-black text-loss">{monthlyLosses}L</span>}
                                    </div>
                                    <span className={cn("text-[8px] font-black mt-0.5", monthlyWinRate >= 50 ? "text-profit" : "text-loss")}>
                                        {monthlyWinRate}%
                                    </span>
                                </>
                            ) : (
                                <span className="text-[9px] text-gray-700 font-bold">—</span>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                /* Year view — 12-mini-month grid */
                <div className="flex-1 min-h-0 overflow-auto pt-1">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                        {Array.from({ length: 12 }, (_, monthIndex) => (
                            <MiniMonth
                                key={monthIndex}
                                year={viewYear}
                                month={monthIndex}
                                dataByDate={dataByDate}
                                eventsByDate={yearEventsByDate}
                                getMetricValue={getMetricValue}
                                formatMetricValue={formatMetricValue}
                                getYearDayBg={getYearDayBg}
                                onDayClick={(y, m) => {
                                    setViewYear(y);
                                    setViewMonth(m);
                                    setViewMode('month');
                                }}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
