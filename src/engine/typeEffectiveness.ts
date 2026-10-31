import { TYPE_CHART } from '../data/typeChart';
import type { PokemonType } from '../data/types';

/** An unknown move type (null) or a defender with no known type counts as neutral (1). */
export function effectiveness(moveType: PokemonType | null, defenderTypes: PokemonType[]): number {
  if (moveType === null) return 1;
  return defenderTypes.reduce((m, t) => m * (TYPE_CHART[moveType][t] ?? 1), 1);
}

/** The preview words the machine shows when a tag is slid forward. */
export function effectText(multiplier: number): string {
  if (multiplier >= 2) return "It's effective!";
  if (multiplier === 0) return 'No effect';
  if (multiplier < 1) return "It's not so effective...";
  return 'Hit';
}
