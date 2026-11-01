import type { Tag, TagCorrection } from '../data/types';

export function applyCorrections(tags: Tag[], corrections: Record<string, TagCorrection>): Tag[] {
  return tags.map((t) => {
    const c = corrections[t.id];
    if (!c) return t;
    return {
      ...t,
      grade: c.grade !== undefined ? c.grade : t.grade,
      types: c.types ?? t.types,
      pokenergy: c.pokenergy !== undefined ? c.pokenergy : t.pokenergy,
      move: c.move !== undefined ? c.move : t.move,
      stats: { ...t.stats, ...c.stats },
      sources: [...t.sources, 'player correction'],
    };
  });
}
