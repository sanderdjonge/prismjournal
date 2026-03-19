-- Migration: add_indexes_json_types
-- Phase 3: DL-2 (Json types) + DL-3 (composite indexes)

-- DL-2: Change PropFirm.phasesConfig from TEXT to JSONB (skip if already JSONB)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PropFirm' AND column_name = 'phasesConfig' AND data_type = 'text'
  ) THEN
    ALTER TABLE "PropFirm" ALTER COLUMN "phasesConfig" TYPE JSONB USING
      CASE WHEN "phasesConfig" IS NULL OR trim("phasesConfig") = '' THEN NULL
           ELSE "phasesConfig"::jsonb END;
  END IF;
END $$;

-- DL-2: Change PropFirm.scalingConfig from TEXT to JSONB (skip if already JSONB)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PropFirm' AND column_name = 'scalingConfig' AND data_type = 'text'
  ) THEN
    ALTER TABLE "PropFirm" ALTER COLUMN "scalingConfig" TYPE JSONB USING
      CASE WHEN "scalingConfig" IS NULL OR trim("scalingConfig") = '' THEN NULL
           ELSE "scalingConfig"::jsonb END;
  END IF;
END $$;

-- DL-2: Change AuditLog.details from TEXT to JSONB (skip if table or column missing)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'AuditLog' AND column_name = 'details' AND data_type = 'text'
  ) THEN
    ALTER TABLE "AuditLog" ALTER COLUMN "details" TYPE JSONB USING
      CASE WHEN "details" IS NULL OR trim("details") = '' THEN NULL
           ELSE "details"::jsonb END;
  END IF;
END $$;

-- DL-3: Add composite indexes to Trade
CREATE INDEX IF NOT EXISTS "Trade_accountId_exitTime_pnl_idx" ON "Trade"("accountId", "exitTime", "pnl");
CREATE INDEX IF NOT EXISTS "Trade_accountId_status_exitTime_idx" ON "Trade"("accountId", "status", "exitTime");
