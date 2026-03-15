'use client';

import { useState, useEffect, useCallback } from 'react';

export interface AccountInfo {
    id: string;
    name: string;
    broker: string | null;
    platform: string;
    platformAccountId: string | null;
    currency: string;
    currentBalance: number | null;
    currentEquity: number | null;
    isActive: boolean;
}

interface UseAccountsReturn {
    accounts: AccountInfo[];
    selectedAccountId: string | null;
    selectedAccount: AccountInfo | null;
    loading: boolean;
    error: string | null;
    selectAccount: (accountId: string | null) => void;
    refresh: () => Promise<void>;
}

const ACCOUNT_COOKIE_NAME = 'selected_account';

function getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
}

function setCookie(name: string, value: string, days: number = 365): void {
    if (typeof document === 'undefined') return;
    const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`;
}

export function useAccounts(): UseAccountsReturn {
    const [accounts, setAccounts] = useState<AccountInfo[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadAccounts = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            
            const res = await fetch('/api/accounts');
            if (!res.ok) throw new Error('Failed to load accounts');
            
            const data = await res.json();
            const activeAccounts = (data.accounts || []).filter((a: AccountInfo) => a.isActive);
            setAccounts(activeAccounts);
            
            // Get stored selection from cookie
            const storedId = getCookie(ACCOUNT_COOKIE_NAME);
            
            // Validate stored ID is still valid
            if (storedId && activeAccounts.some((a: AccountInfo) => a.id === storedId)) {
                setSelectedAccountId(storedId);
            } else if (activeAccounts.length > 0) {
                // Default to first account or "all" (null)
                setSelectedAccountId(null);
            } else {
                setSelectedAccountId(null);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadAccounts();
    }, [loadAccounts]);

    const selectAccount = useCallback((accountId: string | null) => {
        setSelectedAccountId(accountId);
        if (accountId) {
            setCookie(ACCOUNT_COOKIE_NAME, accountId);
        } else {
            // Clear cookie for "all accounts" view
            document.cookie = `${ACCOUNT_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
        }
    }, []);

    const selectedAccount = selectedAccountId 
        ? accounts.find(a => a.id === selectedAccountId) || null
        : null;

    return {
        accounts,
        selectedAccountId,
        selectedAccount,
        loading,
        error,
        selectAccount,
        refresh: loadAccounts,
    };
}

// Utility to get selected account ID from server-side cookies
export function getSelectedAccountIdFromCookies(cookieHeader: string): string | null {
    const cookies = cookieHeader.split(';').map(c => c.trim());
    const accountCookie = cookies.find(c => c.startsWith(`${ACCOUNT_COOKIE_NAME}=`));
    return accountCookie ? accountCookie.split('=')[1] : null;
}
