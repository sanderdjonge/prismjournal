'use client';

import { useState } from 'react';
import EquityChart from './EquityChart';
import TradeCalendar from './TradeCalendar';
import RecentTrades from './RecentTrades';
import PrismScoreWidget from './PrismScoreWidget';
import { PreTradeNotesWidget } from '@/components/pre-trade';
import { cn } from '@/lib/cn';
import { useCurrency } from '@/lib/currency';
import { useAccounts } from '@/hooks/useAccounts';
import { useDashboard } from '@/hooks/useDashboard';
import { useSettings } from '@/hooks/useSettings';
import { MetricRow } from '@/components/ui';

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
    avgDurationMinutes?: number;
    accountBalance: number;
};

export default function Dashboard() {
    const [period, setPeriod] = useState<'7' | '30' | '90' | '365'>('30');
    const { formatAmount, formatPnl, symbol } = useCurrency();
    const { selectedAccountId } = useAccounts();
    const { data } = useDashboard(period, selectedAccountId);
    const { dateFormat } = useSettings();

    const stats = data as DashboardData;

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

            {/* Two Column Metrics Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Key Metrics Widget */}
                <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-6">
                    <div className="mb-6">
                        <h3 className="text-sm font-semibold text-gray-100">Key Metrics</h3>
                        <p className="text-xs text-gray-500">Performance overview</p>
                    </div>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                        <MetricRow label="Total P&L" value={formatPnl(stats.totalPnl)} variant={stats.totalPnl >= 0 ? 'profit' : 'loss'} />
                        <MetricRow label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} subValue={`${Math.round(stats.winRate / 100 * stats.totalTrades)}W / ${stats.totalTrades - Math.round(stats.winRate / 100 * stats.totalTrades)}L`} variant={stats.winRate >= 50 ? 'profit' : 'loss'} />
                        <MetricRow label="Profit Factor" value={stats.profitFactor > 0 ? stats.profitFactor.toFixed(2) : '—'} />
                        <MetricRow label="Avg R-Multiple" value={`${stats.avgRMultiple >= 0 ? '+' : ''}${stats.avgRMultiple.toFixed(2)}R`} variant={stats.avgRMultiple >= 0 ? 'profit' : 'loss'} />
                        <MetricRow label="Expectancy" value={`${stats.expectancy >= 0 ? '+' : '-'}${symbol}${Math.abs(stats.expectancy).toFixed(2)}`} variant={stats.expectancy >= 0 ? 'profit' : 'loss'} />
                        <MetricRow label="Max Drawdown" value={`-${formatAmount(stats.maxDrawdown)}`} variant="loss" />
                    </div>
                </div>

                {/* Performance Breakdown Widget */}
                <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-6">
                    <div className="mb-6">
                        <h3 className="text-sm font-semibold text-gray-100">Performance Breakdown</h3>
                        <p className="text-xs text-gray-500">Trade statistics</p>
                    </div>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                        <MetricRow label="Total Trades" value={stats.totalTrades.toString()} />
                        <MetricRow label="Avg Duration" value={
                            stats.avgDurationMinutes == null || stats.avgDurationMinutes === 0 ? '—' :
                            stats.avgDurationMinutes < 60
                                ? `${Math.round(stats.avgDurationMinutes)}m`
                                : `${Math.floor(stats.avgDurationMinutes / 60)}h ${Math.round(stats.avgDurationMinutes % 60)}m`
                        } />
                        <MetricRow label="Best Trade" value={`+${formatAmount(stats.bestTrade)}`} variant="profit" />
                        <MetricRow label="Worst Trade" value={`-${formatAmount(stats.worstTrade)}`} variant="loss" />
                        <MetricRow label="Win Streak" value={stats.consecutiveWins.toString()} variant="profit" />
                        <MetricRow label="Loss Streak" value={stats.consecutiveLosses.toString()} variant="loss" />
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Equity Curve */}
                <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl">
                    <EquityChart 
                        data={stats.equity} 
                        className="h-[400px]" 
                        dateFormat={dateFormat}
                        showTiltmeter={true}
                        accountId={selectedAccountId}
                    />
                </div>

                {/* Prism Score */}
                <PrismScoreWidget accountId={selectedAccountId} />
            </div>

            {/* Calendar + Recent Trades */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Trade Calendar — 3/4 width */}
                <div className="lg:col-span-3 glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl overflow-hidden min-h-[480px]">
                    <TradeCalendar data={stats.calendar} accountBalance={stats.accountBalance} />
                </div>

                {/* Recent Trades + Pre-Trade Notes — 1/4 width */}
                <div className="space-y-6">
                    <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl overflow-hidden">
                        <RecentTrades trades={stats.trades} />
                    </div>
                    <PreTradeNotesWidget />
                </div>
            </div>
        </div>
    );
}
