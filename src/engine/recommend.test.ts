import { makeTag } from '../test/factories';
import { isUnknownOpponent, type Battle } from './battleModel';
import { recommend, unknownOpponent } from './recommend';

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
