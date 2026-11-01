import { Fragment, type CSSProperties, type ReactNode } from 'react';
import { printedCode, setLabel } from '../../data/setInfo';
import { GIMMICK_NAME, type PokemonType, type Tag } from '../../data/types';
import { categoryLabel, gradeLabel, typeLabel } from '../format';
import { SmallStar } from './icons';
import { TypeGlyph } from './TypeGlyph';

export type TagCardSize = 'large' | 'medium' | 'small';

type Props = {
  tag: Tag;
  size: TagCardSize;
  /** Object URL of the player's own photo of this tag. */
  photoUrl?: string;
  /** Shown instead of tag.name, e.g. "Twin (2)" when two rows would otherwise read the same. */
  name?: string;
  /**
   * The line under the name. By default "<code> <grade> · <set>".
   * A string replaces it (the grade then moves to the badge row); null drops the line.
   */
  meta?: string | null;
  /** Replaces the name element, e.g. with the page heading. */
  title?: ReactNode;
  /** 'span' (default) keeps the card valid inside a button; 'div' allows block content such as a heading in `title`. */
  as?: 'span' | 'div';
  className?: string;
};

/** CSS custom properties pointing at the type's colour tokens in styles.css. */
export const typeVars = (type: PokemonType | undefined, name = '--t'): Record<string, string> =>
  type ? { [name]: `var(--type-${type})`, [`${name}-ink`]: `var(--type-${type}-ink)` } : {};

const STAT_LABELS = [
  ['hp', 'HP'],
  ['attack', 'ATK'],
  ['defense', 'DEF'],
  ['spAttack', 'SPA'],
  ['spDefense', 'SPD'],
  ['speed', 'SPE'],
] as const;

function Grade({ grade }: { grade: Tag['grade'] }) {
  if (grade === null) {
    return (
      <span className="tc-grade tc-grade-unknown">
        <span aria-hidden="true">?★</span>
        <span className="sr-only">{gradeLabel(null)}</span>
      </span>
    );
  }
  return <span className={`tc-grade tc-grade-${grade}`}>{gradeLabel(grade)}</span>;
}

/** The single way a tag is shown: picture (photo or type art), name, code, set, types, grade and, when larger, stats and move. */
export function TagCard({ tag, size, photoUrl, name, meta, title, as = 'span', className }: Props) {
  const Box = as;
  const displayName = name ?? tag.name;
  const [type1, type2] = tag.types;
  const code = printedCode(tag);
  const set = setLabel(tag);
  const initial = Array.from(displayName.trim())[0]?.toUpperCase() ?? '?';
  const detailed = size !== 'small';
  const classes = [
    'tc',
    `tc-${size}`,
    tag.grade === 6 && 'tc-superstar',
    tag.grade === null && 'tc-unknown-grade',
    photoUrl ? 'tc-has-photo' : 'tc-no-photo',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  const style = { ...typeVars(type1, '--tc-a'), ...typeVars(type2 ?? type1, '--tc-b') } as CSSProperties;

  return (
    <Box className={classes} style={style} data-grade={tag.grade ?? 'unknown'}>
      {/* Decorative: the name and types are given as text in the body. */}
      <Box className="tc-pic" aria-hidden="true">
        {photoUrl ? (
          <img className="tc-photo tag-thumb" src={photoUrl} alt="" loading="lazy" decoding="async" />
        ) : (
          <>
            <span className="tc-glyphs">
              {tag.types.map((t) => (
                <TypeGlyph key={t} type={t} className="tc-glyph" />
              ))}
            </span>
            <span className="tc-initial">{initial}</span>
          </>
        )}
        {detailed && (
          <span className="tc-stars">
            {tag.grade === null ? (
              <span className="tc-stars-unknown">?</span>
            ) : (
              Array.from({ length: tag.grade }, (_, i) => <SmallStar key={i} className="tc-star" />)
            )}
          </span>
        )}
      </Box>
      <Box className="tc-body">
        {title ?? <span className="tc-name">{displayName}</span>}{' '}
        {meta === undefined ? (
          <span className="tc-meta">
            {code} <Grade grade={tag.grade} />
            {set && ` · ${set}`}
          </span>
        ) : (
          meta !== null && <span className="tc-meta">{meta}</span>
        )}{' '}
        <span className="tc-badges">
          {meta !== undefined && (
            <>
              <Grade grade={tag.grade} />{' '}
            </>
          )}
          {tag.types.map((t, i) => (
            <Fragment key={t}>
              {i > 0 && ' '}
              <span className="type-pill" style={typeVars(t) as CSSProperties}>
                {typeLabel(t)}
              </span>
            </Fragment>
          ))}
          {tag.gimmick && (
            <>
              {' '}
              <span className="tc-gimmick">
                {GIMMICK_NAME[tag.gimmick.kind]}
                {size === 'large' && tag.gimmick.moveName ? `: ${tag.gimmick.moveName}` : ''}
              </span>
            </>
          )}
        </span>
        {detailed && (
          <>
            {' '}
            <span className="tc-stats">
              {STAT_LABELS.map(([key, label], i) => (
                <Fragment key={key}>
                  {i > 0 && ' '}
                  <span className="tc-stat">
                    <span className="tc-stat-k">{label}</span> <span className="tc-stat-v">{tag.stats[key] ?? '?'}</span>
                  </span>
                </Fragment>
              ))}
            </span>{' '}
            <span className="tc-move">
              <span className="tc-stat-k">Move</span>{' '}
              {tag.move ? (
                <>
                  <span className="tc-move-dot" style={typeVars(tag.move.type) as CSSProperties} aria-hidden="true" />
                  {tag.move.name}
                  {tag.move.category && <span className="tc-move-cat">{` · ${categoryLabel(tag.move.category)}`}</span>}
                </>
              ) : (
                '?'
              )}
            </span>
          </>
        )}
      </Box>
    </Box>
  );
}
