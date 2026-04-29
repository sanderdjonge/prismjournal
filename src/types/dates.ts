export type DateFormat = 'DD-MM-YYYY' | 'MM-DD-YYYY' | 'YYYY-MM-DD'

export const DATE_FORMATS: DateFormat[] = ['DD-MM-YYYY', 'MM-DD-YYYY', 'YYYY-MM-DD']

export const DATE_FORMAT_LABELS: Record<DateFormat, string> = {
  'DD-MM-YYYY': 'Day-Month-Year (31-12-2026)',
  'MM-DD-YYYY': 'Month-Day-Year (12-31-2026)',
  'YYYY-MM-DD': 'Year-Month-Day (2026-12-31)',
}

export function formatDateByFormat(date: Date, format: DateFormat): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  switch (format) {
    case 'DD-MM-YYYY':
      return `${day}-${month}-${year}`
    case 'MM-DD-YYYY':
      return `${month}-${day}-${year}`
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`
  }
}
