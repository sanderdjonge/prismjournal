-- Drop currentPhase string column from TradingAccount (replaced by challengePhases relation)
ALTER TABLE "TradingAccount" DROP COLUMN IF EXISTS "currentPhase";
