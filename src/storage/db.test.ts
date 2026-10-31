import { freshDb } from '../test/freshDb';
import { makeLogEntry } from '../test/factories';
import { addLogEntry, deleteLogEntry, loadAll, replaceAll, saveCorrection, saveNote, setOwned } from './db';

beforeEach(freshDb);

describe('storage', () => {
  it('starts empty', async () => {
    expect(await loadAll()).toEqual({ owned: [], corrections: {}, notes: {}, log: [] });
  });

  it('saves and loads every kind of data', async () => {
    await setOwned('1-3-001', true);
    await saveCorrection('1-3-001', { stats: { attack: 150 } });
    await saveNote('lanes', 'Three');
    await addLogEntry(makeLogEntry({ id: 'old', date: '2026-10-01T00:00:00.000Z' }));
    await addLogEntry(makeLogEntry({ id: 'new', date: '2026-10-31T00:00:00.000Z' }));
    const data = await loadAll();
    expect(data.owned).toEqual(['1-3-001']);
    expect(data.corrections).toEqual({ '1-3-001': { stats: { attack: 150 } } });
    expect(data.notes).toEqual({ lanes: 'Three' });
    expect(data.log.map((e) => e.id)).toEqual(['new', 'old']); // newest first
  });

  it('removes owned tags, corrections and log entries', async () => {
    await setOwned('1-3-001', true);
    await setOwned('1-3-001', false);
    await saveCorrection('1-3-001', { grade: 6 });
    await saveCorrection('1-3-001', null);
    await addLogEntry(makeLogEntry({ id: 'a' }));
    await deleteLogEntry('a');
    expect(await loadAll()).toEqual({ owned: [], corrections: {}, notes: {}, log: [] });
  });

  it('replaceAll swaps everything at once', async () => {
    await setOwned('1-3-001', true);
    await saveNote('lanes', 'old');
    const next = { owned: ['1-3-002'], corrections: {}, notes: { immunity: 'zero' }, log: [makeLogEntry({ id: 'x' })] };
    await replaceAll(next);
    expect(await loadAll()).toEqual(next);
  });
});
