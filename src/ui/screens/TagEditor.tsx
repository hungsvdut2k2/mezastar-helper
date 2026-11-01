import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { GIMMICK_NAME, POKEMON_TYPES, type Grade, type MoveCategory, type PokemonType, type Tag, type TagCorrection, type TagStats } from '../../data/types';
import { printedCode, setLabel } from '../../data/setInfo';
import { categoryLabel, gradeLabel, typeLabel } from '../format';
import { PhotoError, processPhoto, type Rasterizer } from '../photo';
import { OCR_MAX_SIDE, OcrError, type ReadStats, type StatsReader } from '../statsOcr';
import { PhotoSection } from './PhotoSection';
import { TagCard } from '../components/TagCard';

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
  /** Reads stats from a photo (Gemini); omitted when no key is built in. */
  readStats?: StatsReader | null;
};

const FIELDS = [
  ['pokenergy', 'Pokénergy'],
  ['hp', 'HP'],
  ['attack', 'Attack'],
  ['defense', 'Defense'],
  ['spAttack', 'Sp. Atk'],
  ['spDefense', 'Sp. Def'],
  ['speed', 'Speed'],
] as const;
type Field = (typeof FIELDS)[number][0];

const toText = (v: number | null) => (v === null ? '' : String(v));

export function TagEditor({ tag, shipped, hasCorrection, onSave, onReset, onClose, photoUrl, onSetPhoto, onRemovePhoto, rasterizer, readStats }: Props) {
  const [grade, setGrade] = useState(tag.grade === null ? '' : String(tag.grade));
  const [type1, setType1] = useState<PokemonType>(tag.types[0] ?? POKEMON_TYPES[0]);
  const [type2, setType2] = useState<string>(tag.types[1] ?? '');
  const [numbers, setNumbers] = useState<Record<Field, string>>({
    pokenergy: toText(tag.pokenergy),
    hp: toText(tag.stats.hp),
    attack: toText(tag.stats.attack),
    defense: toText(tag.stats.defense),
    spAttack: toText(tag.stats.spAttack),
    spDefense: toText(tag.stats.spDefense),
    speed: toText(tag.stats.speed),
  });
  const [moveName, setMoveName] = useState(tag.move?.name ?? '');
  const [moveType, setMoveType] = useState<PokemonType>(tag.move?.type ?? tag.types[0] ?? POKEMON_TYPES[0]);
  const [moveCategory, setMoveCategory] = useState<MoveCategory | ''>(tag.move?.category ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrMessage, setOcrMessage] = useState('');
  const [ocrError, setOcrError] = useState<string | null>(null);

  function applyRead(read: ReadStats) {
    let filled = 0;
    const next = { ...numbers };
    for (const [field] of FIELDS) {
      const v = read[field];
      if (v !== null) {
        next[field] = String(v);
        filled++;
      }
    }
    setNumbers(next);
    if (read.grade !== null) {
      setGrade(String(read.grade));
      filled++;
    }
    if (read.move) {
      setMoveName(read.move.name);
      setMoveType(read.move.type);
      if (read.move.category) setMoveCategory(read.move.category);
      filled++;
    }
    setOcrMessage(filled > 0 ? `Filled ${filled} values from the photo. Check them, then Save.` : 'Could not read any values from that photo.');
  }

  async function runOcr(getImage: () => Promise<Blob>) {
    if (!readStats) return;
    setOcrError(null);
    setOcrMessage('');
    setOcrBusy(true);
    try {
      applyRead(await readStats(await getImage()));
    } catch (err) {
      setOcrError(err instanceof OcrError || err instanceof PhotoError ? err.message : 'Could not read that photo. Try again.');
    } finally {
      setOcrBusy(false);
    }
  }

  function scanFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void runOcr(() => processPhoto(file, rasterizer, OCR_MAX_SIDE));
  }

  useEffect(() => {
    // Focus for screen readers without letting the browser scroll the picture out of view.
    const h = heading.current;
    h?.focus({ preventScroll: true });
    h?.closest('.tc')?.scrollIntoView?.({ block: 'nearest' });
  }, []);
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
    for (const key of ['hp', 'attack', 'defense', 'spAttack', 'spDefense', 'speed'] as const) {
      if (parsed[key] !== null && parsed[key] !== shipped.stats[key]) stats[key] = parsed[key];
    }
    if (Object.keys(stats).length > 0) correction.stats = stats;
    const newMove = moveName.trim() ? { name: moveName.trim(), type: moveType, ...(moveCategory && { category: moveCategory }) } : null;
    const sameMove =
      newMove === null || shipped.move === null
        ? newMove === shipped.move
        : newMove.name === shipped.move.name && newMove.type === shipped.move.type && newMove.category === shipped.move.category;
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
      <TagCard
        as="div"
        size="large"
        tag={tag}
        photoUrl={photoUrl}
        meta={null}
        title={
          <h1 ref={heading} tabIndex={-1}>
            {tag.name} <small>{printedCode(tag)}</small>
          </h1>
        }
      />
      <p>
        {setLabel(tag) && `${setLabel(tag)} · `}
        {gradeLabel(tag.grade)}
        {tag.gimmick && ` · ${GIMMICK_NAME[tag.gimmick.kind]}${tag.gimmick.moveName ? `: ${tag.gimmick.moveName}` : ''}`}
      </p>
      {onSetPhoto && (
        <PhotoSection tagName={tag.name} photoUrl={photoUrl} onSetPhoto={onSetPhoto} onRemovePhoto={onRemovePhoto} rasterizer={rasterizer} />
      )}
      <p className="hint">Copy the numbers from the back of your tag. Leave a box empty if you don't know it.</p>
      {readStats && (
        <div className="ocr">
          <div className="actions">
            {photoUrl && (
              <button type="button" disabled={ocrBusy} onClick={() => runOcr(() => fetch(photoUrl).then((r) => r.blob()))}>
                Read stats from photo
              </button>
            )}
            <label className="file-button">
              Scan a photo for stats
              <input type="file" accept="image/*" disabled={ocrBusy} onChange={scanFile} />
            </label>
          </div>
          <p className="hint" role="status">
            {ocrBusy ? 'Reading photo…' : ocrMessage}
          </p>
          {ocrError && (
            <p className="error" role="alert">
              {ocrError}
            </p>
          )}
        </div>
      )}

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
      <label>
        Move kind
        <select value={moveCategory} onChange={(e) => setMoveCategory(e.target.value as MoveCategory | '')}>
          <option value="">unknown</option>
          {(['physical', 'special'] as const).map((c) => (
            <option key={c} value={c}>
              {categoryLabel(c)}
            </option>
          ))}
        </select>
      </label>
      <p className="hint">Physical moves hit with Attack against Defense, special moves with Sp. Atk against Sp. Def.</p>

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
