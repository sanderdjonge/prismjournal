-- Rename Account table to TradingAccount
ALTER TABLE "Account" RENAME TO "TradingAccount";

-- Add missing columns for TradingAccount that exist in Prisma schema
ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "accountType" TEXT;
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
ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "currentPhase" TEXT;
ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "lastDailyReset" TIMESTAMP(3);
ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Make broker and accountNumber nullable (to match schema)
ALTER TABLE "TradingAccount" ALTER COLUMN "broker" DROP NOT NULL;
ALTER TABLE "TradingAccount" ALTER COLUMN "accountNumber" DROP NOT NULL;
ALTER TABLE "TradingAccount" ALTER COLUMN "bridgeKey" DROP NOT NULL;

-- Add unique constraint for accountNumber
CREATE UNIQUE INDEX IF NOT EXISTS "TradingAccount_accountNumber_key" ON "TradingAccount"("accountNumber");

-- Drop old indexes that reference Account
DROP INDEX IF EXISTS "Account_bridgeKey_key";

-- Create new indexes for TradingAccount
CREATE UNIQUE INDEX IF NOT EXISTS "TradingAccount_bridgeKey_key" ON "TradingAccount"("bridgeKey");

-- First drop the foreign key constraints from child tables
ALTER TABLE "Trade" DROP CONSTRAINT IF EXISTS "Trade_accountId_fkey";
ALTER TABLE "EquitySnapshot" DROP CONSTRAINT IF EXISTS "EquitySnapshot_accountId_fkey";

-- Rename the foreign key column in Trade table
ALTER TABLE "Trade" RENAME COLUMN "accountId" TO "tradingAccountId";

-- Rename the foreign key column in EquitySnapshot table
ALTER TABLE "EquitySnapshot" RENAME COLUMN "accountId" TO "tradingAccountId";

-- Recreate foreign key constraints with new names
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_tradingAccountId_fkey" 
  FOREIGN KEY ("tradingAccountId") REFERENCES "TradingAccount"("id") 
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EquitySnapshot" ADD CONSTRAINT "EquitySnapshot_tradingAccountId_fkey" 
  FOREIGN KEY ("tradingAccountId") REFERENCES "TradingAccount"("id") 
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Drop old indexes on Trade table
DROP INDEX IF EXISTS "Trade_accountId_entryTime_idx";
DROP INDEX IF EXISTS "Trade_accountId_idx";

-- Create new indexes with correct column name
CREATE INDEX IF NOT EXISTS "Trade_tradingAccountId_entryTime_idx" ON "Trade"("tradingAccountId", "entryTime");
CREATE INDEX IF NOT EXISTS "Trade_tradingAccountId_idx" ON "Trade"("tradingAccountId");
