-- DropForeignKey
ALTER TABLE "episodes" DROP CONSTRAINT "episodes_seasonId_fkey";

-- AlterTable
ALTER TABLE "series" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
