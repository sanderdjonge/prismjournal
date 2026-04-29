import prisma from './prisma'
import { sendTelegramMessage } from './telegram'
import { sendMddAlertEmail } from './email'
import { sendPushNotification, type PushPayload } from './push-notifications'
import { sendSlackMessage, formatTradeMessage, formatAlertMessage } from './slack'
import { formatPercent } from '@/lib/formatNumber'
import logger from './logger'

export type NotificationType = 'TRADE_OPEN' | 'TRADE_CLOSE' | 'MDD_ALERT' | 'SYNC_ERROR' | 'SYSTEM' | 'RULE_VIOLATION'

const VIOLATION_SUGGESTIONS: Record<string, string> = {
  MAX_DAILY_LOSS: 'Review your position sizing to stay within daily limits',
  MAX_DAILY_TRADES: 'Consider being more selective with your entries',
  MIN_RR_RATIO: 'Wait for setups with better risk/reward ratios',
  NO_OVERTRADING: 'Take a break and review your trading plan',
  MANDATORY_STOP_LOSS: 'Always set a stop loss before entering a trade',
}

function getViolationSuggestion(ruleType: string): string {
  return VIOLATION_SUGGESTIONS[ruleType] ?? 'Review your strategy rules for details'
}

interface CreateNotificationParams {
  userId: string
  type: NotificationType
  title: string
  message: string
  sendTelegram?: boolean
  telegramId?: string | null
  sendEmail?: boolean
  email?: string | null
  emailData?: Record<string, unknown>
  skipInAppCheck?: boolean
  slackWebhookUrl?: string | null
  enableSlack?: boolean
}

async function sendSlackIfNeeded(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  slackWebhookUrl?: string | null,
  enableSlack?: boolean,
  tradeData?: { symbol: string; direction: string; volume: number; entryPrice?: number; exitPrice?: number | null; pnl?: number | null },
  action?: 'OPEN' | 'CLOSE',
  alertData?: { title: string; message: string; severity?: 'WARNING' | 'CRITICAL' | 'BREACH' },
) {
  if (!enableSlack || !slackWebhookUrl) return

  try {
    if ((type === 'TRADE_OPEN' || type === 'TRADE_CLOSE') && tradeData && action) {
      await sendSlackMessage(slackWebhookUrl, formatTradeMessage(tradeData, action))
    } else if (type === 'MDD_ALERT' && alertData) {
      await sendSlackMessage(slackWebhookUrl, formatAlertMessage('MDD_ALERT', alertData))
    } else if (type === 'RULE_VIOLATION' && alertData) {
      await sendSlackMessage(slackWebhookUrl, formatAlertMessage('RULE_VIOLATION', alertData))
    } else {
      await sendSlackMessage(slackWebhookUrl, { text: `${title}\n${message}` })
    }
  } catch (error) {
    logger.warn({ err: error }, 'Slack notification failed')
  }
}

async function sendPushIfNeeded(
  userId: string,
  title: string,
  message: string,
  type: NotificationType,
) {
  try {
    const payload: PushPayload = {
      title,
      body: message,
      tag: type,
    }
    await sendPushNotification(userId, payload)
  } catch (error) {
    logger.warn({ err: error }, 'Push notification failed')
  }
}

export async function createNotification(params: CreateNotificationParams) {
  const { userId, type, title, message, sendTelegram, telegramId, sendEmail, email, skipInAppCheck, slackWebhookUrl, enableSlack } = params

  if (!skipInAppCheck && (type === 'TRADE_OPEN' || type === 'TRADE_CLOSE')) {
    const alertConfig = await prisma.alertConfig.findUnique({
      where: { userId },
      select: { inAppToast: true, slackWebhookUrl: true, enableSlack: true },
    })

    if (alertConfig && alertConfig.inAppToast === false) {
      if (sendTelegram && telegramId) {
        const telegramMessage = `<b>${title}</b>\n\n${message}`
        await sendTelegramMessage(telegramId, telegramMessage)
      }
      if (alertConfig.enableSlack && alertConfig.slackWebhookUrl) {
        await sendSlackIfNeeded(userId, type, title, message, alertConfig.slackWebhookUrl, alertConfig.enableSlack)
      }
      await sendPushIfNeeded(userId, title, message, type)
      return null
    }
  }

  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
    },
  })

  if (sendTelegram && telegramId) {
    const telegramMessage = `<b>${title}</b>\n\n${message}`
    await sendTelegramMessage(telegramId, telegramMessage)
  }

  if (sendEmail && email && type === 'MDD_ALERT') {
    const mddThreshold = params.emailData?.mddThreshold as number | undefined
    const currentDrawdown = params.emailData?.currentDrawdown as number | undefined
    if (mddThreshold && currentDrawdown) {
      await sendMddAlertEmail(email, currentDrawdown, mddThreshold)
    }
  }

  await sendPushIfNeeded(userId, title, message, type)
  await sendSlackIfNeeded(userId, type, title, message, slackWebhookUrl, enableSlack)

  return notification
}

export async function checkMddAlert(
  userId: string,
  accountId: string,
  currentEquity: number,
  peakEquity: number
) {
  const alertConfig = await prisma.alertConfig.findUnique({
    where: { userId },
  })

  if (!alertConfig || !alertConfig.mddThreshold) {
    return null
  }

  const threshold = alertConfig.mddThreshold
  const currentDrawdown = ((peakEquity - currentEquity) / peakEquity) * 100

  if (currentDrawdown >= threshold) {
    const recentAlert = await prisma.notification.findFirst({
      where: {
        userId,
        type: 'MDD_ALERT',
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000),
        },
      },
    })

    if (recentAlert) {
      return null
    }

    const notification = await createNotification({
      userId,
      type: 'MDD_ALERT',
      title: '⚠️ Max Drawdown Alert',
      message: `Your account drawdown has reached ${formatPercent(currentDrawdown, 2)}, exceeding your threshold of ${threshold}%. Consider reviewing your positions.`,
      sendTelegram: alertConfig.enableRisk,
      telegramId: alertConfig.telegramId,
      sendEmail: alertConfig.enableMddAlerts,
      email: alertConfig.email,
      emailData: {
        mddThreshold: threshold,
        currentDrawdown,
      },
      slackWebhookUrl: alertConfig.slackWebhookUrl,
      enableSlack: alertConfig.enableSlack,
    })

    return notification
  }

  return null
}

export async function notifyTrade(
  userId: string,
  trade: {
    symbol: string
    type: string
    volume: number
    pnl?: number | null
  },
  action: 'OPEN' | 'CLOSE'
) {
  const alertConfig = await prisma.alertConfig.findUnique({
    where: { userId },
  })

  if (!alertConfig) return null

  const type = action === 'OPEN' ? 'TRADE_OPEN' : 'TRADE_CLOSE'
  const title = action === 'OPEN'
    ? `📈 Trade Opened: ${trade.symbol}`
    : `📉 Trade Closed: ${trade.symbol}`

  const message = action === 'OPEN'
    ? `${trade.type} ${trade.volume} lots on ${trade.symbol}`
    : `${trade.type} ${trade.volume} lots on ${trade.symbol} - P&L: ${trade.pnl?.toFixed(2) || 'N/A'}`

  return createNotification({
    userId,
    type,
    title,
    message,
    sendTelegram: alertConfig.enableTrades,
    telegramId: alertConfig.telegramId,
    slackWebhookUrl: alertConfig.slackWebhookUrl,
    enableSlack: alertConfig.enableSlack,
  })
}

export async function notifySyncError(userId: string, error: string) {
  const alertConfig = await prisma.alertConfig.findUnique({
    where: { userId },
  })

  if (!alertConfig) return null

  return createNotification({
    userId,
    type: 'SYNC_ERROR',
    title: '❌ Sync Error',
    message: `MT5 sync error: ${error}`,
    sendTelegram: alertConfig.enableSync,
    telegramId: alertConfig.telegramId,
    slackWebhookUrl: alertConfig.slackWebhookUrl,
    enableSlack: alertConfig.enableSlack,
  })
}

export async function notifyRuleViolation(
  userId: string,
  params: {
    accountName: string
    ruleType: string
    severity: 'WARNING' | 'CRITICAL' | 'BREACH'
    description: string
    accountId: string
    violationId: string
    strategyName?: string
  }
) {
  const alertConfig = await prisma.alertConfig.findUnique({
    where: { userId },
  })

  const severityEmoji = {
    WARNING: '⚠️',
    CRITICAL: '🚨',
    BREACH: '❌',
  }[params.severity]

  const title = `${severityEmoji} Rule Violation: ${params.ruleType.replace(/_/g, ' ')}`
  const message = `${params.accountName}: ${params.description}`

  const notification = await createNotification({
    userId,
    type: 'RULE_VIOLATION',
    title,
    message,
    sendTelegram: alertConfig?.enableRisk ?? false,
    telegramId: alertConfig?.telegramId,
    slackWebhookUrl: alertConfig?.slackWebhookUrl,
    enableSlack: alertConfig?.enableSlack,
  })

  if (!alertConfig?.enableSlack && alertConfig?.enableSync && alertConfig?.telegramId) {
    try {
      const ruleTypeFormatted = params.ruleType.replace(/_/g, ' ')
      const suggestion = getViolationSuggestion(params.ruleType)
      const strategyName = params.strategyName ?? 'Strategy'

      const telegramMessage = [
        `<b>⚠️ Strategy Violation</b>`,
        `<b>Strategy:</b> ${strategyName}`,
        `<b>Rule:</b> ${ruleTypeFormatted}`,
        `<b>Severity:</b> ${params.severity}`,
        `<b>Suggestion:</b> ${suggestion}`,
      ].join('\n')

      await sendTelegramMessage(alertConfig.telegramId, telegramMessage)
    } catch (error) {
      logger.warn({ err: error }, 'Telegram violation notification failed')
    }
  }

  return notification
}
