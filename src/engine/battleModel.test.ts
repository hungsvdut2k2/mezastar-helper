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

  it('makes a Double Move two hits, each half of the total with its own effectiveness', () => {
    const raikou = makeTag('raikou', {
      types: ['electric'],
      gimmick: { kind: 'doubleMove', moveName: 'Thunder + Crunch', moveType: 'electric', moveTypes: ['electric', 'dark'] },
    });
    const total = MODEL.gimmickMultiplier.doubleMove;
    // Ground is immune to Thunder, but Crunch still lands.
    expect(damage(raikou, makeTag('g', { types: ['ground'] }), true)).toBeCloseTo((100 * total) / 2);
    expect(damage(raikou, makeTag('n'), true)).toBeCloseTo(100 * total);
    const zacian = makeTag('zacian', {
      types: ['fairy', 'steel'],
      gimmick: { kind: 'doubleMove', moveName: 'Behemoth Blade + Moonblast', moveType: 'steel', moveTypes: ['steel', 'fairy'] },
    });
    // Steel is neutral on Dragon; Moonblast is 2x on Dragon: (1 + 2) / 2 of the total.
    expect(damage(zacian, makeTag('d', { types: ['dragon'] }), true)).toBeCloseTo(100 * total * 1.5);
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

  it('lets a tired tag attack again, but later and weaker (Tiredness)', () => {
    const battle = battleOf(opp('boss'), opp('c1'), opp('c2'));
    const r = simulate([a, b], battle, [{ tagIndex: 0, aimAt: 0 }, { tagIndex: 0, aimAt: 0 }])!;
    expect(r).not.toBeNull();
    expect(r.outcomes.map((o) => o.tired)).toEqual([false, true]);
    expect(r.outcomes[1].damageDealt).toBeCloseTo(40 * MODEL.tiredAttackMultiplier);
  });

  it('makes a tired tag act after the opponent, even when it is faster', () => {
    // The Boss knocks out any tag it hits; a fresh, faster tag defeats it first.
    const hard = opp('boss', { stats: { attack: 5000, speed: 50, hp: 40 } });
    const battle = battleOf(hard, opp('c1'), opp('c2'));
    const fresh = simulate([a, b], battle, [{ tagIndex: 0, aimAt: 1 }, { tagIndex: 1, aimAt: 0 }])!;
    expect(fresh.outcomes[1]).toMatchObject({ tagLost: false, tired: false });
    const tired = simulate([a, b], battle, [{ tagIndex: 1, aimAt: 1 }, { tagIndex: 1, aimAt: 0 }])!;
    expect(tired.outcomes[1]).toMatchObject({ tagLost: true, tired: true, damageDealt: 0 });
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

  it('does not spend a special move when the tag is knocked out before attacking', () => {
    const z = { kind: 'zmove' as const, moveName: null, moveType: null };
    const z1 = makeTag('z1', { gimmick: z });
    const z2 = makeTag('z2', { gimmick: z });
    const killer = opp('c1', { stats: { attack: 5000, speed: 999 } });
    const battle = battleOf(opp('boss', { stats: { hp: 5000 } }), killer, opp('c2'));
    const r = simulate([z1, z2], battle, [{ tagIndex: 0, aimAt: 1 }, { tagIndex: 1, aimAt: 0 }])!;
    expect(r.outcomes.map((o) => o.usedGimmick)).toEqual([false, true]);
  });

  it('lets unlimited special moves (e.g. Double Move) trigger for every tag', () => {
    const d = { kind: 'doubleMove' as const, moveName: null, moveType: null };
    const d1 = makeTag('d1', { gimmick: d });
    const d2 = makeTag('d2', { gimmick: d });
    const battle = battleOf(opp('boss', { stats: { hp: 5000 } }), opp('c1'), opp('c2'));
    const r = simulate([d1, d2], battle, [{ tagIndex: 0, aimAt: 0 }, { tagIndex: 1, aimAt: 0 }])!;
    expect(r.outcomes.map((o) => o.usedGimmick)).toEqual([true, true]);
  });

  it('shares one once-per-battle limit between Dynamax and Gigantamax', () => {
    const dyna = makeTag('dyna', { gimmick: { kind: 'dynamax', moveName: null, moveType: null } });
    const giga = makeTag('giga', { gimmick: { kind: 'gigantamax', moveName: null, moveType: null } });
    const battle = battleOf(opp('boss', { stats: { hp: 5000 } }), opp('c1'), opp('c2'));
    const turns = [{ tagIndex: 0, aimAt: 0 as const }, { tagIndex: 1, aimAt: 0 as const }];
    expect(simulate([dyna, giga], battle, turns)!.outcomes.map((o) => o.usedGimmick)).toEqual([true, false]);
    expect(simulate([giga, dyna], battle, turns)!.outcomes.map((o) => o.usedGimmick)).toEqual([true, false]);
  });

  it('uses each limited special move (Mega, Dynamax, Z-Move) once per battle', () => {
    const z = { kind: 'zmove' as const, moveName: null, moveType: null };
    const z1 = makeTag('z1', { gimmick: z });
    const z2 = makeTag('z2', { gimmick: z });
    const battle = battleOf(opp('boss', { stats: { hp: 5000 } }), opp('c1'), opp('c2'));
    const r = simulate([z1, z2], battle, [{ tagIndex: 0, aimAt: 0 }, { tagIndex: 1, aimAt: 0 }])!;
    expect(r.outcomes.map((o) => o.usedGimmick)).toEqual([true, false]);
  });
});
