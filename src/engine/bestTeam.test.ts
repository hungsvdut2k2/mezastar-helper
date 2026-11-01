import { TAGS } from '../data/tags';
import { isInSet } from '../data/setInfo';
import { makeTag } from '../test/factories';
import { bestAllRoundTeams } from './bestTeam';

const attacker = (id: string, type: 'fire' | 'water' | 'grass' | 'normal', attack = 100) =>
  makeTag(id, { types: [type], move: { name: 'Hit', type }, stats: { attack } });

it('prefers a team that covers both opponent types over a plain one', () => {
  const opponents = [makeTag('g', { types: ['grass'] }), makeTag('w', { types: ['water'] })];
  const candidates = [attacker('fire', 'fire'), attacker('grass', 'grass'), attacker('n1', 'normal'), attacker('n2', 'normal')];
  const [best] = bestAllRoundTeams(candidates, opponents, 1);
  expect(best.team.map((t) => t.id)).toEqual(expect.arrayContaining(['fire', 'grass']));
  expect(best.strongAgainst).toBe(2);
  expect(best.weakAgainst).toBe(0);
});

it('weighs Superstars more than other opponents', () => {
  const opponents = [makeTag('star', { grade: 6, types: ['grass'] }), makeTag('a', { types: ['fire'] }), makeTag('b', { types: ['fire'] })];
  const candidates = [attacker('f', 'fire'), attacker('w', 'water'), attacker('n1', 'normal'), attacker('n2', 'normal')];
  const [best] = bestAllRoundTeams(candidates, opponents, 1);
  expect(best.team.map((t) => t.id)).toContain('f');
  expect(best.superstars).toBe(1);
  expect(best.superstarsStrong).toBe(1);
});

it('returns at most the requested count, and smaller teams when fewer than 3 candidates exist', () => {
  const opponents = [makeTag('o')];
  expect(bestAllRoundTeams([attacker('a', 'fire'), attacker('b', 'water')], opponents)).toHaveLength(1);
  expect(bestAllRoundTeams([], opponents)).toEqual([]);
});

it('runs over the whole Stardust V1–V3 pool and gives 3 distinct teams', () => {
  const pool = TAGS.filter((t) => ['stardust-v1', 'stardust-v2', 'stardust-v3'].some((s) => isInSet(t, s as 'stardust-v1')));
  const teams = bestAllRoundTeams(pool, pool);
  expect(teams).toHaveLength(3);
  expect(new Set(teams.map((t) => t.team.map((x) => x.id).join())).size).toBe(3);
  expect(teams[0].usesUnknownStats).toBe(false);
});
