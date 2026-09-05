/**
 * Put the ten platform logos already in this repository into the database.
 *
 * Before the Songs section, `/songs` was a static grid of these logos with no
 * links behind any of them. The files stay where they are — they are part of
 * the repository — but the registry an administrator now edits lives in the
 * database, so they are copied in once.
 *
 * Not downscaled on the way in: the largest is 245KB, well under the upload
 * ceiling, and resizing here would mean a native image library the project does
 * not otherwise need.
 *
 * Idempotent, keyed on name. Running it twice adds nothing and changes nothing,
 * so it is safe against production.
 *
 *   node scripts/seed-platforms.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PrismaClient } from '@prisma/client';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const prisma = new PrismaClient();

/** Name as it should read on the site, and the file it maps to. */
const PLATFORMS = [
  ['Spotify', 'spotify.png'],
  ['Apple Music', 'apple-music.png'],
  ['iTunes', 'itunes.png'],
  ['Amazon Music', 'amazon-music.png'],
  ['JioSaavn', 'jiosaavn.png'],
  ['Gaana', 'gaana.png'],
  ['Raaga', 'raaga.png'],
  ['Resso', 'resso.png'],
  ['Wynk', 'wynk.png'],
  ['YouTube Music', 'youtube-music.png'],
];

/** Width and height live at fixed offsets in a PNG's IHDR chunk. */
function pngSize(buffer) {
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function slugify(input) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

let added = 0;
let skipped = 0;

for (const [index, [name, file]] of PLATFORMS.entries()) {
  const existing = await prisma.platform.findFirst({ where: { name } });
  if (existing) {
    console.log(`  ${name} is already registered — left alone.`);
    skipped++;
    continue;
  }

  const bytes = readFileSync(join(root, 'public', 'brand', 'platforms', file));
  const { width, height } = pngSize(bytes);

  const asset = await prisma.mediaAsset.create({
    data: { mimeType: 'image/png', bytes, width, height, byteSize: bytes.length },
    select: { id: true },
  });

  await prisma.platform.create({
    data: { name, slug: slugify(name), logoId: asset.id, sortOrder: index },
  });

  console.log(`  added ${name} (${width}x${height}, ${Math.round(bytes.length / 1024)}KB)`);
  added++;
}

console.log(`\n${added} added, ${skipped} already there.`);
await prisma.$disconnect();
