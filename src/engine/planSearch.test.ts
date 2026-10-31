import type { Tag } from '../data/types';
import { makeTag, type TagOverrides } from '../test/factories';
import type { Battle } from './battleModel';
import { bestPlan } from './planSearch';

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
});
