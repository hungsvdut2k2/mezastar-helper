import { TAGS } from './tags';
import { CUSTOM_ID_PATTERN, newCustomId } from './customTag';
import { SETS, isInSet, setLabel, setsOfTag, setsOfTagId } from './setInfo';
import { GIMMICKS, POKEMON_TYPES } from './types';

const inSet = (id: string) => TAGS.filter((t) => isInSet(t, id as never));
const V3 = inSet('stardust-v3');

describe('all sets', () => {
  it('derives at least one set for every tag, with the per-set counts the official pages list', () => {
    expect(TAGS.every((t) => setsOfTag(t).length >= 1)).toBe(true);
    const counts = Object.fromEntries(SETS.map((s) => [s.id, inSet(s.id).length]));
    // Regular Tags count in every set of their series that lists them (Stardust V1 lists none).
    expect(counts).toEqual({
      'stardust-v1': 70, 'stardust-v2': 73, 'stardust-v3': 73, 'stardust-v4': 73,
      'galaxy-v1': 73, 'galaxy-v2': 73, 'galaxy-v3': 73,
    });
    // 7 sets x 70 numbered tags + 2 series x 3 Regular Tags, each defined once.
    expect(TAGS).toHaveLength(7 * 70 + 6);
  });

  it('keeps Stardust V3 first and its ids unchanged', () => {
    expect(TAGS.slice(0, 73).map((t) => t.id)).toEqual(V3.map((t) => t.id));
    expect(TAGS[0].id).toBe('1-3-001');
    expect(V3.filter((t) => t.id.startsWith('R-')).map((t) => t.id)).toEqual(['R-1-1', 'R-1-2', 'R-1-3']);
  });

  it('keeps each numbered tag on its set prefix and official page', () => {
    for (const t of TAGS) {
      const sets = setsOfTag(t);
      if (/^R-/.test(t.id)) {
        for (const s of sets) expect(t.sources).toContain(s.url);
      } else {
        expect(sets).toHaveLength(1);
        expect(t.id.startsWith(`${sets[0].prefix}-`)).toBe(true);
        expect(t.sources[0]).toBe(sets[0].url);
      }
    }
  });

  it('has one id per printed Regular Tag per series, listed in every set that shows it', () => {
    const regular = TAGS.filter((t) => t.id.startsWith('R-'));
    expect(regular.map((t) => t.id)).toEqual(['R-1-1', 'R-1-2', 'R-1-3', 'R-2-1', 'R-2-2', 'R-2-3']);
    expect(new Set(regular.map((t) => t.printedCode ?? t.id)).size).toBe(6); // no duplicate printed codes
    expect(TAGS.some((t) => t.id.includes('-R-'))).toBe(false);
    expect(setsOfTagId('R-1-2').map((s) => s.id)).toEqual(['stardust-v2', 'stardust-v3', 'stardust-v4']);
    expect(setsOfTagId('R-2-1').map((s) => s.id)).toEqual(['galaxy-v1', 'galaxy-v2', 'galaxy-v3']);
    expect(inSet('stardust-v1').some((t) => t.id.startsWith('R-'))).toBe(false);
    expect(setLabel({ id: 'R-2-3' })).toBe('Galaxy (Regular)');
    expect(setLabel({ id: 'R-1-1' })).toBe('Stardust (Regular)');
    expect(setLabel({ id: '2-2-001' })).toBe('Galaxy V2');
  });

  it('uses the base Pokémon typing for Mega tags (Charizard 1-1-009 is fire/flying)', () => {
    expect(TAGS.find((t) => t.id === '1-1-009')?.types).toEqual(['fire', 'flying']);
  });

  it('has 10 Superstars and 15 Stars in every set, grade-unknown for the rest', () => {
    for (const s of SETS) {
      const tags = inSet(s.id);
      expect(tags.filter((t) => t.grade === 6)).toHaveLength(10);
      expect(tags.filter((t) => t.grade === 5)).toHaveLength(15);
      expect(tags.filter((t) => t.grade === null).length).toBe(tags.length - 25);
    }
  });
});

describe('Stardust V3 tags', () => {
  it('has 70 numbered tags and 3 Regular Tags', () => {
    expect(V3).toHaveLength(73);
    expect(TAGS.filter((t) => t.id.startsWith('R-1-'))).toHaveLength(3);
  });

  it('has unique ids', () => {
    expect(new Set(TAGS.map((t) => t.id)).size).toBe(TAGS.length);
  });

  it('lists the 10 official Superstars in code order', () => {
    const superstars = V3.filter((t) => t.grade === 6);
    expect(superstars.map((t) => t.name)).toEqual([
      'Lugia', 'Ho-Oh', 'Solgaleo', 'Lunala', 'Greninja', 'Zeraora', 'Eternatus', 'Keldeo', 'Grimmsnarl', 'Zygarde',
    ]);
    expect(superstars.map((t) => t.id)).toEqual(
      Array.from({ length: 10 }, (_, i) => `1-3-${String(i + 1).padStart(3, '0')}`),
    );
  });

  it('has 15 Stars (1-3-011 to 1-3-025)', () => {
    const stars = V3.filter((t) => t.grade === 5);
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

describe('player-added tags', () => {
  it('puts ids with the my- prefix in a My tags pseudo-set that is not in SETS', () => {
    expect(setsOfTagId('my-123').map((s) => s.name)).toEqual(['My tags']);
    expect(SETS.some((x) => x.id === 'my-tags')).toBe(false);
  });

  it('can never collide with a shipped id', () => {
    expect(TAGS.some((t) => t.id.startsWith('my-'))).toBe(false);
    expect(newCustomId()).toMatch(CUSTOM_ID_PATTERN);
    expect(newCustomId()).not.toBe(newCustomId());
  });
});
