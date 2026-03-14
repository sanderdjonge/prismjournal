/**
 * Zod validation schemas for API routes
 * 
 * This module exports all validation schemas and utilities for consistent
 * input validation across the application.
 */

// Common validation utilities
export { formatZodErrors, validateBody, validateQueryParams, validateFormData } from './common';

// Trade validation
export {
  tradeCreateSchema,
  tradeUpdateSchema,
  tradeUploadSchema,
  uploadMetadataSchema,
  validateFileUpload,
  tradeTypeEnum,
  moodEnum,
  planComplianceEnum,
  timeframeEnum,
  ALLOWED_FILE_TYPES,
  MAX_FILE_SIZE,
  type TradeCreateInput,
  type TradeUpdateInput,
  type UploadMetadataInput,
} from './trade';

// Settings validation
export {
  settingsUpdateSchema,
  notificationSettingsSchema,
  testEmailSchema,
  type SettingsUpdateInput,
  type NotificationSettingsInput,
  type TestEmailInput,
} from './settings';

// Auth validation
export {
  registerSchema,
  loginSchema,
  type RegisterInput,
  type LoginInput,
} from './auth';

// Sync validation
export {
  syncPayloadSchema,
  tradeUpdatePayloadSchema,
  equitySnapshotPayloadSchema,
  syncTradeSchema,
  syncEquitySnapshotSchema,
  syncTradeTypeEnum,
  type SyncPayload,
  type TradeUpdatePayload,
  type EquitySnapshotPayload,
  type SyncTrade,
  type SyncEquitySnapshot,
} from './sync';
