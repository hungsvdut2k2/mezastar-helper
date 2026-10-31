import { MECHANICS, OPEN_QUESTIONS } from './mechanics';
import { TRUST_LEVELS } from './types';

describe('mechanics', () => {
  it('has unique ids and valid trust levels', () => {
    expect(new Set(MECHANICS.map((m) => m.id)).size).toBe(MECHANICS.length);
    for (const m of MECHANICS) expect(TRUST_LEVELS).toContain(m.trust);
  });

  it('gives every mechanic a source unless it is open', () => {
    for (const m of MECHANICS.filter((x) => x.trust !== 'open')) expect(m.sources.length).toBeGreaterThan(0);
  });

  it('records that the player chooses which opponent to attack', () => {
    expect(MECHANICS.find((m) => m.id === 'choose-opponent')?.trust).toBe('player');
  });
});

describe('open questions', () => {
  it('has unique ids and starts with the lanes question', () => {
    expect(new Set(OPEN_QUESTIONS.map((q) => q.id)).size).toBe(OPEN_QUESTIONS.length);
    expect(OPEN_QUESTIONS[0].id).toBe('lanes');
  });
});
