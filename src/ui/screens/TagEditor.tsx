import { useState } from 'react';
import { GIMMICK_NAME, POKEMON_TYPES, type Grade, type PokemonType, type Tag, type TagCorrection } from '../../data/types';
import { gradeLabel, typeLabel } from '../format';

type Props = {
  tag: Tag;
  hasCorrection: boolean;
  onSave: (correction: TagCorrection) => void;
  onReset: () => void;
  onClose: () => void;
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

export function TagEditor({ tag, hasCorrection, onSave, onReset, onClose }: Props) {
  const [grade, setGrade] = useState(tag.grade === null ? '' : String(tag.grade));
  const [type1, setType1] = useState<PokemonType>(tag.types[0]);
  const [type2, setType2] = useState<string>(tag.types[1] ?? '');
  const [numbers, setNumbers] = useState<Record<Field, string>>({
    pokenergy: toText(tag.pokenergy),
    hp: toText(tag.stats.hp),
    attack: toText(tag.stats.attack),
    defense: toText(tag.stats.defense),
    speed: toText(tag.stats.speed),
  });
  const [moveName, setMoveName] = useState(tag.move?.name ?? '');
  const [moveType, setMoveType] = useState<PokemonType>(tag.move?.type ?? tag.types[0]);
  const [error, setError] = useState<string | null>(null);

  function save() {
    const parsed = {} as Record<Field, number | null>;
    for (const [field, label] of FIELDS) {
      const text = numbers[field].trim();
      if (text === '') {
        parsed[field] = null;
        continue;
      }
      const n = Number(text);
      if (!Number.isFinite(n) || n < 0) {
        setError(`${label} must be a number.`);
        return;
      }
      parsed[field] = n;
    }
    onSave({
      grade: grade === '' ? null : (Number(grade) as Grade),
      types: type2 && type2 !== type1 ? [type1, type2 as PokemonType] : [type1],
      pokenergy: parsed.pokenergy,
      stats: { hp: parsed.hp, attack: parsed.attack, defense: parsed.defense, speed: parsed.speed },
      move: moveName.trim() ? { name: moveName.trim(), type: moveType } : null,
    });
  }

  return (
    <section className="editor">
      <button type="button" className="link" onClick={onClose}>
        ‹ Back
      </button>
      <h1>
        {tag.name} <small>{tag.id}</small>
      </h1>
      <p>
        {gradeLabel(tag.grade)}
        {tag.gimmick && ` · ${GIMMICK_NAME[tag.gimmick.kind]}${tag.gimmick.moveName ? `: ${tag.gimmick.moveName}` : ''}`}
      </p>
      <p className="hint">Copy the numbers from the back of your tag. Leave a box empty if you don't know it.</p>

      <label>
        Grade
        <select value={grade} onChange={(e) => setGrade(e.target.value)}>
          <option value="">unknown</option>
          {[2, 3, 4, 5, 6].map((g) => (
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

      {error && <p className="error">{error}</p>}
      <div className="actions">
        <button type="button" className="primary" onClick={save}>
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
