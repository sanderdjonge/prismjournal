/**
 * Period Comparison Widget
 *
 * Displays side-by-side comparison of metrics between two time periods.
 * Shows delta indicators (↑↓) for each metric.
 */

'use client';

import React, { useState } from 'react';
import { ChevronDown, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import { usePeriodComparison, ComparisonPreset, getComparisonRanges } from '@/hooks/usePeriodComparison';
import { formatPercent } from '@/lib/formatNumber';

interface PeriodComparisonWidgetProps {
    accountId: string | null;
}

const PRESETS: { value: ComparisonPreset; label: string }[] = [
    { value: 'today_vs_yesterday', label: 'Today vs Yesterday' },
    { value: 'this_week_vs_last_week', label: 'This Week vs Last Week' },
    { value: 'this_month_vs_last_month', label: 'This Month vs Last Month' },
    { value: 'this_year_vs_last_year', label: 'This Year vs Last Year' },
];

function formatMetric(value: number | null, format: 'number' | 'percent' | 'currency' = 'number', currency = '$'): string {
    if (value === null || value === undefined) return '—';
    
    switch (format) {
        case 'percent':
            return formatPercent(value, 1);
        case 'currency':
            return `${currency}${value.toFixed(2)}`;
        default:
            return value.toFixed(2);
    }
}

function DeltaIndicator({ delta }: { delta: number | null }) {
    if (delta === null) return <Minus className="w-4 h-4 text-gray-500" />;
    
    const isPositive = delta > 0;
    const color = isPositive ? 'text-profit' : 'text-loss';
    const Icon = isPositive ? TrendingUp : TrendingDown;
    
    return (
        <div className={`flex items-center gap-1 ${color}`}>
            <Icon className="w-4 h-4" />
            <span className="text-sm font-medium">
                {isPositive ? '+' : ''}{formatPercent(delta, 1)}
            </span>
        </div>
    );
}

export default function PeriodComparisonWidget({ accountId }: PeriodComparisonWidgetProps) {
    const [preset, setPreset] = useState<ComparisonPreset>('this_week_vs_last_week');
    const [showDropdown, setShowDropdown] = useState(false);
    
    const { data, isLoading, error, refetch } = usePeriodComparison(accountId, preset);

    const ranges = getComparisonRanges(preset);

    return (
        <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">Period Comparison</h3>
                <div className="relative">
                    <button
                        onClick={() => setShowDropdown(!showDropdown)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 hover:bg-white/10 transition-colors"
                    >
                        {PRESETS.find(p => p.value === preset)?.label}
                        <ChevronDown className="w-4 h-4" />
                    </button>
                    
                    {showDropdown && (
                        <>
                            <div 
                                className="fixed inset-0 z-40"
                                onClick={() => setShowDropdown(false)}
                            />
                            <div className="absolute right-0 top-full mt-1 z-50 bg-surface-card border border-white/10 rounded-lg shadow-xl overflow-hidden min-w-[200px]">
                                {PRESETS.map((p) => (
                                    <button
                                        key={p.value}
                                        onClick={() => {
                                            setPreset(p.value);
                                            setShowDropdown(false);
                                        }}
                                        className={`w-full px-4 py-2 text-left text-sm hover:bg-white/5 transition-colors ${
                                            preset === p.value ? 'text-indigo-400' : 'text-gray-300'
                                        }`}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Period Labels */}
            <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                    <span className="text-xs text-gray-500 uppercase tracking-wider">{ranges.period1.label}</span>
                </div>
                <div className="text-center">
                    <span className="text-xs text-gray-500 uppercase tracking-wider">Change</span>
                </div>
                <div className="text-center">
                    <span className="text-xs text-gray-500 uppercase tracking-wider">{ranges.period2.label}</span>
                </div>
            </div>

            {/* Content */}
            {isLoading ? (
                <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-6 h-6 text-gray-500 animate-spin" />
                </div>
            ) : error ? (
                <div className="text-center py-8 text-red-400">
                    Failed to load comparison data
                </div>
            ) : data ? (
                <div className="space-y-4">
                    {/* Total P&L */}
                    <MetricRow
                        label="Total P&L"
                        value1={data.metrics1.totalPnl}
                        value2={data.metrics2.totalPnl}
                        delta={data.delta.totalPnl}
                        format="currency"
                    />
                    
                    {/* Win Rate */}
                    <MetricRow
                        label="Win Rate"
                        value1={data.metrics1.winRate}
                        value2={data.metrics2.winRate}
                        delta={data.delta.winRate}
                        format="percent"
                    />
                    
                    {/* Profit Factor */}
                    <MetricRow
                        label="Profit Factor"
                        value1={data.metrics1.profitFactor}
                        value2={data.metrics2.profitFactor}
                        delta={data.delta.profitFactor}
                        format="number"
                    />
                    
                    {/* Total Trades */}
                    <MetricRow
                        label="Total Trades"
                        value1={data.metrics1.totalTrades}
                        value2={data.metrics2.totalTrades}
                        delta={data.delta.totalTrades}
                        format="number"
                    />
                    
                    {/* Avg R */}
                    <MetricRow
                        label="Avg R"
                        value1={data.metrics1.avgRR}
                        value2={data.metrics2.avgRR}
                        delta={data.delta.avgRR}
                        format="number"
                    />
                    
                    {/* Expectancy */}
                    <MetricRow
                        label="Expectancy"
                        value1={data.metrics1.expectancy}
                        value2={data.metrics2.expectancy}
                        delta={data.delta.expectancy}
                        format="currency"
                    />
                </div>
            ) : null}
        </div>
    );
}

function MetricRow({
    label,
    value1,
    value2,
    delta,
    format,
}: {
    label: string;
    value1: number | null;
    value2: number | null;
    delta: number | null;
    format: 'number' | 'percent' | 'currency';
}) {
    const isPositive = value1 !== null && value2 !== null && value1 > value2;
    const isNegative = value1 !== null && value2 !== null && value1 < value2;
    
    return (
        <div className="grid grid-cols-3 gap-4 items-center py-2 border-b border-white/5 last:border-0">
            {/* Period 1 Value */}
            <div className="text-center">
                <span className={`text-lg font-semibold ${
                    value1 === null ? 'text-gray-500' :
                    value1 > 0 ? 'text-profit' : 
                    value1 < 0 ? 'text-loss' : 'text-gray-300'
                }`}>
                    {formatMetric(value1, format)}
                </span>
            </div>
            
            {/* Delta */}
            <div className="flex justify-center">
                <DeltaIndicator delta={delta} />
            </div>
            
            {/* Period 2 Value */}
            <div className="text-center">
                <span className={`text-lg font-semibold ${
                    value2 === null ? 'text-gray-500' :
                    value2 > 0 ? 'text-profit' : 
                    value2 < 0 ? 'text-loss' : 'text-gray-300'
                }`}>
                    {formatMetric(value2, format)}
                </span>
            </div>
        </div>
    );
}