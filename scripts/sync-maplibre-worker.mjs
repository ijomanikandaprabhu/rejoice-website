import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Copies MapLibre's Web Worker into `public/maplibre/`.
 *
 * MapLibre finds its worker from its own `import.meta.url`, resolving
 * `./maplibre-gl-worker.mjs` beside itself. Bundled by Next that path becomes
 * `/_next/static/chunks/maplibre-gl-worker.mjs`, which does not exist — Next
 * answers with its 404 HTML page, the browser rejects it for the `text/html`
 * MIME type, and the worker never starts. The map then draws its controls and
 * marker but NO TILES, because tile fetching and decoding both live in there.
 *
 * Letting webpack emit the worker as an asset (`new URL(..., import.meta.url)`)
 * does not fix it either: the worker `import`s `./maplibre-gl-shared.mjs`, and
 * only the worker file gets emitted, so the sibling 404s the same way. BOTH
 * files have to sit next to each other at a stable URL — hence this copy, and
 * `setWorkerUrl('/maplibre/maplibre-gl-worker.mjs')` in `ContactMap`.
 *
 * Run from `predev` and `prebuild` so the copy cannot drift from the installed
 * version of the package.
 */

const FILES = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs'];

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, 'node_modules', 'maplibre-gl', 'dist');
const to = join(root, 'public', 'maplibre');

await mkdir(to, { recursive: true });

for (const file of FILES) {
  await copyFile(join(from, file), join(to, file));
}

console.log(`maplibre: copied ${FILES.length} worker files to public/maplibre/`);
