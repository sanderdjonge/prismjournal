-- Migration: add_indexes_json_types
-- Phase 3: DL-2 (Json types) + DL-3 (composite indexes)

-- DL-2: Change PropFirm.phasesConfig from TEXT to JSONB
ALTER TABLE "PropFirm" ALTER COLUMN "phasesConfig" TYPE JSONB USING "phasesConfig"::jsonb;

-- DL-2: Change PropFirm.scalingConfig from TEXT to JSONB
ALTER TABLE "PropFirm" ALTER COLUMN "scalingConfig" TYPE JSONB USING CASE
  WHEN "scalingConfig" IS NULL THEN NULL
  ELSE "scalingConfig"::jsonb
END;

-- DL-2: Change AuditLog.details from TEXT to JSONB
ALTER TABLE "AuditLog" ALTER COLUMN "details" TYPE JSONB USING "details"::jsonb;

-- DL-3: Add composite indexes to Trade
CREATE INDEX IF NOT EXISTS "Trade_accountId_exitTime_pnl_idx" ON "Trade"("accountId", "exitTime", "pnl");
CREATE INDEX IF NOT EXISTS "Trade_accountId_status_exitTime_idx" ON "Trade"("accountId", "status", "exitTime");
