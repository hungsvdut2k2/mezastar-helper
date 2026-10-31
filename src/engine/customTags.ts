import type { PlayLogEntry } from '../data/types';

/** How many saved plays mention this tag anywhere (boss, cronies, target, team, turns, catch). */
export function playsUsingTag(log: PlayLogEntry[], id: string): number {
  return log.filter(
    (e) =>
      e.boss === id ||
      e.target === id ||
      e.caught === id ||
      e.cronies.includes(id) ||
      e.teamUsed.includes(id) ||
      e.turns.some((t) => t.attacker === id || t.aimedAt === id || t.defeated === id),
  ).length;
}
