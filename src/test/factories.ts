import type { PlayLogEntry, Tag } from '../data/types';

export type TagOverrides = Partial<Omit<Tag, 'stats'>> & { stats?: Partial<Tag['stats']> };

/** A Normal-type test tag with known stats: HP 1000, Attack and Sp. Atk 100, Defense and Sp. Def 0, Speed 100. */
export function makeTag(id: string, overrides: TagOverrides = {}): Tag {
  const { stats, ...rest } = overrides;
  return {
    id,
    name: id,
    grade: 4,
    types: ['normal'],
    pokenergy: null,
    stats: { hp: 1000, attack: 100, defense: 0, spAttack: 100, spDefense: 0, speed: 100, ...stats },
    move: { name: 'Tackle', type: 'normal', category: 'physical' },
    gimmick: null,
    legendary: false,
    mythical: false,
    sources: ['test'],
    ...rest,
  };
}

export function makeLogEntry(overrides: Partial<PlayLogEntry> = {}): PlayLogEntry {
  return {
    id: 'entry-1',
    date: '2026-10-31T10:00:00.000Z',
    mode: 'battle',
    boss: '1-3-001',
    cronies: ['1-3-017', '1-3-041'],
    target: '1-3-001',
    superstarAppeared: true,
    teamUsed: ['1-3-002', '1-3-008', '1-3-012'],
    turns: [],
    cronyDefeatedCount: 0,
    bossDefeated: false,
    caught: null,
    ...overrides,
  };
}
