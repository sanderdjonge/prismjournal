'use client';

import React, { useMemo } from 'react';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
} from 'recharts';
import { useCurrency } from '@/lib/currency';

type DataPoint = {
    time: string;
    value: number;
};

type EquityChartProps = {
    data: DataPoint[];
    className?: string;
    dateFormat?: 'DD-MM-YYYY' | 'MM-DD-YYYY' | 'YYYY-MM-DD';
};

type TooltipProps = {
    active?: boolean;
    payload?: Array<{ value: number }>;
    label?: string;
    symbol: string;
    dateFormat?: 'DD-MM-YYYY' | 'MM-DD-YYYY' | 'YYYY-MM-DD';
};

// Softer, muted colors for the equity line
const COLORS = {
    positive: '#4ade80', // softer green (tailwind green-400)
    negative: '#f87171', // softer red (tailwind red-400)
    positiveFill: 'rgba(74, 222, 128, 0.1)', // softer green fill
    negativeFill: 'rgba(248, 113, 113, 0.1)', // softer red fill
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

const CustomTooltip = ({ active, payload, label, symbol, dateFormat = 'DD-MM-YYYY' }: TooltipProps) => {
    if (active && payload && payload.length) {
        const formattedLabel = formatDate(label || '', dateFormat);
        return (
            <div className="glass-card p-4 border-primary/20 bg-black/80 backdrop-blur-md">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">{formattedLabel}</p>
                <p className="text-xl font-black text-primary tracking-tighter">
                    {symbol}{payload[0].value.toLocaleString()}
                </p>
            </div>
        );
    }
    return null;
};


export default function EquityChart({ data, className = '', dateFormat = 'DD-MM-YYYY' }: EquityChartProps) {
    const { formatAmount, formatPnl, symbol } = useCurrency();
    const totalPnL = data.length > 0 ? data[data.length - 1].value - data[0].value : 0;
    const currentBalance = data.length > 0 ? data[data.length - 1].value : 0;

    // Determine if the overall equity is positive or negative for coloring
    const isPositive = totalPnL >= 0;
    const lineColor = isPositive ? COLORS.positive : COLORS.negative;
    const fillColor = isPositive ? COLORS.positiveFill : COLORS.negativeFill;

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

    return (
        <div className={`flex flex-col h-full w-full group relative ${className}`}>
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[100px] -mr-32 -mt-32 pointer-events-none" />

            {/* Header Info - Simplified for High Density */}
            <div className="flex justify-between items-start mb-2 z-10 p-4 pb-0">
                <div>
                    <h4 className="text-[9px] font-black uppercase tracking-widest text-gray-500 group-hover:text-gray-300 transition-colors">
                        Equity Evolution
                    </h4>
                    <div className="mt-1">
                        <h2 className="text-2xl font-black font-mono tracking-tighter text-white">
                            {formatAmount(currentBalance)}
                        </h2>
                    </div>
                </div>

                <div className="text-right">
                    <p className="text-[8px] font-black uppercase tracking-widest text-gray-600">Total P&L</p>
                    <p className={`text-sm font-mono font-bold ${totalPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
                        {formatPnl(totalPnL)}
                    </p>
                </div>
            </div>

            {/* Main Curve Area - Increased height utilization */}
            <div className="flex-1 w-full min-h-0 pl-1 pr-2">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={processedData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                        <defs>
                            <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={lineColor} stopOpacity={0.15} />
                                <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
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
                            tick={{ fill: '#4b5563', fontSize: 8, fontWeight: 900 }}
                            tickFormatter={formatXAxisTick}
                            dy={5}
                            // Ensure even spacing by using index-based ticks
                            interval="preserveStartEnd"
                            minTickGap={50}
                        />
                        <YAxis
                            dataKey="value"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#6b7280', fontSize: 9, fontWeight: 600, fontFamily: 'monospace' }}
                            tickFormatter={formatYAxisValue}
                            width={58}
                            domain={yAxisDomain}
                        />
                        <Tooltip content={<CustomTooltip symbol={symbol} dateFormat={dateFormat} />} />
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke={lineColor}
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#equityGradient)"
                            animationDuration={1000}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
