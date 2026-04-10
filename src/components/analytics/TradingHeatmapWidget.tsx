'use client';

import { useState, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { HeatmapCell } from '@/app/api/analytics/heatmap/route';

type ViewMode = 'pnl' | 'winRate' | 'count' | 'expectedValue';

interface TradingHeatmapWidgetProps {
    cells: HeatmapCell[];
    currency?: string;
}

const VIEW_OPTIONS: { value: ViewMode; label: string }[] = [
    { value: 'pnl', label: 'P&L' },
    { value: 'winRate', label: 'Win Rate' },
    { value: 'count', label: 'Trade Count' },
    { value: 'expectedValue', label: 'Expected Value' },
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function formatCurrency(value: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
}

function getCellColor(cell: HeatmapCell | undefined, mode: ViewMode): string {
    if (!cell || cell.count === 0) return 'bg-white/5';

    if (mode === 'pnl') {
        if (cell.totalPnl > 0) return 'bg-green-500/60';
        if (cell.totalPnl < 0) return 'bg-red-500/60';
        return 'bg-white/10';
    }

    if (mode === 'winRate') {
        if (cell.winRate >= 60) return 'bg-green-500/60';
        if (cell.winRate >= 40) return 'bg-yellow-500/60';
        return 'bg-red-500/60';
    }

    if (mode === 'count') {
        // Use intensity based on count
        if (cell.count >= 10) return 'bg-blue-500/60';
        if (cell.count >= 5) return 'bg-blue-500/40';
        return 'bg-blue-500/20';
    }

    // expectedValue
    if (cell.avgPnl > 0) return 'bg-green-500/60';
    if (cell.avgPnl < 0) return 'bg-red-500/60';
    return 'bg-white/10';
}

function getLegendColors(mode: ViewMode): { color: string; label: string }[] {
    if (mode === 'pnl') {
        return [
            { color: 'bg-red-500/60', label: 'Losing' },
            { color: 'bg-white/10', label: 'Neutral' },
            { color: 'bg-green-500/60', label: 'Profitable' },
        ];
    }

    if (mode === 'winRate') {
        return [
            { color: 'bg-red-500/60', label: '<40%' },
            { color: 'bg-yellow-500/60', label: '40-60%' },
            { color: 'bg-green-500/60', label: '>60%' },
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
        { color: 'bg-red-500/60', label: 'Negative' },
        { color: 'bg-white/10', label: 'Neutral' },
        { color: 'bg-green-500/60', label: 'Positive' },
    ];
}

export function TradingHeatmapWidget({ cells, currency = 'USD' }: TradingHeatmapWidgetProps) {
    const [viewMode, setViewMode] = useState<ViewMode>('pnl');
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [hoveredCell, setHoveredCell] = useState<HeatmapCell | null>(null);

    // Build 7x24 grid
    const grid = useMemo(() => {
        const cellMap = new Map<string, HeatmapCell>();
        for (const cell of cells) {
            cellMap.set(`${cell.day}-${cell.hour}`, cell);
        }
        return cellMap;
    }, [cells]);

    const currentView = VIEW_OPTIONS.find(v => v.value === viewMode)!;

    return (
        <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-sm font-semibold text-gray-100">Trading Heatmap</h3>
                    <p className="text-xs text-gray-500">Day x Hour performance patterns</p>
                </div>
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
                            <div className="absolute right-0 top-full mt-1 z-20 min-w-[120px] py-1 rounded-lg bg-black/95 border border-white/10 shadow-xl">
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

            {/* Heatmap Grid */}
            <div className="overflow-x-auto">
                <div className="min-w-[600px]">
                    {/* Hour labels */}
                    <div className="flex mb-1 ml-10">
                        {HOURS.map(hour => (
                            <div key={hour} className="flex-1 text-center text-[8px] font-bold text-gray-600 tabular-nums">
                                {hour.toString().padStart(2, '0')}
                            </div>
                        ))}
                    </div>

                    {/* Day rows */}
                    {DAYS.map((day, dayIndex) => (
                        <div key={day} className="flex items-center mb-0.5">
                            <div className="w-10 text-[9px] font-bold text-gray-500 uppercase tracking-wider">
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
                                                'flex-1 h-6 rounded-sm transition-colors cursor-default relative',
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
                <div className="mt-3 p-3 bg-black/60 border border-white/10 rounded-lg text-xs">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="font-bold text-white">
                            {DAYS[hoveredCell.day - 1]} {hoveredCell.hour.toString().padStart(2, '0')}:00
                        </span>
                        <span className="text-gray-500">{hoveredCell.count} trades</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                        <div className="flex justify-between">
                            <span className="text-gray-500">P&L:</span>
                            <span className={hoveredCell.totalPnl >= 0 ? 'text-profit' : 'text-loss'}>
                                {formatCurrency(hoveredCell.totalPnl, currency)}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Win Rate:</span>
                            <span>{hoveredCell.winRate.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Avg P&L:</span>
                            <span className={hoveredCell.avgPnl >= 0 ? 'text-profit' : 'text-loss'}>
                                {formatCurrency(hoveredCell.avgPnl, currency)}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">W/L:</span>
                            <span>
                                <span className="text-profit">{hoveredCell.wins}</span>
                                <span className="text-gray-500">/</span>
                                <span className="text-loss">{hoveredCell.losses}</span>
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-3 text-[9px] font-medium text-gray-400">
                {getLegendColors(viewMode).map(({ color, label }) => (
                    <div key={label} className="flex items-center gap-1">
                        <div className={cn('w-3 h-3 rounded-sm', color)} />
                        <span>{label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
