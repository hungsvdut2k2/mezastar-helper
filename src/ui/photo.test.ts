import { fitWithin, PhotoError, processPhoto, whenDecoded, type DecodableImage } from './photo';

describe('fitWithin', () => {
  it.each([
    [1200, 800, 600, 400],
    [800, 1200, 400, 600],
    [600, 600, 600, 600],
    [300, 200, 300, 200],
    [10000, 1, 600, 1],
  ])('%ix%i -> %ix%i', (w, h, ew, eh) => {
    expect(fitWithin(w, h)).toEqual({ width: ew, height: eh });
  });
});

describe('processPhoto', () => {
  it('rejects non-images without decoding', async () => {
    const rasterize = vi.fn();
    await expect(processPhoto(new Blob(['x'], { type: 'text/plain' }), rasterize)).rejects.toThrow(/not an image/);
    expect(rasterize).not.toHaveBeenCalled();
  });

  it('reports decode failures clearly', async () => {
    const err = processPhoto(new Blob(['x'], { type: 'image/png' }), () => Promise.reject(new Error('bad')));
    await expect(err).rejects.toBeInstanceOf(PhotoError);
    await expect(err).rejects.toThrow(/Could not read/);
  });

  it('returns what the rasterizer produces', async () => {
    const out = new Blob(['jpg'], { type: 'image/jpeg' });
    expect(await processPhoto(new Blob(['x'], { type: 'image/heic' }), async () => out)).toBe(out);
  });
});

describe('whenDecoded', () => {
  const fake = (decode: DecodableImage['decode'], extra: Partial<DecodableImage> = {}): DecodableImage =>
    ({ complete: false, naturalWidth: 0, onload: null, onerror: null, decode, ...extra }) as DecodableImage;

  it('resolves when decode() succeeds', async () => {
    await expect(whenDecoded(fake(() => Promise.resolve()))).resolves.toBeUndefined();
  });

  it('falls back to the load event when decode() rejects', async () => {
    const img = fake(() => Promise.reject(new DOMException('x', 'EncodingError')));
    const done = whenDecoded(img);
    await vi.waitFor(() => expect(img.onload).toBeTruthy());
    (img.onload as () => void)();
    await expect(done).resolves.toBeUndefined();
  });

  it('uses an already loaded image when decode() rejects', async () => {
    const img = fake(() => Promise.reject(new Error('x')), { complete: true, naturalWidth: 10 });
    await expect(whenDecoded(img)).resolves.toBeUndefined();
  });

  it('fails when decode() rejects and the image then errors', async () => {
    const img = fake(() => Promise.reject(new Error('x')));
    const done = whenDecoded(img);
    const caught = expect(done).rejects.toThrow(/failed to load/);
    await vi.waitFor(() => expect(img.onerror).toBeTruthy());
    (img.onerror as () => void)();
    await caught;
  });

  it('waits for load when decode() is missing', async () => {
    const img = fake(undefined);
    const done = whenDecoded(img);
    await vi.waitFor(() => expect(img.onload).toBeTruthy());
    (img.onload as () => void)();
    await expect(done).resolves.toBeUndefined();
  });
});
