import { useEffect, useMemo, useRef, useState } from 'react';
import { TAGS } from '../data/tags';
import type { PlayLogEntry, TagCorrection } from '../data/types';
import { applyCorrections } from '../engine/corrections';
import { blobToDataUrl, restoreFromText, type ParseResult } from '../storage/backup';
import * as db from '../storage/db';
import type { AppData } from '../storage/db';

const BLOCKED_MESSAGE = 'Close other Mezastar Helper tabs, then reopen the app.';
const EMPTY_DATA: AppData = { owned: [], corrections: {}, notes: {}, log: [] };

type Pending = { newest: number; inflight: number; saved: PlayLogEntry | undefined };
type Rollback = {
  key: string;
  /** The value this write stores (undefined for a delete). */
  value: PlayLogEntry | undefined;
  /** The stored value as currently shown. */
  stored: (d: AppData) => PlayLogEntry | undefined;
  /** Put `saved` back (or remove the entry when undefined). */
  restore: (d: AppData, saved: PlayLogEntry | undefined) => AppData;
};

export function useAppData() {
  const [data, setDataState] = useState<AppData>(EMPTY_DATA);
  // Always the newest data, so quick taps never work from a stale snapshot.
  const latest = useRef<AppData>(EMPTY_DATA);
  const setData = (next: AppData) => {
    latest.current = next;
    setDataState(next);
  };
  // Tag photos as object URLs. The ref is the truth (so URLs can be revoked); the state is a copy for rendering.
  const photoUrls = useRef(new Map<string, string>());
  const [photos, setPhotosState] = useState<Map<string, string>>(new Map());
  const syncPhotos = () => setPhotosState(new Map(photoUrls.current));
  // False once the app is gone: async work that finishes later must not leave object URLs behind.
  const alive = useRef(false);
  // Counts completed restores. A photo change that began before one must not touch the restored photos.
  const restoreGeneration = useRef(0);
  /** Show exactly these photos; every previous object URL is revoked. */
  const replacePhotoUrls = (blobs: Record<string, Blob>) => {
    for (const url of photoUrls.current.values()) URL.revokeObjectURL(url);
    photoUrls.current = alive.current ? new Map(Object.entries(blobs).map(([id, blob]) => [id, URL.createObjectURL(blob)])) : new Map();
    if (alive.current) syncPhotos();
  };
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    alive.current = true;
    const stopBlockedWatch = db.onDbBlocked(() => setError(BLOCKED_MESSAGE));
    Promise.all([db.loadAll(), db.getAllPhotos().catch(() => ({}) as Record<string, Blob>)])
      .then(([loadedData, blobs]) => {
        if (!alive.current) return;
        setData(loadedData);
        replacePhotoUrls(blobs);
        // The upgrade was only waiting for another tab: all fine now.
        setError((e) => (e === BLOCKED_MESSAGE ? null : e));
      })
      .catch(() => setError('Could not open storage on this phone. Changes will not be saved.'))
      .finally(() => setLoaded(true));
    // Let go of the object URLs when the app goes away.
    return () => {
      alive.current = false;
      stopBlockedWatch();
      for (const url of photoUrls.current.values()) URL.revokeObjectURL(url);
      photoUrls.current.clear();
    };
  }, []);

  const tags = useMemo(() => applyCorrections(TAGS, data.corrections), [data.corrections]);

  // Per key with a rollback: the newest write, how many are still saving, and the last value known to be in storage.
  // An old failure never undoes a newer attempt; a failed newest write goes back to what is actually stored.
  const pending = useRef(new Map<string, Pending>());
  const writeCounter = useRef(0);

  /**
   * Update the screen right away, then save; tell the player if saving failed. Resolves to true only if saved.
   * With `rollback`, a failed save also puts the last persisted value for that key back on screen (unless a newer
   * write for the same key exists).
   */
  async function write(
    update: (d: AppData) => AppData,
    persist: () => Promise<void>,
    rollback?: Rollback,
  ): Promise<boolean> {
    const mine = ++writeCounter.current;
    let slot: Pending | undefined;
    if (rollback) {
      slot = pending.current.get(rollback.key);
      // With nothing in flight, what is on screen right now is what is stored.
      if (!slot) slot = { newest: mine, inflight: 0, saved: rollback.stored(latest.current) };
      slot.newest = mine;
      slot.inflight++;
      pending.current.set(rollback.key, slot);
    }
    setData(update(latest.current));
    try {
      await persist();
      if (rollback && slot) slot.saved = rollback.value;
      return true;
    } catch {
      if (rollback && slot && slot.newest === mine) setData(rollback.restore(latest.current, slot.saved));
      setError('Your latest change was not saved.');
      return false;
    } finally {
      if (rollback && slot && --slot.inflight === 0) pending.current.delete(rollback.key);
    }
  }

  return {
    data,
    tags,
    loaded,
    error,
    photos,
    dismissError: () => setError(null),
    /** Save an already-processed photo. The picture appears once it is stored. */
    async setPhoto(id: string, blob: Blob): Promise<boolean> {
      const generation = restoreGeneration.current;
      try {
        await db.putPhoto(id, blob);
      } catch {
        if (alive.current) setError('Your photo was not saved.');
        return false;
      }
      // A restore finished meanwhile: it decides what the photos are now.
      if (generation !== restoreGeneration.current) return false;
      if (!alive.current) return true;
      const old = photoUrls.current.get(id);
      photoUrls.current.set(id, URL.createObjectURL(blob));
      if (old) URL.revokeObjectURL(old);
      syncPhotos();
      return true;
    },
    async removePhoto(id: string): Promise<boolean> {
      const generation = restoreGeneration.current;
      try {
        await db.deletePhoto(id);
      } catch {
        if (alive.current) setError('Your photo was not removed.');
        return false;
      }
      if (generation !== restoreGeneration.current) return false;
      if (!alive.current) return true;
      const old = photoUrls.current.get(id);
      photoUrls.current.delete(id);
      if (old) URL.revokeObjectURL(old);
      syncPhotos();
      return true;
    },
    /** All stored photos as data URLs, for a backup file. */
    async exportPhotos(): Promise<Record<string, string>> {
      const blobs = await db.getAllPhotos();
      const entries = await Promise.all(Object.entries(blobs).map(async ([id, b]) => [id, await blobToDataUrl(b)] as const));
      return Object.fromEntries(entries);
    },
    toggleOwned(tagId: string) {
      const nowOwned = !latest.current.owned.includes(tagId);
      return write(
        (d) => ({
          ...d,
          owned: nowOwned ? [...d.owned.filter((id) => id !== tagId), tagId] : d.owned.filter((id) => id !== tagId),
        }),
        () => db.setOwned(tagId, nowOwned),
      );
    },
    saveCorrection(tagId: string, correction: TagCorrection | null) {
      return write(
        (d) => {
          const corrections = { ...d.corrections };
          if (correction) corrections[tagId] = correction;
          else delete corrections[tagId];
          return { ...d, corrections };
        },
        () => db.saveCorrection(tagId, correction),
      );
    },
    saveNote(id: string, text: string) {
      return write((d) => ({ ...d, notes: { ...d.notes, [id]: text } }), () => db.saveNote(id, text));
    },
    addLog(entry: PlayLogEntry) {
      return write(
        (d) => ({ ...d, log: [entry, ...d.log.filter((e) => e.id !== entry.id)] }),
        () => db.addLogEntry(entry),
        // An unsaved play must not look saved in Stats; the form keeps its data and can retry.
        logRollback(entry.id, entry),
      );
    },
    deleteLog(id: string) {
      return write(
        (d) => ({ ...d, log: d.log.filter((e) => e.id !== id) }),
        () => db.deleteLogEntry(id),
        logRollback(id, undefined),
      );
    },
    async restore(text: string): Promise<ParseResult> {
      try {
        const result = await restoreFromText(text);
        if (result.ok) {
          restoreGeneration.current++;
          setData(result.data);
          replacePhotoUrls(result.photos);
        }
        return result;
      } catch {
        return { ok: false, error: 'Saving the restored data failed.' };
      }
    },
  };
}

function logRollback(id: string, value: PlayLogEntry | undefined): Rollback {
  return {
    key: `log:${id}`,
    value,
    stored: (d) => d.log.find((e) => e.id === id),
    restore: (d, saved) => {
      if (!saved) return { ...d, log: d.log.filter((e) => e.id !== id) };
      return d.log.some((e) => e.id === id)
        ? { ...d, log: d.log.map((e) => (e.id === id ? saved : e)) }
        : { ...d, log: [saved, ...d.log] };
    },
  };
}

export type AppStore = ReturnType<typeof useAppData>;
