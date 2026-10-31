import { TYPE_CHART } from '../data/typeChart';
import { POKEMON_TYPES } from '../data/types';
import { effectiveness, effectText } from './typeEffectiveness';

describe('type chart', () => {
  it('has a row for all 18 types with only 0, 0.5 or 2 entries', () => {
    expect(Object.keys(TYPE_CHART).sort()).toEqual([...POKEMON_TYPES].sort());
    for (const row of Object.values(TYPE_CHART)) {
      for (const m of Object.values(row)) expect([0, 0.5, 2]).toContain(m);
    }
  });
});

describe('effectiveness', () => {
  it('is 2 for Fire on Grass', () => expect(effectiveness('fire', ['grass'])).toBe(2));
  it('multiplies dual types (Water on Fire/Ground = 4)', () => expect(effectiveness('water', ['fire', 'ground'])).toBe(4));
  it('is 0.25 for Grass on Fire/Flying', () => expect(effectiveness('grass', ['fire', 'flying'])).toBe(0.25));
  it('is 0 for Electric on Ground', () => expect(effectiveness('electric', ['ground'])).toBe(0));
  it('is 1 when nothing applies', () => expect(effectiveness('normal', ['normal'])).toBe(1));
});

describe('effectText', () => {
  it('uses the words the machine shows', () => {
    expect(effectText(2)).toBe("It's effective!");
    expect(effectText(1)).toBe('Hit');
    expect(effectText(0.5)).toBe("It's not so effective...");
    expect(effectText(0)).toBe('No effect');
  });
});
