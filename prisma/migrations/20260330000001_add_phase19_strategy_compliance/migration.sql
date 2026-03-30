-- CreateEnum
CREATE TYPE "StrategyRuleType" AS ENUM (
  'MAX_DAILY_LOSS',
  'MAX_DAILY_TRADES',
  'MIN_RR_RATIO',
  'ALLOWED_TIME_WINDOWS',
  'ALLOWED_SYMBOLS',
  'MAX_POSITION_SIZE',
  'NO_OVERTRADING',
  'MANDATORY_STOP_LOSS',
  'MAX_HOLDING_TIME',
  'MIN_HOLDING_TIME'
);

-- AlterTable: add rules JSON field to Strategy
ALTER TABLE "Strategy" ADD COLUMN "rules" JSONB;

-- CreateTable: StrategyViolation
CREATE TABLE "StrategyViolation" (
  "id"          TEXT NOT NULL,
  "strategyId"  TEXT NOT NULL,
  "tradeId"     TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "accountId"   TEXT NOT NULL,
  "ruleId"      TEXT NOT NULL,
  "ruleType"    "StrategyRuleType" NOT NULL,
  "limitValue"  DOUBLE PRECISION NOT NULL,
  "actualValue" DOUBLE PRECISION NOT NULL,
  "pnlImpact"   DOUBLE PRECISION,
  "occurredAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StrategyViolation_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TiltmeterSnapshot
CREATE TABLE "TiltmeterSnapshot" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "accountId"   TEXT,
  "score"       DOUBLE PRECISION NOT NULL,
  "components"  JSONB NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd"   TIMESTAMP(3) NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TiltmeterSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StrategyViolation_strategyId_idx" ON "StrategyViolation"("strategyId");
CREATE INDEX "StrategyViolation_userId_idx" ON "StrategyViolation"("userId");
CREATE INDEX "StrategyViolation_accountId_idx" ON "StrategyViolation"("accountId");
CREATE INDEX "StrategyViolation_ruleType_idx" ON "StrategyViolation"("ruleType");
CREATE INDEX "StrategyViolation_occurredAt_idx" ON "StrategyViolation"("occurredAt");
CREATE INDEX "TiltmeterSnapshot_userId_idx" ON "TiltmeterSnapshot"("userId");
CREATE INDEX "TiltmeterSnapshot_accountId_idx" ON "TiltmeterSnapshot"("accountId");
CREATE INDEX "TiltmeterSnapshot_periodStart_periodEnd_idx" ON "TiltmeterSnapshot"("periodStart", "periodEnd");

-- AddForeignKey
ALTER TABLE "StrategyViolation" ADD CONSTRAINT "StrategyViolation_strategyId_fkey"
  FOREIGN KEY ("strategyId") REFERENCES "Strategy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
