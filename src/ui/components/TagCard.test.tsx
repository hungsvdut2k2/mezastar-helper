import { render, screen } from '@testing-library/react';
import { TAGS } from '../../data/tags';
import { makeTag } from '../../test/factories';
import { TagCard } from './TagCard';

const lugia = TAGS.find((t) => t.id === '1-3-001')!;

it('shows the player photo, decorative, with object-fit cover styling hook', () => {
  const { container } = render(<TagCard tag={lugia} size="medium" photoUrl="blob:lugia" />);
  const img = container.querySelector('img')!;
  expect(img).toHaveAttribute('src', 'blob:lugia');
  expect(img).toHaveAttribute('alt', '');
  expect(img).toHaveClass('tc-photo');
  // The name is right there as text, so the picture adds nothing for assistive tech.
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(container.querySelector('.tc-initial')).not.toBeInTheDocument();
  expect(container.firstElementChild).toHaveClass('tc-has-photo');
});

it('falls back to type art with the name initial when there is no photo', () => {
  const { container } = render(<TagCard tag={lugia} size="large" />);
  expect(container.querySelector('img')).not.toBeInTheDocument();
  expect(container.querySelector('.tc-initial')).toHaveTextContent('L');
  // One original glyph per type, all hidden from assistive tech.
  expect(container.querySelectorAll('svg.tc-glyph')).toHaveLength(lugia.types.length);
  expect(container.querySelector('.tc-pic')).toHaveAttribute('aria-hidden', 'true');
  expect(container.firstElementChild).toHaveClass('tc-no-photo');
});

it('marks 6★ cards as Superstars and draws one star per grade', () => {
  const { container, rerender } = render(<TagCard tag={makeTag('x', { grade: 6 })} size="medium" />);
  expect(container.firstElementChild).toHaveClass('tc-superstar');
  expect(container.querySelectorAll('.tc-star')).toHaveLength(6);
  rerender(<TagCard tag={makeTag('x', { grade: 5 })} size="medium" />);
  expect(container.firstElementChild).not.toHaveClass('tc-superstar');
  expect(container.querySelectorAll('.tc-star')).toHaveLength(5);
});

it('shows a question mark for an unknown grade and says so to screen readers', () => {
  const { container } = render(<TagCard tag={makeTag('x', { grade: null })} size="medium" />);
  expect(container.firstElementChild).toHaveClass('tc-unknown-grade');
  expect(container.querySelector('.tc-stars')).toHaveTextContent('?');
  expect(container.querySelectorAll('.tc-star')).toHaveLength(0);
  expect(screen.getByText('grade unknown')).toHaveClass('sr-only');
});

it('reads as name, code, grade, set and types inside a button', () => {
  render(
    <button type="button">
      <TagCard tag={lugia} size="small" />
    </button>,
  );
  expect(screen.getByRole('button')).toHaveAccessibleName(
    `Lugia 1-3-001 6★ · Stardust V3 ${lugia.types.map((t) => t[0].toUpperCase() + t.slice(1)).join(' ')}`,
  );
});

it('can show a custom name and meta line, moving the grade to the badges', () => {
  render(
    <button type="button">
      <TagCard tag={lugia} size="small" name="Lugia (2)" meta="1-3-001 · Stardust V3" />
    </button>,
  );
  expect(screen.getByRole('button')).toHaveAccessibleName(/^Lugia \(2\) 1-3-001 · Stardust V3 6★ /);
});

it('shows stats when known and ? otherwise, plus move and gimmick, on larger cards', () => {
  const tag = makeTag('x', {
    stats: { defense: null, spDefense: null },
    move: { name: 'Tackle', type: 'normal', category: 'physical' },
    gimmick: { kind: 'zmove', moveName: 'Big Hit', moveType: 'normal' },
  });
  const { container, rerender } = render(<TagCard tag={tag} size="large" />);
  const stats = [...container.querySelectorAll('.tc-stat')].map((s) => s.textContent?.trim());
  expect(stats).toEqual(['HP 1000', 'ATK 100', 'DEF ?', 'SPA 100', 'SPD ?', 'SPE 100']);
  expect(screen.getByText('Tackle')).toBeInTheDocument();
  expect(screen.getByText('· Physical')).toBeInTheDocument();
  expect(screen.getByText('Z-Move: Big Hit')).toBeInTheDocument();
  rerender(<TagCard tag={tag} size="small" />);
  expect(container.querySelector('.tc-stats')).not.toBeInTheDocument();
  expect(screen.getByText('Z-Move')).toBeInTheDocument();
});

it('does not break on a tag with no types (unknown crony)', () => {
  const { container } = render(<TagCard tag={makeTag('?', { name: 'Unknown crony', types: [], grade: null })} size="medium" />);
  expect(container.querySelector('.tc-initial')).toHaveTextContent('U');
  expect(container.querySelectorAll('.type-pill')).toHaveLength(0);
});
