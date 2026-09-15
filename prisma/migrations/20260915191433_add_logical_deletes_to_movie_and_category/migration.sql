-- AlterTable
ALTER TABLE "Category" ADD COLUMN "deletedAt" DATETIME;

-- AlterTable
ALTER TABLE "Movie" ADD COLUMN "deletedAt" DATETIME;
