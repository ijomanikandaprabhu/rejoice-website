-- AlterTable
ALTER TABLE "YouTubeVideo" ADD COLUMN     "isShort" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "YouTubeVideo_isShort_idx" ON "YouTubeVideo"("isShort");
