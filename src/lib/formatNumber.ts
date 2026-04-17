export function formatPercent(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`
}

export function formatNumber(value: number, decimals: number = 2): string {
  return value.toFixed(decimals)
}

export function fmtDecimals(value: number, maxDecimals: number = 2): string {
  const factor = Math.pow(10, maxDecimals)
  return (Math.round(value * factor) / factor).toString()
}
