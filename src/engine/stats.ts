import type { Grade, PlayLogEntry, Tag } from '../data/types';

export type Rate = { count: number; caught: number; rate: number | null };

export type PlayStats = {
  plays: number;
  wins: number;
  catches: number;
  targetCatch: Rate;
  whenWon: Rate;
  whenLost: Rate;
  /** Plays in "Catch now!" mode. They are left out of the battle comparisons. */
  catchNow: Rate;
  byTargetGrade: { grade: string; rate: Rate }[];
  superstarsSeen: number;
  superstarsCaught: number;
  cronyDefeated: Rate;
  noCronyDefeated: Rate;
  byLocation: { location: string; plays: number; superstarsSeen: number }[];
  predictions: { checked: number; correct: number; rate: number | null };
};

const GRADE_ORDER = ['6★', '5★', '4★', '3★', '2★', '1★', 'Unknown'];

/** Rate of plays where the player caught the Pokémon they were aiming for. */
function rate(entries: PlayLogEntry[]): Rate {
  const caught = entries.filter((e) => e.caught !== null && e.caught === e.target).length;
  return { count: entries.length, caught, rate: entries.length ? caught / entries.length : null };
}

export function computeStats(log: PlayLogEntry[], tags: Tag[]): PlayStats {
  const gradeOf = (id: string | null): Grade | null => tags.find((t) => t.id === id)?.grade ?? null;

  // "Seen" and "caught" both use today's (corrected) grades, so a grade fix can never leave seen below caught.
  // A Superstar was seen if any opponent of the play, the target or the caught Pokémon is a 6★ now.
  const sawSuperstar = (e: PlayLogEntry) =>
    [e.boss, ...e.cronies, e.target, e.caught].some((id) => gradeOf(id) === 6);

  // Battle comparisons (won/lost, crony defeated or not, target grade) skip "Catch now!"
  // plays: there is no battle, so they would all count as lost with no crony defeated.
  const battles = log.filter((e) => e.mode !== 'catchNow');

  const byGrade = new Map<string, PlayLogEntry[]>();
  for (const e of battles) {
    const g = gradeOf(e.target);
    const key = g === null ? 'Unknown' : `${g}★`;
    byGrade.set(key, [...(byGrade.get(key) ?? []), e]);
  }

  const locations = new Map<string, { plays: number; superstarsSeen: number }>();
  for (const e of log) {
    const key = e.location?.trim() || 'Unlabelled';
    const current = locations.get(key) ?? { plays: 0, superstarsSeen: 0 };
    current.plays += 1;
    if (sawSuperstar(e)) current.superstarsSeen += 1;
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
    whenWon: rate(battles.filter((e) => e.bossDefeated)),
    whenLost: rate(battles.filter((e) => !e.bossDefeated)),
    catchNow: rate(log.filter((e) => e.mode === 'catchNow')),
    byTargetGrade: GRADE_ORDER.filter((g) => byGrade.has(g)).map((grade) => ({ grade, rate: rate(byGrade.get(grade)!) })),
    superstarsSeen: log.filter(sawSuperstar).length,
    superstarsCaught: log.filter((e) => gradeOf(e.caught) === 6).length,
    cronyDefeated: rate(battles.filter((e) => e.cronyDefeatedCount > 0)),
    noCronyDefeated: rate(battles.filter((e) => e.cronyDefeatedCount === 0)),
    byLocation: [...locations].map(([location, v]) => ({ location, ...v })),
    predictions: { checked: checked.length, correct, rate: checked.length ? correct / checked.length : null },
  };
}
