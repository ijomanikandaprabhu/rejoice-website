/**
 * Custom `next/image` loader.
 *
 * Two jobs, in this order:
 *
 *   1. Ask YouTube for a size close to the one being rendered. YouTube already
 *      publishes every thumbnail and avatar at several sizes, so the resizing
 *      Next's optimizer would do on the server is work YouTube has already
 *      done — we only have to name the right variant.
 *
 *   2. Point the browser at our own `/api/image` route rather than at YouTube.
 *      That is what keeps the promise in the Privacy Policy: browsing the site
 *      tells YouTube nothing until a visitor actually presses play.
 *
 * This replaces Vercel's image optimization entirely, which had run out — the
 * free allowance is around 1,000 source images a month and the catalogue is
 * roughly 1,750 videos, so every newly imported video and channel logo came
 * back "402 Payment required" and showed as a broken image. Nothing here is
 * metered, so it cannot happen again as the catalogue grows.
 *
 * NOTE: this file is bundled into the browser. Keep it free of imports and of
 * anything server-only.
 */

/** Thumbnail variants YouTube publishes, smallest first, with their widths. */
const VIDEO_VARIANTS: ReadonlyArray<{ name: string; width: number }> = [
  { name: 'default', width: 120 },
  { name: 'mqdefault', width: 320 },
  { name: 'hqdefault', width: 480 },
  { name: 'sddefault', width: 640 },
  { name: 'maxresdefault', width: 1280 },
];

/**
 * `https://i.ytimg.com/vi/<id>/<variant>.jpg` — the `_webp` directory and the
 * `vi_webp` host variant are deliberately not matched; the stored URLs never
 * use them and a pattern that guesses would silently produce 404s.
 */
const VIDEO_THUMBNAIL = /^https:\/\/i\.ytimg\.com\/vi\/([\w-]{5,})\/[a-z0-9]+\.jpg$/;

/** An avatar's size is the `=s800` segment, which YouTube honours as a request. */
const AVATAR_SIZE = /=s\d+-/;

/**
 * The smallest published variant that still covers `width`, so a 96px avatar
 * does not download a 1280px file. The largest is used when nothing is big
 * enough — upscaling in the browser beats refusing to render.
 */
function variantFor(width: number): string {
  return (VIDEO_VARIANTS.find((v) => v.width >= width) ?? VIDEO_VARIANTS[VIDEO_VARIANTS.length - 1]).name;
}

/** Avatars are square, so one number serves both dimensions. */
function avatarSize(width: number): number {
  for (const size of [48, 88, 176, 240, 400, 800]) {
    if (size >= width) return size;
  }
  return 800;
}

export default function youtubeImageLoader({ src, width }: { src: string; width: number }): string {
  // Files served from this site already — logos, artwork in /public. They are
  // small and static, so they are returned untouched rather than proxied.
  if (src.startsWith('/')) return src;

  let target = src;

  const video = VIDEO_THUMBNAIL.exec(src);
  if (video) {
    target = `https://i.ytimg.com/vi/${video[1]}/${variantFor(width)}.jpg`;
  } else if (AVATAR_SIZE.test(src)) {
    target = src.replace(AVATAR_SIZE, `=s${avatarSize(width)}-`);
  }

  return `/api/image?u=${encodeURIComponent(target)}`;
}
