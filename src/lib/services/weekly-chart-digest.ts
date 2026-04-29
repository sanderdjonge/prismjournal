import * as echarts from 'echarts'
import sharp from 'sharp'
import prisma from '@/lib/prisma'
import { sendTelegramPhoto } from '@/lib/telegram-photo'
import logger from '@/lib/logger'
import { tmpdir } from 'os'
import { join } from 'path'
import { writeFileSync, unlinkSync } from 'fs'

interface EquityPoint {
  date: string
  equity: number
}

async function getWeeklyEquityData(accountId: string): Promise<EquityPoint[]> {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const weekStart = new Date(now)
  weekStart.setDate(weekStart.getDate() - diff)
  weekStart.setHours(0, 0, 0, 0)

  const trades = await prisma.trade.findMany({
    where: {
      accountId,
      exitTime: { gte: weekStart, lte: now },
      pnl: { not: null },
    },
    orderBy: { exitTime: 'asc' },
    select: { exitTime: true, pnl: true },
  })

  const snapshots = await prisma.equitySnapshot.findMany({
    where: {
      accountId,
      timestamp: { gte: weekStart, lte: now },
    },
    orderBy: { timestamp: 'asc' },
    select: { timestamp: true, equity: true },
  })

  if (trades.length === 0 && snapshots.length === 0) return []

  if (snapshots.length > 0) {
    return snapshots.map(s => ({
      date: s.timestamp.toISOString().slice(0, 10),
      equity: s.equity,
    }))
  }

  let running = 0
  return trades.map(t => {
    running += t.pnl ?? 0
    return {
      date: (t.exitTime ?? new Date()).toISOString().slice(0, 10),
      equity: running,
    }
  })
}

function buildEquityChartOption(data: EquityPoint[]): echarts.EChartsOption {
  const dates = data.map(d => d.date)
  const values = data.map(d => d.equity)
  const minVal = Math.min(...values)
  const maxVal = Math.max(...values)
  const pad = (maxVal - minVal) * 0.1 || 1
  const isPositive = values[values.length - 1] >= (values[0] ?? 0)
  const lineColor = isPositive ? '#4ade80' : '#f87171'

  return {
    backgroundColor: '#0d0d14',
    animation: false,
    grid: { left: 70, right: 30, top: 40, bottom: 50 },
    title: {
      text: 'Weekly Equity Curve',
      textStyle: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
      left: 'center',
      top: 10,
    },
    xAxis: {
      data: dates,
      axisLabel: { color: '#6b7280', fontSize: 9, rotate: 30 },
      axisLine: { lineStyle: { color: '#374151' } },
      splitLine: { lineStyle: { color: '#1f2937', type: 'dashed' } },
    },
    yAxis: {
      min: minVal - pad,
      max: maxVal + pad,
      axisLabel: { color: '#6b7280', fontSize: 9 },
      axisLine: { lineStyle: { color: '#374151' } },
      splitLine: { lineStyle: { color: '#1f2937', type: 'dashed' } },
    },
    series: [
      {
        type: 'line',
        data: values,
        lineStyle: { color: lineColor, width: 2 },
        itemStyle: { color: lineColor },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: isPositive ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)' },
            { offset: 1, color: 'rgba(0,0,0,0)' },
          ]),
        },
        symbol: 'circle',
        symbolSize: 4,
      },
    ],
  }
}

export async function generateWeeklyChartImage(accountId: string): Promise<Buffer | null> {
  const data = await getWeeklyEquityData(accountId)
  if (data.length < 2) return null

  const option = buildEquityChartOption(data)

  const chart = echarts.init(null, null, {
    renderer: 'svg',
    ssr: true,
    width: 800,
    height: 400,
  })

  try {
    chart.setOption(option)
    const svgString = chart.renderToSVGString()
    const buffer = await sharp(Buffer.from(svgString)).png().toBuffer()
    return buffer
  } finally {
    chart.dispose()
  }
}

export async function sendWeeklyChartDigest(userId: string, accountId: string, telegramId: string): Promise<boolean> {
  try {
    const buffer = await generateWeeklyChartImage(accountId)
    if (!buffer) {
      logger.info({ userId }, 'No equity data for weekly chart digest, skipping')
      return false
    }

    const tmpPath = join(tmpdir(), `weekly-chart-${userId}-${Date.now()}.png`)
    writeFileSync(tmpPath, buffer)

    try {
      const caption = '📊 <b>Weekly Equity Chart</b>\nYour performance overview for this week.'
      const sent = await sendTelegramPhoto(telegramId, tmpPath, caption)
      return sent
    } finally {
      try { unlinkSync(tmpPath) } catch { /* ignore cleanup errors */ }
    }
  } catch (error) {
    logger.error({ err: error, userId }, 'Failed to send weekly chart digest')
    return false
  }
}
