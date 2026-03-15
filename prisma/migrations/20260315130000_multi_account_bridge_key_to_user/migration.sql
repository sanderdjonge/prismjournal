-- Phase 15 prep: platform-agnostic multi-account routing
-- Add bridge key fields to User (one bridge key per user, not per account)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bridgeKeyId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bridgeKeyHash" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_bridgeKeyId_key" ON "User"("bridgeKeyId");

-- Add platform routing fields to TradingAccount
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TradePlatform') THEN
        CREATE TYPE "TradePlatform" AS ENUM ('METATRADER5', 'TRADINGVIEW', 'MANUAL', 'CTRADER');
    END IF;
END $$;

ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "platform" "TradePlatform" NOT NULL DEFAULT 'METATRADER5';
ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "platformAccountId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "TradingAccount_userId_platform_platformAccountId_key"
    ON "TradingAccount"("userId", "platform", "platformAccountId");
