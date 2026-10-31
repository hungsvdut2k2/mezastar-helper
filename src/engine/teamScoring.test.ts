import { makeTag } from '../test/factories';
import type { Battle } from './battleModel';
import { hitPower, rankTags, scoreTeam, topTeams, WEIGHTS } from './teamScoring';

const fire = makeTag('fire', { move: { name: 'Ember', type: 'fire' } });
const grass = makeTag('grass', { move: { name: 'Vine Whip', type: 'grass' } });
const water = makeTag('water', { move: { name: 'Water Gun', type: 'water' } });
const normal = makeTag('normal');

const grassBossWaterCronies: Battle = {
  opponents: [makeTag('boss', { types: ['grass'] }), makeTag('c1', { types: ['water'] }), makeTag('c2', { types: ['water'] })],
  targetIndex: 0,
};

describe('hitPower', () => {
  it('is Attack × effectiveness of the move type', () => {
    expect(hitPower(fire, grassBossWaterCronies.opponents[0])).toBe(200);
    expect(hitPower(water, grassBossWaterCronies.opponents[0])).toBe(50);
  });
});

describe('rankTags', () => {
  it('keeps the 15 strongest tags for this battle', () => {
    const many = Array.from({ length: 20 }, (_, i) => makeTag(`t${i}`, { stats: { attack: 10 * (i + 1) } }));
    const pool = rankTags(many, grassBossWaterCronies);
    expect(pool).toHaveLength(WEIGHTS.poolSize);
    expect(pool.map((t) => t.id)).not.toContain('t0');
    expect(pool[0].id).toBe('t19');
  });
});

describe('scoreTeam', () => {
  it('penalises a team with only one good attacker on the target (Tiredness)', () => {
    const allGrass: Battle = {
      opponents: [makeTag('boss', { types: ['grass'] }), makeTag('c1', { types: ['grass'] }), makeTag('c2', { types: ['grass'] })],
      targetIndex: 0,
    };
    const fire2 = makeTag('fire2', { move: { name: 'Ember', type: 'fire' } });
    const water2 = makeTag('water2', { move: { name: 'Water Gun', type: 'water' } });
    const twoGood = scoreTeam([fire, fire2, water], allGrass).score;
    const oneGood = scoreTeam([fire, water, water2], allGrass).score;
    expect(twoGood - oneGood).toBeCloseTo(WEIGHTS.rotationPenalty);
  });

  it('says when stats are unknown', () => {
    const unknown = makeTag('u', { stats: { speed: null } });
    const result = scoreTeam([unknown, fire, grass], grassBossWaterCronies);
    expect(result.usesUnknownStats).toBe(true);
    expect(result.reason).toContain('unknown');
  });
});

describe('topTeams', () => {
  it('ranks the team that covers the target and the cronies first', () => {
    const teams = topTeams([normal, water, grass, fire], grassBossWaterCronies);
    expect(teams).toHaveLength(3);
    const best = teams[0].team.map((t) => t.id);
    expect(best).toContain('fire');
    expect(best).toContain('grass');
    expect(teams[0].reason).toContain("fire → boss (target): It's effective!");
    expect(teams[0].score).toBeGreaterThanOrEqual(teams[1].score);
  });

  it('returns one smaller team when fewer than 3 tags are owned', () => {
    const teams = topTeams([fire, grass], grassBossWaterCronies);
    expect(teams).toHaveLength(1);
    expect(teams[0].team).toHaveLength(2);
  });

  it('returns nothing when no tags are owned', () => {
    expect(topTeams([], grassBossWaterCronies)).toEqual([]);
  });
});
