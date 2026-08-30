-- Drops the per-video short description.
--
-- It fed a two-line summary under the title on every public video card, falling
-- back to the first paragraph of the YouTube description when unset. In practice
-- 1 of 1,748 videos had a value, and that one was placeholder typing —
-- so nearly every card was showing the fallback, which on these channels is a
-- credit block ("Song : … Album : … Lyrics & Tune : …") rather than a summary.
--
-- The card no longer renders any description, so the column and its fallback
-- both go rather than leaving dead text on the site.

-- AlterTable
ALTER TABLE "YouTubeVideo" DROP COLUMN IF EXISTS "displayShortText";
