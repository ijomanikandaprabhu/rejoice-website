-- CreateEnum
CREATE TYPE "VideoVisibilityDefault" AS ENUM ('AUTO_SHOW', 'REVIEW_FIRST');

-- CreateEnum
CREATE TYPE "EnquiryStatus" AS ENUM ('NEW', 'READ', 'RESOLVED');

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YouTubeChannel" (
    "id" TEXT NOT NULL,
    "youtubeChannelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "handle" TEXT,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "thumbnail" TEXT,
    "uploadsPlaylistId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "defaultVideoVisibility" "VideoVisibilityDefault" NOT NULL DEFAULT 'REVIEW_FIRST',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YouTubeChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YouTubeVideo" (
    "id" TEXT NOT NULL,
    "youtubeVideoId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "youtubeTitle" TEXT NOT NULL,
    "youtubeDescription" TEXT NOT NULL DEFAULT '',
    "youtubeThumbnail" TEXT,
    "youtubePublishedAt" TIMESTAMP(3) NOT NULL,
    "youtubeUrl" TEXT NOT NULL,
    "durationSeconds" INTEGER,
    "displayTitle" TEXT,
    "displayDescription" TEXT,
    "displayShortText" TEXT,
    "displayThumbnail" TEXT,
    "displayPublishedAt" TIMESTAMP(3),
    "buttonLabel" TEXT,
    "showChannelName" BOOLEAN NOT NULL DEFAULT true,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "categoryId" TEXT,
    "isVisible" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "showOnHomepage" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YouTubeVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteContent" (
    "id" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebsiteContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "image" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enquiry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "status" "EnquiryStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Enquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "YouTubeChannel_youtubeChannelId_key" ON "YouTubeChannel"("youtubeChannelId");

-- CreateIndex
CREATE INDEX "YouTubeChannel_isActive_displayOrder_idx" ON "YouTubeChannel"("isActive", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "VideoCategory_name_key" ON "VideoCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "VideoCategory_slug_key" ON "VideoCategory"("slug");

-- CreateIndex
CREATE INDEX "VideoCategory_isVisible_displayOrder_idx" ON "VideoCategory"("isVisible", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "YouTubeVideo_youtubeVideoId_key" ON "YouTubeVideo"("youtubeVideoId");

-- CreateIndex
CREATE INDEX "YouTubeVideo_isVisible_displayOrder_idx" ON "YouTubeVideo"("isVisible", "displayOrder");

-- CreateIndex
CREATE INDEX "YouTubeVideo_isVisible_youtubePublishedAt_idx" ON "YouTubeVideo"("isVisible", "youtubePublishedAt");

-- CreateIndex
CREATE INDEX "YouTubeVideo_channelId_idx" ON "YouTubeVideo"("channelId");

-- CreateIndex
CREATE INDEX "YouTubeVideo_categoryId_idx" ON "YouTubeVideo"("categoryId");

-- CreateIndex
CREATE INDEX "YouTubeVideo_isFeatured_idx" ON "YouTubeVideo"("isFeatured");

-- CreateIndex
CREATE INDEX "YouTubeVideo_showOnHomepage_idx" ON "YouTubeVideo"("showOnHomepage");

-- CreateIndex
CREATE INDEX "WebsiteContent_page_idx" ON "WebsiteContent"("page");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteContent_page_key_key" ON "WebsiteContent"("page", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Service_slug_key" ON "Service"("slug");

-- CreateIndex
CREATE INDEX "Service_isVisible_displayOrder_idx" ON "Service"("isVisible", "displayOrder");

-- CreateIndex
CREATE INDEX "Enquiry_status_createdAt_idx" ON "Enquiry"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "YouTubeVideo" ADD CONSTRAINT "YouTubeVideo_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "YouTubeChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YouTubeVideo" ADD CONSTRAINT "YouTubeVideo_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "VideoCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
