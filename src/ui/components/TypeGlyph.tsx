import type { ReactNode } from 'react';
import type { PokemonType } from '../../data/types';

/*
 * Original, deliberately generic glyphs (a flame, a drop, a bolt, …) drawn for this app.
 * They are not traced from or modelled on any official type icon.
 */
const filled = (d: string, evenOdd = false) => <path d={d} fill="currentColor" fillRule={evenOdd ? 'evenodd' : undefined} />;
const stroked = (d: string) => (
  <path d={d} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
);

const GLYPHS: Record<PokemonType, ReactNode> = {
  normal: filled('M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18Zm0 4.5a4.5 4.5 0 1 1 0 9a4.5 4.5 0 1 1 0-9Z', true),
  fire: filled('M12 2c1 4 6 6.5 6 12a6 6 0 0 1-12 0c0-3 1.5-5 3-6.5c0 2 1 3.5 2.5 4C11 8.5 11 5 12 2Z'),
  water: filled('M12 2.5C9 7 6 10.5 6 14.5a6 6 0 0 0 12 0C18 10.5 15 7 12 2.5Z'),
  electric: filled('M13.5 2 5 13.5h5.5L9.5 22 19 9.5h-5.5L15 2Z'),
  grass: filled('M20 4C10 4 4 9 4 16c0 1.4.3 2.6.8 3.6L3 21.4l1.4 1.4 1.9-1.9c1 .5 2.2.8 3.7.8C17 21.7 20 14 20 4Z'),
  ice: stroked('M12 2v20M3.3 7l17.4 10M3.3 17l17.4-10M9.5 3.5 12 6l2.5-2.5M9.5 20.5 12 18l2.5 2.5'),
  fighting: filled('M12 2l2.2 5.6L20 6l-2.6 5.4L22 14l-5.8.9L16 21l-4-4.4L8 21l-.2-6.1L2 14l4.6-2.6L4 6l5.8 1.6Z'),
  poison: (
    <>
      <circle cx="8.5" cy="15" r="5" fill="currentColor" />
      <circle cx="16" cy="8.5" r="4" fill="currentColor" />
      <circle cx="17.5" cy="18" r="2.5" fill="currentColor" />
    </>
  ),
  ground: filled('M2 21h20l-2.5-5h-15Zm4-7h12l-2.5-5h-7Zm4-7h4l-1.5-3h-1Z'),
  flying: filled('M2 13c5-.5 8.5-3.5 10.5-9c1.2 3 1.2 6 .3 8.2C16 11.3 19 11.5 22 13c-4 4.5-11 7.5-20 0Z'),
  psychic: filled('M12 5C6.5 5 3 12 3 12s3.5 7 9 7s9-7 9-7s-3.5-7-9-7Zm0 3.5a3.5 3.5 0 1 1 0 7a3.5 3.5 0 1 1 0-7Z', true),
  bug: filled('M11 4.1C7.3 4.6 5 8.3 5 12.5S7.6 20.5 11 21Zm2 0V21c3.4-.5 6-4.2 6-8.5S16.7 4.6 13 4.1Z'),
  rock: filled('M7 4h8l6 6-2 9H6l-4-7Z'),
  ghost: filled(
    'M12 3a7 7 0 0 0-7 7v11l2.5-2 2 2 2.5-2 2.5 2 2-2 2.5 2V10a7 7 0 0 0-7-7Zm-3 6.5a1.5 1.5 0 1 1 0 3a1.5 1.5 0 1 1 0-3Zm6 0a1.5 1.5 0 1 1 0 3a1.5 1.5 0 1 1 0-3Z',
    true,
  ),
  dragon: stroked('M5 21C8 15 11 9 17 3M10 21.5c3-5 6-10 10.5-14M3 15.5c2-4 5-8 9.5-11.5'),
  dark: filled('M15 3a9 9 0 1 0 6 15A8 8 0 0 1 15 3Z'),
  steel: filled('M12 2l8.7 5v10L12 22l-8.7-5V7Zm0 6a4 4 0 1 0 0 8a4 4 0 1 0 0-8Z', true),
  fairy: filled('M12 2c.8 5 2.5 8 10 10c-7.5 2-9.2 5-10 10c-.8-5-2.5-8-10-10C9.5 10 11.2 7 12 2Z'),
};

/** Decorative: always hidden from assistive tech, the type name is shown as text next to it. */
export function TypeGlyph({ type, className }: { type: PokemonType; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {GLYPHS[type]}
    </svg>
  );
}
