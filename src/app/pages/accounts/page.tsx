'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import DashboardShell from '@/components/layout/DashboardShell';
import {
    Wallet, Building2, Loader2, ArrowRight, ChevronUp, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useCurrency } from '@/lib/currency';

interface AccountSummary {
    id: string;
    name: string;
    isActive: boolean;
    accountSize: number | null;
    currentBalance: number | null;
    currentEquity: number | null;
    currentPhase: string | null;
    tradeCount: number;
    closedTradeCount: number;
    totalPnl: number;
    propFirm: {
        id: string;
        name: string;
        dailyLossLimit: number;
        maxDrawdown: number;
    } | null;
}

type SortKey = 'name' | 'totalPnl' | 'tradeCount' | 'currentBalance';
type SortDir = 'asc' | 'desc';

function phaseBadge(phase: string | null) {
    if (!phase) return null;
    const colors: Record<string, string> = {
        Phase1: 'bg-blue-500/20 text-blue-400',
        Phase2: 'bg-purple-500/20 text-purple-400',
        Funded: 'bg-green-500/20 text-green-400',
    };
    return (
        <span className={cn('px-2 py-0.5 rounded text-[10px] font-black uppercase', colors[phase] ?? 'bg-white/10 text-gray-400')}>
            {phase}
        </span>
    );
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
    if (!active) return <ChevronUp size={10} className="text-gray-600" />;
    return dir === 'asc' ? <ChevronUp size={10} className="text-primary" /> : <ChevronDown size={10} className="text-primary" />;
}

function AccountCard({ account, onClick }: { account: AccountSummary; onClick: () => void }) {
    const { formatAmount, formatPnl } = useCurrency();
    const balance = account.currentBalance ?? account.accountSize ?? 0;
    const pnlPositive = account.totalPnl >= 0;

    return (
        <button
            onClick={onClick}
            className="glass-card p-5 border-white/5 text-left w-full hover:border-primary/20 hover:bg-white/[0.03] transition-all group"
        >
            <div className="flex items-start justify-between mb-4">
                <div>
                    <p className="font-black text-white text-sm">{account.name}</p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">
                        {account.propFirm?.name ?? 'Manual'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {phaseBadge(account.currentPhase)}
                    <ArrowRight size={14} className="text-gray-600 group-hover:text-primary transition-colors" />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Balance</p>
                    <p className="text-sm font-bold text-white">{formatAmount(balance)}</p>
                </div>
                <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">P&L</p>
                    <p className={cn('text-sm font-bold', pnlPositive ? 'text-green-400' : 'text-red-400')}>
                        {formatPnl(account.totalPnl)}
                    </p>
                </div>
                <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Trades</p>
                    <p className="text-sm font-bold text-white">{account.tradeCount}</p>
                </div>
                <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Closed</p>
                    <p className="text-sm font-bold text-white">{account.closedTradeCount}</p>
                </div>
            </div>

            {account.propFirm && account.accountSize && account.currentBalance && (
                <div className="mt-4">
                    <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                        <span>Drawdown</span>
                        <span>
                            {(((account.accountSize - account.currentBalance) / account.accountSize) * 100).toFixed(2)}% / {account.propFirm.maxDrawdown}%
                        </span>
                    </div>
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-orange-500 rounded-full transition-all"
                            style={{
                                width: `${Math.min(100, ((account.accountSize - account.currentBalance) / account.accountSize / (account.propFirm.maxDrawdown / 100)) * 100)}%`
                            }}
                        />
                    </div>
                </div>
            )}
        </button>
    );
}

function AccountsContent() {
    const router = useRouter();
    const { formatAmount, formatPnl } = useCurrency();
    const [accounts, setAccounts] = useState<AccountSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDir, setSortDir] = useState<SortDir>('asc');

    useEffect(() => {
        fetch('/api/accounts')
            .then(r => r.json())
            .then(d => setAccounts(d.accounts ?? []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir('asc'); }
    };

    const sorted = [...accounts].sort((a, b) => {
        const av = (a[sortKey] ?? 0);
        const bv = (b[sortKey] ?? 0);
        if (typeof av === 'string' && typeof bv === 'string') {
            return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
        }
        return sortDir === 'asc' ? (Number(av) - Number(bv)) : (Number(bv) - Number(av));
    });

    const goToAccount = (id: string) => router.push(`/pages/prop-firm/${id}`);

    if (loading) {
        return (
            <DashboardShell>
                <div className="flex items-center justify-center min-h-[60vh]">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            </DashboardShell>
        );
    }

    const TABLE_COLS: { key: SortKey | null; label: string }[] = [
        { key: 'name', label: 'Name' },
        { key: null, label: 'Prop Firm' },
        { key: 'currentBalance', label: 'Balance' },
        { key: 'tradeCount', label: 'Trades' },
        { key: 'totalPnl', label: 'P&L' },
        { key: null, label: 'Phase' },
        { key: null, label: '' },
    ];

    return (
        <DashboardShell>
            <div className="space-y-8">
                <div>
                    <h1 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                        <Wallet size={24} className="text-primary" />
                        Trading Accounts
                    </h1>
                    <p className="text-sm text-gray-400 mt-1">
                        {accounts.length} account{accounts.length !== 1 ? 's' : ''} · click any account to view challenge details
                    </p>
                </div>

                {accounts.length === 0 && (
                    <div className="glass-card p-12 border-white/5 text-center">
                        <Building2 size={48} className="mx-auto text-gray-700 mb-4" />
                        <p className="text-gray-400 font-bold">No trading accounts yet</p>
                        <p className="text-xs text-gray-600 mt-1">
                            Create one in <a href="/settings" className="text-primary hover:underline">Settings → Accounts</a>
                        </p>
                    </div>
                )}

                {accounts.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {sorted.map(account => (
                            <AccountCard key={account.id} account={account} onClick={() => goToAccount(account.id)} />
                        ))}
                    </div>
                )}

                {accounts.length > 1 && (
                    <div className="glass-card border-white/5 overflow-hidden">
                        <div className="px-6 py-4 border-b border-white/5">
                            <h2 className="text-xs font-black uppercase tracking-widest text-white">Account Comparison</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-white/5">
                                        {TABLE_COLS.map(col => (
                                            <th
                                                key={col.label}
                                                onClick={col.key ? () => handleSort(col.key!) : undefined}
                                                className={cn(
                                                    'px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-gray-500',
                                                    col.key && 'cursor-pointer hover:text-white select-none'
                                                )}
                                            >
                                                <span className="flex items-center gap-1">
                                                    {col.label}
                                                    {col.key && <SortIcon active={sortKey === col.key} dir={sortDir} />}
                                                </span>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {sorted.map(account => (
                                        <tr
                                            key={account.id}
                                            onClick={() => goToAccount(account.id)}
                                            className="border-b border-white/5 hover:bg-white/[0.02] cursor-pointer transition-colors"
                                        >
                                            <td className="px-4 py-3 font-bold text-white">{account.name}</td>
                                            <td className="px-4 py-3 text-gray-400">{account.propFirm?.name ?? '—'}</td>
                                            <td className="px-4 py-3 text-gray-300">
                                                {account.currentBalance != null ? formatAmount(account.currentBalance) : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-gray-300">{account.tradeCount}</td>
                                            <td className={cn('px-4 py-3 font-bold', account.totalPnl >= 0 ? 'text-green-400' : 'text-red-400')}>
                                                {formatPnl(account.totalPnl)}
                                            </td>
                                            <td className="px-4 py-3">{phaseBadge(account.currentPhase)}</td>
                                            <td className="px-4 py-3">
                                                <ArrowRight size={14} className="text-gray-600" />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </DashboardShell>
    );
}

export default function AccountsPage() {
    return (
        <Suspense fallback={
            <DashboardShell>
                <div className="flex items-center justify-center min-h-[60vh]">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            </DashboardShell>
        }>
            <AccountsContent />
        </Suspense>
    );
}
