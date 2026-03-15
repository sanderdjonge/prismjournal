'use client';

import { useEffect, useState } from 'react';
import DashboardShell from '@/components/layout/DashboardShell';
import EquityChart from '@/components/dashboard/EquityChart';
import Gauge from '@/components/dashboard/Gauge';
import { TrendingUp, ArrowDownLeft, Activity, Target, BarChart3 } from 'lucide-react';
import { useCurrency } from '@/lib/currency';
import { cn } from '@/lib/cn';
import { useAccounts } from '@/hooks/useAccounts';

type EquityPoint = { time: string; value: number };
type MonthlyReturn = { month: number; value: number };

type PerfData = {
    equity: EquityPoint[];
    netPnl: number;
    maxDrawdown: number;
    sharpe: number | null;
    profitFactor: number;
    avgWin: number;
    avgLoss: number;
    expectancy: number;
    monthlyReturns: MonthlyReturn[];
    accountCount?: number;
};

const MONTH_LABELS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

export default function PerformancePage() {
    const [data, setData] = useState<PerfData | null>(null);
    const [period, setPeriod] = useState<'7' | '30' | '90' | '365'>('30');
    const [loading, setLoading] = useState(true);
    const { formatPnl, formatAmount } = useCurrency();
    const { selectedAccountId } = useAccounts();

    useEffect(() => {
        setLoading(true);
        const params = new URLSearchParams({ period });
        if (selectedAccountId) {
            params.set('accountId', selectedAccountId);
        }
        fetch(`/api/performance?${params.toString()}`)
            .then(r => r.json())
            .then(setData)
            .catch(() => { /* silently ignore */ })
            .finally(() => setLoading(false));
    }, [period, selectedAccountId]);

    const STATS = [
        { id: 'stat_pnl', label: 'Net P&L', val: data ? formatPnl(data.netPnl) : '—', status: data ? (data.netPnl >= 0 ? 'text-accent' : 'text-danger') : 'text-gray-600', icon: TrendingUp },
        { id: 'stat_dd', label: 'Max Drawdown', val: data ? `${data.maxDrawdown.toFixed(2)}%` : '—', status: 'text-danger', icon: ArrowDownLeft },
        { id: 'stat_sharpe', label: 'Sharpe Ratio', val: data ? (data.sharpe !== null ? data.sharpe.toFixed(2) : 'N/A') : '—', status: 'text-primary', icon: Activity },
        { id: 'stat_pf', label: 'Profit Factor', val: data ? data.profitFactor.toFixed(2) : '—', status: 'text-accent', icon: Target },
    ];

    const monthlyReturns = data?.monthlyReturns ?? MONTH_LABELS.map((_, i) => ({ month: i, value: 0 }));

    if (loading) {
        return (
            <DashboardShell>
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
            </DashboardShell>
        );
    }

    return (
        <DashboardShell>
            <div className="space-y-6 pb-10">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-1">
                    <div>
                        <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">Performance Ledger</h1>
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mt-2">
                            Deep Audit of Equity Evolution & Edge Stability
                        </p>
                    </div>
                    <div className="flex gap-2">
                        {(['7', '30', '90', '365'] as const).map((d) => (
                            <button
                                key={d}
                                onClick={() => setPeriod(d)}
                                className={cn(
                                    "px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all duration-300",
                                    period === d
                                        ? "bg-primary/20 text-primary border border-primary/30"
                                        : "bg-white/5 text-gray-500 border border-white/5 hover:bg-white/10 hover:text-white"
                                )}
                            >
                                {d === '365' ? '1Y' : `${d}D`}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Top Row: Equity Chart + Expectancy Gauge */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Equity Curve */}
                    <div className="lg:col-span-2 glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-6 overflow-hidden">
                        <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500 mb-4">Master Equity Curve</h3>
                        <div className="h-[250px]">
                            <EquityChart data={data?.equity ?? []} />
                        </div>
                    </div>

                    {/* Expectancy Gauge */}
                    <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-6 flex flex-col items-center justify-center">
                        <Gauge
                            value={Math.abs(data?.expectancy ?? 0)}
                            max={Math.max(Math.abs(data?.expectancy ?? 0) * 2, 1000)}
                            label="Trade Expectancy"
                            subLabel="Value Per Trade"
                            variant="secondary"
                        />
                        <div className="mt-4 pt-4 border-t border-white/5 w-full space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-[8px] font-black uppercase text-gray-600 tracking-widest">Avg. Win</span>
                                <span className="text-[10px] font-bold text-accent">{formatAmount(data?.avgWin ?? 0, { showSign: true })}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[8px] font-black uppercase text-gray-600 tracking-widest">Avg. Loss</span>
                                <span className="text-[10px] font-bold text-danger">-{formatAmount(data?.avgLoss ?? 0)}</span>
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
                    <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500 mb-6 flex items-center gap-2">
                        <BarChart3 size={14} /> Monthly Return Matrix
                    </h3>
                    <div className="grid grid-cols-12 gap-1.5 text-center">
                        {MONTH_LABELS.map(m => (
                            <div key={m} className="text-[8px] font-black text-gray-700 uppercase mb-1">{m}</div>
                        ))}
                        {monthlyReturns.map((r, i) => (
                            <div
                                key={i}
                                className={`p-2.5 rounded-lg text-[9px] font-black tracking-tighter flex items-center justify-center ${r.value >= 0
                                    ? 'bg-accent/10 text-accent border border-accent/20'
                                    : 'bg-danger/10 text-danger border border-danger/20'}`}
                            >
                                {r.value >= 0 ? '+' : ''}{r.value.toFixed(1)}%
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </DashboardShell>
    );
}
