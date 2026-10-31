import type { Grade, PokemonType, Tag, Trust } from '../data/types';

export const gradeLabel = (g: Grade | null) => (g === null ? 'grade unknown' : `${g}★`);

export const typeLabel = (t: PokemonType) => t[0].toUpperCase() + t.slice(1);

export const TRUST_LABEL: Record<Trust, string> = {
  confirmed: 'Official',
  player: 'Seen by you',
  community: 'Community tip',
  open: 'Open question',
};

export const percent = (rate: number | null) => (rate === null ? '—' : `${Math.round(rate * 100)}%`);

export function searchTags(tags: Tag[], query: string): Tag[] {
  const q = query.trim().toLowerCase();
  if (!q) return tags;
  return tags.filter((t) => t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q));
}
