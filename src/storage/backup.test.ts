import { freshDb } from '../test/freshDb';
import { makeLogEntry } from '../test/factories';
import { blobToDataUrl, dataUrlToBlob, MAX_PHOTO_BYTES, makeBackup, parseBackup, restoreFromText } from './backup';
import { addLogEntry, loadAll, saveCorrection, saveNote, setOwned } from './db';

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
    const backup = makeBackup({ owned: [], corrections: {}, notes: {}, log: [] }, new Date('2026-10-31T00:00:00Z'));
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
    const base = { app: 'mezastar-helper', version: 1, owned: [], corrections: {}, notes: {}, log: [] };
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
      const empty = { owned: [], corrections: {}, notes: {}, log: [] };
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
