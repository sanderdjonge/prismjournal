/**
 * Compliance Analytics Widget
 *
 * Displays the correlation between checklist completion and trade outcomes.
 * Shows win rate and avg R for 100% complete, partial, and no completion trades.
 */

'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, XCircle, Minus, TrendingUp, TrendingDown, HelpCircle } from 'lucide-react';
import { formatPercent, fmtDecimals } from '@/lib/formatNumber';
import type { ComplianceMetrics } from '@/types/analytics'

interface ComplianceWidgetProps {
    accountId?: string | null;
    strategyId?: string | null;
}

async function fetchComplianceMetrics(accountId?: string, strategyId?: string): Promise<ComplianceMetrics> {
    const params = new URLSearchParams();
    if (accountId) params.append('accountId', accountId);
    if (strategyId) params.append('strategyId', strategyId);

    const res = await fetch(`/api/analytics/compliance?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch compliance metrics');
    return res.json();
}

export default function ComplianceWidget({ accountId, strategyId }: ComplianceWidgetProps) {
    const { data, isLoading, error } = useQuery({
        queryKey: ['complianceMetrics', accountId, strategyId],
        queryFn: () => fetchComplianceMetrics(accountId ?? undefined, strategyId ?? undefined),
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

    if (isLoading) {
        return (
            <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-6 bg-white/10 rounded w-1/3" />
                    <div className="h-24 bg-white/5 rounded" />
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">Checklist Impact</h3>
                <p className="text-gray-500">Unable to load compliance data</p>
            </div>
        );
    }

    // Check if we have meaningful data
    if (data.overall.totalTrades === 0) {
        return (
            <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">Checklist Impact</h3>
                <div className="flex items-center gap-2 text-gray-500">
                    <HelpCircle className="w-5 h-5" />
                    <span>No trades with checklist data yet</span>
                </div>
            </div>
        );
    }

    // Determine if checklist completion improves results
    const fullVsNoneDiff = data.fullCompletion.winRate - data.noCompletion.winRate;
    const improves = fullVsNoneDiff > 5;

    return (
        <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">Checklist Impact</h3>
                {improves ? (
                    <div className="flex items-center gap-1 text-green-400 text-sm">
                        <TrendingUp className="w-4 h-4" />
                        <span>+{formatPercent(fullVsNoneDiff, 0)} win rate</span>
                    </div>
                ) : fullVsNoneDiff < -5 ? (
                    <div className="flex items-center gap-1 text-red-400 text-sm">
                        <TrendingDown className="w-4 h-4" />
                        <span>{formatPercent(fullVsNoneDiff, 0)} win rate</span>
                    </div>
                ) : null}
            </div>

            {/* Completion Rate Summary */}
            <div className="mb-6 p-3 bg-white/5 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-gray-500 uppercase tracking-wider">Completion Rate</span>
                    <span className="text-sm font-medium text-white">{formatPercent(data.overall.completionRate, 0)}</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                        style={{ width: `${data.overall.completionRate}%` }}
                    />
                </div>
                <div className="mt-1 text-xs text-gray-500">
                    {data.overall.totalTrades} total trades • Avg {formatPercent(data.overall.avgCompletionPct, 0)} completion
                </div>
            </div>

            {/* Completion Groups */}
            <div className="space-y-3">
                {/* 100% Complete */}
                <CompletionRow
                    icon={<CheckCircle2 className="w-5 h-5 text-green-400" />}
                    label="100% Complete"
                    count={data.fullCompletion.tradeCount}
                    winRate={data.fullCompletion.winRate}
                    avgRR={data.fullCompletion.avgRR}
                    totalPnl={data.fullCompletion.totalPnl}
                    highlight
                />

                {/* Partial */}
                <CompletionRow
                    icon={<Minus className="w-5 h-5 text-yellow-400" />}
                    label="Partial (1-99%)"
                    count={data.partialCompletion.tradeCount}
                    winRate={data.partialCompletion.winRate}
                    avgRR={data.partialCompletion.avgRR}
                    totalPnl={data.partialCompletion.totalPnl}
                />

                {/* No Completion */}
                <CompletionRow
                    icon={<XCircle className="w-5 h-5 text-gray-500" />}
                    label="No Checklist"
                    count={data.noCompletion.tradeCount}
                    winRate={data.noCompletion.winRate}
                    avgRR={data.noCompletion.avgRR}
                    totalPnl={data.noCompletion.totalPnl}
                />
            </div>

            {/* Insight */}
            {data.fullCompletion.tradeCount >= 5 && data.noCompletion.tradeCount >= 5 && (
                <div className={`mt-6 p-3 rounded-lg text-sm ${
                    improves ? 'bg-green-500/10 text-green-300' : 'bg-yellow-500/10 text-yellow-300'
                }`}>
                    {improves ? (
                        <>
                            📈 Completing your checklist appears to improve your win rate by <strong>+{formatPercent(fullVsNoneDiff, 0)}</strong>
                        </>
                    ) : (
                        <>
                            ⚠️ Checklist completion doesn't show significant improvement yet. Consider refining your checklist rules.
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

function CompletionRow({
    icon,
    label,
    count,
    winRate,
    avgRR,
    totalPnl,
    highlight = false,
}: {
    icon: React.ReactNode;
    label: string;
    count: number;
    winRate: number;
    avgRR: number;
    totalPnl: number;
    highlight?: boolean;
}) {
    if (count === 0) return null;

    return (
        <div className={`flex items-center justify-between p-3 rounded-lg ${highlight ? 'bg-white/5' : ''}`}>
            <div className="flex items-center gap-3">
                {icon}
                <div>
                    <div className={`text-sm font-medium ${highlight ? 'text-white' : 'text-gray-300'}`}>
                        {label}
                    </div>
                    <div className="text-xs text-gray-500">
                        {count} trade{count !== 1 ? 's' : ''}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-4 text-right">
                <div>
                    <div className="text-xs text-gray-500">Win Rate</div>
                    <div className={`text-sm font-medium ${winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatPercent(winRate, 0)}
                    </div>
                </div>
                <div>
                    <div className="text-xs text-gray-500">Avg R</div>
                    <div className={`text-sm font-medium ${avgRR >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {avgRR >= 0 ? '+' : ''}{fmtDecimals(avgRR, 2)}R
                    </div>
                </div>
                <div>
                    <div className="text-xs text-gray-500">P&L</div>
                    <div className={`text-sm font-medium ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        ${fmtDecimals(totalPnl, 2)}
                    </div>
                </div>
            </div>
        </div>
    );
}