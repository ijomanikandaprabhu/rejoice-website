-- DropForeignKey
ALTER TABLE "YouTubeVideo" DROP CONSTRAINT "YouTubeVideo_categoryId_fkey";

-- DropIndex
DROP INDEX "YouTubeVideo_categoryId_idx";

-- AlterTable
ALTER TABLE "YouTubeVideo" DROP COLUMN "categoryId";

-- DropTable
DROP TABLE "VideoCategory";

-- CreateIndex
CREATE UNIQUE INDEX "YouTubeChannel_handle_key" ON "YouTubeChannel"("handle");

