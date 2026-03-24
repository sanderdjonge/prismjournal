/**
 * Explicit overrides for MT5 broker index/CFD symbols → Twelve Data symbols.
 * Twelve Data uses its own naming for indices that differs from MT5 broker conventions.
 * Symbols not listed here that can't be auto-detected are returned as-is and may
 * fail the Twelve Data lookup (handled gracefully in auto-screenshot.service.ts).
 *
 * Reference: https://twelvedata.com/docs#reference-data
 */
const TWELVE_DATA_SYMBOL_MAP: Record<string, string> = {
    // Equity indices
    UK100:  'UK100',    // FTSE 100    — may require paid plan; verify with your subscription
    GER40:  'DAX',      // DAX 40
    GER30:  'DAX',      // Legacy DAX name
    US30:   'DJI',      // Dow Jones Industrial Average
    US500:  'SPX',      // S&P 500
    NAS100: 'NDX',      // Nasdaq 100
    AUS200: 'AS51',     // ASX 200
    FRA40:  'CAC40',    // CAC 40
    ESP35:  'IBEX35',   // IBEX 35
    ITA40:  'FTSEMIB',  // FTSE MIB
    JPN225: 'N225',     // Nikkei 225
    HK50:   'HSI',      // Hang Seng
    CHN50:  'SHCOMP',   // Shanghai Composite
    // Energy / commodities
    XTIUSD: 'WTI',      // Crude Oil WTI
    XBRUSD: 'BRENT',    // Brent Crude
    XNGUSD: 'NG1!',     // Natural Gas
};

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
    return symbol.replace(/\.(pro|raw|micro|step|ecn|stp|standard|plus|mini|cash|spot|m|c|s)$/i, '');
}

export function normaliseSymbol(raw: string): string {
    const base = stripSuffix(raw).toUpperCase();

    // Explicit index/CFD overrides take priority
    if (TWELVE_DATA_SYMBOL_MAP[base]) return TWELVE_DATA_SYMBOL_MAP[base];

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

/** Returns true if the error from Twelve Data indicates the symbol is simply
 *  not in their database (vs. a network/auth/quota failure). */
export function isTwelveDataSymbolNotFound(err: unknown): boolean {
    if (!(err instanceof Error)) return false;
    const msg = err.message.toLowerCase();
    return msg.includes('symbol') && (msg.includes('missing or invalid') || msg.includes('not found'));
}

export function mapTimeframe(tf: string): string | null {
    return TIMEFRAME_MAP[tf.toUpperCase()] ?? null;
}
