import { useEffect, useRef, useState } from 'react';
import type { Tag } from '../../data/types';
import { printedCode, setLabel } from '../../data/setInfo';
import { gradeLabel, searchTags } from '../format';
import { TagCard, type TagCardSize } from './TagCard';

type Props = {
  label: string;
  tags: Tag[];
  value: Tag | null;
  onChange: (tag: Tag | null) => void;
  /** How big the chosen tag is shown. Results are always small cards. */
  cardSize?: TagCardSize;
  /** The player's tag photos (tag id → object URL). */
  photos?: ReadonlyMap<string, string>;
};

const MAX_RESULTS = 8;

/** Name, code, grade and set: the accessible name each result had before it became a card. */
const resultName = (t: Tag) => [t.name, printedCode(t), gradeLabel(t.grade), setLabel(t)].filter(Boolean).join(' ');

export function TagPicker({ label, tags, value, onChange, cardSize = 'small', photos }: Props) {
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
    const chosen = `${value.name} ${printedCode(value)}`;
    return (
      <div className="picker">
        <span className="picker-label">{label}</span>
        {/* The card is plain content: only the separate ✕ button clears, so a stray tap cannot drop the pick. */}
        <div className="chip" role="group" aria-label={`${label}: ${chosen}`}>
          {/* The card shows code, grade and set, so the same Pokémon in different sets can be told apart. */}
          <TagCard tag={value} size={cardSize} photoUrl={photos?.get(value.id)} />
          <button
            ref={chipRef}
            type="button"
            className="chip-x"
            aria-label={`Clear ${label}: ${chosen}`}
            onClick={() => {
              moveFocusTo.current = 'input';
              onChange(null);
            }}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
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
            aria-label={resultName(t)}
            onClick={() => {
              moveFocusTo.current = 'chip';
              onChange(t);
              setQuery('');
            }}
          >
            <TagCard tag={t} size="small" photoUrl={photos?.get(t.id)} />
          </button>
        ))}
      </div>
    </div>
  );
}
