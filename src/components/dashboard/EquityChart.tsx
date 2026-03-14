'use client';

import React from 'react';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid
} from 'recharts';
import { useCurrency } from '@/lib/currency';

type DataPoint = {
    time: string;
    value: number;
};

type EquityChartProps = {
    data: DataPoint[];
    className?: string;
};

type TooltipProps = {
    active?: boolean;
    payload?: Array<{ value: number }>;
    label?: string;
    symbol: string;
};

const CustomTooltip = ({ active, payload, label, symbol }: TooltipProps) => {
    if (active && payload && payload.length) {
        return (
            <div className="glass-card p-4 border-primary/20 bg-black/80 backdrop-blur-md">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">{label}</p>
                <p className="text-xl font-black text-primary tracking-tighter">
                    {symbol}{payload[0].value.toLocaleString()}
                </p>
            </div>
        );
    }
    return null;
};

export default function EquityChart({ data, className = '' }: EquityChartProps) {
    const { formatAmount, formatPnl, symbol } = useCurrency();
    const totalPnL = data.length > 0 ? data[data.length - 1].value - data[0].value : 0;
    const currentBalance = data.length > 0 ? data[data.length - 1].value : 0;

    return (
        <div className={`flex flex-col h-full w-full group overflow-hidden relative ${className}`}>
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[100px] -mr-32 -mt-32 pointer-events-none" />

            {/* Header Info - Simplified for High Density */}
            <div className="flex justify-between items-start mb-4 z-10 p-4">
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
                    <p className={`text-sm font-mono font-bold ${totalPnL >= 0 ? 'text-accent' : 'text-danger'}`}>
                        {formatPnl(totalPnL)}
                    </p>
                </div>
            </div>

            {/* Main Curve Area */}
            <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#00ff88" stopOpacity={0.1} />
                                <stop offset="95%" stopColor="#00ff88" stopOpacity={0} />
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
                            dy={5}
                        />
                        <YAxis hide={true} domain={['dataMin - 1000', 'dataMax + 1000']} />
                        <Tooltip content={<CustomTooltip symbol={symbol} />} />
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke="#00ff88"
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
