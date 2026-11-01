import type { Gimmick, Tag } from '../data/types';
import { attackType, LIMITED_GIMMICKS, limitKey } from './battleModel';
import { bulk, hitPower, WEIGHTS } from './teamScoring';
import { effectiveness } from './typeEffectiveness';

/**
 * All-round team: the 3 tags that do best on average against every opponent in a pool,
 * with no specific battle in mind. Same ingredients as scoreTeam (best hit, rotation,
 * resist, bulk, special move), averaged over the opponents.
 */
export const BEST_TEAM = {
  /** Superstars are what the player hunts, so they count most. */
  gradeWeight: (t: Tag) => (t.grade === 6 ? 3 : t.grade === 5 ? 2 : 1),
  poolSize: 24, // strongest tags overall...
  perTypeSize: 2, // ...plus the best few of each move type, so complementary coverage is not pruned away
};

export type AllRoundTeam = {
  team: Tag[];
  score: number;
  /** Opponents (by count) this team hits super effectively with its best attacker. */
  strongAgainst: number;
  /** Opponents no team member hits better than "not so effective". */
  weakAgainst: number;
  superstarsStrong: number;
  superstars: number;
  opponents: number;
  usesUnknownStats: boolean;
};

const hasUnknownStats = (t: Tag) => Object.values(t.stats).some((v) => v === null);

function combinations<T>(items: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (items.length < k) return [];
  const [first, ...rest] = items;
  return [...combinations(rest, k - 1).map((c) => [first, ...c]), ...combinations(rest, k)];
}

export function bestAllRoundTeams(candidates: Tag[], opponents: Tag[], count = 3): AllRoundTeam[] {
  if (candidates.length === 0 || opponents.length === 0) return [];
  const weights = opponents.map(BEST_TEAM.gradeWeight);
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  // Per-tag numbers that don't depend on teammates.
  const hits = new Map<Tag, number[]>();
  const solo = new Map<Tag, number>();
  const extras = new Map<Tag, number>();
  for (const t of candidates) {
    const row = opponents.map((o) => hitPower(t, o));
    hits.set(t, row);
    solo.set(t, row.reduce((s, h, i) => s + weights[i] * h, 0) / totalWeight + (t.gimmick ? WEIGHTS.gimmick : 0));
    const resist = opponents.reduce((s, o, i) => s + weights[i] * (1 - effectiveness(attackType(o, false), t.types)), 0) / totalWeight;
    extras.set(t, WEIGHTS.resist * resist + bulk(t, opponents, weights) / WEIGHTS.bulkDivisor);
  }

  const bySolo = [...candidates].sort((a, b) => solo.get(b)! - solo.get(a)! || a.id.localeCompare(b.id));
  const pool = new Set(bySolo.slice(0, BEST_TEAM.poolSize));
  const perType = new Map<string, number>();
  for (const t of bySolo) {
    const key = attackType(t, false) ?? 'none';
    const n = perType.get(key) ?? 0;
    if (n < BEST_TEAM.perTypeSize) pool.add(t);
    perType.set(key, n + 1);
  }

  const size = Math.min(3, pool.size);
  return combinations([...pool], size)
    .map((team) => scoreAllRound(team, opponents, weights, totalWeight, hits, extras))
    .sort((a, b) => b.score - a.score || a.team.map((t) => t.id).join().localeCompare(b.team.map((t) => t.id).join()))
    .slice(0, count);
}

function scoreAllRound(
  team: Tag[],
  opponents: Tag[],
  weights: number[],
  totalWeight: number,
  hits: Map<Tag, number[]>,
  extras: Map<Tag, number>,
): AllRoundTeam {
  const rows = team.map((t) => hits.get(t)!);
  let coverage = 0;
  let strongAgainst = 0;
  let weakAgainst = 0;
  let superstarsStrong = 0;
  let superstars = 0;
  opponents.forEach((opp, i) => {
    let top = 0;
    let topTag = team[0];
    rows.forEach((r, k) => {
      if (r[i] > top) {
        top = r[i];
        topTag = team[k];
      }
    });
    const good = rows.filter((r) => r[i] >= WEIGHTS.goodAttackerShare * top).length;
    coverage += weights[i] * (top - (top <= 0 || good < 2 ? WEIGHTS.rotationPenalty : 0));
    const eff = effectiveness(attackType(topTag, false), opp.types);
    if (eff > 1) strongAgainst++;
    if (team.every((t) => effectiveness(attackType(t, false), opp.types) < 1)) weakAgainst++;
    if (opp.grade === 6) {
      superstars++;
      if (eff > 1) superstarsStrong++;
    }
  });

  let score = coverage / totalWeight;
  const limitedSeen = new Set<Gimmick>();
  for (const t of team) {
    score += extras.get(t)!;
    const kind = t.gimmick?.kind;
    if (kind && !limitedSeen.has(limitKey(kind))) {
      score += WEIGHTS.gimmick;
      if (LIMITED_GIMMICKS.has(kind)) limitedSeen.add(limitKey(kind));
    }
  }

  return {
    team,
    score,
    strongAgainst,
    weakAgainst,
    superstarsStrong,
    superstars,
    opponents: opponents.length,
    usesUnknownStats: team.some(hasUnknownStats) || opponents.some(hasUnknownStats),
  };
}
