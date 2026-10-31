import { useEffect, useRef, useState } from 'react';
import type { Tag } from '../../data/types';
import { printedCode, setLabel } from '../../data/setInfo';
import { gradeLabel, searchTags } from '../format';

type Props = { label: string; tags: Tag[]; value: Tag | null; onChange: (tag: Tag | null) => void };

const MAX_RESULTS = 8;

/** Code, grade and set, so the same Pokémon in different sets can be told apart. */
const tagLabel = (t: Tag) => [printedCode(t), gradeLabel(t.grade), setLabel(t)].filter(Boolean).join(' ');

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
          {value.name} <small>{tagLabel(value)}</small> ✕
        </button>
      </div>
    );
  }

  const searching = query.trim() !== '';
  const found = searching ? searchTags(tags, query) : [];
  const matches = found.slice(0, MAX_RESULTS);
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
        {!searching
          ? ''
          : found.length === 0
            ? 'No matching tag'
            : found.length > MAX_RESULTS
              ? `Showing ${MAX_RESULTS} of ${found.length} — type a code to narrow`
              : `${found.length} ${found.length === 1 ? 'match' : 'matches'}`}
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
            {t.name} <small>{tagLabel(t)}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
