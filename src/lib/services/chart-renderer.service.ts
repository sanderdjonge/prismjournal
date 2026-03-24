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

function buildChartOption(bars: OhlcBar[], entryPrice: number, timezone: string, stopLoss?: number | null, takeProfit?: number | null): EChartsOption {
    const dates = toTimeLabels(bars, timezone);
    // ECharts candlestick: [open, close, low, high]
    const ohlcData = bars.map(b => [+b.open, +b.close, +b.low, +b.high]);

    const markLineData: object[] = [
        {
            yAxis: entryPrice,
            lineStyle: { color: '#00f2ff', width: 2 },
            label: { formatter: `Entry ${entryPrice}`, position: 'end', color: '#00f2ff', fontSize: 11, fontWeight: 'bold' },
        },
    ];
    if (stopLoss != null) {
        markLineData.push({
            yAxis: stopLoss,
            lineStyle: { color: '#f87171', width: 1.5, type: 'dashed' },
            label: { formatter: `SL ${stopLoss}`, position: 'end', color: '#f87171', fontSize: 10 },
        });
    }
    if (takeProfit != null) {
        markLineData.push({
            yAxis: takeProfit,
            lineStyle: { color: '#4ade80', width: 1.5, type: 'dashed' },
            label: { formatter: `TP ${takeProfit}`, position: 'end', color: '#4ade80', fontSize: 10 },
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
            scale: true,
            axisLabel: { color: '#6b7280', fontSize: 9 },
            axisLine: { lineStyle: { color: '#374151' } },
            splitLine: { lineStyle: { color: '#1f2937', type: 'dashed' } },
        },
        series: [{
            type: 'candlestick',
            data: ohlcData,
            itemStyle: {
                color: '#4ade80',
                color0: '#f87171',
                borderColor: '#4ade80',
                borderColor0: '#f87171',
            },
            markLine: {
                silent: true,
                symbol: ['none', 'none'],
                data: markLineData,
            },
        }],
    };
}

export async function renderCandlestickChart(options: ChartRenderOptions): Promise<Buffer> {
    const { symbol, interval, entryPrice, stopLoss, takeProfit, barsOfContext, timezone, endDate } = options;

    const outputsize = barsOfContext + 25;
    const bars = await fetchOhlc(symbol, interval, outputsize, endDate);
    const option = buildChartOption(bars, entryPrice, timezone, stopLoss, takeProfit);

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
