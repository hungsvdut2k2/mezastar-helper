import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { PlayLogEntry, TagCorrection } from '../data/types';

export type AppData = {
  owned: string[];
  corrections: Record<string, TagCorrection>;
  notes: Record<string, string>;
  log: PlayLogEntry[];
};

interface HelperDB extends DBSchema {
  owned: { key: string; value: boolean };
  corrections: { key: string; value: TagCorrection };
  notes: { key: string; value: string };
  log: { key: string; value: PlayLogEntry };
}

const DB_NAME = 'mezastar-helper';
let dbPromise: Promise<IDBPDatabase<HelperDB>> | null = null;

function getDb() {
  if (!dbPromise) {
    const opening = openDB<HelperDB>(DB_NAME, 1, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('owned');
          db.createObjectStore('corrections');
          db.createObjectStore('notes');
          db.createObjectStore('log', { keyPath: 'id' });
        }
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
  const [owned, correctionIds, corrections, noteIds, notes, log] = await Promise.all([
    db.getAllKeys('owned'),
    db.getAllKeys('corrections'),
    db.getAll('corrections'),
    db.getAllKeys('notes'),
    db.getAll('notes'),
    db.getAll('log'),
  ]);
  return {
    owned,
    corrections: zip(correctionIds, corrections),
    notes: zip(noteIds, notes),
    log: log.sort((a, b) => b.date.localeCompare(a.date)),
  };
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
export async function replaceAll(data: AppData) {
  const db = await getDb();
  const tx = db.transaction(['owned', 'corrections', 'notes', 'log'], 'readwrite');
  const owned = tx.objectStore('owned');
  const corrections = tx.objectStore('corrections');
  const notes = tx.objectStore('notes');
  const log = tx.objectStore('log');
  const pending: Promise<unknown>[] = [tx.done];
  try {
    // Requests run in order inside the transaction, so clear-then-put needs no waiting in between.
    pending.push(owned.clear(), corrections.clear(), notes.clear(), log.clear());
    for (const id of data.owned) pending.push(owned.put(true, id));
    for (const [id, c] of Object.entries(data.corrections)) pending.push(corrections.put(c, id));
    for (const [id, text] of Object.entries(data.notes)) pending.push(notes.put(text, id));
    for (const entry of data.log) pending.push(log.put(entry));
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
