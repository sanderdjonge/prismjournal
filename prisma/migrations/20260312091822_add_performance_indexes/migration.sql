-- CreateIndex
CREATE INDEX "EquitySnapshot_accountId_timestamp_idx" ON "EquitySnapshot"("accountId", "timestamp");

-- CreateIndex
CREATE INDEX "Trade_accountId_idx" ON "Trade"("accountId");

-- CreateIndex
CREATE INDEX "Trade_accountId_entryTime_idx" ON "Trade"("accountId", "entryTime");

-- CreateIndex
CREATE INDEX "Trade_symbol_idx" ON "Trade"("symbol");
