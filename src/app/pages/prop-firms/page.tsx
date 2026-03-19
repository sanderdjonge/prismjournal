'use client';

import { useState, useEffect, Suspense } from 'react';
import DashboardShell from '@/components/layout/DashboardShell';
import {
    Building2,
    CheckCircle,
    XCircle,
    AlertTriangle,
    Loader2,
    ExternalLink,
    Star,
} from 'lucide-react';
import { cn } from '@/lib/cn';

interface PropFirm {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    website: string | null;
    challengeType: string;
    dailyLossLimit: number;
    maxDrawdown: number;
    drawdownType: string;
    allowNewsTrading: boolean;
    allowWeekendHolding: boolean;
    allowEA: boolean;
    phasesConfig: string;
    hasScalingPlan: boolean;
    popularity: number;
}

interface UserAccount {
    id: string;
    name: string;
    propFirmId: string | null;
}

function PropFirmsContent() {
    const [propFirms, setPropFirms] = useState<PropFirm[]>([]);
    const [userAccounts, setUserAccounts] = useState<UserAccount[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            try {
                const [firmsRes, accountsRes] = await Promise.all([
                    fetch('/api/prop-firms'),
                    fetch('/api/accounts'),
                ]);

                if (firmsRes.ok) {
                    const data = await firmsRes.json();
                    setPropFirms(data.propFirms || []);
                }

                if (accountsRes.ok) {
                    const data = await accountsRes.json();
                    setUserAccounts(data.accounts || []);
                }
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, []);

    const hasAccountWithFirm = (firmId: string) => {
        return userAccounts.some(account => account.propFirmId === firmId);
    };

    const parsePhasesConfig = (config: string) => {
        try {
            return JSON.parse(config);
        } catch {
            return [];
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

    return (
        <DashboardShell>
            <div className="space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-white">Prop Firm Comparison</h1>
                    <p className="text-sm text-gray-400 mt-1">
                        Compare prop firm rules and find the best fit for your trading style
                    </p>
                </div>

                {/* Comparison Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {propFirms.map((firm) => {
                        const hasAccount = hasAccountWithFirm(firm.id);
                        const phases = parsePhasesConfig(firm.phasesConfig);

                        return (
                            <div
                                key={firm.id}
                                className={cn(
                                    "glass-card p-6 border-white/5 transition-all",
                                    hasAccount && "ring-2 ring-primary/30"
                                )}
                            >
                                {/* Header */}
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                            <Building2 size={20} className="text-purple-400" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white">{firm.name}</h3>
                                            {hasAccount && (
                                                <span className="text-xs text-primary flex items-center gap-1">
                                                    <CheckCircle size={12} />
                                                    Your Account
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {firm.website && (
                                        <a
                                            href={firm.website}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-gray-400 hover:text-white transition-all"
                                        >
                                            <ExternalLink size={16} />
                                        </a>
                                    )}
                                </div>

                                {/* Challenge Type */}
                                <div className="mb-4">
                                    <span className={cn(
                                        "px-2 py-1 rounded text-xs font-bold",
                                        firm.challengeType === 'TWO_PHASE' && "bg-blue-500/20 text-blue-400",
                                        firm.challengeType === 'ONE_PHASE' && "bg-profit/20 text-profit",
                                        firm.challengeType === 'THREE_PHASE' && "bg-purple-500/20 text-purple-400"
                                    )}>
                                        {firm.challengeType.replace(/_/g, ' ')}
                                    </span>
                                </div>

                                {/* Rules Grid */}
                                <div className="space-y-3 mb-4">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-400">Daily Loss</span>
                                        <span className="text-orange-400 font-bold">{firm.dailyLossLimit}%</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-400">Max Drawdown</span>
                                        <span className="text-orange-400 font-bold">{firm.maxDrawdown}%</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-400">DD Type</span>
                                        <span className="text-white">{firm.drawdownType}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-400">Phases</span>
                                        <span className="text-white">{phases.length || 'N/A'}</span>
                                    </div>
                                </div>

                                {/* Restrictions */}
                                <div className="pt-4 border-t border-white/5">
                                    <p className="text-xs text-gray-500 mb-2">Restrictions</p>
                                    <div className="flex flex-wrap gap-2">
                                        <span className={cn(
                                            "flex items-center gap-1 text-xs px-2 py-1 rounded",
                                            firm.allowNewsTrading 
                                                ? "bg-profit/10 text-profit" 
                                                : "bg-loss/10 text-loss"
                                        )}>
                                            {firm.allowNewsTrading ? <CheckCircle size={12} /> : <XCircle size={12} />}
                                            News
                                        </span>
                                        <span className={cn(
                                            "flex items-center gap-1 text-xs px-2 py-1 rounded",
                                            firm.allowWeekendHolding 
                                                ? "bg-profit/10 text-profit" 
                                                : "bg-loss/10 text-loss"
                                        )}>
                                            {firm.allowWeekendHolding ? <CheckCircle size={12} /> : <XCircle size={12} />}
                                            Weekend
                                        </span>
                                        <span className={cn(
                                            "flex items-center gap-1 text-xs px-2 py-1 rounded",
                                            firm.allowEA 
                                                ? "bg-profit/10 text-profit" 
                                                : "bg-loss/10 text-loss"
                                        )}>
                                            {firm.allowEA ? <CheckCircle size={12} /> : <XCircle size={12} />}
                                            EA
                                        </span>
                                    </div>
                                </div>

                                {/* Scaling Plan */}
                                {firm.hasScalingPlan && (
                                    <div className="mt-4 pt-4 border-t border-white/5">
                                        <span className="flex items-center gap-1 text-xs text-primary">
                                            <Star size={12} />
                                            Scaling Plan Available
                                        </span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {propFirms.length === 0 && (
                    <div className="text-center py-12">
                        <Building2 size={48} className="mx-auto text-gray-600 mb-4" />
                        <p className="text-gray-400">No prop firms found</p>
                    </div>
                )}
            </div>
        </DashboardShell>
    );
}

export default function PropFirmsPage() {
    return (
        <Suspense fallback={
            <DashboardShell>
                <div className="flex items-center justify-center min-h-[60vh]">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            </DashboardShell>
        }>
            <PropFirmsContent />
        </Suspense>
    );
}
