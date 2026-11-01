import { makeTag } from '../test/factories';
import { isUnknownOpponent, type Battle } from './battleModel';
import { TAGS } from '../data/tags';
import { cronyPairs, cronyPool, ODDS_SAMPLE, recommend, recommendOverCronies, unknownOpponent } from './recommend';
import { teamScoreValue, topTeamsOver } from './teamScoring';

const battle: Battle = { opponents: [makeTag('boss'), makeTag('c1'), makeTag('c2')], targetIndex: 0 };

describe('recommend', () => {
  it('gives up to 3 teams, each with a battle plan', () => {
    const owned = ['a', 'b', 'c', 'd'].map((id) => makeTag(id));
    const recs = recommend(owned, battle);
    expect(recs).toHaveLength(3);
    for (const r of recs) expect(r.plan?.steps.length).toBeGreaterThan(0);
  });

  it('gives a team without a plan when only one tag is owned', () => {
    const recs = recommend([makeTag('a')], battle);
    expect(recs).toHaveLength(1);
    expect(recs[0].plan).toBeNull();
  });
});

describe('unknownOpponent', () => {
  it('builds ids that isUnknownOpponent recognises', () => {
    expect(isUnknownOpponent(unknownOpponent(1))).toBe(true);
    expect(unknownOpponent(1).id).not.toBe(unknownOpponent(2).id);
  });

  it('is a neutral placeholder with unknown stats', () => {
    const o = unknownOpponent(1);
    expect(o.name).toBe('Unknown crony');
    expect(Object.values(o.stats).every((v) => v === null)).toBe(true);
    expect(o.types).toEqual([]); // no type: every matchup counts as neutral
  });

  it('can be planned against', () => {
    const owned = ['a', 'b', 'c'].map((id) => makeTag(id));
    const withUnknown: Battle = { opponents: [makeTag('boss'), unknownOpponent(1), unknownOpponent(2)], targetIndex: 0 };
    const [rec] = recommend(owned, withUnknown);
    expect(rec.reason).toContain('Unknown crony (crony): Hit');
    expect(rec.plan?.steps.length).toBeGreaterThan(0);
  });
});

describe('averaging over possible cronies', () => {
  const lugia = TAGS.find((t) => t.id === '1-3-001')!;

  it('takes the crony pool from the target\'s own set, without the target', () => {
    const pool = cronyPool(lugia, TAGS);
    expect(pool.length).toBeGreaterThan(10);
    expect(pool.some((t) => t.id === lugia.id)).toBe(false);
    expect(pool.every((t) => t.id.startsWith('1-3-') || t.id.startsWith('R-1-'))).toBe(true);
  });

  it('lists every distinct pair for two blanks and keeps a known crony in its slot', () => {
    const [a, b, c] = ['a', 'b', 'c'].map((id) => makeTag(id));
    expect(cronyPairs([a, b, c], [null, null]).map((p) => p.map((t) => t.id).join())).toEqual(['a,b', 'a,c', 'b,c']);
    expect(cronyPairs([a, b, c], [null, b]).map((p) => p.map((t) => t.id).join())).toEqual(['a,b', 'c,b']);
  });

  it('averaging per crony equals averaging over every pair (the score adds one part per opponent)', () => {
    const boss = makeTag('boss', { types: ['grass'] });
    const pool = [makeTag('w', { types: ['water'] }), makeTag('f', { types: ['fire'] }), makeTag('g', { types: ['grass'] })];
    const team = [makeTag('t1', { move: { name: 'Ember', type: 'fire' } }), makeTag('t2'), makeTag('t3')];
    const pairs = cronyPairs(pool, [null, null]).flatMap(([x, y]) => [[x, y], [y, x]]);
    const overPairs = pairs.reduce((s, [x, y]) => s + teamScoreValue(team, { opponents: [boss, x, y], targetIndex: 0 }), 0) / pairs.length;
    const perCrony = pool.reduce((s, c) => s + teamScoreValue(team, { opponents: [boss, c, c], targetIndex: 0 }), 0) / pool.length;
    expect(overPairs).toBeCloseTo(perCrony);
  });

  it('prefers the team that handles the likely cronies over one tuned for neutral stand-ins', () => {
    const boss = makeTag('boss');
    const waterCronies = ['c1', 'c2', 'c3'].map((id) => makeTag(id, { types: ['water'], move: { name: 'Surf', type: 'water' } }));
    const grass = (id: string) => makeTag(id, { types: ['grass'], move: { name: 'Leaf', type: 'grass' } });
    const fire = (id: string) => makeTag(id, { types: ['fire'], move: { name: 'Ember', type: 'fire' }, stats: { attack: 110 } });
    const owned = [grass('g1'), grass('g2'), grass('g3'), fire('f1'), fire('f2'), fire('f3')];
    const battles = waterCronies.map((c) => ({ opponents: [boss, c, c] as [typeof c, typeof c, typeof c], targetIndex: 0 as const }));
    const shown: Battle = { opponents: [boss, unknownOpponent(1), unknownOpponent(2)], targetIndex: 0 };
    expect(topTeamsOver(owned, battles, shown, 1)[0].team.every((t) => t.id.startsWith('g'))).toBe(true);
    expect(recommend(owned, shown, 1)[0].team.every((t) => t.id.startsWith('f'))).toBe(true);
  });

  it('ranks Lugia teams with a plan against stand-ins and the win rate over sampled crony pairs', () => {
    const owned = ['1-3-002', '1-3-008', '1-3-012', '1-1-001'].map((id) => TAGS.find((t) => t.id === id)!);
    const pool = cronyPool(lugia, TAGS);
    const [best] = recommendOverCronies(owned, lugia, [null, null], pool, 1);
    expect(best.plan).not.toBeNull();
    expect(best.reason).toContain('Unknown crony');
    expect(best.odds?.totalPairs).toBe((pool.length * (pool.length - 1)) / 2);
    expect(best.odds?.pairs).toBeLessThanOrEqual(ODDS_SAMPLE);
    expect(best.odds!.wins).toBeLessThanOrEqual(best.odds!.pairs);
  });

  it('falls back to the plain recommendation when both cronies are known', () => {
    const [a, b] = ['a', 'b'].map((id) => makeTag(id));
    const owned = ['x', 'y', 'z'].map((id) => makeTag(id));
    const [rec] = recommendOverCronies(owned, makeTag('boss'), [a, b], [a, b], 1);
    expect(rec.odds).toBeUndefined();
  });
});
