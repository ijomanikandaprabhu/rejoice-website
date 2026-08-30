-- Reverses 20260824092519_add_show_in_carousel.
--
-- The carousel is now driven by an ordered list of video ids in the `carousel`
-- SiteSetting, which the boolean cannot express. Verified before writing this:
-- zero rows had showInCarousel = true, so nothing is lost.

-- DropIndex
DROP INDEX IF EXISTS "YouTubeVideo_showInCarousel_idx";

-- AlterTable
ALTER TABLE "YouTubeVideo" DROP COLUMN IF EXISTS "showInCarousel";
