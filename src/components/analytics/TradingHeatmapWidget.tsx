'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, TrendingUp, TrendingDown, AlertTriangle, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatPercent } from '@/lib/formatNumber';
import { useCurrency } from '@/lib/currency'
import type { HeatmapCell } from '@/app/api/analytics/heatmap/route';

type ViewMode = 'pnl' | 'winRate' | 'count' | 'expectedValue';

interface TradingHeatmapWidgetProps {
    cells: HeatmapCell[];
    currency?: string;
    monthLabel?: string;
    onPrevMonth?: () => void;
    onNextMonth?: () => void;
    onPrevYear?: () => void;
    onNextYear?: () => void;
}

interface TradingInsight {
    type: 'success' | 'warning' | 'danger';
    title: string;
    message: string;
    metric: string;
}

const VIEW_OPTIONS: { value: ViewMode; label: string }[] = [
    { value: 'pnl', label: 'P&L' },
    { value: 'winRate', label: 'Win Rate' },
    { value: 'count', label: 'Trade Count' },
    { value: 'expectedValue', label: 'Expected Value' },
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function getCellColor(cell: HeatmapCell | undefined, mode: ViewMode): string {
    if (!cell || cell.count === 0) return 'bg-surface-elevated';

    if (mode === 'pnl') {
        if (cell.totalPnl > 0) return 'bg-profit';
        if (cell.totalPnl < 0) return 'bg-loss';
        return 'bg-surface-hover';
    }

    if (mode === 'winRate') {
        if (cell.winRate >= 60) return 'bg-profit';
        if (cell.winRate >= 40) return 'bg-yellow-500';
        return 'bg-loss';
    }

    if (mode === 'count') {
        // Use intensity based on count
        if (cell.count >= 10) return 'bg-blue-500/60';
        if (cell.count >= 5) return 'bg-blue-500/40';
        return 'bg-blue-500/20';
    }

    // expectedValue
    if (cell.avgPnl > 0) return 'bg-profit';
    if (cell.avgPnl < 0) return 'bg-loss';
    return 'bg-surface-hover';
}

function getLegendColors(mode: ViewMode): { color: string; label: string }[] {
    if (mode === 'pnl') {
        return [
            { color: 'bg-loss', label: 'Losing' },
            { color: 'bg-surface-hover', label: 'Neutral' },
            { color: 'bg-profit', label: 'Profitable' },
        ];
    }

    if (mode === 'winRate') {
        return [
            { color: 'bg-loss', label: '<40%' },
            { color: 'bg-yellow-500', label: '40-60%' },
            { color: 'bg-profit', label: '>60%' },
        ];
    }

    if (mode === 'count') {
        return [
            { color: 'bg-blue-500/20', label: 'Few' },
            { color: 'bg-blue-500/40', label: 'Medium' },
            { color: 'bg-blue-500/60', label: 'Many' },
        ];
    }

    // expectedValue
    return [
        { color: 'bg-loss', label: 'Negative' },
        { color: 'bg-surface-hover', label: 'Neutral' },
        { color: 'bg-profit', label: 'Positive' },
    ];
}

function generateInsights(cells: HeatmapCell[], fmt: (amount: number | null | undefined, options?: { showSign?: boolean; compact?: boolean }) => string): TradingInsight[] {
    const insights: TradingInsight[] = [];
    
    // Filter cells with meaningful data (at least 3 trades)
    const significantCells = cells.filter(c => c.count >= 3);
    
    if (significantCells.length < 3) {
        return [{
            type: 'warning',
            title: 'More data needed',
            message: 'Trade more to unlock personalized insights about your best and worst trading times.',
            metric: `${cells.reduce((sum, c) => sum + c.count, 0)} trades`,
        }];
    }

    // Find worst performing times (low win rate with losses)
    const worstTimes = significantCells
        .filter(c => c.winRate < 40 && c.totalPnl < 0)
        .sort((a, b) => a.winRate - b.winRate)
        .slice(0, 2);

    for (const cell of worstTimes) {
        const dayName = DAYS[cell.day - 1];
        const timeRange = `${cell.hour.toString().padStart(2, '0')}:00`;
        insights.push({
            type: 'danger',
            title: `Avoid ${dayName} ${timeRange}`,
            message: `${formatPercent(cell.winRate, 0)} win rate with ${fmt(Math.abs(cell.totalPnl), { compact: true })} in losses across ${cell.count} trades.`,
            metric: `${formatPercent(cell.winRate, 0)} WR`,
        });
    }

    // Find best performing times
    const bestTimes = significantCells
        .filter(c => c.winRate >= 60 && c.totalPnl > 0)
        .sort((a, b) => b.totalPnl - a.totalPnl)
        .slice(0, 2);

    for (const cell of bestTimes) {
        const dayName = DAYS[cell.day - 1];
        const timeRange = `${cell.hour.toString().padStart(2, '0')}:00`;
        insights.push({
            type: 'success',
            title: `Best time: ${dayName} ${timeRange}`,
            message: `${formatPercent(cell.winRate, 0)} win rate with ${fmt(cell.totalPnl, { compact: true })} profit across ${cell.count} trades.`,
            metric: `+${fmt(cell.totalPnl, { compact: true })}`,
        });
    }

    // Analyze day patterns
    const dayStats = DAYS.map((day, i) => {
        const dayCells = cells.filter(c => c.day === i + 1);
        const totalTrades = dayCells.reduce((sum, c) => sum + c.count, 0);
        const totalPnl = dayCells.reduce((sum, c) => sum + c.totalPnl, 0);
        const wins = dayCells.reduce((sum, c) => sum + c.wins, 0);
        const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
        return { day, totalTrades, totalPnl, winRate };
    }).filter(d => d.totalTrades >= 5);

    const worstDay = dayStats.sort((a, b) => a.winRate - b.winRate)[0];
    if (worstDay && worstDay.winRate < 45) {
        insights.push({
            type: 'warning',
            title: `Challenging day: ${worstDay.day}`,
            message: `Consider reducing position size or skipping ${worstDay.day}s. Overall ${formatPercent(worstDay.winRate, 0)} win rate.`,
            metric: `${formatPercent(worstDay.winRate, 0)} WR`,
        });
    }

    const bestDay = dayStats.sort((a, b) => b.winRate - a.winRate)[0];
    if (bestDay && bestDay.winRate > 55 && bestDay.totalPnl > 0) {
        insights.push({
            type: 'success',
            title: `Strong day: ${bestDay.day}`,
            message: `${bestDay.day}s are profitable with ${formatPercent(bestDay.winRate, 0)} win rate. Focus trading here.`,
            metric: `${formatPercent(bestDay.winRate, 0)} WR`,
        });
    }

    return insights.slice(0, 4); // Limit to 4 insights
}

export function TradingHeatmapWidget({ cells, currency = 'USD', monthLabel, onPrevMonth, onNextMonth, onPrevYear, onNextYear }: TradingHeatmapWidgetProps) {
    const [viewMode, setViewMode] = useState<ViewMode>('pnl');
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const { formatAmount: fmt } = useCurrency()
    const [hoveredCell, setHoveredCell] = useState<HeatmapCell | null>(null);

    // Build 7x24 grid
    const grid = useMemo(() => {
        const cellMap = new Map<string, HeatmapCell>();
        for (const cell of cells) {
            cellMap.set(`${cell.day}-${cell.hour}`, cell);
        }
        return cellMap;
    }, [cells]);

    // Generate insights
    const insights = useMemo(() => generateInsights(cells, fmt), [cells, fmt]);

    const currentView = VIEW_OPTIONS.find(v => v.value === viewMode)!;

    return (
        <div className="glass-card border-border-color bg-surface-elevated backdrop-blur-xl rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-sm font-semibold text-gray-100">Trading Heatmap</h3>
                    <p className="text-xs text-text-muted">Day x Hour performance patterns</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Month/Year navigation */}
                    {monthLabel && (
                        <div className="flex items-center gap-1.5">
                            {onPrevMonth && <button onClick={onPrevMonth} className="w-6 h-6 flex items-center justify-center rounded-md bg-surface-hover border border-border-color text-text-muted hover:bg-surface-hover transition-colors text-xs">‹</button>}
                            <span className="text-xs font-bold text-gray-200 min-w-[100px] text-center">{monthLabel}</span>
                            {onNextMonth && <button onClick={onNextMonth} className="w-6 h-6 flex items-center justify-center rounded-md bg-surface-hover border border-border-color text-text-muted hover:bg-surface-hover transition-colors text-xs">›</button>}
                            <div className="w-px h-4 bg-surface-hover mx-1" />
                            {onPrevYear && <button onClick={onPrevYear} className="w-5 h-5 flex items-center justify-center rounded bg-surface-hover border border-border-color text-text-muted hover:bg-surface-hover transition-colors text-[10px]">‹</button>}
                            {onNextYear && <button onClick={onNextYear} className="w-5 h-5 flex items-center justify-center rounded bg-surface-hover border border-border-color text-text-muted hover:bg-surface-hover transition-colors text-[10px]">›</button>}
                        </div>
                    )}
                    {/* View mode dropdown */}
                    <div className="relative">
                    <button
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-elevated border border-border-color hover:bg-surface-hover transition-colors text-xs font-medium text-text-secondary"
                    >
                        {currentView.label}
                        <ChevronDown size={12} className={cn('transition-transform', dropdownOpen && 'rotate-180')} />
                    </button>
                    {dropdownOpen && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                            <div className="absolute right-0 top-full mt-1 z-20 min-w-[120px] py-1 rounded-lg bg-[var(--surface-solid)] border border-border-color shadow-xl">
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
                                                : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'
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
             </div>

            {/* Heatmap Grid */}
            <div className="overflow-x-auto">
                <div className="min-w-[600px]">
                    {/* Hour labels */}
                    <div className="flex mb-1 ml-10">
                        {HOURS.map(hour => (
                            <div key={hour} className="flex-1 text-center text-[8px] font-bold text-text-muted tabular-nums">
                                {hour.toString().padStart(2, '0')}
                            </div>
                        ))}
                    </div>

                    {/* Day rows */}
                    {DAYS.map((day, dayIndex) => (
                        <div key={day} className="flex items-center mb-0.5">
                            <div className="w-10 text-[9px] font-bold text-text-muted uppercase tracking-wider">
                                {day}
                            </div>
                            <div className="flex-1 flex gap-0.5">
                                {HOURS.map(hour => {
                                    const cell = grid.get(`${dayIndex + 1}-${hour}`);
                                    const hasData = cell && cell.count > 0;

                                    return (
                                        <div
                                            key={hour}
                                            className={cn(
                                                'flex-1 h-6 rounded-sm transition-colors cursor-default relative border border-border-subtle',
                                                getCellColor(cell, viewMode),
                                                hasData && 'hover:ring-1 hover:ring-white/30'
                                            )}
                                            onMouseEnter={() => cell && setHoveredCell(cell)}
                                            onMouseLeave={() => setHoveredCell(null)}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Tooltip */}
            {hoveredCell && (
                <div className="mt-3 p-3 bg-black/60 border border-border-color rounded-lg text-xs">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="font-bold text-white">
                            {DAYS[hoveredCell.day - 1]} {hoveredCell.hour.toString().padStart(2, '0')}:00
                        </span>
                        <span className="text-text-muted">{hoveredCell.count} trades</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                        <div className="flex justify-between">
                            <span className="text-text-muted">P&L:</span>
                            <span className={hoveredCell.totalPnl >= 0 ? 'text-profit' : 'text-loss'}>
                                {fmt(hoveredCell.totalPnl, { compact: true })}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-text-muted">Win Rate:</span>
                            <span>{formatPercent(hoveredCell.winRate, 1)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-text-muted">Avg P&L:</span>
                            <span className={hoveredCell.avgPnl >= 0 ? 'text-profit' : 'text-loss'}>
                                {fmt(hoveredCell.avgPnl, { compact: true })}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-text-muted">W/L:</span>
                            <span>
                                <span className="text-profit">{hoveredCell.wins}</span>
                                <span className="text-text-muted">/</span>
                                <span className="text-loss">{hoveredCell.losses}</span>
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-3 text-[9px] font-medium text-text-muted">
                {getLegendColors(viewMode).map(({ color, label }) => (
                    <div key={label} className="flex items-center gap-1">
                        <div className={cn('w-3 h-3 rounded-sm', color)} />
                        <span>{label}</span>
                    </div>
                ))}
            </div>

            {/* Insights Panel */}
            {insights.length > 0 && (
                <div className="mt-6 pt-4 border-t border-border-subtle">
                    <div className="flex items-center gap-1.5 mb-3">
                        <Lightbulb size={12} className="text-primary" />
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-text-muted">
                            Trading Insights
                        </h4>
                    </div>
                    <div className="grid gap-2">
                        {insights.map((insight, idx) => {
                            const Icon = insight.type === 'success' ? TrendingUp 
                                : insight.type === 'danger' ? TrendingDown 
                                : AlertTriangle;
                            const colorClass = insight.type === 'success' 
                                ? 'text-profit bg-profit/10 border-profit/20' 
                                : insight.type === 'danger' 
                                    ? 'text-loss bg-loss/10 border-loss/20'
                                    : 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
                            
                            return (
                                <div
                                    key={idx}
                                    className={cn(
                                        'flex items-start gap-2.5 p-2.5 rounded-lg border',
                                        colorClass
                                    )}
                                >
                                    <Icon size={14} className="mt-0.5 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-[11px] font-bold">{insight.title}</span>
                                            <span className="text-[9px] font-black uppercase tracking-wider opacity-70">
                                                {insight.metric}
                                            </span>
                                        </div>
                                        <p className="text-[10px] opacity-80 mt-0.5 leading-relaxed">
                                            {insight.message}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
