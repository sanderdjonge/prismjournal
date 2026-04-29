-- AddUserProfileFields
-- Add public profile and share fields to User table
-- These fields were previously only applied via db push

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'showPrismScoreOnShare') THEN
        ALTER TABLE "User" ADD COLUMN "showPrismScoreOnShare" boolean NOT NULL DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'publicProfileStats') THEN
        ALTER TABLE "User" ADD COLUMN "publicProfileStats" json;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'publicProfileId') THEN
        ALTER TABLE "User" ADD COLUMN "publicProfileId" text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'publicProfileEnabled') THEN
        ALTER TABLE "User" ADD COLUMN "publicProfileEnabled" boolean NOT NULL DEFAULT false;
    END IF;
END $$;

-- Add unique constraint for publicProfileId
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_publicProfileId_key') THEN
        ALTER TABLE "User" ADD CONSTRAINT "User_publicProfileId_key" UNIQUE ("publicProfileId");
    END IF;
END $$;
