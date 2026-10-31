import { useEffect, useRef, useState } from 'react';
import { GIMMICK_NAME, POKEMON_TYPES, type Grade, type PokemonType, type Tag, type TagCorrection, type TagStats } from '../../data/types';
import { printedCode, setLabel } from '../../data/setInfo';
import { gradeLabel, typeLabel } from '../format';
import type { Rasterizer } from '../photo';
import { PhotoSection } from './PhotoSection';

type Props = {
  /** The tag as the player currently sees it (shipped data plus any earlier correction). */
  tag: Tag;
  /** The tag as shipped; only differences from this are stored. */
  shipped: Tag;
  hasCorrection: boolean;
  /** Receives only the overrides, or null when nothing differs from the shipped tag. */
  onSave: (correction: TagCorrection | null) => void | Promise<void>;
  onReset: () => void | Promise<void>;
  onClose: () => void;
  /** Object URL of the player's photo of this tag, if any. */
  photoUrl?: string;
  /** Receives the already-downscaled photo; resolves to true when stored. */
  onSetPhoto?: (blob: Blob) => Promise<boolean>;
  onRemovePhoto?: () => Promise<boolean>;
  /** Replaces the canvas-based image decoder (tests). */
  rasterizer?: Rasterizer;
};

const FIELDS = [
  ['pokenergy', 'Pokénergy'],
  ['hp', 'HP'],
  ['attack', 'Attack'],
  ['defense', 'Defense'],
  ['speed', 'Speed'],
] as const;
type Field = (typeof FIELDS)[number][0];

const toText = (v: number | null) => (v === null ? '' : String(v));

export function TagEditor({ tag, shipped, hasCorrection, onSave, onReset, onClose, photoUrl, onSetPhoto, onRemovePhoto, rasterizer }: Props) {
  const [grade, setGrade] = useState(tag.grade === null ? '' : String(tag.grade));
  const [type1, setType1] = useState<PokemonType>(tag.types[0] ?? POKEMON_TYPES[0]);
  const [type2, setType2] = useState<string>(tag.types[1] ?? '');
  const [numbers, setNumbers] = useState<Record<Field, string>>({
    pokenergy: toText(tag.pokenergy),
    hp: toText(tag.stats.hp),
    attack: toText(tag.stats.attack),
    defense: toText(tag.stats.defense),
    speed: toText(tag.stats.speed),
  });
  const [moveName, setMoveName] = useState(tag.move?.name ?? '');
  const [moveType, setMoveType] = useState<PokemonType>(tag.move?.type ?? tag.types[0] ?? POKEMON_TYPES[0]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => heading.current?.focus(), []);
  async function save() {
    const parsed = {} as Record<Field, number | null>;
    for (const [field, label] of FIELDS) {
      const text = numbers[field].trim();
      if (text === '') {
        parsed[field] = null; // blank = no override
        continue;
      }
      const n = Number(text);
      if (!Number.isInteger(n) || n < 0) {
        setError(`${label} must be a whole number, 0 or more.`);
        return;
      }
      parsed[field] = n;
    }
    setError(null);

    const correction: TagCorrection = {};
    const newGrade = grade === '' ? null : (Number(grade) as Grade);
    if (newGrade !== shipped.grade) correction.grade = newGrade;
    const newTypes = type2 && type2 !== type1 ? [type1, type2 as PokemonType] : [type1];
    if (newTypes.join() !== shipped.types.join()) correction.types = newTypes;
    if (parsed.pokenergy !== null && parsed.pokenergy !== shipped.pokenergy) correction.pokenergy = parsed.pokenergy;
    const stats: Partial<TagStats> = {};
    for (const key of ['hp', 'attack', 'defense', 'speed'] as const) {
      if (parsed[key] !== null && parsed[key] !== shipped.stats[key]) stats[key] = parsed[key];
    }
    if (Object.keys(stats).length > 0) correction.stats = stats;
    const newMove = moveName.trim() ? { name: moveName.trim(), type: moveType } : null;
    const sameMove =
      newMove === null || shipped.move === null
        ? newMove === shipped.move
        : newMove.name === shipped.move.name && newMove.type === shipped.move.type;
    if (!sameMove) correction.move = newMove;

    setSaving(true);
    try {
      await onSave(Object.keys(correction).length > 0 ? correction : null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="editor">
      <button type="button" className="link" onClick={onClose}>
        ‹ Back
      </button>
      <h1 ref={heading} tabIndex={-1}>
        {tag.name} <small>{printedCode(tag)}</small>
      </h1>
      <p>
        {setLabel(tag) && `${setLabel(tag)} · `}
        {gradeLabel(tag.grade)}
        {tag.gimmick && ` · ${GIMMICK_NAME[tag.gimmick.kind]}${tag.gimmick.moveName ? `: ${tag.gimmick.moveName}` : ''}`}
      </p>
      {onSetPhoto && (
        <PhotoSection tagName={tag.name} photoUrl={photoUrl} onSetPhoto={onSetPhoto} onRemovePhoto={onRemovePhoto} rasterizer={rasterizer} />
      )}
      <p className="hint">Copy the numbers from the back of your tag. Leave a box empty if you don't know it.</p>

      <label>
        Grade
        <select value={grade} onChange={(e) => setGrade(e.target.value)}>
          <option value="">unknown</option>
          {[1, 2, 3, 4, 5, 6].map((g) => (
            <option key={g} value={g}>
              {g}★
            </option>
          ))}
        </select>
      </label>
      <label>
        Type
        <select value={type1} onChange={(e) => setType1(e.target.value as PokemonType)}>
          {POKEMON_TYPES.map((t) => (
            <option key={t} value={t}>
              {typeLabel(t)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Second type
        <select value={type2} onChange={(e) => setType2(e.target.value)}>
          <option value="">none</option>
          {POKEMON_TYPES.map((t) => (
            <option key={t} value={t}>
              {typeLabel(t)}
            </option>
          ))}
        </select>
      </label>
      {FIELDS.map(([field, label]) => (
        <label key={field}>
          {label}
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={numbers[field]}
            onChange={(e) => setNumbers({ ...numbers, [field]: e.target.value })}
          />
        </label>
      ))}
      <label>
        Move
        <input value={moveName} onChange={(e) => setMoveName(e.target.value)} placeholder="unknown" />
      </label>
      <label>
        Move type
        <select value={moveType} onChange={(e) => setMoveType(e.target.value as PokemonType)}>
          {POKEMON_TYPES.map((t) => (
            <option key={t} value={t}>
              {typeLabel(t)}
            </option>
          ))}
        </select>
      </label>

      {error && <p className="error" role="alert">
          {error}
        </p>}
      <div className="actions">
        <button type="button" className="primary" disabled={saving} onClick={save}>
          Save
        </button>
        {hasCorrection && (
          <button type="button" onClick={onReset}>
            Reset to app data
          </button>
        )}
      </div>
      <p className="sources">Sources: {tag.sources.join(' · ')}</p>
    </section>
  );
}
