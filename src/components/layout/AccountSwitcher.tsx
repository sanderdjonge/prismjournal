'use client';

import { useState, useRef, useEffect } from 'react';
import { Wallet, ChevronDown, Check, Layers } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAccounts } from '@/hooks/useAccounts';

const PLATFORM_LABELS: Record<string, string> = {
    METATRADER5: 'MT5',
    CTRADER: 'cTrader',
    TRADINGVIEW: 'TradingView',
    MANUAL: 'Manual',
};

const PLATFORM_COLORS: Record<string, string> = {
    METATRADER5: 'text-orange-400',
    CTRADER: 'text-blue-400',
    TRADINGVIEW: 'text-profit',
    MANUAL: 'text-gray-400',
};

export default function AccountSwitcher() {
    const { accounts, selectedAccountId, selectedAccount, selectAccount, loading } = useAccounts();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Don't render if no accounts
    if (!loading && accounts.length === 0) {
        return null;
    }

    const formatBalance = (balance: number | null, currency: string) => {
        if (balance === null) return '—';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(balance);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                disabled={loading}
                className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all",
                    "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20",
                    isOpen && "bg-white/10 border-primary/30"
                )}
            >
                <Wallet size={14} className={selectedAccount ? PLATFORM_COLORS[selectedAccount.platform] : 'text-gray-400'} />
                <span className="text-xs font-bold text-white max-w-[100px] truncate hidden sm:block">
                    {loading ? 'Loading...' : selectedAccount ? selectedAccount.name : 'All Accounts'}
                </span>
                <ChevronDown size={12} className={cn("text-gray-400 transition-transform", isOpen && "rotate-180")} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 glass-card bg-black/90 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden z-50 shadow-xl">
                    {/* All Accounts Option */}
                    <button
                        onClick={() => {
                            selectAccount(null);
                            setIsOpen(false);
                        }}
                        className={cn(
                            "w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-white/5 transition-all",
                            selectedAccountId === null && "bg-white/5"
                        )}
                    >
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                            <Layers size={14} className="text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-white">All Accounts</div>
                            <div className="text-[10px] text-gray-500">{accounts.length} accounts</div>
                        </div>
                        {selectedAccountId === null && (
                            <Check size={14} className="text-primary" />
                        )}
                    </button>

                    {/* Divider */}
                    <div className="border-t border-white/5" />

                    {/* Account List */}
                    <div className="max-h-64 overflow-y-auto">
                        {accounts.map((account) => (
                            <button
                                key={account.id}
                                onClick={() => {
                                    selectAccount(account.id);
                                    setIsOpen(false);
                                }}
                                className={cn(
                                    "w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-white/5 transition-all",
                                    selectedAccountId === account.id && "bg-white/5"
                                )}
                            >
                                <div className={cn(
                                    "w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black",
                                    "bg-white/5 border border-white/10",
                                    PLATFORM_COLORS[account.platform]
                                )}>
                                    {PLATFORM_LABELS[account.platform]?.substring(0, 2) || '??'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-bold text-white truncate">{account.name}</div>
                                    <div className="text-[10px] text-gray-500 flex items-center gap-2">
                                        <span className={PLATFORM_COLORS[account.platform]}>
                                            {PLATFORM_LABELS[account.platform] || account.platform}
                                        </span>
                                        <span>•</span>
                                        <span>{formatBalance(account.currentBalance, account.currency)}</span>
                                    </div>
                                </div>
                                {selectedAccountId === account.id && (
                                    <Check size={14} className="text-primary" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
