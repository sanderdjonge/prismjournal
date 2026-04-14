'use client';

import { useState, useEffect, useMemo } from 'react';
import EquityChart from './EquityChart';
import TradeCalendar from './TradeCalendar';
import RecentTrades from './RecentTrades';
import PrismScoreWidget from './PrismScoreWidget';
import { PreTradeNotesWidget } from '@/components/pre-trade';
import { ChallengeProgressWidget } from '@/components/challenges/ChallengeProgressWidget';
import { OnboardingModal } from '@/components/onboarding/OnboardingModal';
import { cn } from '@/lib/cn';
import { useCurrency } from '@/lib/currency';
import { formatPercent } from '@/lib/formatNumber';
import { useAccounts } from '@/hooks/useAccounts';
import { useDashboard } from '@/hooks/useDashboard';
import { useSettings } from '@/hooks/useSettings';
import { MetricRow } from '@/components/ui';
import { GraduationCap } from 'lucide-react';
import type { RecentTrade, EquityPoint } from '@/types/trade'

type CalendarDay = { date: string; pnl: number; trades: number; wins: number; losses: number };

type DashboardData = {
    equity: EquityPoint[];
    allTimeEquity: EquityPoint[];
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
    const { dashboardPeriod: savedPeriod, updateSettings } = useSettings();
    const [period, setPeriod] = useState<'7' | '30' | '90' | '365'>('30');
    const { formatAmount, formatPnl, symbol } = useCurrency();
    const { selectedAccountId } = useAccounts();
    const { data } = useDashboard(period, selectedAccountId);
    const { dateFormat } = useSettings();
    const [showOnboarding, setShowOnboarding] = useState(false);

    const defaultStats: DashboardData = useMemo(() => ({
        equity: [],
        allTimeEquity: [],
        trades: [],
        calendar: [],
        winRate: 0,
        profitFactor: 0,
        totalTrades: 0,
        totalPnl: 0,
        expectancy: 0,
        maxDrawdown: 0,
        avgRMultiple: 0,
        bestTrade: 0,
        worstTrade: 0,
        consecutiveWins: 0,
        consecutiveLosses: 0,
        accountBalance: 0,
    }), []);

    const stats = (data ?? defaultStats) as DashboardData;

    useEffect(() => {
        if (savedPeriod) {
            setPeriod(savedPeriod);
        }
    }, [savedPeriod]);

    // Show onboarding for new users with no trades
    useEffect(() => {
        if (stats && stats.totalTrades === 0) {
            const hasSeenOnboarding = localStorage.getItem('prism-onboarding-seen');
            if (!hasSeenOnboarding) {
                setShowOnboarding(true);
            }
        }
    }, [stats]);

    const handleCloseOnboarding = (dontShowAgain?: boolean) => {
        setShowOnboarding(false);
        if (dontShowAgain) {
            localStorage.setItem('prism-onboarding-seen', 'true');
        }
    };

    const handleTestOnboarding = () => {
        setShowOnboarding(true);
    };

    const handlePeriodChange = (newPeriod: '7' | '30' | '90' | '365') => {
        setPeriod(newPeriod);
        updateSettings({ dashboardPeriod: newPeriod });
    };

    return (
        <div className="space-y-6">
            {/* Header with Period Selector */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-white">Dashboard</h1>
                    <p className="text-sm text-gray-500 mt-1">Your trading performance at a glance</p>
                </div>
                <div className="flex gap-2 items-center">
                    <button
                        onClick={handleTestOnboarding}
                        className="px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all duration-300 bg-accent/20 text-accent border border-accent/30 hover:bg-accent/30 flex items-center gap-1.5"
                        title="Test onboarding flow"
                    >
                        <GraduationCap size={12} />
                        Onboarding
                    </button>
                    {(['7', '30', '90', '365'] as const).map((d) => (
                        <button
                            key={d}
                            onClick={() => handlePeriodChange(d)}
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

            {/* Row 1: Three Column Metrics Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                {/* Key Metrics Widget */}
                <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-4">
                    <div className="mb-4">
                        <h3 className="text-sm font-semibold text-gray-100">Key Metrics</h3>
                        <p className="text-xs text-gray-500">Performance overview</p>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                        <MetricRow label="Total P&L" value={formatPnl(stats.totalPnl)} variant={stats.totalPnl >= 0 ? 'profit' : 'loss'} />
                        <MetricRow label="Win Rate" value={formatPercent(stats.winRate, 1)} subValue={`${Math.round(stats.winRate / 100 * stats.totalTrades)}W / ${stats.totalTrades - Math.round(stats.winRate / 100 * stats.totalTrades)}L`} variant={stats.winRate >= 50 ? 'profit' : 'loss'} />
                        <MetricRow label="Profit Factor" value={stats.profitFactor > 0 ? stats.profitFactor.toFixed(2) : '—'} />
                        <MetricRow label="Avg R-Multiple" value={`${stats.avgRMultiple >= 0 ? '+' : ''}${stats.avgRMultiple.toFixed(2)}R`} variant={stats.avgRMultiple >= 0 ? 'profit' : 'loss'} />
                        <MetricRow label="Expectancy" value={`${stats.expectancy >= 0 ? '+' : '-'}${symbol}${Math.abs(stats.expectancy).toFixed(2)}`} variant={stats.expectancy >= 0 ? 'profit' : 'loss'} />
                        <MetricRow label="Max Drawdown" value={`-${formatAmount(stats.maxDrawdown)}`} variant="loss" />
                    </div>
                </div>

                {/* Performance Breakdown Widget */}
                <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-4">
                    <div className="mb-4">
                        <h3 className="text-sm font-semibold text-gray-100">Performance Breakdown</h3>
                        <p className="text-xs text-gray-500">Trade statistics</p>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
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

                {/* Prism Score */}
                <PrismScoreWidget accountId={selectedAccountId} />
            </div>

            {/* Row 2: Equity + Challenges/Pre-Trade */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Equity Curve - 2 columns */}
                <div className="lg:col-span-2 glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl">
                    <EquityChart 
                        data={stats.allTimeEquity} 
                        className="h-[400px]" 
                        dateFormat={dateFormat}
                        showTiltmeter={true}
                        accountId={selectedAccountId}
                    />
                </div>

                {/* Challenges + Pre-Trade Notes - 1 column */}
                <div className="space-y-6">
                    <ChallengeProgressWidget />
                    <PreTradeNotesWidget />
                </div>
            </div>

            {/* Row 3: Calendar + Recent Trades */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Trade Calendar — 3/4 width */}
                <div className="lg:col-span-3 glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl overflow-hidden min-h-[480px]">
                    <TradeCalendar data={stats.calendar} accountBalance={stats.accountBalance} />
                </div>

                {/* Recent Trades — 1/4 width */}
                <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl overflow-hidden">
                    <RecentTrades trades={stats.trades} />
                </div>
            </div>

            {/* Onboarding Modal for New Users */}
            <OnboardingModal isOpen={showOnboarding} onClose={handleCloseOnboarding} />
        </div>
    );
}
