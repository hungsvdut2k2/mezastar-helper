import { useEffect, useState } from 'react';
import { TAGS } from '../../data/tags';
import type { Tag } from '../../data/types';
import { gradeLabel, searchTags, typeLabel } from '../format';
import type { AppStore } from '../useAppData';
import { TagEditor } from './TagEditor';

type Filter = 'all' | 'owned' | 'missing';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'owned', label: 'Owned' },
  { id: 'missing', label: 'Missing' },
];

export function CollectionScreen({ store }: { store: AppStore }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [returnFocusId, setReturnFocusId] = useState<string | null>(null);
  const owned = new Set(store.data.owned);
  const editing = store.tags.find((t) => t.id === editingId);

  // Back on the list, put focus on the row that was being edited.
  useEffect(() => {
    if (!editingId && returnFocusId) {
      document.querySelector<HTMLElement>(`[data-row-id="${returnFocusId}"]`)?.focus();
      setReturnFocusId(null);
    }
  }, [editingId, returnFocusId]);

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
      />
    );
  }

  const isShown = (t: Tag) => filter === 'all' || (filter === 'owned') === owned.has(t.id);
  const list = searchTags(store.tags, query).filter(isShown);

  return (
    <section>
      <h1>Collection</h1>
      <p className="count">{`Owned ${owned.size} / ${store.tags.length}`}</p>
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
      <ul className="tag-list">
        {list.map((t) => {
          const isOwned = owned.has(t.id);
          return (
            <li key={t.id}>
              <button
                type="button"
                className={isOwned ? 'own on' : 'own'}
                aria-label={`Owned: ${t.name} ${t.id}`}
                aria-pressed={isOwned}
                onClick={() => store.toggleOwned(t.id)}
              >
                {isOwned ? '✓' : ''}
              </button>
              <button type="button" className="tag-row" data-row-id={t.id} onClick={() => setEditingId(t.id)}>
                <strong>{t.name}</strong> <small>{`${t.id} · ${gradeLabel(t.grade)} · ${t.types.map(typeLabel).join('/')}`}</small>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
