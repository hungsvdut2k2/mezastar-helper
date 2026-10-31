import { useEffect, useMemo, useRef, useState } from 'react';
import { TAGS } from '../data/tags';
import type { PlayLogEntry, Tag, TagCorrection } from '../data/types';
import { playsUsingTag } from '../engine/customTags';
import { applyCorrections } from '../engine/corrections';
import { blobToDataUrl, restoreFromText, type ParseResult } from '../storage/backup';
import * as db from '../storage/db';
import type { AppData } from '../storage/db';

const BLOCKED_MESSAGE = 'Close other Mezastar Helper tabs, then reopen the app.';
const EMPTY_DATA: AppData = { owned: [], corrections: {}, notes: {}, log: [], customTags: [] };

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
  // Photo changes, custom-tag changes and restores run one after another, so the stored data and the screen
  // cannot disagree about which of them happened last. A failed step never stops the ones queued behind it.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  function enqueue<T>(op: () => Promise<T>): Promise<T> {
    const result = queue.current.then(op);
    queue.current = result.catch(() => {});
    return result;
  }
  /** Show exactly these photos; every previous object URL is revoked. */
  const replacePhotoUrls = (blobs: Record<string, Blob>) => {
    for (const url of photoUrls.current.values()) URL.revokeObjectURL(url);
    photoUrls.current = alive.current ? new Map(Object.entries(blobs).map(([id, blob]) => [id, URL.createObjectURL(blob)])) : new Map();
    if (alive.current) syncPhotos();
  };
  // True when the stored photos could not be read at startup, so how many there are is unknown.
  const [photosLoadFailed, setPhotosLoadFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    alive.current = true;
    const stopBlockedWatch = db.onDbBlocked(() => setError(BLOCKED_MESSAGE));
    Promise.all([db.loadAll(), db.getAllPhotos().catch(() => null)])
      .then(([loadedData, blobs]) => {
        if (!alive.current) return;
        setData(loadedData);
        replacePhotoUrls(blobs ?? {});
        setPhotosLoadFailed(blobs === null);
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

  const tags = useMemo(
    () => applyCorrections([...TAGS, ...data.customTags], data.corrections),
    [data.customTags, data.corrections],
  );

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
    photosLoadFailed,
    dismissError: () => setError(null),
    /** Save an already-processed photo. The picture appears once it is stored. */
    async setPhoto(id: string, blob: Blob): Promise<boolean> {
      return enqueue(async () => {
        try {
          await db.putPhoto(id, blob);
        } catch {
          if (alive.current) setError('Your photo was not saved.');
          return false;
        }
        if (!alive.current) return true;
        const old = photoUrls.current.get(id);
        photoUrls.current.set(id, URL.createObjectURL(blob));
        if (old) URL.revokeObjectURL(old);
        syncPhotos();
        return true;
      });
    },
    async removePhoto(id: string): Promise<boolean> {
      return enqueue(async () => {
        try {
          await db.deletePhoto(id);
        } catch {
          if (alive.current) setError('Your photo was not removed.');
          return false;
        }
        if (!alive.current) return true;
        const old = photoUrls.current.get(id);
        photoUrls.current.delete(id);
        if (old) URL.revokeObjectURL(old);
        syncPhotos();
        return true;
      });
    },
    /** All stored photos as data URLs, for a backup file. */
    async exportPhotos(): Promise<Record<string, string>> {
      const blobs = await db.getAllPhotos();
      const entries = await Promise.all(Object.entries(blobs).map(async ([id, b]) => [id, await blobToDataUrl(b)] as const));
      return Object.fromEntries(entries);
    },
    /** Add or replace a player-made tag. Shown only once it is stored, so a failed save leaves no ghost tag. */
    saveCustomTag(tag: Tag): Promise<boolean> {
      return enqueue(async () => {
        try {
          await db.putCustomTag(tag);
        } catch {
          setError('Your tag was not saved.');
          return false;
        }
        setData({
          ...latest.current,
          customTags: [...latest.current.customTags.filter((t) => t.id !== tag.id), tag].sort((a, b) => a.id.localeCompare(b.id)),
        });
        return true;
      });
    },
    /** Delete a player-made tag with its owned flag, correction and photo. Refused while a saved play uses it. */
    deleteCustomTag(id: string): Promise<{ ok: true } | { ok: false; message: string }> {
      return enqueue(async () => {
        const plays = playsUsingTag(latest.current.log, id);
        if (plays > 0) return { ok: false as const, message: `Used in ${plays} saved ${plays === 1 ? 'play' : 'plays'} — can't delete.` };
        try {
          await db.deleteCustomTag(id);
        } catch {
          setError('Your tag was not deleted.');
          return { ok: false as const, message: 'Could not delete this tag.' };
        }
        const d = latest.current;
        const corrections = { ...d.corrections };
        delete corrections[id];
        setData({ ...d, customTags: d.customTags.filter((t) => t.id !== id), owned: d.owned.filter((o) => o !== id), corrections });
        const url = photoUrls.current.get(id);
        if (url) {
          URL.revokeObjectURL(url);
          photoUrls.current.delete(id);
          if (alive.current) syncPhotos();
        }
        return { ok: true as const };
      });
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
    restore(text: string): Promise<ParseResult> {
      return enqueue(async () => {
        try {
          const result = await restoreFromText(text);
          if (result.ok) {
            setData(result.data);
            replacePhotoUrls(result.photos);
            setPhotosLoadFailed(false);
          }
          return result;
        } catch {
          return { ok: false, error: 'Saving the restored data failed.' } as ParseResult;
        }
      });
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
