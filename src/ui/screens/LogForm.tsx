import { useRef, useState } from 'react';
import type { BallType, PlayLogEntry, PlayMode } from '../../data/types';
import type { Battle } from '../../engine/battleModel';
import type { Recommendation } from '../../engine/recommend';
import { opponentLabels } from '../format';
import { useFocusHeading } from '../useFocusHeading';

type Props = {
  mode: PlayMode;
  battle: Battle;
  rec: Recommendation;
  lastLocation: string;
  /** May return a promise; if it rejects, the form shows an error and lets the player try again. */
  onSave: (entry: PlayLogEntry) => void | Promise<void>;
  onCancel: () => void;
};

const BALLS: { id: BallType; label: string }[] = [
  { id: 'poke', label: 'Poké' },
  { id: 'great', label: 'Great' },
  { id: 'ultra', label: 'Ultra' },
  { id: 'master', label: 'Master' },
];

const MAX_TURNS = 3;

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
  // Turn detail starts as the plan; the player can change who attacked and who was aimed at.
  const [turnState, setTurnState] = useState(() =>
    steps.map((s) => ({ attacker: s.tagId, aim: s.aimAtIndex as number, defeated: false })),
  );
  const addTurn = () =>
    setTurnState((all) => [...all, { attacker: rec.team[0].id, aim: battle.targetIndex as number, defeated: false }]);
  const changeTurn = (i: number, patch: Partial<(typeof turnState)[number]>) =>
    setTurnState((all) => all.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  const labels = opponentLabels(battle.opponents);
  const headingRef = useFocusHeading();
  const cronyDefeatTicked = withTurns && turnState.some((t) => t.defeated && t.aim !== 0);

  // One id per form, so a repeated tap can never create a second entry.
  const [entryId] = useState(newId);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const busy = useRef(false);

  async function save() {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setSaveFailed(false);
    try {
      await onSave(buildEntry());
    } catch {
      busy.current = false;
      setSaving(false);
      setSaveFailed(true);
    }
  }

  function buildEntry(): PlayLogEntry {
    return {
      id: entryId,
      date: new Date().toISOString(),
      location: location.trim() || undefined,
      mode,
      boss: boss.id,
      cronies: [crony1.id, crony2.id],
      target: battle.opponents[battle.targetIndex].id,
      superstarAppeared: battle.opponents.some((o) => o.grade === 6),
      teamUsed: rec.team.map((t) => t.id),
      turns: withTurns
        ? turnState.map((t, i) => {
            const s = steps[i];
            const aimedAt = battle.opponents[t.aim].id;
            return {
              attacker: t.attacker,
              aimedAt,
              defeated: t.defeated ? aimedAt : undefined,
              // The plan only predicted this for its own attacker and aim; turns beyond the plan have no prediction.
              predictedDefeat: s && t.attacker === s.tagId && t.aim === s.aimAtIndex ? (s.expectDefeat ?? undefined) : undefined,
            };
          })
        : [],
      cronyDefeatedCount: cronyDefeated,
      bossDefeated,
      ballType: ball,
      caught: caughtIndex === null ? null : battle.opponents[caughtIndex].id,
      note: note.trim() || undefined,
    };
  }

  return (
    <section>
      <h1 ref={headingRef} tabIndex={-1}>
        Log this play
      </h1>
      <label>
        Location
        <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Arcade or machine" />
      </label>

      <h2 id="log-cronies">Cronies defeated</h2>
      <div className="segmented" role="group" aria-labelledby="log-cronies">
        {([0, 1, 2] as const).map((n) => (
          <button key={n} type="button" aria-pressed={cronyDefeated === n} onClick={() => setCronyDefeated(n)}>
            {n}
          </button>
        ))}
      </div>

      <h2 id="log-boss">Boss defeated?</h2>
      <div className="segmented" role="group" aria-labelledby="log-boss">
        <button type="button" aria-pressed={bossDefeated} onClick={() => setBossDefeated(true)}>
          Yes
        </button>
        <button type="button" aria-pressed={!bossDefeated} onClick={() => setBossDefeated(false)}>
          No
        </button>
      </div>

      <h2 id="log-caught">Caught</h2>
      <div className="segmented" role="group" aria-labelledby="log-caught">
        <button type="button" aria-pressed={caughtIndex === null} onClick={() => setCaughtIndex(null)}>
          Nothing
        </button>
        {battle.opponents.map((o, i) => (
          <button key={i} type="button" aria-pressed={caughtIndex === i} onClick={() => setCaughtIndex(i)}>
            {labels[i]}
          </button>
        ))}
      </div>

      <h2 id="log-ball">Ball (optional)</h2>
      <div className="segmented" role="group" aria-labelledby="log-ball">
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
        <>
          <ol className="turns">
            {turnState.map((_, i) => (
              <li key={i}>
                <strong>{`Turn ${i + 1}`}</strong>
                <label>
                  {`Turn ${i + 1} attacker`}
                  <select value={turnState[i].attacker} onChange={(e) => changeTurn(i, { attacker: e.target.value })}>
                    {rec.team.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {`Turn ${i + 1} aimed at`}
                  <select value={turnState[i].aim} onChange={(e) => changeTurn(i, { aim: Number(e.target.value) })}>
                    {battle.opponents.map((o, k) => (
                      <option key={k} value={k}>
                        {labels[k]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="check">
                  <input type="checkbox" checked={turnState[i].defeated} onChange={(e) => changeTurn(i, { defeated: e.target.checked })} />
                  Defeated it
                </label>
              </li>
            ))}
          </ol>
          {turnState.length < MAX_TURNS && (
            <button type="button" onClick={addTurn}>
              Add turn
            </button>
          )}
          {cronyDefeatTicked && cronyDefeated === 0 && (
            <p className="notice" role="status">
              You ticked a crony as defeated in the turn detail, but "Cronies defeated" is 0. You can still save.
            </p>
          )}
        </>
      )}

      <label>
        Note
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" />
      </label>
      <div className="actions">
        <button type="button" className="primary" onClick={save} disabled={saving}>
          Save play
        </button>
        <button type="button" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
      {saveFailed && (
        <p className="error" role="alert">
          This play was not saved. Tap Save play to try again.
        </p>
      )}
    </section>
  );
}
