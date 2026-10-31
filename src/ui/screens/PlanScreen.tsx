import { useMemo, useState } from 'react';
import type { Tag } from '../../data/types';
import type { Battle } from '../../engine/battleModel';
import { unknownOpponent } from '../../engine/recommend';
import { Recommendations } from '../components/Recommendations';
import { TagPicker } from '../components/TagPicker';
import type { AppStore } from '../useAppData';

export function PlanScreen({ store }: { store: AppStore }) {
  const [target, setTarget] = useState<Tag | null>(null);
  const [crony1, setCrony1] = useState<Tag | null>(null);
  const [crony2, setCrony2] = useState<Tag | null>(null);

  const owned = useMemo(
    () => store.tags.filter((t) => store.data.owned.includes(t.id)),
    [store.tags, store.data.owned],
  );
  const superstars = store.tags.filter((t) => t.grade === 6);
  const battle = useMemo<Battle | null>(
    () =>
      target
        ? {
            opponents: [target, crony1 ?? unknownOpponent('unknown-1'), crony2 ?? unknownOpponent('unknown-2')],
            targetIndex: 0,
          }
        : null,
    [target, crony1, crony2],
  );

  return (
    <section>
      <h1>Plan</h1>
      <p className="hint">Pick the Pokémon you want to catch. The plan assumes it appears as the Boss.</p>
      {!target && (
        <div className="chips">
          {superstars.map((t) => (
            <button key={t.id} type="button" onClick={() => setTarget(t)}>
              {t.name}
            </button>
          ))}
        </div>
      )}
      <TagPicker label="Target" tags={store.tags} value={target} onChange={setTarget} />
      <TagPicker label="Crony 1 (optional)" tags={store.tags} value={crony1} onChange={setCrony1} />
      <TagPicker label="Crony 2 (optional)" tags={store.tags} value={crony2} onChange={setCrony2} />
      {battle && <Recommendations owned={owned} battle={battle} />}
    </section>
  );
}
