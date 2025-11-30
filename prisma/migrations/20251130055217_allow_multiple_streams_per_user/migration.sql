-- DropIndex
DROP INDEX "streams_streamerId_key";

-- AlterTable
ALTER TABLE "streams" ADD COLUMN     "endedAt" TIMESTAMP(3);
