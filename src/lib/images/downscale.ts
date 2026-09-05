/**
 * Shrink an image in the browser, before it is ever uploaded.
 *
 * THIS IS NOT AN OPTIMISATION. A 3000x3000 cover — what a music distributor
 * asks for, and what Rejoice will have on hand — is several megabytes, and
 * neither end of the upload will take it:
 *
 *   - Vercel caps a serverless request body at about 4.5MB;
 *   - Next caps a Server Action's body at 1MB by default.
 *
 * Resizing here means what crosses the wire is ~150KB and neither limit is
 * anywhere near. It also means the site needs no native image library on the
 * server, which would be a new dependency and a slower cold start.
 *
 * The server still checks type and size when it receives the result. This file
 * makes the upload possible; it is not where the rule lives, because anything
 * running in a browser is a request, not a guarantee.
 */

export type Downscaled = {
  blob: Blob;
  width: number;
  height: number;
};

/**
 * WebP, at a quality chosen for artwork rather than photographs.
 *
 * 0.82 holds up on the flat colour and lettering that cover art is full of —
 * gradients band and type furs at 0.7, which is exactly what a song cover is
 * made of.
 */
const QUALITY = 0.82;
const TYPE = 'image/webp';

/**
 * Fit inside a square of `max`, keeping the aspect ratio, and never enlarge.
 *
 * Not forced square: covers are square by convention but a platform logo is
 * usually wide, and stretching one to fit would be worse than the wasted
 * pixels.
 */
function fit(width: number, height: number, max: number) {
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function load(file: File): Promise<ImageBitmap | HTMLImageElement> {
  /*
   * `createImageBitmap` decodes off the main thread, which matters for a
   * 3000x3000 file — decoding one on the main thread visibly freezes the page.
   * Safari only gained it recently, hence the fallback.
   */
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file);
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('That file could not be read as an image.'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Downscale `file` to fit `max` pixels on its longest side, as WebP. */
export async function downscale(file: File, max: number): Promise<Downscaled> {
  const source = await load(file);
  const sourceWidth = 'width' in source ? source.width : 0;
  const sourceHeight = 'height' in source ? source.height : 0;

  if (!sourceWidth || !sourceHeight) {
    throw new Error('That file could not be read as an image.');
  }

  const { width, height } = fit(sourceWidth, sourceHeight, max);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot prepare the image.');

  /*
   * Without these the browser uses a cheap nearest-neighbour scale, and going
   * from 3000px to 1200px in one step that way is visibly crunchy on exactly
   * the fine lettering cover art carries.
   */
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(source as CanvasImageSource, 0, 0, width, height);

  if ('close' in source) source.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, TYPE, QUALITY),
  );

  if (!blob) throw new Error('The image could not be prepared for upload.');

  return { blob, width, height };
}

/**
 * The one size a song cover is stored at.
 *
 * It was two — 1200px for the song page and 400px for the grid — until the real
 * catalogue size came up. At roughly 175KB a song, 5,000 songs is about 854MB
 * of images against a 512MB database. One 800px cover is about 70KB, which puts
 * the same catalogue near 350MB and inside the free tier.
 *
 * The grid pays for that by drawing an 800px image into a 400px box. On a
 * retina screen that is exactly right; elsewhere it is a few tens of kilobytes
 * of waste, which is a far better trade than running out of storage.
 *
 * 800 rather than 1200 costs a little sharpness on a large desktop song page
 * and nothing at all on a phone.
 */
export const COVER_SIZE = 800;

/** One size for a platform logo — they are small wherever they appear. */
export const LOGO_SIZE = 512;
