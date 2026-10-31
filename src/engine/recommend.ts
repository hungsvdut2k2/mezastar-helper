import type { Tag } from '../data/types';
import type { Battle } from './battleModel';
import { bestPlan, type PlanResult } from './planSearch';
import { topTeams, type TeamScore } from './teamScoring';

export type Recommendation = TeamScore & { plan: PlanResult | null };

export function recommend(owned: Tag[], battle: Battle, count = 3): Recommendation[] {
  return topTeams(owned, battle, count).map((t) => ({ ...t, plan: bestPlan(t.team, battle) }));
}

/** Stand-in for a crony the player did not enter (Plan screen). No type and no move = neutral matchups. */
export function unknownOpponent(id: string): Tag {
  return {
    id,
    name: 'Unknown crony',
    grade: null,
    types: [],
    pokenergy: null,
    stats: { hp: null, attack: null, defense: null, speed: null },
    move: null,
    gimmick: null,
    legendary: false,
    mythical: false,
    sources: [],
  };
}
