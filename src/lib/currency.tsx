import { useState, useEffect, createContext, useContext, ReactNode } from 'react';

// Currency symbols mapping
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CHF: 'CHF',
  CAD: 'C$',
  AUD: 'A$',
  NZD: 'NZ$',
};

// Currency positions (some currencies put symbol after the number)
const CURRENCY_POSITION: Record<string, 'before' | 'after'> = {
  USD: 'before',
  EUR: 'before',
  GBP: 'before',
  JPY: 'before',
  CHF: 'after',
  CAD: 'before',
  AUD: 'before',
  NZD: 'before',
};

// Decimal places for currencies
const CURRENCY_DECIMALS: Record<string, number> = {
  USD: 2,
  EUR: 2,
  GBP: 2,
  JPY: 0,
  CHF: 2,
  CAD: 2,
  AUD: 2,
  NZD: 2,
};

interface CurrencyContextType {
  currency: string;
  symbol: string;
  formatAmount: (amount: number | null | undefined, options?: { showSign?: boolean; compact?: boolean }) => string;
  formatPnl: (amount: number | null | undefined) => string;
  setCurrency: (currency: string) => void;
}

const CurrencyContext = createContext<CurrencyContextType | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState('USD');

  useEffect(() => {
    // Fetch user's currency preference
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        if (data.displayCurrency) {
          setCurrencyState(data.displayCurrency);
        }
      })
      .catch(() => {
        // Default to USD on error
      });
  }, []);

  const setCurrency = (newCurrency: string) => {
    setCurrencyState(newCurrency);
  };

  const symbol = CURRENCY_SYMBOLS[currency] || currency;
  const position = CURRENCY_POSITION[currency] || 'before';
  const decimals = CURRENCY_DECIMALS[currency] ?? 2;

  const formatAmount = (
    amount: number | null | undefined,
    options?: { showSign?: boolean; compact?: boolean }
  ): string => {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return position === 'before' ? `${symbol}0.00` : `0.00 ${symbol}`;
    }

    const absAmount = Math.abs(amount);
    const sign = amount < 0 ? '-' : (options?.showSign && amount > 0 ? '+' : '');
    
    let formatted: string;
    if (options?.compact && absAmount >= 1000000) {
      formatted = (absAmount / 1000000).toFixed(1) + 'M';
    } else if (options?.compact && absAmount >= 1000) {
      formatted = (absAmount / 1000).toFixed(1) + 'K';
    } else {
      formatted = absAmount.toFixed(decimals);
    }

    if (position === 'before') {
      return `${sign}${symbol}${formatted}`;
    } else {
      return `${sign}${formatted} ${symbol}`;
    }
  };

  const formatPnl = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined || isNaN(amount) || amount === 0) {
      return position === 'before' ? `${symbol}0.00` : `0.00 ${symbol}`;
    }

    const absAmount = Math.abs(amount);
    const sign = amount >= 0 ? '+' : '-';
    const formatted = absAmount.toFixed(decimals);

    if (position === 'before') {
      return `${sign}${symbol}${formatted}`;
    } else {
      return `${sign}${formatted} ${symbol}`;
    }
  };

  return (
    <CurrencyContext.Provider value={{ currency, symbol, formatAmount, formatPnl, setCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    // Return a default implementation if used outside provider
    return {
      currency: 'USD',
      symbol: '$',
      formatAmount: (amount: number | null | undefined) => {
        if (amount === null || amount === undefined || isNaN(amount)) return '$0.00';
        return `$${Math.abs(amount).toFixed(2)}`;
      },
      formatPnl: (amount: number | null | undefined) => {
        if (amount === null || amount === undefined || isNaN(amount) || amount === 0) return '$0.00';
        const sign = amount >= 0 ? '+' : '-';
        return `${sign}$${Math.abs(amount).toFixed(2)}`;
      },
      setCurrency: () => {},
    };
  }
  return context;
}

// Standalone formatting functions for use outside React components
export function formatCurrency(
  amount: number | null | undefined,
  currency: string = 'USD',
  options?: { showSign?: boolean; compact?: boolean }
): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '0.00';
  }

  const symbol = CURRENCY_SYMBOLS[currency] || currency;
  const position = CURRENCY_POSITION[currency] || 'before';
  const decimals = CURRENCY_DECIMALS[currency] ?? 2;
  const absAmount = Math.abs(amount);
  const sign = amount < 0 ? '-' : (options?.showSign && amount > 0 ? '+' : '');

  let formatted: string;
  if (options?.compact && absAmount >= 1000000) {
    formatted = (absAmount / 1000000).toFixed(1) + 'M';
  } else if (options?.compact && absAmount >= 1000) {
    formatted = (absAmount / 1000).toFixed(1) + 'K';
  } else {
    formatted = absAmount.toFixed(decimals);
  }

  if (position === 'before') {
    return `${sign}${symbol}${formatted}`;
  } else {
    return `${sign}${formatted} ${symbol}`;
  }
}

export function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] || currency;
}
