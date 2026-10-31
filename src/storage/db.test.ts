import type { PlayLogEntry } from '../data/types';
import { freshDb } from '../test/freshDb';
import { makeLogEntry, makeTag } from '../test/factories';
import { openDB } from 'idb';
import { onDbBlocked, putCustomTag, deleteCustomTag, addLogEntry, deleteLogEntry, deletePhoto, getAllPhotos, putPhoto, loadAll, replaceAll, saveCorrection, saveNote, setOwned } from './db';

beforeEach(freshDb);

describe('storage', () => {
  it('starts empty', async () => {
    expect(await loadAll()).toEqual({ owned: [], corrections: {}, notes: {}, log: [], customTags: [] });
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
    expect(await loadAll()).toEqual({ owned: [], corrections: {}, notes: {}, log: [], customTags: [] });
  });

  it('replaceAll swaps everything at once', async () => {
    await setOwned('1-3-001', true);
    await saveNote('lanes', 'old');
    const next = { owned: ['1-3-002'], corrections: {}, notes: { immunity: 'zero' }, log: [makeLogEntry({ id: 'x' })], customTags: [] };
    await replaceAll(next);
    expect(await loadAll()).toEqual(next);
  });

  it('replaceAll is all-or-nothing: a failing put keeps the old data', async () => {
    await setOwned('1-3-001', true);
    await saveNote('lanes', 'old');
    await addLogEntry(makeLogEntry({ id: 'keep' }));
    const before = await loadAll();
    const broken = {
      owned: ['1-3-002'],
      corrections: {},
      notes: { n: 'new' },
      log: [{ ...makeLogEntry({ id: 'x' }), id: undefined } as unknown as PlayLogEntry], // no key: put fails
      customTags: [],
    };
    await expect(replaceAll(broken)).rejects.toThrow();
    expect(await loadAll()).toEqual(before);
  });

  it('stores, lists and deletes photos', async () => {
    await putPhoto('1-3-001', new Blob(['abc'], { type: 'image/jpeg' }));
    const photos = await getAllPhotos();
    expect(Object.keys(photos)).toEqual(['1-3-001']);
    await deletePhoto('1-3-001');
    expect(await getAllPhotos()).toEqual({});
  });

  const bytesOf = (b: Blob) =>
  new Promise<number[]>((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve([...new Uint8Array(r.result as ArrayBuffer)]);
    r.readAsArrayBuffer(b);
  });

it('keeps photo bytes and type through put/get and replaceAll', async () => {
  await putPhoto('a', new Blob([new Uint8Array([1, 2, 3, 255])], { type: 'image/jpeg' }));
  const a = (await getAllPhotos()).a;
  expect(a.type).toBe('image/jpeg');
  expect(await bytesOf(a)).toEqual([1, 2, 3, 255]);
  const empty = { owned: [], corrections: {}, notes: {}, log: [], customTags: [] };
  await replaceAll(empty, { b: new Blob([new Uint8Array([9, 8])], { type: 'image/png' }) });
  const photos = await getAllPhotos();
  expect(Object.keys(photos)).toEqual(['b']);
  expect(photos.b.type).toBe('image/png');
  expect(await bytesOf(photos.b)).toEqual([9, 8]);
});

it('reports when an old connection blocks the upgrade, then finishes once it closes', async () => {
  const v1 = await openDB('mezastar-helper', 1, {
    upgrade(db) {
      db.createObjectStore('owned');
      db.createObjectStore('corrections');
      db.createObjectStore('notes');
      db.createObjectStore('log', { keyPath: 'id' });
    },
  });
  const blocked = vi.fn();
  const off = onDbBlocked(blocked);
  const loading = loadAll();
  await vi.waitFor(() => expect(blocked).toHaveBeenCalled());
  v1.close();
  expect((await loading).owned).toEqual([]);
  off();
});

it('replaceAll replaces photos too, and a failure keeps the old photos', async () => {
    await putPhoto('old', new Blob(['1']));
    const empty = { owned: [], corrections: {}, notes: {}, log: [], customTags: [] };
    await replaceAll(empty, { fresh: new Blob(['22']) });
    expect(Object.keys(await getAllPhotos())).toEqual(['fresh']);
    const broken = { ...empty, log: [{ id: undefined } as unknown as PlayLogEntry] };
    await expect(replaceAll(broken, {})).rejects.toThrow();
    expect(Object.keys(await getAllPhotos())).toEqual(['fresh']);
  });

  it('stores custom tags and deletes one with its owned flag, correction and photo', async () => {
    const tag = makeTag('my-1');
    await putCustomTag(tag);
    await putCustomTag(makeTag('my-2'));
    await setOwned('my-1', true);
    await saveCorrection('my-1', { stats: { attack: 1 } });
    await putPhoto('my-1', new Blob(['x']));
    expect((await loadAll()).customTags.map((t) => t.id)).toEqual(['my-1', 'my-2']);
    await deleteCustomTag('my-1');
    const data = await loadAll();
    expect(data.customTags.map((t) => t.id)).toEqual(['my-2']);
    expect(data.owned).toEqual([]);
    expect(data.corrections).toEqual({});
    expect(await getAllPhotos()).toEqual({});
  });

  it('replaceAll replaces custom tags too', async () => {
    await putCustomTag(makeTag('my-old'));
    await replaceAll({ owned: [], corrections: {}, notes: {}, log: [], customTags: [makeTag('my-new')] });
    expect((await loadAll()).customTags.map((t) => t.id)).toEqual(['my-new']);
  });

  it('upgrades a version 1 database without losing data', async () => {
    const v1 = await openDB('mezastar-helper', 1, {
      upgrade(db) {
        db.createObjectStore('owned');
        db.createObjectStore('corrections');
        db.createObjectStore('notes');
        db.createObjectStore('log', { keyPath: 'id' });
      },
    });
    await v1.put('owned', true, '1-3-001');
    await v1.put('notes', 'keep me', 'lanes');
    await v1.put('log', makeLogEntry({ id: 'a' }));
    v1.close();
    const data = await loadAll();
    expect(data.owned).toEqual(['1-3-001']);
    expect(data.notes).toEqual({ lanes: 'keep me' });
    expect(data.log.map((e) => e.id)).toEqual(['a']);
    expect(await getAllPhotos()).toEqual({});
    expect(data.customTags).toEqual([]);
    await putCustomTag(makeTag('my-1'));
    expect((await loadAll()).customTags).toHaveLength(1);
  });
});
