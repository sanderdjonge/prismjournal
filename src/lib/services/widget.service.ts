import { chromium, Browser, Page } from 'playwright';
import prisma from '@/lib/prisma';
import logger from '@/lib/logger';
import { saveFile, generateFilename, readFile } from '@/lib/storage';
import { generateWidgetHtml } from '@/lib/templates/widget-template';
import { computePrismScore } from '@/lib/services/prism-score.service';

export interface WidgetStats {
    winRate: number;
    profitFactor: number;
    totalTrades: number;
    prismScore: number;
    equityCurve: { date: string; value: number }[];
}

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
    if (!browserInstance) {
        // Use system Chromium in Docker (PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH env var)
        const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;
        browserInstance = await chromium.launch({
            headless: true,
            executablePath,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
        });
    }
    return browserInstance;
}

export async function closeWidgetBrowser(): Promise<void> {
    if (browserInstance) {
        await browserInstance.close();
        browserInstance = null;
    }
}

/**
 * Get user stats for widget
 */
async function getUserStats(userId: string): Promise<WidgetStats> {
    // Get closed trades for the user
    const trades = await prisma.trade.findMany({
        where: {
            account: { userId },
            exitTime: { not: null },
            pnl: { not: null },
        },
        select: {
            id: true,
            pnl: true,
            exitTime: true,
            rMultiple: true,
        },
        orderBy: { exitTime: 'asc' },
    });

    const closedTrades = trades.filter(t => t.pnl !== null && t.exitTime !== null);
    const wins = closedTrades.filter(t => (t.pnl ?? 0) > 0);
    const losses = closedTrades.filter(t => (t.pnl ?? 0) < 0);

    const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
    const grossProfit = wins.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
    const grossLoss = Math.abs(losses.reduce((sum, t) => sum + (t.pnl ?? 0), 0));

    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
    const winRate = closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0;

    // Calculate Prism Score
    const prismResult = computePrismScore(closedTrades.map(t => ({
        pnl: t.pnl,
        exitTime: t.exitTime,
    })));
    const prismScore = prismResult?.score ?? 0;

    // Build equity curve (normalized to start at 100)
    const startingValue = 10000;
    let runningPnl = 0;
    const equityCurve: { date: string; value: number }[] = [];

    for (const trade of closedTrades) {
        runningPnl += trade.pnl ?? 0;
        equityCurve.push({
            date: new Date(trade.exitTime!).toISOString().split('T')[0],
            value: startingValue + runningPnl,
        });
    }

    return {
        winRate,
        profitFactor: profitFactor === Infinity ? 999 : profitFactor,
        totalTrades: closedTrades.length,
        prismScore,
        equityCurve: equityCurve.slice(-30), // Last 30 trades
    };
}

/**
 * Generate a widget image for a public profile
 */
export async function generateWidget(profileId: string): Promise<Buffer> {
    // Find user by public profile ID
    const user = await prisma.user.findFirst({
        where: {
            publicProfileId: profileId,
            publicProfileEnabled: true,
        },
        select: {
            id: true,
            name: true,
            publicProfileStats: true,
        },
    });

    if (!user) {
        throw new Error('Public profile not found or not enabled');
    }

    // Get stats
    const stats = await getUserStats(user.id);

    // Build template data
    const templateData = {
        user: {
            name: user.name,
            publicProfileStats: user.publicProfileStats as {
                showWinRate?: boolean;
                showEquityCurve?: boolean;
                showPrismScore?: boolean;
            } | null,
        },
        stats,
    };

    // Generate HTML
    const html = generateWidgetHtml(templateData);

    // Render to PNG via Playwright
    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
        await page.setContent(html, { waitUntil: 'networkidle' });

        const pngBuffer = await page.screenshot({
            type: 'png',
            fullPage: false,
        });

        logger.info({ profileId, userId: user.id }, '[widget] Generated');

        return pngBuffer;
    } finally {
        await page.close();
    }
}

/**
 * Get or generate cached widget image
 */
export async function getWidgetImage(profileId: string): Promise<Buffer> {
    // For now, always regenerate
    // In production, this would check a cache
    return generateWidget(profileId);
}