import { GIMMICK_NAME, type Tag, type Trust } from '../data/types';
import {
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
};

type Found = { turns: Turn[]; result: SimResult };

const AIMS = [0, 1, 2] as const;

export function hasKeyStats(team: Tag[], battle: Battle): boolean {
  return (
    team.every((t) => t.stats.attack !== null && t.stats.hp !== null && t.stats.speed !== null) &&
    battle.opponents.every((o) => o.stats.hp !== null)
  );
}

/** Try every legal sequence of (tag, opponent) turns and keep the highest score. */
export function searchBestTurns(team: Tag[], battle: Battle): Found | null {
  const state: { best: Found | null } = { best: null };

  const consider = (turns: Turn[], result: SimResult) => {
    const best = state.best;
    const better = !best || result.score > best.result.score + 1e-9;
    const tieButShorter =
      best !== null && Math.abs(result.score - best.result.score) <= 1e-9 && turns.length < best.turns.length;
    if (better || tieButShorter) state.best = { turns, result };
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
  let why: string;
  let trust: Trust = 'player'; // relies on choosing which opponent to hit
  if (o.defeated && aim === 0) {
    why = 'Beats the Boss, so Catch Time starts.';
    trust = 'confirmed';
  } else if (o.defeated) {
    why = `Defeats ${opp.name}; it becomes your Support Pokémon from next turn.`;
    trust = 'confirmed';
  } else if (aim === battle.targetIndex) {
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
    isTarget: aim === battle.targetIndex,
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
    ['Use a different tag: the first one is tired.', 'confirmed'],
    ['Your strongest hit on the target.', 'player'],
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

function compareWithDefault(team: Tag[], battle: Battle, best: Found, defaultTurns: Turn[]): string {
  const same =
    best.turns.length === defaultTurns.length &&
    best.turns.every((t, i) => t.tagIndex === defaultTurns[i].tagIndex && t.aimAt === defaultTurns[i].aimAt);
  if (same) return 'This is the usual crony-first plan, and it is the best here.';
  const def = simulate(team, battle, defaultTurns);
  if (!def) return 'The usual crony-first plan does not fit this battle, so use this one.';
  const gain = Math.round(best.result.score - def.score);
  if (gain <= 0) return 'This plan and the usual crony-first plan are about equal here.';
  if (best.turns[0].aimAt === battle.targetIndex) {
    const targetLabel = battle.targetIndex === 0 ? 'the Boss' : battle.opponents[battle.targetIndex].name;
    const cronies = ([1, 2] as const).filter((i) => i !== battle.targetIndex);
    const noOneHit = cronies.every((c) =>
      team.every((t) => damage(t, battle.opponents[c], true) < statOrNeutral(battle.opponents[c].stats.hp)),
    );
    if (noOneHit) return `Hitting ${targetLabel} on turn 1 is better here: no crony can be defeated in one hit.`;
    return `Hitting ${targetLabel} on turn 1 is better here (about ${gain} more expected damage than crony-first).`;
  }
  return `This plan beats the usual crony-first plan by about ${gain} expected damage.`;
}

export function bestPlan(team: Tag[], battle: Battle): PlanResult | null {
  const defaultTurns = ruleOfThumbTurns(team, battle);
  if (!defaultTurns) return null;
  if (!hasKeyStats(team, battle)) {
    return {
      kind: 'ruleOfThumb',
      steps: defaultTurns.map((turn, i) => ruleStep(team, battle, turn, i)),
      score: null,
      comparison:
        'Some HP, Attack or Speed values are unknown, so this is the usual rule of thumb. Add them in Collection for a searched plan.',
    };
  }
  const found = searchBestTurns(team, battle);
  if (!found) return null;
  return {
    kind: 'searched',
    steps: found.result.outcomes.map((o, i) => searchedStep(team, battle, o, i)),
    score: found.result.score,
    comparison: compareWithDefault(team, battle, found, defaultTurns),
  };
}
