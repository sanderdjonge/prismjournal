export const queryKeys = {
  trades: {
    all: ['trades'] as const,
    list: (filters?: unknown) => [...queryKeys.trades.all, filters] as const,
  },
  dashboard: {
    all: ['dashboard'] as const,
    detail: (period: string, accountId?: string | null) => [...queryKeys.dashboard.all, period, accountId] as const,
  },
  analytics: {
    all: ['analytics'] as const,
    detail: (from?: string, to?: string, account?: string) => [...queryKeys.analytics.all, from ?? '', to ?? '', account ?? ''] as const,
  },
  performance: {
    all: ['performance'] as const,
    detail: (period: string, accountId?: string | null) => [...queryKeys.performance.all, period, accountId ?? ''] as const,
  },
  strategies: {
    all: ['strategies'] as const,
    detail: (id: string) => [...queryKeys.strategies.all, 'detail', id] as const,
  },
  'strategy-analytics': {
    all: ['strategy-analytics'] as const,
    detail: (strategyId: string) => [...queryKeys['strategy-analytics'].all, strategyId] as const,
  },
  tags: {
    all: ['tags'] as const,
  },
  settings: {
    all: ['settings'] as const,
  },
  challenges: {
    all: ['challenges'] as const,
    list: (activeOnly?: boolean) => [...queryKeys.challenges.all, { activeOnly }] as const,
    detail: (id: string) => [...queryKeys.challenges.all.slice(0, 1), 'challenge', id] as const,
  },
  checklists: {
    all: ['checklists'] as const,
  },
  'pre-trade-notes': {
    all: ['pre-trade-notes'] as const,
    list: (status?: string, limit?: number) => [...queryKeys['pre-trade-notes'].all, status, limit] as const,
  },
  heatmap: {
    all: ['heatmap'] as const,
    detail: (filters?: Record<string, unknown>) => [...queryKeys.heatmap.all, filters] as const,
  },
  'daily-calendar': {
    all: ['daily-calendar'] as const,
    detail: (filters?: Record<string, unknown>) => [...queryKeys['daily-calendar'].all, filters] as const,
  },
  symbolAnalytics: {
    all: ['symbolAnalytics'] as const,
    detail: (accountId?: string | null) => [...queryKeys.symbolAnalytics.all, accountId] as const,
  },
  'economic-events': {
    all: ['economic-events'] as const,
    list: (params?: Record<string, unknown>) => [...queryKeys['economic-events'].all, params] as const,
  },
  benchmark: {
    all: ['benchmark'] as const,
    detail: (accountId?: string | null, symbols?: string[]) => [...queryKeys.benchmark.all, accountId, symbols] as const,
  },
  'benchmark-prices': {
    all: ['benchmark-prices'] as const,
    detail: (symbol: string, start?: string, end?: string, normalizedStart?: string) => [...queryKeys['benchmark-prices'].all, symbol, start, end, normalizedStart] as const,
  },
  'be-metrics': {
    all: ['be-metrics'] as const,
    detail: (accountId?: string | null) => [...queryKeys['be-metrics'].all, accountId ?? 'all'] as const,
  },
  'prism-score': {
    all: ['prism-score'] as const,
    detail: (accountId?: string | null) => [...queryKeys['prism-score'].all, accountId] as const,
  },
  periodComparison: {
    all: ['periodComparison'] as const,
    detail: (accountId?: string | null, preset?: string, customRange?: unknown) => [...queryKeys.periodComparison.all, accountId, preset, customRange] as const,
  },
  rDistribution: {
    all: ['rDistribution'] as const,
    detail: (accountId?: string | null) => [...queryKeys.rDistribution.all, accountId] as const,
  },
  'excursion-trades': {
    all: ['excursion-trades'] as const,
    list: (from?: string, to?: string, account?: string, limit?: number) => [...queryKeys['excursion-trades'].all, from ?? '', to ?? '', account ?? '', limit ?? 500] as const,
  },
  'tiltmeter-history': {
    all: ['tiltmeter-history'] as const,
    detail: (accountId?: string | null, startDate?: string, endDate?: string) => [...queryKeys['tiltmeter-history'].all, accountId, startDate ?? null, endDate ?? null] as const,
  },
  'tiltmeter-score': {
    all: ['tiltmeter-score'] as const,
    detail: (accountId?: string | null, periodDays?: number) => [...queryKeys['tiltmeter-score'].all, accountId, periodDays] as const,
  },
  complianceMetrics: {
    all: ['complianceMetrics'] as const,
    detail: (accountId?: string, strategyId?: string) => [...queryKeys.complianceMetrics.all, accountId, strategyId] as const,
  },
  'what-if': {
    all: ['what-if'] as const,
    detail: (filters?: Record<string, unknown>) => [...queryKeys['what-if'].all, filters] as const,
  },
  notifications: {
    all: ['notifications'] as const,
  },
  accounts: {
    all: ['accounts'] as const,
  },
  'prop-firms': {
    all: ['prop-firms'] as const,
  },
  'bridge-key': {
    all: ['bridge-key'] as const,
  },
  'account-details': {
    all: ['account-details'] as const,
    detail: (accountId: string) => [...queryKeys['account-details'].all, accountId] as const,
  },
  'notifications-settings': {
    all: ['notifications-settings'] as const,
  },
  profile: {
    all: ['profile'] as const,
  },
  'strategy-rules': {
    all: ['strategy-rules'] as const,
    detail: (strategyId: string) => [...queryKeys['strategy-rules'].all, strategyId] as const,
  },
  'checklist-completions': {
    all: ['checklist-completions'] as const,
    detail: (tradeId: string) => [...queryKeys['checklist-completions'].all, tradeId] as const,
  },
  'share-card': {
    all: ['share-card'] as const,
  },
  'audit-log': {
    all: ['audit-log'] as const,
  },
  'admin-users': {
    all: ['admin-users'] as const,
  },
  'admin-backups': {
    all: ['admin-backups'] as const,
  },
  'admin-infrastructure': {
    all: ['admin-infrastructure'] as const,
  },
  'invite-tokens': {
    all: ['invite-tokens'] as const,
  },
  'system-settings': {
    all: ['system-settings'] as const,
  },
  violations: {
    all: ['violations'] as const,
  },
  snapshots: {
    all: ['snapshots'] as const,
    detail: (accountId: string) => [...queryKeys.snapshots.all, accountId] as const,
  },
} as const
