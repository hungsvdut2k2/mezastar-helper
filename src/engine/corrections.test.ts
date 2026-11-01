import { TAGS } from '../data/tags';
import { applyCorrections } from './corrections';

describe('applyCorrections', () => {
  it('overrides only the corrected fields and marks the source', () => {
    const [lugia] = applyCorrections(TAGS, { '1-3-001': { stats: { attack: 150 } } });
    expect(lugia.stats).toEqual({ ...TAGS[0].stats, attack: 150 });
    expect(lugia.types).toEqual(['psychic', 'flying']);
    expect(lugia.move).toEqual({ name: 'Aeroblast', type: 'flying', category: 'special' });
    expect(lugia.sources).toContain('player correction');
  });

  it('can set a field back to unknown', () => {
    const [lugia] = applyCorrections(TAGS, { '1-3-001': { grade: null, move: null } });
    expect(lugia.grade).toBeNull();
    expect(lugia.move).toBeNull();
  });

  it('leaves uncorrected tags as the same objects', () => {
    const result = applyCorrections(TAGS, { '1-3-001': { pokenergy: 3 } });
    expect(result[1]).toBe(TAGS[1]);
    expect(result).toHaveLength(TAGS.length);
  });
});
