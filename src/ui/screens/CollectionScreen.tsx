import { useEffect, useState } from 'react';
import { MY_TAGS, MY_TAGS_ID, SETS, isCustomId, isInSet, printedCode, setLabel, type AnySetId } from '../../data/setInfo';
import { TAGS } from '../../data/tags';
import type { Tag } from '../../data/types';
import { gradeLabel, searchTags, typeLabel } from '../format';
import type { AppStore } from '../useAppData';
import { CustomTagForm } from './CustomTagForm';
import { TagEditor } from './TagEditor';

type Filter = 'all' | 'owned' | 'missing';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'owned', label: 'Owned' },
  { id: 'missing', label: 'Missing' },
];

type SetChoice = AnySetId | 'all';
const DEFAULT_SET: SetChoice = 'stardust-v3';
const SET_CHOICES: { id: SetChoice; label: string }[] = [
  { id: 'all', label: 'All sets' },
  ...SETS.map((s) => ({ id: s.id as SetChoice, label: s.name })),
  { id: MY_TAGS_ID, label: MY_TAGS.name },
];

export function CollectionScreen({ store }: { store: AppStore }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [setChoice, setSetChoice] = useState<SetChoice>(DEFAULT_SET);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [returnFocusId, setReturnFocusId] = useState<string | null>(null);
  const owned = new Set(store.data.owned);
  const editing = store.tags.find((t) => t.id === editingId);

  // Back on the list, put focus on the row that was being edited.
  useEffect(() => {
    if (!editingId && returnFocusId) {
      // A deleted tag has no row any more: land on the page heading instead.
      (document.querySelector<HTMLElement>(`[data-row-id="${returnFocusId}"]`) ?? document.querySelector<HTMLElement>('h1'))?.focus();
      setReturnFocusId(null);
    }
  }, [editingId, returnFocusId]);

  const closeCustom = (focusId?: string) => {
    if (focusId) setReturnFocusId(focusId);
    setAdding(false);
    setEditingId(null);
  };

  if (adding) {
    return (
      <CustomTagForm
        onClose={() => closeCustom()}
        onSave={async (tag) => {
          if (!(await store.saveCustomTag(tag))) return false;
          // Make sure the new tag is on the list, then land on it.
          setSetChoice(MY_TAGS_ID);
          setFilter('all');
          setQuery('');
          closeCustom(tag.id);
          return true;
        }}
      />
    );
  }

  if (editing && isCustomId(editing.id)) {
    return (
      <CustomTagForm
        key={editing.id}
        tag={editing}
        onClose={() => closeCustom(editing.id)}
        onSave={async (tag) => {
          if (!(await store.saveCustomTag(tag))) return false;
          closeCustom(tag.id);
          return true;
        }}
        onDelete={async () => {
          const result = await store.deleteCustomTag(editing.id);
          if (result.ok) closeCustom(editing.id);
          return result;
        }}
        photoUrl={store.photos.get(editing.id)}
        onSetPhoto={(blob) => store.setPhoto(editing.id, blob)}
        onRemovePhoto={() => store.removePhoto(editing.id)}
      />
    );
  }

  if (editing) {
    const close = () => {
      setReturnFocusId(editing.id);
      setEditingId(null);
    };
    const shipped = TAGS.find((t) => t.id === editing.id) ?? editing;
    return (
      <TagEditor
        key={editing.id}
        tag={editing}
        shipped={shipped}
        hasCorrection={editing.id in store.data.corrections}
        onSave={async (c) => {
          if (await store.saveCorrection(editing.id, c)) close();
        }}
        onReset={async () => {
          if (await store.saveCorrection(editing.id, null)) close();
        }}
        onClose={close}
        photoUrl={store.photos.get(editing.id)}
        onSetPhoto={(blob) => store.setPhoto(editing.id, blob)}
        onRemovePhoto={() => store.removePhoto(editing.id)}
      />
    );
  }

  const inSet = (t: Tag) => setChoice === 'all' || isInSet(t, setChoice);
  const inScope = store.tags.filter(inSet);
  const ownedInScope = inScope.filter((t) => owned.has(t.id)).length;
  const isShown = (t: Tag) => filter === 'all' || (filter === 'owned') === owned.has(t.id);
  // Two tags can share name, printed code and set (custom tags): number the later ones so each row is distinct.
  const labelOf = (() => {
    const seen = new Map<string, number>();
    const labels = new Map<string, string>();
    for (const t of store.tags) {
      const key = `${t.name}\u0000${printedCode(t)}\u0000${setLabel(t)}`;
      const n = (seen.get(key) ?? 0) + 1;
      seen.set(key, n);
      labels.set(t.id, n > 1 ? `${t.name} (${n})` : t.name);
    }
    return (t: Tag) => labels.get(t.id) ?? t.name;
  })();
  const list = searchTags(inScope, query).filter(isShown);

  return (
    <section>
      <h1 tabIndex={-1}>Collection</h1>
      <p className="count">{`Owned ${ownedInScope} / ${inScope.length}`}</p>
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
      <input
        type="search"
        aria-label="Search tags"
        placeholder="Search name or number"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="segmented" role="group" aria-label="Show tags">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>
      <div className="actions">
        <button type="button" onClick={() => setAdding(true)}>
          Add a tag
        </button>
      </div>
      {list.length === 0 && (
        <p className="hint" role="status">
          {setChoice === MY_TAGS_ID && inScope.length === 0 ? 'You have not added any tags yet.' : 'No tags match.'}
        </p>
      )}
      <ul className="tag-list">
        {list.map((t) => {
          const isOwned = owned.has(t.id);
          return (
            <li key={t.id}>
              <button
                type="button"
                className={isOwned ? 'own on' : 'own'}
                aria-label={`Owned: ${labelOf(t)} ${printedCode(t)}, ${setLabel(t)}`}
                aria-pressed={isOwned}
                onClick={() => store.toggleOwned(t.id)}
              >
                {isOwned ? '✓' : ''}
              </button>
              {store.photos.has(t.id) && <img className="tag-thumb" src={store.photos.get(t.id)} alt="" width={44} height={44} />}
              <button type="button" className="tag-row" data-row-id={t.id} onClick={() => setEditingId(t.id)}>
                <strong>{labelOf(t)}</strong> <small>{`${printedCode(t)} · ${setLabel(t)} · ${gradeLabel(t.grade)} · ${t.types.map(typeLabel).join('/')}`}</small>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
