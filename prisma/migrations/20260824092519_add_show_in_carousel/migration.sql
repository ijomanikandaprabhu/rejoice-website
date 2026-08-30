-- AlterTable
ALTER TABLE "YouTubeVideo" ADD COLUMN     "showInCarousel" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "YouTubeVideo_showInCarousel_idx" ON "YouTubeVideo"("showInCarousel");
