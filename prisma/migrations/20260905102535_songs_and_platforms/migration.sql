-- Songs, their cover art, and where to hear them.
--
-- Purely additive: four new tables, nothing existing is touched. Images are
-- stored as bytes in MediaAsset because Vercel's filesystem is read-only at
-- runtime and a hosted blob service would be another metered account.
--
-- Covers are downscaled in the browser before upload, so a row here is roughly
-- 150KB rather than the several MB a 3000x3000 master would be.

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Platform" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Platform_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Song" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT,
    "releasedAt" TIMESTAMP(3),
    "description" TEXT,
    "coverId" TEXT NOT NULL,
    "thumbId" TEXT NOT NULL,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Song_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SongLink" (
    "id" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "url" TEXT NOT NULL,

    CONSTRAINT "SongLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Platform_name_key" ON "Platform"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Platform_slug_key" ON "Platform"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Platform_logoId_key" ON "Platform"("logoId");

-- CreateIndex
CREATE INDEX "Platform_isActive_sortOrder_idx" ON "Platform"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Song_slug_key" ON "Song"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Song_coverId_key" ON "Song"("coverId");

-- CreateIndex
CREATE UNIQUE INDEX "Song_thumbId_key" ON "Song"("thumbId");

-- CreateIndex
CREATE INDEX "Song_isVisible_releasedAt_idx" ON "Song"("isVisible", "releasedAt");

-- CreateIndex
CREATE INDEX "SongLink_songId_idx" ON "SongLink"("songId");

-- CreateIndex
CREATE UNIQUE INDEX "SongLink_songId_platformId_key" ON "SongLink"("songId", "platformId");

-- AddForeignKey
ALTER TABLE "Platform" ADD CONSTRAINT "Platform_logoId_fkey" FOREIGN KEY ("logoId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Song" ADD CONSTRAINT "Song_coverId_fkey" FOREIGN KEY ("coverId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Song" ADD CONSTRAINT "Song_thumbId_fkey" FOREIGN KEY ("thumbId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SongLink" ADD CONSTRAINT "SongLink_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SongLink" ADD CONSTRAINT "SongLink_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
