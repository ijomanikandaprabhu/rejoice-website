-- Drops the two per-video publishing flags.
--
-- `isFeatured` was never read by the public site: `getFeaturedVideos` existed
-- but nothing ever imported it, so the star in the admin only moved a count on
-- the dashboard.
--
-- `showOnHomepage` did work — it filled the homepage's "Selected" section — but
-- that section has been removed along with it, so the column has no reader
-- left either. Hand-picking for the front page is gone; the Channels carousel
-- is unaffected, being driven by the ordered `carousel` SiteSetting.
--
-- Verified before writing this: zero rows had isFeatured = true and zero had
-- showOnHomepage = true, so nothing is lost.

-- DropIndex
DROP INDEX IF EXISTS "YouTubeVideo_isFeatured_idx";
DROP INDEX IF EXISTS "YouTubeVideo_showOnHomepage_idx";

-- AlterTable
ALTER TABLE "YouTubeVideo" DROP COLUMN IF EXISTS "isFeatured";
ALTER TABLE "YouTubeVideo" DROP COLUMN IF EXISTS "showOnHomepage";
