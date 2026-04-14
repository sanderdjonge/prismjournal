export interface ComplianceMetricsGroup {
  tradeCount: number
  winRate: number
  avgRR: number
  totalPnl: number
  avgPnl: number
}

export interface ComplianceMetrics {
  fullCompletion: ComplianceMetricsGroup
  partialCompletion: ComplianceMetricsGroup
  noCompletion: ComplianceMetricsGroup
  overall: {
    totalTrades: number
    avgCompletionPct: number
    completionRate: number
  }
}
