'use client';

import { useState } from 'react';
import Gauge from '@/components/dashboard/Gauge';
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ComposedChart, Line,
} from 'recharts';
import { Target, Zap, X } from 'lucide-react';
import { useCurrency } from '@/lib/currency';
import { useAccounts } from '@/hooks/useAccounts';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useExcursionTrades } from '@/hooks/useExcursionTrades';
import BEMetricsWidget from '@/components/analytics/BEMetricsWidget';
import { ExcursionQuadrantPlot } from '@/components/analytics/ExcursionQuadrantPlot';

export function AnalyticsContent() {
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const { formatAmount } = useCurrency();
    const { selectedAccountId } = useAccounts();

    const { data } = useAnalytics({
        from: dateFrom || undefined,
        to: dateTo || undefined,
        account: selectedAccountId,
    });

    const { data: excursionTrades = [] } = useExcursionTrades({
        from: dateFrom || undefined,
        to: dateTo || undefined,
        account: selectedAccountId,
    });

    const symbolData = data.symbolData;
    const expectancyData = data.expectancyData;
    const sessionData = data.sessionData;
    const maxSession = Math.max(...sessionData.map(s => s.count), 1);

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

            {/* Date Range Selector */}
            <div className="flex items-center gap-4 glass-card p-4 border-white/5 bg-white/5 rounded-xl">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Date Range</span>
                <input
                    type="date"
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                    className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm font-bold text-white outline-none focus:border-primary/50"
                />
                <span className="text-gray-600 font-bold">→</span>
                <input
                    type="date"
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                    className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm font-bold text-white outline-none focus:border-primary/50"
                />
                {(dateFrom || dateTo) && (
                    <button
                        onClick={() => { setDateFrom(''); setDateTo(''); }}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-white font-bold uppercase tracking-widest transition-colors"
                    >
                        <X size={12} />
                        Clear
                    </button>
                )}
            </div>

            {/* Tag Exclusion Filter */}
            {tagsData?.tags && tagsData.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 glass-card p-4 border-white/5 bg-white/5 rounded-xl">
                    <div className="flex items-center gap-2">
                        <Filter size={14} className="text-gray-500" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Exclude Tags</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {tagsData.tags.map(tag => {
                            const isExcluded = excludedTagIds.includes(tag.id);
                            return (
                                <button
                                    key={tag.id}
                                    onClick={() => {
                                        if (isExcluded) {
                                            setExcludedTagIds(prev => prev.filter(id => id !== tag.id));
                                        } else {
                                            setExcludedTagIds(prev => [...prev, tag.id]);
                                        }
                                    }}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border ${
                                        isExcluded
                                            ? 'bg-red-500/20 border-red-500/40 text-red-400'
                                            : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                                    }`}
                                    style={!isExcluded && tag.color ? { borderColor: tag.color + '40', color: tag.color } : {}}
                                >
                                    {isExcluded && <X size={10} className="inline mr-1" />}
                                    {tag.name}
                                </button>
                            );
                        })}
                    </div>
                    {excludedTagIds.length > 0 && (
                        <button
                            onClick={() => setExcludedTagIds([])}
                            className="text-[10px] text-gray-500 hover:text-white font-bold uppercase tracking-widest transition-colors"
                        >
                            Clear All
                        </button>
                    )}
                </div>
            )}

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
                        <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500">Edge Profile by Symbol</h3>
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
                        <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500">Edge Evolution</h3>
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
                {/* Session Distribution */}
                <div className="lg:col-span-2 glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-6">
                    <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500 mb-2">Trades by Hour of Day</h3>
                    <p className="text-[8px] text-gray-600 font-bold mb-4">When you open trades — find your most active trading hours</p>
                    <div className="flex items-end gap-1 h-24 mb-2">
                        {sessionData.map((s) => (
                            <div
                                key={s.hour}
                                className="flex-1 rounded-t transition-all group/bar relative cursor-default"
                                style={{ height: s.count > 0 ? `${Math.max((s.count / maxSession) * 100, 4)}%` : '4px' }}
                            >
                                <div className={`w-full h-full rounded-t ${s.count > 0 ? 'bg-primary/40 group-hover/bar:bg-primary/70' : 'bg-white/5'} transition-colors`} />
                                {s.count > 0 && (
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded bg-black/90 border border-white/10 text-[9px] font-black text-white whitespace-nowrap opacity-0 group-hover/bar:opacity-100 transition-opacity pointer-events-none z-10">
                                        {s.hour.toString().padStart(2, '0')}:00
                                        <span className="block text-primary text-center">{s.count} trade{s.count !== 1 ? 's' : ''}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between text-[7px] font-black text-gray-700 uppercase tracking-widest">
                        <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:00</span>
                    </div>
                </div>

                {/* Risk Degradation */}
                <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-6 flex flex-col justify-between">
                    <div>
                        <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500 mb-4">Mean Loss / Trade</h3>
                        <p className="text-2xl font-black text-white tracking-tighter">
                            {formatAmount(data.meanDrawdown)}
                        </p>
                        <p className="text-[8px] font-black uppercase tracking-widest text-gray-600 mt-1">Avg Losing Trade</p>
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
