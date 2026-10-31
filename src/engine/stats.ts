import type { Grade, PlayLogEntry, Tag } from '../data/types';

export type Rate = { count: number; caught: number; rate: number | null };

export type PlayStats = {
  plays: number;
  wins: number;
  catches: number;
  targetCatch: Rate;
  whenWon: Rate;
  whenLost: Rate;
  byTargetGrade: { grade: string; rate: Rate }[];
  superstarsSeen: number;
  superstarsCaught: number;
  cronyDefeated: Rate;
  noCronyDefeated: Rate;
  byLocation: { location: string; plays: number; superstarsSeen: number }[];
  predictions: { checked: number; correct: number; rate: number | null };
};

const GRADE_ORDER = ['6★', '5★', '4★', '3★', '2★', 'Unknown'];

/** Rate of plays where the player caught the Pokémon they were aiming for. */
function rate(entries: PlayLogEntry[]): Rate {
  const caught = entries.filter((e) => e.caught !== null && e.caught === e.target).length;
  return { count: entries.length, caught, rate: entries.length ? caught / entries.length : null };
}

export function computeStats(log: PlayLogEntry[], tags: Tag[]): PlayStats {
  const gradeOf = (id: string | null): Grade | null => tags.find((t) => t.id === id)?.grade ?? null;

  const byGrade = new Map<string, PlayLogEntry[]>();
  for (const e of log) {
    const g = gradeOf(e.target);
    const key = g === null ? 'Unknown' : `${g}★`;
    byGrade.set(key, [...(byGrade.get(key) ?? []), e]);
  }

  const locations = new Map<string, { plays: number; superstarsSeen: number }>();
  for (const e of log) {
    const key = e.location?.trim() || 'Unlabelled';
    const current = locations.get(key) ?? { plays: 0, superstarsSeen: 0 };
    current.plays += 1;
    if (e.superstarAppeared) current.superstarsSeen += 1;
    locations.set(key, current);
  }

  const checked = log
    .flatMap((e) => e.turns)
    .filter((t) => t.predictedDefeat !== undefined && t.aimedAt !== undefined);
  const correct = checked.filter((t) => t.predictedDefeat === (t.defeated === t.aimedAt)).length;

  return {
    plays: log.length,
    wins: log.filter((e) => e.bossDefeated).length,
    catches: log.filter((e) => e.caught !== null).length,
    targetCatch: rate(log),
    whenWon: rate(log.filter((e) => e.bossDefeated)),
    whenLost: rate(log.filter((e) => !e.bossDefeated)),
    byTargetGrade: GRADE_ORDER.filter((g) => byGrade.has(g)).map((grade) => ({ grade, rate: rate(byGrade.get(grade)!) })),
    superstarsSeen: log.filter((e) => e.superstarAppeared).length,
    superstarsCaught: log.filter((e) => gradeOf(e.caught) === 6).length,
    cronyDefeated: rate(log.filter((e) => e.cronyDefeatedCount > 0)),
    noCronyDefeated: rate(log.filter((e) => e.cronyDefeatedCount === 0)),
    byLocation: [...locations].map(([location, v]) => ({ location, ...v })),
    predictions: { checked: checked.length, correct, rate: checked.length ? correct / checked.length : null },
  };
}
