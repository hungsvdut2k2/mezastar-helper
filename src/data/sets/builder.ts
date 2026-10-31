import type { Grade, PokemonType, Tag } from '../types';

export const POKEDEX = 'Types: main-series Pokédex species types';

type Extra = Partial<Pick<Tag, 'move' | 'gimmick' | 'legendary' | 'mythical' | 'printedCode'>>;

export function makeTagBuilder(officialUrl: string) {
  return function tag(id: string, name: string, grade: Grade | null, types: PokemonType[], extra: Extra = {}): Tag {
    return {
      id,
      name,
      grade,
      types,
      pokenergy: null,
      stats: { hp: null, attack: null, defense: null, speed: null },
      move: extra.move ?? null,
      gimmick: extra.gimmick ?? null,
      legendary: extra.legendary ?? false,
      mythical: extra.mythical ?? false,
      ...(extra.printedCode ? { printedCode: extra.printedCode } : {}),
      sources: [officialUrl, POKEDEX],
    };
  };
}

export const L = { legendary: true };
export const M = { mythical: true };
