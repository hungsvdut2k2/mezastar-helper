import type { Grade, PokemonType, Tag } from '../types';

export const POKEDEX = 'Types: main-series Pokédex species types';

type Extra = Partial<Pick<Tag, 'move' | 'gimmick' | 'legendary' | 'mythical' | 'printedCode'>> & {
  /** Other official pages that list the same tag (Regular Tags appear in several sets). */
  alsoOn?: string[];
};

export function makeTagBuilder(officialUrl: string) {
  return function tag(id: string, name: string, grade: Grade | null, types: PokemonType[], extra: Extra = {}): Tag {
    return {
      id,
      name,
      grade,
      types,
      pokenergy: null,
      stats: { hp: null, attack: null, defense: null, spAttack: null, spDefense: null, speed: null },
      move: extra.move ?? null,
      gimmick: extra.gimmick ?? null,
      legendary: extra.legendary ?? false,
      mythical: extra.mythical ?? false,
      ...(extra.printedCode ? { printedCode: extra.printedCode } : {}),
      sources: [officialUrl, ...(extra.alsoOn ?? []), POKEDEX],
    };
  };
}

/**
 * Typing rule for Mega tags: use the BASE Pokémon's typing, not the Mega form's. The tag
 * fights as the base form until it Mega Evolves (e.g. 1-1-009 Charizard is fire/flying even
 * though its Mega is Charizard X, fire/dragon). The Mega move's type is still recorded in the gimmick.
 */
export const L = { legendary: true };
export const M = { mythical: true };
