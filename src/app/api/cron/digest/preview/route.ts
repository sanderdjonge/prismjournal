import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/withAuth'
import prisma from '@/lib/prisma'
import { formatProfitFactor } from '@/lib/analytics'
import { computeWeeklyDigestData, type DigestData } from '@/lib/services/digest-computation'
import { formatPercent } from '@/lib/formatNumber'

export const GET = withAuth(async (_req, _ctx, session) => {
    const userId = session.user.id

    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            accounts: {
                where: { isActive: true },
                take: 1,
            },
        },
    })

    if (!user || !user.accounts[0]) {
        return NextResponse.json({ error: 'No active account found' }, { status: 404 })
    }

    const account = user.accounts[0]

    const digestData = await computeWeeklyDigestData(account.id, user.id)

    const html = generatePreviewHtml(digestData)

    return new Response(html, {
        headers: { 'Content-Type': 'text/html' },
    })
})

function generatePreviewHtml(data: DigestData): string {
    const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }

    const pnlColor = data.totalPnl >= 0 ? '#4ade80' : '#f87171'
    const pnlPrefix = data.totalPnl >= 0 ? '+' : ''

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
        <p class="pnl-value" style="color: ${pnlColor}">${pnlPrefix}$${Math.abs(data.totalPnl).toFixed(2)}</p>
        <p class="pnl-return ${data.returnOnEquity >= 0 ? 'positive' : 'negative'}">${data.returnOnEquity >= 0 ? '▲' : '▼'} ${formatPercent(Math.abs(data.returnOnEquity), 2)} return on equity</p>
    </div>

    <div class="stats-grid">
        <div class="stat-card">
            <p class="stat-label">Trades</p>
            <p class="stat-value">${data.totalTrades}</p>
            <p style="margin: 2px 0 0; font-size: 12px; color: #94a3b8">${data.winCount}W / ${data.lossCount}L</p>
        </div>
        <div class="stat-card">
            <p class="stat-label">Win Rate</p>
            <p class="stat-value">${formatPercent(data.winRate, 1)}</p>
            ${data.winRateChange !== null ? `<p class="stat-change ${data.winRateChange >= 0 ? 'positive' : 'negative'}">${data.winRateChange >= 0 ? '▲' : '▼'} ${formatPercent(Math.abs(data.winRateChange), 1)} vs last week</p>` : '<p class="stat-change" style="color: #64748b">First week tracked</p>'}
        </div>
        <div class="stat-card">
            <p class="stat-label">Profit Factor</p>
            <p class="stat-value">${formatProfitFactor(data.profitFactor)}</p>
        </div>
        <div class="stat-card">
            <p class="stat-label">Avg R:R</p>
            <p class="stat-value">${data.avgRR.toFixed(2)}</p>
        </div>
    </div>

    <p style="text-align: center; margin-top: 32px; font-size: 12px; color: #64748b;">This is a preview of your weekly digest email.</p>
</div>
</body>
</html>`
}

export const runtime = 'nodejs'
