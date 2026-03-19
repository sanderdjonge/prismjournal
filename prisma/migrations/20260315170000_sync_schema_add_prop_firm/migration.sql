-- Sync database schema with Prisma schema
-- Add missing columns to Trade table
ALTER TABLE "Trade" ADD COLUMN IF NOT EXISTS "lotSize" DOUBLE PRECISION;
ALTER TABLE "Trade" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Trade" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- Create Tag table if not exists
CREATE TABLE IF NOT EXISTS "Tag" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT DEFAULT '#00f2ff',
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Tag_userId_idx" ON "Tag"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "Tag_userId_name_key" ON "Tag"("userId", "name");

-- Create TradeTag table if not exists
CREATE TABLE IF NOT EXISTS "TradeTag" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    CONSTRAINT "TradeTag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TradeTag_tradeId_tagId_key" ON "TradeTag"("tradeId", "tagId");
CREATE INDEX IF NOT EXISTS "TradeTag_tradeId_idx" ON "TradeTag"("tradeId");
CREATE INDEX IF NOT EXISTS "TradeTag_tagId_idx" ON "TradeTag"("tagId");

-- Add foreign key constraints for Tag
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add foreign key constraints for TradeTag
ALTER TABLE "TradeTag" ADD CONSTRAINT "TradeTag_tradeId_fkey" 
    FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TradeTag" ADD CONSTRAINT "TradeTag_tagId_fkey" 
    FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- Phase 16: Prop Firm Tracking
-- ============================================

-- Create PropFirm table
CREATE TABLE IF NOT EXISTS "PropFirm" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "website" TEXT,
    "logoUrl" TEXT,
    "challengeType" TEXT NOT NULL DEFAULT 'TWO_PHASE',
    "dailyLossLimit" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "maxDrawdown" DOUBLE PRECISION NOT NULL DEFAULT 10.0,
    "drawdownType" TEXT NOT NULL DEFAULT 'STATIC',
    "allowNewsTrading" BOOLEAN DEFAULT true,
    "allowWeekendHolding" BOOLEAN DEFAULT true,
    "allowEA" BOOLEAN DEFAULT true,
    "phasesConfig" TEXT NOT NULL DEFAULT '[]',
    "hasScalingPlan" BOOLEAN DEFAULT false,
    "scalingConfig" TEXT,
    "isActive" BOOLEAN DEFAULT true,
    "popularity" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PropFirm_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PropFirm_name_key" ON "PropFirm"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "PropFirm_slug_key" ON "PropFirm"("slug");
CREATE INDEX IF NOT EXISTS "PropFirm_name_idx" ON "PropFirm"("name");
CREATE INDEX IF NOT EXISTS "PropFirm_slug_idx" ON "PropFirm"("slug");

-- Create ChallengePhase table
CREATE TABLE IF NOT EXISTS "ChallengePhase" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "phaseNumber" INTEGER NOT NULL,
    "phaseName" TEXT NOT NULL,
    "profitTarget" DOUBLE PRECISION,
    "profitTargetAmount" DOUBLE PRECISION,
    "dailyLossLimit" DOUBLE PRECISION NOT NULL,
    "maxDrawdown" DOUBLE PRECISION NOT NULL,
    "minTradingDays" INTEGER,
    "timeLimitDays" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "currentProgress" DOUBLE PRECISION,
    "currentDrawdown" DOUBLE PRECISION,
    "dailyPnl" DOUBLE PRECISION,
    "tradingDaysCount" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChallengePhase_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ChallengePhase_accountId_idx" ON "ChallengePhase"("accountId");
CREATE INDEX IF NOT EXISTS "ChallengePhase_status_idx" ON "ChallengePhase"("status");

-- Create RuleViolation table
CREATE TABLE IF NOT EXISTS "RuleViolation" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "phaseId" TEXT,
    "ruleType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "limitValue" DOUBLE PRECISION NOT NULL,
    "actualValue" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "tradeId" TEXT,
    "isResolved" BOOLEAN DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "occurredAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RuleViolation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RuleViolation_accountId_idx" ON "RuleViolation"("accountId");
CREATE INDEX IF NOT EXISTS "RuleViolation_ruleType_idx" ON "RuleViolation"("ruleType");
CREATE INDEX IF NOT EXISTS "RuleViolation_occurredAt_idx" ON "RuleViolation"("occurredAt");

-- Create DailyAccountSnapshot table
CREATE TABLE IF NOT EXISTS "DailyAccountSnapshot" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "snapshotDate" DATE NOT NULL,
    "startingBalance" DOUBLE PRECISION NOT NULL,
    "endingBalance" DOUBLE PRECISION NOT NULL,
    "endingEquity" DOUBLE PRECISION NOT NULL,
    "dailyPnl" DOUBLE PRECISION NOT NULL,
    "dailyPnlPercent" DOUBLE PRECISION NOT NULL,
    "currentDrawdown" DOUBLE PRECISION NOT NULL,
    "maxDrawdown" DOUBLE PRECISION NOT NULL,
    "highWaterMark" DOUBLE PRECISION NOT NULL,
    "dailyLossUsed" DOUBLE PRECISION NOT NULL,
    "isDailyLimitBreached" BOOLEAN DEFAULT false,
    "isMaxDrawdownBreached" BOOLEAN DEFAULT false,
    "profitProgress" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DailyAccountSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DailyAccountSnapshot_accountId_snapshotDate_key" ON "DailyAccountSnapshot"("accountId", "snapshotDate");
CREATE INDEX IF NOT EXISTS "DailyAccountSnapshot_accountId_snapshotDate_idx" ON "DailyAccountSnapshot"("accountId", "snapshotDate");

-- Add Prop Firm fields to TradingAccount
ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "propFirmId" TEXT;
ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "accountSize" DOUBLE PRECISION;
ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "profitSplit" DOUBLE PRECISION;
ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "allowNewsTrading" BOOLEAN;
ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "allowWeekendHolding" BOOLEAN;
ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "allowEA" BOOLEAN;

-- Add foreign key constraints
ALTER TABLE "ChallengePhase" ADD CONSTRAINT "ChallengePhase_accountId_fkey" 
    FOREIGN KEY ("accountId") REFERENCES "TradingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RuleViolation" ADD CONSTRAINT "RuleViolation_accountId_fkey" 
    FOREIGN KEY ("accountId") REFERENCES "TradingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RuleViolation" ADD CONSTRAINT "RuleViolation_phaseId_fkey" 
    FOREIGN KEY ("phaseId") REFERENCES "ChallengePhase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DailyAccountSnapshot" ADD CONSTRAINT "DailyAccountSnapshot_accountId_fkey" 
    FOREIGN KEY ("accountId") REFERENCES "TradingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TradingAccount" ADD CONSTRAINT "TradingAccount_propFirmId_fkey" 
    FOREIGN KEY ("propFirmId") REFERENCES "PropFirm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
