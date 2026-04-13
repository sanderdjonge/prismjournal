'use client';

import React, { useMemo } from 'react';
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
import { useCurrency } from '@/lib/currency';
import { useTiltmeterHistory } from '@/hooks/useTiltmeter';
import { getChartColor } from '@/lib/chart-colors';

type DataPoint = {
    time: string;
    value: number;
};

type EquityChartProps = {
    data: DataPoint[];
    className?: string;
    dateFormat?: 'DD-MM-YYYY' | 'MM-DD-YYYY' | 'YYYY-MM-DD';
    showTiltmeter?: boolean;
    accountId?: string | null;
    showHeader?: boolean;
};

type TooltipProps = {
    active?: boolean;
    payload?: Array<{ value: number; dataKey: string }>;
    label?: string;
    symbol: string;
    dateFormat?: 'DD-MM-YYYY' | 'MM-DD-YYYY' | 'YYYY-MM-DD';
    showTiltmeter?: boolean;
};

// Format date according to preference
const formatDate = (dateStr: string, format: 'DD-MM-YYYY' | 'MM-DD-YYYY' | 'YYYY-MM-DD'): string => {
    // Parse the date string - handle both ISO format and simple date format
    let date: Date;
    if (dateStr.includes('T')) {
        date = new Date(dateStr);
    } else if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            // Assume YYYY-MM-DD format from backend
            date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        } else {
            date = new Date(dateStr);
        }
    } else {
        date = new Date(dateStr);
    }
    
    if (isNaN(date.getTime())) {
        return dateStr; // Return original if parsing fails
    }
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    switch (format) {
        case 'DD-MM-YYYY':
            return `${day}-${month}-${year}`;
        case 'MM-DD-YYYY':
            return `${month}-${day}-${year}`;
        case 'YYYY-MM-DD':
        default:
            return `${year}-${month}-${day}`;
    }
};

const CustomTooltip = ({ active, payload, label, symbol, dateFormat = 'DD-MM-YYYY', showTiltmeter = false }: TooltipProps) => {
    if (active && payload && payload.length) {
        const formattedLabel = formatDate(label || '', dateFormat);
        const equityData = payload.find(p => p.dataKey === 'value');
        const tiltmeterData = payload.find(p => p.dataKey === 'tiltmeter');
        
        return (
            <div className="glass-card p-4 border-primary/20 bg-black/80 backdrop-blur-md">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">{formattedLabel}</p>
                <p className="text-xl font-black text-primary tracking-tighter">
                    {equityData ? `${symbol}${equityData.value.toLocaleString()}` : 'N/A'}
                </p>
                {showTiltmeter && tiltmeterData?.value != null && (
                    <p className="text-sm font-bold text-amber-500 mt-1">
                        Tilt: {tiltmeterData.value.toFixed(0)}
                    </p>
                )}
            </div>
        );
    }
    return null;
};


export default function EquityChart({ data, className = '', dateFormat = 'DD-MM-YYYY', showTiltmeter = false, accountId = null, showHeader = true }: EquityChartProps) {
    const { formatAmount, formatPnl, symbol } = useCurrency();
    const chartColors = {
        profit: getChartColor('profit'),
        loss: getChartColor('loss'),
        textSecondary: getChartColor('text-secondary'),
        textMuted: getChartColor('text-muted'),
        warning: getChartColor('warning'),
    };
    
    // Calculate date range from sorted data to ensure correct range for tiltmeter fetch
    const dateRange = useMemo(() => {
        if (data.length === 0) return { start: undefined, end: undefined };
        const sorted = [...data].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
        return {
            start: new Date(sorted[0].time),
            end: new Date(sorted[sorted.length - 1].time)
        };
    }, [data]);
    
    // Fetch tiltmeter history if enabled
    const { data: tiltmeterData, isLoading: isLoadingTiltmeter, isError: isTiltmeterError } = useTiltmeterHistory(
        accountId,
        dateRange.start,
        dateRange.end,
        showTiltmeter
    );
    // currentBalance = total cumulative P&L (last data point); the curve starts conceptually at 0
    const currentBalance = data.length > 0 ? data[data.length - 1].value : 0;
    const totalPnL = currentBalance;

    // Calculate dynamic Y-axis domain to make variations more visible
    // Use tight percentage-based padding to emphasize curve variations
    const calculateYAxisDomain = () => {
        if (data.length === 0) return [-1000, 1000];
        
        const values = data.map(d => d.value);
        const dataMin = Math.min(...values);
        const dataMax = Math.max(...values);
        const range = dataMax - dataMin;
        
        // Use very tight padding (3%) to make variations more prominent
        // For flat lines or very small ranges, use a minimum padding based on the data scale
        const dataScale = Math.max(Math.abs(dataMin), Math.abs(dataMax));
        const minPadding = dataScale * 0.02 || 50; // Minimum 2% of scale
        const padding = Math.max(range * 0.03, minPadding); // 3% padding, minimum 2% of scale
        
        return [Math.floor(dataMin - padding), Math.ceil(dataMax + padding)];
    };

    const yAxisDomain = calculateYAxisDomain();

    // Where the zero line sits within the Y-axis range, as a 0–1 fraction from top.
    // Drives the gradient split: green above zero, red below zero.
    const zeroGradientOffset = useMemo(() => {
        const [yMin, yMax] = yAxisDomain;
        if (yMax === yMin) return 0.5;
        const offset = (yMax - 0) / (yMax - yMin);
        return Math.min(1, Math.max(0, offset));
    }, [yAxisDomain]);

    // Format Y-axis values as compact currency
    const formatYAxisValue = (value: number) => {
        const absValue = Math.abs(value);
        if (absValue >= 1000000) {
            return `${symbol}${(value / 1000000).toFixed(1)}M`;
        }
        if (absValue >= 1000) {
            return `${symbol}${(value / 1000).toFixed(0)}K`;
        }
        return `${symbol}${value.toFixed(0)}`;
    };

    // Custom X-axis tick formatter
    const formatXAxisTick = (tickItem: string) => {
        return formatDate(tickItem, dateFormat);
    };

    // Process data to ensure even spacing by filling in missing dates
    const processedData = useMemo(() => {
        if (data.length === 0) return [];
        
        // Sort data by date
        const sortedData = [...data].sort((a, b) => {
            const dateA = new Date(a.time);
            const dateB = new Date(b.time);
            return dateA.getTime() - dateB.getTime();
        });

        // If we have fewer than 2 data points, return as-is
        if (sortedData.length < 2) return sortedData;

        // Check if dates are consecutive (daily data)
        const firstDate = new Date(sortedData[0].time);
        const lastDate = new Date(sortedData[sortedData.length - 1].time);
        const dayDiff = Math.round((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        // If the number of data points matches the day range, data is already complete
        if (sortedData.length === dayDiff) return sortedData;

        // Fill in missing dates with interpolated values
        const filledData: DataPoint[] = [];
        const dataMap = new Map<string, number>();
        
        // Create a map of existing dates to values
        sortedData.forEach(point => {
            const dateKey = new Date(point.time).toDateString();
            dataMap.set(dateKey, point.value);
        });

        // Iterate through all dates in range
        const currentDate = new Date(firstDate);
        while (currentDate <= lastDate) {
            const dateKey = currentDate.toDateString();
            if (dataMap.has(dateKey)) {
                filledData.push({
                    time: currentDate.toISOString().split('T')[0],
                    value: dataMap.get(dateKey)!
                });
            } else {
                // Interpolate value for missing date
                // Find the previous and next available values
                const prevIndex = filledData.length - 1;
                const prevValue = prevIndex >= 0 ? filledData[prevIndex].value : sortedData[0].value;
                
                // Find next available value
                let nextValue = prevValue;
                for (let i = 0; i < sortedData.length; i++) {
                    const checkDate = new Date(sortedData[i].time);
                    if (checkDate > currentDate) {
                        nextValue = sortedData[i].value;
                        break;
                    }
                }
                
                // Use linear interpolation
                const interpolatedValue = (prevValue + nextValue) / 2;
                filledData.push({
                    time: currentDate.toISOString().split('T')[0],
                    value: interpolatedValue
                });
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }

        return filledData;
    }, [data]);
    
    // Merge tiltmeter data with equity data for overlay
    const chartData = useMemo(() => {
        if (!showTiltmeter || !tiltmeterData?.snapshots) return processedData;
        
        // Helper to normalize date strings to YYYY-MM-DD format consistently
        const getDateKey = (date: string | Date): string => {
            if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
                return date;
            }
            return new Date(date).toISOString().split('T')[0];
        };
        
        // Create a map of tiltmeter scores by date
        const tiltmeterByDate = new Map<string, number>();
        tiltmeterData.snapshots.forEach(s => {
            const dateKey = getDateKey(s.date);
            tiltmeterByDate.set(dateKey, s.score);
        });
        
        // Merge tiltmeter data into equity data
        return processedData.map(point => ({
            ...point,
            tiltmeter: tiltmeterByDate.get(getDateKey(point.time)) ?? null,
        }));
    }, [processedData, tiltmeterData, showTiltmeter]);

    return (
        <div className={`flex flex-col h-full w-full group relative ${className}`}>
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[100px] -mr-32 -mt-32 pointer-events-none" />

            {/* Header Info - Simplified for High Density */}
            {showHeader && (
            <div className="flex justify-between items-start mb-2 z-10 p-4 pb-0">
                <div>
                    <h4 className="text-sm font-semibold text-gray-100">
                        Equity Evolution
                    </h4>
                    <p className="text-xs text-gray-500">Account balance over time</p>
                    <div className="mt-1">
                        <h2 className="text-2xl font-black font-mono tracking-tighter text-white">
                            {formatAmount(currentBalance)}
                        </h2>
                    </div>
                </div>

                <div className="text-right">
                    <p className="text-xs text-gray-500">Total P&L</p>
                    <p className={`text-sm font-mono font-bold ${totalPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
                        {formatPnl(totalPnL)}
                    </p>
                    {/* Tiltmeter loading/error indicator */}
                    {showTiltmeter && (
                        <div className="mt-1">
                            {isLoadingTiltmeter && (
                                <p className="text-[8px] font-medium text-amber-500/60 animate-pulse">
                                    Loading tilt...
                                </p>
                            )}
                            {isTiltmeterError && (
                                <p className="text-[8px] font-medium text-red-400" title="Failed to load tiltmeter data">
                                    ⚠ Tilt error
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
            )}

            {/* Main Curve Area - Increased height utilization */}
            <div className="flex-1 w-full min-h-0 pl-1 pr-2">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 10, right: showTiltmeter ? 50 : 10, left: 0, bottom: 5 }}>
                        <defs>
                            <linearGradient id="equityFillGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={chartColors.profit} stopOpacity={0.18} />
                                <stop offset={`${zeroGradientOffset * 100}%`} stopColor={chartColors.profit} stopOpacity={0.04} />
                                <stop offset={`${zeroGradientOffset * 100}%`} stopColor={chartColors.loss} stopOpacity={0.04} />
                                <stop offset="100%" stopColor={chartColors.loss} stopOpacity={0.18} />
                            </linearGradient>
                            <linearGradient id="equityStrokeGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={chartColors.profit} stopOpacity={1} />
                                <stop offset={`${zeroGradientOffset * 100}%`} stopColor={chartColors.profit} stopOpacity={1} />
                                <stop offset={`${zeroGradientOffset * 100}%`} stopColor={chartColors.loss} stopOpacity={1} />
                                <stop offset="100%" stopColor={chartColors.loss} stopOpacity={1} />
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
                            tick={{ fill: chartColors.textMuted, fontSize: 8, fontWeight: 900 }}
                            tickFormatter={formatXAxisTick}
                            dy={5}
                            // Ensure even spacing by using index-based ticks
                            interval="preserveStartEnd"
                            minTickGap={50}
                        />
                        <YAxis
                            yAxisId="equity"
                            dataKey="value"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: chartColors.textSecondary, fontSize: 9, fontWeight: 600, fontFamily: 'monospace' }}
                            tickFormatter={formatYAxisValue}
                            width={58}
                            domain={yAxisDomain}
                        />
                        {showTiltmeter && (
                            <YAxis
                                yAxisId="tiltmeter"
                                orientation="right"
                                domain={[0, 100]}
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: chartColors.warning, fontSize: 9, fontWeight: 600, fontFamily: 'monospace' }}
                                tickFormatter={(v) => `${v}`}
                                width={40}
                            />
                        )}
                        <Tooltip content={<CustomTooltip symbol={symbol} dateFormat={dateFormat} showTiltmeter={showTiltmeter} />} />
                        <Area
                            yAxisId="equity"
                            type="monotone"
                            dataKey="value"
                            stroke="url(#equityStrokeGradient)"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#equityFillGradient)"
                            animationDuration={1000}
                        />
                        {showTiltmeter && (
                            <Line
                                yAxisId="tiltmeter"
                                type="monotone"
                                dataKey="tiltmeter"
                                stroke={chartColors.warning}
                                strokeWidth={2}
                                strokeDasharray="4 2"
                                dot={false}
                                connectNulls
                                animationDuration={500}
                            />
                        )}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
