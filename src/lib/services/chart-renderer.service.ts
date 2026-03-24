import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';
import sharp from 'sharp';
import logger from '@/lib/logger';

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

export async function renderCandlestickChart(options: ChartRenderOptions): Promise<Buffer> {
    const { symbol, interval, entryPrice, exitPrice, stopLoss, takeProfit, barsOfContext, timezone, endDate } = options;

    const bars = await fetchOhlc(symbol, interval, barsOfContext, endDate);

    // Sanity check: if the entry price is outside 10× the OHLC range, Twelve Data
    // returned data for a different instrument (e.g. free-tier index restriction).
    // Discard rather than produce a broken chart.
    const dataMin = Math.min(...bars.map(b => +b.low));
    const dataMax = Math.max(...bars.map(b => +b.high));
    if (entryPrice < dataMin / 10 || entryPrice > dataMax * 10) {
        throw Object.assign(
            new Error(`Price mismatch: entry ${entryPrice} outside OHLC range ${dataMin}–${dataMax} for ${symbol}`),
            { code: 'PRICE_MISMATCH' },
        );
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
