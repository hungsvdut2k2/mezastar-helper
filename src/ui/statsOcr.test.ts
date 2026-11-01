import { geminiReader, OcrError, parseStatsReply } from './statsOcr';

const reply = (obj: unknown) => JSON.stringify(obj);

describe('parseStatsReply', () => {
  it('keeps whole numbers, a known move type and grades 1–6', () => {
    expect(
      parseStatsReply(
        reply({ grade: 6, pokenergy: 3, hp: 200, attack: 120, defense: 90, spAttack: 150, spDefense: 160, speed: 110, moveName: ' Aeroblast ', moveType: 'Flying', moveCategory: 'Special' }),
      ),
    ).toEqual({
      grade: 6, pokenergy: 3, hp: 200, attack: 120, defense: 90, spAttack: 150, spDefense: 160, speed: 110,
      move: { name: 'Aeroblast', type: 'flying', category: 'special' },
    });
  });

  it('turns odd values into null instead of guessing', () => {
    expect(parseStatsReply(reply({ grade: 9, hp: -5, attack: 1.5, defense: '90', spAttack: -1, speed: null, moveName: 'X', moveType: 'cosmic' }))).toEqual({
      grade: null,
      pokenergy: null,
      hp: null,
      attack: null,
      defense: null,
      spAttack: null,
      spDefense: null,
      speed: null,
      move: null,
    });
  });

  it('throws a readable error for a reply that is not JSON', () => {
    expect(() => parseStatsReply('sorry')).toThrow(OcrError);
  });
});

describe('geminiReader', () => {
  const image = new Blob(['jpg'], { type: 'image/jpeg' });

  it('is null without a key', () => {
    expect(geminiReader('')).toBeNull();
  });

  it('sends the image with the key in a header and reads the JSON reply', async () => {
    const fetcher = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: reply({ hp: 150, attack: 80 }) }] } }] })),
    );
    const read = geminiReader('k', 'm', fetcher as unknown as typeof fetch)!;
    const result = await read(image);
    expect(result.hp).toBe(150);
    expect(result.attack).toBe(80);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/m:generateContent');
    expect(url).not.toContain('k');
    expect((init!.headers as Record<string, string>)['x-goog-api-key']).toBe('k');
    const body = JSON.parse(init!.body as string);
    expect(body.contents[0].parts[1].inline_data).toEqual({ mime_type: 'image/jpeg', data: btoa('jpg') });
  });

  it('explains rate limits and network failures', async () => {
    const limited = geminiReader('k', 'm', (async () => new Response('', { status: 429 })) as unknown as typeof fetch)!;
    await expect(limited(image)).rejects.toThrow('Too many requests');
    const offline = geminiReader('k', 'm', (async () => {
      throw new TypeError('network');
    }) as unknown as typeof fetch)!;
    await expect(offline(image)).rejects.toThrow('No connection');
  });
});
