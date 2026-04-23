'use client';

import { useState, useRef, useEffect } from 'react';
import { Wallet, ChevronDown, Check, Layers } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAccounts } from '@/hooks/useAccounts';
import { useCurrency } from '@/lib/currency';
import { PLATFORM_LABELS, PLATFORM_COLORS } from '@/constants/platforms';

export default function AccountSwitcher() {
    const { accounts, selectedAccountId, selectedAccount, selectAccount, loading } = useAccounts();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const { formatAmount: fmt } = useCurrency()

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

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                disabled={loading}
                className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all",
                    "bg-surface-elevated border-border-color hover:bg-surface-hover hover:border-border-color",
                    isOpen && "bg-surface-hover border-primary/30"
                )}
            >
                <Wallet size={14} className={selectedAccount ? PLATFORM_COLORS[selectedAccount.platform] : 'text-text-muted'} />
                <span className="text-xs font-bold text-white max-w-[100px] truncate hidden sm:block">
                    {loading ? 'Loading...' : selectedAccount ? selectedAccount.name : 'All Accounts'}
                </span>
                <ChevronDown size={12} className={cn("text-text-muted transition-transform", isOpen && "rotate-180")} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-[var(--surface-solid)] border border-border-color rounded-xl overflow-hidden z-50 shadow-xl">
                    {/* All Accounts Option */}
                    <button
                        onClick={() => {
                            selectAccount(null);
                            setIsOpen(false);
                        }}
                        className={cn(
                            "w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-surface-hover transition-all",
                            selectedAccountId === null && "bg-surface-elevated"
                        )}
                    >
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                            <Layers size={14} className="text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-white">All Accounts</div>
                            <div className="text-[10px] text-text-muted">{accounts.length} accounts</div>
                        </div>
                        {selectedAccountId === null && (
                            <Check size={14} className="text-primary" />
                        )}
                    </button>

                    {/* Divider */}
                    <div className="border-t border-border-subtle" />

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
                                    "w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-surface-hover transition-all",
                                    selectedAccountId === account.id && "bg-surface-elevated"
                                )}
                            >
                                <div className={cn(
                                    "w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black",
                                    "bg-surface-elevated border border-border-color",
                                    PLATFORM_COLORS[account.platform]
                                )}>
                                    {PLATFORM_LABELS[account.platform]?.substring(0, 2) || '??'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-bold text-white truncate">{account.name}</div>
                                    <div className="text-[10px] text-text-muted flex items-center gap-2">
                                        <span className={PLATFORM_COLORS[account.platform]}>
                                            {PLATFORM_LABELS[account.platform] || account.platform}
                                        </span>
                                        <span>•</span>
                                        <span>{fmt(account.currentBalance)}</span>
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
