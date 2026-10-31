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
  dbPromise ??= openDB<HelperDB>(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore('owned');
      db.createObjectStore('corrections');
      db.createObjectStore('notes');
      db.createObjectStore('log', { keyPath: 'id' });
    },
  });
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
  await Promise.all([owned.clear(), corrections.clear(), notes.clear(), log.clear()]);
  await Promise.all([
    ...data.owned.map((id) => owned.put(true, id)),
    ...Object.entries(data.corrections).map(([id, c]) => corrections.put(c, id)),
    ...Object.entries(data.notes).map(([id, text]) => notes.put(text, id)),
    ...data.log.map((entry) => log.put(entry)),
    tx.done,
  ]);
}
