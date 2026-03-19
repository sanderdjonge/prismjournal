-- Add dateFormat column to UserSettings (was in schema but never migrated)
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "dateFormat" TEXT NOT NULL DEFAULT 'DD-MM-YYYY';
