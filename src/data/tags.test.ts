import { TAGS } from './tags';
import { GIMMICKS, POKEMON_TYPES } from './types';

describe('Stardust V3 tags', () => {
  it('has 70 numbered tags and 3 Regular Tags', () => {
    expect(TAGS).toHaveLength(73);
    expect(TAGS.filter((t) => t.id.startsWith('R-'))).toHaveLength(3);
  });

  it('has unique ids', () => {
    expect(new Set(TAGS.map((t) => t.id)).size).toBe(TAGS.length);
  });

  it('lists the 10 official Superstars in code order', () => {
    const superstars = TAGS.filter((t) => t.grade === 6);
    expect(superstars.map((t) => t.name)).toEqual([
      'Lugia', 'Ho-Oh', 'Solgaleo', 'Lunala', 'Greninja', 'Zeraora', 'Eternatus', 'Keldeo', 'Grimmsnarl', 'Zygarde',
    ]);
    expect(superstars.map((t) => t.id)).toEqual(
      Array.from({ length: 10 }, (_, i) => `1-3-${String(i + 1).padStart(3, '0')}`),
    );
  });

  it('has 15 Stars (1-3-011 to 1-3-025)', () => {
    const stars = TAGS.filter((t) => t.grade === 5);
    expect(stars).toHaveLength(15);
    expect(stars[0].id).toBe('1-3-011');
    expect(stars[14].id).toBe('1-3-025');
  });

  it('only uses valid grades, 1–2 distinct valid types and valid gimmicks', () => {
    for (const t of TAGS) {
      expect([null, 2, 3, 4, 5, 6]).toContain(t.grade);
      expect(t.types.length).toBeGreaterThanOrEqual(1);
      expect(t.types.length).toBeLessThanOrEqual(2);
      expect(new Set(t.types).size).toBe(t.types.length);
      for (const type of t.types) expect(POKEMON_TYPES).toContain(type);
      if (t.gimmick) expect(GIMMICKS).toContain(t.gimmick.kind);
      expect(t.sources.length).toBeGreaterThan(0);
    }
  });

  it('never invents stats', () => {
    for (const t of TAGS) {
      expect(Object.values(t.stats).every((v) => v === null)).toBe(true);
      expect(t.pokenergy).toBeNull();
    }
  });
});
