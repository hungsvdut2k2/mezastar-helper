import { useState } from 'react';
import type { Tag } from '../../data/types';
import { gradeLabel, searchTags } from '../format';

type Props = { label: string; tags: Tag[]; value: Tag | null; onChange: (tag: Tag | null) => void };

export function TagPicker({ label, tags, value, onChange }: Props) {
  const [query, setQuery] = useState('');

  if (value) {
    return (
      <div className="picker">
        <span className="picker-label">{label}</span>
        <button type="button" className="chip" aria-label={`Clear ${label}`} onClick={() => onChange(null)}>
          {value.name} <small>{`${value.id} ${gradeLabel(value.grade)}`}</small> ✕
        </button>
      </div>
    );
  }

  const matches = query.trim() ? searchTags(tags, query).slice(0, 8) : [];
  return (
    <div className="picker">
      <label className="picker-label">
        {label}
        <input type="search" value={query} placeholder="Name or number" onChange={(e) => setQuery(e.target.value)} />
      </label>
      <div className="picker-results">
        {matches.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              onChange(t);
              setQuery('');
            }}
          >
            {t.name} <small>{`${t.id} ${gradeLabel(t.grade)}`}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
