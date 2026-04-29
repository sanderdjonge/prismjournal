import { TradeData } from '../types'
import logger from '@/lib/logger'
import prisma from '@/lib/prisma'
import { normaliseSymbol } from '@/lib/symbol-normaliser'

export interface VolatilityData {
  symbol: string
  atr: number
  atrPercent: number
  timestamp: Date
}

export interface NewsEvent {
  id: string
  title: string
  currency: string
  impact: 'high' | 'medium' | 'low'
  datetime: Date
  forecast?: string
  previous?: string
  actual?: string
}

export interface VolatilityFilterParams {
  mode: 'avoid' | 'prefer'
  atrThreshold?: number
  atrPercentThreshold?: number
}

export interface NewsEventFilterParams {
  avoidHighImpact: boolean
  avoidMediumImpact: boolean
  windowMinutes: number
}

export type VolatilityDataProvider = (symbol: string, date: Date) => Promise<VolatilityData | null>

export type NewsEventsProvider = (currencies: string[], startDate: Date, endDate: Date) => Promise<NewsEvent[]>

const volatilityCache = new Map<string, { data: VolatilityData; expiresAt: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000

function getVolatilityCacheKey(symbol: string, date: Date): string {
  return `${symbol}:${date.toISOString().slice(0, 10)}`
}

export function applyVolatilityFilterSync(
  trades: TradeData[],
  params: VolatilityFilterParams,
  volatilityData: Map<string, VolatilityData>
): TradeData[] {
  return trades.filter(trade => {
    if (!trade.entryTime) return true

    const dateKey = `${trade.symbol}-${new Date(trade.entryTime).toDateString()}`
    const volatility = volatilityData.get(dateKey)

    if (!volatility) return true

    const meetsThreshold = params.atrPercentThreshold
      ? volatility.atrPercent >= params.atrPercentThreshold
      : params.atrThreshold
        ? volatility.atr >= params.atrThreshold
        : true

    if (params.mode === 'avoid' && meetsThreshold) return false
    if (params.mode === 'prefer' && !meetsThreshold) return false

    return true
  })
}

export async function applyVolatilityFilter(
  trades: TradeData[],
  params: VolatilityFilterParams,
  volatilityProvider?: VolatilityDataProvider
): Promise<TradeData[]> {
  if (!volatilityProvider) {
    logger.warn('[What-If] No volatility provider configured, returning all trades')
    return trades
  }

  const result: TradeData[] = []

  for (const trade of trades) {
    if (!trade.entryTime) {
      result.push(trade)
      continue
    }

    try {
      const volatility = await volatilityProvider(trade.symbol, new Date(trade.entryTime))

      if (!volatility) {
        result.push(trade)
        continue
      }

      const meetsThreshold = params.atrPercentThreshold
        ? volatility.atrPercent >= params.atrPercentThreshold
        : params.atrThreshold
          ? volatility.atr >= params.atrThreshold
          : true

      if (params.mode === 'avoid' && meetsThreshold) {
        continue
      }
      if (params.mode === 'prefer' && !meetsThreshold) {
        continue
      }

      result.push(trade)
    } catch (error) {
      logger.warn({ symbol: trade.symbol, error }, '[What-If] Volatility lookup failed')
      result.push(trade)
    }
  }

  return result
}

function isEventRelevantToSymbol(event: NewsEvent, symbol: string): boolean {
  const normalizedSymbol = symbol.replace(/[/_-]/g, '')

  if (normalizedSymbol.length >= 6) {
    const baseCurrency = normalizedSymbol.substring(0, 3)
    const quoteCurrency = normalizedSymbol.substring(3, 6)

    return event.currency === baseCurrency || event.currency === quoteCurrency
  }

  return true
}

export function applyNewsEventFilterSync(
  trades: TradeData[],
  params: NewsEventFilterParams,
  newsEvents: NewsEvent[]
): TradeData[] {
  const relevantEvents = newsEvents.filter(event =>
    (params.avoidHighImpact && event.impact === 'high') ||
    (params.avoidMediumImpact && event.impact === 'medium')
  )

  return trades.filter(trade => {
    if (!trade.entryTime) return true

    const entryTime = new Date(trade.entryTime).getTime()
    const windowMs = params.windowMinutes * 60 * 1000

    for (const event of relevantEvents) {
      if (!isEventRelevantToSymbol(event, trade.symbol)) {
        continue
      }

      const eventTime = new Date(event.datetime).getTime()

      if (entryTime >= eventTime - windowMs && entryTime <= eventTime + windowMs) {
        return false
      }
    }

    return true
  })
}

export async function applyNewsEventFilter(
  trades: TradeData[],
  params: NewsEventFilterParams,
  newsProvider?: NewsEventsProvider
): Promise<TradeData[]> {
  if (!newsProvider) {
    logger.warn('[What-If] No news provider configured, returning all trades')
    return trades
  }

  if (!params.avoidHighImpact && !params.avoidMediumImpact) {
    return trades
  }

  const sortedTrades = [...trades]
    .filter(t => t.entryTime)
    .sort((a, b) => new Date(a.entryTime!).getTime() - new Date(b.entryTime!).getTime())

  if (sortedTrades.length === 0) return trades

  const startDate = new Date(sortedTrades[0].entryTime!)
  startDate.setHours(startDate.getHours() - 24)

  const endDate = new Date(sortedTrades[sortedTrades.length - 1].entryTime!)
  endDate.setHours(endDate.getHours() + 24)

  const currencies = new Set<string>()
  for (const trade of sortedTrades) {
    const symbol = trade.symbol.replace(/[/_-]/g, '')
    if (symbol.length >= 6) {
      currencies.add(symbol.substring(0, 3))
      currencies.add(symbol.substring(3, 6))
    }
  }

  let newsEvents: NewsEvent[]
  try {
    newsEvents = await newsProvider(Array.from(currencies), startDate, endDate)
  } catch (error) {
    logger.warn({ error }, '[What-If] Failed to fetch news events')
    return trades
  }

  return applyNewsEventFilterSync(trades, params, newsEvents)
}

export async function fetchVolatilityFromTwelveData(
  symbol: string,
  date: Date,
  apiKey: string
): Promise<VolatilityData | null> {
  const cacheKey = getVolatilityCacheKey(symbol, date)
  const cached = volatilityCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data
  }

  try {
    const normalised = normaliseSymbol(symbol)

    const params = new URLSearchParams({
      symbol: normalised,
      interval: '1day',
      outputsize: '14',
      order: 'DESC',
      timezone: 'UTC',
      apikey: apiKey,
    })

    const url = `https://api.twelvedata.com/time_series?${params.toString()}`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)

    let response: Response
    try {
      response = await fetch(url, { signal: controller.signal })
    } finally {
      clearTimeout(timeout)
    }

    if (!response.ok) {
      logger.warn({ symbol, status: response.status }, '[What-If] Twelve Data HTTP error')
      return null
    }

    const data = await response.json() as {
      status?: string
      message?: string
      values?: Array<{
        datetime: string
        open: string
        high: string
        low: string
        close: string
      }>
    }

    if (data.status === 'error') {
      logger.warn({ symbol, message: data.message }, '[What-If] Twelve Data API error')
      return null
    }

    if (!Array.isArray(data.values) || data.values.length < 2) {
      logger.debug({ symbol }, '[What-If] Insufficient data for ATR calculation')
      return null
    }

    const values = data.values.slice(0, 14)

    let atrSum = 0
    for (let i = 0; i < values.length - 1; i++) {
      const current = values[i]
      const prev = values[i + 1]
      const high = parseFloat(current.high)
      const low = parseFloat(current.low)
      const prevClose = parseFloat(prev.close)

      const tr1 = high - low
      const tr2 = Math.abs(high - prevClose)
      const tr3 = Math.abs(low - prevClose)
      const trueRange = Math.max(tr1, tr2, tr3)

      atrSum += trueRange
    }

    const atr = atrSum / Math.max(values.length - 1, 1)
    const currentPrice = parseFloat(values[0].close)
    const atrPercent = currentPrice > 0 ? (atr / currentPrice) * 100 : 0

    const result: VolatilityData = {
      symbol,
      atr: Math.round(atr * 100000) / 100000,
      atrPercent: Math.round(atrPercent * 1000) / 1000,
      timestamp: new Date(values[0].datetime),
    }

    volatilityCache.set(cacheKey, {
      data: result,
      expiresAt: Date.now() + CACHE_TTL_MS,
    })

    return result
  } catch (error) {
    logger.error({ symbol, error }, '[What-If] Failed to fetch volatility from Twelve Data')
    return null
  }
}

export async function fetchNewsFromEconomicEvents(
  currencies: string[],
  startDate: Date,
  endDate: Date
): Promise<NewsEvent[]> {
  try {
    const events = await prisma.economicEvent.findMany({
      where: {
        currency: { in: currencies },
        impact: { in: ['HIGH', 'MEDIUM'] },
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { date: 'asc' },
    })

    return events.map(event => ({
      id: event.id,
      title: event.name,
      currency: event.currency,
      impact: event.impact.toLowerCase() as 'high' | 'medium' | 'low',
      datetime: new Date(event.date),
      forecast: event.forecast ?? undefined,
      previous: event.previous ?? undefined,
      actual: event.actual ?? undefined,
    }))
  } catch (error) {
    logger.error({ currencies, error }, '[What-If] Failed to fetch economic events from database')
    return []
  }
}

export async function fetchNewsFromMT5(
  currencies: string[],
  startDate: Date,
  endDate: Date,
  _bridgeUrl: string
): Promise<NewsEvent[]> {
  try {
    logger.debug(
      { currencies, startDate, endDate },
      '[What-If] MT5 bridge news fetch not available, use fetchNewsFromEconomicEvents instead'
    )
    return []
  } catch (error) {
    logger.error({ currencies, error }, '[What-If] Failed to fetch news')
    return []
  }
}
