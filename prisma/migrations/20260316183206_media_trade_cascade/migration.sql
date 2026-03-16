-- AlterTable: add onDelete Cascade to Media → Trade foreign key
ALTER TABLE "Media" DROP CONSTRAINT "Media_tradeId_fkey";
ALTER TABLE "Media" ADD CONSTRAINT "Media_tradeId_fkey"
  FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
