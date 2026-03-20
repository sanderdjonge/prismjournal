const TIMEFRAME_MAP: Record<string, string> = {
    M1: '1min',
    M5: '5min',
    M15: '15min',
    M30: '30min',
    H1: '1h',
    H4: '4h',
    D1: '1day',
    W1: '1week',
};

const CURRENCIES = new Set([
    'EUR', 'GBP', 'USD', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD',
    'SEK', 'NOK', 'DKK', 'HKD', 'SGD', 'CNH', 'MXN', 'ZAR', 'TRY',
]);

const METALS = ['XAU', 'XAG', 'XPT', 'XPD'];

const CRYPTO_BASES = [
    'BTC', 'ETH', 'XRP', 'LTC', 'ADA', 'SOL', 'DOGE',
    'DOT', 'AVAX', 'LINK', 'MATIC', 'BNB', 'UNI',
];

function stripSuffix(symbol: string): string {
    return symbol.replace(/\.(pro|raw|micro|step|ecn|stp|standard|plus|mini|m|c|s)$/i, '');
}

export function normaliseSymbol(raw: string): string {
    const base = stripSuffix(raw).toUpperCase();

    if (base.includes('/')) return base;

    for (const crypto of CRYPTO_BASES) {
        if (base.startsWith(crypto) && base.length > crypto.length) {
            const quote = base.slice(crypto.length);
            return `${crypto}/${quote}`;
        }
    }

    for (const metal of METALS) {
        if (base.startsWith(metal) && base.length === metal.length + 3) {
            const quote = base.slice(metal.length);
            return `${metal}/${quote}`;
        }
    }

    if (base.length === 6) {
        const maybeBase = base.slice(0, 3);
        const maybeQuote = base.slice(3);
        if (CURRENCIES.has(maybeBase) && CURRENCIES.has(maybeQuote)) {
            return `${maybeBase}/${maybeQuote}`;
        }
    }

    return base;
}

export function mapTimeframe(tf: string): string | null {
    return TIMEFRAME_MAP[tf.toUpperCase()] ?? null;
}
