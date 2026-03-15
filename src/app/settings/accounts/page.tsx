'use client';

import { useState, useEffect } from 'react';
import DashboardShell from '@/components/layout/DashboardShell';
import {
    Wallet,
    Copy,
    Check,
    RefreshCw,
    Edit2,
    Archive,
    Plus,
    X,
    Save,
    Loader2,
} from 'lucide-react';
import { cn } from '@/lib/cn';

interface TradingAccount {
    id: string;
    name: string;
    broker: string | null;
    accountNumber: string | null;
    platform: string;
    platformAccountId: string | null;
    currency: string;
    leverage: number;
    accountType: string;
    isActive: boolean;
    currentBalance: number | null;
    currentEquity: number | null;
    tradeCount: number;
    closedTradeCount: number;
    totalPnl: number;
    createdAt: string;
}

interface BridgeKeyInfo {
    bridgeKey: string | null;
    bridgeKeyId: string | null;
    isHashed: boolean;
    syncUrl: string;
}

const PLATFORM_LABELS: Record<string, string> = {
    METATRADER5: 'MT5',
    CTRADER: 'cTrader',
    TRADINGVIEW: 'TradingView',
    MANUAL: 'Manual',
};

const PLATFORM_COLORS: Record<string, string> = {
    METATRADER5: 'bg-orange-500/20 text-orange-400',
    CTRADER: 'bg-blue-500/20 text-blue-400',
    TRADINGVIEW: 'bg-green-500/20 text-green-400',
    MANUAL: 'bg-gray-500/20 text-gray-400',
};

export default function AccountsSettingsPage() {
    const [accounts, setAccounts] = useState<TradingAccount[]>([]);
    const [bridgeInfo, setBridgeInfo] = useState<BridgeKeyInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState<string | null>(null);
    const [regenerating, setRegenerating] = useState(false);
    const [newBridgeKey, setNewBridgeKey] = useState<string | null>(null);
    
    // Edit state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editBroker, setEditBroker] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [accountsRes, bridgeRes] = await Promise.all([
                fetch('/api/accounts'),
                fetch('/api/account/bridge'),
            ]);
            
            if (accountsRes.ok) {
                const data = await accountsRes.json();
                setAccounts(data.accounts);
            }
            
            if (bridgeRes.ok) {
                const data = await bridgeRes.json();
                setBridgeInfo(data);
            }
        } catch (error) {
            // error handled by loading state
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = async (text: string, key: string) => {
        await navigator.clipboard.writeText(text);
        setCopied(key);
        setTimeout(() => setCopied(null), 2000);
    };

    const handleRegenerateKey = async () => {
        if (!confirm('Are you sure? This will invalidate your current bridge key. You\'ll need to update your EA/cBot configuration.')) {
            return;
        }
        
        setRegenerating(true);
        try {
            const res = await fetch('/api/account/bridge', { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                setNewBridgeKey(data.bridgeKey);
                setBridgeInfo(prev => prev ? {
                    ...prev,
                    bridgeKeyId: data.bridgeKeyId,
                    isHashed: true,
                } : null);
            }
        } catch (error) {
            // error handled by loading state
        } finally {
            setRegenerating(false);
        }
    };

    const handleStartEdit = (account: TradingAccount) => {
        setEditingId(account.id);
        setEditName(account.name);
        setEditBroker(account.broker || '');
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditName('');
        setEditBroker('');
    };

    const handleSaveEdit = async () => {
        if (!editingId) return;
        
        setSaving(true);
        try {
            const res = await fetch(`/api/accounts/${editingId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: editName,
                    broker: editBroker || null,
                }),
            });
            
            if (res.ok) {
                setAccounts(prev => prev.map(a => 
                    a.id === editingId 
                        ? { ...a, name: editName, broker: editBroker || null }
                        : a
                ));
                setEditingId(null);
            }
        } catch (error) {
            // error handled by saving state
        } finally {
            setSaving(false);
        }
    };

    const handleArchive = async (accountId: string) => {
        if (!confirm('Are you sure you want to archive this account? It will no longer appear in your active accounts.')) {
            return;
        }
        
        try {
            const res = await fetch(`/api/accounts/${accountId}`, { method: 'DELETE' });
            if (res.ok) {
                setAccounts(prev => prev.map(a => 
                    a.id === accountId ? { ...a, isActive: false } : a
                ));
            }
        } catch (error) {
            // error handled by saving state
        }
    };

    const formatCurrency = (value: number, currency: string) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
        }).format(value);
    };

    if (loading) {
        return (
            <DashboardShell>
                <div className="flex items-center justify-center min-h-[400px]">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            </DashboardShell>
        );
    }

    return (
        <DashboardShell>
            <div className="space-y-8">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-black text-white tracking-tighter uppercase italic mb-2">
                        Trading Accounts
                    </h1>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                        Manage your connected trading accounts and bridge key
                    </p>
                </div>

                {/* Bridge Key Section */}
                <div className="glass-card bg-black/40 backdrop-blur-md p-6 border-white/5">
                    <h2 className="text-lg font-black text-white tracking-tight uppercase mb-4">
                        Bridge Key
                    </h2>
                    <p className="text-xs text-gray-400 mb-4">
                        Your bridge key authenticates sync requests from MT5, cTrader, or TradingView. 
                        One key works for all your accounts — the platform and account ID in each sync 
                        payload determine which account receives the data.
                    </p>

                    {newBridgeKey ? (
                        <div className="glass-card p-4 border-green-500/30 bg-green-500/10 mb-4">
                            <p className="text-xs text-green-400 font-bold mb-2">
                                New Bridge Key (copy now — won't be shown again):
                            </p>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 px-3 py-2 bg-black/40 rounded font-mono text-sm text-white break-all">
                                    {newBridgeKey}
                                </code>
                                <button
                                    onClick={() => handleCopy(newBridgeKey, 'new-key')}
                                    className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5 transition-all"
                                >
                                    {copied === 'new-key' ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="flex-1">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-600 block mb-1">
                                        Key ID
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <code className="flex-1 px-3 py-2 bg-black/40 rounded font-mono text-sm text-white">
                                            {bridgeInfo?.bridgeKeyId || 'Not set'}
                                        </code>
                                        {bridgeInfo?.bridgeKeyId && (
                                            <button
                                                onClick={() => handleCopy(bridgeInfo.bridgeKeyId!, 'key-id')}
                                                className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5 transition-all"
                                            >
                                                {copied === 'key-id' ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            <div>
                                <label className="text-[9px] font-black uppercase tracking-widest text-gray-600 block mb-1">
                                    Sync URL
                                </label>
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 px-3 py-2 bg-black/40 rounded font-mono text-sm text-white truncate">
                                        {bridgeInfo?.syncUrl || 'Loading...'}
                                    </code>
                                    <button
                                        onClick={() => handleCopy(bridgeInfo?.syncUrl || '', 'sync-url')}
                                        className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5 transition-all"
                                    >
                                        {copied === 'sync-url' ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={handleRegenerateKey}
                        disabled={regenerating}
                        className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-orange-500/30 text-orange-400 hover:bg-orange-500/10 transition-all text-xs font-bold uppercase tracking-wide disabled:opacity-50"
                    >
                        {regenerating ? (
                            <Loader2 size={14} className="animate-spin" />
                        ) : (
                            <RefreshCw size={14} />
                        )}
                        Regenerate Key
                    </button>
                </div>

                {/* Accounts List */}
                <div className="glass-card bg-black/40 backdrop-blur-md p-6 border-white/5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-black text-white tracking-tight uppercase">
                            Connected Accounts
                        </h2>
                        <span className="text-xs text-gray-500">
                            {accounts.filter(a => a.isActive).length} active
                        </span>
                    </div>

                    {accounts.length === 0 ? (
                        <div className="text-center py-8">
                            <Wallet className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                            <p className="text-gray-400 text-sm">No accounts yet</p>
                            <p className="text-gray-500 text-xs mt-1">
                                Accounts are created automatically when you sync from MT5 or cTrader
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {accounts.map((account) => (
                                <div
                                    key={account.id}
                                    className={cn(
                                        "glass-card p-4 border-white/5 bg-white/5",
                                        !account.isActive && "opacity-50"
                                    )}
                                >
                                    {editingId === account.id ? (
                                        // Edit mode
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3">
                                                <div className="flex-1">
                                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-600 block mb-1">
                                                        Name
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={editName}
                                                        onChange={(e) => setEditName(e.target.value)}
                                                        className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm"
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-600 block mb-1">
                                                        Broker
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={editBroker}
                                                        onChange={(e) => setEditBroker(e.target.value)}
                                                        className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm"
                                                        placeholder="Optional"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={handleCancelEdit}
                                                    className="px-3 py-1.5 rounded-lg border border-white/10 text-gray-400 hover:bg-white/5 text-xs font-bold uppercase"
                                                >
                                                    <X size={14} className="inline mr-1" />
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={handleSaveEdit}
                                                    disabled={saving}
                                                    className="px-3 py-1.5 rounded-lg bg-primary text-black text-xs font-bold uppercase hover:brightness-110 disabled:opacity-50"
                                                >
                                                    {saving ? (
                                                        <Loader2 size={14} className="inline animate-spin mr-1" />
                                                    ) : (
                                                        <Save size={14} className="inline mr-1" />
                                                    )}
                                                    Save
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        // View mode
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-white font-bold">{account.name}</span>
                                                    <span className={cn(
                                                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                                                        PLATFORM_COLORS[account.platform] || PLATFORM_COLORS.MANUAL
                                                    )}>
                                                        {PLATFORM_LABELS[account.platform] || account.platform}
                                                    </span>
                                                    {account.platformAccountId && (
                                                        <span className="text-gray-500 text-xs">
                                                            #{account.platformAccountId}
                                                        </span>
                                                    )}
                                                    {!account.isActive && (
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-500/20 text-red-400">
                                                            Archived
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-4 text-xs text-gray-400">
                                                    {account.broker && (
                                                        <span>Broker: {account.broker}</span>
                                                    )}
                                                    <span>{account.tradeCount} trades</span>
                                                    <span className={account.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                                                        {formatCurrency(account.totalPnl, account.currency)} P&L
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleStartEdit(account)}
                                                    className="p-2 rounded-lg border border-white/10 hover:bg-white/5 transition-all"
                                                    title="Edit"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                {account.isActive && (
                                                    <button
                                                        onClick={() => handleArchive(account.id)}
                                                        className="p-2 rounded-lg border border-white/10 hover:bg-red-500/10 hover:border-red-500/30 text-gray-400 hover:text-red-400 transition-all"
                                                        title="Archive"
                                                    >
                                                        <Archive size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </DashboardShell>
    );
}
