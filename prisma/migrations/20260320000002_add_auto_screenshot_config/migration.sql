-- Add autoScreenshotConfig JSON field to TradingAccount for auto chart screenshots configuration
ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "autoScreenshotConfig" JSONB;
