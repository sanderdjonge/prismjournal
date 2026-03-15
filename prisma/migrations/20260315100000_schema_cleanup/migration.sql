-- CreateEnum
CREATE TYPE "Mood" AS ENUM ('CALM', 'CONFIDENT', 'NEUTRAL', 'ANXIOUS', 'FOMO', 'REVENGE');

-- AlterTable: convert mood from text to Mood enum (clear invalid values first)
UPDATE "Trade" SET "mood" = NULL WHERE "mood" NOT IN ('CALM', 'CONFIDENT', 'NEUTRAL', 'ANXIOUS', 'FOMO', 'REVENGE');

ALTER TABLE "Trade"
  DROP COLUMN IF EXISTS "emotionalState",
  ALTER COLUMN "mood" TYPE "Mood" USING "mood"::"Mood";

-- AlterTable: convert filterConfig from text to jsonb
ALTER TABLE "CustomStat"
  ALTER COLUMN "filterConfig" TYPE JSONB USING "filterConfig"::JSONB;
