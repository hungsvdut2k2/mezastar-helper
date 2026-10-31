import { useEffect, useMemo, useRef, useState } from 'react';
import { TAGS } from '../data/tags';
import type { PlayLogEntry, TagCorrection } from '../data/types';
import { applyCorrections } from '../engine/corrections';
import { restoreFromText, type ParseResult } from '../storage/backup';
import * as db from '../storage/db';
import type { AppData } from '../storage/db';

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
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    db.loadAll()
      .then(setData)
      .catch(() => setError('Could not open storage on this phone. Changes will not be saved.'))
      .finally(() => setLoaded(true));
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
    dismissError: () => setError(null),
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
        if (result.ok) setData(result.data);
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
