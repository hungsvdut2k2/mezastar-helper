import { TAGS } from './tags';
import { CUSTOM_ID_PATTERN, newCustomId } from './customTag';
import { SETS, printedCode, setOfTag, setOfTagId } from './setInfo';
import { GIMMICKS, POKEMON_TYPES } from './types';

const inSet = (id: string) => TAGS.filter((t) => setOfTag(t)?.id === id);
const V3 = inSet('stardust-v3');

describe('all sets', () => {
  it('derives a set for every tag, with the counts the official pages list', () => {
    expect(TAGS.every((t) => setOfTag(t))).toBe(true);
    const counts = Object.fromEntries(SETS.map((s) => [s.id, inSet(s.id).length]));
    expect(counts).toEqual({
      'stardust-v1': 70, 'stardust-v2': 73, 'stardust-v3': 73, 'stardust-v4': 73,
      'galaxy-v1': 73, 'galaxy-v2': 73, 'galaxy-v3': 73,
    });
    expect(TAGS).toHaveLength(508);
  });

  it('keeps Stardust V3 first and its ids unchanged', () => {
    expect(TAGS.slice(0, 73).map((t) => t.id)).toEqual(V3.map((t) => t.id));
    expect(TAGS[0].id).toBe('1-3-001');
    expect(V3.filter((t) => t.id.startsWith('R-')).map((t) => t.id)).toEqual(['R-1-1', 'R-1-2', 'R-1-3']);
  });

  it('keeps each set on its own code prefix and official page', () => {
    for (const t of TAGS) {
      const set = setOfTag(t)!;
      if (!/^R-/.test(t.id) && !t.id.includes('-R-')) expect(t.id.startsWith(`${set.prefix}-`)).toBe(true);
      expect(t.sources[0]).toBe(set.url);
    }
  });

  it('namespaces Regular Tags per set and records the printed code', () => {
    const regular = TAGS.filter((t) => t.id.includes('R-'));
    expect(regular).toHaveLength(3 * 6);
    expect(inSet('stardust-v1').some((t) => t.id.includes('R-'))).toBe(false);
    const g2 = inSet('galaxy-v2').filter((t) => t.id.includes('R-'));
    expect(g2.map((t) => t.id)).toEqual(['2-2-R-1', '2-2-R-2', '2-2-R-3']);
    expect(g2.map((t) => printedCode(t))).toEqual(['R-2-1', 'R-2-2', 'R-2-3']);
    expect(setOfTagId('2-2-R-1')?.name).toBe('Galaxy V2');
    expect(setOfTagId('R-1-2')?.name).toBe('Stardust V3');
  });

  it('records Mega Charizard X typing for Stardust V1 Charizard', () => {
    expect(TAGS.find((t) => t.id === '1-1-009')?.types).toEqual(['fire', 'dragon']);
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
    expect(TAGS.filter((t) => t.id.startsWith('R-'))).toHaveLength(3);
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
    expect(setOfTagId('my-123')?.name).toBe('My tags');
    expect(SETS.some((x) => x.id === 'my-tags')).toBe(false);
  });

  it('can never collide with a shipped id', () => {
    expect(TAGS.some((t) => t.id.startsWith('my-'))).toBe(false);
    expect(newCustomId()).toMatch(CUSTOM_ID_PATTERN);
    expect(newCustomId()).not.toBe(newCustomId());
  });
});
