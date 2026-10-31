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
 * Regular Tags are one physical tag per series (the official Galaxy page says they
 * appear throughout the series), so each printed Regular Tag has ONE id, its printed
 * code: `R-1-n` (Stardust) and `R-2-n` (Galaxy). It belongs to every set of its series
 * that lists it (see REGULAR_TAG_SETS). Stardust V1 lists none. The research doc records
 * that the Regular Tags are the same Pokémon in every set that lists them.
 */
export const REGULAR_TAG_SETS: Record<'1' | '2', SetId[]> = {
  '1': ['stardust-v2', 'stardust-v3', 'stardust-v4'],
  '2': ['galaxy-v1', 'galaxy-v2', 'galaxy-v3'],
};
const REGULAR_SERIES_NAME = { '1': 'Stardust', '2': 'Galaxy' } as const;
const REGULAR_ID = /^R-([12])-\d+$/;

/** Every set that lists the tag: several for a Regular Tag, one for any other tag. */
export function setsOfTagId(id: string): TagSet[] {
  if (isCustomId(id)) return [MY_TAGS];
  const series = REGULAR_ID.exec(id)?.[1] as '1' | '2' | undefined;
  if (series) return REGULAR_TAG_SETS[series].map(setById);
  const prefix = /^(\d-\d)-/.exec(id)?.[1];
  const set = SETS.find((s) => s.prefix === prefix);
  return set ? [set] : [];
}

export const setsOfTag = (tag: Pick<Tag, 'id'>): TagSet[] => setsOfTagId(tag.id);

export const isInSet = (tag: Pick<Tag, 'id'>, setId: AnySetId): boolean => setsOfTag(tag).some((s) => s.id === setId);

/** Short set label for display: the set name, or "Stardust (Regular)" for a Regular Tag. */
export function setLabelOfId(id: string): string {
  const series = REGULAR_ID.exec(id)?.[1] as '1' | '2' | undefined;
  if (series) return `${REGULAR_SERIES_NAME[series]} (Regular)`;
  return setsOfTagId(id)[0]?.name ?? '';
}
export const setLabel = (tag: Pick<Tag, 'id'>): string => setLabelOfId(tag.id);

/** What the physical tag shows. Equal to the id except for player-added tags, which may record a code. */
export const printedCode = (tag: Pick<Tag, 'id' | 'printedCode'>): string => tag.printedCode ?? tag.id;
