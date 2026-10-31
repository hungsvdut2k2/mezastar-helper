import { useMemo, useState } from 'react';
import type { Tag } from '../../data/types';
import type { Battle } from '../../engine/battleModel';
import { unknownOpponent } from '../../engine/recommend';
import { Recommendations } from '../components/Recommendations';
import { printedCode } from '../../data/setInfo';
import { TagPicker } from '../components/TagPicker';
import { DEFAULT_SET, inSetChoice, SET_CHOICES, type SetChoice } from '../setChoices';
import type { AppStore } from '../useAppData';

export function PlanScreen({ store }: { store: AppStore }) {
  // Ids, not Tag objects, so a correction made in Collection reaches the plan.
  const [targetId, setTargetId] = useState<string | null>(null);
  const [crony1Id, setCrony1Id] = useState<string | null>(null);
  const [crony2Id, setCrony2Id] = useState<string | null>(null);
  const find = (id: string | null) => (id ? (store.tags.find((t) => t.id === id) ?? null) : null);
  const target = find(targetId);
  const crony1 = find(crony1Id);
  const crony2 = find(crony2Id);
  const setTarget = (t: Tag | null) => setTargetId(t?.id ?? null);
  const setCrony1 = (t: Tag | null) => setCrony1Id(t?.id ?? null);
  const setCrony2 = (t: Tag | null) => setCrony2Id(t?.id ?? null);

  const owned = useMemo(
    () => store.tags.filter((t) => store.data.owned.includes(t.id)),
    [store.tags, store.data.owned],
  );
  const [setChoice, setSetChoice] = useState<SetChoice>(DEFAULT_SET);
  const superstars = store.tags.filter((t) => t.grade === 6 && inSetChoice(t, setChoice));
  const battle = useMemo<Battle | null>(
    () =>
      target
        ? {
            opponents: [target, crony1 ?? unknownOpponent(1), crony2 ?? unknownOpponent(2)],
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
        <>
          <label>
            Set
            <select value={setChoice} onChange={(e) => setSetChoice(e.target.value as SetChoice)}>
              {SET_CHOICES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <div className="chips">
            {superstars.map((t) => (
              <button key={t.id} type="button" onClick={() => setTarget(t)}>
                {t.name} <small>{printedCode(t)}</small>
              </button>
            ))}
          </div>
          {superstars.length === 0 && <p className="hint">No Superstars in this set. Search below instead.</p>}
        </>
      )}
      <TagPicker label="Target" tags={store.tags} value={target} onChange={setTarget} />
      <TagPicker label="Crony 1 (optional)" tags={store.tags} value={crony1} onChange={setCrony1} />
      <TagPicker label="Crony 2 (optional)" tags={store.tags} value={crony2} onChange={setCrony2} />
      {battle && <Recommendations owned={owned} battle={battle} />}
    </section>
  );
}
