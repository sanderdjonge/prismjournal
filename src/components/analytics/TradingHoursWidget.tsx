'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { fmtDecimals } from '@/lib/formatNumber';

import { useCurrency } from '@/lib/currency'

export interface SessionHour {
    hour: number;
    count: number;
    wins: number;
    losses: number;
    totalPnl: number;
    winRate: number;
    avgRR: number;
}

type ViewMode = 'trades' | 'winRate' | 'profit' | 'rr';

interface TradingHoursWidgetProps {
    data: SessionHour[];
    currency?: string;
}

const VIEW_OPTIONS: { value: ViewMode; label: string }[] = [
    { value: 'trades', label: 'Trades' },
    { value: 'winRate', label: 'Win Rate' },
    { value: 'profit', label: 'Profit' },
    { value: 'rr', label: 'R:R' },
];


export function TradingHoursWidget({ data, currency = 'USD' }: TradingHoursWidgetProps) {
    const [viewMode, setViewMode] = useState<ViewMode>('trades');
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const { formatAmount: fmt } = useCurrency()

    // Calculate max values for scaling
    const maxCount = Math.max(...data.map(d => d.count), 1);
    const maxWins = Math.max(...data.map(d => d.wins), 1);
    const maxPnl = Math.max(...data.map(d => Math.abs(d.totalPnl)), 1);
    const maxRR = Math.max(...data.map(d => Math.abs(d.avgRR)), 1);

    const currentView = VIEW_OPTIONS.find(v => v.value === viewMode)!;

    const getBarColor = (hour: SessionHour) => {
        if (viewMode === 'trades') {
            return {
                win: 'bg-profit',
                loss: 'bg-loss',
            };
        }
        if (viewMode === 'winRate') {
            if (hour.winRate >= 60) return 'bg-profit';
            if (hour.winRate >= 40) return 'bg-yellow-500';
            return 'bg-loss';
        }
        if (viewMode === 'profit') {
            return hour.totalPnl >= 0 ? 'bg-profit' : 'bg-loss';
        }
        // R:R mode
        if (hour.avgRR >= 1) return 'bg-profit';
        if (hour.avgRR >= 0) return 'bg-yellow-500';
        return 'bg-loss';
    };

    const getBarHeight = (hour: SessionHour) => {
        if (viewMode === 'trades') {
            // Total height based on count, split between wins and losses
            return {
                total: (hour.count / maxCount) * 100,
                winRatio: hour.count > 0 ? (hour.wins / hour.count) * 100 : 0,
            };
        }
        if (viewMode === 'winRate') {
            return { total: hour.winRate, winRatio: 100 };
        }
        if (viewMode === 'profit') {
            const pct = (Math.abs(hour.totalPnl) / maxPnl) * 100;
            return { total: Math.max(pct, hour.totalPnl !== 0 ? 4 : 0), winRatio: 100 };
        }
        // R:R mode
        const rrPct = (Math.abs(hour.avgRR) / Math.max(maxRR, 0.1)) * 100;
        return { total: Math.max(rrPct, hour.avgRR !== 0 ? 4 : 0), winRatio: 100 };
    };

    const getTooltipContent = (hour: SessionHour) => {
        const timeStr = `${hour.hour.toString().padStart(2, '0')}:00`;
        
        if (viewMode === 'trades') {
            return (
                <>
                    <div className="text-white font-bold">{timeStr}</div>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-profit">{hour.wins}W</span>
                        <span className="text-gray-400">/</span>
                        <span className="text-loss">{hour.losses}L</span>
                    </div>
                    {hour.count > 0 && (
                        <div className="text-gray-400 text-[9px] mt-0.5">
                            {fmtDecimals(hour.winRate, 1)}% WR
                        </div>
                    )}
                </>
            );
        }
        if (viewMode === 'winRate') {
            return (
                <>
                    <div className="text-white font-bold">{timeStr}</div>
                    <div className="text-primary mt-1">{fmtDecimals(hour.winRate, 1)}% Win Rate</div>
                    <div className="text-gray-400 text-[9px] mt-0.5">
                        {hour.wins}W / {hour.losses}L
                    </div>
                </>
            );
        }
        if (viewMode === 'profit') {
            return (
                <>
                    <div className="text-white font-bold">{timeStr}</div>
                    <div className={cn('mt-1 font-bold', hour.totalPnl >= 0 ? 'text-profit' : 'text-loss')}>
                        {fmt(hour.totalPnl, { compact: true })}
                    </div>
                    <div className="text-gray-400 text-[9px] mt-0.5">
                        {hour.count} trade{hour.count !== 1 ? 's' : ''}
                    </div>
                </>
            );
        }
        // R:R mode
        return (
            <>
                <div className="text-white font-bold">{timeStr}</div>
                <div className={cn('mt-1 font-bold', hour.avgRR >= 0 ? 'text-profit' : 'text-loss')}>
                    {fmtDecimals(hour.avgRR, 2)}R
                </div>
                <div className="text-gray-400 text-[9px] mt-0.5">
                    {hour.count} trade{hour.count !== 1 ? 's' : ''}
                </div>
            </>
        );
    };

    return (
        <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-sm font-semibold text-gray-100">Trades by Hour of Day</h3>
                    <p className="text-xs text-gray-500">When you open trades — find your most active trading hours</p>
                </div>
                {/* Dropdown Selector */}
                <div className="relative">
                    <button
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-xs font-medium text-gray-300"
                    >
                        {currentView.label}
                        <ChevronDown size={12} className={cn('transition-transform', dropdownOpen && 'rotate-180')} />
                    </button>
                    {dropdownOpen && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                            <div className="absolute right-0 top-full mt-1 z-20 min-w-[100px] py-1 rounded-lg bg-[var(--surface-solid)] border border-white/10 shadow-xl">
                                {VIEW_OPTIONS.map((option) => (
                                    <button
                                        key={option.value}
                                        onClick={() => {
                                            setViewMode(option.value);
                                            setDropdownOpen(false);
                                        }}
                                        className={cn(
                                            'w-full px-3 py-1.5 text-left text-xs font-medium transition-colors',
                                            viewMode === option.value
                                                ? 'text-primary bg-primary/10'
                                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                                        )}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Chart */}
            <div className="flex items-end gap-1 h-28">
                {data.map((hour) => {
                    const heights = getBarHeight(hour);
                    const colors = getBarColor(hour);
                    const hasData = hour.count > 0;
                    const barHeight = hasData ? Math.max(heights.total, 4) : 4;

                    return (
                        <div
                            key={hour.hour}
                            className="flex-1 flex flex-col items-center h-full"
                        >
                            {/* Bar area - explicit height for percentage-based children */}
                            <div className="flex-1 w-full flex items-end justify-center min-h-0">
                                <div
                                    className="w-full rounded-t transition-all group/bar relative cursor-default"
                                    style={{ height: `${barHeight}%` }}
                                >
                                    {viewMode === 'trades' && hasData ? (
                                        // Stacked bar for wins/losses
                                        <div className="w-full h-full flex flex-col rounded-t overflow-hidden">
                                            <div
                                                className="w-full bg-loss transition-colors group-hover/bar:bg-loss/80"
                                                style={{ height: `${100 - heights.winRatio}%` }}
                                            />
                                            <div
                                                className="w-full bg-profit transition-colors group-hover/bar:bg-profit/80"
                                                style={{ height: `${heights.winRatio}%` }}
                                            />
                                        </div>
                                    ) : (
                                        <div className={cn(
                                            'w-full h-full rounded-t transition-colors',
                                            hasData ? colors : 'bg-white/5',
                                            hasData && 'group-hover/bar:opacity-80'
                                        )} />
                                    )}
                                    
                                    {/* Tooltip */}
                                    {hasData && (
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1.5 rounded bg-black/95 border border-white/10 text-[9px] font-bold whitespace-nowrap opacity-0 group-hover/bar:opacity-100 transition-opacity pointer-events-none z-10">
                                            {getTooltipContent(hour)}
                                        </div>
                                    )}
                                </div>
                            </div>
                            {/* Time label under each bar */}
                            <span className="text-[10px] font-bold text-gray-600 tabular-nums shrink-0">
                                {hour.hour.toString().padStart(2, '0')}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Legend for Trades view */}
            {viewMode === 'trades' && (
                <div className="flex items-center justify-center gap-4 mt-3 text-[9px] font-medium">
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-sm bg-profit" />
                        <span className="text-gray-400">Wins</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-sm bg-loss" />
                        <span className="text-gray-400">Losses</span>
                    </div>
                </div>
            )}
        </div>
    );
}