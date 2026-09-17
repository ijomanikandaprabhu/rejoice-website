import { COVER_SIZE, type Downscaled } from '@/lib/images/downscale';

/**
 * A temporary cover, drawn from the song's own title.
 *
 * A song cannot be saved without artwork, and the artwork is often the last
 * thing to arrive. This lets the song go up as soon as its details are known:
 * the admin draws a Rejoice-branded square with the title on it, and it is
 * replaced when the real cover exists. `Song.coverIsTemporary` is how the admin
 * keeps track of which ones are still waiting.
 *
 * ## Drawn in the browser, deliberately
 *
 * The result is the same 800px WebP a real upload becomes, written into the
 * same form fields, so the server stores it through the same checks and cannot
 * tell the two apart. Nothing about image handling moves to the server, which
 * carries no native image library and should not grow one for a placeholder.
 *
 * ## The look
 *
 * The public site's palette (`tailwind.config.ts`, `site.*`): the hero's night
 * navy falling to black, and the accent orange as a low glow — the campfire in
 * the homepage film, the one image already this label's own. The wordmark at the
 * top, the title large, the artist beneath in the site's muted grey.
 *
 * The title is what makes each one different. A placeholder that looked the
 * same on every song would make a grid of them useless for telling songs apart.
 */

const NIGHT = '#041A29';
const BLACK = '#000000';
const ACCENT = '#FF6D29';
const FG = '#FFFFFF';
const MUTED = '#BABABA';

const WORDMARK = '/brand/logo-wordmark-light.png';

/** At most this many lines of title; past it the type shrinks instead. */
const MAX_LINES = 3;

/**
 * The public site's face.
 *
 * `next/font` gives the family a generated name, published on the root element
 * as `--font-site`. Read at draw time so this follows whatever the layout
 * loads, rather than hard-coding a name that changes between builds.
 */
function siteFont(): string {
  const declared = getComputedStyle(document.documentElement)
    .getPropertyValue('--font-site')
    .trim();
  return declared ? `${declared}, system-ui, sans-serif` : 'system-ui, sans-serif';
}

async function loadWordmark(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    // A cover without the wordmark is still a usable cover, so a failed load
    // is not a failed draw.
    img.onerror = () => resolve(null);
    img.src = WORDMARK;
  });
}

/** Greedy word wrap. A single word longer than the line is left to overflow. */
function wrap(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * The largest size, from `start` down, at which `text` fits the box in no more
 * than `MAX_LINES` lines with no line wider than the box. YouTube-style titles
 * run long, and a title cut off mid-word is the one thing this must not do.
 */
function fitTitle(
  context: CanvasRenderingContext2D,
  text: string,
  font: string,
  maxWidth: number,
  start: number,
  floor: number,
) {
  for (let size = start; size >= floor; size -= 4) {
    context.font = `600 ${size}px ${font}`;
    const lines = wrap(context, text, maxWidth);
    const widest = Math.max(...lines.map((l) => context.measureText(l).width));
    if (lines.length <= MAX_LINES && widest <= maxWidth) return { size, lines };
  }
  // Nothing fit: keep the smallest size and the first lines, ending in an
  // ellipsis so the cut reads as deliberate.
  context.font = `600 ${floor}px ${font}`;
  const lines = wrap(context, text, maxWidth);
  if (lines.length > MAX_LINES) {
    lines.length = MAX_LINES;
    lines[MAX_LINES - 1] = `${lines[MAX_LINES - 1].replace(/\s*\S*$/, '')}…`;
  }
  return { size: floor, lines };
}

export async function drawPlaceholderCover({
  title,
  artist,
}: {
  title: string;
  artist?: string | null;
}): Promise<Downscaled> {
  const size = COVER_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot draw a temporary cover.');

  // Wait for the web font, or the first cover drawn falls back to a system
  // face and every later one does not.
  await document.fonts?.ready;
  const font = siteFont();

  // ---- ground: night sky to black ----
  const sky = context.createLinearGradient(0, 0, 0, size);
  sky.addColorStop(0, NIGHT);
  sky.addColorStop(0.75, BLACK);
  context.fillStyle = sky;
  context.fillRect(0, 0, size, size);

  // ---- the ember glow, low and centred ----
  const glow = context.createRadialGradient(size / 2, size * 1.02, 0, size / 2, size * 1.02, size * 0.62);
  glow.addColorStop(0, 'rgba(255, 109, 41, 0.55)');
  glow.addColorStop(0.45, 'rgba(255, 109, 41, 0.14)');
  glow.addColorStop(1, 'rgba(255, 109, 41, 0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, size, size);

  // ---- wordmark ----
  const wordmark = await loadWordmark();
  if (wordmark) {
    const markHeight = 34;
    const markWidth = (wordmark.naturalWidth / wordmark.naturalHeight) * markHeight;
    context.globalAlpha = 0.92;
    context.drawImage(wordmark, (size - markWidth) / 2, 64, markWidth, markHeight);
    context.globalAlpha = 1;
  }

  // ---- title ----
  const padding = 72;
  const { size: titleSize, lines } = fitTitle(
    context,
    title.trim(),
    font,
    size - padding * 2,
    88,
    40,
  );
  const lineHeight = Math.round(titleSize * 1.12);
  const hasArtist = Boolean(artist?.trim());
  const artistSize = 30;
  const gap = hasArtist ? 28 : 0;
  const blockHeight = lines.length * lineHeight + (hasArtist ? gap + artistSize : 0);
  let y = (size - blockHeight) / 2 + titleSize * 0.82;

  context.textAlign = 'center';
  context.fillStyle = FG;
  context.font = `600 ${titleSize}px ${font}`;
  for (const line of lines) {
    context.fillText(line, size / 2, y);
    y += lineHeight;
  }

  // ---- artist ----
  if (hasArtist) {
    context.font = `400 ${artistSize}px ${font}`;
    context.fillStyle = MUTED;
    const [first] = wrap(context, artist!.trim(), size - padding * 2);
    context.fillText(first ?? '', size / 2, y - lineHeight + gap + artistSize + 6);
  }

  // ---- a thin accent rule near the foot, so the square reads as designed ----
  context.fillStyle = ACCENT;
  context.fillRect(size / 2 - 24, size - 84, 48, 3);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', 0.9),
  );
  if (!blob) throw new Error('The temporary cover could not be prepared.');

  return { blob, width: size, height: size };
}
