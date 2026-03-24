-- Add brokerTimezoneOffset to UserSettings for correcting MT5 broker server time to UTC
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "brokerTimezoneOffset" INTEGER NOT NULL DEFAULT 0;
