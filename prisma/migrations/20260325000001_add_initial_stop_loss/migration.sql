-- AlterTable: add initialStopLoss and beTriggered to Trade
ALTER TABLE "Trade" ADD COLUMN "initialStopLoss" DOUBLE PRECISION;
ALTER TABLE "Trade" ADD COLUMN "beTriggered" BOOLEAN NOT NULL DEFAULT false;
