import prisma from './prisma';
import { sendTelegramMessage } from './telegram';
import { sendMddAlertEmail } from './email';

export type NotificationType = 'TRADE_OPEN' | 'TRADE_CLOSE' | 'MDD_ALERT' | 'SYNC_ERROR' | 'SYSTEM' | 'RULE_VIOLATION';

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  sendTelegram?: boolean;
  telegramId?: string | null;
  sendEmail?: boolean;
  email?: string | null;
  emailData?: Record<string, unknown>;
}

/**
 * Create a notification and optionally send via Telegram/Email
 */
export async function createNotification(params: CreateNotificationParams) {
  const { userId, type, title, message, sendTelegram, telegramId, sendEmail, email } = params;

  // Store notification in database
  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
    },
  });

  // Send Telegram notification if enabled
  if (sendTelegram && telegramId) {
    const telegramMessage = `<b>${title}</b>\n\n${message}`;
    await sendTelegramMessage(telegramId, telegramMessage);
  }

  // Send email notification if enabled
  if (sendEmail && email && type === 'MDD_ALERT') {
    const mddThreshold = params.emailData?.mddThreshold as number | undefined;
    const currentDrawdown = params.emailData?.currentDrawdown as number | undefined;
    if (mddThreshold && currentDrawdown) {
      await sendMddAlertEmail(email, currentDrawdown, mddThreshold);
    }
  }

  return notification;
}

/**
 * Check and alert on max drawdown threshold breach
 * Called from the sync endpoint when equity snapshots are received
 */
export async function checkMddAlert(
  userId: string,
  accountId: string,
  currentEquity: number,
  peakEquity: number
) {
  // Get alert config
  const alertConfig = await prisma.alertConfig.findUnique({
    where: { userId },
  });

  if (!alertConfig || !alertConfig.mddThreshold) {
    return null; // No threshold configured
  }

  const threshold = alertConfig.mddThreshold;
  const currentDrawdown = ((peakEquity - currentEquity) / peakEquity) * 100;

  if (currentDrawdown >= threshold) {
    // Check if we already sent an alert recently (within last hour)
    const recentAlert = await prisma.notification.findFirst({
      where: {
        userId,
        type: 'MDD_ALERT',
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        },
      },
    });

    if (recentAlert) {
      return null; // Already alerted recently
    }

    // Create MDD alert notification
    const notification = await createNotification({
      userId,
      type: 'MDD_ALERT',
      title: '⚠️ Max Drawdown Alert',
      message: `Your account drawdown has reached ${currentDrawdown.toFixed(2)}%, exceeding your threshold of ${threshold}%. Consider reviewing your positions.`,
      sendTelegram: alertConfig.enableRisk,
      telegramId: alertConfig.telegramId,
      sendEmail: alertConfig.enableMddAlerts,
      email: alertConfig.email,
      emailData: {
        mddThreshold: threshold,
        currentDrawdown,
      },
    });

    return notification;
  }

  return null;
}

/**
 * Create a trade notification
 */
export async function notifyTrade(
  userId: string,
  trade: {
    symbol: string;
    type: string;
    volume: number;
    pnl?: number | null;
  },
  action: 'OPEN' | 'CLOSE'
) {
  const alertConfig = await prisma.alertConfig.findUnique({
    where: { userId },
  });

  if (!alertConfig) return null;

  const type = action === 'OPEN' ? 'TRADE_OPEN' : 'TRADE_CLOSE';
  const title = action === 'OPEN' 
    ? `📈 Trade Opened: ${trade.symbol}`
    : `📉 Trade Closed: ${trade.symbol}`;
  
  const message = action === 'OPEN'
    ? `${trade.type} ${trade.volume} lots on ${trade.symbol}`
    : `${trade.type} ${trade.volume} lots on ${trade.symbol} - P&L: ${trade.pnl?.toFixed(2) || 'N/A'}`;

  return createNotification({
    userId,
    type,
    title,
    message,
    sendTelegram: alertConfig.enableTrades,
    telegramId: alertConfig.telegramId,
  });
}

/**
 * Create a sync error notification
 */
export async function notifySyncError(userId: string, error: string) {
  const alertConfig = await prisma.alertConfig.findUnique({
    where: { userId },
  });

  if (!alertConfig) return null;

  return createNotification({
    userId,
    type: 'SYNC_ERROR',
    title: '❌ Sync Error',
    message: `MT5 sync error: ${error}`,
    sendTelegram: alertConfig.enableSync,
    telegramId: alertConfig.telegramId,
  });
}

/**
 * Create a rule violation notification for prop firm accounts
 */
export async function notifyRuleViolation(
  userId: string,
  params: {
    accountName: string;
    ruleType: string;
    severity: 'WARNING' | 'CRITICAL' | 'BREACH';
    description: string;
    accountId: string;
    violationId: string;
  }
) {
  const alertConfig = await prisma.alertConfig.findUnique({
    where: { userId },
  });

  // Determine emoji based on severity
  const severityEmoji = {
    WARNING: '⚠️',
    CRITICAL: '🚨',
    BREACH: '❌',
  }[params.severity];

  const title = `${severityEmoji} Rule Violation: ${params.ruleType.replace(/_/g, ' ')}`;
  const message = `${params.accountName}: ${params.description}`;

  return createNotification({
    userId,
    type: 'RULE_VIOLATION',
    title,
    message,
    sendTelegram: alertConfig?.enableRisk ?? false,
    telegramId: alertConfig?.telegramId,
  });
}
