'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import DashboardShell from '@/components/layout/DashboardShell';
import {
    ArrowLeft,
    TrendingUp,
    TrendingDown,
    AlertTriangle,
    CheckCircle,
    Clock,
    Target,
    DollarSign,
    Calendar,
    BarChart3,
    Shield,
    Loader2,
    ChevronRight,
    AlertCircle,
    PieChart,
} from 'lucide-react';
import { cn } from '@/lib/cn';

interface PhaseConfig {
    phaseNumber: number;
    phaseName: string;
    profitTarget: number;
    dailyLossLimit: number;
    maxDrawdown: number;
    minTradingDays?: number;
    timeLimitDays?: number;
}

interface ChallengePhase {
    id: string;
    phaseNumber: number;
    phaseName: string;
    profitTarget: number | null;
    profitTargetAmount: number | null;
    dailyLossLimit: number;
    maxDrawdown: number;
    minTradingDays: number | null;
    timeLimitDays: number | null;
    status: 'IN_PROGRESS' | 'PASSED' | 'FAILED' | 'SKIPPED';
    startedAt: string;
    completedAt: string | null;
    failedAt: string | null;
    failureReason: string | null;
    currentProgress: number | null;
    currentDrawdown: number | null;
    dailyPnl: number | null;
    tradingDaysCount: number;
}

interface Violation {
    id: string;
    ruleType: string;
    severity: 'WARNING' | 'CRITICAL' | 'BREACH';
    limitValue: number;
    actualValue: number;
    description: string;
    occurredAt: string;
    isResolved: boolean;
    resolvedAt?: string | null;
    resolutionNotes?: string | null;
}

interface AccountDetails {
    id: string;
    name: string;
    platform: string;
    platformAccountId: string | null;
    currency: string;
    accountType: string;
    accountSize: number | null;
    profitSplit: number | null;
    currentBalance: number | null;
    currentEquity: number | null;
    totalPnl: number;
    tradeCount: number;
    propFirm: {
        id: string;
        name: string;
        slug: string;
        challengeType: string;
        dailyLossLimit: number;
        maxDrawdown: number;
        drawdownType: string;
        phasesConfig: PhaseConfig[];
        allowNewsTrading: boolean;
        allowWeekendHolding: boolean;
        allowEA: boolean;
        hasScalingPlan: boolean;
        scalingConfig: string | null;
    } | null;
    currentPhase: string | null;
    challengePhases: ChallengePhase[];
    violations: Violation[];
    phasesConfig: PhaseConfig[] | null;
    latestSnapshot: {
        snapshotDate: string;
        startingBalance: number;
        endingBalance: number;
        endingEquity: number;
        dailyPnl: number;
        dailyPnlPercent: number;
        currentDrawdown: number;
        dailyLossUsed: number;
        isDailyLimitBreached: boolean;
        isMaxDrawdownBreached: boolean;
        profitProgress: number | null;
    } | null;
}

interface AnalyticsData {
    symbolData: Array<{ symbol: string; profit: number; winRate: number }>;
    expectancyData: Array<{ trade: number; val: number }>;
    sessionData: Array<{ hour: number; count: number }>;
    profitFactor: number;
    expectancy: number;
    avgRR: number;
    meanDrawdown: number;
}

function PropFirmAccountContent() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const accountId = params.id as string;
    const fromPage = searchParams.get('from');

    const [account, setAccount] = useState<AccountDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);
    const [showAllViolations, setShowAllViolations] = useState(false);
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);

    useEffect(() => {
        async function fetchAccountDetails() {
            try {
                // Add timestamp to prevent caching
                const res = await fetch(`/api/accounts/${accountId}/details?_t=${Date.now()}`, {
                    cache: 'no-store',
                    headers: {
                        'Cache-Control': 'no-cache',
                    },
                });
                if (!res.ok) {
                    throw new Error('Failed to fetch account details');
                }
                const data = await res.json();
                setAccount(data.account);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An error occurred');
            } finally {
                setLoading(false);
            }
        }

        fetchAccountDetails();
    }, [accountId]);

    // Fetch analytics data for this account
    useEffect(() => {
        async function fetchAnalytics() {
            if (!account) return;
            
            setAnalyticsLoading(true);
            try {
                // Get challenge start date from the first phase
                const firstPhase = account.challengePhases[0];
                const fromDate = firstPhase?.startedAt
                    ? new Date(firstPhase.startedAt).toISOString().split('T')[0]
                    : undefined;
                
                const url = new URL(`/api/analytics`, window.location.origin);
                url.searchParams.set('account', accountId);
                if (fromDate) {
                    url.searchParams.set('from', fromDate);
                }
                
                const res = await fetch(url.toString());
                if (res.ok) {
                    const data = await res.json();
                    setAnalytics(data);
                }
            } catch (err) {
                console.error('Error fetching analytics:', err);
            } finally {
                setAnalyticsLoading(false);
            }
        }
        
        fetchAnalytics();
    }, [accountId, account]);

    const formatCurrency = (value: number | null | undefined, currency: string = 'USD') => {
        const safeValue = value ?? 0;
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
        }).format(safeValue);
    };

    const formatPercent = (value: number | null | undefined) => {
        const safeValue = value ?? 0;
        return `${safeValue.toFixed(2)}%`;
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'WARNING': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
            case 'CRITICAL': return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
            case 'BREACH': return 'text-red-400 bg-red-500/10 border-red-500/30';
            default: return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
        }
    };

    const getRuleTypeLabel = (ruleType: string) => {
        const labels: Record<string, string> = {
            DAILY_LOSS_LIMIT: 'Daily Loss Limit',
            MAX_DRAWDOWN: 'Max Drawdown',
            NEWS_TRADING: 'News Trading',
            WEEKEND_HOLDING: 'Weekend Holding',
            POSITION_SIZE: 'Position Size',
            TIME_LIMIT: 'Time Limit',
            MIN_TRADING_DAYS: 'Minimum Trading Days',
        };
        return labels[ruleType] || ruleType;
    };

    const handleAcknowledgeViolation = async (violationId: string) => {
        if (!confirm('Acknowledge this violation? It will be marked as resolved.')) {
            return;
        }
        
        setAcknowledgingId(violationId);
        try {
            const res = await fetch(`/api/violations/${violationId}/acknowledge`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ acknowledged: true }),
            });
            
            if (res.ok) {
                // Update the violation in the local state
                setAccount(prev => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        violations: prev.violations.map(v =>
                            v.id === violationId
                                ? { ...v, isResolved: true, resolvedAt: new Date().toISOString() }
                                : v
                        ),
                    };
                });
            } else {
                const error = await res.json().catch(() => ({ error: 'Unknown error' }));
                alert(`Failed to acknowledge: ${error.error || 'Please try again'}`);
            }
        } catch (err) {
            console.error('Error acknowledging violation:', err);
            alert('An error occurred. Please try again.');
        } finally {
            setAcknowledgingId(null);
        }
    };

    if (loading) {
        return (
            <DashboardShell>
                <div className="flex items-center justify-center min-h-[60vh]">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            </DashboardShell>
        );
    }

    if (error || !account) {
        return (
            <DashboardShell>
                <div className="flex flex-col items-center justify-center min-h-[60vh]">
                    <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
                    <p className="text-red-400">{error || 'Account not found'}</p>
                    <button
                        onClick={() => router.push('/settings')}
                        className="mt-4 px-4 py-2 bg-white/5 rounded-lg hover:bg-white/10 transition-all"
                    >
                        Back to Settings
                    </button>
                </div>
            </DashboardShell>
        );
    }

    // Get current phase
    const currentPhase = account.challengePhases.find(p => p.status === 'IN_PROGRESS');
    const phasesConfig = account.phasesConfig || [];

    // Calculate progress
    const accountSize = account.accountSize || 10000;
    const currentBalance = account.currentBalance || accountSize;
    const totalPnl = account.totalPnl || 0;
    const progressPercent = currentPhase?.currentProgress || 
        ((currentBalance - accountSize) / accountSize * 100);

    // Daily loss calculation
    // dailyLossUsed is stored as percent-of-limit (0-100), e.g. 84 means 84% of limit used.
    const dailyLossPercentOfLimit = account.latestSnapshot?.dailyLossUsed || 0;
    const dailyLossLimit = currentPhase?.dailyLossLimit || account.propFirm?.dailyLossLimit || 5;
    // Convert to the actual raw percentage lost (e.g. 4.2% of account balance).
    const dailyLossPercent = (dailyLossPercentOfLimit * dailyLossLimit) / 100;

    // Drawdown calculation
    const drawdownPercent = account.latestSnapshot?.currentDrawdown || 
        account.challengePhases[0]?.currentDrawdown || 0;
    const maxDrawdown = currentPhase?.maxDrawdown || account.propFirm?.maxDrawdown || 10;

    return (
        <DashboardShell>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.push('/pages/accounts')}
                        className="p-2 rounded-lg border border-white/10 hover:bg-white/5 transition-all"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div className="flex-1">
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-white">{account.name}</h1>
                            <span className="px-3 py-1 rounded-lg text-xs font-bold bg-purple-500/20 text-purple-400">
                                {account.propFirm?.name || 'Prop Firm'}
                            </span>
                        </div>
                        <p className="text-sm text-gray-400 mt-1">
                            {account.platform} {account.platformAccountId && `• #${account.platformAccountId}`}
                        </p>
                    </div>
                </div>

                {/* Main Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column - Challenge Progress */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Current Phase Card */}
                        <div className="glass-card p-6 border-white/5">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Target size={20} className="text-primary" />
                                    Challenge Progress
                                </h2>
                                {currentPhase && (
                                    <span className={cn(
                                        "px-3 py-1 rounded-lg text-xs font-bold",
                                        currentPhase.status === 'IN_PROGRESS' && "bg-blue-500/20 text-blue-400",
                                        currentPhase.status === 'PASSED' && "bg-green-500/20 text-green-400",
                                        currentPhase.status === 'FAILED' && "bg-red-500/20 text-red-400"
                                    )}>
                                        {currentPhase.phaseName}
                                    </span>
                                )}
                            </div>

                            {/* Phase Progress Bar */}
                            <div className="mb-6">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm text-gray-400">Profit Target Progress</span>
                                    <span className="text-sm font-bold text-white">
                                        {formatPercent(progressPercent)} / {formatPercent(currentPhase?.profitTarget || 10)}
                                    </span>
                                </div>
                                <div className="h-4 bg-black/40 rounded-full overflow-hidden">
                                    <div
                                        className={cn(
                                            "h-full rounded-full transition-all duration-500",
                                            progressPercent >= (currentPhase?.profitTarget || 10)
                                                ? "bg-green-500"
                                                : "bg-gradient-to-r from-primary to-blue-400"
                                        )}
                                        style={{ 
                                            width: `${Math.min(100, (progressPercent / (currentPhase?.profitTarget || 10)) * 100)}%` 
                                        }}
                                    />
                                </div>
                                <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                                    <span>{formatCurrency(totalPnl, account.currency)} realized</span>
                                    <span>Target: {formatCurrency((currentPhase?.profitTargetAmount || (accountSize * (currentPhase?.profitTarget || 10) / 100)), account.currency)}</span>
                                </div>
                            </div>

                            {/* Risk Meters */}
                            <div className="grid grid-cols-2 gap-4">
                                {/* Daily Loss */}
                                <div className="p-4 rounded-xl bg-black/20 border border-white/5">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs text-gray-400 uppercase tracking-wider">Daily Loss Used</span>
                                        <span className={cn(
                                            "text-sm font-bold",
                                            dailyLossPercentOfLimit >= 80 ? "text-red-400" : "text-white"
                                        )}>
                                            {formatPercent(dailyLossPercent)}
                                        </span>
                                    </div>
                                    <div className="h-2 bg-black/40 rounded-full overflow-hidden">
                                        <div
                                            className={cn(
                                                "h-full rounded-full transition-all",
                                                dailyLossPercentOfLimit >= 100 ? "bg-red-500" :
                                                dailyLossPercentOfLimit >= 80 ? "bg-orange-500" : "bg-yellow-500"
                                            )}
                                            style={{ width: `${Math.min(100, dailyLossPercentOfLimit)}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">Limit: {dailyLossLimit}%</p>
                                </div>

                                {/* Max Drawdown */}
                                <div className="p-4 rounded-xl bg-black/20 border border-white/5">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs text-gray-400 uppercase tracking-wider">Current Drawdown</span>
                                        <span className={cn(
                                            "text-sm font-bold",
                                            drawdownPercent >= maxDrawdown * 0.8 ? "text-red-400" : "text-white"
                                        )}>
                                            {formatPercent(drawdownPercent)}
                                        </span>
                                    </div>
                                    <div className="h-2 bg-black/40 rounded-full overflow-hidden">
                                        <div
                                            className={cn(
                                                "h-full rounded-full transition-all",
                                                drawdownPercent >= maxDrawdown ? "bg-red-500" :
                                                drawdownPercent >= maxDrawdown * 0.8 ? "bg-orange-500" : "bg-green-500"
                                            )}
                                            style={{ width: `${Math.min(100, (drawdownPercent / maxDrawdown) * 100)}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">Limit: {maxDrawdown}%</p>
                                </div>
                            </div>

                            {/* Trading Days */}
                            {currentPhase?.minTradingDays && (
                                <div className="mt-4 p-4 rounded-xl bg-black/20 border border-white/5">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Calendar size={16} className="text-gray-400" />
                                            <span className="text-sm text-gray-400">Trading Days</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg font-bold text-white">
                                                {currentPhase.tradingDaysCount}
                                            </span>
                                            <span className="text-sm text-gray-400">
                                                / {currentPhase.minTradingDays} minimum
                                            </span>
                                            {currentPhase.tradingDaysCount >= currentPhase.minTradingDays && (
                                                <CheckCircle size={16} className="text-green-400" />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Phase Timeline */}
                        <div className="glass-card p-6 border-white/5">
                            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <BarChart3 size={20} className="text-primary" />
                                Challenge Phases
                            </h2>
                            <div className="space-y-4">
                                {phasesConfig.map((phase, index) => {
                                    const dbPhase = account.challengePhases.find(p => p.phaseNumber === phase.phaseNumber);
                                    const isActive = dbPhase?.status === 'IN_PROGRESS';
                                    const isPassed = dbPhase?.status === 'PASSED';
                                    const isFailed = dbPhase?.status === 'FAILED';

                                    return (
                                        <div
                                            key={phase.phaseNumber}
                                            className={cn(
                                                "p-4 rounded-xl border transition-all",
                                                isActive && "border-primary/50 bg-primary/5",
                                                isPassed && "border-green-500/30 bg-green-500/5",
                                                isFailed && "border-red-500/30 bg-red-500/5",
                                                !isActive && !isPassed && !isFailed && "border-white/5 bg-black/20"
                                            )}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className={cn(
                                                        "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                                                        isActive && "bg-primary text-white",
                                                        isPassed && "bg-green-500 text-white",
                                                        isFailed && "bg-red-500 text-white",
                                                        !isActive && !isPassed && !isFailed && "bg-gray-700 text-gray-400"
                                                    )}>
                                                        {phase.phaseNumber}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-white">{phase.phaseName}</p>
                                                        <p className="text-xs text-gray-400">
                                                            Target: {phase.profitTarget}% • DD: {phase.maxDrawdown}%
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {isPassed && (
                                                        <span className="px-2 py-1 rounded text-xs font-bold bg-green-500/20 text-green-400">
                                                            Passed
                                                        </span>
                                                    )}
                                                    {isFailed && (
                                                        <span className="px-2 py-1 rounded text-xs font-bold bg-red-500/20 text-red-400">
                                                            Failed
                                                        </span>
                                                    )}
                                                    {isActive && (
                                                        <span className="px-2 py-1 rounded text-xs font-bold bg-blue-500/20 text-blue-400">
                                                            In Progress
                                                        </span>
                                                    )}
                                                    {!isActive && !isPassed && !isFailed && dbPhase && (
                                                        <ChevronRight size={16} className="text-gray-500" />
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Daily Performance Report */}
                        <div className="glass-card p-6 border-white/5">
                            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <BarChart3 size={20} className="text-primary" />
                                Daily Performance
                            </h2>
                            <div className="text-center py-8 text-gray-400">
                                <BarChart3 size={32} className="mx-auto mb-2 opacity-50" />
                                <p className="text-sm">Daily snapshots will appear here</p>
                                <p className="text-xs text-gray-500 mt-1">
                                    Run the daily snapshot cron to generate data
                                </p>
                            </div>
                        </div>

                        {/* Challenge Analytics */}
                        <div className="glass-card p-6 border-white/5">
                            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <PieChart size={20} className="text-primary" />
                                Challenge Analytics
                            </h2>
                            
                            {analyticsLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                </div>
                            ) : !analytics || analytics.symbolData.length === 0 ? (
                                <div className="text-center py-8 text-gray-400">
                                    <PieChart size={32} className="mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">No trade data available</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Analytics will appear after trades are synced
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Key Stats Row */}
                                    <div className="grid grid-cols-4 gap-4">
                                        <div className="text-center p-3 rounded-lg bg-black/20 border border-white/5">
                                            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Profit Factor</p>
                                            <p className={cn(
                                                "text-lg font-bold",
                                                analytics.profitFactor >= 1.5 ? "text-green-400" :
                                                analytics.profitFactor >= 1 ? "text-yellow-400" : "text-red-400"
                                            )}>
                                                {analytics.profitFactor.toFixed(2)}
                                            </p>
                                        </div>
                                        <div className="text-center p-3 rounded-lg bg-black/20 border border-white/5">
                                            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Expectancy</p>
                                            <p className={cn(
                                                "text-lg font-bold",
                                                analytics.expectancy >= 0 ? "text-green-400" : "text-red-400"
                                            )}>
                                                {formatCurrency(analytics.expectancy, account?.currency)}
                                            </p>
                                        </div>
                                        <div className="text-center p-3 rounded-lg bg-black/20 border border-white/5">
                                            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Avg R:R</p>
                                            <p className={cn(
                                                "text-lg font-bold",
                                                analytics.avgRR >= 1 ? "text-green-400" :
                                                analytics.avgRR >= 0.5 ? "text-yellow-400" : "text-red-400"
                                            )}>
                                                {analytics.avgRR.toFixed(2)}
                                            </p>
                                        </div>
                                        <div className="text-center p-3 rounded-lg bg-black/20 border border-white/5">
                                            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Avg DD</p>
                                            <p className="text-lg font-bold text-orange-400">
                                                {analytics.meanDrawdown.toFixed(1)}%
                                            </p>
                                        </div>
                                    </div>

                                    {/* Symbol Performance */}
                                    <div>
                                        <h3 className="text-sm font-bold text-gray-300 mb-3">Symbol Performance</h3>
                                        <div className="space-y-2 max-h-48 overflow-y-auto">
                                            {analytics.symbolData.slice(0, 8).map((symbol) => (
                                                <div
                                                    key={symbol.symbol}
                                                    className="flex items-center justify-between p-2 rounded-lg bg-black/20 border border-white/5"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-sm font-bold text-white">{symbol.symbol}</span>
                                                        <span className={cn(
                                                            "text-xs px-2 py-0.5 rounded",
                                                            symbol.winRate >= 60 ? "bg-green-500/20 text-green-400" :
                                                            symbol.winRate >= 40 ? "bg-yellow-500/20 text-yellow-400" :
                                                            "bg-red-500/20 text-red-400"
                                                        )}>
                                                            {symbol.winRate}% WR
                                                        </span>
                                                    </div>
                                                    <span className={cn(
                                                        "text-sm font-bold",
                                                        symbol.profit >= 0 ? "text-green-400" : "text-red-400"
                                                    )}>
                                                        {formatCurrency(symbol.profit, account?.currency)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Session Distribution */}
                                    <div>
                                        <h3 className="text-sm font-bold text-gray-300 mb-3">Trading Hours</h3>
                                        <div className="grid grid-cols-12 gap-1">
                                            {analytics.sessionData.slice(0, 12).map((session) => {
                                                const maxCount = Math.max(...analytics.sessionData.map(s => s.count), 1);
                                                const height = (session.count / maxCount) * 100;
                                                return (
                                                    <div key={session.hour} className="flex flex-col items-center">
                                                        <div className="w-full h-12 flex items-end justify-center">
                                                            <div
                                                                className="w-full bg-primary/60 rounded-t"
                                                                style={{ height: `${Math.max(height, 2)}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-[9px] text-gray-500 mt-1">{session.hour}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="grid grid-cols-12 gap-1 mt-1">
                                            {analytics.sessionData.slice(12, 24).map((session) => {
                                                const maxCount = Math.max(...analytics.sessionData.map(s => s.count), 1);
                                                const height = (session.count / maxCount) * 100;
                                                return (
                                                    <div key={session.hour} className="flex flex-col items-center">
                                                        <div className="w-full h-12 flex items-end justify-center">
                                                            <div
                                                                className="w-full bg-primary/60 rounded-t"
                                                                style={{ height: `${Math.max(height, 2)}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-[9px] text-gray-500 mt-1">{session.hour}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column - Stats & Violations */}
                    <div className="space-y-6">
                        {/* Account Stats */}
                        <div className="glass-card p-6 border-white/5">
                            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <DollarSign size={20} className="text-primary" />
                                Account Stats
                            </h2>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-400">Account Size</span>
                                    <span className="font-bold text-white">{formatCurrency(accountSize, account.currency)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-400">Current Balance</span>
                                    <span className="font-bold text-white">{formatCurrency(currentBalance, account.currency)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-400">Total P&L</span>
                                    <span className={cn(
                                        "font-bold",
                                        totalPnl >= 0 ? "text-green-400" : "text-red-400"
                                    )}>
                                        {formatCurrency(totalPnl, account.currency)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-400">Profit Split</span>
                                    <span className="font-bold text-green-400">{account.profitSplit || 80}%</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-400">Total Trades</span>
                                    <span className="font-bold text-white">{account.tradeCount}</span>
                                </div>
                            </div>
                        </div>

                        {/* Prop Firm Rules */}
                        {account.propFirm && (
                            <div className="glass-card p-6 border-white/5">
                                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                    <Shield size={20} className="text-primary" />
                                    Trading Rules
                                </h2>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-400">Daily Loss Limit</span>
                                        <span className="text-orange-400 font-bold">{account.propFirm.dailyLossLimit}%</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-400">Max Drawdown</span>
                                        <span className="text-orange-400 font-bold">{account.propFirm.maxDrawdown}%</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-400">Drawdown Type</span>
                                        <span className="text-white">{account.propFirm.drawdownType}</span>
                                    </div>
                                    <hr className="border-white/5" />
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-400">News Trading</span>
                                        <span className={account.propFirm.allowNewsTrading ? "text-green-400" : "text-red-400"}>
                                            {account.propFirm.allowNewsTrading ? "Allowed" : "Restricted"}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-400">Weekend Holding</span>
                                        <span className={account.propFirm.allowWeekendHolding ? "text-green-400" : "text-red-400"}>
                                            {account.propFirm.allowWeekendHolding ? "Allowed" : "Restricted"}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-400">EA Trading</span>
                                        <span className={account.propFirm.allowEA ? "text-green-400" : "text-red-400"}>
                                            {account.propFirm.allowEA ? "Allowed" : "Restricted"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Scaling Plan - Only show for funded accounts with scaling plan */}
                        {account.propFirm?.hasScalingPlan && account.propFirm.scalingConfig && (() => {
                            // Check if this is a funded account (all phases passed, account is marked Funded, or a funded phase is active)
                            const allPhasesPassed = account.challengePhases.length > 0 &&
                                account.challengePhases.every(p => p.status === 'PASSED');
                            const isFundedAccount = account.currentPhase === 'Funded';
                            const hasFundedPhase = account.challengePhases.some(p =>
                                p.phaseName.toLowerCase().includes('funded') && p.status === 'IN_PROGRESS'
                            );

                            if (!allPhasesPassed && !isFundedAccount && !hasFundedPhase) return null;
                            
                            let scalingConfig: {
                                initialBalance?: number;
                                increment?: number;
                                conditions?: { profitMonths?: number; minProfit?: number; maxDrawdown?: number };
                                type?: string;
                                levels?: Array<{ profit: number; balanceIncrease: number }>;
                            } | null = null;
                            
                            try {
                                scalingConfig = JSON.parse(account.propFirm.scalingConfig);
                            } catch {
                                return null;
                            }
                            
                            if (!scalingConfig) return null;
                            
                            return (
                                <div className="glass-card p-6 border-white/5">
                                    <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                        <TrendingUp size={20} className="text-primary" />
                                        Scaling Plan
                                    </h2>
                                    
                                    {/* FTMO-style scaling */}
                                    {scalingConfig.initialBalance && scalingConfig.increment && (
                                        <div className="space-y-4">
                                            <p className="text-sm text-gray-400">
                                                Scale your account up to {formatCurrency(scalingConfig.initialBalance + (scalingConfig.increment || 0) * 4, account.currency)}
                                            </p>
                                            
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between text-xs text-gray-400">
                                                    <span>Current: {formatCurrency(accountSize, account.currency)}</span>
                                                    <span>Max: {formatCurrency(scalingConfig.initialBalance, account.currency)}</span>
                                                </div>
                                                <div className="h-2 bg-black/40 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-primary to-green-400 rounded-full"
                                                        style={{
                                                            width: `${Math.min(100, (accountSize / (scalingConfig.initialBalance || accountSize)) * 100)}%`
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                            
                                            {scalingConfig.conditions && (
                                                <div className="p-3 rounded-lg bg-black/20 border border-white/5">
                                                    <p className="text-xs text-gray-400 mb-2">Requirements per scale:</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {scalingConfig.conditions.profitMonths && (
                                                            <span className="text-xs px-2 py-1 rounded bg-white/5 text-gray-300">
                                                                {scalingConfig.conditions.profitMonths} profitable months
                                                            </span>
                                                        )}
                                                        {scalingConfig.conditions.minProfit && (
                                                            <span className="text-xs px-2 py-1 rounded bg-white/5 text-gray-300">
                                                                {scalingConfig.conditions.minProfit}%+ profit
                                                            </span>
                                                        )}
                                                        {scalingConfig.conditions.maxDrawdown && (
                                                            <span className="text-xs px-2 py-1 rounded bg-white/5 text-gray-300">
                                                                {`<${scalingConfig.conditions.maxDrawdown}% DD`}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                            
                                            <p className="text-xs text-gray-500">
                                                Each scale: +{formatCurrency(scalingConfig.increment, account.currency)} balance
                                            </p>
                                        </div>
                                    )}
                                    
                                    {/* The5ers-style level-based scaling */}
                                    {scalingConfig.type === 'automatic' && scalingConfig.levels && (
                                        <div className="space-y-4">
                                            <p className="text-sm text-gray-400">
                                                Automatic scaling based on performance
                                            </p>
                                            
                                            <div className="space-y-2">
                                                {scalingConfig.levels.map((level, index) => (
                                                    <div
                                                        key={index}
                                                        className="flex items-center justify-between p-3 rounded-lg bg-black/20 border border-white/5"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                                                                {index + 1}
                                                            </div>
                                                            <span className="text-sm text-gray-300">
                                                                {level.profit}% profit
                                                            </span>
                                                        </div>
                                                        <span className="text-sm font-bold text-green-400">
                                                            +{level.balanceIncrease}%
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        {/* Compliance Status */}
                        <div className="glass-card p-6 border-white/5">
                            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Shield size={20} className="text-primary" />
                                Compliance Status
                            </h2>
                            <div className="space-y-3">
                                {/* Daily Loss Status */}
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-400">Daily Loss</span>
                                    <div className="flex items-center gap-2">
                                        {account.latestSnapshot?.isDailyLimitBreached ? (
                                            <span className="px-2 py-1 rounded text-xs font-bold bg-red-500/20 text-red-400">
                                                Breached
                                            </span>
                                        ) : (dailyLossPercentOfLimit >= 80) ? (
                                            <span className="px-2 py-1 rounded text-xs font-bold bg-orange-500/20 text-orange-400">
                                                At Risk
                                            </span>
                                        ) : (
                                            <span className="px-2 py-1 rounded text-xs font-bold bg-green-500/20 text-green-400">
                                                Healthy
                                            </span>
                                        )}
                                        <span className="text-xs text-gray-500">
                                            {formatPercent(dailyLossPercent)} / {dailyLossLimit}%
                                        </span>
                                    </div>
                                </div>
                                
                                {/* Max Drawdown Status */}
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-400">Max Drawdown</span>
                                    <div className="flex items-center gap-2">
                                        {account.latestSnapshot?.isMaxDrawdownBreached ? (
                                            <span className="px-2 py-1 rounded text-xs font-bold bg-red-500/20 text-red-400">
                                                Breached
                                            </span>
                                        ) : (drawdownPercent >= maxDrawdown * 0.8) ? (
                                            <span className="px-2 py-1 rounded text-xs font-bold bg-orange-500/20 text-orange-400">
                                                At Risk
                                            </span>
                                        ) : (
                                            <span className="px-2 py-1 rounded text-xs font-bold bg-green-500/20 text-green-400">
                                                Healthy
                                            </span>
                                        )}
                                        <span className="text-xs text-gray-500">
                                            {formatPercent(drawdownPercent)} / {maxDrawdown}%
                                        </span>
                                    </div>
                                </div>

                                {/* Clean Trading Days Streak */}
                                <div className="pt-3 border-t border-white/5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-400">Clean Days Streak</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg font-bold text-green-400">
                                                {account.violations.filter(v => !v.isResolved && v.severity === 'BREACH').length === 0
                                                    ? (currentPhase?.tradingDaysCount || 0)
                                                    : 0
                                                }
                                            </span>
                                            <span className="text-xs text-gray-500">days</span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {account.violations.filter(v => !v.isResolved).length === 0
                                            ? 'No active violations'
                                            : `${account.violations.filter(v => !v.isResolved).length} unresolved violation(s)`
                                        }
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Violations */}
                        <div className="glass-card p-6 border-white/5">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                    <AlertTriangle size={20} className="text-primary" />
                                    Violations
                                </h2>
                                {account.violations.length > 5 && (
                                    <button
                                        onClick={() => setShowAllViolations(!showAllViolations)}
                                        className="text-xs text-primary hover:text-primary/80 transition-all"
                                    >
                                        {showAllViolations ? 'Show Less' : `Show All (${account.violations.length})`}
                                    </button>
                                )}
                            </div>
                            {account.violations.length === 0 ? (
                                <div className="text-center py-6">
                                    <CheckCircle size={32} className="mx-auto text-green-400 mb-2" />
                                    <p className="text-sm text-gray-400">No violations recorded</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {(showAllViolations ? account.violations : account.violations.slice(0, 5)).map((violation) => (
                                        <div
                                            key={violation.id}
                                            className={cn(
                                                "p-3 rounded-lg border transition-all",
                                                violation.isResolved
                                                    ? "opacity-50 border-gray-500/30 bg-gray-500/5"
                                                    : getSeverityColor(violation.severity)
                                            )}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold uppercase">
                                                        {getRuleTypeLabel(violation.ruleType)}
                                                    </span>
                                                    {violation.isResolved && (
                                                        <span className="flex items-center gap-1 text-xs text-green-400">
                                                            <CheckCircle size={12} />
                                                            Acknowledged
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-xs text-gray-400">
                                                    {new Date(violation.occurredAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-300 mb-2">{violation.description}</p>
                                            {!violation.isResolved && (
                                                <button
                                                    onClick={() => handleAcknowledgeViolation(violation.id)}
                                                    disabled={acknowledgingId === violation.id}
                                                    className={cn(
                                                        "text-xs px-3 py-1 rounded-lg transition-all",
                                                        "bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white",
                                                        "border border-white/10 hover:border-white/20",
                                                        acknowledgingId === violation.id && "opacity-50 cursor-not-allowed"
                                                    )}
                                                >
                                                    {acknowledgingId === violation.id ? 'Acknowledging...' : 'Acknowledge'}
                                                </button>
                                            )}
                                            {violation.isResolved && violation.resolvedAt && (
                                                <p className="text-xs text-gray-500">
                                                    Resolved: {new Date(violation.resolvedAt).toLocaleDateString()}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </DashboardShell>
    );
}

export default function PropFirmAccountPage() {
    return (
        <Suspense fallback={
            <DashboardShell>
                <div className="flex items-center justify-center min-h-[60vh]">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            </DashboardShell>
        }>
            <PropFirmAccountContent />
        </Suspense>
    );
}
