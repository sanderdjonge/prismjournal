-- Add digest frequency and send hour preferences to AlertConfig
ALTER TABLE "AlertConfig" ADD COLUMN IF NOT EXISTS "digestFrequency" TEXT NOT NULL DEFAULT 'WEEKLY';
ALTER TABLE "AlertConfig" ADD COLUMN IF NOT EXISTS "digestSendHour" INTEGER NOT NULL DEFAULT 9;
