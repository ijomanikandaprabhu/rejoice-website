-- Resumable deep import.
--
-- Additive and nullable: every existing channel starts NULL, which reads as
-- "no import in progress" — the correct state for the five channels whose
-- catalogues are already fully imported.
ALTER TABLE "YouTubeChannel" ADD COLUMN "importCursor" TEXT;
