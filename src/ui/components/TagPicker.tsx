import { useEffect, useRef, useState } from 'react';
import type { Tag } from '../../data/types';
import { gradeLabel, searchTags } from '../format';

type Props = { label: string; tags: Tag[]; value: Tag | null; onChange: (tag: Tag | null) => void };

export function TagPicker({ label, tags, value, onChange }: Props) {
  const [query, setQuery] = useState('');
  const chipRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Set by the player's own pick/clear, so focus only moves after those, never on first render.
  const moveFocusTo = useRef<'chip' | 'input' | null>(null);

  useEffect(() => {
    const target = moveFocusTo.current === 'chip' ? chipRef.current : inputRef.current;
    if (moveFocusTo.current) target?.focus();
    moveFocusTo.current = null;
  }, [value]);

  if (value) {
    return (
      <div className="picker">
        <span className="picker-label">{label}</span>
        <button
          ref={chipRef}
          type="button"
          className="chip"
          aria-label={`Clear ${label}`}
          onClick={() => {
            moveFocusTo.current = 'input';
            onChange(null);
          }}
        >
          {value.name} <small>{`${value.id} ${gradeLabel(value.grade)}`}</small> ✕
        </button>
      </div>
    );
  }

  const searching = query.trim() !== '';
  const matches = searching ? searchTags(tags, query).slice(0, 8) : [];
  return (
    <div className="picker">
      <label className="picker-label">
        {label}
        <input
          ref={inputRef}
          type="search"
          value={query}
          placeholder="Name or number"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {/* Only this short message is announced, never the whole button list. */}
      <p className="hint picker-status" aria-live="polite">
        {searching ? (matches.length === 0 ? 'No matching tag' : `${matches.length} ${matches.length === 1 ? 'match' : 'matches'}`) : ''}
      </p>
      <div className="picker-results">
        {matches.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              moveFocusTo.current = 'chip';
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
