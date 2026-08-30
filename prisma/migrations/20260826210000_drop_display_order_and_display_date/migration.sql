-- Drops manual ordering and the display-date override.
--
-- Ordering is date-based: every public list now sorts on `youtubePublishedAt`
-- descending and nothing else. `displayOrder` was a manual key that ran BEFORE
-- the date, and every row sat at the default 0, so it never moved anything.
--
-- `displayPublishedAt` overrode the date SHOWN on a card but no query ever
-- sorted on it, so a video could read one date and sit at another date's
-- position. With ordering settled as date-based, the honest fix is for the
-- YouTube upload date to be the only date.
--
-- Channels keep their order: `displayOrder` there was assigned as an
-- incrementing count at connect time, so `createdAt` ascending reproduces the
-- existing order exactly.

-- DropIndex
DROP INDEX IF EXISTS "YouTubeChannel_isActive_displayOrder_idx";
DROP INDEX IF EXISTS "YouTubeVideo_isVisible_displayOrder_idx";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "YouTubeChannel_isActive_idx" ON "YouTubeChannel"("isActive");

-- AlterTable
ALTER TABLE "YouTubeChannel" DROP COLUMN IF EXISTS "displayOrder";
ALTER TABLE "YouTubeVideo" DROP COLUMN IF EXISTS "displayOrder";
ALTER TABLE "YouTubeVideo" DROP COLUMN IF EXISTS "displayPublishedAt";
