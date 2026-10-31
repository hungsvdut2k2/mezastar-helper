import { freshDb } from '../test/freshDb';
import { makeLogEntry } from '../test/factories';
import { blobToDataUrl, dataUrlToBlob, MAX_PHOTO_BYTES, makeBackup, parseBackup, restoreFromText } from './backup';
import { addLogEntry, getAllPhotos, loadAll, saveCorrection, saveNote, setOwned } from './db';

beforeEach(freshDb);

describe('backup', () => {
  it('round-trips all data through a JSON file', async () => {
    await setOwned('1-3-001', true);
    await saveCorrection('1-3-001', { stats: { attack: 150 } });
    await saveNote('lanes', 'Three');
    await addLogEntry(makeLogEntry({ id: 'a' }));
    const before = await loadAll();
    const text = JSON.stringify(makeBackup(before, new Date('2026-10-31T00:00:00Z')));

    freshDb();
    const result = await restoreFromText(text);
    expect(result.ok).toBe(true);
    expect(await loadAll()).toEqual(before);
  });

  it('stamps the app name, version and date', () => {
    const backup = makeBackup({ owned: [], corrections: {}, notes: {}, log: [], customTags: [] }, new Date('2026-10-31T00:00:00Z'));
    expect(backup).toMatchObject({ app: 'mezastar-helper', version: 1, exportedAt: '2026-10-31T00:00:00.000Z' });
  });

  it.each([
    ['not json', 'not valid JSON'],
    ['{"app":"other","version":1}', 'not a Mezastar Helper backup'],
    ['{"app":"mezastar-helper","version":2}', 'Unsupported backup version: 2'],
    ['{"app":"mezastar-helper","version":1,"owned":"x","corrections":{},"notes":{},"log":[]}', 'owned tags'],
    ['{"app":"mezastar-helper","version":1,"owned":[],"corrections":{},"notes":{},"log":[{"id":1}]}', 'play log'],
  ])('rejects %s', (text, message) => {
    const result = parseBackup(text);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(message);
  });

  it('changes nothing when the file is invalid', async () => {
    await setOwned('1-3-001', true);
    const result = await restoreFromText('{"app":"other"}');
    expect(result.ok).toBe(false);
    expect((await loadAll()).owned).toEqual(['1-3-001']);
  });

  describe('strict validation', () => {
    const wrap = (parts: Record<string, unknown>) =>
      JSON.stringify({ app: 'mezastar-helper', version: 1, owned: [], corrections: {}, notes: {}, log: [], ...parts });
    const goodEntry = makeLogEntry();

    it('accepts valid partial corrections and a full log entry', () => {
      const corrections = {
        a: { grade: null, types: ['fire', 'water'], pokenergy: 0, stats: { attack: 150, hp: null }, move: null },
        b: { move: { name: 'Tackle', type: 'normal' } },
        c: {},
      };
      const entry = makeLogEntry({ turns: [{ attacker: 'x', aimedAt: 'y', defeated: 'y', predictedDefeat: true }] });
      expect(parseBackup(wrap({ corrections, log: [entry] })).ok).toBe(true);
    });

    it.each([
      ['grade 7', { grade: 7 }],
      ['grade 2.5', { grade: 2.5 }],
      ['grade string', { grade: '3' }],
      ['empty types', { types: [] }],
      ['three types', { types: ['fire', 'water', 'grass'] }],
      ['unknown type', { types: ['sparkle'] }],
      ['negative pokenergy', { pokenergy: -1 }],
      ['fractional pokenergy', { pokenergy: 1.5 }],
      ['duplicate types', { types: ['fire', 'fire'] }],
      ['fractional stat', { stats: { attack: 10.5 } }],
      ['negative stat', { stats: { hp: -1 } }],
      ['string pokenergy', { pokenergy: '5' }],
      ['stats not an object', { stats: 5 }],
      ['stat not a number', { stats: { attack: 'x' } }],
      ['unknown stat key', { stats: { attack: 10, speeed: 5 } }],
      ['move without name', { move: { type: 'fire' } }],
      ['move unknown type', { move: { name: 'X', type: 'sparkle' } }],
      ['move not an object', { move: 'Tackle' }],
    ])('rejects a correction with %s', (_name, bad) => {
      const result = parseBackup(wrap({ corrections: { a: bad } }));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('corrections');
    });

    it.each([
      ['unknown mode', { mode: 'arena' }],
      ['bad cronyDefeatedCount', { cronyDefeatedCount: 3 }],
      ['non-boolean bossDefeated', { bossDefeated: 'no' }],
      ['non-string cronies', { cronies: [1] }],
      ['bad ball', { ballType: 'beast' }],
      ['non-string caught', { caught: 5 }],
      ['turn without attacker', { turns: [{}] }],
      ['turn bad predictedDefeat', { turns: [{ attacker: 'a', predictedDefeat: 'yes' }] }],
      ['non-string location', { location: 4 }],
    ])('rejects a log entry with %s', (_name, bad) => {
      const result = parseBackup(wrap({ log: [{ ...goodEntry, ...bad }] }));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('play log');
    });

    it('sorts the restored log newest first', () => {
      const old = makeLogEntry({ id: 'old', date: '2026-01-01T00:00:00.000Z' });
      const recent = makeLogEntry({ id: 'new', date: '2026-06-01T00:00:00.000Z' });
      const result = parseBackup(wrap({ log: [old, recent] }));
      expect(result.ok && result.data.log.map((e) => e.id)).toEqual(['new', 'old']);
    });

    it('rejects duplicate log ids', () => {
      expect(parseBackup(wrap({ log: [goodEntry, goodEntry] })).ok).toBe(false);
    });

    it.each([
      ['array notes', []],
      ['non-string note', { a: 5 }],
    ])('rejects %s', (_name, notes) => {
      const result = parseBackup(wrap({ notes }));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('notes');
    });
  });

  describe('photos', () => {
    const base = { app: 'mezastar-helper', version: 1, owned: [], corrections: {}, notes: {}, log: [], customTags: [] };
    const png = `data:image/png;base64,${btoa('hello')}`;
    const withPhotos = (photos: unknown) => JSON.stringify({ ...base, photos });

    it('accepts valid photos for known tags', () => {
      const result = parseBackup(withPhotos({ '1-3-001': png, '1-3-002': `data:image/jpeg;base64,${btoa('x')}` }));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(Object.keys(result.photos)).toEqual(['1-3-001', '1-3-002']);
        expect(result.photos['1-3-001'].type).toBe('image/png');
        expect(result.photos['1-3-001'].size).toBe(5);
      }
    });

    it('restores old backups that have no photos field', () => {
      const result = parseBackup(JSON.stringify(base));
      expect(result).toMatchObject({ ok: true, photos: {} });
    });

    it.each([
      ['a wrong prefix', { '1-3-001': `data:text/html;base64,${btoa('x')}` }],
      ['an svg image', { '1-3-001': `data:image/svg+xml;base64,${btoa('x')}` }],
      ['not base64', { '1-3-001': 'data:image/png;base64,@@@@' }],
      ['not a string', { '1-3-001': 5 }],
      ['an unknown tag id', { 'nope-123': png }],
      ['a non-object photos field', [png]],
    ])('rejects %s', (_name, photos) => {
      const result = parseBackup(withPhotos(photos));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('photos');
    });

    it('rejects a photo over 2 MB but accepts exactly 2 MB', () => {
      const at = `data:image/webp;base64,${btoa('a'.repeat(MAX_PHOTO_BYTES))}`;
      const over = `data:image/webp;base64,${btoa('a'.repeat(MAX_PHOTO_BYTES + 1))}`;
      expect(parseBackup(withPhotos({ '1-3-001': at })).ok).toBe(true);
      expect(parseBackup(withPhotos({ '1-3-001': over })).ok).toBe(false);
    });

    it('omits the photos field when there are none, and includes it otherwise', () => {
      const empty = { owned: [], corrections: {}, notes: {}, log: [], customTags: [] };
      expect(makeBackup(empty)).not.toHaveProperty('photos');
      expect(makeBackup(empty, new Date(), { '1-3-001': png }).photos).toEqual({ '1-3-001': png });
    });

    it('converts blobs to data URLs and back', async () => {
      const url = await blobToDataUrl(new Blob(['hello'], { type: 'image/png' }));
      expect(url).toBe(png);
      expect(dataUrlToBlob(url)?.size).toBe(5);
    });
  });
});

describe('custom tags in backups', () => {
  const custom = (over: Record<string, unknown> = {}) => ({
    id: 'my-abc-1',
    printedCode: 'X-9',
    name: 'Homebrew',
    grade: 3,
    types: ['fire', 'water'],
    pokenergy: null,
    stats: { hp: null, attack: null, defense: null, speed: null },
    move: { name: 'Zap', type: 'electric' },
    gimmick: { kind: 'mega', moveName: null, moveType: null },
    legendary: false,
    mythical: true,
    sources: ['added by you'],
    ...over,
  });
  const wrap = (parts: Record<string, unknown>) =>
    JSON.stringify({ app: 'mezastar-helper', version: 1, owned: [], corrections: {}, notes: {}, log: [], ...parts });
  const png = `data:image/png;base64,${btoa('hello')}`;

  it('round-trips a custom tag with its owned flag, correction and photo', async () => {
    const tag = custom();
    const blob = new Blob(['hello'], { type: 'image/png' });
    const data = { owned: ['my-abc-1'], corrections: { 'my-abc-1': { stats: { attack: 5 } } }, notes: {}, log: [], customTags: [tag as never] };
    const text = JSON.stringify(makeBackup(data, new Date(), { 'my-abc-1': await blobToDataUrl(blob) }));
    freshDb();
    const result = await restoreFromText(text);
    expect(result.ok).toBe(true);
    expect(await loadAll()).toEqual(data);
    expect(Object.keys(await getAllPhotos())).toEqual(['my-abc-1']);
  });

  it('restores old backups without customTags as having none', () => {
    const result = parseBackup(wrap({}));
    expect(result.ok && result.data.customTags).toEqual([]);
  });

  it('accepts owned, corrections and photos for a custom id that is in the backup', () => {
    const result = parseBackup(
      wrap({ customTags: [custom()], owned: ['my-abc-1'], corrections: { 'my-abc-1': {} }, photos: { 'my-abc-1': png } }),
    );
    expect(result.ok).toBe(true);
  });

  it('drops owned flags, corrections and photos of a custom id missing from the backup, without rejecting', () => {
    const result = parseBackup(
      wrap({
        customTags: [custom()],
        owned: ['my-ghost', 'my-abc-1', '1-3-001'],
        corrections: { 'my-ghost': { grade: 5 }, 'my-abc-1': {}, '1-3-001': { grade: 6 } },
        photos: { 'my-ghost': png, 'my-abc-1': png, '1-3-001': png },
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.owned).toEqual(['my-abc-1', '1-3-001']);
    expect(Object.keys(result.data.corrections).sort()).toEqual(['1-3-001', 'my-abc-1']);
    expect(Object.keys(result.photos).sort()).toEqual(['1-3-001', 'my-abc-1']);
  });

  it('still rejects a malformed photo for a tag that exists', () => {
    expect(parseBackup(wrap({ photos: { '1-3-001': 'data:text/html;base64,AAAA' } })).ok).toBe(false);
  });

  it('never exports orphans: owned, corrections and photos of missing custom tags are filtered', () => {
    const data = {
      owned: ['my-ghost', '1-3-001'],
      corrections: { 'my-ghost': { grade: 5 as const }, '1-3-001': { grade: 6 as const } },
      notes: {},
      log: [],
      customTags: [],
    };
    const backup = makeBackup(data, new Date(), { 'my-ghost': png, '1-3-001': png });
    expect(backup.owned).toEqual(['1-3-001']);
    expect(Object.keys(backup.corrections)).toEqual(['1-3-001']);
    expect(Object.keys(backup.photos ?? {})).toEqual(['1-3-001']);
    expect(makeBackup(data, new Date(), { 'my-ghost': png })).not.toHaveProperty('photos');
  });

  it.each([
    ['an id without the prefix', { id: '1-3-001' }],
    ['an id with odd characters', { id: 'my-a b' }],
    ['a missing code', { printedCode: '  ' }],
    ['a code that is too long', { printedCode: 'x'.repeat(21) }],
    ['a name that is too long', { name: 'x'.repeat(61) }],
    ['a missing name', { name: undefined }],
    ['grade 0', { grade: 0 }],
    ['grade 7', { grade: 7 }],
    ['a fractional grade', { grade: 2.5 }],
    ['no types', { types: [] }],
    ['three types', { types: ['fire', 'water', 'grass'] }],
    ['repeated types', { types: ['fire', 'fire'] }],
    ['an unknown type', { types: ['sound'] }],
    ['a bad move type', { move: { name: 'Zap', type: 'sound' } }],
    ['a long move name', { move: { name: 'x'.repeat(61), type: 'fire' } }],
    ['an unknown gimmick', { gimmick: { kind: 'tera' } }],
    ['a non-boolean flag', { legendary: 'yes' }],
  ])('rejects a custom tag with %s', (_n, over) => {
    const result = parseBackup(wrap({ customTags: [custom(over)] }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('custom tags');
  });

  it('rejects a play that uses a custom tag missing from the backup, naming it', () => {
    const entry = makeLogEntry({ turns: [{ attacker: '1-3-001', defeated: 'my-ghost', predictedDefeat: false }] });
    const result = parseBackup(wrap({ log: [entry] }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('A saved play uses a tag you added (my-ghost) that is not in the backup.');
    for (const part of [{ boss: 'my-ghost' }, { target: 'my-ghost' }, { caught: 'my-ghost' }, { cronies: ['my-ghost'] }, { teamUsed: ['my-ghost'] }]) {
      expect(parseBackup(wrap({ log: [makeLogEntry(part)] })).ok).toBe(false);
    }
  });

  it('accepts a play that uses a custom tag included in the backup', () => {
    const entry = makeLogEntry({ target: 'my-abc-1', teamUsed: ['my-abc-1'] });
    expect(parseBackup(wrap({ customTags: [custom()], log: [entry] })).ok).toBe(true);
  });

  it('accepts grade 1 in a correction too', () => {
    expect(parseBackup(wrap({ corrections: { '1-3-001': { grade: 1 } } })).ok).toBe(true);
    expect(parseBackup(wrap({ corrections: { '1-3-001': { grade: 0 } } })).ok).toBe(false);
  });

  it('accepts grade 1 and null, and rejects duplicate ids and non-arrays', () => {
    expect(parseBackup(wrap({ customTags: [custom({ grade: 1 }), custom({ id: 'my-2', grade: null })] })).ok).toBe(true);
    expect(parseBackup(wrap({ customTags: [custom(), custom()] })).ok).toBe(false);
    expect(parseBackup(wrap({ customTags: {} })).ok).toBe(false);
  });

  it('drops unknown keys from a custom tag', () => {
    const result = parseBackup(wrap({ customTags: [custom({ evil: '<script>', stats: { hp: 99 } })] }));
    expect(result.ok && result.data.customTags[0]).not.toHaveProperty('evil');
    expect(result.ok && result.data.customTags[0].stats.hp).toBeNull();
  });
});
