-- Add bridge key hash fields for secure bridge key storage
-- bridgeKeyId: first 12 chars of key, plain text, used for fast lookup
-- bridgeKeyHash: bcrypt hash of the full key
-- bridgeKey: kept for backwards compatibility with existing accounts (deprecated)

ALTER TABLE "TradingAccount" ADD COLUMN "bridgeKeyId" TEXT;
ALTER TABLE "TradingAccount" ADD COLUMN "bridgeKeyHash" TEXT;

CREATE UNIQUE INDEX "TradingAccount_bridgeKeyId_key" ON "TradingAccount"("bridgeKeyId");
