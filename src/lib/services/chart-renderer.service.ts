/**
 * Server-side ECharts chart renderer.
 *
 * Hardcoded dark-mode hex colors below — no DOM/CSS variables available in SSR.
 * Map to CSS custom property names for future maintenance:
 *
 *   #4ade80  →  --profit (green-400)     | #f87171  →  --loss (red-400)
 *   #00f2ff  →  --primary (cyan)          | #7000ff  →  --secondary (purple)
 *   #f59e0b  →  --warning (amber-500)     | #6b7280  →  --text-secondary (gray-500)
 *   #374151  →  --border-color (gray-700) | #1f2937  →  --border-subtle (gray-800)
 *   #0d0d14  →  --surface (near-black)
 */
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';
import sharp from 'sharp';
import logger from '@/lib/logger';
import { toYahooSymbol } from '@/lib/symbol-normaliser';

export interface ChartRenderOptions {
    /** Twelve Data formatted symbol, e.g. "EUR/USD" */
    symbol: string;
    /** Twelve Data interval, e.g. "15min" */
    interval: string;
    entryPrice: number;
    exitPrice?: number | null;
    stopLoss?: number | null;
    takeProfit?: number | null;
    /** How many candles to show before entry (default 60) */
    barsOfContext: number;
    /** IANA timezone for x-axis labels, e.g. "Europe/Amsterdam" */
    timezone: string;
    /** ISO datetime — fetch candles ending at this time (anchors chart to trade event) */
    endDate?: string;
}

interface OhlcBar {
    datetime: string;
    open: string;
    high: string;
    low: string;
    close: string;
}

async function fetchOhlc(symbol: string, interval: string, outputsize: number, endDate?: string): Promise<OhlcBar[]> {
    const apiKey = process.env.TWELVE_DATA_API_KEY;
    if (!apiKey) throw new Error('TWELVE_DATA_API_KEY is not set');

    let url =
        `https://api.twelvedata.com/time_series` +
        `?symbol=${encodeURIComponent(symbol)}` +
        `&interval=${interval}` +
        `&outputsize=${outputsize}` +
        `&order=ASC` +
        `&timezone=UTC` +
        `&apikey=${apiKey}`;

    if (endDate) {
        // Format as YYYY-MM-DD HH:MM:SS (Twelve Data expects this format)
        const d = new Date(endDate);
        const formatted = d.toISOString().replace('T', ' ').slice(0, 19);
        url += `&end_date=${encodeURIComponent(formatted)}`;
    }

    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`Twelve Data HTTP ${res.status}`);

    const data = await res.json() as { status?: string; message?: string; values?: OhlcBar[] };
    if (data.status === 'error') throw new Error(`Twelve Data error: ${data.message}`);
    if (!Array.isArray(data.values) || data.values.length === 0) {
        throw new Error(`No OHLC data returned for ${symbol} ${interval}`);
    }

    return data.values;
}

// ---------------------------------------------------------------------------
// Yahoo Finance OHLC fallback (no API key required)
// ---------------------------------------------------------------------------

const YAHOO_INTERVAL_MAP: Record<string, string> = {
    '1min': '1m', '5min': '5m', '15min': '15m', '30min': '30m',
    '1h': '60m', '4h': '1h', '1day': '1d', '1week': '1wk',
};

const YAHOO_INTERVAL_MS: Record<string, number> = {
    '1m': 60_000, '5m': 300_000, '15m': 900_000, '30m': 1_800_000,
    '60m': 3_600_000, '1h': 3_600_000, '1d': 86_400_000, '1wk': 604_800_000,
};

let cachedCrumb: { crumb: string; expires: number } | null = null;

async function getYahooCrumb(): Promise<string | null> {
    if (cachedCrumb && Date.now() < cachedCrumb.expires) return cachedCrumb.crumb;
    try {
        const res = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/^GSPC?range=1d&interval=1d', {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(10_000),
        });
        const setCookie = res.headers.getSetCookie?.() ?? [];
        const cookieHeader = setCookie.join('; ');
        const body = await res.text();
        const match = body.match(/"crumb":"([^"]+)"/);
        if (!match) return null;
        cachedCrumb = { crumb: match[1], expires: Date.now() + 3_600_000 };
        return cachedCrumb.crumb;
    } catch {
        return null;
    }
}

async function fetchOhlcYahoo(yahooSymbol: string, interval: string, outputsize: number, endDate?: string): Promise<OhlcBar[]> {
    const yahooInterval = YAHOO_INTERVAL_MAP[interval] ?? '1d';
    const msPerBar = YAHOO_INTERVAL_MS[yahooInterval] ?? 86_400_000;

    const period2 = endDate
        ? Math.floor(new Date(endDate).getTime() / 1000)
        : Math.floor(Date.now() / 1000);
    const lookbackMultiplier = ["1m", "5m", "15m", "30m", "60m", "1h"].includes(yahooInterval) ? 5 : 2;
    const period1 = period2 - Math.floor((outputsize * msPerBar * lookbackMultiplier) / 1000);

    const crumb = await getYahooCrumb();
    const crumbParam = crumb ? `&crumb=${encodeURIComponent(crumb)}` : '';
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=${yahooInterval}&period1=${period1}&period2=${period2}${crumbParam}`;

    const res = await fetch(url, {
        signal: AbortSignal.timeout(15_000),
        headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) throw new Error(`Yahoo Finance HTTP ${res.status} for ${yahooSymbol}`);

    const data = await res.json() as {
        chart: {
            result?: Array<{
                timestamp: number[];
                indicators: { quote: Array<{ open: number[]; high: number[]; low: number[]; close: number[] }> };
            }>;
            error?: { description: string };
        };
    };

    if (data.chart.error) throw new Error(`Yahoo Finance error: ${data.chart.error.description}`);

    const result = data.chart.result?.[0];
    if (!result?.timestamp || result.timestamp.length === 0) return [];

    const quote = result.indicators?.quote?.[0];
    if (!quote) return [];

    const bars: OhlcBar[] = [];
    for (let i = 0; i < result.timestamp.length; i++) {
        if (quote.open[i] == null || quote.close[i] == null) continue;
        const dt = new Date(result.timestamp[i] * 1000);
        bars.push({
            datetime: dt.toISOString().replace('T', ' ').slice(0, 19),
            open:  String(quote.open[i]),
            high:  String(quote.high[i]),
            low:   String(quote.low[i]),
            close: String(quote.close[i]),
        });
    }

    if (bars.length === 0) return [];
    return bars.slice(-outputsize);
}

/**
 * Convert a Twelve Data datetime string (UTC) to a readable label in the given timezone.
 * Returns "HH:mm" for most candles, "DD/MM HH:mm" whenever the day changes —
 * so multi-day charts (e.g. 85 × 15min spanning 2 calendar days) are unambiguous.
 */
function toTimeLabels(bars: { datetime: string }[], timezone: string): string[] {
    let lastDay = '';
    return bars.map(b => {
        const utcDate = new Date(b.datetime.replace(' ', 'T') + 'Z');
        const day = utcDate.toLocaleDateString('en-GB', {
            timeZone: timezone,
            day: '2-digit',
            month: '2-digit',
        });
        const time = utcDate.toLocaleTimeString('en-GB', {
            timeZone: timezone,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });
        if (day !== lastDay) {
            lastDay = day;
            return `${day} ${time}`; // e.g. "24/03 09:00" — shown once per day
        }
        return time; // e.g. "09:15"
    });
}

function buildChartOption(bars: OhlcBar[], entryPrice: number, timezone: string, stopLoss?: number | null, takeProfit?: number | null, exitPrice?: number | null): EChartsOption {
    // Omit SL/TP lines when they would overlap with exit price or with each other.
    const tickTolerance = entryPrice * 0.0001;
    const slTpSame = stopLoss != null && takeProfit != null && Math.abs(stopLoss - takeProfit) <= tickTolerance;
    const showSl = stopLoss != null && !slTpSame && (exitPrice == null || Math.abs(exitPrice - stopLoss) > tickTolerance);
    const showTp = takeProfit != null && !slTpSame && (exitPrice == null || Math.abs(exitPrice - takeProfit) > tickTolerance);
    const dates = toTimeLabels(bars, timezone);
    // ECharts candlestick: [open, close, low, high]
    const ohlcData = bars.map(b => [+b.open, +b.close, +b.low, +b.high]);

    // Detect decimal precision from entry price (e.g. 1.15866 → 5, 21350.5 → 1).
    const entryStr = entryPrice.toString();
    const decimals = entryStr.includes('.') ? entryStr.split('.')[1].length : 2;
    const fmt = (v: number) => v.toFixed(decimals);

    // Compute y-axis bounds from all price levels so the chart is tightly scaled.
    const allPrices: number[] = [
        ...bars.map(b => +b.low),
        ...bars.map(b => +b.high),
        entryPrice,
        ...(exitPrice != null ? [exitPrice] : []),
        ...(showSl ? [stopLoss!] : []),
        ...(showTp ? [takeProfit!] : []),
    ];
    const priceMin = Math.min(...allPrices);
    const priceMax = Math.max(...allPrices);
    const pad = (priceMax - priceMin) * 0.05;

    // Price level lines drawn as flat `line` series rather than markLine.
    // markLine yAxis positioning in ECharts SSR quantizes to axis ticks; line
    // series data values are rendered at the exact pixel for that y-value.
    const n = bars.length;
    const priceSeries: object[] = [
        {
            type: 'line',
            data: Array(n).fill(entryPrice),
            lineStyle: { color: '#00f2ff', width: 2, type: 'solid' },
            symbol: 'none',
            silent: true,
            z: 5,
            endLabel: { show: true, formatter: `Entry ${fmt(entryPrice)}`, color: '#00f2ff', fontSize: 11, fontWeight: 'bold' },
        },
    ];
    if (exitPrice != null) {
        priceSeries.push({
            type: 'line',
            data: Array(n).fill(exitPrice),
            lineStyle: { color: '#f59e0b', width: 2, type: 'solid' },
            symbol: 'none',
            silent: true,
            z: 5,
            endLabel: { show: true, formatter: `Exit ${fmt(exitPrice)}`, color: '#f59e0b', fontSize: 11, fontWeight: 'bold' },
        });
    }
    if (showSl) {
        priceSeries.push({
            type: 'line',
            data: Array(n).fill(stopLoss),
            lineStyle: { color: '#f87171', width: 1.5, type: 'dashed' },
            symbol: 'none',
            silent: true,
            z: 5,
            endLabel: { show: true, formatter: `SL ${fmt(stopLoss!)}`, color: '#f87171', fontSize: 10 },
        });
    }
    if (showTp) {
        priceSeries.push({
            type: 'line',
            data: Array(n).fill(takeProfit),
            lineStyle: { color: '#4ade80', width: 1.5, type: 'dashed' },
            symbol: 'none',
            silent: true,
            z: 5,
            endLabel: { show: true, formatter: `TP ${fmt(takeProfit!)}`, color: '#4ade80', fontSize: 10 },
        });
    }

    return {
        backgroundColor: '#0d0d14',
        animation: false,
        grid: { left: 70, right: 130, top: 30, bottom: 70 },
        xAxis: {
            data: dates,
            axisLabel: { color: '#6b7280', fontSize: 9, rotate: 30 },
            axisLine: { lineStyle: { color: '#374151' } },
            splitLine: { lineStyle: { color: '#1f2937', type: 'dashed' } },
        },
        yAxis: {
            min: priceMin - pad,
            max: priceMax + pad,
            axisLabel: { color: '#6b7280', fontSize: 9, formatter: (v: number) => fmt(v) },
            axisLine: { lineStyle: { color: '#374151' } },
            splitLine: { lineStyle: { color: '#1f2937', type: 'dashed' } },
        },
        series: [
            {
                type: 'candlestick',
                data: ohlcData,
                itemStyle: {
                    color: '#4ade80',
                    color0: '#f87171',
                    borderColor: '#4ade80',
                    borderColor0: '#f87171',
                },
            },
            ...priceSeries,
        ],
    };
}

function validatePriceRange(bars: OhlcBar[], entryPrice: number, symbol: string): void {
    const dataMin = Math.min(...bars.map(b => +b.low));
    const dataMax = Math.max(...bars.map(b => +b.high));
    if (entryPrice < dataMin / 10 || entryPrice > dataMax * 10) {
        throw Object.assign(
            new Error(`Price mismatch: entry ${entryPrice} outside OHLC range ${dataMin}–${dataMax} for ${symbol}`),
            { code: 'PRICE_MISMATCH' },
        );
    }
}

export async function renderCandlestickChart(options: ChartRenderOptions): Promise<Buffer> {
    const { symbol, interval, entryPrice, exitPrice, stopLoss, takeProfit, barsOfContext, timezone, endDate } = options;

    // Try Twelve Data first; fall back to Yahoo Finance for symbols restricted to paid plans.
    let bars: OhlcBar[];
    try {
        bars = await fetchOhlc(symbol, interval, barsOfContext, endDate);
        validatePriceRange(bars, entryPrice, symbol);
    } catch (tdErr) {
        const yahooSymbol = toYahooSymbol(symbol);
        logger.warn({ symbol, yahooSymbol, tdErr: String(tdErr) }, '[chart-renderer] Twelve Data failed, attempting Yahoo Finance fallback');
        if (!yahooSymbol) throw tdErr;
        try {
            bars = await fetchOhlcYahoo(yahooSymbol, interval, barsOfContext, endDate);
            if (bars.length === 0 && interval !== '1day' && interval !== '1week') {
                logger.warn({ symbol, yahooSymbol, interval }, '[chart-renderer] Yahoo intraday returned 0 bars, falling back to daily');
                bars = await fetchOhlcYahoo(yahooSymbol, '1day', barsOfContext, endDate);
            }
        } catch (yahooErr) {
            logger.error({ symbol, yahooSymbol, yahooErr: String(yahooErr) }, '[chart-renderer] Yahoo Finance fallback also failed');
            throw tdErr;
        }
        if (bars.length > 0) {
            logger.info({ symbol, yahooSymbol, interval }, '[chart-renderer] Yahoo Finance fallback succeeded');
        }
    }

    if (bars.length === 0) {
        throw new Error(`No chart data available for ${symbol} ${interval}`);
    }

    const option = buildChartOption(bars, entryPrice, timezone, stopLoss, takeProfit, exitPrice);

    logger.info({ symbol, interval, barsOfContext }, 'Rendering chart via ECharts SSR');

    // Server-side rendering — no browser required.
    // ECharts 6 SSR renders to an SVG string entirely in Node.js.
    // sharp converts the SVG to a PNG buffer using librsvg.
    // This replaces the previous Playwright/Chromium approach which crashed
    // in Alpine Docker when loading the 1.1 MB ECharts bundle.
    const chart = echarts.init(null, null, {
        renderer: 'svg',
        ssr: true,
        width: 1200,
        height: 600,
    });

    try {
        chart.setOption(option);
        const svgString = chart.renderToSVGString();
        const buffer = await sharp(Buffer.from(svgString)).png().toBuffer();
        logger.info({ symbol, interval }, 'Chart render complete');
        return buffer;
    } finally {
        chart.dispose();
    }
}
