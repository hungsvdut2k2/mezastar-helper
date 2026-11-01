import { MECHANICS, OPEN_QUESTIONS } from './mechanics';
import { SETS } from './setInfo';
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

describe('Superstar lineups', () => {
  it('has one confirmed entry per set with its 10 Superstars and official page', () => {
    for (const set of SETS) {
      const m = MECHANICS.find((x) => x.id === `superstars-${set.id}`)!;
      expect(m.title).toBe(`${set.name} Superstars`);
      expect(m.trust).toBe('confirmed');
      expect(m.sources).toEqual([set.url]);
      expect(m.explanation.split(` (${set.prefix}-001`)[0].split(', ')).toHaveLength(10);
    }
    expect(MECHANICS.find((x) => x.id === 'superstars-stardust-v3')!.explanation).toMatch(/^Lugia, Ho-Oh, .*Zygarde \(1-3-001 to 1-3-010\)/);
    expect(MECHANICS.find((x) => x.id === 'superstars-galaxy-v1')!.explanation).toMatch(/^Rillaboom, /);
  });
});

describe('Galaxy mechanics', () => {
  it('records the Gigantamax and Double Move modelling as community assumptions', () => {
    const g = MECHANICS.find((x) => x.id === 'gigantamax')!;
    expect(g.trust).toBe('community');
    expect(g.explanation).toMatch(/share the Dynamax once-per-battle limit/);
    const d = MECHANICS.find((x) => x.id === 'double-move')!;
    expect(d.trust).toBe('community');
    expect(d.explanation).toMatch(/two hits/);
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
