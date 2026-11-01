import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { PlayLogEntry, Tag, TagCorrection } from '../data/types';

export type AppData = {
  owned: string[];
  corrections: Record<string, TagCorrection>;
  notes: Record<string, string>;
  log: PlayLogEntry[];
  /** Tags the player added (ids start with "my-"). */
  customTags: Tag[];
};

interface HelperDB extends DBSchema {
  owned: { key: string; value: boolean };
  corrections: { key: string; value: TagCorrection };
  notes: { key: string; value: string };
  log: { key: string; value: PlayLogEntry };
  photos: { key: string; value: PhotoRecord };
  customTags: { key: string; value: Tag };
}

/** Photos are stored as plain bytes, not Blobs: older WebKit versions mishandle Blobs in IndexedDB. */
type PhotoRecord = { type: string; bytes: ArrayBuffer };

function readBytes(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsArrayBuffer(blob);
  });
}
const toRecord = async (blob: Blob): Promise<PhotoRecord> => ({ type: blob.type, bytes: await readBytes(blob) });
const toBlob = (r: PhotoRecord) => new Blob([r.bytes], { type: r.type });

const DB_NAME = 'mezastar-helper';
let dbPromise: Promise<IDBPDatabase<HelperDB>> | null = null;

const blockedListeners = new Set<() => void>();
/** Called when opening is stuck because another tab still holds an older version open. Returns an unsubscribe. */
export function onDbBlocked(listener: () => void) {
  blockedListeners.add(listener);
  return () => void blockedListeners.delete(listener);
}

function getDb() {
  if (!dbPromise) {
    const opening = openDB<HelperDB>(DB_NAME, 3, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('owned');
          db.createObjectStore('corrections');
          db.createObjectStore('notes');
          db.createObjectStore('log', { keyPath: 'id' });
        }
        // Version 2 shipped only the photos store; customTags arrived in version 3. Each step is
        // guarded so a database from any earlier build (including a v2 with photos only) upgrades cleanly.
        if (oldVersion < 2 && !db.objectStoreNames.contains('photos')) {
          db.createObjectStore('photos');
        }
        if (oldVersion < 3 && !db.objectStoreNames.contains('customTags')) {
          db.createObjectStore('customTags', { keyPath: 'id' });
        }
      },
      // An old tab keeps the previous version open, so our upgrade has to wait for it.
      blocked() {
        blockedListeners.forEach((l) => l());
      },
      // Another tab wants to upgrade or delete the database: let go so it can.
      blocking() {
        dbPromise = null;
        opening.then((db) => db.close()).catch(() => {});
      },
      // The browser closed the connection unexpectedly: reconnect on next use.
      terminated() {
        dbPromise = null;
      },
    });
    dbPromise = opening;
    // A rejected open must not be cached forever.
    opening.catch(() => {
      if (dbPromise === opening) dbPromise = null;
    });
  }
  return dbPromise;
}

/** Tests swap in a fresh fake IndexedDB; this forgets the cached connection. */
export function resetDbConnection() {
  dbPromise = null;
}

function zip<V>(keys: string[], values: V[]): Record<string, V> {
  return Object.fromEntries(keys.map((k, i) => [k, values[i]]));
}

export async function loadAll(): Promise<AppData> {
  const db = await getDb();
  const [owned, correctionIds, corrections, noteIds, notes, log, customTags] = await Promise.all([
    db.getAllKeys('owned'),
    db.getAllKeys('corrections'),
    db.getAll('corrections'),
    db.getAllKeys('notes'),
    db.getAll('notes'),
    db.getAll('log'),
    db.getAll('customTags'),
  ]);
  return {
    owned,
    corrections: zip(correctionIds, corrections),
    notes: zip(noteIds, notes),
    log: log.sort((a, b) => b.date.localeCompare(a.date)),
    customTags: customTags.sort((a, b) => a.id.localeCompare(b.id)),
  };
}

/** Tag photos by tag id. Kept out of AppData: they are binary and loaded/backed up separately. */
export async function getAllPhotos(): Promise<Record<string, Blob>> {
  const db = await getDb();
  const [ids, records] = await Promise.all([db.getAllKeys('photos'), db.getAll('photos')]);
  return zip(ids, records.map(toBlob));
}

export async function putPhoto(id: string, blob: Blob) {
  const record = await toRecord(blob);
  const db = await getDb();
  await db.put('photos', record, id);
}

export async function deletePhoto(id: string) {
  const db = await getDb();
  await db.delete('photos', id);
}

export async function putCustomTag(tag: Tag) {
  const db = await getDb();
  await db.put('customTags', tag);
}

/** Remove a custom tag together with its owned flag, correction and photo, in one transaction. */
export async function deleteCustomTag(id: string) {
  const db = await getDb();
  const tx = db.transaction(['customTags', 'owned', 'corrections', 'photos'], 'readwrite');
  await Promise.all([
    tx.objectStore('customTags').delete(id),
    tx.objectStore('owned').delete(id),
    tx.objectStore('corrections').delete(id),
    tx.objectStore('photos').delete(id),
    tx.done,
  ]);
}

export async function setOwned(tagId: string, owned: boolean) {
  const db = await getDb();
  if (owned) await db.put('owned', true, tagId);
  else await db.delete('owned', tagId);
}

export async function saveCorrection(tagId: string, correction: TagCorrection | null) {
  const db = await getDb();
  if (correction) await db.put('corrections', correction, tagId);
  else await db.delete('corrections', tagId);
}

export async function saveNote(id: string, text: string) {
  const db = await getDb();
  await db.put('notes', text, id);
}

export async function addLogEntry(entry: PlayLogEntry) {
  const db = await getDb();
  await db.put('log', entry);
}

export async function deleteLogEntry(id: string) {
  const db = await getDb();
  await db.delete('log', id);
}

/** Replace all data in one transaction: either everything is written or nothing changes. */
export async function replaceAll(data: AppData, photos: Record<string, Blob> = {}) {
  // Read the bytes first: a transaction closes if we wait on anything else while it is open.
  const records = await Promise.all(Object.entries(photos).map(async ([id, blob]) => [id, await toRecord(blob)] as const));
  const db = await getDb();
  const tx = db.transaction(['owned', 'corrections', 'notes', 'log', 'photos', 'customTags'], 'readwrite');
  const owned = tx.objectStore('owned');
  const corrections = tx.objectStore('corrections');
  const notes = tx.objectStore('notes');
  const log = tx.objectStore('log');
  const photoStore = tx.objectStore('photos');
  const customStore = tx.objectStore('customTags');
  const pending: Promise<unknown>[] = [tx.done];
  try {
    // Requests run in order inside the transaction, so clear-then-put needs no waiting in between.
    pending.push(owned.clear(), corrections.clear(), notes.clear(), log.clear(), photoStore.clear(), customStore.clear());
    for (const id of data.owned) pending.push(owned.put(true, id));
    for (const [id, c] of Object.entries(data.corrections)) pending.push(corrections.put(c, id));
    for (const [id, text] of Object.entries(data.notes)) pending.push(notes.put(text, id));
    for (const entry of data.log) pending.push(log.put(entry));
    for (const tag of data.customTags) pending.push(customStore.put(tag));
    for (const [id, record] of records) pending.push(photoStore.put(record, id));
    await Promise.all(pending);
  } catch (err) {
    // A synchronous failure would otherwise let the transaction commit the clears.
    // Requests already queued reject with AbortError; mark them handled.
    for (const p of pending) p.catch(() => {});
    try {
      tx.abort();
    } catch {
      /* already finished or aborted */
    }
    throw err;
  }
}
