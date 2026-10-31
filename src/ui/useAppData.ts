import { useEffect, useMemo, useState } from 'react';
import { TAGS } from '../data/tags';
import type { PlayLogEntry, TagCorrection } from '../data/types';
import { applyCorrections } from '../engine/corrections';
import { restoreFromText, type ParseResult } from '../storage/backup';
import * as db from '../storage/db';
import type { AppData } from '../storage/db';

const EMPTY_DATA: AppData = { owned: [], corrections: {}, notes: {}, log: [] };

export function useAppData() {
  const [data, setData] = useState<AppData>(EMPTY_DATA);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    db.loadAll()
      .then(setData)
      .catch(() => setError('Could not open storage on this phone. Changes will not be saved.'))
      .finally(() => setLoaded(true));
  }, []);

  const tags = useMemo(() => applyCorrections(TAGS, data.corrections), [data.corrections]);

  /** Update the screen right away, then save; tell the player if saving failed. */
  async function write(update: (d: AppData) => AppData, persist: () => Promise<void>) {
    setData(update);
    try {
      await persist();
    } catch {
      setError('Your latest change was not saved.');
    }
  }

  return {
    data,
    tags,
    loaded,
    error,
    dismissError: () => setError(null),
    toggleOwned(tagId: string) {
      const nowOwned = !data.owned.includes(tagId);
      return write(
        (d) => ({ ...d, owned: nowOwned ? [...d.owned, tagId] : d.owned.filter((id) => id !== tagId) }),
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
      return write((d) => ({ ...d, log: [entry, ...d.log] }), () => db.addLogEntry(entry));
    },
    deleteLog(id: string) {
      return write((d) => ({ ...d, log: d.log.filter((e) => e.id !== id) }), () => db.deleteLogEntry(id));
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

export type AppStore = ReturnType<typeof useAppData>;
