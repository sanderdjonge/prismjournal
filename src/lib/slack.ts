import logger from './logger'

export interface SlackAttachment {
  color?: string
  title?: string
  text?: string
  fields?: Array<{
    title: string
    value: string
    short?: boolean
  }>
  footer?: string
  ts?: number
}

export interface SlackMessage {
  text?: string
  attachments?: SlackAttachment[]
}

export async function sendSlackMessage(
  webhookUrl: string,
  payload: SlackMessage,
): Promise<boolean> {
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      logger.warn({ status: res.status }, 'Slack webhook returned non-OK status')
      return false
    }
    return true
  } catch (error) {
    logger.error({ err: error }, 'Slack send failed')
    return false
  }
}

export function formatTradeMessage(
  trade: {
    symbol: string
    direction: string
    volume: number
    entryPrice?: number
    exitPrice?: number | null
    pnl?: number | null
  },
  action: 'OPEN' | 'CLOSE',
): SlackMessage {
  const emoji = action === 'OPEN' ? '📈' : '📉'
  const color = action === 'OPEN' ? '#36a64f' : (trade.pnl && trade.pnl >= 0 ? '#36a64f' : '#e01e5a')

  const fields: SlackAttachment['fields'] = [
    { title: 'Symbol', value: trade.symbol, short: true },
    { title: 'Direction', value: trade.direction.toUpperCase(), short: true },
    { title: 'Volume', value: `${trade.volume}`, short: true },
  ]

  if (trade.entryPrice) {
    fields.push({ title: 'Entry', value: String(trade.entryPrice), short: true })
  }

  if (action === 'CLOSE' && trade.exitPrice) {
    fields.push({ title: 'Exit', value: String(trade.exitPrice), short: true })
  }

  if (action === 'CLOSE' && trade.pnl != null) {
    fields.push({
      title: 'P&L',
      value: trade.pnl >= 0 ? `+${trade.pnl.toFixed(2)}` : trade.pnl.toFixed(2),
      short: true,
    })
  }

  return {
    text: `${emoji} Trade ${action.toLowerCase()}: ${trade.symbol}`,
    attachments: [
      {
        color,
        title: `${action === 'OPEN' ? 'Trade Opened' : 'Trade Closed'} — ${trade.symbol}`,
        fields,
        footer: 'PrismJournal',
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  }
}

export function formatAlertMessage(
  type: 'MDD_ALERT' | 'RULE_VIOLATION',
  data: {
    title: string
    message: string
    severity?: 'WARNING' | 'CRITICAL' | 'BREACH'
  },
): SlackMessage {
  const colorMap = {
    WARNING: '#f2c744',
    CRITICAL: '#e01e5a',
    BREACH: '#7b0000',
  } as const

  const color = type === 'MDD_ALERT'
    ? '#e01e5a'
    : (data.severity ? colorMap[data.severity] : '#e01e5a')

  const emoji = type === 'MDD_ALERT' ? '⚠️' : '🚨'

  return {
    text: `${emoji} ${data.title}`,
    attachments: [
      {
        color,
        title: data.title,
        text: data.message,
        footer: 'PrismJournal',
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  }
}
