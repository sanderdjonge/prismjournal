'use client'

export function getChartColor(token: string): string {
  if (typeof window === 'undefined') return ''
  return getComputedStyle(document.documentElement)
    .getPropertyValue(`--${token}`)
    .trim()
}

export function getChartColors() {
  return {
    profit: getChartColor('profit'),
    loss: getChartColor('loss'),
    profitBg: getChartColor('profit-bg'),
    lossBg: getChartColor('loss-bg'),
    profitBorder: getChartColor('profit-border'),
    lossBorder: getChartColor('loss-border'),
    primary: getChartColor('primary'),
    secondary: getChartColor('secondary'),
    accent: getChartColor('accent'),
    warning: getChartColor('warning'),
    warningBg: getChartColor('warning-bg'),
    success: getChartColor('success'),
    danger: getChartColor('danger-color'),
    dangerBg: getChartColor('danger-bg'),
    textPrimary: getChartColor('text-primary'),
    textSecondary: getChartColor('text-secondary'),
    textMuted: getChartColor('text-muted'),
    border: getChartColor('border-color'),
    borderSubtle: getChartColor('border-subtle'),
    surface: getChartColor('surface'),
    surfaceCard: getChartColor('surface-card'),
  }
}
