import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createNotification } from '@/lib/notifications';
import prisma from '@/lib/prisma';
import { sendTelegramMessage } from '@/lib/telegram';

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  default: {
    notification: {
      create: vi.fn(),
    },
    alertConfig: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/telegram', () => ({
  sendTelegramMessage: vi.fn(),
}));

vi.mock('@/lib/email', () => ({
  sendMddAlertEmail: vi.fn(),
}));

describe('createNotification - inAppToast setting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should create in-app notification for TRADE_OPEN when inAppToast is true', async () => {
    vi.mocked(prisma.alertConfig.findUnique).mockResolvedValue({
      inAppToast: true,
    } as any);
    vi.mocked(prisma.notification.create).mockResolvedValue({
      id: 'notif-1',
      userId: 'user-1',
      type: 'TRADE_OPEN',
      title: 'Test',
      message: 'Test message',
      isRead: false,
      createdAt: new Date(),
    } as any);

    const result = await createNotification({
      userId: 'user-1',
      type: 'TRADE_OPEN',
      title: '🔔 Trade Opened: EURUSD',
      message: 'LONG 0.1 lots @ 1.0850',
    });

    expect(result).not.toBeNull();
    expect(prisma.notification.create).toHaveBeenCalled();
  });

  it('should NOT create in-app notification for TRADE_OPEN when inAppToast is false', async () => {
    vi.mocked(prisma.alertConfig.findUnique).mockResolvedValue({
      inAppToast: false,
    } as any);

    const result = await createNotification({
      userId: 'user-1',
      type: 'TRADE_OPEN',
      title: '🔔 Trade Opened: EURUSD',
      message: 'LONG 0.1 lots @ 1.0850',
    });

    expect(result).toBeNull();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('should NOT create in-app notification for TRADE_CLOSE when inAppToast is false', async () => {
    vi.mocked(prisma.alertConfig.findUnique).mockResolvedValue({
      inAppToast: false,
    } as any);

    const result = await createNotification({
      userId: 'user-1',
      type: 'TRADE_CLOSE',
      title: '📊 Trade Closed: EURUSD',
      message: 'LONG 0.1 lots — P&L: $50.00',
    });

    expect(result).toBeNull();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('should still send Telegram notification even when inAppToast is false', async () => {
    vi.mocked(prisma.alertConfig.findUnique).mockResolvedValue({
      inAppToast: false,
    } as any);

    await createNotification({
      userId: 'user-1',
      type: 'TRADE_OPEN',
      title: '🔔 Trade Opened: EURUSD',
      message: 'LONG 0.1 lots @ 1.0850',
      sendTelegram: true,
      telegramId: 'telegram-123',
    });

    expect(sendTelegramMessage).toHaveBeenCalledWith(
      'telegram-123',
      '<b>🔔 Trade Opened: EURUSD</b>\n\nLONG 0.1 lots @ 1.0850'
    );
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('should always create in-app notification for MDD_ALERT regardless of inAppToast', async () => {
    vi.mocked(prisma.alertConfig.findUnique).mockResolvedValue({
      inAppToast: false,
    } as any);
    vi.mocked(prisma.notification.create).mockResolvedValue({
      id: 'notif-1',
      userId: 'user-1',
      type: 'MDD_ALERT',
      title: '⚠️ Max Drawdown Alert',
      message: 'Your account drawdown has reached 10%',
      isRead: false,
      createdAt: new Date(),
    } as any);

    const result = await createNotification({
      userId: 'user-1',
      type: 'MDD_ALERT',
      title: '⚠️ Max Drawdown Alert',
      message: 'Your account drawdown has reached 10%',
    });

    expect(result).not.toBeNull();
    expect(prisma.notification.create).toHaveBeenCalled();
  });

  it('should always create in-app notification for SYSTEM type regardless of inAppToast', async () => {
    vi.mocked(prisma.alertConfig.findUnique).mockResolvedValue({
      inAppToast: false,
    } as any);
    vi.mocked(prisma.notification.create).mockResolvedValue({
      id: 'notif-1',
      userId: 'user-1',
      type: 'SYSTEM',
      title: '🎉 Challenge Phase Advanced!',
      message: 'Congratulations!',
      isRead: false,
      createdAt: new Date(),
    } as any);

    const result = await createNotification({
      userId: 'user-1',
      type: 'SYSTEM',
      title: '🎉 Challenge Phase Advanced!',
      message: 'Congratulations!',
    });

    expect(result).not.toBeNull();
    expect(prisma.notification.create).toHaveBeenCalled();
  });

  it('should create in-app notification when skipInAppCheck is true even if inAppToast is false', async () => {
    vi.mocked(prisma.alertConfig.findUnique).mockResolvedValue({
      inAppToast: false,
    } as any);
    vi.mocked(prisma.notification.create).mockResolvedValue({
      id: 'notif-1',
      userId: 'user-1',
      type: 'TRADE_OPEN',
      title: '🔔 Trade Opened',
      message: 'Test',
      isRead: false,
      createdAt: new Date(),
    } as any);

    const result = await createNotification({
      userId: 'user-1',
      type: 'TRADE_OPEN',
      title: '🔔 Trade Opened',
      message: 'Test',
      skipInAppCheck: true,
    });

    expect(result).not.toBeNull();
    expect(prisma.notification.create).toHaveBeenCalled();
  });

  it('should create in-app notification when alertConfig is not found (default behavior)', async () => {
    vi.mocked(prisma.alertConfig.findUnique).mockResolvedValue(null as any);
    vi.mocked(prisma.notification.create).mockResolvedValue({
      id: 'notif-1',
      userId: 'user-1',
      type: 'TRADE_OPEN',
      title: '🔔 Trade Opened',
      message: 'Test',
      isRead: false,
      createdAt: new Date(),
    } as any);

    const result = await createNotification({
      userId: 'user-1',
      type: 'TRADE_OPEN',
      title: '🔔 Trade Opened',
      message: 'Test',
    });

    expect(result).not.toBeNull();
    expect(prisma.notification.create).toHaveBeenCalled();
  });
});