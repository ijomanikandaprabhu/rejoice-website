-- Who made the music, as a credit.
--
-- A NAME, not a file. "Ben Vin", the way a sleeve prints it — the track itself
-- stays on the streaming services `SongLink` points at. Nothing audible is
-- stored in this database, and nothing here should tempt anyone to try: covers
-- are already bytes in Postgres and full songs would be a different order of
-- size entirely.
--
-- Nullable, like `artist`: a song that only has a title still has to save.
ALTER TABLE "Song" ADD COLUMN     "music" TEXT;
