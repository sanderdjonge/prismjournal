'use client';

import React from 'react';
import {
    ResponsiveContainer,
    ComposedChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    Line,
} from 'recharts';
import { useBenchmark } from '@/hooks/useBenchmark';
import { TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import { getChartColor } from '@/lib/chart-colors';
import { formatPercent, fmtDecimals } from '@/lib/formatNumber';
import { formatDateKey } from '@/lib/formatTime';

interface BenchmarkComparisonProps {
    accountId?: string;
    className?: string;
}

export default function BenchmarkComparison({ accountId, className = '' }: BenchmarkComparisonProps) {
    const chartColors = {
        profit: getChartColor('profit'),
        textMuted: getChartColor('text-muted'),
        textSecondary: getChartColor('text-secondary'),
    };
    const { data, isLoading, error } = useBenchmark({
        accountId,
        benchmarks: ['SPY'],
    });

    if (isLoading) {
        return (
            <div className={`glass-card border-border-color bg-surface-elevated backdrop-blur-xl rounded-2xl p-6 ${className}`}>
                <div className="flex items-center justify-center h-48">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
            </div>
        );
    }

    if (error || !data) {
        return null; // Don't show if no data or error
    }

    const { account, benchmarks: benchmarkData, comparison } = data;
    const spy = benchmarkData.SPY;

    if (!spy) {
        return null;
    }

    // Normalize equity curves to start at 100 for comparison
    const normalizedAccountEquity = account.equityCurve.map((point, i) => ({
        time: formatDateKey(point.date),
        account: account.startingBalance > 0 
            ? (point.equity / account.startingBalance) * 100 
            : 100,
        spy: spy.equityCurve[i] ? spy.equityCurve[i].equity * 100 : null,
    }));

    const formatXAxisTick = (tickItem: string) => {
        const date = new Date(tickItem);
        return `${date.getMonth() + 1}/${date.getDate()}`;
    };

    return (
        <div className={`glass-card border-border-color bg-surface-elevated backdrop-blur-xl rounded-2xl p-4 ${className}`}>
            {/* Header */}
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h4 className="text-sm font-semibold text-gray-100">
                        Benchmark Comparison
                    </h4>
                    <p className="text-xs text-text-muted">vs S&P 500 (SPY)</p>
                </div>
                <div className="text-right">
                    {comparison.outperformingSPY !== null && (
                        <div className={`flex items-center gap-1 ${comparison.outperformingSPY ? 'text-profit' : 'text-loss'}`}>
                            {comparison.outperformingSPY ? (
                                <TrendingUp className="w-4 h-4" />
                            ) : (
                                <TrendingDown className="w-4 h-4" />
                            )}
                            <span className="text-sm font-bold">
                                {comparison.outperformingSPY ? 'Outperforming' : 'Underperforming'}
                            </span>
                        </div>
                    )}
                    {comparison.spyDifferencePercent !== null && (
                        <p className={`text-xs font-mono ${comparison.spyDifferencePercent >= 0 ? 'text-profit' : 'text-loss'}`}>
                            {comparison.spyDifferencePercent >= 0 ? '+' : ''}{formatPercent(comparison.spyDifferencePercent, 1)} vs SPY
                        </p>
                    )}
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center p-2 rounded-lg bg-surface-elevated">
                    <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Your Return</p>
                    <p className={`text-sm font-bold font-mono ${account.returnPercent >= 0 ? 'text-profit' : 'text-loss'}`}>
                        {account.returnPercent >= 0 ? '+' : ''}{formatPercent(account.returnPercent, 1)}
                    </p>
                </div>
                <div className="text-center p-2 rounded-lg bg-surface-elevated">
                    <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">SPY Return</p>
                    <p className="text-sm font-bold font-mono text-blue-400">
                        {spy.returnPercent >= 0 ? '+' : ''}{formatPercent(spy.returnPercent, 1)}
                    </p>
                </div>
                <div className="text-center p-2 rounded-lg bg-surface-elevated">
                    <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Difference</p>
                    <p className={`text-sm font-bold font-mono ${(comparison.spyDifferencePercent ?? 0) >= 0 ? 'text-profit' : 'text-loss'}`}>
                        {(comparison.spyDifferencePercent ?? 0) >= 0 ? '+' : ''}{formatPercent(comparison.spyDifferencePercent ?? 0, 1)}
                    </p>
                </div>
            </div>

            {/* Chart */}
            <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={normalizedAccountEquity} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                        <defs>
                            <linearGradient id="accountFillGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={chartColors.profit} stopOpacity={0.2} />
                                <stop offset="100%" stopColor={chartColors.profit} stopOpacity={0.02} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke="rgba(255, 255, 255, 0.02)"
                        />
                        <XAxis
                            dataKey="time"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: chartColors.textMuted, fontSize: 8 }}
                            tickFormatter={formatXAxisTick}
                            interval="preserveStartEnd"
                            minTickGap={50}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: chartColors.textSecondary, fontSize: 9, fontFamily: 'monospace' }}
                            tickFormatter={(v) => `${v.toFixed(0)}`}
                            width={35}
                            domain={['dataMin - 5', 'dataMax + 5']}
                        />
                        <Tooltip
                            content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                    const accountVal = payload.find(p => p.dataKey === 'account')?.value;
                                    const spyVal = payload.find(p => p.dataKey === 'spy')?.value;
                                    const accountNum = typeof accountVal === 'number' ? accountVal : parseFloat(String(accountVal));
                                    const spyNum = typeof spyVal === 'number' ? spyVal : parseFloat(String(spyVal));
                                    return (
                                        <div className="glass-card p-3 border-primary/20 bg-black/80 backdrop-blur-md">
                                            <p className="text-[10px] text-text-muted mb-1">{label}</p>
                                            <p className="text-sm font-bold text-primary">
                                                You: {isNaN(accountNum) ? 'N/A' : fmtDecimals(accountNum, 1)}
                                            </p>
                                            <p className="text-sm font-bold text-blue-400">
                                                SPY: {isNaN(spyNum) ? 'N/A' : fmtDecimals(spyNum, 1)}
                                            </p>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Area
                            type="monotone"
                            dataKey="account"
                            stroke={chartColors.profit}
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#accountFillGradient)"
                            animationDuration={500}
                        />
                        <Line
                            type="monotone"
                            dataKey="spy"
                            stroke="#60a5fa"
                            strokeWidth={2}
                            strokeDasharray="4 2"
                            dot={false}
                            animationDuration={500}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="flex justify-center gap-6 mt-2">
                <div className="flex items-center gap-1">
                    <div className="w-3 h-0.5 bg-primary rounded" />
                    <span className="text-[10px] text-text-muted">Your Account</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-0.5 bg-blue-400 rounded" style={{ borderStyle: 'dashed' }} />
                    <span className="text-[10px] text-text-muted">S&P 500</span>
                </div>
            </div>
        </div>
    );
}