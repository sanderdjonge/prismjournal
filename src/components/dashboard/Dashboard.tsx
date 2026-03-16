'use client';

import { useEffect, useState } from 'react';
import EquityChart from './EquityChart';
import TradeCalendar from './TradeCalendar';
import RecentTrades from './RecentTrades';
import Gauge from './Gauge';
import { cn } from '@/lib/cn';
import { useCurrency } from '@/lib/currency';
import { useAccounts } from '@/hooks/useAccounts';

type RecentTrade = {
    id: string;
    symbol: string;
    direction: 'LONG' | 'SHORT';
    price: string;
    pnl: number;
    time: string;
    isActive?: boolean;
};

type EquityPoint = { time: string; value: number };
type CalendarDay = { date: string; pnl: number; trades: number; wins: number; losses: number };

type DashboardData = {
    equity: EquityPoint[];
    trades: RecentTrade[];
    calendar: CalendarDay[];
    winRate: number;
    profitFactor: number;
    totalTrades: number;
    totalPnl: number;
    expectancy: number;
    maxDrawdown: number;
    avgRMultiple: number;
    bestTrade: number;
    worstTrade: number;
    consecutiveWins: number;
    consecutiveLosses: number;
};

export default function Dashboard() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [period, setPeriod] = useState<'7' | '30' | '90' | '365'>('30');
    const [loading, setLoading] = useState(true);
    const { formatAmount, formatPnl, symbol } = useCurrency();
    const { selectedAccountId } = useAccounts();

    useEffect(() => {
        setLoading(true);
        const params = new URLSearchParams({ period });
        if (selectedAccountId) params.set('account', selectedAccountId);
        fetch(`/api/dashboard?${params.toString()}`)
            .then(r => r.json())
            .then(setData)
            .catch(() => { /* silently ignore */ })
            .finally(() => setLoading(false));
    }, [period, selectedAccountId]);

    const stats = {
        equity: data?.equity ?? [],
        trades: data?.trades ?? [],
        calendar: data?.calendar ?? [],
        winRate: data?.winRate ?? 0,
        profitFactor: data?.profitFactor ?? 0,
        totalTrades: data?.totalTrades ?? 0,
        totalPnl: data?.totalPnl ?? 0,
        expectancy: data?.expectancy ?? 0,
        maxDrawdown: data?.maxDrawdown ?? 0,
        avgRMultiple: data?.avgRMultiple ?? 0,
        bestTrade: data?.bestTrade ?? 0,
        worstTrade: data?.worstTrade ?? 0,
        consecutiveWins: data?.consecutiveWins ?? 0,
        consecutiveLosses: data?.consecutiveLosses ?? 0,
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header with Period Selector */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-white">Dashboard</h1>
                    <p className="text-sm text-gray-500 mt-1">Your trading performance at a glance</p>
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
                            {d === '7' ? '7D' : d === '30' ? '30D' : d === '90' ? '90D' : '1Y'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <StatCard
                    label="Total P&L"
                    value={formatPnl(stats.totalPnl)}
                    variant={stats.totalPnl >= 0 ? 'profit' : 'loss'}
                />
                <StatCard
                    label="Win Rate"
                    value={`${stats.winRate.toFixed(1)}%`}
                    subLabel={`${Math.round(stats.winRate / 100 * stats.totalTrades)}W / ${stats.totalTrades - Math.round(stats.winRate / 100 * stats.totalTrades)}L`}
                    variant={stats.winRate >= 50 ? 'profit' : 'loss'}
                />
                <StatCard
                    label="Profit Factor"
                    value={stats.profitFactor > 0 ? stats.profitFactor.toFixed(2) : '—'}
                />
                <StatCard
                    label="Avg R-Multiple"
                    value={`${stats.avgRMultiple.toFixed(2)}R`}
                    variant={stats.avgRMultiple >= 0 ? 'profit' : 'loss'}
                />
                <StatCard
                    label="Expectancy"
                    value={`${stats.expectancy >= 0 ? '+' : ''}${symbol}${Math.abs(stats.expectancy).toFixed(2)}`}
                    variant={stats.expectancy >= 0 ? 'profit' : 'loss'}
                />
                <StatCard
                    label="Max Drawdown"
                    value={`-${formatAmount(stats.maxDrawdown)}`}
                    variant="loss"
                />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Equity Curve */}
                <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl overflow-hidden">
                    <EquityChart data={stats.equity} className="h-[300px]" />
                </div>

                {/* Performance Gauges */}
                <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-6">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-500 mb-6">Performance Gauges</h3>
                    <div className="flex flex-row flex-wrap gap-6 items-center justify-center">
                        <Gauge
                            value={stats.winRate}
                            label="Win Rate"
                            subLabel={`${Math.round(stats.winRate / 100 * stats.totalTrades)}/${stats.totalTrades} Trades`}
                            variant="accent"
                        />
                        <Gauge
                            value={stats.profitFactor}
                            max={5}
                            label="Profit Factor"
                            subLabel={stats.profitFactor > 0 ? 'Live Compute' : 'No data yet'}
                            variant="primary"
                        />
                    </div>
                </div>
            </div>

            {/* Secondary Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Trade Calendar */}
                <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl overflow-hidden">
                    <TradeCalendar data={stats.calendar} />
                </div>

                {/* Recent Trades */}
                <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl overflow-hidden">
                    <RecentTrades trades={stats.trades} />
                </div>
            </div>

            {/* Performance Breakdown */}
            <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-6">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-500 mb-6">Performance Breakdown</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
                    <BreakdownItem label="Total Trades" value={stats.totalTrades.toString()} />
                    <BreakdownItem label="Best Trade" value={`+${formatAmount(stats.bestTrade)}`} variant="profit" />
                    <BreakdownItem label="Worst Trade" value={`-${formatAmount(stats.worstTrade)}`} variant="loss" />
                    <BreakdownItem label="Win Streak" value={stats.consecutiveWins.toString()} variant="profit" />
                    <BreakdownItem label="Loss Streak" value={stats.consecutiveLosses.toString()} variant="loss" />
                    <BreakdownItem label="Avg Duration" value="—" />
                </div>
            </div>
        </div>
    );
}

// Stat Card Component
function StatCard({ 
    label, 
    value, 
    subLabel, 
    variant = 'neutral' 
}: { 
    label: string; 
    value: string; 
    subLabel?: string;
    variant?: 'profit' | 'loss' | 'neutral';
}) {
    return (
        <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-xl p-4">
            <div className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">{label}</div>
            <div className={cn(
                "text-xl font-black tracking-tight",
                variant === 'profit' && "text-accent",
                variant === 'loss' && "text-danger",
                variant === 'neutral' && "text-white"
            )}>
                {value}
            </div>
            {subLabel && (
                <div className="text-[9px] text-gray-600 font-bold mt-1">{subLabel}</div>
            )}
        </div>
    );
}

// Breakdown Item Component
function BreakdownItem({ 
    label, 
    value, 
    variant = 'neutral' 
}: { 
    label: string; 
    value: string;
    variant?: 'profit' | 'loss' | 'neutral';
}) {
    return (
        <div>
            <div className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">{label}</div>
            <div className={cn(
                "text-lg font-bold",
                variant === 'profit' && "text-accent",
                variant === 'loss' && "text-danger",
                variant === 'neutral' && "text-white"
            )}>
                {value}
            </div>
        </div>
    );
}
