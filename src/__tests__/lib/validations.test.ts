import { describe, it, expect } from 'vitest';
import {
  registerSchema,
  loginSchema,
} from '@/lib/validations/auth';
import {
  tradeCreateSchema,
  tradeUpdateSchema,
  validateFileUpload,
  ALLOWED_FILE_TYPES,
  MAX_FILE_SIZE,
} from '@/lib/validations/trade';
import {
  settingsUpdateSchema,
  notificationSettingsSchema,
  testEmailSchema,
} from '@/lib/validations/settings';
import {
  syncTradeSchema,
  tradeUpdatePayloadSchema,
  equitySnapshotPayloadSchema,
  syncPayloadSchema,
} from '@/lib/validations/sync';
import { formatZodErrors } from '@/lib/validations/common';

describe('Auth Validations', () => {
  describe('registerSchema', () => {
    it('validates a valid registration input', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'Password123',
        name: 'Test User',
      });
      expect(result.success).toBe(true);
    });

    it('validates registration without optional name', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'Password123',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid email format', () => {
      const result = registerSchema.safeParse({
        email: 'invalid-email',
        password: 'Password123',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(e => e.message === 'Invalid email format')).toBe(true);
      }
    });

    it('rejects empty email', () => {
      const result = registerSchema.safeParse({
        email: '',
        password: 'Password123',
      });
      expect(result.success).toBe(false);
    });

    it('rejects password shorter than 8 characters', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'Pass1',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(e => e.message === 'Password must be at least 8 characters')).toBe(true);
      }
    });

    it('rejects password without uppercase letter', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'password123',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(e => e.message === 'Password must contain at least one uppercase letter')).toBe(true);
      }
    });

    it('rejects password without lowercase letter', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'PASSWORD123',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(e => e.message === 'Password must contain at least one lowercase letter')).toBe(true);
      }
    });

    it('rejects password without number', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'PasswordABC',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(e => e.message === 'Password must contain at least one number')).toBe(true);
      }
    });
  });

  describe('loginSchema', () => {
    it('validates valid login credentials', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: 'anypassword',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing email', () => {
      const result = loginSchema.safeParse({
        password: 'anypassword',
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing password', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid email format', () => {
      const result = loginSchema.safeParse({
        email: 'not-an-email',
        password: 'anypassword',
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('Trade Validations', () => {
  describe('tradeCreateSchema', () => {
    it('validates a valid trade creation input', () => {
      const result = tradeCreateSchema.safeParse({
        symbol: 'EURUSD',
        type: 'LONG',
        volume: 0.1,
        entryPrice: 1.0850,
      });
      expect(result.success).toBe(true);
    });

    it('transforms lowercase type to uppercase', () => {
      const result = tradeCreateSchema.safeParse({
        symbol: 'EURUSD',
        type: 'long',
        volume: 0.1,
        entryPrice: 1.0850,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('LONG');
      }
    });

    it('validates trade with all optional fields', () => {
      const result = tradeCreateSchema.safeParse({
        symbol: 'EURUSD',
        type: 'SHORT',
        volume: 0.5,
        entryPrice: 1.0850,
        exitPrice: 1.0800,
        pnl: 250.00,
        strategy: 'Breakout',
        mood: 'CONFIDENT',
        planCompliance: 'FOLLOWED',
        notes: 'Great trade execution',
        takeProfit: 1.0800,
        stopLoss: 1.0900,
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty symbol', () => {
      const result = tradeCreateSchema.safeParse({
        symbol: '',
        type: 'LONG',
        volume: 0.1,
        entryPrice: 1.0850,
      });
      expect(result.success).toBe(false);
    });

    it('rejects symbol longer than 20 characters', () => {
      const result = tradeCreateSchema.safeParse({
        symbol: 'VERYLONGSYMBOLNAME123',
        type: 'BUY',
        volume: 0.1,
        entryPrice: 1.0850,
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid trade type', () => {
      const result = tradeCreateSchema.safeParse({
        symbol: 'EURUSD',
        type: 'INVALID',
        volume: 0.1,
        entryPrice: 1.0850,
      });
      expect(result.success).toBe(false);
    });

    it('rejects non-positive volume', () => {
      const result = tradeCreateSchema.safeParse({
        symbol: 'EURUSD',
        type: 'BUY',
        volume: -0.1,
        entryPrice: 1.0850,
      });
      expect(result.success).toBe(false);
    });

    it('rejects non-positive entry price', () => {
      const result = tradeCreateSchema.safeParse({
        symbol: 'EURUSD',
        type: 'BUY',
        volume: 0.1,
        entryPrice: -1.0850,
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid mood enum', () => {
      const result = tradeCreateSchema.safeParse({
        symbol: 'EURUSD',
        type: 'BUY',
        volume: 0.1,
        entryPrice: 1.0850,
        mood: 'HAPPY',
      });
      expect(result.success).toBe(false);
    });

    it('rejects notes longer than 5000 characters', () => {
      const result = tradeCreateSchema.safeParse({
        symbol: 'EURUSD',
        type: 'BUY',
        volume: 0.1,
        entryPrice: 1.0850,
        notes: 'x'.repeat(5001),
      });
      expect(result.success).toBe(false);
    });
  });

  describe('tradeUpdateSchema', () => {
    it('validates valid update input', () => {
      const result = tradeUpdateSchema.safeParse({
        mood: 'NEUTRAL',
        planCompliance: 'DEVIATED',
        notes: 'Updated notes',
        entryRating: 4,
        exitRating: 3,
        managementRating: 5,
      });
      expect(result.success).toBe(true);
    });

    it('validates partial update', () => {
      const result = tradeUpdateSchema.safeParse({
        notes: 'Just updating notes',
      });
      expect(result.success).toBe(true);
    });

    it('rejects rating below 1', () => {
      const result = tradeUpdateSchema.safeParse({
        entryRating: 0,
      });
      expect(result.success).toBe(false);
    });

    it('rejects rating above 5', () => {
      const result = tradeUpdateSchema.safeParse({
        exitRating: 6,
      });
      expect(result.success).toBe(false);
    });

    it('rejects non-integer rating', () => {
      const result = tradeUpdateSchema.safeParse({
        managementRating: 3.5,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('validateFileUpload', () => {
    it('accepts valid JPEG file', () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const result = validateFileUpload(file);
      expect(result.success).toBe(true);
    });

    it('accepts valid PNG file', () => {
      const file = new File(['test'], 'test.png', { type: 'image/png' });
      const result = validateFileUpload(file);
      expect(result.success).toBe(true);
    });

    it('accepts valid WebP file', () => {
      const file = new File(['test'], 'test.webp', { type: 'image/webp' });
      const result = validateFileUpload(file);
      expect(result.success).toBe(true);
    });

    it('accepts valid GIF file', () => {
      const file = new File(['test'], 'test.gif', { type: 'image/gif' });
      const result = validateFileUpload(file);
      expect(result.success).toBe(true);
    });

    it('rejects null file', () => {
      const result = validateFileUpload(null);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('No file provided');
      }
    });

    it('rejects invalid file type', () => {
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      const result = validateFileUpload(file);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid file type');
      }
    });

    it('rejects file larger than max size', () => {
      // Create a file larger than 5MB
      const largeContent = new ArrayBuffer(MAX_FILE_SIZE + 1);
      const file = new File([largeContent], 'large.jpg', { type: 'image/jpeg' });
      Object.defineProperty(file, 'size', { value: MAX_FILE_SIZE + 1 });
      
      const result = validateFileUpload(file);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('File too large');
      }
    });

    it('has correct allowed file types', () => {
      expect(ALLOWED_FILE_TYPES).toEqual(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
    });

    it('has correct max file size (5MB)', () => {
      expect(MAX_FILE_SIZE).toBe(5 * 1024 * 1024);
    });
  });
});

describe('Settings Validations', () => {
  describe('settingsUpdateSchema', () => {
    it('validates valid settings update', () => {
      const result = settingsUpdateSchema.safeParse({
        displayCurrency: 'USD',
        timezone: 'Europe/Amsterdam',
      });
      expect(result.success).toBe(true);
    });

    it('validates partial update', () => {
      const result = settingsUpdateSchema.safeParse({
        displayCurrency: 'EUR',
      });
      expect(result.success).toBe(true);
    });

    it('accepts UTC timezone', () => {
      const result = settingsUpdateSchema.safeParse({
        timezone: 'UTC',
      });
      expect(result.success).toBe(true);
    });

    it('accepts IANA timezone format', () => {
      const result = settingsUpdateSchema.safeParse({
        timezone: 'America/New_York',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid currency', () => {
      const result = settingsUpdateSchema.safeParse({
        displayCurrency: 'INVALID',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid timezone format', () => {
      const result = settingsUpdateSchema.safeParse({
        timezone: 'InvalidTimezone',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('notificationSettingsSchema', () => {
    it('validates valid notification settings', () => {
      const result = notificationSettingsSchema.safeParse({
        enableSync: true,
        enableTrades: true,
        enableRisk: false,
        telegramId: '123456789',
        mddThreshold: 20,
        email: 'user@example.com',
        enableWeeklyDigest: true,
        enableMddAlerts: true,
      });
      expect(result.success).toBe(true);
    });

    it('allows nullable telegramId', () => {
      const result = notificationSettingsSchema.safeParse({
        telegramId: null,
      });
      expect(result.success).toBe(true);
    });

    it('allows nullable email', () => {
      const result = notificationSettingsSchema.safeParse({
        email: null,
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid email format', () => {
      const result = notificationSettingsSchema.safeParse({
        email: 'invalid-email',
      });
      expect(result.success).toBe(false);
    });

    it('rejects mddThreshold below 0', () => {
      const result = notificationSettingsSchema.safeParse({
        mddThreshold: -5,
      });
      expect(result.success).toBe(false);
    });

    it('rejects mddThreshold above 100', () => {
      const result = notificationSettingsSchema.safeParse({
        mddThreshold: 105,
      });
      expect(result.success).toBe(false);
    });

    it('rejects telegramId longer than 100 characters', () => {
      const result = notificationSettingsSchema.safeParse({
        telegramId: 'a'.repeat(101),
      });
      expect(result.success).toBe(false);
    });
  });

  describe('testEmailSchema', () => {
    it('validates valid email', () => {
      const result = testEmailSchema.safeParse({
        email: 'test@example.com',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid email', () => {
      const result = testEmailSchema.safeParse({
        email: 'not-an-email',
      });
      expect(result.success).toBe(false);
    });

    it('rejects email longer than 255 characters', () => {
      const result = testEmailSchema.safeParse({
        email: 'a'.repeat(256) + '@example.com',
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('Sync Validations', () => {
  describe('syncTradeSchema', () => {
    it('validates valid sync trade data', () => {
      const result = syncTradeSchema.safeParse({
        ticket: '12345',
        symbol: 'EURUSD',
        type: 'BUY',
        volume: 0.1,
        entryPrice: 1.0850,
        exitPrice: 1.0900,
        pnl: 50.00,
        entryTime: '2024-01-15T10:30:00Z',
        exitTime: '2024-01-15T14:30:00Z',
        commission: -5.00,
        swap: 0,
        stopLoss: 1.0800,
        takeProfit: 1.0950,
      });
      expect(result.success).toBe(true);
    });

    it('transforms lowercase type to uppercase', () => {
      const result = syncTradeSchema.safeParse({
        ticket: '12345',
        symbol: 'EURUSD',
        type: 'sell',
        volume: 0.1,
        entryTime: '2024-01-15T10:30:00Z',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('SELL');
      }
    });

    it('rejects missing ticket', () => {
      const result = syncTradeSchema.safeParse({
        symbol: 'EURUSD',
        type: 'BUY',
        volume: 0.1,
        entryTime: '2024-01-15T10:30:00Z',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid entry time format', () => {
      const result = syncTradeSchema.safeParse({
        ticket: '12345',
        symbol: 'EURUSD',
        type: 'BUY',
        volume: 0.1,
        entryTime: 'invalid-date',
      });
      expect(result.success).toBe(false);
    });

    it('accepts nullable exitTime', () => {
      const result = syncTradeSchema.safeParse({
        ticket: '12345',
        symbol: 'EURUSD',
        type: 'BUY',
        volume: 0.1,
        entryTime: '2024-01-15T10:30:00Z',
        exitTime: null,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('tradeUpdatePayloadSchema', () => {
    it('validates valid trade update payload', () => {
      const result = tradeUpdatePayloadSchema.safeParse({
        type: 'TRADE_UPDATE',
        trade: {
          ticket: '12345',
          symbol: 'EURUSD',
          type: 'BUY',
          volume: 0.1,
          entryTime: '2024-01-15T10:30:00Z',
        },
      });
      expect(result.success).toBe(true);
    });

    it('rejects wrong type literal', () => {
      const result = tradeUpdatePayloadSchema.safeParse({
        type: 'WRONG_TYPE',
        trade: {
          ticket: '12345',
          symbol: 'EURUSD',
          type: 'BUY',
          volume: 0.1,
          entryTime: '2024-01-15T10:30:00Z',
        },
      });
      expect(result.success).toBe(false);
    });
  });

  describe('equitySnapshotPayloadSchema', () => {
    it('validates valid equity snapshot payload', () => {
      const result = equitySnapshotPayloadSchema.safeParse({
        type: 'EQUITY_SNAPSHOT',
        snapshot: {
          balance: 10000,
          equity: 10500,
          timestamp: '2024-01-15T10:30:00Z',
        },
      });
      expect(result.success).toBe(true);
    });

    it('rejects negative balance', () => {
      const result = equitySnapshotPayloadSchema.safeParse({
        type: 'EQUITY_SNAPSHOT',
        snapshot: {
          balance: -1000,
          equity: 10500,
          timestamp: '2024-01-15T10:30:00Z',
        },
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid timestamp', () => {
      const result = equitySnapshotPayloadSchema.safeParse({
        type: 'EQUITY_SNAPSHOT',
        snapshot: {
          balance: 10000,
          equity: 10500,
          timestamp: 'invalid',
        },
      });
      expect(result.success).toBe(false);
    });
  });

  describe('syncPayloadSchema', () => {
    it('validates trade update payload', () => {
      const result = syncPayloadSchema.safeParse({
        type: 'TRADE_UPDATE',
        trade: {
          ticket: '12345',
          symbol: 'EURUSD',
          type: 'BUY',
          volume: 0.1,
          entryTime: '2024-01-15T10:30:00Z',
        },
      });
      expect(result.success).toBe(true);
    });

    it('validates equity snapshot payload', () => {
      const result = syncPayloadSchema.safeParse({
        type: 'EQUITY_SNAPSHOT',
        snapshot: {
          balance: 10000,
          equity: 10500,
          timestamp: '2024-01-15T10:30:00Z',
        },
      });
      expect(result.success).toBe(true);
    });

    it('rejects unknown payload type', () => {
      const result = syncPayloadSchema.safeParse({
        type: 'UNKNOWN_TYPE',
        data: {},
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('formatZodErrors', () => {
  it('formats Zod errors correctly', () => {
    const result = registerSchema.safeParse({
      email: 'invalid',
      password: 'short',
    });
    
    if (!result.success) {
      const formatted = formatZodErrors(result.error);
      expect(Array.isArray(formatted)).toBe(true);
      expect(formatted.length).toBeGreaterThan(0);
      expect(formatted[0]).toHaveProperty('path');
      expect(formatted[0]).toHaveProperty('message');
      expect(formatted[0]).toHaveProperty('code');
    }
  });

  it('handles nested path correctly', () => {
    const result = tradeUpdatePayloadSchema.safeParse({
      type: 'TRADE_UPDATE',
      trade: {
        ticket: '',
        symbol: '',
        type: 'INVALID',
        volume: -1,
        entryTime: 'invalid',
      },
    });
    
    if (!result.success) {
      const formatted = formatZodErrors(result.error);
      const tradePath = formatted.find(f => f.path.startsWith('trade.'));
      expect(tradePath).toBeDefined();
    }
  });
});
