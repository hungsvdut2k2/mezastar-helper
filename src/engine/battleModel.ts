import type { Gimmick, PokemonType, Tag } from '../data/types';
import { effectiveness } from './typeEffectiveness';

/** Placeholder constants. Measure with the play log before changing them. */
export const MODEL = {
  neutralStat: 100, // stands in for any unknown HP / Attack / Defense / Speed
  defenseScale: 200, // defense factor = 1 + Defense / defenseScale
  supporterBonus: 30, // expected extra damage per supporter per turn
  gimmickMultiplier: {
    mega: 1.5,
    dynamax: 1.5,
    zmove: 1.8,
    tagMove: 1.8,
    doubleMove: 1.8,
    chainAttack: 1.3,
  } satisfies Record<Gimmick, number>,
  /**
   * A tag that attacked last turn is tired: it acts after the opponent and loses the
   * Attack Roulette boost. Estimate of how much weaker its hit is; not measured yet.
   */
  tiredAttackMultiplier: 0.8,
  targetDefeatBonus: 50, // beating the Boss target starts Catch Time
  lostTagPenalty: 40,
  maxTurns: 3,
};

/** Special moves the game limits to one use per battle ("per play" counts as per battle here). */
export const LIMITED_GIMMICKS: ReadonlySet<Gimmick> = new Set<Gimmick>(['mega', 'dynamax', 'zmove']);

/** opponents[0] is the Boss; [1] and [2] are the cronies. */
export type Battle = { opponents: [Tag, Tag, Tag]; targetIndex: 0 | 1 | 2 };
export type Turn = { tagIndex: number; aimAt: 0 | 1 | 2 };

export type TurnOutcome = {
  turn: Turn;
  damageDealt: number;
  defeated: boolean;
  tagLost: boolean;
  usedGimmick: boolean;
  tired: boolean; // this tag also attacked last turn
  supporters: number; // supporters active during this turn
};

export type SimResult = {
  outcomes: TurnOutcome[];
  damageToTarget: number;
  targetDefeated: boolean;
  bossDefeated: boolean;
  tagsLost: number;
  score: number;
};

export const statOrNeutral = (v: number | null): number => v ?? MODEL.neutralStat;

export function attackType(tag: Tag, useGimmick: boolean): PokemonType {
  if (useGimmick && tag.gimmick?.moveType) return tag.gimmick.moveType;
  return tag.move?.type ?? tag.types[0];
}

export function damage(attacker: Tag, defender: Tag, useGimmick: boolean): number {
  const multiplier = useGimmick && attacker.gimmick ? MODEL.gimmickMultiplier[attacker.gimmick.kind] : 1;
  const eff = effectiveness(attackType(attacker, useGimmick), defender.types);
  const defenseFactor = 1 + statOrNeutral(defender.stats.defense) / MODEL.defenseScale;
  return (statOrNeutral(attacker.stats.attack) * eff * multiplier) / defenseFactor;
}

export function attacksFirst(attacker: Tag, defender: Tag): boolean {
  return statOrNeutral(attacker.stats.speed) >= statOrNeutral(defender.stats.speed);
}

/**
 * Plays out a sequence of turns. Returns null if any turn is illegal:
 * a missing or knocked-out tag, or an already-defeated opponent.
 * A tag used two turns in a row is tired: it acts after the opponent and hits
 * for MODEL.tiredAttackMultiplier of its damage.
 * Turns after the Boss is defeated are ignored (Catch Time has started).
 */
export function simulate(team: Tag[], battle: Battle, turns: Turn[]): SimResult | null {
  const oppHp = battle.opponents.map((o) => statOrNeutral(o.stats.hp));
  const tagHp = team.map((t) => statOrNeutral(t.stats.hp));
  const hasAttacked = team.map(() => false);
  const usedGimmicks = new Set<Gimmick>();
  const outcomes: TurnOutcome[] = [];
  let supporters = 0;
  let newSupporters = 0;
  let damageToTarget = 0;
  let bossDefeated = false;
  let tagsLost = 0;

  for (const [i, turn] of turns.entries()) {
    if (bossDefeated) break;
    const tag = team[turn.tagIndex];
    if (!tag || tagHp[turn.tagIndex] <= 0 || oppHp[turn.aimAt] <= 0) return null;
    const tired = i > 0 && turns[i - 1].tagIndex === turn.tagIndex;

    supporters += newSupporters;
    newSupporters = 0;
    const opp = battle.opponents[turn.aimAt];
    const kind = tag.gimmick?.kind;
    const canUseGimmick =
      kind !== undefined && !hasAttacked[turn.tagIndex] && !(LIMITED_GIMMICKS.has(kind) && usedGimmicks.has(kind));
    let usedGimmick = false;

    const hit = () => {
      // The special move is only spent when the tag actually attacks.
      usedGimmick = canUseGimmick;
      if (usedGimmick && kind) usedGimmicks.add(kind);
      hasAttacked[turn.tagIndex] = true;
      const base = damage(tag, opp, usedGimmick) * (tired ? MODEL.tiredAttackMultiplier : 1);
      const dealt = Math.min(oppHp[turn.aimAt], base + supporters * MODEL.supporterBonus);
      oppHp[turn.aimAt] -= dealt;
      return dealt;
    };
    const counter = () => {
      tagHp[turn.tagIndex] -= damage(opp, tag, false);
    };

    let dealt = 0;
    if (!tired && attacksFirst(tag, opp)) {
      dealt = hit();
      if (oppHp[turn.aimAt] > 0) counter();
    } else {
      counter();
      if (tagHp[turn.tagIndex] > 0) dealt = hit();
    }

    const defeated = oppHp[turn.aimAt] <= 0;
    const tagLost = tagHp[turn.tagIndex] <= 0;
    if (tagLost) tagsLost += 1;
    if (turn.aimAt === battle.targetIndex) damageToTarget += dealt;
    if (defeated && turn.aimAt === 0) bossDefeated = true;
    if (defeated && turn.aimAt !== 0) newSupporters += 1;
    outcomes.push({ turn, damageDealt: dealt, defeated, tagLost, usedGimmick, tired, supporters });
  }

  const targetDefeated = oppHp[battle.targetIndex] <= 0;
  const score =
    damageToTarget +
    (targetDefeated && battle.targetIndex === 0 ? MODEL.targetDefeatBonus : 0) -
    tagsLost * MODEL.lostTagPenalty;
  return { outcomes, damageToTarget, targetDefeated, bossDefeated, tagsLost, score };
}
