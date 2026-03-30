'use client';

import EquityChart from '@/components/dashboard/EquityChart';
import Gauge from '@/components/dashboard/Gauge';
import { TrendingUp, ArrowDownLeft, Activity, Target, BarChart3 } from 'lucide-react';
import { useCurrency } from '@/lib/currency';
import { useAccounts } from '@/hooks/useAccounts';
import { usePerformance } from '@/hooks/usePerformance';
import { useFilters, FilterConfig } from '@/hooks/useFilters';
import { FilterChipBar } from '@/components/filters/FilterChipBar';

const MONTH_LABELS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

const PERFORMANCE_FILTER_CONFIG: FilterConfig[] = [
  { id: 'period', label: 'Period', type: 'single-select', options: [
    { value: '7', label: '7D' },
    { value: '30', label: '30D' },
    { value: '90', label: '90D' },
    { value: '365', label: '1Y' },
  ]},
  { id: 'account', label: 'Account', type: 'single-select' },
]

export function PerformanceContent() {
    const { formatPnl, formatAmount } = useCurrency();
    const { accounts } = useAccounts();
    const { activeFilters, addFilter, removeFilter, setMultiFilter, clearAll, getParam } = useFilters(PERFORMANCE_FILTER_CONFIG);

    const { data } = usePerformance({
        period: getParam('period') ?? '30',
        accountId: getParam('account') || undefined,
    });

    const STATS = [
        { id: 'stat_pnl', label: 'Net P&L', val: formatPnl(data.netPnl), status: data.netPnl >= 0 ? 'text-profit' : 'text-loss', icon: TrendingUp },
        { id: 'stat_dd', label: 'Max Drawdown', val: `${data.maxDrawdown.toFixed(2)}%`, status: 'text-loss', icon: ArrowDownLeft },
        { id: 'stat_sharpe', label: 'Sharpe Ratio', val: data.sharpe !== null ? data.sharpe.toFixed(2) : 'N/A', status: 'text-primary', icon: Activity },
        { id: 'stat_pf', label: 'Profit Factor', val: data.profitFactor.toFixed(2), status: 'text-profit', icon: Target },
    ];

    const monthlyReturns = data.monthlyReturns.length > 0
        ? data.monthlyReturns
        : MONTH_LABELS.map((_, i) => ({ month: i, value: 0 }));

    return (
        <div className="space-y-6 pb-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-1">
                <div>
                    <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">Performance Ledger</h1>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mt-2">
                        Deep Audit of Equity Evolution & Edge Stability
                    </p>
                </div>
            </div>

            {/* Filters */}
            <FilterChipBar
                config={PERFORMANCE_FILTER_CONFIG}
                activeFilters={activeFilters}
                onAdd={addFilter}
                onSetMulti={setMultiFilter}
                onRemove={removeFilter}
                onClear={clearAll}
                dynamicOptions={{
                    account: accounts.map(a => ({ value: a.id, label: a.name })),
                }}
            />

            {/* Top Row: Equity Chart + Expectancy Gauge */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Equity Curve */}
                <div className="lg:col-span-2 glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-6">
                    <div className="mb-4">
                        <h3 className="text-sm font-semibold text-gray-100">Master Equity Curve</h3>
                        <p className="text-xs text-gray-500">Account balance over time</p>
                    </div>
                    <div className="h-[250px]">
                        <EquityChart data={data.equity} showHeader={false} />
                    </div>
                </div>

                {/* Expectancy Gauge */}
                <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-6 flex flex-col items-center justify-center">
                    <Gauge
                        value={Math.abs(data.expectancy)}
                        max={Math.max(Math.abs(data.expectancy) * 2, 1000)}
                        label="Trade Expectancy"
                        subLabel="Value Per Trade"
                        variant="secondary"
                    />
                    <div className="mt-4 pt-4 border-t border-white/5 w-full space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-[8px] font-black uppercase text-gray-600 tracking-widest">Avg. Win</span>
                            <span className="text-[10px] font-bold text-profit">{formatAmount(data.avgWin, { showSign: true })}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[8px] font-black uppercase text-gray-600 tracking-widest">Avg. Loss</span>
                            <span className="text-[10px] font-bold text-loss">-{formatAmount(data.avgLoss)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {STATS.map(stat => (
                    <div key={stat.id} className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-5 flex flex-col justify-center space-y-1">
                        <div className="flex justify-between items-center text-gray-500">
                            <span className="text-[8px] font-black uppercase tracking-widest">{stat.label}</span>
                            <stat.icon size={12} />
                        </div>
                        <p className={`text-xl font-black tracking-tighter ${stat.status}`}>{stat.val}</p>
                    </div>
                ))}
            </div>

            {/* Monthly Return Matrix */}
            <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-6 overflow-hidden">
                <div className="mb-6 flex items-center gap-2">
                    <BarChart3 size={14} className="text-gray-500" />
                    <div>
                        <h3 className="text-sm font-semibold text-gray-100">Monthly Return Matrix</h3>
                        <p className="text-xs text-gray-500">Performance by month</p>
                    </div>
                </div>
                <div className="grid grid-cols-12 gap-1.5 text-center">
                    {MONTH_LABELS.map((m, i) => (
                        <div key={i} className="text-[8px] font-black text-gray-700 uppercase mb-1">{m}</div>
                    ))}
                    {monthlyReturns.map((r, i) => (
                        <div
                            key={i}
                            className={`p-2.5 rounded-lg text-[9px] font-black tracking-tighter flex items-center justify-center ${r.value >= 0
                                ? 'bg-profit/10 text-profit border border-profit/20'
                                : 'bg-loss/10 text-loss border border-loss/20'}`}
                        >
                            {r.value >= 0 ? '+' : ''}{r.value.toFixed(1)}%
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
