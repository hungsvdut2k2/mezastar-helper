import { makeTag } from '../test/factories';
import type { Battle } from './battleModel';
import { unknownOpponent } from './recommend';
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
  const average = makeTag('average', { types: ['grass'], stats: { defense: 100, spDefense: 100 } });

  it('is Attack × effectiveness of the move type against an average opponent', () => {
    expect(hitPower(fire, average)).toBe(200);
    expect(hitPower(water, average)).toBe(50);
  });

  it('scales with the Defense the move hits: an opponent with no Defense takes 1.5×', () => {
    expect(hitPower(fire, grassBossWaterCronies.opponents[0])).toBe(300);
  });

  it('uses Sp. Atk against Sp. Def for special moves', () => {
    const special = makeTag('sp', { move: { name: 'Shadow Ball', type: 'ghost', category: 'special' }, stats: { attack: 50, spAttack: 150 } });
    expect(hitPower(special, makeTag('o', { types: ['fire'], stats: { defense: 300, spDefense: 100 } }))).toBe(150);
    expect(hitPower(special, makeTag('o', { types: ['fire'], stats: { defense: 100, spDefense: 300 } }))).toBe(90);
  });

  it('uses the higher attacking stat when the move category is unknown', () => {
    const unknown = (attack: number, spAttack: number) => makeTag('u', { move: { name: 'Hit', type: 'normal' }, stats: { attack, spAttack } });
    expect(hitPower(unknown(60, 140), average)).toBe(140);
    expect(hitPower(unknown(140, 60), average)).toBe(140);
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

  it('breaks ties by tag id so the pool is always the same', () => {
    const pool = rankTags([makeTag('b'), makeTag('c'), makeTag('a')], grassBossWaterCronies);
    expect(pool.map((t) => t.id)).toEqual(['a', 'b', 'c']);
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

  it('applies the rotation penalty when no tag can hit the target at all', () => {
    const ghostBoss = makeTag('boss', { types: ['ghost'] });
    const team = [makeTag('n1'), makeTag('n2')];
    const cronies = [makeTag('c1', { stats: { defense: 100 } }), makeTag('c2', { stats: { defense: 100 } })] as const;
    const bossTarget = scoreTeam(team, { opponents: [ghostBoss, ...cronies], targetIndex: 0 }).score;
    const cronyTarget = scoreTeam(team, { opponents: [ghostBoss, ...cronies], targetIndex: 1 }).score;
    // Coverage moves 100 points (the crony counts double instead of the Ghost Boss); the rest is the penalty.
    expect(cronyTarget - bossTarget).toBeCloseTo(100 + WEIGHTS.rotationPenalty);
  });

  it('counts a limited special move (Z-Move) once per team, others for every tag', () => {
    const z = (id: string) => makeTag(id, { gimmick: { kind: 'zmove', moveName: null, moveType: null } });
    const d = (id: string) => makeTag(id, { gimmick: { kind: 'doubleMove', moveName: null, moveType: null } });
    const base = scoreTeam([z('a'), makeTag('b'), normal], grassBossWaterCronies).score;
    expect(scoreTeam([z('a'), z('b'), normal], grassBossWaterCronies).score).toBeCloseTo(base);
    expect(scoreTeam([d('a'), d('b'), normal], grassBossWaterCronies).score).toBeCloseTo(base + WEIGHTS.gimmick);
  });

  it('gives Dynamax and Gigantamax one shared bonus per team', () => {
    const dyna = (id: string) => makeTag(id, { gimmick: { kind: 'dynamax', moveName: null, moveType: null } });
    const giga = (id: string) => makeTag(id, { gimmick: { kind: 'gigantamax', moveName: null, moveType: null } });
    const one = scoreTeam([dyna('a'), makeTag('b'), normal], grassBossWaterCronies).score;
    expect(scoreTeam([dyna('a'), giga('b'), normal], grassBossWaterCronies).score).toBeCloseTo(one);
    expect(scoreTeam([giga('a'), giga('b'), normal], grassBossWaterCronies).score).toBeCloseTo(one);
  });

  it('treats an unknown crony as type-neutral', () => {
    const ghostMove = makeTag('ghostMove', { move: { name: 'Lick', type: 'ghost' } });
    const fightingMove = makeTag('fightingMove', { move: { name: 'Karate Chop', type: 'fighting' } });
    const battle: Battle = {
      opponents: [makeTag('boss', { types: ['fire'] }), unknownOpponent(1), unknownOpponent(2)],
      targetIndex: 0,
    };
    expect(hitPower(ghostMove, battle.opponents[1])).toBe(hitPower(fightingMove, battle.opponents[1]));
    expect(scoreTeam([ghostMove], battle).score).toBeCloseTo(scoreTeam([fightingMove], battle).score);
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
