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

  it('records what the player saw about Tiredness', () => {
    const tired = MECHANICS.find((m) => m.id === 'tiredness')!;
    expect(tired.trust).toBe('player');
    expect(tired.explanation).toMatch(/can still attack/);
  });

  it('records that a defeated crony can still be caught', () => {
    const m = MECHANICS.find((x) => x.id === 'defeated-crony-catchable')!;
    expect(m.trust).toBe('player');
    expect(m.explanation).toMatch(/still be caught/);
  });
});

describe('open questions', () => {
  it('has unique ids and starts with the lanes question', () => {
    expect(new Set(OPEN_QUESTIONS.map((q) => q.id)).size).toBe(OPEN_QUESTIONS.length);
    expect(OPEN_QUESTIONS[0].id).toBe('lanes');
  });

  it('no longer asks the Tiredness question the player answered', () => {
    expect(OPEN_QUESTIONS.map((q) => q.id)).not.toContain('tired-speed');
  });
});
