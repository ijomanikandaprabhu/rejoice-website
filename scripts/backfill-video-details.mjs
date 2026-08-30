/**
 * One-off backfill for `durationSeconds` and `isShort`.
 *
 * Videos imported before the sync learned to fetch them were stored with a null
 * duration and the default `isShort: false`, because `playlistItems` reports
 * neither. This walks the existing catalogue and fills both in from the
 * `videos` endpoint.
 *
 *   node scripts/backfill-video-details.mjs
 *   node scripts/backfill-video-details.mjs --all   (re-check everything)
 *
 * Safe to re-run and safe to interrupt: it commits each batch as it goes and by
 * default only looks at rows that still have no duration, so a second run picks
 * up wherever the first stopped. It writes ONLY these two mirror fields — no
 * visibility, category or display override is touched.
 */

import { PrismaClient } from '@prisma/client';

const API = 'https://www.googleapis.com/youtube/v3/videos';
const BATCH = 50;
/** Only needed so YouTube populates the embed dimensions at all. */
const EMBED_PROBE_WIDTH = 480;

const prisma = new PrismaClient();

function readEnvKey() {
  if (process.env.YOUTUBE_API_KEY) return process.env.YOUTUBE_API_KEY.trim();
  return null;
}

/** ISO-8601 duration (PT4M13S) -> seconds. Mirrors parseIsoDuration in the app. */
function parseIsoDuration(iso) {
  if (!iso) return null;
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return null;
  const [, d, h, min, s] = m;
  return Number(d ?? 0) * 86400 + Number(h ?? 0) * 3600 + Number(min ?? 0) * 60 + Number(s ?? 0);
}

/** Shape, not length — see isVertical() in src/services/youtube/youtubeClient.ts. */
function isVertical(player) {
  const w = Number(player?.embedWidth);
  const h = Number(player?.embedHeight);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return false;
  return h > w;
}

async function fetchBatch(ids, key) {
  const url = new URL(API);
  url.searchParams.set('part', 'contentDetails,player');
  url.searchParams.set('id', ids.join(','));
  url.searchParams.set('maxWidth', String(EMBED_PROBE_WIDTH));
  url.searchParams.set('key', key);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`YouTube API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return (await res.json()).items ?? [];
}

async function main() {
  const key = readEnvKey();
  if (!key) {
    console.error('YOUTUBE_API_KEY is not set. Load .env before running this.');
    process.exit(1);
  }

  const all = process.argv.includes('--all');
  const videos = await prisma.youTubeVideo.findMany({
    where: all ? {} : { durationSeconds: null },
    select: { youtubeVideoId: true },
  });

  if (videos.length === 0) {
    console.log('Nothing to backfill — every video already has a duration.');
    return;
  }

  const batches = Math.ceil(videos.length / BATCH);
  console.log(`Backfilling ${videos.length} videos in ${batches} request(s)…`);

  let updated = 0;
  let shorts = 0;
  let missing = 0;

  for (let i = 0; i < videos.length; i += BATCH) {
    const ids = videos.slice(i, i + BATCH).map((v) => v.youtubeVideoId);
    const items = await fetchBatch(ids, key);

    // A video deleted or made private since import simply is not returned.
    const returned = new Set(items.map((item) => item.id));
    missing += ids.filter((id) => !returned.has(id)).length;

    for (const item of items) {
      const short = isVertical(item.player);
      if (short) shorts++;
      await prisma.youTubeVideo.update({
        where: { youtubeVideoId: item.id },
        data: {
          durationSeconds: parseIsoDuration(item.contentDetails?.duration),
          isShort: short,
        },
      });
      updated++;
    }

    console.log(`  ${Math.min(i + BATCH, videos.length)}/${videos.length}`);
  }

  console.log(`\nDone. ${updated} updated, ${shorts} identified as Shorts.`);
  if (missing > 0) {
    console.log(`${missing} were not returned by YouTube (deleted or made private).`);
  }
}

main()
  .catch((error) => {
    console.error(error.message ?? error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
