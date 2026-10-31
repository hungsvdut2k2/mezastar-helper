import { useMemo, useState } from 'react';
import type { PlayMode, Tag } from '../../data/types';
import type { Battle } from '../../engine/battleModel';
import type { Recommendation } from '../../engine/recommend';
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
  const [picked, setPicked] = useState<(Tag | null)[]>([null, null, null]);
  const [targetIndex, setTargetIndex] = useState<0 | 1 | 2>(0);
  const [logging, setLogging] = useState<Recommendation | null>(null);
  const [saved, setSaved] = useState(false);

  const owned = useMemo(
    () => store.tags.filter((t) => store.data.owned.includes(t.id)),
    [store.tags, store.data.owned],
  );
  const [boss, crony1, crony2] = picked;
  const battle = useMemo<Battle | null>(
    () => (boss && crony1 && crony2 ? { opponents: [boss, crony1, crony2], targetIndex } : null),
    [boss, crony1, crony2, targetIndex],
  );

  const pick = (slot: number) => (tag: Tag | null) => {
    setPicked((p) => p.map((x, i) => (i === slot ? tag : x)));
    if (tag === null && slot === targetIndex) setTargetIndex(0);
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
          setPicked([null, null, null]);
          setTargetIndex(0);
          setSaved(true);
        }}
      />
    );
  }

  return (
    <section>
      <h1>Play</h1>
      {saved && <p className="notice">Play saved. Good luck on the next one!</p>}
      <div className="segmented">
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
      {SLOTS.map((label, i) => (
        <TagPicker key={label} label={label} tags={store.tags} value={picked[i]} onChange={pick(i)} />
      ))}
      {battle && (
        <>
          <h2>Which one do you want to catch?</h2>
          <div className="segmented">
            {battle.opponents.map((o, i) => (
              <button
                key={i}
                type="button"
                aria-pressed={targetIndex === i}
                onClick={() => setTargetIndex(i as 0 | 1 | 2)}
              >
                {o.name}
              </button>
            ))}
          </div>
          <Recommendations owned={owned} battle={battle} onUseTeam={setLogging} />
        </>
      )}
    </section>
  );
}
