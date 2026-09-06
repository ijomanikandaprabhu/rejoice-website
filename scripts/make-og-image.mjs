/**
 * Renders `public/og-default.png` — the picture shown when someone shares a
 * page of this site on WhatsApp, Facebook or X.
 *
 * Run it by hand after a brand change:
 *
 *     node scripts/make-og-image.mjs
 *
 * ## Why this is a script, and not `app/opengraph-image.tsx`
 *
 * Next can generate this card from a file convention, and that is the
 * fashionable answer. It is the wrong one here: the card is identical for every
 * page that uses it, so generating it per route buys nothing. Rendering it once
 * into `public/` makes it an ordinary static file on the CDN, and
 * `seoConfig.defaultOgImage` keeps pointing at the path it always did.
 *
 * ## Why it composites pixels instead of rendering HTML
 *
 * The obvious tool is `next/og`'s `ImageResponse`, which draws from JSX. It
 * cannot run here. `@vercel/og` resolves its bundled font by building a path
 * from a `file:` URL, and on Windows — with a space in this project's path —
 * that yields `.\file:\C:\Users\...\ijo%20development\...`, which is not a path
 * at all. It throws `ERR_INVALID_URL` at module load, before any option we pass
 * could take effect. That is a defect in the library, not something worth
 * bending the design of the card around.
 *
 * So the card is composited directly with `pngjs`: a gradient, the house ember,
 * the wordmark, and an accent rule. No text is drawn, which is the point — the
 * wordmark already says the name, and drawing type would drag a font renderer
 * back in for no gain.
 *
 * `pngjs` arrives as a transitive dependency rather than one we declare. That
 * is fine for a script nothing builds against, but if this ever fails with
 * MODULE_NOT_FOUND, `npm i -D pngjs` is the fix.
 *
 * It is deliberately NOT wired into `prebuild`. The output is committed, the
 * inputs change about once a year, and a build step that rewrites a binary on
 * every deploy makes for noisy diffs.
 */

import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');

const ROOT = process.cwd();

const WIDTH = 1200;
const HEIGHT = 630;

// Straight from `tailwind.config.ts` — site.accent and site.night. Literal
// because this renders outside the Tailwind pipeline and cannot read the theme.
const ACCENT = [0xff, 0x6d, 0x29];
const NIGHT = [0x04, 0x1a, 0x29];
const BLACK = [0x00, 0x00, 0x00];

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n);

const out = new PNG({ width: WIDTH, height: HEIGHT });

/*
 * Background: the hero film's night navy falling away to black.
 *
 * The ramp runs on x+y rather than y alone, so the ground reads as having a
 * direction rather than being a flat wash.
 */
for (let y = 0; y < HEIGHT; y += 1) {
  for (let x = 0; x < WIDTH; x += 1) {
    const t = clamp01((x / WIDTH) * 0.45 + (y / HEIGHT) * 0.75);
    const i = (WIDTH * y + x) << 2;
    out.data[i] = lerp(NIGHT[0], BLACK[0], t);
    out.data[i + 1] = lerp(NIGHT[1], BLACK[1], t);
    out.data[i + 2] = lerp(NIGHT[2], BLACK[2], t);
    out.data[i + 3] = 255;
  }
}

/*
 * The house ember, anchored off the top-right corner exactly as it is on the
 * site. Quadratic falloff rather than linear: a linear ramp leaves a visible
 * disc edge where it reaches zero.
 */
const GLOW = { x: 1180, y: 40, radius: 620, strength: 0.42 };

for (let y = 0; y < HEIGHT; y += 1) {
  for (let x = 0; x < WIDTH; x += 1) {
    const dx = x - GLOW.x;
    const dy = y - GLOW.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d >= GLOW.radius) continue;

    const falloff = 1 - d / GLOW.radius;
    const a = falloff * falloff * GLOW.strength;
    const i = (WIDTH * y + x) << 2;
    out.data[i] = lerp(out.data[i], ACCENT[0], a);
    out.data[i + 1] = lerp(out.data[i + 1], ACCENT[1], a);
    out.data[i + 2] = lerp(out.data[i + 2], ACCENT[2], a);
  }
}

/*
 * The wordmark, scaled down and composited over the ground.
 *
 * Bilinear, not nearest neighbour. The mark is fine white lettering on
 * transparency, and nearest neighbour shreds its stems into a stair pattern at
 * this reduction — it is the one place on the card where the sampling shows.
 *
 * The source is straight alpha, so the blend is the ordinary source-over.
 */
const mark = PNG.sync.read(readFileSync(join(ROOT, 'public/brand/logo-wordmark-light.png')));

const MARK_WIDTH = 620;
const MARK_HEIGHT = Math.round((mark.height / mark.width) * MARK_WIDTH);
const markX = Math.round((WIDTH - MARK_WIDTH) / 2);
// Sits slightly above centre: the accent rule below needs room, and a block
// centred on the true middle reads as low once something is under it.
const markY = Math.round(HEIGHT / 2 - MARK_HEIGHT / 2 - 34);

const sample = (img, sx, sy) => {
  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);
  const x1 = Math.min(x0 + 1, img.width - 1);
  const y1 = Math.min(y0 + 1, img.height - 1);
  const fx = sx - x0;
  const fy = sy - y0;

  const at = (x, y, c) => img.data[((img.width * y + x) << 2) + c];
  const rgba = [0, 0, 0, 0];
  for (let c = 0; c < 4; c += 1) {
    const top = lerp(at(x0, y0, c), at(x1, y0, c), fx);
    const bottom = lerp(at(x0, y1, c), at(x1, y1, c), fx);
    rgba[c] = lerp(top, bottom, fy);
  }
  return rgba;
};

for (let y = 0; y < MARK_HEIGHT; y += 1) {
  for (let x = 0; x < MARK_WIDTH; x += 1) {
    const sx = (x / MARK_WIDTH) * (mark.width - 1);
    const sy = (y / MARK_HEIGHT) * (mark.height - 1);
    const [r, g, b, a] = sample(mark, sx, sy);
    if (a <= 0) continue;

    const alpha = a / 255;
    const i = (WIDTH * (markY + y) + (markX + x)) << 2;
    out.data[i] = lerp(out.data[i], r, alpha);
    out.data[i + 1] = lerp(out.data[i + 1], g, alpha);
    out.data[i + 2] = lerp(out.data[i + 2], b, alpha);
  }
}

/*
 * A short accent rule under the mark. The card is otherwise a single centred
 * element on a gradient, and this gives the eye somewhere to stop — the same
 * job the ember does at the top.
 */
const RULE = { width: 96, height: 4, gap: 52 };
const ruleX = Math.round((WIDTH - RULE.width) / 2);
const ruleY = markY + MARK_HEIGHT + RULE.gap;

for (let y = ruleY; y < ruleY + RULE.height; y += 1) {
  for (let x = ruleX; x < ruleX + RULE.width; x += 1) {
    const i = (WIDTH * y + x) << 2;
    out.data[i] = ACCENT[0];
    out.data[i + 1] = ACCENT[1];
    out.data[i + 2] = ACCENT[2];
  }
}

const png = PNG.sync.write(out);
const target = join(ROOT, 'public/og-default.png');
writeFileSync(target, png);
console.log(`og image: wrote ${target} (${png.length} bytes, ${WIDTH}x${HEIGHT})`);
