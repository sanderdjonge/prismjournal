export interface MediaItem {
  id: string
  url: string
  timeframe: string
  event?: string
}

export interface EquityPoint {
  time: string
  value: number
}

export interface EquityPointDetailed {
  date: string
  value: number
  actualValue: number
  simulatedValue: number
}

export interface RecentTrade {
  id: string
  symbol: string
  direction: 'LONG' | 'SHORT'
  price: string
  pnl: number
  time: string
  isActive?: boolean
}
