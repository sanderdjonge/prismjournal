-- Add tokenId column to PasswordResetToken for efficient lookup
-- tokenId is the first 8 chars of the raw token, stored in plain text for O(1) index lookup
ALTER TABLE "PasswordResetToken" ADD COLUMN IF NOT EXISTS "tokenId" TEXT;
ALTER TABLE "PasswordResetToken" ADD COLUMN IF NOT EXISTS "usedAt" TIMESTAMP(3);

-- Add unique constraint on tokenId (ignore if already exists)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PasswordResetToken_tokenId_key'
  ) THEN
    ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_tokenId_key" UNIQUE ("tokenId");
  END IF;
END $$;

-- Add unique constraint on token hash (ignore if already exists)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PasswordResetToken_token_key'
  ) THEN
    ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_token_key" UNIQUE ("token");
  END IF;
END $$;

-- Index on userId
CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");
