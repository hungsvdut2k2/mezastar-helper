import { useState } from 'react';
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
  const owned = new Set(store.data.owned);
  const editing = store.tags.find((t) => t.id === editingId);

  if (editing) {
    const close = () => setEditingId(null);
    return (
      <TagEditor
        key={editing.id}
        tag={editing}
        hasCorrection={editing.id in store.data.corrections}
        onSave={async (c) => {
          await store.saveCorrection(editing.id, c);
          close();
        }}
        onReset={async () => {
          await store.saveCorrection(editing.id, null);
          close();
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
        placeholder="Search name or number"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="segmented">
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
                aria-label={`${isOwned ? 'Owned' : 'Not owned'}: ${t.name} ${t.id}`}
                onClick={() => store.toggleOwned(t.id)}
              >
                {isOwned ? '✓' : ''}
              </button>
              <button type="button" className="tag-row" onClick={() => setEditingId(t.id)}>
                <strong>{t.name}</strong> <small>{`${t.id} · ${gradeLabel(t.grade)} · ${t.types.map(typeLabel).join('/')}`}</small>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
