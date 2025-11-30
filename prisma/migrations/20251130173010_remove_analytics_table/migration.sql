/*
  Warnings:

  - You are about to drop the `analytics` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "analytics" DROP CONSTRAINT "analytics_streamerId_fkey";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "monedasRecibidas" INTEGER DEFAULT 0;

-- DropTable
DROP TABLE "analytics";
