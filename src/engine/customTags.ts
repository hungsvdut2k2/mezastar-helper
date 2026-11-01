import type { PlayLogEntry } from '../data/types';

/** Every tag id a saved play mentions (boss, cronies, target, team, turns, catch). */
export function tagIdsInPlay(e: PlayLogEntry): string[] {
  const ids = [e.boss, e.target, ...e.cronies, ...e.teamUsed];
  if (e.caught) ids.push(e.caught);
  for (const t of e.turns) {
    ids.push(t.attacker);
    if (t.aimedAt) ids.push(t.aimedAt);
    if (t.defeated) ids.push(t.defeated);
  }
  return ids;
}

/** How many saved plays mention this tag anywhere. */
export function playsUsingTag(log: PlayLogEntry[], id: string): number {
  return log.filter((e) => tagIdsInPlay(e).includes(id)).length;
}
