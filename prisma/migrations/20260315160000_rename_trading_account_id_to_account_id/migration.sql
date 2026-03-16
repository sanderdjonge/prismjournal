-- Rename tradingAccountId to accountId in Trade table
ALTER TABLE "Trade" RENAME COLUMN "tradingAccountId" TO "accountId";

-- Drop the old index
DROP INDEX IF EXISTS "Trade_tradingAccountId_idx";
DROP INDEX IF EXISTS "Trade_tradingAccountId_entryTime_idx";

-- Create new indexes with correct column name
CREATE INDEX "Trade_accountId_idx" ON "Trade"("accountId");
CREATE INDEX "Trade_accountId_entryTime_idx" ON "Trade"("accountId", "entryTime");
