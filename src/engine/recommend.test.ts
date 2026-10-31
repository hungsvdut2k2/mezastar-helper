import { makeTag } from '../test/factories';
import type { Battle } from './battleModel';
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
  it('is a neutral placeholder with unknown stats', () => {
    const o = unknownOpponent('x');
    expect(o.name).toBe('Unknown crony');
    expect(Object.values(o.stats).every((v) => v === null)).toBe(true);
  });
});
