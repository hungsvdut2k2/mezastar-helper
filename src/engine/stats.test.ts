import { TAGS } from '../data/tags';
import { makeLogEntry } from '../test/factories';
import { computeStats } from './stats';

const log = [
  makeLogEntry({
    id: 'a', location: 'Mall A', target: '1-3-001', caught: '1-3-001', bossDefeated: true, cronyDefeatedCount: 2,
    turns: [{ attacker: '1-3-002', aimedAt: '1-3-017', defeated: '1-3-017', predictedDefeat: true }],
  }),
  makeLogEntry({
    id: 'b', location: 'Mall A', target: '1-3-001', caught: null, bossDefeated: false, cronyDefeatedCount: 0,
    turns: [{ attacker: '1-3-002', aimedAt: '1-3-017', predictedDefeat: true }],
  }),
  makeLogEntry({
    id: 'c', target: '1-3-017', caught: '1-3-041', bossDefeated: true, cronyDefeatedCount: 1, superstarAppeared: false,
  }),
];

describe('computeStats', () => {
  const s = computeStats(log, TAGS);

  it('counts plays, wins and catches', () => {
    expect(s).toMatchObject({ plays: 3, wins: 2, catches: 2, superstarsSeen: 2, superstarsCaught: 1 });
  });

  it('measures how often the target was caught, overall and by win/loss', () => {
    expect(s.targetCatch).toEqual({ count: 3, caught: 1, rate: 1 / 3 });
    expect(s.whenWon).toEqual({ count: 2, caught: 1, rate: 0.5 });
    expect(s.whenLost).toEqual({ count: 1, caught: 0, rate: 0 });
  });

  it('groups by target grade, Superstars first', () => {
    expect(s.byTargetGrade).toEqual([
      { grade: '6★', rate: { count: 2, caught: 1, rate: 0.5 } },
      { grade: '5★', rate: { count: 1, caught: 0, rate: 0 } },
    ]);
  });

  it('compares plays where a crony was defeated against plays where none was', () => {
    expect(s.cronyDefeated).toEqual({ count: 2, caught: 1, rate: 0.5 });
    expect(s.noCronyDefeated).toEqual({ count: 1, caught: 0, rate: 0 });
  });

  it('counts Superstars seen per location', () => {
    expect(s.byLocation).toEqual([
      { location: 'Mall A', plays: 2, superstarsSeen: 2 },
      { location: 'Unlabelled', plays: 1, superstarsSeen: 0 },
    ]);
  });

  it('checks the model\'s one-hit predictions', () => {
    expect(s.predictions).toEqual({ checked: 2, correct: 1, rate: 0.5 });
  });

  it('handles an empty log', () => {
    const empty = computeStats([], TAGS);
    expect(empty.plays).toBe(0);
    expect(empty.targetCatch.rate).toBeNull();
    expect(empty.predictions.rate).toBeNull();
  });
});
