import type { PlayLogEntry, TagCorrection } from '../data/types';
import { replaceAll, type AppData } from './db';

export const BACKUP_VERSION = 1;

export type Backup = AppData & { app: 'mezastar-helper'; version: number; exportedAt: string };
export type ParseResult = { ok: true; data: AppData } | { ok: false; error: string };

export function makeBackup(data: AppData, now = new Date()): Backup {
  return { app: 'mezastar-helper', version: BACKUP_VERSION, exportedAt: now.toISOString(), ...data };
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isString = (v: unknown): v is string => typeof v === 'string';

function isLogEntry(v: unknown): v is PlayLogEntry {
  return (
    isObject(v) &&
    isString(v.id) &&
    isString(v.date) &&
    isString(v.boss) &&
    Array.isArray(v.cronies) &&
    Array.isArray(v.turns)
  );
}

const damaged = (part: string): ParseResult => ({ ok: false, error: `The backup's ${part} section is damaged.` });

export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This file is not a backup (not valid JSON).' };
  }
  if (!isObject(raw) || raw.app !== 'mezastar-helper') {
    return { ok: false, error: 'This file is not a Mezastar Helper backup.' };
  }
  if (raw.version !== BACKUP_VERSION) {
    return { ok: false, error: `Unsupported backup version: ${String(raw.version)}.` };
  }
  const { owned, corrections, notes, log } = raw;
  if (!Array.isArray(owned) || !owned.every(isString)) return damaged('owned tags');
  if (!isObject(corrections) || !Object.values(corrections).every(isObject)) return damaged('corrections');
  if (!isObject(notes) || !Object.values(notes).every(isString)) return damaged('notes');
  if (!Array.isArray(log) || !log.every(isLogEntry)) return damaged('play log');
  return {
    ok: true,
    data: {
      owned,
      corrections: corrections as Record<string, TagCorrection>,
      notes: notes as Record<string, string>,
      log,
    },
  };
}

/** Validate first; only a valid file replaces the data on the phone. */
export async function restoreFromText(text: string): Promise<ParseResult> {
  const result = parseBackup(text);
  if (result.ok) await replaceAll(result.data);
  return result;
}
