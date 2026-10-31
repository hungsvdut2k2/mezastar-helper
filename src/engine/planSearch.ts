import { GIMMICK_NAME, type Tag, type Trust } from '../data/types';
import {
  isUnknownOpponent,
  attackType,
  damage,
  MODEL,
  simulate,
  statOrNeutral,
  type Battle,
  type SimResult,
  type Turn,
  type TurnOutcome,
} from './battleModel';
import { effectiveness } from './typeEffectiveness';

export type PlanStep = {
  turn: number;
  tagId: string;
  tagName: string;
  aimAtIndex: 0 | 1 | 2;
  aimAtId: string;
  aimAtLabel: string; // e.g. "Boss: Lugia" or "Crony: Pidgeot"
  isTarget: boolean;
  expectedDamage: number | null;
  expectDefeat: boolean | null;
  why: string;
  trust: Trust;
};

export type PlanResult = {
  kind: 'searched' | 'ruleOfThumb';
  steps: PlanStep[];
  score: number | null;
  comparison: string;
  /** True when some HP / Attack / Defense / Speed (team or opponents) is unknown and counted as average. */
  usesUnknownStats: boolean;
};

type Found = { turns: Turn[]; result: SimResult };

const AIMS = [0, 1, 2] as const;

export function planUsesUnknownStats(team: Tag[], battle: Battle): boolean {
  return [...team, ...battle.opponents].some((t) => Object.values(t.stats).some((v) => v === null));
}

const EPS = 1e-9;
const diff = (a: number, b: number) => (Math.abs(a - b) <= EPS ? 0 : a - b);

/** Damage on the target after turn 1, 2 and 3 (running total). */
function targetDamageByTurn(result: SimResult, battle: Battle): number[] {
  let sum = 0;
  return Array.from({ length: MODEL.maxTurns }, (_, i) => {
    const o = result.outcomes[i];
    if (o && o.turn.aimAt === battle.targetIndex) sum += o.damageDealt;
    return sum;
  });
}

/** Damage on a Boss that is not the target: it risks ending the battle early. */
function nonTargetBossDamage(result: SimResult, battle: Battle): number {
  if (battle.targetIndex === 0) return 0;
  return result.outcomes.filter((o) => o.turn.aimAt === 0).reduce((sum, o) => sum + o.damageDealt, 0);
}

/**
 * Positive when plan a is better than plan b. Highest score first; ties go to
 * earlier damage on the target, then less damage on a non-target Boss, then fewer
 * lost tags, then fewer tired turns, then the shorter plan. Remaining ties keep the first plan found.
 */
function comparePlans(a: Found, b: Found, battle: Battle): number {
  let d = diff(a.result.score, b.result.score);
  if (d) return d;
  const ta = targetDamageByTurn(a.result, battle);
  const tb = targetDamageByTurn(b.result, battle);
  for (let i = 0; i < ta.length; i++) {
    d = diff(ta[i], tb[i]);
    if (d) return d;
  }
  d = diff(nonTargetBossDamage(b.result, battle), nonTargetBossDamage(a.result, battle));
  if (d) return d;
  d = b.result.tagsLost - a.result.tagsLost;
  if (d) return d;
  d = b.result.outcomes.filter((o) => o.tired).length - a.result.outcomes.filter((o) => o.tired).length;
  if (d) return d;
  return b.turns.length - a.turns.length;
}

export function hasKeyStats(team: Tag[], battle: Battle): boolean {
  return (
    team.every((t) => t.stats.attack !== null && t.stats.hp !== null && t.stats.speed !== null) &&
    battle.opponents.every((o) => o.stats.hp !== null)
  );
}

/** Try every legal sequence of (tag, opponent) turns and keep the best (see comparePlans). */
export function searchBestTurns(team: Tag[], battle: Battle): Found | null {
  const state: { best: Found | null } = { best: null };

  const consider = (turns: Turn[], result: SimResult) => {
    const candidate = { turns, result };
    if (!state.best || comparePlans(candidate, state.best, battle) > 0) state.best = candidate;
  };

  const explore = (prefix: Turn[], result: SimResult | null) => {
    let extended = false;
    if (prefix.length < MODEL.maxTurns && !result?.bossDefeated) {
      for (let tagIndex = 0; tagIndex < team.length; tagIndex++) {
        for (const aimAt of AIMS) {
          const turns = [...prefix, { tagIndex, aimAt }];
          const next = simulate(team, battle, turns);
          if (!next) continue;
          extended = true;
          explore(turns, next);
        }
      }
    }
    if (!extended && result) consider(prefix, result);
  };

  explore([], null);
  return state.best;
}

/** The usual advice: defeat a crony, switch tags, then the strongest hit on the target. */
export function ruleOfThumbTurns(team: Tag[], battle: Battle): Turn[] | null {
  if (team.length < 2) return null;
  const eff = (tagIndex: number, aim: number) =>
    effectiveness(attackType(team[tagIndex], false), battle.opponents[aim].types);
  const target = battle.targetIndex;
  const cronies = ([1, 2] as const).filter((i) => i !== target);

  let first: Turn = { tagIndex: 0, aimAt: cronies[0] };
  for (let ti = 0; ti < team.length; ti++) {
    for (const c of cronies) if (eff(ti, c) > eff(first.tagIndex, first.aimAt)) first = { tagIndex: ti, aimAt: c };
  }
  const bestVsTarget = (exclude: number) => {
    let pick = -1;
    for (let ti = 0; ti < team.length; ti++) {
      if (ti !== exclude && (pick < 0 || eff(ti, target) > eff(pick, target))) pick = ti;
    }
    return pick;
  };
  const second = bestVsTarget(first.tagIndex);
  const third = bestVsTarget(second);
  return [first, { tagIndex: second, aimAt: target }, { tagIndex: third, aimAt: target }];
}

const aimLabel = (battle: Battle, aim: 0 | 1 | 2) =>
  `${aim === 0 ? 'Boss' : 'Crony'}: ${battle.opponents[aim].name}`;

function searchedStep(team: Tag[], battle: Battle, o: TurnOutcome, index: number): PlanStep {
  const tag = team[o.turn.tagIndex];
  const aim = o.turn.aimAt;
  const opp = battle.opponents[aim];
  const isTarget = aim === battle.targetIndex;
  // Relies on choosing which opponent to hit (seen by the player). Defeats are model
  // predictions, so they say "model estimate" and are never marked Official.
  const trust: Trust = 'player';
  let why: string;
  if (o.defeated && aim === 0) {
    why = 'Expected to beat the Boss (model estimate), so Catch Time starts.';
  } else if (o.defeated && isTarget) {
    why = `Expected to defeat ${opp.name} (model estimate); it joins you as Support Pokémon and can still be caught at Catch Time.`;
  } else if (o.defeated) {
    why = `Expected to defeat ${opp.name} (model estimate); it becomes your Support Pokémon from next turn.`;
  } else if (isTarget) {
    why = 'Builds damage on your target to fill the Catch Gauge.';
  } else {
    why = `Wears down ${opp.name} (not expected to fall this turn).`;
  }
  if (o.usedGimmick && tag.gimmick) why += ` First attack uses ${tag.gimmick.moveName ?? GIMMICK_NAME[tag.gimmick.kind]}.`;
  if (o.tired) why += ' Tired: attacks later, no Roulette boost.';
  if (o.supporters > 0) why += ` ${o.supporters} supporter${o.supporters > 1 ? 's' : ''} add power.`;
  if (o.tagLost) why += ' Risky: this tag may be knocked out.';
  return {
    turn: index + 1,
    tagId: tag.id,
    tagName: tag.name,
    aimAtIndex: aim,
    aimAtId: opp.id,
    aimAtLabel: aimLabel(battle, aim),
    isTarget,
    expectedDamage: Math.round(o.damageDealt),
    expectDefeat: o.defeated,
    why,
    trust,
  };
}

function ruleStep(team: Tag[], battle: Battle, turn: Turn, index: number): PlanStep {
  const tag = team[turn.tagIndex];
  const opp = battle.opponents[turn.aimAt];
  const reasons: [string, Trust][] = [
    [`Try to defeat ${opp.name} first so it becomes your Support Pokémon.`, 'community'],
    ['Use a different tag: the first one is tired (it would act later, without the Roulette boost).', 'player'],
    ['Your strongest available hit on the target.', 'player'],
  ];
  const [why, trust] = reasons[index];
  return {
    turn: index + 1,
    tagId: tag.id,
    tagName: tag.name,
    aimAtIndex: turn.aimAt,
    aimAtId: opp.id,
    aimAtLabel: aimLabel(battle, turn.aimAt),
    isTarget: turn.aimAt === battle.targetIndex,
    expectedDamage: null,
    expectDefeat: null,
    why,
    trust,
  };
}

/**
 * Plays the usual plan only as far as it stays legal: it may aim at an opponent that is
 * already defeated, or reuse a tag that was knocked out.
 */
function simulateLegalStart(team: Tag[], battle: Battle, turns: Turn[]): Found {
  for (let n = turns.length; n > 0; n--) {
    const result = simulate(team, battle, turns.slice(0, n));
    if (result) return { turns: turns.slice(0, n), result };
  }
  return { turns: [], result: simulate(team, battle, [])! };
}

function compareWithDefault(team: Tag[], battle: Battle, best: Found, defaultTurns: Turn[]): string {
  const same =
    best.turns.length === defaultTurns.length &&
    best.turns.every((t, i) => t.tagIndex === defaultTurns[i].tagIndex && t.aimAt === defaultTurns[i].aimAt);
  if (same) return 'This is the usual crony-first plan, and it is the best here.';
  const def = simulateLegalStart(team, battle, defaultTurns).result;
  const gain = Math.round(best.result.score - def.score);
  if (gain <= 0) return 'This plan and the usual crony-first plan are about equal here.';

  const lostAt = def.outcomes.findIndex((o) => o.tagLost);
  if (lostAt >= 0 && def.tagsLost > best.result.tagsLost) {
    const o = def.outcomes[lostAt];
    const avoids = best.result.tagsLost === 0 ? 'avoids that' : 'loses fewer tags';
    return `The usual crony-first plan would lose ${team[o.turn.tagIndex].name} to ${battle.opponents[o.turn.aimAt].name} on turn ${lostAt + 1}; this plan ${avoids}.`;
  }

  // Report damage on the target when that is where the gain is; otherwise plain points
  // (the score also counts the Boss-defeat bonus and lost tags).
  const moreDamage = Math.round(best.result.damageToTarget - def.damageToTarget);
  if (best.turns[0].aimAt === battle.targetIndex) {
    const targetLabel = battle.targetIndex === 0 ? 'the Boss' : battle.opponents[battle.targetIndex].name;
    const cronies = ([1, 2] as const).filter((i) => i !== battle.targetIndex);
    const noOneHit = cronies.every((c) =>
      team.every((t) => damage(t, battle.opponents[c], true) < statOrNeutral(battle.opponents[c].stats.hp)),
    );
    if (noOneHit) return `Hitting ${targetLabel} on turn 1 is better here: no crony can be defeated in one hit.`;
    const amount = moreDamage > 0 ? `about ${moreDamage} more damage on your target` : `about ${gain} more points`;
    return `Hitting ${targetLabel} on turn 1 is better here (${amount} than crony-first).`;
  }
  const by = moreDamage > 0 ? `about ${moreDamage} damage on your target` : `about ${gain} points`;
  return `This plan beats the usual crony-first plan by ${by}.`;
}

export function bestPlan(team: Tag[], battle: Battle): PlanResult | null {
  const defaultTurns = ruleOfThumbTurns(team, battle);
  if (!defaultTurns) return null;
  if (!hasKeyStats(team, battle)) {
    return {
      kind: 'ruleOfThumb',
      steps: defaultTurns.map((turn, i) => ruleStep(team, battle, turn, i)),
      score: null,
      comparison: battle.opponents.some(isUnknownOpponent)
        ? 'Some HP, Attack or Speed values are unknown, so this is the usual rule of thumb. Enter the real opponents at the machine for a searched plan.'
        : 'Some HP, Attack or Speed values are unknown, so this is the usual rule of thumb. Add them in Collection for a searched plan.',
      usesUnknownStats: true,
    };
  }
  const found = searchBestTurns(team, battle);
  if (!found) return null;
  const usesUnknownStats = planUsesUnknownStats(team, battle);
  const comparison = compareWithDefault(team, battle, found, defaultTurns);
  return {
    kind: 'searched',
    steps: found.result.outcomes.map((o, i) => searchedStep(team, battle, o, i)),
    score: found.result.score,
    // The screen shows one "rough estimates" hint per plan, so the sentence is not repeated here.
    comparison,
    usesUnknownStats,
  };
}
