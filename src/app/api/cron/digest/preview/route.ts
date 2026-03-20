import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import prisma from '@/lib/prisma';

/**
 * Preview endpoint for weekly digest email
 * Authenticated users can preview their digest without waiting for cron
 */
export const GET = withAuth(async (_req, _ctx, session) => {
    const userId = session.user.id;
    
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            accounts: {
                where: { isActive: true },
                take: 1,
            },
        },
    });

    if (!user || !user.accounts[0]) {
        return NextResponse.json({ error: 'No active account found' }, { status: 404 });
    }

    const account = user.accounts[0];

    // Compute digest data
    const digestData = await computeWeeklyDigestData(account.id, user.id);

    // Generate simple HTML preview
    const html = generatePreviewHtml(digestData);

    return new Response(html, {
        headers: { 'Content-Type': 'text/html' },
    });
});

interface DigestData {
    userName: string;
    weekStart: Date;
    weekEnd: Date;
    totalTrades: number;
    winCount: number;
    lossCount: number;
    netPnl: number;
    winRate: number;
    winRateChange: number | null;
    profitFactor: number;
    avgRR: number;
    returnOnEquity: number;
}

/**
 * Compute weekly digest data for an account
 */
async function computeWeeklyDigestData(accountId: string, userId: string): Promise<DigestData> {
    const now = new Date();
    
    // Get start of current week (Monday)
    const weekEnd = new Date(now);
    weekEnd.setHours(23, 59, 59, 999);
    
    const weekStart = new Date(now);
    const dayOfWeek = weekStart.getDay();
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Adjust so Monday is 0
    weekStart.setDate(weekStart.getDate() - diff);
    weekStart.setHours(0, 0, 0, 0);

    // Get previous week for comparison
    const prevWeekEnd = new Date(weekStart);
    prevWeekEnd.setTime(prevWeekEnd.getTime() - 1);
    
    const prevWeekStart = new Date(prevWeekEnd);
    prevWeekStart.setDate(prevWeekStart.getDate() - 6);
    prevWeekStart.setHours(0, 0, 0, 0);

    // Fetch trades for current week
    const trades = await prisma.trade.findMany({
        where: {
            accountId,
            exitTime: {
                gte: weekStart,
                lte: weekEnd,
            },
            pnl: { not: null },
        },
        orderBy: { exitTime: 'asc' },
    });

    // Fetch trades for previous week (for win rate comparison)
    const prevWeekTrades = await prisma.trade.findMany({
        where: {
            accountId,
            exitTime: {
                gte: prevWeekStart,
                lte: prevWeekEnd,
            },
            pnl: { not: null },
        },
    });

    // Get user info
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
    });

    // Get latest equity snapshot for account balance
    const latestSnapshot = await prisma.equitySnapshot.findFirst({
        where: { accountId },
        orderBy: { timestamp: 'desc' },
    });

    // Calculate metrics
    const totalTrades = trades.length;
    const wins = trades.filter(t => (t.pnl || 0) > 0);
    const losses = trades.filter(t => (t.pnl || 0) < 0);
    const winCount = wins.length;
    const lossCount = losses.length;
    
    const netPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const winRate = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0;
    
    // Previous week win rate
    const prevWinCount = prevWeekTrades.filter(t => (t.pnl || 0) > 0).length;
    const prevWinRate = prevWeekTrades.length > 0 
        ? (prevWinCount / prevWeekTrades.length) * 100 
        : null;
    const winRateChange = prevWinRate !== null ? winRate - prevWinRate : null;

    // Profit factor
    const grossProfit = wins.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const grossLoss = Math.abs(losses.reduce((sum, t) => sum + (t.pnl || 0), 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    // Average R:R
    const tradesWithR = trades.filter(t => t.rMultiple !== null);
    const avgRR = tradesWithR.length > 0
        ? tradesWithR.reduce((sum, t) => sum + (t.rMultiple || 0), 0) / tradesWithR.length
        : 0;

    // Return on equity
    const accountBalance = latestSnapshot?.equity || latestSnapshot?.balance || 10000;
    const returnOnEquity = (netPnl / accountBalance) * 100;

    return {
        userName: user?.name || 'Trader',
        weekStart,
        weekEnd,
        totalTrades,
        winCount,
        lossCount,
        netPnl,
        winRate,
        winRateChange,
        profitFactor,
        avgRR,
        returnOnEquity,
    };
}

function generatePreviewHtml(data: DigestData): string {
    const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const pnlColor = data.netPnl >= 0 ? '#4ade80' : '#f87171';
    const pnlPrefix = data.netPnl >= 0 ? '+' : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PrismJournal — Weekly Digest Preview</title>
<style>
    body { margin: 0; padding: 0; background-color: #0f0f23; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e8f0; }
    .container { max-width: 600px; margin: 0 auto; padding: 24px 16px; }
    .header { text-align: center; padding: 32px 0 16px; }
    .logo { display: inline-flex; align-items: center; gap: 12px; }
    .logo-icon { width: 36px; height: 36px; background: linear-gradient(135deg, #818cf8, #6366f1); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px; }
    .logo-text { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
    .subtitle { margin: 8px 0 0; font-size: 13px; color: #64748b; }
    .period-banner { background: linear-gradient(135deg, #1e1b4b, #312e81); border-radius: 12px; padding: 20px 24px; text-align: center; margin: 16px 0; }
    .period-label { font-size: 12px; color: #a5b4fc; text-transform: uppercase; letter-spacing: 1px; }
    .period-dates { margin: 4px 0 0; font-size: 20px; font-weight: 700; color: #e0e7ff; }
    .pnl-hero { background-color: #1a1a2e; border: 1px solid #2d2d44; border-radius: 12px; padding: 24px; text-align: center; margin: 16px 0; }
    .pnl-label { font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
    .pnl-value { margin: 8px 0 0; font-size: 36px; font-weight: 800; letter-spacing: -1px; }
    .pnl-return { margin: 4px 0 0; font-size: 13px; }
    .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 12px 0; }
    .stat-card { background-color: #1a1a2e; border: 1px solid #2d2d44; border-radius: 10px; padding: 16px 20px; }
    .stat-label { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
    .stat-value { margin: 4px 0 0; font-size: 24px; font-weight: 700; }
    .stat-change { margin: 2px 0 0; font-size: 12px; }
    .positive { color: #4ade80; }
    .negative { color: #f87171; }
</style>
</head>
<body>
<div class="container">
    <div class="header">
        <div class="logo">
            <div class="logo-icon">💎</div>
            <div class="logo-text">PrismJournal</div>
        </div>
        <p class="subtitle">Weekly Performance Digest Preview</p>
    </div>

    <div class="period-banner">
        <p class="period-label">Week of</p>
        <p class="period-dates">${formatDate(data.weekStart)} – ${formatDate(data.weekEnd)}</p>
    </div>

    <div class="pnl-hero">
        <p class="pnl-label">Net P&L This Week</p>
        <p class="pnl-value" style="color: ${pnlColor}">${pnlPrefix}$${Math.abs(data.netPnl).toFixed(2)}</p>
        <p class="pnl-return ${data.returnOnEquity >= 0 ? 'positive' : 'negative'}">${data.returnOnEquity >= 0 ? '▲' : '▼'} ${Math.abs(data.returnOnEquity).toFixed(2)}% return on equity</p>
    </div>

    <div class="stats-grid">
        <div class="stat-card">
            <p class="stat-label">Trades</p>
            <p class="stat-value">${data.totalTrades}</p>
            <p style="margin: 2px 0 0; font-size: 12px; color: #94a3b8">${data.winCount}W / ${data.lossCount}L</p>
        </div>
        <div class="stat-card">
            <p class="stat-label">Win Rate</p>
            <p class="stat-value">${data.winRate.toFixed(1)}%</p>
            ${data.winRateChange !== null ? `<p class="stat-change ${data.winRateChange >= 0 ? 'positive' : 'negative'}">${data.winRateChange >= 0 ? '▲' : '▼'} ${Math.abs(data.winRateChange).toFixed(1)}% vs last week</p>` : '<p class="stat-change" style="color: #64748b">First week tracked</p>'}
        </div>
        <div class="stat-card">
            <p class="stat-label">Profit Factor</p>
            <p class="stat-value">${data.profitFactor === Infinity ? '∞' : data.profitFactor.toFixed(2)}</p>
        </div>
        <div class="stat-card">
            <p class="stat-label">Avg R:R</p>
            <p class="stat-value">${data.avgRR.toFixed(2)}</p>
        </div>
    </div>

    <p style="text-align: center; margin-top: 32px; font-size: 12px; color: #64748b;">This is a preview of your weekly digest email.</p>
</div>
</body>
</html>`;
}

export const runtime = 'nodejs';
