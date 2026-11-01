import { MY_TAGS, MY_TAGS_ID, SETS, isInSet, type AnySetId } from '../data/setInfo';
import type { Tag } from '../data/types';

export type SetChoice = AnySetId | 'all';
/** Stardust V3 is the set the app launched with. */
export const DEFAULT_SET: SetChoice = 'stardust-v3';
export const SET_CHOICES: { id: SetChoice; label: string }[] = [
  { id: 'all', label: 'All sets' },
  ...SETS.map((s) => ({ id: s.id as SetChoice, label: s.name })),
  { id: MY_TAGS_ID, label: MY_TAGS.name },
];

/** A Regular Tag is in every set of its series that lists it. */
export const inSetChoice = (tag: Tag, choice: SetChoice) => choice === 'all' || isInSet(tag, choice);
