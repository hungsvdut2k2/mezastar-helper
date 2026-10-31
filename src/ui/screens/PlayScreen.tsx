import { useMemo, useState } from 'react';
import type { PlayMode, Tag } from '../../data/types';
import type { Battle } from '../../engine/battleModel';
import type { Recommendation } from '../../engine/recommend';
import { opponentLabels } from '../format';
import { useFocusHeading } from '../useFocusHeading';
import { Recommendations } from '../components/Recommendations';
import { TagPicker } from '../components/TagPicker';
import type { AppStore } from '../useAppData';
import { LogForm } from './LogForm';

const MODES: { id: PlayMode; label: string }[] = [
  { id: 'battle', label: 'Battle' },
  { id: 'catchNow', label: 'Catch now' },
  { id: 'specialTagBattle', label: 'Special Tag Battle' },
];
const SLOTS = ['Boss', 'Crony 1', 'Crony 2'];

export function PlayScreen({ store }: { store: AppStore }) {
  const [mode, setMode] = useState<PlayMode>('battle');
  // Ids, not Tag objects, so a correction made in Collection reaches the battle.
  const [pickedIds, setPickedIds] = useState<(string | null)[]>([null, null, null]);
  const [targetIndex, setTargetIndex] = useState<0 | 1 | 2>(0);
  const [logging, setLogging] = useState<Recommendation | null>(null);
  const [saved, setSaved] = useState(false);

  const owned = useMemo(
    () => store.tags.filter((t) => store.data.owned.includes(t.id)),
    [store.tags, store.data.owned],
  );
  const picked = useMemo(
    () => pickedIds.map((id) => (id ? (store.tags.find((t) => t.id === id) ?? null) : null)),
    [pickedIds, store.tags],
  );
  const [boss, crony1, crony2] = picked;
  const headingRef = useFocusHeading(saved);
  const labels = opponentLabels(picked);
  const battle = useMemo<Battle | null>(
    () => (boss && crony1 && crony2 ? { opponents: [boss, crony1, crony2], targetIndex } : null),
    [boss, crony1, crony2, targetIndex],
  );

  const pick = (slot: number) => (tag: Tag | null) => {
    setPickedIds((p) => p.map((x, i) => (i === slot ? (tag?.id ?? null) : x)));
    setSaved(false);
  };

  if (logging && battle) {
    return (
      <LogForm
        mode={mode}
        battle={battle}
        rec={logging}
        lastLocation={store.data.log[0]?.location ?? ''}
        onCancel={() => setLogging(null)}
        onSave={async (entry) => {
          if (!(await store.addLog(entry))) throw new Error('not saved');
          setLogging(null);
          setPickedIds([null, null, null]);
          setTargetIndex(0);
          setSaved(true);
        }}
      />
    );
  }

  return (
    <section>
      <h1 ref={headingRef} tabIndex={-1}>
        Play
      </h1>
      {saved && (
        <p className="notice" role="status">
          Play saved. Good luck on the next one!
        </p>
      )}
      <div className="segmented" role="group" aria-label="Play mode">
        {MODES.map((m) => (
          <button key={m.id} type="button" aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>
            {m.label}
          </button>
        ))}
      </div>
      {mode === 'catchNow' && (
        <p className="notice">Community tip: "Catch now!" rarely gives Superstars. A full battle is usually better.</p>
      )}
      <p className="hint">Enter the 3 Pokémon on the screen.</p>
      <TagPicker label={SLOTS[0]} tags={store.tags} value={boss} onChange={pick(0)} cardSize="large" photos={store.photos} />
      <div className="slot-row">
        {[1, 2].map((i) => (
          <TagPicker key={SLOTS[i]} label={SLOTS[i]} tags={store.tags} value={picked[i]} onChange={pick(i)} cardSize="medium" photos={store.photos} />
        ))}
      </div>
      {picked.some(Boolean) && (
        <>
          <h2 id="play-target">Which one do you want to catch?</h2>
          <div className="segmented" role="group" aria-labelledby="play-target">
            {SLOTS.map((slot, i) => (
              <button
                key={slot}
                type="button"
                aria-pressed={targetIndex === i}
                onClick={() => setTargetIndex(i as 0 | 1 | 2)}
              >
                {labels[i]}
              </button>
            ))}
          </div>
          {!picked[targetIndex] && (
            <p className="hint">{`Your target is ${SLOTS[targetIndex]}. Enter that opponent to get a plan.`}</p>
          )}
        </>
      )}
      {battle && <Recommendations owned={owned} battle={battle} onUseTeam={setLogging} photos={store.photos} />}
    </section>
  );
}
