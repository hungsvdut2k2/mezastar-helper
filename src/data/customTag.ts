import { CUSTOM_ID_PREFIX } from './setInfo';
import type { Gimmick, Grade, PokemonType, Tag } from './types';

export const MAX_CODE_LENGTH = 20;
export const MAX_NAME_LENGTH = 60;
export const MAX_MOVE_LENGTH = 60;
/** Ids look like "my-" plus letters, digits, "-" or "_". */
export const CUSTOM_ID_PATTERN = /^my-[A-Za-z0-9_-]{1,64}$/;

export const CUSTOM_SOURCE = 'added by you';

let counter = 0;
/** A fresh id that cannot equal any shipped id: always "my-" plus a random part. */
export function newCustomId(): string {
  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${(++counter).toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${CUSTOM_ID_PREFIX}${random}`;
}

export type CustomTagInput = {
  printedCode: string;
  name: string;
  grade: Grade | null;
  types: PokemonType[];
  move: { name: string; type: PokemonType } | null;
  gimmick: Gimmick | null;
  legendary: boolean;
  mythical: boolean;
};

export function makeCustomTag(id: string, input: CustomTagInput): Tag {
  return {
    id,
    printedCode: input.printedCode.trim(),
    name: input.name.trim(),
    grade: input.grade,
    types: input.types,
    pokenergy: null,
    stats: { hp: null, attack: null, defense: null, speed: null },
    move: input.move ? { name: input.move.name.trim(), type: input.move.type } : null,
    gimmick: input.gimmick ? { kind: input.gimmick, moveName: null, moveType: null } : null,
    legendary: input.legendary,
    mythical: input.mythical,
    sources: [CUSTOM_SOURCE],
  };
}
