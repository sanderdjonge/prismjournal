-- Create all missing enum types
DO $$ BEGIN
    CREATE TYPE "AccountType" AS ENUM ('PROPFIRM', 'OWN_MONEY');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "TradeDirection" AS ENUM ('LONG', 'SHORT');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "TradeStatus" AS ENUM ('OPEN', 'CLOSED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "TradeSource" AS ENUM ('PAPER', 'LIVE', 'MANUAL');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "TradePlatform" AS ENUM ('TRADINGVIEW', 'METATRADER5', 'CTRADER', 'MANUAL');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "PlanCompliance" AS ENUM ('FOLLOWED', 'DEVIATED', 'PARTIAL');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Add bridge key fields to User table (moved from TradingAccount for multi-account support)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bridgeKeyId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bridgeKeyHash" TEXT;

-- Add all missing columns to TradingAccount
ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "balance" DOUBLE PRECISION;
ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "currentBalance" DOUBLE PRECISION;
ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "currentEquity" DOUBLE PRECISION;
ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "marginUsed" DOUBLE PRECISION;
ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "freeMargin" DOUBLE PRECISION;
ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "marginLevel" DOUBLE PRECISION;
ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "lastSyncTime" TIMESTAMP(3);
ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "maxDailyLoss" DOUBLE PRECISION;
ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "maxTotalDrawdown" DOUBLE PRECISION;
ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "profitTarget" DOUBLE PRECISION;
ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "maxPositionSize" DOUBLE PRECISION;
ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "scalingPlan" TEXT;
ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "currentPhase" TEXT DEFAULT 'Phase 1';
ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "lastDailyReset" TIMESTAMP(3);
ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "accountType" "AccountType" NOT NULL DEFAULT 'OWN_MONEY';

-- Add platform identification fields to TradingAccount (for multi-account routing)
ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "platform" "TradePlatform" NOT NULL DEFAULT 'METATRADER5';
ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "platformAccountId" TEXT;

-- Add missing columns to Trade
ALTER TABLE "Trade" ADD COLUMN IF NOT EXISTS "status" "TradeStatus" NOT NULL DEFAULT 'OPEN';
ALTER TABLE "Trade" ADD COLUMN IF NOT EXISTS "pnlPercent" DOUBLE PRECISION;
ALTER TABLE "Trade" ADD COLUMN IF NOT EXISTS "fees" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "Trade" ADD COLUMN IF NOT EXISTS "followedPlan" BOOLEAN;
ALTER TABLE "Trade" ADD COLUMN IF NOT EXISTS "setupType" TEXT;
ALTER TABLE "Trade" ADD COLUMN IF NOT EXISTS "entryReason" TEXT;
ALTER TABLE "Trade" ADD COLUMN IF NOT EXISTS "exitReason" TEXT;
ALTER TABLE "Trade" ADD COLUMN IF NOT EXISTS "lessonsLearned" TEXT;
ALTER TABLE "Trade" ADD COLUMN IF NOT EXISTS "externalId" TEXT;
ALTER TABLE "Trade" ADD COLUMN IF NOT EXISTS "direction" "TradeDirection";
ALTER TABLE "Trade" ADD COLUMN IF NOT EXISTS "source" "TradeSource" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "Trade" ADD COLUMN IF NOT EXISTS "platform" "TradePlatform" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "Trade" ADD COLUMN IF NOT EXISTS "planCompliance" "PlanCompliance";

-- Migrate existing bridge key data from TradingAccount to User
UPDATE "User" 
SET "bridgeKeyId" = ta."bridgeKeyId",
    "bridgeKeyHash" = ta."bridgeKeyHash"
FROM "TradingAccount" ta
WHERE "User"."id" = ta."userId"
  AND ta."bridgeKeyId" IS NOT NULL
  AND "User"."bridgeKeyId" IS NULL;

-- Set platformAccountId from accountNumber for existing MT5 accounts
UPDATE "TradingAccount" 
SET "platformAccountId" = "accountNumber"
WHERE "platformAccountId" IS NULL 
  AND "accountNumber" IS NOT NULL;

-- Create unique constraint on User.bridgeKeyId
CREATE UNIQUE INDEX IF NOT EXISTS "User_bridgeKeyId_key" ON "User"("bridgeKeyId");

-- Create unique constraint for multi-account routing
CREATE UNIQUE INDEX IF NOT EXISTS "TradingAccount_userId_platform_platformAccountId_key" 
  ON "TradingAccount"("userId", "platform", "platformAccountId");

-- Create indexes for Trade (using correct column name after rename)
CREATE INDEX IF NOT EXISTS "Trade_tradingAccountId_entryTime_idx" ON "Trade"("tradingAccountId", "entryTime");
CREATE INDEX IF NOT EXISTS "Trade_symbol_idx" ON "Trade"("symbol");
CREATE INDEX IF NOT EXISTS "Trade_status_idx" ON "Trade"("status");

-- Drop the old bridgeKey index from TradingAccount (no longer needed)
DROP INDEX IF EXISTS "TradingAccount_bridgeKey_key";
