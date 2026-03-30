-- Phase 20: Pre-Trade Notes
CREATE TYPE "PreTradeNoteStatus" AS ENUM ('PENDING', 'LINKED', 'NOT_RELEVANT', 'EXPIRED');

CREATE TABLE "PreTradeNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT,
    "symbol" TEXT NOT NULL,
    "direction" "TradeDirection" NOT NULL,
    "body" TEXT NOT NULL,
    "plannedEntry" DOUBLE PRECISION,
    "status" "PreTradeNoteStatus" NOT NULL DEFAULT 'PENDING',
    "tradeId" TEXT,
    "linkedAt" TIMESTAMP(3),
    "checklistStatus" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreTradeNote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PreTradeNote_tradeId_key" ON "PreTradeNote"("tradeId");
CREATE INDEX "PreTradeNote_userId_createdAt_idx" ON "PreTradeNote"("userId", "createdAt");
CREATE INDEX "PreTradeNote_userId_status_idx" ON "PreTradeNote"("userId", "status");
CREATE INDEX "PreTradeNote_tradeId_idx" ON "PreTradeNote"("tradeId");
CREATE INDEX "PreTradeNote_symbol_direction_idx" ON "PreTradeNote"("symbol", "direction");

-- Phase 20: Setup Checklist on Strategy
ALTER TABLE "Strategy" ADD COLUMN "setupChecklist" JSONB;

-- Phase 20: Checklist Completion tracking
CREATE TABLE "ChecklistCompletion" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "strategyId" TEXT NOT NULL,
    "checklist" JSONB NOT NULL,
    "totalItems" INTEGER NOT NULL,
    "checkedItems" INTEGER NOT NULL,
    "completionPct" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistCompletion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChecklistCompletion_tradeId_key" ON "ChecklistCompletion"("tradeId");
CREATE INDEX "ChecklistCompletion_strategyId_idx" ON "ChecklistCompletion"("strategyId");
CREATE INDEX "ChecklistCompletion_completionPct_idx" ON "ChecklistCompletion"("completionPct");

-- Phase 21b: Economic Events
CREATE TYPE "EconomicEventImpact" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

CREATE TABLE "EconomicEvent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "time" TEXT,
    "currency" TEXT NOT NULL,
    "impact" "EconomicEventImpact" NOT NULL DEFAULT 'MEDIUM',
    "forecast" TEXT,
    "actual" TEXT,
    "previous" TEXT,
    "source" TEXT,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EconomicEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EconomicEvent_externalId_key" ON "EconomicEvent"("externalId");
CREATE INDEX "EconomicEvent_date_idx" ON "EconomicEvent"("date");
CREATE INDEX "EconomicEvent_currency_idx" ON "EconomicEvent"("currency");
CREATE INDEX "EconomicEvent_impact_idx" ON "EconomicEvent"("impact");

-- Phase 22: Trading Challenges
CREATE TYPE "ChallengeScope" AS ENUM ('GLOBAL', 'PER_ACCOUNT');

CREATE TABLE "TradingChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scope" "ChallengeScope" NOT NULL DEFAULT 'GLOBAL',
    "rules" JSONB NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "daysPassed" INTEGER NOT NULL DEFAULT 0,
    "daysFailed" INTEGER NOT NULL DEFAULT 0,
    "totalDays" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradingChallenge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TradingChallenge_userId_isActive_idx" ON "TradingChallenge"("userId", "isActive");
CREATE INDEX "TradingChallenge_accountId_idx" ON "TradingChallenge"("accountId");
CREATE INDEX "TradingChallenge_startDate_idx" ON "TradingChallenge"("startDate");

-- Phase 22: Challenge Evaluations
CREATE TABLE "ChallengeEvaluation" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "failureReasons" JSONB,
    "tradeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChallengeEvaluation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChallengeEvaluation_challengeId_date_key" ON "ChallengeEvaluation"("challengeId", "date");
CREATE INDEX "ChallengeEvaluation_challengeId_date_idx" ON "ChallengeEvaluation"("challengeId", "date");
CREATE INDEX "ChallengeEvaluation_passed_idx" ON "ChallengeEvaluation"("passed");

-- Add foreign key constraints
ALTER TABLE "PreTradeNote" ADD CONSTRAINT "PreTradeNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PreTradeNote" ADD CONSTRAINT "PreTradeNote_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "TradingAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PreTradeNote" ADD CONSTRAINT "PreTradeNote_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ChecklistCompletion" ADD CONSTRAINT "ChecklistCompletion_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChecklistCompletion" ADD CONSTRAINT "ChecklistCompletion_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "Strategy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TradingChallenge" ADD CONSTRAINT "TradingChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TradingChallenge" ADD CONSTRAINT "TradingChallenge_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "TradingAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ChallengeEvaluation" ADD CONSTRAINT "ChallengeEvaluation_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "TradingChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;