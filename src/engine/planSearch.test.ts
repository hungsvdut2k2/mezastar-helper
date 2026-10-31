import type { Tag } from '../data/types';
import { makeTag, type TagOverrides } from '../test/factories';
import type { Battle } from './battleModel';
import { bestPlan, ruleOfThumbTurns } from './planSearch';
import { simulate } from './battleModel';

const opp = (id: string, o: TagOverrides = {}) => makeTag(id, { ...o, stats: { attack: 1, speed: 1, ...o.stats } });
const battleOf = (boss: Tag, c1: Tag, c2: Tag, targetIndex: 0 | 1 | 2 = 0): Battle => ({
  opponents: [boss, c1, c2],
  targetIndex,
});

describe('bestPlan', () => {
  it('needs at least 2 tags', () => {
    expect(bestPlan([makeTag('A')], battleOf(opp('boss'), opp('c1'), opp('c2')))).toBeNull();
  });

  it('hits the Boss every turn when no crony can be defeated in one hit', () => {
    const team = [makeTag('A'), makeTag('B')];
    const plan = bestPlan(team, battleOf(opp('boss'), opp('c1'), opp('c2')))!;
    expect(plan.kind).toBe('searched');
    expect(plan.steps.map((s) => s.aimAtIndex)).toEqual([0, 0, 0]);
    expect(plan.comparison).toBe('Hitting the Boss on turn 1 is better here: no crony can be defeated in one hit.');
  });

  it('defeats a crony first when the supporter is worth more than one weak hit', () => {
    // Normal moves only do half damage to the Rock Boss; cronies fall in one hit.
    const team = [makeTag('A', { stats: { attack: 40 } }), makeTag('B', { stats: { attack: 40 } })];
    const battle = battleOf(opp('boss', { types: ['rock'] }), opp('c1', { stats: { hp: 40 } }), opp('c2', { stats: { hp: 40 } }));
    const plan = bestPlan(team, battle)!;
    expect(plan.steps.map((s) => s.aimAtIndex)).toEqual([1, 0, 0]);
    expect(plan.steps[0].expectDefeat).toBe(true);
    expect(plan.steps[0].why).toContain('Support Pokémon');
    expect(plan.comparison).toBe('This is the usual crony-first plan, and it is the best here.');
  });

  it('rotates tags when they are equally strong (a tired tag hits weaker)', () => {
    const team = [makeTag('A'), makeTag('B'), makeTag('C')];
    const plan = bestPlan(team, battleOf(opp('boss', { stats: { hp: 5000 } }), opp('c1'), opp('c2')))!;
    for (let i = 1; i < plan.steps.length; i++) expect(plan.steps[i].tagId).not.toBe(plan.steps[i - 1].tagId);
    expect(plan.steps.some((s) => s.why.includes('Tired'))).toBe(false);
  });

  it('reuses a much stronger tag when it is worth it, and says it is tired', () => {
    const team = [makeTag('A', { stats: { attack: 300 } }), makeTag('B'), makeTag('C')];
    const plan = bestPlan(team, battleOf(opp('boss', { stats: { hp: 5000 } }), opp('c1'), opp('c2')))!;
    expect(plan.steps.map((s) => s.tagId)).toEqual(['A', 'A', 'A']);
    expect(plan.steps[0].why).not.toContain('Tired');
    expect(plan.steps[1].why).toContain('Tired: attacks later, no Roulette boost.');
  });

  it('can aim at a crony target', () => {
    const team = [makeTag('A'), makeTag('B')];
    const plan = bestPlan(team, battleOf(opp('boss'), opp('c1'), opp('c2'), 1))!;
    expect(plan.steps.map((s) => s.aimAtIndex)).toEqual([1, 1, 1]);
    expect(plan.steps.every((s) => s.isTarget)).toBe(true);
  });

  it('falls back to the rule of thumb when key stats are missing', () => {
    const team = [makeTag('A'), makeTag('B'), makeTag('C')];
    const battle = battleOf(opp('boss', { stats: { hp: null } }), opp('c1'), opp('c2'));
    const plan = bestPlan(team, battle)!;
    expect(plan.kind).toBe('ruleOfThumb');
    expect(plan.score).toBeNull();
    expect(plan.steps).toHaveLength(3);
    expect(plan.steps[0].aimAtIndex).not.toBe(0);
    expect(plan.steps[1].tagId).not.toBe(plan.steps[0].tagId);
    expect(plan.steps[2].aimAtIndex).toBe(0);
    expect(plan.steps[2].tagId).not.toBe(plan.steps[1].tagId);
  });

  it('says a defeated crony target can still be caught', () => {
    const team = [makeTag('A', { stats: { attack: 40 } }), makeTag('B', { stats: { attack: 40 } })];
    const plan = bestPlan(team, battleOf(opp('boss'), opp('c1', { stats: { hp: 40 } }), opp('c2'), 1))!;
    const step = plan.steps.find((s) => s.expectDefeat)!;
    expect(step.isTarget).toBe(true);
    expect(step.why).toContain('it joins you as Support Pokémon and can still be caught at Catch Time');
  });

  it('marks predicted defeats as estimates, never as Official', () => {
    const team = [makeTag('A', { stats: { attack: 40 } }), makeTag('B', { stats: { attack: 40 } })];
    const battle = battleOf(opp('boss', { types: ['rock'] }), opp('c1', { stats: { hp: 40 } }), opp('c2', { stats: { hp: 40 } }));
    const plan = bestPlan(team, battle)!;
    for (const s of plan.steps.filter((x) => x.expectDefeat)) {
      expect(s.trust).not.toBe('confirmed');
      expect(s.why).toContain('estimate');
    }
  });

  it('defeats a crony target first and leaves the Boss alone when scores tie', () => {
    const team = [makeTag('A', { stats: { attack: 40 } }), makeTag('B', { stats: { attack: 40 } })];
    const battle = battleOf(opp('boss', { stats: { hp: 100 } }), opp('c1', { stats: { hp: 40 } }), opp('c2'), 1);
    const plan = bestPlan(team, battle)!;
    expect(plan.steps[0].aimAtIndex).toBe(1);
    expect(plan.steps.some((s) => s.aimAtIndex === 0)).toBe(false);
  });

  it('flags plans that rely on unknown stats counted as average', () => {
    const team = [makeTag('A'), makeTag('B')];
    expect(bestPlan(team, battleOf(opp('boss'), opp('c1'), opp('c2')))!.usesUnknownStats).toBe(false);
    const unknown = bestPlan(team, battleOf(opp('boss', { stats: { defense: null } }), opp('c1'), opp('c2')))!;
    expect(unknown.kind).toBe('searched');
    expect(unknown.usesUnknownStats).toBe(true);
    const unknownTeam = bestPlan([makeTag('A', { stats: { defense: null } }), makeTag('B')], battleOf(opp('boss'), opp('c1'), opp('c2')))!;
    expect(unknownTeam.usesUnknownStats).toBe(true);
  });

  it('explains when the usual plan would lose a tag to a dangerous crony', () => {
    const team = [makeTag('A'), makeTag('B')];
    const danger = opp('c1', { stats: { attack: 5000, speed: 999 } });
    const plan = bestPlan(team, battleOf(opp('boss'), danger, opp('c2')))!;
    expect(plan.steps.every((s) => s.aimAtIndex !== 1)).toBe(true);
    expect(plan.comparison).toBe('The usual crony-first plan would lose A to c1 on turn 1; this plan avoids that.');
  });

  it('compares with the usual plan even when it would aim at a defeated opponent', () => {
    const team = [makeTag('A', { stats: { attack: 40 } }), makeTag('B', { stats: { attack: 40 } })];
    const battle = battleOf(opp('boss'), opp('c1', { stats: { hp: 40 } }), opp('c2'), 1);
    // The usual plan's turn 3 aims at c1 after turn 2 defeats it.
    expect(simulate(team, battle, ruleOfThumbTurns(team, battle)!)).toBeNull();
    const plan = bestPlan(team, battle)!;
    expect(plan.comparison).not.toContain('does not fit');
  });

  it('reports the gain as damage on the target, measured against the usual plan', () => {
    // Normal moves do half damage to Rock. The usual plan hits the Normal crony (best matchup)
    // that cannot fall; the search defeats the weak Rock crony for a supporter instead.
    const team = [makeTag('A'), makeTag('B')];
    const battle = battleOf(opp('boss', { types: ['rock'] }), opp('c1', { types: ['rock'], stats: { hp: 40 } }), opp('c2'));
    const plan = bestPlan(team, battle)!;
    const usual = simulate(team, battle, ruleOfThumbTurns(team, battle)!)!;
    const searched = plan.steps.filter((s) => s.isTarget).reduce((sum, s) => sum + s.expectedDamage!, 0);
    const more = Math.round(searched - usual.damageToTarget);
    expect(more).toBe(60);
    expect(plan.comparison).toBe(`This plan beats the usual crony-first plan by about ${more} damage on your target.`);
  });

  it('labels the last rule-of-thumb hit as the strongest available one', () => {
    const team = [makeTag('A'), makeTag('B'), makeTag('C')];
    const plan = bestPlan(team, battleOf(opp('boss', { stats: { hp: null } }), opp('c1'), opp('c2')))!;
    expect(plan.steps[2].why).toBe('Your strongest available hit on the target.');
    expect(plan.usesUnknownStats).toBe(true);
  });
});
