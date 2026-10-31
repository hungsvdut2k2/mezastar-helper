import type { Tag } from './types';

export type SetId =
  | 'stardust-v1' | 'stardust-v2' | 'stardust-v3' | 'stardust-v4'
  | 'galaxy-v1' | 'galaxy-v2' | 'galaxy-v3';

/** Pseudo-set for tags the player added themselves. Not part of SETS (the official list). */
export const MY_TAGS_ID = 'my-tags';
export type AnySetId = SetId | typeof MY_TAGS_ID;

export type TagSet = {
  id: AnySetId;
  name: string;
  /** Official Asia-English tag list for the set. */
  url: string;
  /** Numbered tags are printed `<prefix>-NNN`, e.g. "1-3-002". */
  prefix: string;
};

const BASE = 'https://world.pokemonmezastar.com/sg/tag/';

/** In the order the official site's version switcher lists them. */
export const SETS: TagSet[] = [
  { id: 'stardust-v1', name: 'Stardust V1', url: `${BASE}28933/`, prefix: '1-1' },
  { id: 'stardust-v2', name: 'Stardust V2', url: `${BASE}31437/`, prefix: '1-2' },
  { id: 'stardust-v3', name: 'Stardust V3', url: `${BASE}33112/`, prefix: '1-3' },
  { id: 'stardust-v4', name: 'Stardust V4', url: `${BASE}34928/`, prefix: '1-4' },
  { id: 'galaxy-v1', name: 'Galaxy V1', url: `${BASE}36251/`, prefix: '2-1' },
  { id: 'galaxy-v2', name: 'Galaxy V2', url: `${BASE}37860/`, prefix: '2-2' },
  { id: 'galaxy-v3', name: 'Galaxy V3', url: `${BASE}39325/`, prefix: '2-3' },
];

export const MY_TAGS: TagSet = { id: MY_TAGS_ID, name: 'My tags', url: '', prefix: 'my' };

/** Ids of player-added tags always start with this, so they can never equal a shipped id (those start with a digit or "R-"). */
export const CUSTOM_ID_PREFIX = 'my-';
export const isCustomId = (id: string) => id.startsWith(CUSTOM_ID_PREFIX);

export function setById(id: AnySetId): TagSet {
  if (id === MY_TAGS_ID) return MY_TAGS;
  const set = SETS.find((s) => s.id === id);
  if (!set) throw new Error(`Unknown set ${id}`);
  return set;
}

/**
 * Tag ids are unique app-wide. Numbered tags use the printed code (`1-3-002`).
 * Regular Tags are printed `R-1-n` (Stardust) or `R-2-n` (Galaxy) and the same code
 * appears in several sets, so only the original Stardust V3 ones keep the bare printed
 * code (`R-1-1`, shipped first); all others are `<set prefix>-R-<n>`, e.g. `1-2-R-1`
 * and `2-3-R-2`. The printed code is kept in `Tag.printedCode` for display.
 */
export function regularTagId(set: TagSet, n: number): string {
  return set.id === 'stardust-v3' ? `R-1-${n}` : `${set.prefix}-R-${n}`;
}

/** The set a tag id belongs to, derived from its prefix. */
export function setOfTagId(id: string): TagSet | undefined {
  if (isCustomId(id)) return MY_TAGS;
  if (/^R-1-\d+$/.test(id)) return setById('stardust-v3');
  const prefix = /^(\d-\d)-/.exec(id)?.[1];
  return SETS.find((s) => s.prefix === prefix);
}

export const setOfTag = (tag: Pick<Tag, 'id'>): TagSet | undefined => setOfTagId(tag.id);

/** What the physical tag shows, e.g. "R-2-1" for the namespaced id "2-3-R-1". */
export const printedCode = (tag: Pick<Tag, 'id' | 'printedCode'>): string => tag.printedCode ?? tag.id;
