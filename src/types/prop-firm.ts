export interface ChallengeRule {
  type: 'MAX_DAILY_LOSS' | 'MAX_TRADES_PER_DAY' | 'MIN_RR' | 'TIME_WINDOW' | 'MAX_DRAWDOWN' | 'WIN_RATE_TARGET'
  value: number | string
  operator?: 'LT' | 'LTE' | 'GT' | 'GTE' | 'EQ'
}
