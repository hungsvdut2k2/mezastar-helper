import type { Tag } from '../data/types';
import { makeTag, type TagOverrides } from '../test/factories';
import { attacksFirst, damage, MODEL, simulate, type Battle } from './battleModel';

/** Opponents that barely hit back (Attack 1) and are slow (Speed 1). */
const opp = (id: string, o: TagOverrides = {}) => makeTag(id, { ...o, stats: { attack: 1, speed: 1, ...o.stats } });
const battleOf = (boss: Tag, c1: Tag, c2: Tag, targetIndex: 0 | 1 | 2 = 0): Battle => ({
  opponents: [boss, c1, c2],
  targetIndex,
});

describe('damage', () => {
  it('is Attack × effectiveness ÷ defense factor', () => {
    const fire = makeTag('fire', { move: { name: 'Ember', type: 'fire' } });
    expect(damage(fire, makeTag('g', { types: ['grass'] }), false)).toBe(200);
    expect(damage(fire, makeTag('g', { types: ['grass'], stats: { defense: 200 } }), false)).toBe(100);
  });

  it('uses the special move type and multiplier on the first attack only', () => {
    const z = makeTag('z', { gimmick: { kind: 'zmove', moveName: 'Black Hole Eclipse', moveType: 'dark' } });
    const psychic = makeTag('p', { types: ['psychic'] });
    expect(damage(z, psychic, true)).toBeCloseTo(100 * 2 * MODEL.gimmickMultiplier.zmove);
    expect(damage(z, psychic, false)).toBe(100);
  });

  it('treats unknown stats as average', () => {
    const unknown = makeTag('u', { stats: { attack: null } });
    expect(damage(unknown, makeTag('n'), false)).toBe(MODEL.neutralStat);
  });
});

describe('attacksFirst', () => {
  it('lets the faster Pokémon go first; ties go to the player', () => {
    expect(attacksFirst(makeTag('a'), makeTag('b'))).toBe(true);
    expect(attacksFirst(makeTag('a', { stats: { speed: 50 } }), makeTag('b'))).toBe(false);
  });
});

describe('simulate', () => {
  const a = makeTag('A', { stats: { attack: 40 } });
  const b = makeTag('B', { stats: { attack: 40 } });

  it('adds a supporter from the turn after a crony is defeated', () => {
    const battle = battleOf(opp('boss'), opp('c1', { stats: { hp: 40 } }), opp('c2'));
    const r = simulate([a, b], battle, [{ tagIndex: 0, aimAt: 1 }, { tagIndex: 1, aimAt: 0 }])!;
    expect(r.outcomes[0]).toMatchObject({ defeated: true, supporters: 0, damageDealt: 40 });
    expect(r.outcomes[1]).toMatchObject({ supporters: 1, damageDealt: 40 + MODEL.supporterBonus });
    expect(r.damageToTarget).toBe(40 + MODEL.supporterBonus);
  });

  it('rejects the same tag on two turns in a row (Tiredness)', () => {
    const battle = battleOf(opp('boss'), opp('c1'), opp('c2'));
    expect(simulate([a, b], battle, [{ tagIndex: 0, aimAt: 0 }, { tagIndex: 0, aimAt: 1 }])).toBeNull();
  });

  it('ends the battle when the Boss is defeated', () => {
    const battle = battleOf(opp('boss', { stats: { hp: 30 } }), opp('c1'), opp('c2'));
    const r = simulate([a, b], battle, [{ tagIndex: 0, aimAt: 0 }, { tagIndex: 1, aimAt: 1 }])!;
    expect(r.outcomes).toHaveLength(1);
    expect(r.bossDefeated).toBe(true);
    expect(r.score).toBe(30 + MODEL.targetDefeatBonus);
  });

  it('counts a tag knocked out before it can attack, and forbids using it again', () => {
    const killer = opp('c1', { stats: { attack: 5000, speed: 999 } });
    const battle = battleOf(opp('boss'), killer, opp('c2'));
    const r = simulate([a, b], battle, [{ tagIndex: 0, aimAt: 1 }])!;
    expect(r.outcomes[0]).toMatchObject({ damageDealt: 0, tagLost: true });
    expect(r.score).toBe(-MODEL.lostTagPenalty);
    const again = [{ tagIndex: 0, aimAt: 1 }, { tagIndex: 1, aimAt: 0 }, { tagIndex: 0, aimAt: 0 }] as const;
    expect(simulate([a, b], battle, [...again])).toBeNull();
  });

  it('rejects aiming at an opponent that is already defeated', () => {
    const battle = battleOf(opp('boss'), opp('c1', { stats: { hp: 40 } }), opp('c2'));
    expect(simulate([a, b], battle, [{ tagIndex: 0, aimAt: 1 }, { tagIndex: 1, aimAt: 1 }])).toBeNull();
  });

  it('uses each kind of special move once per battle', () => {
    const z = { kind: 'zmove' as const, moveName: null, moveType: null };
    const z1 = makeTag('z1', { gimmick: z });
    const z2 = makeTag('z2', { gimmick: z });
    const battle = battleOf(opp('boss', { stats: { hp: 5000 } }), opp('c1'), opp('c2'));
    const r = simulate([z1, z2], battle, [{ tagIndex: 0, aimAt: 0 }, { tagIndex: 1, aimAt: 0 }])!;
    expect(r.outcomes.map((o) => o.usedGimmick)).toEqual([true, false]);
  });
});
