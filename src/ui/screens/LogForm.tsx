import { useState } from 'react';
import type { BallType, PlayLogEntry, PlayMode } from '../../data/types';
import type { Battle } from '../../engine/battleModel';
import type { Recommendation } from '../../engine/recommend';

type Props = {
  mode: PlayMode;
  battle: Battle;
  rec: Recommendation;
  lastLocation: string;
  onSave: (entry: PlayLogEntry) => void;
  onCancel: () => void;
};

const BALLS: { id: BallType; label: string }[] = [
  { id: 'poke', label: 'Poké' },
  { id: 'great', label: 'Great' },
  { id: 'ultra', label: 'Ultra' },
  { id: 'master', label: 'Master' },
];

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function LogForm({ mode, battle, rec, lastLocation, onSave, onCancel }: Props) {
  const [boss, crony1, crony2] = battle.opponents;
  const steps = rec.plan?.steps ?? [];
  const [location, setLocation] = useState(lastLocation);
  const [cronyDefeated, setCronyDefeated] = useState<0 | 1 | 2>(0);
  const [bossDefeated, setBossDefeated] = useState(false);
  const [caughtIndex, setCaughtIndex] = useState<number | null>(null);
  const [ball, setBall] = useState<BallType | undefined>(undefined);
  const [note, setNote] = useState('');
  const [withTurns, setWithTurns] = useState(false);
  const [defeatedAt, setDefeatedAt] = useState<boolean[]>(steps.map(() => false));

  function save() {
    onSave({
      id: newId(),
      date: new Date().toISOString(),
      location: location.trim() || undefined,
      mode,
      boss: boss.id,
      cronies: [crony1.id, crony2.id],
      target: battle.opponents[battle.targetIndex].id,
      superstarAppeared: battle.opponents.some((o) => o.grade === 6),
      teamUsed: rec.team.map((t) => t.id),
      turns: withTurns
        ? steps.map((s, i) => ({
            attacker: s.tagId,
            aimedAt: s.aimAtId,
            defeated: defeatedAt[i] ? s.aimAtId : undefined,
            predictedDefeat: s.expectDefeat ?? undefined,
          }))
        : [],
      cronyDefeatedCount: cronyDefeated,
      bossDefeated,
      ballType: ball,
      caught: caughtIndex === null ? null : battle.opponents[caughtIndex].id,
      note: note.trim() || undefined,
    });
  }

  return (
    <section>
      <h1>Log this play</h1>
      <label>
        Location
        <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Arcade or machine" />
      </label>

      <h2>Cronies defeated</h2>
      <div className="segmented">
        {([0, 1, 2] as const).map((n) => (
          <button key={n} type="button" aria-pressed={cronyDefeated === n} onClick={() => setCronyDefeated(n)}>
            {n}
          </button>
        ))}
      </div>

      <h2>Boss defeated?</h2>
      <div className="segmented">
        <button type="button" aria-pressed={bossDefeated} onClick={() => setBossDefeated(true)}>
          Yes
        </button>
        <button type="button" aria-pressed={!bossDefeated} onClick={() => setBossDefeated(false)}>
          No
        </button>
      </div>

      <h2>Caught</h2>
      <div className="segmented">
        <button type="button" aria-pressed={caughtIndex === null} onClick={() => setCaughtIndex(null)}>
          Nothing
        </button>
        {battle.opponents.map((o, i) => (
          <button key={i} type="button" aria-pressed={caughtIndex === i} onClick={() => setCaughtIndex(i)}>
            {o.name}
          </button>
        ))}
      </div>

      <h2>Ball (optional)</h2>
      <div className="segmented">
        {BALLS.map((b) => (
          <button key={b.id} type="button" aria-pressed={ball === b.id} onClick={() => setBall(ball === b.id ? undefined : b.id)}>
            {b.label}
          </button>
        ))}
      </div>

      {steps.length > 0 && (
        <label className="check">
          <input type="checkbox" checked={withTurns} onChange={(e) => setWithTurns(e.target.checked)} />
          Add turn detail
        </label>
      )}
      {withTurns && (
        <ol className="turns">
          {steps.map((s, i) => (
            <li key={s.turn}>
              {`Turn ${s.turn}: ${s.tagName} → ${s.aimAtLabel}`}
              <label className="check">
                <input
                  type="checkbox"
                  checked={defeatedAt[i]}
                  onChange={(e) => setDefeatedAt(defeatedAt.map((d, j) => (j === i ? e.target.checked : d)))}
                />
                Defeated it
              </label>
            </li>
          ))}
        </ol>
      )}

      <label>
        Note
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" />
      </label>
      <div className="actions">
        <button type="button" className="primary" onClick={save}>
          Save play
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  );
}
