import { setsOfTag } from '../data/setInfo';
import type { Tag } from '../data/types';
import { UNKNOWN_PREFIX, type Battle } from './battleModel';
import { bestPlan, hasKeyStats, searchBestTurns, type PlanResult } from './planSearch';
import { topTeams, topTeamsOver, type TeamScore } from './teamScoring';

/** How often the team's best plan defeats the target over a sample of possible crony pairs. */
export type CronyOdds = { wins: number; pairs: number; totalPairs: number };

export type Recommendation = TeamScore & { plan: PlanResult | null; odds?: CronyOdds | null };

export function recommend(owned: Tag[], battle: Battle, count = 3): Recommendation[] {
  return topTeams(owned, battle, count).map((t) => ({ ...t, plan: bestPlan(t.team, battle) }));
}

/** Most crony pairs to run the full plan search on per team. */
export const ODDS_SAMPLE = 200;

/** Tags that can appear with the target: the rest of its set(s). */
export function cronyPool(target: Tag, catalog: Tag[]): Tag[] {
  const sets = new Set(setsOfTag(target).map((s) => s.id));
  return catalog.filter((t) => t.id !== target.id && setsOfTag(t).some((s) => sets.has(s.id)));
}

/** Every crony pair still possible: blank slots filled from the pool, a known crony kept. */
export function cronyPairs(pool: Tag[], known: [Tag | null, Tag | null]): [Tag, Tag][] {
  const [k1, k2] = known;
  if (k1 && k2) return [[k1, k2]];
  if (k1 || k2) return pool.filter((c) => c.id !== (k1 ?? k2)!.id).map((c) => (k1 ? [k1, c] : [c, k2!]));
  const pairs: [Tag, Tag][] = [];
  for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) pairs.push([pool[i], pool[j]]);
  return pairs;
}

/** Evenly spaced, so the same input always gives the same sample. */
function sample<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  return Array.from({ length: max }, (_, i) => items[Math.floor((i * items.length) / max)]);
}

/**
 * Plan screen with a blank crony: rank teams by their average score over every crony the set could
 * field (the score adds one part per opponent, so averaging per slot equals averaging over pairs),
 * show the plan against neutral stand-ins, and count how often the plan wins over sampled pairs.
 * Falls back to `recommend` on the shown battle when the pool is too small.
 */
export function recommendOverCronies(owned: Tag[], target: Tag, known: [Tag | null, Tag | null], pool: Tag[], count = 3): Recommendation[] {
  const shown: Battle = { opponents: [target, known[0] ?? unknownOpponent(1), known[1] ?? unknownOpponent(2)], targetIndex: 0 };
  const candidates = pool.filter((c) => c.id !== known[0]?.id && c.id !== known[1]?.id);
  const blanks = (known[0] ? 0 : 1) + (known[1] ? 0 : 1);
  if (blanks === 0 || candidates.length < blanks) return recommend(owned, shown, count);
  const battles: Battle[] = candidates.map((c) => ({ opponents: [target, known[0] ?? c, known[1] ?? c], targetIndex: 0 }));
  const allPairs = cronyPairs(candidates, known);
  const sampled = sample(allPairs, ODDS_SAMPLE);
  return topTeamsOver(owned, battles, shown, count).map((t) => ({
    ...t,
    plan: bestPlan(t.team, shown),
    odds: oddsOver(t.team, target, sampled, allPairs.length),
  }));
}

function oddsOver(team: Tag[], target: Tag, pairs: [Tag, Tag][], totalPairs: number): CronyOdds | null {
  let wins = 0;
  let counted = 0;
  for (const [c1, c2] of pairs) {
    const battle: Battle = { opponents: [target, c1, c2], targetIndex: 0 };
    if (!hasKeyStats(team, battle)) continue;
    counted++;
    if (searchBestTurns(team, battle)?.result.targetDefeated) wins++;
  }
  return counted > 0 ? { wins, pairs: counted, totalPairs } : null;
}

/** Stand-in for a crony the player did not enter (Plan screen). No type and no move = neutral matchups. */
export function unknownOpponent(slot: 1 | 2): Tag {
  return {
    id: `${UNKNOWN_PREFIX}${slot}`,
    name: 'Unknown crony',
    grade: null,
    types: [],
    pokenergy: null,
    stats: { hp: null, attack: null, defense: null, spAttack: null, spDefense: null, speed: null },
    move: null,
    gimmick: null,
    legendary: false,
    mythical: false,
    sources: [],
  };
}
