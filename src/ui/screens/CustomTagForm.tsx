import { useEffect, useRef, useState } from 'react';
import {
  makeCustomTag, newCustomId, MAX_CODE_LENGTH, MAX_MOVE_LENGTH, MAX_NAME_LENGTH,
} from '../../data/customTag';
import { printedCode, setOfTag } from '../../data/setInfo';
import { TAGS } from '../../data/tags';
import { GIMMICKS, GIMMICK_NAME, POKEMON_TYPES, type Gimmick, type Grade, type PokemonType, type Tag } from '../../data/types';
import { typeLabel } from '../format';
import type { Rasterizer } from '../photo';
import { PhotoSection } from './PhotoSection';

type Props = {
  /** The tag being edited; omit to add a new one. */
  tag?: Tag;
  onSave: (tag: Tag) => Promise<boolean>;
  /** Edit mode only. Resolves with a message when the tag cannot be deleted. */
  onDelete?: () => Promise<{ ok: true } | { ok: false; message: string }>;
  onClose: () => void;
  photoUrl?: string;
  onSetPhoto?: (blob: Blob) => Promise<boolean>;
  onRemovePhoto?: () => Promise<boolean>;
  rasterizer?: Rasterizer;
};

type Field = 'code' | 'name' | 'type1' | 'moveName';

/** Official tags printed with this code (the same code can appear in several sets). */
export function officialTagsWithCode(code: string): Tag[] {
  const wanted = code.trim().toLowerCase();
  if (!wanted) return [];
  return TAGS.filter((t) => printedCode(t).toLowerCase() === wanted);
}

export function CustomTagForm({ tag, onSave, onDelete, onClose, photoUrl, onSetPhoto, onRemovePhoto, rasterizer }: Props) {
  const [code, setCode] = useState(tag ? printedCode(tag) : '');
  const [name, setName] = useState(tag?.name ?? '');
  const [grade, setGrade] = useState(tag?.grade == null ? '' : String(tag.grade));
  const [type1, setType1] = useState<string>(tag?.types[0] ?? '');
  const [type2, setType2] = useState<string>(tag?.types[1] ?? '');
  const [moveName, setMoveName] = useState(tag?.move?.name ?? '');
  const [moveType, setMoveType] = useState<PokemonType>(tag?.move?.type ?? POKEMON_TYPES[0]);
  const [gimmick, setGimmick] = useState<string>(tag?.gimmick?.kind ?? '');
  const [legendary, setLegendary] = useState(tag?.legendary ?? false);
  const [mythical, setMythical] = useState(tag?.mythical ?? false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const id = useRef(tag?.id ?? newCustomId());
  const heading = useRef<HTMLHeadingElement>(null);
  const refs: Record<Field, React.RefObject<HTMLInputElement | HTMLSelectElement | null>> = {
    code: useRef<HTMLInputElement>(null),
    name: useRef<HTMLInputElement>(null),
    type1: useRef<HTMLSelectElement>(null),
    moveName: useRef<HTMLInputElement>(null),
  };

  useEffect(() => heading.current?.focus(), []);

  const duplicates = officialTagsWithCode(code);

  function fail(field: Field, message: string) {
    setError(message);
    refs[field].current?.focus();
  }

  async function save() {
    const trimmedCode = code.trim();
    const trimmedName = name.trim();
    const trimmedMove = moveName.trim();
    if (!trimmedCode) return fail('code', 'Enter the printed code from the back of the tag.');
    if (trimmedCode.length > MAX_CODE_LENGTH) return fail('code', `The code can be at most ${MAX_CODE_LENGTH} characters.`);
    if (!trimmedName) return fail('name', 'Enter the name of the Pokémon.');
    if (trimmedName.length > MAX_NAME_LENGTH) return fail('name', `The name can be at most ${MAX_NAME_LENGTH} characters.`);
    if (!type1) return fail('type1', 'Choose at least one type.');
    if (trimmedMove.length > MAX_MOVE_LENGTH) return fail('moveName', `The move name can be at most ${MAX_MOVE_LENGTH} characters.`);
    setError(null);
    const types = type2 && type2 !== type1 ? [type1 as PokemonType, type2 as PokemonType] : [type1 as PokemonType];
    const saved = makeCustomTag(id.current, {
      printedCode: trimmedCode,
      name: trimmedName,
      grade: grade === '' ? null : (Number(grade) as Grade),
      types,
      move: trimmedMove ? { name: trimmedMove, type: moveType } : null,
      gimmick: gimmick ? (gimmick as Gimmick) : null,
      legendary,
      mythical,
    });
    setSaving(true);
    try {
      await onSave(saved);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!onDelete) return;
    setSaving(true);
    try {
      const result = await onDelete();
      if (!result.ok) {
        setDeleteError(result.message);
        setConfirmingDelete(false);
      }
    } finally {
      setSaving(false);
    }
  }

  const typeOptions = POKEMON_TYPES.map((t) => (
    <option key={t} value={t}>
      {typeLabel(t)}
    </option>
  ));

  return (
    <section className="editor">
      <button type="button" className="link" onClick={onClose}>
        ‹ Back
      </button>
      <h1 ref={heading} tabIndex={-1}>
        {tag ? `Edit ${tag.name}` : 'Add a tag'}
      </h1>
      <p className="hint">Copy the details from your tag. It is saved on this phone and shows under “My tags”.</p>
      {tag && onSetPhoto && (
        <PhotoSection tagName={tag.name} photoUrl={photoUrl} onSetPhoto={onSetPhoto} onRemovePhoto={onRemovePhoto} rasterizer={rasterizer} />
      )}

      <label>
        Printed code
        <input ref={refs.code as React.RefObject<HTMLInputElement>} value={code} required maxLength={MAX_CODE_LENGTH} onChange={(e) => setCode(e.target.value)} placeholder="as on the back of the tag" />
      </label>
      <div role="status">
        {duplicates.length > 0 && (
          <p className="notice">
            {duplicates
              .map((t) => `This code is already in ${setOfTag(t)?.name}: ${t.name}`)
              .join('. ')}{' '}
            — mark that one owned instead? You can still save this one.
          </p>
        )}
      </div>
      <label>
        Name
        <input ref={refs.name as React.RefObject<HTMLInputElement>} value={name} required maxLength={MAX_NAME_LENGTH} onChange={(e) => setName(e.target.value)} />
      </label>
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
        <select ref={refs.type1 as React.RefObject<HTMLSelectElement>} value={type1} required onChange={(e) => setType1(e.target.value)}>
          <option value="">choose a type</option>
          {typeOptions}
        </select>
      </label>
      <label>
        Second type
        <select value={type2} onChange={(e) => setType2(e.target.value)}>
          <option value="">none</option>
          {typeOptions}
        </select>
      </label>
      <label>
        Move
        <input ref={refs.moveName as React.RefObject<HTMLInputElement>} value={moveName} onChange={(e) => setMoveName(e.target.value)} placeholder="optional" />
      </label>
      <label>
        Move type
        <select value={moveType} onChange={(e) => setMoveType(e.target.value as PokemonType)}>
          {typeOptions}
        </select>
      </label>
      <label>
        Special move
        <select value={gimmick} onChange={(e) => setGimmick(e.target.value)}>
          <option value="">none</option>
          {GIMMICKS.map((g) => (
            <option key={g} value={g}>
              {GIMMICK_NAME[g]}
            </option>
          ))}
        </select>
      </label>
      <label className="check">
        <input type="checkbox" checked={legendary} onChange={(e) => setLegendary(e.target.checked)} />
        Legendary
      </label>
      <label className="check">
        <input type="checkbox" checked={mythical} onChange={(e) => setMythical(e.target.checked)} />
        Mythical
      </label>

      <div role="alert">
        {error && <p className="error">{error}</p>}
        {deleteError && <p className="error">{deleteError}</p>}
      </div>
      <div className="actions">
        <button type="button" className="primary" disabled={saving} onClick={save}>
          {tag ? 'Save changes' : 'Save tag'}
        </button>
        {tag && onDelete && !confirmingDelete && (
          <button type="button" disabled={saving} onClick={() => { setDeleteError(null); setConfirmingDelete(true); }}>
            Delete tag
          </button>
        )}
      </div>
      {confirmingDelete && (
        <div className="notice" role="group" aria-label="Confirm delete">
          <p>{`Delete ${tag?.name}? Its owned mark and photo are removed too.`}</p>
          <div className="actions">
            <button type="button" className="primary" disabled={saving} onClick={remove}>
              Yes, delete
            </button>
            <button type="button" disabled={saving} onClick={() => setConfirmingDelete(false)}>
              Keep it
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
