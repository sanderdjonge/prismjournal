-- AlterTable: Add relatedTradeIds to Trade (skip if exists)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Trade' AND column_name = 'relatedTradeIds') THEN
        ALTER TABLE "Trade" ADD COLUMN "relatedTradeIds" text[] DEFAULT ARRAY[]::text[];
    END IF;
END $$;

-- AlterTable: Add Slack fields to AlertConfig (skip if exists)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'AlertConfig' AND column_name = 'slackWebhookUrl') THEN
        ALTER TABLE "AlertConfig" ADD COLUMN "slackWebhookUrl" text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'AlertConfig' AND column_name = 'enableSlack') THEN
        ALTER TABLE "AlertConfig" ADD COLUMN "enableSlack" boolean NOT NULL DEFAULT false;
    END IF;
END $$;

-- CreateTable: PushSubscription
CREATE TABLE IF NOT EXISTS "PushSubscription" (
    "id" text NOT NULL,
    "userId" text NOT NULL,
    "endpoint" text NOT NULL,
    "p256dh" text NOT NULL,
    "auth" text NOT NULL,
    "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (skip if exists)
CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_userId_endpoint_key" ON "PushSubscription"("userId", "endpoint");
CREATE INDEX IF NOT EXISTS "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PushSubscription_userId_fkey') THEN
        ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
