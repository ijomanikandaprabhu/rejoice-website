-- One analytics connection per channel.
--
-- A YouTube Analytics token is issued for ONE identity — `ids=channel==MINE`
-- resolves to whichever brand account signed in — so the single-row model
-- could only ever report on the channel that connected last.
--
-- `channelId` is NULLABLE on purpose. The channel a token belongs to cannot be
-- derived in SQL; it is identified by asking the Analytics API for the token's
-- top videos and matching them against the catalogue. The row that predates
-- this column therefore keeps working and is adopted by the service on its
-- next fetch, rather than being deleted and forcing a reconnect.
--
-- The unique index is what enforces one connection per channel.
ALTER TABLE "YouTubeOAuthToken" ADD COLUMN     "channelId" TEXT;

CREATE UNIQUE INDEX "YouTubeOAuthToken_channelId_key" ON "YouTubeOAuthToken"("channelId");

ALTER TABLE "YouTubeOAuthToken" ADD CONSTRAINT "YouTubeOAuthToken_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "YouTubeChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
