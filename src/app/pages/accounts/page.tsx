'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import DashboardShell from '@/components/layout/DashboardShell';
import {
    Wallet, Building2, Loader2, ArrowRight, ChevronUp, ChevronDown,
    Link as LinkIcon, Download, Copy, Check, RefreshCw, Eye, EyeOff,
    Plus, X, Edit2, Archive, Target, DollarSign, BarChart3, AlertTriangle,
    CheckCircle, Calendar, Shield, Trash2
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useCurrency } from '@/lib/currency';
import { autoScreenshotConfigSchema } from '@/lib/validations/screenshot-config';
import { calculateDrawdown } from '@/lib/drawdown';

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
    highWaterMark?: number;
    propFirm: {
        id: string;
        name: string;
        dailyLossLimit: number;
        maxDrawdown: number;
        drawdownType: 'STATIC' | 'TRAILING';
    } | null;
    broker: string | null;
    platform: string;
    currency: string;
    propFirmId: string | null;
    platformAccountId: string | null;
    profitSplit: number | null;
    allowNewsTrading: boolean | null;
    allowWeekendHolding: boolean | null;
    allowEA: boolean | null;
    maxDailyLoss: number | null;
    maxTotalDrawdown: number | null;
    profitTarget: number | null;
    autoScreenshotConfig: unknown;
}

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
    phasesConfig: Array<{ profitTarget?: number; [key: string]: unknown }> | string;
    hasScalingPlan: boolean;
    scalingConfig: unknown;
    popularity: number;
}

interface BridgeKeyInfo {
    bridgeKey: string | null;
    bridgeKeyId: string | null;
    isHashed: boolean;
    syncUrl: string;
}

type SortKey = 'name' | 'totalPnl' | 'tradeCount' | 'currentBalance';
type SortDir = 'asc' | 'desc';

type ScreenshotConfig = {
    enabled: boolean;
    openTimeframes: string[];
    closeTimeframes: string[];
    barsOfContext: number;
    screenshotDelayBars: number;
};

const DEFAULT_SCREENSHOT_CONFIG: ScreenshotConfig = {
    enabled: false,
    openTimeframes: [],
    closeTimeframes: [],
    barsOfContext: 25,
    screenshotDelayBars: 0,
};

const TIMEFRAME_OPTIONS = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1'] as const;

const PLATFORM_LABELS: Record<string, string> = {
    METATRADER5: 'MT5',
    CTRADER: 'cTrader',
    TRADINGVIEW: 'TradingView',
    MANUAL: 'Manual',
};

const PLATFORM_COLORS: Record<string, string> = {
    METATRADER5: 'bg-orange-500/20 text-orange-400',
    CTRADER: 'bg-blue-500/20 text-blue-400',
    TRADINGVIEW: 'bg-profit/20 text-profit',
    MANUAL: 'bg-gray-500/20 text-gray-400',
};

function phaseBadge(phase: string | null) {
    if (!phase) return null;
    const colors: Record<string, string> = {
        Phase1: 'bg-blue-500/20 text-blue-400',
        Phase2: 'bg-purple-500/20 text-purple-400',
        Funded: 'bg-profit/20 text-profit',
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

function AccountCard({ account, onClick, onEdit, onArchive }: { account: AccountSummary; onClick: () => void; onEdit: () => void; onArchive: () => void }) {
    const { formatAmount, formatPnl } = useCurrency();
    const balance = account.currentBalance ?? account.accountSize ?? 0;
    const pnlPositive = account.totalPnl >= 0;

    return (
        <div className="glass-card p-5 border-white/5 text-left w-full hover:border-primary/20 hover:bg-white/[0.03] transition-all group">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <p className="font-black text-white text-sm">{account.name}</p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">
                        {account.propFirm?.name ?? 'Manual'}
                    </p>
                    {account.platformAccountId && (
                        <p className="text-[10px] font-mono text-gray-600 mt-0.5">
                            #{account.platformAccountId}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {phaseBadge(account.currentPhase)}
                    <button
                        onClick={onClick}
                        className="p-1.5 rounded-lg hover:bg-white/5 transition-all"
                        title="View details"
                    >
                        <ArrowRight size={14} className="text-gray-600 group-hover:text-primary transition-colors" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Balance</p>
                    <p className="text-sm font-bold text-white">{formatAmount(balance)}</p>
                </div>
                <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">P&L</p>
                    <p className={cn('text-sm font-bold', pnlPositive ? 'text-profit' : 'text-loss')}>
                        {formatPnl(account.totalPnl)}
                    </p>
                </div>
                <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Trades</p>
                    <p className="text-sm font-bold text-white">{account.tradeCount}</p>
                </div>
                <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Platform</p>
                    <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold', PLATFORM_COLORS[account.platform] || 'bg-gray-500/20 text-gray-400')}>
                        {PLATFORM_LABELS[account.platform] || account.platform}
                    </span>
                </div>
            </div>

            {account.propFirm && account.accountSize && account.currentBalance && (() => {
                const drawdownPct = calculateDrawdown({
                    drawdownType: account.propFirm.drawdownType,
                    accountSize: account.accountSize,
                    currentBalance: account.currentBalance,
                    highWaterMark: account.highWaterMark ?? null,
                });
                const barPct = Math.min(100, (drawdownPct / account.propFirm.maxDrawdown) * 100);
                const barColor = drawdownPct === 0 ? 'bg-profit' : barPct >= 80 ? 'bg-red-500' : 'bg-orange-500';
                
                return (
                    <div className="mt-4">
                        <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                            <span className="flex items-center gap-1.5">
                                Drawdown
                                <span className="text-[8px] font-black uppercase tracking-widest text-gray-600">
                                    {account.propFirm.drawdownType === 'TRAILING' ? '(Trail)' : '(Static)'}
                                </span>
                            </span>
                            <span>{drawdownPct.toFixed(2)}% / {account.propFirm.maxDrawdown}%</span>
                        </div>
                        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                            <div
                                className={`h-full ${barColor} rounded-full transition-all`}
                                style={{ width: `${barPct}%` }}
                            />
                        </div>
                    </div>
                );
            })()}

            <div className="mt-4 pt-3 border-t border-white/5 flex justify-end gap-4">
                <button
                    onClick={(e) => { e.stopPropagation(); onArchive(); }}
                    className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-loss/70 hover:text-loss transition-all"
                >
                    <Archive size={12} /> Archive
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); onEdit(); }}
                    className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-white transition-all"
                >
                    <Edit2 size={12} /> Edit
                </button>
            </div>
        </div>
    );
}

function AccountsContent() {
    const router = useRouter();
    const { formatAmount, formatPnl } = useCurrency();
    const [accounts, setAccounts] = useState<AccountSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    
    // Active tab state
    const [activeTab, setActiveTab] = useState<'accounts' | 'connect'>('accounts');
    
    // Bridge state
    const [bridgeInfo, setBridgeInfo] = useState<BridgeKeyInfo | null>(null);
    const [showKey, setShowKey] = useState(false);
    const [copied, setCopied] = useState<string | null>(null);
    const [regenerating, setRegenerating] = useState(false);
    
    // Prop firms state
    const [propFirms, setPropFirms] = useState<PropFirm[]>([]);
    const [propFirmsLoading, setPropFirmsLoading] = useState(true);
    
    // Add account modal state
    const [showAddAccount, setShowAddAccount] = useState(false);
    const [newAccount, setNewAccount] = useState<{
        name: string;
        broker: string;
        platform: 'METATRADER5' | 'CTRADER' | 'TRADINGVIEW' | 'MANUAL';
        platformAccountId: string;
        accountType: 'PROPFIRM' | 'OWN_MONEY';
        propFirmId: string;
        accountSize: string;
        currency: string;
    }>({
        name: '',
        broker: '',
        platform: 'METATRADER5',
        platformAccountId: '',
        accountType: 'OWN_MONEY',
        propFirmId: '',
        accountSize: '',
        currency: 'USD',
    });
    const [addingAccount, setAddingAccount] = useState(false);
    
    // Archived accounts state
    const [showArchived, setShowArchived] = useState(false);
    const [archivedAccounts, setArchivedAccounts] = useState<AccountSummary[]>([]);
    const [archivedLoading, setArchivedLoading] = useState(false);

    // Delete confirmation modal state
    const [deleteTarget, setDeleteTarget] = useState<AccountSummary | null>(null);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [deleting, setDeleting] = useState(false);

    // Edit account modal state
    const [editingAccount, setEditingAccount] = useState<AccountSummary | null>(null);
    const [editForm, setEditForm] = useState<{
        name: string;
        broker: string;
        platformAccountId: string;
        propFirmId: string;
        accountSize: string;
        currency: string;
        profitSplit: string;
        maxDailyLoss: string;
        maxTotalDrawdown: string;
        profitTarget: string;
        screenshotConfig: ScreenshotConfig;
    }>({
        name: '',
        broker: '',
        platformAccountId: '',
        propFirmId: '',
        accountSize: '',
        currency: 'USD',
        profitSplit: '',
        maxDailyLoss: '',
        maxTotalDrawdown: '',
        profitTarget: '',
        screenshotConfig: DEFAULT_SCREENSHOT_CONFIG,
    });
    const [savingEdit, setSavingEdit] = useState(false);

    useEffect(() => {
        loadAccountsData();
        loadPropFirms();
        loadBridgeInfo();
    }, []);

    const loadAccountsData = async () => {
        try {
            const res = await fetch('/api/accounts');
            if (res.ok) {
                const data = await res.json();
                setAccounts(data.accounts ?? []);
            }
        } catch (error) {
            // error handled by loading state
        } finally {
            setLoading(false);
        }
    };

    const loadPropFirms = async () => {
        try {
            const res = await fetch('/api/prop-firms');
            if (res.ok) {
                const data = await res.json();
                setPropFirms(data.propFirms);
            }
        } catch (error) {
            // error handled by loading state
        } finally {
            setPropFirmsLoading(false);
        }
    };

    const loadBridgeInfo = async () => {
        try {
            const res = await fetch('/api/account/bridge');
            if (res.ok) {
                const data = await res.json();
                setBridgeInfo(data);
            }
        } catch (error) {
            // error handled by loading state
        }
    };

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

    async function handleCopy(text: string, label: string) {
        await navigator.clipboard.writeText(text);
        setCopied(label);
        setTimeout(() => setCopied(null), 2000);
    }

    async function handleRegenerate() {
        if (!confirm('Regenerate your Bridge Key? Your existing MT5 connection will stop working until you update the key in the EA.')) return;
        setRegenerating(true);
        try {
            const res = await fetch('/api/account/bridge', { method: 'POST' });
            const data = await res.json();
            if (data.bridgeKey) {
                // Show the new key directly — it's only available once, don't re-fetch
                setBridgeInfo(prev => prev ? { ...prev, bridgeKey: data.bridgeKey, bridgeKeyId: data.bridgeKeyId, isHashed: false } : prev);
                setShowKey(true);
            }
        } finally {
            setRegenerating(false);
        }
    }

    const handleStartEdit = (account: AccountSummary) => {
        setEditingAccount(account);
        setEditForm({
            name: account.name,
            broker: account.broker || '',
            platformAccountId: account.platformAccountId || '',
            propFirmId: account.propFirmId || '',
            accountSize: account.accountSize?.toString() || '',
            currency: account.currency || 'USD',
            profitSplit: account.profitSplit?.toString() || '',
            maxDailyLoss: account.maxDailyLoss?.toString() || '',
            maxTotalDrawdown: account.maxTotalDrawdown?.toString() || '',
            profitTarget: account.profitTarget?.toString() || '',
            screenshotConfig: (() => {
                if (!account.autoScreenshotConfig) return DEFAULT_SCREENSHOT_CONFIG;
                const result = autoScreenshotConfigSchema.safeParse(account.autoScreenshotConfig);
                return result.success ? (result.data as ScreenshotConfig) : DEFAULT_SCREENSHOT_CONFIG;
            })(),
        });
    };

    const handleSaveEdit = async () => {
        if (!editingAccount) return;
        
        setSavingEdit(true);
        try {
            const res = await fetch(`/api/accounts/${editingAccount.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: editForm.name,
                    broker: editForm.broker || null,
                    platformAccountId: editForm.platformAccountId || null,
                    propFirmId: editForm.propFirmId || null,
                    accountSize: editForm.accountSize ? parseFloat(editForm.accountSize) : null,
                    currency: editForm.currency,
                    profitSplit: editForm.profitSplit ? parseFloat(editForm.profitSplit) : null,
                    maxDailyLoss: editForm.maxDailyLoss ? parseFloat(editForm.maxDailyLoss) : null,
                    maxTotalDrawdown: editForm.maxTotalDrawdown ? parseFloat(editForm.maxTotalDrawdown) : null,
                    profitTarget: editForm.profitTarget ? parseFloat(editForm.profitTarget) : null,
                    autoScreenshotConfig: editForm.screenshotConfig,
                }),
            });
            
            if (res.ok) {
                await loadAccountsData();
                setEditingAccount(null);
            }
        } catch (error) {
            // error handled by saving state
        } finally {
            setSavingEdit(false);
        }
    };

    const handleArchive = async (accountId: string) => {
        if (!confirm('Are you sure you want to archive this account? It will no longer appear in your active accounts.')) {
            return;
        }
        
        try {
            const res = await fetch(`/api/accounts/${accountId}`, { method: 'DELETE' });
            
            if (res.ok) {
                await loadAccountsData();
            } else {
                const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
                alert(`Failed to archive account: ${errorData.error || 'Please try again.'}`);
            }
        } catch (error) {
            alert('An error occurred while archiving the account.');
        }
    };

    const loadArchivedAccounts = async () => {
        setArchivedLoading(true);
        try {
            const res = await fetch('/api/accounts?includeArchived=true');
            if (res.ok) {
                const data = await res.json();
                setArchivedAccounts((data.accounts ?? []).filter((a: AccountSummary) => !a.isActive));
            }
        } finally {
            setArchivedLoading(false);
        }
    };

    const handleToggleArchived = () => {
        const next = !showArchived;
        setShowArchived(next);
        if (next && archivedAccounts.length === 0) loadArchivedAccounts();
    };

    const handlePermanentDelete = async () => {
        if (!deleteTarget || deleteConfirmText !== deleteTarget.name) return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/accounts/${deleteTarget.id}?permanent=true`, { method: 'DELETE' });
            if (res.ok) {
                setArchivedAccounts(prev => prev.filter(a => a.id !== deleteTarget.id));
                setDeleteTarget(null);
                setDeleteConfirmText('');
            }
        } finally {
            setDeleting(false);
        }
    };

    const handleAddAccount = async () => {
        if (!newAccount.name.trim()) return;
        
        setAddingAccount(true);
        try {
            const res = await fetch('/api/accounts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newAccount.name,
                    broker: newAccount.broker || undefined,
                    platform: newAccount.platform,
                    platformAccountId: newAccount.platformAccountId || undefined,
                    accountType: newAccount.accountType,
                    propFirmId: newAccount.propFirmId || undefined,
                    accountSize: newAccount.accountSize ? parseFloat(newAccount.accountSize) : undefined,
                    currency: newAccount.currency,
                }),
            });
            
            if (res.ok) {
                await loadAccountsData();
                setShowAddAccount(false);
                setNewAccount({
                    name: '',
                    broker: '',
                    platform: 'METATRADER5',
                    platformAccountId: '',
                    accountType: 'OWN_MONEY',
                    propFirmId: '',
                    accountSize: '',
                    currency: 'USD',
                });
            }
        } catch (error) {
            // error handled by loading state
        } finally {
            setAddingAccount(false);
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
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                            <Wallet size={24} className="text-primary" />
                            Trading Accounts
                        </h1>
                        <p className="text-sm text-gray-400 mt-1">
                            {accounts.filter(a => a.isActive).length} active account{accounts.filter(a => a.isActive).length !== 1 ? 's' : ''}
                        </p>
                    </div>
                    <button
                        onClick={() => setShowAddAccount(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-black text-xs font-black uppercase tracking-widest hover:brightness-110 transition-all"
                    >
                        <Plus size={14} />
                        Add Account
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 border-b border-white/5 pb-2">
                    <button
                        onClick={() => setActiveTab('accounts')}
                        className={cn(
                            "px-4 py-2 text-xs font-black uppercase tracking-widest transition-all",
                            activeTab === 'accounts'
                                ? "text-primary border-b-2 border-primary"
                                : "text-gray-500 hover:text-white"
                        )}
                    >
                        <Wallet size={14} className="inline mr-2" />
                        Accounts
                    </button>
                    <button
                        onClick={() => setActiveTab('connect')}
                        className={cn(
                            "px-4 py-2 text-xs font-black uppercase tracking-widest transition-all",
                            activeTab === 'connect'
                                ? "text-primary border-b-2 border-primary"
                                : "text-gray-500 hover:text-white"
                        )}
                    >
                        <LinkIcon size={14} className="inline mr-2" />
                        Connection Hub
                    </button>
                </div>

                {/* Accounts Tab */}
                {activeTab === 'accounts' && (
                    <div className="space-y-8">
                        {accounts.length === 0 && (
                            <div className="glass-card p-12 border-white/5 text-center">
                                <Building2 size={48} className="mx-auto text-gray-700 mb-4" />
                                <p className="text-gray-400 font-bold">No trading accounts yet</p>
                                <p className="text-xs text-gray-600 mt-1 mb-4">
                                    Create your first account to start tracking your trades
                                </p>
                                <button
                                    onClick={() => setShowAddAccount(true)}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-black text-xs font-bold uppercase hover:brightness-110 transition-all"
                                >
                                    <Plus size={14} />
                                    Add Your First Account
                                </button>
                            </div>
                        )}

                        {accounts.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {sorted.map(account => (
                                    <AccountCard
                                        key={account.id}
                                        account={account}
                                        onClick={() => goToAccount(account.id)}
                                        onEdit={() => handleStartEdit(account)}
                                        onArchive={() => handleArchive(account.id)}
                                    />
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
                                                    <td className={cn('px-4 py-3 font-bold', account.totalPnl >= 0 ? 'text-profit' : 'text-loss')}>
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

                        {/* Archived Accounts */}
                        <div className="glass-card border-white/5">
                    <button
                        onClick={handleToggleArchived}
                        className="w-full flex items-center justify-between px-6 py-4 text-left"
                    >
                        <div className="flex items-center gap-2">
                            <Archive size={14} className="text-gray-500" />
                            <span className="text-xs font-black uppercase tracking-widest text-gray-500">Archived Accounts</span>
                        </div>
                        {showArchived ? <ChevronUp size={14} className="text-gray-600" /> : <ChevronDown size={14} className="text-gray-600" />}
                    </button>

                    {showArchived && (
                        <div className="border-t border-white/5 px-6 pb-6 pt-4">
                            {archivedLoading ? (
                                <div className="flex justify-center py-6">
                                    <Loader2 size={20} className="animate-spin text-gray-600" />
                                </div>
                            ) : archivedAccounts.length === 0 ? (
                                <p className="text-xs text-gray-600 text-center py-6">No archived accounts</p>
                            ) : (
                                <div className="space-y-2">
                                    {archivedAccounts.map(account => (
                                        <div key={account.id} className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5">
                                            <div>
                                                <p className="text-sm font-bold text-gray-400">{account.name}</p>
                                                <p className="text-[10px] text-gray-600 uppercase tracking-widest mt-0.5">
                                                    {account.propFirm?.name ?? 'Own Money'} · {account.tradeCount} trade{account.tradeCount !== 1 ? 's' : ''}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => { setDeleteTarget(account); setDeleteConfirmText(''); }}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-loss/20 text-loss/70 hover:bg-loss/10 hover:text-loss hover:border-loss/40 text-[10px] font-black uppercase tracking-widest transition-all"
                                            >
                                                <Trash2 size={12} />
                                                Delete
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                        </div>
                    </div>
                )}

                {/* Connection Hub Tab */}
                {activeTab === 'connect' && (
                    <div className="space-y-10 animate-fade-in">
                        <div>
                            <h3 className="text-2xl font-black text-white tracking-tighter uppercase italic mb-2">MetaTrader 5 Bridge</h3>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Connect your MT5 terminal to sync trades and equity in real-time</p>
                        </div>

                        {/* Step 1: Download EA */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-lg bg-primary/20 text-primary flex items-center justify-center text-xs font-black">1</div>
                                <h4 className="text-sm font-black text-white uppercase tracking-wide">Download the Expert Advisor</h4>
                            </div>
                            <div className="glass-card p-5 border-white/5 bg-white/5">
                                <p className="text-xs text-gray-400 leading-relaxed mb-4">
                                    Download <span className="text-white font-bold">PrismSync.mq5</span> and place it in your MT5 data folder:
                                </p>
                                <div className="glass-card p-3 border-white/5 bg-black/40 font-mono text-[11px] text-gray-400 mb-4">
                                    MT5 {'>'} File {'>'} Open Data Folder {'>'} MQL5 {'>'} Experts
                                </div>
                                <a
                                    href="/api/account/bridge/download"
                                    download="PrismSync.mq5"
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-black font-black uppercase tracking-[0.15em] text-[10px] shadow-[0_0_15px_rgba(0,242,255,0.2)] hover:brightness-110 active:scale-95 transition-all"
                                >
                                    <Download size={14} /> Download PrismSync.mq5
                                </a>
                            </div>
                        </div>

                        {/* Step 2: Allow WebRequests */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-lg bg-primary/20 text-primary flex items-center justify-center text-xs font-black">2</div>
                                <h4 className="text-sm font-black text-white uppercase tracking-wide">Allow WebRequests in MT5</h4>
                            </div>
                            <div className="glass-card p-5 border-white/5 bg-white/5">
                                <p className="text-xs text-gray-400 leading-relaxed mb-3">
                                    In MetaTrader 5, go to <span className="text-white font-bold">Tools {'>'} Options {'>'} Expert Advisors</span> and:
                                </p>
                                <ul className="space-y-2 text-xs text-gray-400">
                                    <li className="flex items-start gap-2">
                                        <span className="text-primary mt-0.5">&#x2022;</span>
                                        Check <span className="text-white font-bold">"Allow WebRequest for listed URL"</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-primary mt-0.5">&#x2022;</span>
                                        Add your Sync URL (shown below) to the allowed list
                                    </li>
                                </ul>
                            </div>
                        </div>

                        {/* Step 3: Configure EA */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-lg bg-primary/20 text-primary flex items-center justify-center text-xs font-black">3</div>
                                <h4 className="text-sm font-black text-white uppercase tracking-wide">Configure the EA</h4>
                            </div>
                            <div className="glass-card p-5 border-white/5 bg-white/5 space-y-5">
                                <p className="text-xs text-gray-400 leading-relaxed">
                                    Drag <span className="text-white font-bold">PrismSync</span> onto any chart. In the EA input parameters, enter the Sync URL and Bridge Key below.
                                </p>

                                {/* Sync URL */}
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-600">Sync URL</label>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 glass-card px-4 py-3 border-white/5 bg-black/40 font-mono text-sm text-white truncate">
                                            {bridgeInfo?.syncUrl || 'Loading...'}
                                        </div>
                                        <button
                                            onClick={() => bridgeInfo?.syncUrl && handleCopy(bridgeInfo.syncUrl, 'url')}
                                            className="px-3 py-3 rounded-xl border border-white/10 hover:bg-white/5 transition-all"
                                            title="Copy"
                                        >
                                            {copied === 'url' ? <Check size={16} className="text-primary" /> : <Copy size={16} className="text-gray-500" />}
                                        </button>
                                    </div>
                                </div>

                                {/* Bridge Key */}
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-600">Bridge Key</label>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 glass-card px-4 py-3 border-white/5 bg-black/40 font-mono text-sm text-white truncate">
                                            {bridgeInfo?.isHashed ? (
                                                <span className="text-yellow-400 text-xs">Key not recoverable — click Regenerate to get a new one</span>
                                            ) : bridgeInfo?.bridgeKey ? (
                                                showKey ? bridgeInfo.bridgeKey : '••••••••••••••••••••••••••••••••'
                                            ) : (
                                                <span className="text-gray-500">No key set - click Regenerate to create one</span>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => setShowKey(!showKey)}
                                            className="px-3 py-3 rounded-xl border border-white/10 hover:bg-white/5 transition-all"
                                            title={showKey ? 'Hide' : 'Reveal'}
                                        >
                                            {showKey ? <EyeOff size={16} className="text-gray-500" /> : <Eye size={16} className="text-gray-500" />}
                                        </button>
                                        <button
                                            onClick={() => bridgeInfo?.bridgeKey && handleCopy(bridgeInfo.bridgeKey, 'key')}
                                            disabled={!bridgeInfo?.bridgeKey}
                                            className="px-3 py-3 rounded-xl border border-white/10 hover:bg-white/5 transition-all disabled:opacity-50"
                                            title="Copy"
                                        >
                                            {copied === 'key' ? <Check size={16} className="text-primary" /> : <Copy size={16} className="text-gray-500" />}
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between mt-2">
                                        <p className="text-[9px] text-gray-600">Keep this key secret. It authenticates your MT5 terminal.</p>
                                        <button
                                            onClick={handleRegenerate}
                                            disabled={regenerating}
                                            className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-gray-500 hover:text-white transition-all disabled:opacity-50"
                                        >
                                            <RefreshCw size={12} className={regenerating ? 'animate-spin' : ''} /> Regenerate
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Step 4: Verify */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-lg bg-primary/20 text-primary flex items-center justify-center text-xs font-black">4</div>
                                <h4 className="text-sm font-black text-white uppercase tracking-wide">Verify Connection</h4>
                            </div>
                            <div className="glass-card p-5 border-white/5 bg-white/5">
                                <p className="text-xs text-gray-400 leading-relaxed">
                                    Once the EA is running, check the MT5 <span className="text-white font-bold">Experts</span> tab for
                                    <span className="text-primary font-mono"> "PrismSync EA started"</span>. Equity snapshots will sync every 60 seconds
                                    and trades will appear in your journal automatically.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Add Account Modal */}
            {showAddAccount && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="glass-card w-full max-w-lg mx-4 p-6 border-white/10">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-black text-white uppercase tracking-tight">Add Trading Account</h3>
                            <button
                                onClick={() => setShowAddAccount(false)}
                                className="p-1.5 rounded-lg hover:bg-white/5 transition-all"
                            >
                                <X size={18} className="text-gray-400" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase tracking-widest text-gray-600">
                                    Account Name *
                                </label>
                                <input
                                    type="text"
                                    value={newAccount.name}
                                    onChange={(e) => setNewAccount(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="e.g., FTMO Challenge, Live Account"
                                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-primary/50 transition-all placeholder:text-gray-700"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-600">
                                        Platform
                                    </label>
                                    <select
                                        value={newAccount.platform}
                                        onChange={(e) => setNewAccount(prev => ({ ...prev, platform: e.target.value as any }))}
                                        className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-primary/50 transition-all"
                                    >
                                        <option value="METATRADER5">MetaTrader 5</option>
                                        <option value="CTRADER">cTrader</option>
                                        <option value="TRADINGVIEW">TradingView</option>
                                        <option value="MANUAL">Manual</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-600">
                                        Broker
                                    </label>
                                    <input
                                        type="text"
                                        value={newAccount.broker}
                                        onChange={(e) => setNewAccount(prev => ({ ...prev, broker: e.target.value }))}
                                        placeholder="Optional"
                                        className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-primary/50 transition-all placeholder:text-gray-700"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase tracking-widest text-gray-600">
                                    Account / Login Number
                                </label>
                                <input
                                    type="text"
                                    value={newAccount.platformAccountId}
                                    onChange={(e) => setNewAccount(prev => ({ ...prev, platformAccountId: e.target.value }))}
                                    placeholder="e.g. 123456 (MT5 login)"
                                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-primary/50 transition-all placeholder:text-gray-700"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase tracking-widest text-gray-600">
                                    Account Type
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setNewAccount(prev => ({ ...prev, accountType: 'OWN_MONEY' }))}
                                        className={cn(
                                            "p-3 rounded-lg border text-xs font-bold uppercase tracking-wide transition-all",
                                            newAccount.accountType === 'OWN_MONEY'
                                                ? "bg-primary/10 border-primary/30 text-primary"
                                                : "bg-black/20 border-white/10 text-gray-500 hover:text-white"
                                        )}
                                    >
                                        Own Money
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setNewAccount(prev => ({ ...prev, accountType: 'PROPFIRM' }))}
                                        className={cn(
                                            "p-3 rounded-lg border text-xs font-bold uppercase tracking-wide transition-all",
                                            newAccount.accountType === 'PROPFIRM'
                                                ? "bg-purple-500/10 border-purple-500/30 text-purple-400"
                                                : "bg-black/20 border-white/10 text-gray-500 hover:text-white"
                                        )}
                                    >
                                        Prop Firm
                                    </button>
                                </div>
                            </div>

                            {newAccount.accountType === 'OWN_MONEY' && (
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-600">
                                        Account Size
                                    </label>
                                    <input
                                        type="number"
                                        value={newAccount.accountSize}
                                        onChange={(e) => setNewAccount(prev => ({ ...prev, accountSize: e.target.value }))}
                                        placeholder="e.g. 10000"
                                        className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-primary/50 transition-all placeholder:text-gray-700"
                                    />
                                </div>
                            )}

                            {newAccount.accountType === 'PROPFIRM' && (
                                <>
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-600">
                                            Prop Firm
                                        </label>
                                        <select
                                            value={newAccount.propFirmId}
                                            onChange={(e) => setNewAccount(prev => ({ ...prev, propFirmId: e.target.value }))}
                                            className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-primary/50 transition-all"
                                        >
                                            <option value="">Select a prop firm...</option>
                                            {propFirms.map((firm) => (
                                                <option key={firm.id} value={firm.id}>
                                                    {firm.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-600">
                                            Account Size
                                        </label>
                                        <select
                                            value={newAccount.accountSize}
                                            onChange={(e) => setNewAccount(prev => ({ ...prev, accountSize: e.target.value }))}
                                            className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-primary/50 transition-all"
                                        >
                                            <option value="">Select size...</option>
                                            <option value="5000">$5,000</option>
                                            <option value="10000">$10,000</option>
                                            <option value="25000">$25,000</option>
                                            <option value="50000">$50,000</option>
                                            <option value="100000">$100,000</option>
                                            <option value="200000">$200,000</option>
                                            <option value="300000">$300,000</option>
                                            <option value="custom">Custom...</option>
                                        </select>
                                    </div>
                                    {newAccount.accountSize === 'custom' && (
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-gray-600">
                                                Custom Amount ($)
                                            </label>
                                            <input
                                                type="number"
                                                onChange={(e) => setNewAccount(prev => ({ ...prev, accountSize: e.target.value }))}
                                                placeholder="Enter custom amount"
                                                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-primary/50 transition-all placeholder:text-gray-700"
                                            />
                                        </div>
                                    )}
                                </>
                            )}
                            
                            <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase tracking-widest text-gray-600">
                                    Currency
                                </label>
                                <select
                                    value={newAccount.currency}
                                    onChange={(e) => setNewAccount(prev => ({ ...prev, currency: e.target.value }))}
                                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-primary/50 transition-all"
                                >
                                    <option value="USD">USD</option>
                                    <option value="EUR">EUR</option>
                                    <option value="GBP">GBP</option>
                                </select>
                            </div>
                        </div>
                        
                        <div className="flex items-center justify-end gap-3 mt-6">
                            <button
                                onClick={() => setShowAddAccount(false)}
                                className="px-4 py-2 rounded-lg border border-white/10 text-gray-400 text-xs font-bold uppercase hover:bg-white/5 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddAccount}
                                disabled={addingAccount || !newAccount.name.trim()}
                                className="px-4 py-2 rounded-lg bg-primary text-black text-xs font-bold uppercase hover:brightness-110 transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                {addingAccount ? (
                                    <Loader2 size={14} className="animate-spin" />
                                ) : (
                                    <Plus size={14} />
                                )}
                                Add Account
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Account Modal */}
            {editingAccount && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="glass-card w-full max-w-lg mx-4 p-6 border-white/10 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-black text-white uppercase tracking-tight">Edit Account</h3>
                            <button
                                onClick={() => setEditingAccount(null)}
                                className="p-1.5 rounded-lg hover:bg-white/5 transition-all"
                            >
                                <X size={18} className="text-gray-400" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase tracking-widest text-gray-600">
                                    Account Name *
                                </label>
                                <input
                                    type="text"
                                    value={editForm.name}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-primary/50 transition-all"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-600">
                                        Broker
                                    </label>
                                    <input
                                        type="text"
                                        value={editForm.broker}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, broker: e.target.value }))}
                                        placeholder="Optional"
                                        className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-primary/50 transition-all placeholder:text-gray-700"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-600">
                                        Currency
                                    </label>
                                    <select
                                        value={editForm.currency}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, currency: e.target.value }))}
                                        className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-primary/50 transition-all"
                                    >
                                        <option value="USD">USD</option>
                                        <option value="EUR">EUR</option>
                                        <option value="GBP">GBP</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase tracking-widest text-gray-600">
                                    Account / Login Number
                                </label>
                                <input
                                    type="text"
                                    value={editForm.platformAccountId}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, platformAccountId: e.target.value }))}
                                    placeholder="e.g. 123456 (MT5 login)"
                                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-primary/50 transition-all placeholder:text-gray-700"
                                />
                            </div>

                            {/* Prop Firm Selection - Always show */}
                            <div className="pt-4 border-t border-white/10">
                                <h4 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-4">Prop Firm (Optional)</h4>
                                
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-600">
                                        Select Prop Firm
                                    </label>
                                    <select
                                        value={editForm.propFirmId}
                                        disabled={propFirmsLoading}
                                        onChange={(e) => {
                                            const selectedFirm = propFirms.find(f => f.id === e.target.value);
                                            setEditForm(prev => ({
                                                ...prev,
                                                propFirmId: e.target.value,
                                                // Auto-fill defaults from prop firm
                                                maxDailyLoss: selectedFirm ? (selectedFirm.dailyLossLimit?.toString() || prev.maxDailyLoss) : '',
                                                maxTotalDrawdown: selectedFirm ? (selectedFirm.maxDrawdown?.toString() || prev.maxTotalDrawdown) : '',
                                                profitTarget: selectedFirm && selectedFirm.phasesConfig ? (() => {
                                                    const phases = Array.isArray(selectedFirm.phasesConfig) ? selectedFirm.phasesConfig : [];
                                                    return phases[0]?.profitTarget?.toString() || prev.profitTarget;
                                                })() : prev.profitTarget,
                                            }));
                                        }}
                                        className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-primary/50 transition-all disabled:opacity-50"
                                    >
                                        {propFirmsLoading ? (
                                            <option value={editForm.propFirmId}>Loading...</option>
                                        ) : (
                                            <>
                                                <option value="">None (Own Money Account)</option>
                                                {propFirms.map(firm => (
                                                    <option key={firm.id} value={firm.id}>{firm.name}</option>
                                                ))}
                                            </>
                                        )}
                                    </select>
                                </div>
                            </div>

                            {/* Prop Firm Settings - Show when prop firm selected */}
                            {editForm.propFirmId && (
                                <>
                                    <div className="pt-4 border-t border-white/10">
                                        <h4 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-4">Prop Firm Settings</h4>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-black uppercase tracking-widest text-gray-600">
                                                    Account Size
                                                </label>
                                                <input
                                                    type="number"
                                                    value={editForm.accountSize}
                                                    onChange={(e) => setEditForm(prev => ({ ...prev, accountSize: e.target.value }))}
                                                    placeholder="e.g. 10000"
                                                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-primary/50 transition-all placeholder:text-gray-700"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-black uppercase tracking-widest text-gray-600">
                                                    Profit Split (%)
                                                </label>
                                                <input
                                                    type="number"
                                                    value={editForm.profitSplit}
                                                    onChange={(e) => setEditForm(prev => ({ ...prev, profitSplit: e.target.value }))}
                                                    placeholder="e.g. 80"
                                                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-primary/50 transition-all placeholder:text-gray-700"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-white/10">
                                        <h4 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-4">Rule Overrides</h4>

                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-black uppercase tracking-widest text-gray-600">
                                                    Max Daily Loss (%)
                                                </label>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    value={editForm.maxDailyLoss}
                                                    onChange={(e) => setEditForm(prev => ({ ...prev, maxDailyLoss: e.target.value }))}
                                                    placeholder="e.g. 5"
                                                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-primary/50 transition-all placeholder:text-gray-700"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-black uppercase tracking-widest text-gray-600">
                                                    Max Drawdown (%)
                                                </label>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    value={editForm.maxTotalDrawdown}
                                                    onChange={(e) => setEditForm(prev => ({ ...prev, maxTotalDrawdown: e.target.value }))}
                                                    placeholder="e.g. 10"
                                                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-primary/50 transition-all placeholder:text-gray-700"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-black uppercase tracking-widest text-gray-600">
                                                    Profit Target (%)
                                                </label>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    value={editForm.profitTarget}
                                                    onChange={(e) => setEditForm(prev => ({ ...prev, profitTarget: e.target.value }))}
                                                    placeholder="e.g. 10"
                                                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-primary/50 transition-all placeholder:text-gray-700"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Auto Chart Screenshots */}
                            <div className="border-t border-white/5 pt-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <h4 className="text-xs font-black uppercase tracking-widest text-gray-400">Auto Screenshots</h4>
                                        <p className="text-[10px] text-gray-600 mt-0.5">Capture chart screenshots when trades sync</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setEditForm(f => ({
                                            ...f,
                                            screenshotConfig: { ...f.screenshotConfig, enabled: !f.screenshotConfig.enabled }
                                        }))}
                                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                            editForm.screenshotConfig.enabled ? 'bg-primary/70' : 'bg-white/10'
                                        }`}
                                    >
                                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                            editForm.screenshotConfig.enabled ? 'translate-x-4' : 'translate-x-1'
                                        }`} />
                                    </button>
                                </div>

                                {editForm.screenshotConfig.enabled && (
                                    <div className="space-y-3">
                                        {/* On Open */}
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">On Trade Open</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {TIMEFRAME_OPTIONS.map(tf => (
                                                    <button
                                                        key={tf}
                                                        type="button"
                                                        onClick={() => {
                                                            const current = editForm.screenshotConfig.openTimeframes;
                                                            const next = current.includes(tf)
                                                                ? current.filter(t => t !== tf)
                                                                : [...current, tf];
                                                            setEditForm(f => ({ ...f, screenshotConfig: { ...f.screenshotConfig, openTimeframes: next } }));
                                                        }}
                                                        className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-lg border transition-all ${
                                                            editForm.screenshotConfig.openTimeframes.includes(tf)
                                                                ? 'bg-primary/20 text-primary border-primary/40'
                                                                : 'bg-white/5 text-gray-500 border-white/10 hover:bg-white/10'
                                                        }`}
                                                    >
                                                        {tf}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* On Close */}
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">On Trade Close</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {TIMEFRAME_OPTIONS.map(tf => (
                                                    <button
                                                        key={tf}
                                                        type="button"
                                                        onClick={() => {
                                                            const current = editForm.screenshotConfig.closeTimeframes;
                                                            const next = current.includes(tf)
                                                                ? current.filter(t => t !== tf)
                                                                : [...current, tf];
                                                            setEditForm(f => ({ ...f, screenshotConfig: { ...f.screenshotConfig, closeTimeframes: next } }));
                                                        }}
                                                        className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-lg border transition-all ${
                                                            editForm.screenshotConfig.closeTimeframes.includes(tf)
                                                                ? 'bg-primary/20 text-primary border-primary/40'
                                                                : 'bg-white/5 text-gray-500 border-white/10 hover:bg-white/10'
                                                        }`}
                                                    >
                                                        {tf}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Bars of context */}
                                        <div className="flex items-center gap-3">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 whitespace-nowrap">
                                                Bars of context
                                            </span>
                                            <input
                                                type="range"
                                                min={1}
                                                max={100}
                                                step={1}
                                                value={editForm.screenshotConfig.barsOfContext}
                                                onChange={e => setEditForm(f => ({
                                                    ...f,
                                                    screenshotConfig: { ...f.screenshotConfig, barsOfContext: +e.target.value }
                                                }))}
                                                className="flex-1 accent-primary"
                                            />
                                            <span className="text-[10px] font-bold text-gray-400 w-8 text-right">
                                                {editForm.screenshotConfig.barsOfContext}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 whitespace-nowrap">
                                                Delay bars
                                            </span>
                                            <input
                                                type="range"
                                                min={0}
                                                max={25}
                                                step={1}
                                                value={editForm.screenshotConfig.screenshotDelayBars}
                                                onChange={e => setEditForm(f => ({
                                                    ...f,
                                                    screenshotConfig: { ...f.screenshotConfig, screenshotDelayBars: +e.target.value }
                                                }))}
                                                className="flex-1 accent-primary"
                                            />
                                            <span className="text-[10px] font-bold text-gray-400 w-8 text-right">
                                                {editForm.screenshotConfig.screenshotDelayBars}
                                            </span>
                                        </div>

                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
                            <button
                                onClick={() => handleArchive(editingAccount.id)}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-loss/30 text-loss text-xs font-bold uppercase hover:bg-loss/10 transition-all"
                            >
                                <Archive size={14} />
                                Archive
                            </button>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setEditingAccount(null)}
                                    className="px-4 py-2 rounded-lg border border-white/10 text-gray-400 text-xs font-bold uppercase hover:bg-white/5 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveEdit}
                                    disabled={savingEdit || !editForm.name.trim()}
                                    className="px-4 py-2 rounded-lg bg-primary text-black text-xs font-bold uppercase hover:brightness-110 transition-all disabled:opacity-50 flex items-center gap-2"
                                >
                                    {savingEdit ? (
                                        <Loader2 size={14} className="animate-spin" />
                                    ) : (
                                        <Check size={14} />
                                    )}
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Permanent Delete Confirmation Modal */}
            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
                    <div className="glass-card w-full max-w-md mx-4 p-6 border-loss/30">
                        <div className="flex items-start gap-4 mb-6">
                            <div className="p-3 rounded-xl bg-loss/10 border border-loss/20 shrink-0">
                                <AlertTriangle size={24} className="text-loss" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-white uppercase tracking-tight">Permanently Delete Account</h3>
                                <p className="text-xs text-gray-400 mt-1">This action cannot be undone.</p>
                            </div>
                        </div>

                        <div className="p-4 rounded-xl bg-loss/5 border border-loss/20 mb-6 space-y-2">
                            <p className="text-sm font-bold text-loss">⚠ All of the following will be permanently deleted:</p>
                            <ul className="text-xs text-gray-400 space-y-1 ml-4 list-disc">
                                <li>The account <span className="text-white font-bold">{deleteTarget.name}</span></li>
                                <li>All <span className="text-white font-bold">{deleteTarget.tradeCount} trade{deleteTarget.tradeCount !== 1 ? 's' : ''}</span> and their journal entries</li>
                                <li>All screenshots, notes, and analytics data</li>
                                <li>All challenge phases and rule violations</li>
                                <li>All equity snapshots and performance history</li>
                            </ul>
                        </div>

                        <div className="space-y-2 mb-6">
                            <label className="text-[10px] font-black tracking-widest text-gray-500 uppercase">
                                Type{' '}
                                <span className="normal-case text-white font-black">{deleteTarget.name}</span>
                                {' '}to confirm
                            </label>
                            <input
                                type="text"
                                value={deleteConfirmText}
                                onChange={(e) => setDeleteConfirmText(e.target.value)}
                                placeholder={deleteTarget.name}
                                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-loss/50 transition-all placeholder:text-gray-700"
                                autoFocus
                            />
                        </div>

                        <div className="flex items-center justify-end gap-3">
                            <button
                                onClick={() => { setDeleteTarget(null); setDeleteConfirmText(''); }}
                                className="px-4 py-2 rounded-lg border border-white/10 text-gray-400 text-xs font-bold uppercase hover:bg-white/5 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handlePermanentDelete}
                                disabled={deleting || deleteConfirmText !== deleteTarget.name}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-loss text-white text-xs font-black uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                Delete Permanently
                            </button>
                        </div>
                    </div>
                </div>
            )}
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
