-- AlterTable
ALTER TABLE "YouTubeChannel" ADD COLUMN     "channelViewCount" BIGINT,
ADD COLUMN     "subscriberCount" INTEGER,
ADD COLUMN     "videoCount" INTEGER;

-- AlterTable
ALTER TABLE "YouTubeVideo" ADD COLUMN     "commentCount" INTEGER,
ADD COLUMN     "likeCount" INTEGER,
ADD COLUMN     "statsSyncedAt" TIMESTAMP(3),
ADD COLUMN     "viewCount" INTEGER;

-- CreateTable
CREATE TABLE "ChannelStatDaily" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "views" BIGINT NOT NULL,
    "subscribers" INTEGER NOT NULL,
    "videos" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelStatDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YouTubeOAuthToken" (
    "id" TEXT NOT NULL,
    "googleAccountEmail" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "accessToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "scopes" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YouTubeOAuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChannelStatDaily_date_idx" ON "ChannelStatDaily"("date");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelStatDaily_channelId_date_key" ON "ChannelStatDaily"("channelId", "date");

-- CreateIndex
CREATE INDEX "YouTubeVideo_statsSyncedAt_idx" ON "YouTubeVideo"("statsSyncedAt");

-- CreateIndex
CREATE INDEX "YouTubeVideo_viewCount_idx" ON "YouTubeVideo"("viewCount");

-- AddForeignKey
ALTER TABLE "ChannelStatDaily" ADD CONSTRAINT "ChannelStatDaily_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "YouTubeChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
