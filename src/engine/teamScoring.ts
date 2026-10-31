import type { Tag } from '../data/types';
import { attackType, statOrNeutral, type Battle } from './battleModel';
import { effectiveness, effectText } from './typeEffectiveness';

/** Fixed weights for version 1. */
export const WEIGHTS = {
  target: 2, // the opponent you want to catch counts double
  crony: 1,
  speedBonus: 20, // best attacker is faster than that opponent
  rotationPenalty: 60, // fewer than 2 good attackers on the target
  goodAttackerShare: 0.75, // "good" = at least 75% of the best hit on the target
  resist: 10, // per opponent move type the tag resists
  bulkDivisor: 20, // (HP + Defense) / bulkDivisor
  gimmick: 25, // first-attack special move
  poolSize: 15, // tags kept before trying combinations
};

export type TeamScore = { team: Tag[]; score: number; reason: string; usesUnknownStats: boolean };

const weightOf = (battle: Battle, i: number) => (i === battle.targetIndex ? WEIGHTS.target : WEIGHTS.crony);

export function hitPower(tag: Tag, opp: Tag): number {
  return statOrNeutral(tag.stats.attack) * effectiveness(attackType(tag, false), opp.types);
}

function soloScore(tag: Tag, battle: Battle): number {
  const coverage = battle.opponents.reduce((sum, opp, i) => sum + weightOf(battle, i) * hitPower(tag, opp), 0);
  return coverage + (tag.gimmick ? WEIGHTS.gimmick : 0);
}

export function rankTags(owned: Tag[], battle: Battle): Tag[] {
  return [...owned].sort((a, b) => soloScore(b, battle) - soloScore(a, battle)).slice(0, WEIGHTS.poolSize);
}

function bestAgainst(team: Tag[], opp: Tag): Tag {
  let best = team[0];
  for (const t of team) if (hitPower(t, opp) > hitPower(best, opp)) best = t;
  return best;
}

const hasUnknownStats = (t: Tag) => Object.values(t.stats).some((v) => v === null);

function reasonFor(team: Tag[], battle: Battle, unknown: boolean): string {
  const parts = battle.opponents.map((opp, i) => {
    const best = bestAgainst(team, opp);
    const role = i === battle.targetIndex ? 'target' : i === 0 ? 'Boss' : 'crony';
    const word = effectText(effectiveness(attackType(best, false), opp.types));
    return `${best.name} → ${opp.name} (${role}): ${word}`;
  });
  return parts.join('; ') + (unknown ? '. Some stats unknown, counted as average.' : '.');
}

export function scoreTeam(team: Tag[], battle: Battle): TeamScore {
  let score = 0;

  // 1–2. Attack coverage and Speed
  battle.opponents.forEach((opp, i) => {
    const w = weightOf(battle, i);
    const best = bestAgainst(team, opp);
    score += w * hitPower(best, opp);
    if (best.stats.speed !== null && opp.stats.speed !== null && best.stats.speed > opp.stats.speed) {
      score += w * WEIGHTS.speedBonus;
    }
  });

  // 3. Rotation (Tiredness)
  const target = battle.opponents[battle.targetIndex];
  const top = hitPower(bestAgainst(team, target), target);
  const good = team.filter((t) => hitPower(t, target) >= WEIGHTS.goodAttackerShare * top).length;
  if (good < 2) score -= WEIGHTS.rotationPenalty;

  // 4–5. Defense and special moves
  for (const t of team) {
    for (const opp of battle.opponents) score += WEIGHTS.resist * (1 - effectiveness(attackType(opp, false), t.types));
    score += (statOrNeutral(t.stats.hp) + statOrNeutral(t.stats.defense)) / WEIGHTS.bulkDivisor;
    if (t.gimmick) score += WEIGHTS.gimmick;
  }

  const usesUnknownStats = [...team, ...battle.opponents].some(hasUnknownStats);
  return { team, score, reason: reasonFor(team, battle, usesUnknownStats), usesUnknownStats };
}

function combinations<T>(items: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (items.length < k) return [];
  const [first, ...rest] = items;
  return [...combinations(rest, k - 1).map((c) => [first, ...c]), ...combinations(rest, k)];
}

export function topTeams(owned: Tag[], battle: Battle, count = 3): TeamScore[] {
  const pool = rankTags(owned, battle);
  const size = Math.min(3, pool.length);
  if (size === 0) return [];
  return combinations(pool, size)
    .map((team) => scoreTeam(team, battle))
    .sort((a, b) => b.score - a.score)
    .slice(0, count);
}
