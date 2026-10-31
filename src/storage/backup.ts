import { POKEMON_TYPES, type PlayLogEntry, type PokemonType, type TagCorrection } from '../data/types';
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

const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;
const isType = (v: unknown): v is PokemonType => (POKEMON_TYPES as readonly unknown[]).includes(v);
const isOneOf = (list: readonly string[]) => (v: unknown) => isString(v) && list.includes(v);
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(isString);
/** A field that may be missing entirely. */
const optional = (v: unknown, check: (x: unknown) => boolean) => v === undefined || check(v);

const STAT_KEYS = ['hp', 'attack', 'defense', 'speed'];

function isCorrection(v: unknown): v is TagCorrection {
  if (!isObject(v)) return false;
  const { grade, types, pokenergy, stats, move } = v;
  return (
    optional(grade, (g) => g === null || (Number.isInteger(g) && (g as number) >= 2 && (g as number) <= 6)) &&
    optional(types, (t) => Array.isArray(t) && t.length >= 1 && t.length <= 2 && t.every(isType) && new Set(t).size === t.length) &&
    optional(pokenergy, (p) => p === null || isCount(p)) &&
    optional(
      stats,
      (s) => isObject(s) && STAT_KEYS.every((k) => optional(s[k], (x) => x === null || isCount(x))),
    ) &&
    optional(move, (m) => m === null || (isObject(m) && isString(m.name) && isType(m.type)))
  );
}

function isTurn(v: unknown): boolean {
  return (
    isObject(v) &&
    isString(v.attacker) &&
    optional(v.aimedAt, isString) &&
    optional(v.defeated, isString) &&
    optional(v.predictedDefeat, isBool)
  );
}

function isLogEntry(v: unknown): v is PlayLogEntry {
  return (
    isObject(v) &&
    isString(v.id) &&
    isString(v.date) &&
    optional(v.location, isString) &&
    isOneOf(['battle', 'catchNow', 'specialTagBattle'])(v.mode) &&
    isString(v.boss) &&
    isStringArray(v.cronies) &&
    isString(v.target) &&
    isBool(v.superstarAppeared) &&
    isStringArray(v.teamUsed) &&
    Array.isArray(v.turns) &&
    v.turns.every(isTurn) &&
    (v.cronyDefeatedCount === 0 || v.cronyDefeatedCount === 1 || v.cronyDefeatedCount === 2) &&
    isBool(v.bossDefeated) &&
    optional(v.ballType, isOneOf(['poke', 'great', 'ultra', 'master'])) &&
    (v.caught === null || isString(v.caught)) &&
    optional(v.note, isString)
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
  if (!isObject(corrections) || !Object.values(corrections).every(isCorrection)) return damaged('corrections');
  if (!isObject(notes) || !Object.values(notes).every(isString)) return damaged('notes');
  if (!Array.isArray(log) || !log.every(isLogEntry) || new Set(log.map((e) => e.id)).size !== log.length) {
    return damaged('play log');
  }
  return {
    ok: true,
    data: {
      owned,
      corrections: corrections as Record<string, TagCorrection>,
      notes: notes as Record<string, string>,
      log: [...log].sort((a, b) => b.date.localeCompare(a.date)),
    },
  };
}

/** Validate first; only a valid file replaces the data on the phone. */
export async function restoreFromText(text: string): Promise<ParseResult> {
  const result = parseBackup(text);
  if (result.ok) await replaceAll(result.data);
  return result;
}
