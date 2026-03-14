-- AlterTable
ALTER TABLE "Media" DROP COLUMN "url",
ADD COLUMN "filename" TEXT NOT NULL DEFAULT '',
ADD COLUMN "filepath" TEXT NOT NULL DEFAULT '',
ADD COLUMN "mimetype" TEXT NOT NULL DEFAULT 'image/png',
ADD COLUMN "size" INTEGER NOT NULL DEFAULT 0;

-- Update existing records with placeholder values (they will need to be re-uploaded)
-- Note: Existing screenshots stored as base64 will be lost and need to be re-uploaded
