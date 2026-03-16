-- The legacy "type" column in Trade is not part of the Prisma schema (replaced by "direction").
-- Make it nullable so prisma.trade.create() no longer fails with a null constraint violation.
ALTER TABLE "Trade" ALTER COLUMN "type" DROP NOT NULL;
