-- Drops the per-video button label.
--
-- The public video page renders "<label> on YouTube", with `buttonLabel`
-- supplying the first word and falling back to "Watch". In practice nobody ever
-- set it: 0 of 1,748 videos carried a value, so every button on the site already
-- read "Watch on YouTube".
--
-- The button text is now fixed in the page rather than editable, so nothing
-- changes for a visitor.

-- AlterTable
ALTER TABLE "YouTubeVideo" DROP COLUMN IF EXISTS "buttonLabel";
