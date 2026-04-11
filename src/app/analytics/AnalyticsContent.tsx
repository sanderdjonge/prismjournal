'use client';

import Gauge from '@/components/dashboard/Gauge';
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from 'recharts';
import { Target, ArrowDownLeft } from 'lucide-react';
import { useCurrency } from '@/lib/currency';
import { useAccounts } from '@/hooks/useAccounts';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useExcursionTrades } from '@/hooks/useExcursionTrades';
import BEMetricsWidget from '@/components/analytics/BEMetricsWidget';
import { ExcursionQuadrantPlot } from '@/components/analytics/ExcursionQuadrantPlot';
import { WhatIfSimulator } from '@/components/analytics/WhatIfSimulator';
import BenchmarkComparison from '@/components/analytics/BenchmarkComparison';
import { useFilters, FilterConfig } from '@/hooks/useFilters';
import { FilterChipBar } from '@/components/filters/FilterChipBar';

const ANALYTICS_FILTER_CONFIG: FilterConfig[] = [
    { id: 'dateRange', label: 'Date Range', type: 'date-range', paramKeys: ['from', 'to'] },
    { id: 'account', label: 'Account', type: 'single-select' },
]

export function AnalyticsContent() {
    const { formatAmount } = useCurrency();
    const { selectedAccountId, accounts } = useAccounts();
    const { activeFilters, addFilter, removeFilter, setMultiFilter, clearAll, getParam } = useFilters(ANALYTICS_FILTER_CONFIG);

    const { data } = useAnalytics({
        from: getParam('from') || undefined,
        to: getParam('to') || undefined,
        account: getParam('account') || undefined,
    });

    const { data: excursionTrades = [] } = useExcursionTrades({
        from: getParam('from') || undefined,
        to: getParam('to') || undefined,
        account: getParam('account') || undefined,
    });

    const symbolData = data.symbolData;

    return (
        <div className="space-y-6 pb-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-1">
                <div>
                    <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">Vector Analytics</h1>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mt-2">
                        Advanced Statistical Performance Audit // Live Compute
                    </p>
                </div>
            </div>

            {/* Filters */}
            <FilterChipBar
                config={ANALYTICS_FILTER_CONFIG}
                activeFilters={activeFilters}
                onAdd={addFilter}
                onSetMulti={setMultiFilter}
                onRemove={removeFilter}
                onClear={clearAll}
                dynamicOptions={{
                    account: accounts.map(a => ({ value: a.id, label: a.name })),
                }}
            />

            {/* Gauges Row - 4 columns with Mean Loss */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-6 flex items-center justify-center">
                    <Gauge value={data.profitFactor} max={5} label="Profit Factor" subLabel="Live Compute" variant="primary" />
                </div>
                <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-6 flex items-center justify-center">
                    <Gauge value={data.expectancy} max={3000} label="Expectancy" subLabel="Avg P&L per Trade" variant="accent" />
                </div>
                <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-6 flex items-center justify-center">
                    <Gauge value={data.avgRR} max={5} label="Risk / Reward" subLabel="Mean Realized" variant="secondary" />
                </div>
                <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-5 flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-center text-gray-500 mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest">Mean Loss</span>
                            <ArrowDownLeft size={12} />
                        </div>
                        <p className="text-xl font-black tracking-tighter text-loss">{formatAmount(data.meanDrawdown)}</p>
                    </div>
                    <div className="space-y-2 mt-3">
                        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-loss" style={{ width: data.profitFactor ? `${Math.min(100, (1 / data.profitFactor) * 100)}%` : '0%' }} />
                        </div>
                        <p className="text-[10px] font-bold text-gray-600 italic leading-tight">
                            {data.profitFactor >= 2 ? '"Strong risk control"' : '"Improve your edge"'}
                        </p>
                    </div>
                </div>
            </div>

            {/* SL Management & Benchmark - 2 columns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <BEMetricsWidget accountId={selectedAccountId} />
                <BenchmarkComparison accountId={selectedAccountId ?? undefined} />
            </div>

            {/* Exit Quality (3 cols) & Edge Profile (1 col) */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Exit Quality Quadrant - 3 columns */}
                <div className="lg:col-span-3">
                    <ExcursionQuadrantPlot trades={excursionTrades} />
                </div>

                {/* Asset Distribution - 1 column */}
                <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-sm font-semibold text-gray-100">Edge Profile</h3>
                            <p className="text-[10px] text-gray-500">By symbol</p>
                        </div>
                        <Target size={14} className="text-gray-700" />
                    </div>
                    <div className="h-[250px]">
                        {symbolData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={symbolData} layout="vertical">
                                    <XAxis type="number" hide />
                                    <YAxis 
                                        dataKey="symbol" 
                                        type="category" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fill: '#9ca3af', fontSize: 10, fontWeight: 600 }} 
                                        width={60}
                                    />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                                        content={({ active, payload }) => {
                                            if (!active || !payload?.length) return null;
                                            const d = payload[0].payload;
                                            return (
                                                <div className="bg-black/90 border border-white/10 rounded-lg px-3 py-2 text-[10px] font-black space-y-1">
                                                    <p className="text-white uppercase tracking-widest">{d.symbol}</p>
                                                    <p className={d.profit >= 0 ? 'text-profit' : 'text-loss'}>
                                                        P&L: {d.profit >= 0 ? '+' : ''}{formatAmount(d.profit)}
                                                    </p>
                                                    <p className="text-gray-400">Win rate: {d.winRate}%</p>
                                                </div>
                                            );
                                        }}
                                    />
                                    <Bar dataKey="profit" radius={[0, 2, 2, 0]}>
                                        {symbolData.map((entry, i) => (
                                            <Cell key={i} fill={entry.profit >= 0 ? 'var(--profit)' : 'var(--loss)'} fillOpacity={0.8} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-700 text-[10px] font-black uppercase tracking-widest">No data yet</div>
                        )}
                    </div>
                </div>
            </div>

            {/* What-If Simulator - at bottom */}
            <WhatIfSimulator />
        </div>
    );
}
