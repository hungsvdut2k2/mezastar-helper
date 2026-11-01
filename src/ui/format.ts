import type { Grade, MoveCategory, PokemonType, Tag, Trust } from '../data/types';

export const gradeLabel = (g: Grade | null) => (g === null ? 'grade unknown' : `${g}★`);

export const typeLabel = (t: PokemonType) => t[0].toUpperCase() + t.slice(1);

export const categoryLabel = (c: MoveCategory) => (c === 'special' ? 'Special' : 'Physical');

export const TRUST_LABEL: Record<Trust, string> = {
  confirmed: 'Official',
  player: 'Seen by you',
  community: 'Community tip',
  open: 'Open question',
  estimate: 'Estimate',
};

export const percent = (rate: number | null) => (rate === null ? '—' : `${Math.round(rate * 100)}%`);

export function searchTags(tags: Tag[], query: string): Tag[] {
  const q = query.trim().toLowerCase();
  if (!q) return tags;
  return tags.filter((t) => t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q) || (t.printedCode?.toLowerCase().includes(q) ?? false));
}

const two = (n: number) => String(n).padStart(2, '0');

/** YYYY-MM-DD in the phone's local time zone (not UTC). */
export function localDate(when: Date | string): string {
  const d = typeof when === 'string' ? new Date(when) : when;
  if (Number.isNaN(d.getTime())) return typeof when === 'string' ? when.slice(0, 10) : '';
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

const SLOT_NAMES = ['Boss', 'Crony 1', 'Crony 2'];

/**
 * Opponent names for buttons. If two share a name, every label gets its slot, e.g. "Crony 1: Pidgeot".
 * An empty slot reads "Crony 1 (needs opponent)".
 */
export function opponentLabels(opponents: (Tag | null)[]): string[] {
  const names = opponents.flatMap((o) => (o ? [o.name] : []));
  const duplicated = new Set(names).size < names.length;
  return opponents.map((o, i) => (!o ? `${SLOT_NAMES[i]} (needs opponent)` : duplicated ? `${SLOT_NAMES[i]}: ${o.name}` : o.name));
}
