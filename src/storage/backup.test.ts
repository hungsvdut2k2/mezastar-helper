import { freshDb } from '../test/freshDb';
import { makeLogEntry } from '../test/factories';
import { makeBackup, parseBackup, restoreFromText } from './backup';
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
      ['string pokenergy', { pokenergy: '5' }],
      ['stats not an object', { stats: 5 }],
      ['stat not a number', { stats: { attack: 'x' } }],
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
});
