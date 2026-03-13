-- AlterTable
ALTER TABLE "AlertConfig" ADD COLUMN     "email" TEXT,
ADD COLUMN     "enableMddAlerts" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "enableWeeklyDigest" BOOLEAN NOT NULL DEFAULT false;
