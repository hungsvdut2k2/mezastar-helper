import { fitWithin, PhotoError, processPhoto } from './photo';

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
