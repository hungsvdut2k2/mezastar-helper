import { CUSTOM_ID_PATTERN, CUSTOM_SOURCE, MAX_CODE_LENGTH, MAX_MOVE_LENGTH, MAX_NAME_LENGTH } from '../data/customTag';
import { isCustomId } from '../data/setInfo';
import { GIMMICKS, POKEMON_TYPES, type Gimmick, type Grade, type PlayLogEntry, type PokemonType, type Tag, type TagCorrection } from '../data/types';
import { TAGS } from '../data/tags';
import { replaceAll, type AppData } from './db';

export const BACKUP_VERSION = 1;

export type Backup = AppData & {
  app: 'mezastar-helper';
  version: number;
  exportedAt: string;
  /** Tag photos as data URLs; absent in backups made before photos existed. */
  photos?: Record<string, string>;
};
export type ParseResult =
  | { ok: true; data: AppData; photos: Record<string, Blob> }
  | { ok: false; error: string };

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const PHOTO_PREFIX = /^data:image\/(jpeg|png|webp);base64,/;
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

export function makeBackup(data: AppData, now = new Date(), photos: Record<string, string> = {}): Backup {
  const backup: Backup = { app: 'mezastar-helper', version: BACKUP_VERSION, exportedAt: now.toISOString(), ...data };
  if (Object.keys(photos).length > 0) backup.photos = photos;
  return backup;
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(blob);
  });
}

/** Decoded byte size of a base64 payload (assumes valid base64). */
const base64Bytes = (b64: string) => Math.floor((b64.length * 3) / 4) - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0);

/** Returns null unless the string is an allowed image data URL within the size limit. */
export function dataUrlToBlob(url: unknown): Blob | null {
  if (!isString(url)) return null;
  const m = PHOTO_PREFIX.exec(url);
  if (!m) return null;
  const b64 = url.slice(m[0].length);
  if (b64.length % 4 !== 0 || !BASE64.test(b64) || base64Bytes(b64) > MAX_PHOTO_BYTES) return null;
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: `image/${m[1]}` });
  } catch {
    return null;
  }
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
      (s) => isObject(s) && Object.keys(s).every((k) => STAT_KEYS.includes(k)) && STAT_KEYS.every((k) => optional(s[k], (x) => x === null || isCount(x))),
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

const isText = (max: number) => (v: unknown): v is string => isString(v) && v.trim().length > 0 && v.length <= max;
const distinctTypes = (t: unknown, max: number): t is PokemonType[] =>
  Array.isArray(t) && t.length >= 1 && t.length <= max && t.every(isType) && new Set(t).size === t.length;

/** A clean Tag built from a backup entry, or null if anything about it is off. Unknown keys are dropped. */
function parseCustomTag(v: unknown): Tag | null {
  if (!isObject(v)) return null;
  const { id, printedCode, name, grade, types, move, gimmick, legendary, mythical } = v;
  if (!isString(id) || !CUSTOM_ID_PATTERN.test(id)) return null;
  if (!isText(MAX_CODE_LENGTH)(printedCode) || !isText(MAX_NAME_LENGTH)(name)) return null;
  if (!(grade === null || (Number.isInteger(grade) && (grade as number) >= 1 && (grade as number) <= 6))) return null;
  if (!distinctTypes(types, 2)) return null;
  if (!(move === null || (isObject(move) && isText(MAX_MOVE_LENGTH)(move.name) && isType(move.type)))) return null;
  if (!(gimmick === null || (isObject(gimmick) && isOneOf(GIMMICKS)(gimmick.kind)))) return null;
  if (!isBool(legendary) || !isBool(mythical)) return null;
  return {
    id,
    printedCode,
    name,
    grade: grade as Grade | null,
    types,
    pokenergy: null,
    stats: { hp: null, attack: null, defense: null, speed: null },
    move: move === null ? null : { name: (move as { name: string }).name, type: (move as { type: PokemonType }).type },
    gimmick: gimmick === null ? null : { kind: (gimmick as { kind: Gimmick }).kind, moveName: null, moveType: null },
    legendary,
    mythical,
    sources: [CUSTOM_SOURCE],
  };
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
  const customTags: Tag[] = [];
  if (raw.customTags !== undefined) {
    if (!Array.isArray(raw.customTags)) return damaged('custom tags');
    for (const entry of raw.customTags) {
      const tag = parseCustomTag(entry);
      if (!tag || customTags.some((t) => t.id === tag.id)) return damaged('custom tags');
      customTags.push(tag);
    }
  }
  // Data about a player-added tag only makes sense when that tag is in the backup too.
  const customIds = new Set(customTags.map((t) => t.id));
  const known = new Set([...TAGS.map((t) => t.id), ...customIds]);
  const refersToMissingCustom = (ids: string[]) => ids.some((id) => isCustomId(id) && !customIds.has(id));
  if (refersToMissingCustom(owned)) return damaged('owned tags');
  if (refersToMissingCustom(Object.keys(corrections))) return damaged('corrections');
  const photos: Record<string, Blob> = {};
  if (raw.photos !== undefined) {
    if (!isObject(raw.photos)) return damaged('photos');
    for (const [id, url] of Object.entries(raw.photos)) {
      const blob = known.has(id) ? dataUrlToBlob(url) : null;
      if (!blob) return damaged('photos');
      photos[id] = blob;
    }
  }
  return {
    ok: true,
    photos,
    data: {
      owned,
      corrections: corrections as Record<string, TagCorrection>,
      notes: notes as Record<string, string>,
      log: [...log].sort((a, b) => b.date.localeCompare(a.date)),
      customTags: customTags.sort((a, b) => a.id.localeCompare(b.id)),
    },
  };
}

/** Validate first; only a valid file replaces the data on the phone. */
export async function restoreFromText(text: string): Promise<ParseResult> {
  const result = parseBackup(text);
  if (result.ok) await replaceAll(result.data, result.photos);
  return result;
}
