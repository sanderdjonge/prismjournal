'use client';

import Gauge from '@/components/dashboard/Gauge';
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ComposedChart, Line,
} from 'recharts';
import { Target, Zap } from 'lucide-react';
import { useCurrency } from '@/lib/currency';
import { useAccounts } from '@/hooks/useAccounts';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useExcursionTrades } from '@/hooks/useExcursionTrades';
import BEMetricsWidget from '@/components/analytics/BEMetricsWidget';
import { ExcursionQuadrantPlot } from '@/components/analytics/ExcursionQuadrantPlot';
import { TradingHoursWidget } from '@/components/analytics/TradingHoursWidget';
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
    const expectancyData = data.expectancyData;
    const sessionData = data.sessionData;

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

            {/* Gauges Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-6 flex items-center justify-center">
                    <Gauge value={data.profitFactor} max={5} label="Profit Factor" subLabel="Live Compute" variant="primary" />
                </div>
                <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-6 flex items-center justify-center">
                    <Gauge value={data.expectancy} max={3000} label="Expectancy" subLabel="Avg P&L per Trade" variant="accent" />
                </div>
                <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-6 flex items-center justify-center">
                    <Gauge value={data.avgRR} max={5} label="Risk / Reward" subLabel="Mean Realized" variant="secondary" />
                </div>
            </div>

            {/* SL Management & Breakeven Metrics */}
            <BEMetricsWidget accountId={selectedAccountId} />

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Asset Distribution */}
                <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-sm font-semibold text-gray-100">Edge Profile by Symbol</h3>
                            <p className="text-xs text-gray-500">Performance breakdown by instrument</p>
                        </div>
                        <Target size={14} className="text-gray-700" />
                    </div>
                    <div className="h-[200px]">
                        {symbolData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={symbolData}>
                                    <XAxis dataKey="symbol" axisLine={false} tickLine={false} tick={{ fill: '#4b5563', fontSize: 8, fontWeight: 900 }} />
                                    <YAxis hide />
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
                                    <Bar dataKey="profit" radius={[2, 2, 0, 0]}>
                                        {symbolData.map((entry, i) => (
                                            <Cell key={i} fill={entry.profit >= 0 ? '#4ade80' : '#f87171'} fillOpacity={0.6} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-700 text-[10px] font-black uppercase tracking-widest">No data yet</div>
                        )}
                    </div>
                </div>

                {/* Expectancy Evolution */}
                <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-sm font-semibold text-gray-100">Edge Evolution</h3>
                            <p className="text-xs text-gray-500">Expectancy trend over time</p>
                        </div>
                        <Zap size={14} className="text-primary/40" />
                    </div>
                    <div className="h-[200px]">
                        {expectancyData.length > 1 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={expectancyData}>
                                    <XAxis dataKey="trade" axisLine={false} tickLine={false} tick={{ fill: '#4b5563', fontSize: 8, fontWeight: 900 }} />
                                    <YAxis hide />
                                    <Tooltip
                                        cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
                                        content={({ active, payload }) => {
                                            if (!active || !payload?.length) return null;
                                            const d = payload[0].payload;
                                            return (
                                                <div className="bg-black/90 border border-white/10 rounded-lg px-3 py-2 text-[10px] font-black space-y-1">
                                                    <p className="text-gray-400">Trade #{d.trade}</p>
                                                    <p className={d.val >= 0 ? 'text-profit' : 'text-loss'}>
                                                        Avg P&L: {d.val >= 0 ? '+' : ''}{formatAmount(d.val)}
                                                    </p>
                                                </div>
                                            );
                                        }}
                                    />
                                    <Line type="monotone" dataKey="val" stroke="#7000ff" strokeWidth={2} dot={false} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-700 text-[10px] font-black uppercase tracking-widest">Need more trades</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Exit Quality Quadrant */}
            <ExcursionQuadrantPlot trades={excursionTrades} />

            {/* Bottom Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Trading Hours Widget */}
                <div className="lg:col-span-2">
                    <TradingHoursWidget data={sessionData} />
                </div>

                {/* Risk Degradation */}
                <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-6 flex flex-col justify-between">
                    <div>
                        <h3 className="text-sm font-semibold text-gray-100 mb-1">Mean Loss / Trade</h3>
                        <p className="text-xs text-gray-500 mb-4">Average losing trade amount</p>
                        <p className="text-2xl font-black text-white tracking-tighter">
                            {formatAmount(data.meanDrawdown)}
                        </p>
                    </div>
                    <div className="space-y-4">
                        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-loss" style={{ width: data.profitFactor ? `${Math.min(100, (1 / data.profitFactor) * 100)}%` : '0%' }} />
                        </div>
                        <p className="text-[8px] font-bold text-gray-600 italic leading-tight">
                            {data.profitFactor >= 2 ? '"Strong risk control maintained."' : '"Focus on improving your edge."'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
