-- Add missing columns to TradingAccount that were in schema but not in migrations
ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "currentPhaseId" TEXT;
