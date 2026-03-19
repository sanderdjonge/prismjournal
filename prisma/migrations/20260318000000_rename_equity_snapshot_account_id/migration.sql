-- Rename tradingAccountId to accountId in EquitySnapshot table
-- (the same rename was done for Trade in 20260315160000 but EquitySnapshot was missed)

ALTER TABLE "EquitySnapshot" RENAME COLUMN "tradingAccountId" TO "accountId";
