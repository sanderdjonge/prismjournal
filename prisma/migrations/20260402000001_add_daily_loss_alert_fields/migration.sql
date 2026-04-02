-- Add daily loss alert fields to TradingAccount
ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "dailyLossAlertThreshold" FLOAT;
ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "dailyLossAlertSentAt" TIMESTAMP(3);