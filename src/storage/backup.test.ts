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
});
