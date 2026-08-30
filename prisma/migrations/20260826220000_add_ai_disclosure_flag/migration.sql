-- Adds the altered/synthetic-content disclosure flag alongside `isShort`.
--
-- It mirrors YouTube and is refreshed by the sync — it is not an administrator
-- override. The value comes from `status.containsSyntheticMedia`, which YouTube
-- returns ONLY when the uploader ticked the disclosure box in YouTube Studio.
-- A disclosure rather than detection: nothing in the Data API infers AI, so an
-- undisclosed AI video is indistinguishable from any other upload.
--
-- Defaults to false, so existing rows are correct until the next sync learns
-- their real value.
--
-- A companion `isLiveStream` column was trialled here and removed before this
-- shipped: the only live signal the API offers (`liveStreamingDetails`) is also
-- present on PREMIERES, and 62 of the catalogue's videos turned out to be
-- premiered music videos rather than live streams. YouTube exposes no field
-- that separates the two, so the flag could not be made to mean what its name
-- said.

-- AlterTable
ALTER TABLE "YouTubeVideo" ADD COLUMN IF NOT EXISTS "isAiDisclosed" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "YouTubeVideo_isAiDisclosed_idx" ON "YouTubeVideo"("isAiDisclosed");
