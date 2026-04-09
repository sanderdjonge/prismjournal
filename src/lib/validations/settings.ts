import { z } from 'zod';

/**
 * Common timezone list (can be expanded)
 */
const commonTimezones = [
  'UTC',
  'Europe/Amsterdam',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Asia/Hong_Kong',
  'Australia/Sydney',
  'Pacific/Auckland',
] as const;

/**
 * Common currencies
 */
const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD'] as const;

/**
 * Date format options
 */
const dateFormats = ['DD-MM-YYYY', 'MM-DD-YYYY', 'YYYY-MM-DD'] as const;

const dashboardPeriods = ['7', '30', '90', '365'] as const;

export const settingsUpdateSchema = z.object({
  displayCurrency: z.enum(currencies).optional(),
  timezone: z.string().refine(
    (tz) => {
      try {
        return tz.length > 0 && (tz === 'UTC' || tz.includes('/'));
      } catch {
        return false;
      }
    },
    { message: 'Invalid timezone format' }
  ).optional(),
  dateFormat: z.enum(dateFormats).optional(),
  brokerTimezoneOffset: z.number().int().min(-12).max(14).optional(),
  dashboardPeriod: z.enum(dashboardPeriods).optional(),
});

export type SettingsUpdateInput = z.infer<typeof settingsUpdateSchema>;

/**
 * Schema for notification settings update (PATCH /api/settings/notifications)
 */
export const notificationSettingsSchema = z.object({
  enableSync: z.boolean().optional(),
  enableTrades: z.boolean().optional(),
  enableRisk: z.boolean().optional(),
  telegramId: z.string().max(100, 'Telegram ID too long').nullable().optional(),
  mddThreshold: z.number().min(0, 'MDD threshold must be positive').max(100, 'MDD threshold cannot exceed 100').nullable().optional(),
  email: z.string().email('Invalid email format').max(255, 'Email too long').nullable().optional(),
  enableWeeklyDigest: z.boolean().optional(),
  enableMddAlerts: z.boolean().optional(),
  digestFrequency: z.enum(['DAILY', 'WEEKLY']).optional(),
  digestSendHour: z.number().int().min(0).max(23).optional(),
  inAppToast: z.boolean().optional(),
});

export type NotificationSettingsInput = z.infer<typeof notificationSettingsSchema>;

/**
 * Schema for sending test email (POST /api/settings/notifications)
 */
export const testEmailSchema = z.object({
  email: z.string().email('Invalid email format').max(255, 'Email too long'),
});

export type TestEmailInput = z.infer<typeof testEmailSchema>;
