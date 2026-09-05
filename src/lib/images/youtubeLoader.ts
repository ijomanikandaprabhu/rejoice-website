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

/**
 * Thumbnail variants this loader will ask for, smallest first.
 *
 * ONLY THE 16:9 ONES. YouTube publishes five sizes but they are not all the
 * same shape: `default` (120x90), `hqdefault` (480x360) and `sddefault`
 * (640x480) are 4:3, with black bars baked into the picture, while
 * `mqdefault` (320x180) and `maxresdefault` (1280x720) are true 16:9.
 *
 * The site frames thumbnails in 16:9 boxes, so a 4:3 file arrives with bars
 * down each side. That is exactly what happened when this loader first
 * shipped: cards in the coverflow carousel picked up `hqdefault` and every one
 * of them gained dark pillars. Mixing shapes in one list looks like a size
 * choice and is really a cropping decision, so the 4:3 sizes are simply not
 * offered.
 *
 * Exported because `/api/image` needs to know what a legitimate request looks
 * like; two copies of this list would drift.
 */
export const VIDEO_VARIANTS: ReadonlyArray<{ name: string; width: number }> = [
  { name: 'mqdefault', width: 320 },
  { name: 'maxresdefault', width: 1280 },
];

/**
 * Every variant name YouTube publishes — what the route ACCEPTS, as opposed to
 * what this loader asks for.
 *
 * Wider than the list above on purpose. A browser holding a page from before
 * the 4:3 sizes were dropped still asks for them, and refusing those would
 * turn a stale tab into a wall of broken images. They are all real YouTube
 * addresses; serving one is harmless.
 */
export const ACCEPTED_VARIANTS: readonly string[] = [
  'default',
  'mqdefault',
  'hqdefault',
  'sddefault',
  'maxresdefault',
];

/**
 * `https://i.ytimg.com/vi/<id>/<variant>.jpg`, capturing the id AND the variant
 * — the stored variant is not decoration, it is the largest image YouTube
 * actually published for that video, and asking for a bigger one 404s.
 *
 * The `vi_webp` directory is deliberately not matched; stored URLs never use
 * it and a pattern that guessed would silently produce misses.
 */
const VIDEO_THUMBNAIL = /^https:\/\/i\.ytimg\.com\/vi\/([\w-]{5,})\/([a-z0-9]+)\.jpg$/;

/** An avatar's size is the `=s800` segment, which YouTube honours as a request. */
const AVATAR_SIZE = /=s\d+-/;

/**
 * Every variant name YouTube may publish, smallest first. Used only to rank
 * the one stored against the ones we would like to ask for.
 */
const SIZE_ORDER = ['default', 'mqdefault', 'hqdefault', 'sddefault', 'maxresdefault'];

/**
 * The variant to request, given the width being rendered and the largest image
 * YouTube actually has.
 *
 * `stored` is the variant in the URL the sync saved, which came from YouTube's
 * own report of what exists. NOTHING LARGER MAY BE REQUESTED. 177 of the 1,749
 * videos in this catalogue have no `maxresdefault` — their stored URL is
 * `sddefault` or `hqdefault` — and asking for one anyway returned 404, which
 * this route turns into a blank card. That is precisely what happened: a tenth
 * of the grid rendered as empty grey boxes.
 *
 * Reading the answer from the stored URL rather than from a list here means a
 * video added tomorrow is handled without anyone remembering this rule, and a
 * video whose maxres YouTube generates later starts using it as soon as the
 * daily sync refreshes the stored URL.
 *
 * The smallest variant that still covers `width` wins, so a 96px card does not
 * download a 1280px file.
 */
function variantFor(width: number, stored: string): string {
  const ceiling = SIZE_ORDER.indexOf(stored);

  const available = VIDEO_VARIANTS.filter(
    // A variant we never saw ranked (-1) is treated as no limit rather than as
    // "nothing allowed" — an unknown name must not blank the image.
    (v) => ceiling === -1 || SIZE_ORDER.indexOf(v.name) <= ceiling,
  );

  /*
   * Everything in VIDEO_VARIANTS is 16:9, and `mqdefault` is the smallest of
   * them. YouTube publishes it for every video, so this fallback is real
   * rather than theoretical — it is what the 177 videos above end up using.
   */
  if (available.length === 0) return VIDEO_VARIANTS[0].name;

  return (available.find((v) => v.width >= width) ?? available[available.length - 1]).name;
}

/**
 * Avatar sizes this loader will ask for, smallest first. Exported for the same
 * reason as the variant list above.
 */
export const AVATAR_SIZES: readonly number[] = [48, 88, 176, 240, 400, 800];

/** Avatars are square, so one number serves both dimensions. */
function avatarSize(width: number): number {
  for (const size of AVATAR_SIZES) {
    if (size >= width) return size;
  }
  return AVATAR_SIZES[AVATAR_SIZES.length - 1];
}

/**
 * YouTube publishes a WebP copy of the large thumbnail alongside the JPEG, and
 * it is roughly half the size — measured on this catalogue, 135KB becomes 68KB
 * and 91KB becomes 37KB. Worth having, because without Vercel's optimizer
 * nothing else is compressing these.
 *
 * Only for the large variant. `mqdefault` is already tiny and its WebP is
 * actually BIGGER (9KB against 10.5KB), so asking for it would cost bytes.
 *
 * Not every video has one, so `/api/image` falls back to the JPEG when the
 * WebP is missing rather than showing a broken image.
 */
const WEBP_VARIANTS = new Set(['maxresdefault']);

export default function youtubeImageLoader({ src, width }: { src: string; width: number }): string {
  // Files served from this site already — logos, artwork in /public. They are
  // small and static, so they are returned untouched rather than proxied.
  if (src.startsWith('/')) return src;

  let target = src;

  const video = VIDEO_THUMBNAIL.exec(src);
  if (video) {
    const [, id, stored] = video;
    const variant = variantFor(width, stored);
    target = WEBP_VARIANTS.has(variant)
      ? `https://i.ytimg.com/vi_webp/${id}/${variant}.webp`
      : `https://i.ytimg.com/vi/${id}/${variant}.jpg`;
  } else if (AVATAR_SIZE.test(src)) {
    target = src.replace(AVATAR_SIZE, `=s${avatarSize(width)}-`);
  }

  return `/api/image?u=${encodeURIComponent(target)}`;
}
