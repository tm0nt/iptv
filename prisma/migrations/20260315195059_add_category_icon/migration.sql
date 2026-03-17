-- DropForeignKey
ALTER TABLE "channels" DROP CONSTRAINT "channels_categoryId_fkey";

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "icon" TEXT;

-- AlterTable
ALTER TABLE "channels" ADD COLUMN     "groupTitle" TEXT,
ALTER COLUMN "categoryId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "channels_name_idx" ON "channels"("name");

-- CreateIndex
CREATE INDEX "channels_categoryId_idx" ON "channels"("categoryId");

-- CreateIndex
CREATE INDEX "channels_active_idx" ON "channels"("active");

-- CreateIndex
CREATE INDEX "channels_groupTitle_idx" ON "channels"("groupTitle");

-- AddForeignKey
ALTER TABLE "channels" ADD CONSTRAINT "channels_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
