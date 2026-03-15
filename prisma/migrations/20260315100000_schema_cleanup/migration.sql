-- CreateEnum
CREATE TYPE "Mood" AS ENUM ('CALM', 'CONFIDENT', 'NEUTRAL', 'ANXIOUS', 'FOMO', 'REVENGE');

-- AlterTable: convert mood from text to Mood enum (clear invalid values first)
UPDATE "Trade" SET "mood" = NULL WHERE "mood" NOT IN ('CALM', 'CONFIDENT', 'NEUTRAL', 'ANXIOUS', 'FOMO', 'REVENGE');

ALTER TABLE "Trade"
  DROP COLUMN IF EXISTS "emotionalState",
  ALTER COLUMN "mood" TYPE "Mood" USING "mood"::"Mood";

-- CreateTable: Create CustomStat table if it doesn't exist (was missing from earlier migrations)
CREATE TABLE IF NOT EXISTS "CustomStat" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "filterConfig" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomStat_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CustomStat_userId_idx" ON "CustomStat"("userId");

ALTER TABLE "CustomStat" ADD CONSTRAINT "CustomStat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
