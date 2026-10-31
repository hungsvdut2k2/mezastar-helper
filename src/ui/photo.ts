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

/** The browser implementation (canvas). Not available in jsdom. */
export const canvasRasterizer: Rasterizer = async (file, fit) => {
  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = fit(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no canvas');
    ctx.drawImage(bitmap, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', PHOTO_QUALITY),
    );
  } finally {
    bitmap.close();
  }
};

/** Turn a file the player picked into a small JPEG blob, or throw a PhotoError with a readable message. */
export async function processPhoto(file: Blob, rasterize: Rasterizer = canvasRasterizer): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new PhotoError('That file is not an image. Choose a photo.');
  try {
    return await rasterize(file, fitWithin);
  } catch {
    throw new PhotoError('Could not read that image. Try a different photo.');
  }
}
