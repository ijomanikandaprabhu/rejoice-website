-- One cover image per song instead of two.
--
-- Two were stored — 1200px for the song page, 400px for the grid — which is
-- about 175KB a song. The real catalogue is thousands of songs, and 5,000 of
-- those is ~854MB against a 512MB database. One 800px cover is ~70KB, which
-- brings the same catalogue to ~350MB.
--
-- The thumbs are deleted here, not merely orphaned. Leaving rows nothing
-- references would keep the space this change exists to reclaim.
DELETE FROM "MediaAsset"
WHERE id IN (SELECT "thumbId" FROM "Song");

DROP INDEX IF EXISTS "Song_thumbId_key";

ALTER TABLE "Song" DROP CONSTRAINT IF EXISTS "Song_thumbId_fkey";

ALTER TABLE "Song" DROP COLUMN "thumbId";
