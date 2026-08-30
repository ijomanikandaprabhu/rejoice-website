import { PNG } from 'pngjs';
import fs from 'node:fs';

/**
 * The source export ('rejoice logo.png') is the full "REJOICE" wordmark with
 * a flame/dove emblem in place of the O, but at very low alpha (~10-25%) —
 * intentional on the original dark artboard, invisible on white. This trims
 * the transparent margin and writes the full wordmark (unaltered content, no
 * cropping of the mark itself) as a dark-ink and a light-ink version, with
 * alpha boosted so the thin strokes read clearly at small sizes.
 */

const src = PNG.sync.read(fs.readFileSync('rejoice logo.png'));
const { width, height, data } = src;

function cropOf(cropX, cropY, cropW, cropH) {
  const out = new PNG({ width: cropW, height: cropH });
  for (let y = 0; y < cropH; y++) {
    for (let x = 0; x < cropW; x++) {
      const s = (width * (y + cropY) + (x + cropX)) * 4;
      const d = (cropW * y + x) * 4;
      out.data[d] = data[s];
      out.data[d + 1] = data[s + 1];
      out.data[d + 2] = data[s + 2];
      out.data[d + 3] = data[s + 3];
    }
  }
  return out;
}

function withInk(png, [r, g, b], boost = 2.2) {
  const out = new PNG({ width: png.width, height: png.height });
  for (let i = 0; i < png.data.length; i += 4) {
    const a = png.data[i + 3];
    out.data[i] = r;
    out.data[i + 1] = g;
    out.data[i + 2] = b;
    out.data[i + 3] = Math.min(255, Math.round(a * boost));
  }
  return out;
}

fs.mkdirSync('public/brand', { recursive: true });

// Full "REJOICE" wordmark, tight bounding box + small padding.
{
  let minX = width, maxX = 0, minY = height, maxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(width * y + x) * 4 + 3] > 20) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const pad = 6;
  const cropX = Math.max(0, minX - pad);
  const cropY = Math.max(0, minY - pad);
  const cropW = Math.min(width, maxX + pad) - cropX;
  const cropH = Math.min(height, maxY + pad) - cropY;
  const cropped = cropOf(cropX, cropY, cropW, cropH);
  fs.writeFileSync('public/brand/logo-wordmark-dark.png', PNG.sync.write(withInk(cropped, [10, 10, 10])));
  fs.writeFileSync('public/brand/logo-wordmark-light.png', PNG.sync.write(withInk(cropped, [255, 255, 255])));
}

console.log('done');
