-- CreateTable
CREATE TABLE IF NOT EXISTS "PendingScreenshot" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "interval" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "entryPrice" DOUBLE PRECISION NOT NULL,
    "stopLoss" DOUBLE PRECISION,
    "takeProfit" DOUBLE PRECISION,
    "entryTime" TEXT,
    "exitTime" TEXT,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Amsterdam',
    "barsOfContext" INTEGER NOT NULL DEFAULT 25,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingScreenshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PendingScreenshot_scheduledFor_idx" ON "PendingScreenshot"("scheduledFor");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PendingScreenshot_tradeId_idx" ON "PendingScreenshot"("tradeId");

-- AddForeignKey (safe to re-run — skips if already exists)
DO $$ BEGIN
    ALTER TABLE "PendingScreenshot" ADD CONSTRAINT "PendingScreenshot_tradeId_fkey"
        FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
