import { chromium } from 'playwright-core';
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
}

interface OhlcBar {
    datetime: string;
    open: string;
    high: string;
    low: string;
    close: string;
}

async function fetchOhlc(symbol: string, interval: string, outputsize: number): Promise<OhlcBar[]> {
    const apiKey = process.env.TWELVE_DATA_API_KEY;
    if (!apiKey) throw new Error('TWELVE_DATA_API_KEY is not set');

    const url =
        `https://api.twelvedata.com/time_series` +
        `?symbol=${encodeURIComponent(symbol)}` +
        `&interval=${interval}` +
        `&outputsize=${outputsize}` +
        `&order=ASC` +
        `&apikey=${apiKey}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`Twelve Data HTTP ${res.status}`);

    const data = await res.json() as { status?: string; message?: string; values?: OhlcBar[] };
    if (data.status === 'error') throw new Error(`Twelve Data error: ${data.message}`);
    if (!Array.isArray(data.values) || data.values.length === 0) {
        throw new Error(`No OHLC data returned for ${symbol} ${interval}`);
    }

    return data.values;
}

function buildChartOptionJson(bars: OhlcBar[], entryPrice: number, stopLoss?: number | null, takeProfit?: number | null): string {
    const dates = bars.map(b => b.datetime);
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

    const option = {
        backgroundColor: '#0d0d14',
        animation: false,
        grid: { left: 70, right: 130, top: 30, bottom: 50 },
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

    return JSON.stringify(option);
}

export async function renderCandlestickChart(options: ChartRenderOptions): Promise<Buffer> {
    const { symbol, interval, entryPrice, stopLoss, takeProfit, barsOfContext } = options;

    const outputsize = barsOfContext + 25;
    const bars = await fetchOhlc(symbol, interval, outputsize);

    const chartOptionJson = buildChartOptionJson(bars, entryPrice, stopLoss, takeProfit);

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>* { margin: 0; padding: 0; } body { background: #0d0d14; }</style>
  <script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
</head>
<body>
  <div id="c" style="width:1200px;height:600px;"></div>
  <script>
    const chart = echarts.init(document.getElementById('c'), null, { renderer: 'canvas' });
    chart.setOption(${chartOptionJson});
    window.__CHART_DONE__ = true;
  </script>
</body>
</html>`;

    const executablePath =
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/usr/bin/chromium-browser';

    logger.info({ symbol, interval, barsOfContext }, 'Launching headless browser for chart render');

    const browser = await chromium.launch({
        executablePath,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });

    try {
        const page = await browser.newPage();
        await page.setViewportSize({ width: 1200, height: 600 });
        await page.setContent(html, { waitUntil: 'networkidle' });
        await page.waitForFunction(() => (window as { __CHART_DONE__?: boolean }).__CHART_DONE__ === true, {
            timeout: 15_000,
        });
        const buffer = await page.screenshot({ type: 'png' });
        logger.info({ symbol, interval }, 'Chart render complete');
        return Buffer.from(buffer);
    } finally {
        await browser.close();
    }
}
