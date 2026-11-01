export const PHOTO_MAX_SIDE = 600;
export const PHOTO_QUALITY = 0.8;

/** Shown to the player when a chosen file cannot be used. */
export class PhotoError extends Error {}

/** Scale so the long side is at most `max`; never enlarges. Always at least 1px each way. */
export function fitWithin(width: number, height: number, max = PHOTO_MAX_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Decodes an image and re-encodes it at the size `fit` picks. Replaceable in tests. */
export type Rasterizer = (file: Blob, fit: typeof fitWithin) => Promise<Blob>;

/** The parts of an image element that `whenDecoded` uses (so tests can pass a fake). */
export type DecodableImage = Pick<HTMLImageElement, 'complete' | 'naturalWidth' | 'onload' | 'onerror'> & {
  decode?: () => Promise<void>;
};

/**
 * Resolves once the image can be drawn. decode() can reject on older WebKit (EncodingError) even for a valid
 * large blob image, so on failure fall back to waiting for the normal load event before giving up.
 */
export async function whenDecoded(img: DecodableImage): Promise<void> {
  try {
    if (!img.decode) throw new Error('no decode');
    await img.decode();
    return;
  } catch {
    // fall through to the load events
  }
  await new Promise<void>((resolve, reject) => {
    if (img.complete && img.naturalWidth > 0) return resolve();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('image failed to load'));
  });
}

/**
 * The browser implementation (canvas). Not available in jsdom: this path is verified on a device, not in tests.
 * Decoding goes through an <img> so iOS (13.4+) applies the EXIF orientation, and createImageBitmap is not required.
 */
export const canvasRasterizer: Rasterizer = async (file, fit) => {
  const url = URL.createObjectURL(file);
  let canvas: HTMLCanvasElement | null = null;
  try {
    const img = new Image();
    img.src = url;
    await whenDecoded(img);
    const { width, height } = fit(img.naturalWidth, img.naturalHeight);
    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no canvas');
    // JPEG has no transparency: transparent pixels would turn black.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const target = canvas;
    return await new Promise<Blob>((resolve, reject) =>
      target.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', PHOTO_QUALITY),
    );
  } finally {
    URL.revokeObjectURL(url);
    if (canvas) {
      // Release the pixel memory right away (iOS Safari keeps canvases alive for a long time).
      canvas.width = 0;
      canvas.height = 0;
    }
  }
};

/** Turn a file the player picked into a small JPEG blob, or throw a PhotoError with a readable message. */
export async function processPhoto(file: Blob, rasterize: Rasterizer = canvasRasterizer, maxSide = PHOTO_MAX_SIDE): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new PhotoError('That file is not an image. Choose a photo.');
  try {
    return await rasterize(file, (w, h) => fitWithin(w, h, maxSide));
  } catch {
    throw new PhotoError('Could not read that image. Try a different photo.');
  }
}
