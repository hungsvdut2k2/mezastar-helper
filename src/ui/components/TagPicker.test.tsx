import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TAGS } from '../../data/tags';
import type { Tag } from '../../data/types';
import { searchTags } from '../format';
import { TagPicker } from './TagPicker';

function Harness() {
  const [value, setValue] = useState<Tag | null>(null);
  return <TagPicker label="Boss" tags={TAGS} value={value} onChange={setValue} />;
}

it('shows matches for a name and picks one', async () => {
  const user = userEvent.setup();
  render(<Harness />);
  await user.type(screen.getByLabelText('Boss'), 'Lugia');
  await user.click(screen.getByRole('button', { name: /^Lugia 1-3-001/ }));
  expect(screen.getByRole('button', { name: 'Clear Boss' })).toBeInTheDocument();
});

it('says so when nothing matches', async () => {
  const user = userEvent.setup();
  render(<Harness />);
  expect(screen.queryByText('No matching tag')).not.toBeInTheDocument();
  await user.type(screen.getByLabelText('Boss'), 'zzzzqq');
  expect(screen.getByText('No matching tag')).toBeInTheDocument();
});

it('announces only a short results count, not the whole button list', async () => {
  const user = userEvent.setup();
  const { container } = render(<Harness />);
  const live = container.querySelector('[aria-live="polite"]')!;
  expect(container.querySelectorAll('[aria-live]')).toHaveLength(1);
  await user.type(screen.getByLabelText('Boss'), 'Lugia');
  expect(live).toHaveTextContent(/^\d+ match(es)?$/);
  expect(live).not.toContainElement(screen.getByRole('button', { name: /^Lugia 1-3-001/ }));
  await user.clear(screen.getByLabelText('Boss'));
  await user.type(screen.getByLabelText('Boss'), 'zzzzqq');
  expect(live).toHaveTextContent('No matching tag');
});

it('turns off autocorrect, autocapitalize and spellcheck on the input', () => {
  render(<Harness />);
  const input = screen.getByLabelText('Boss');
  expect(input).toHaveAttribute('autocorrect', 'off');
  expect(input).toHaveAttribute('autocapitalize', 'none');
  expect(input).toHaveAttribute('spellcheck', 'false');
});

it('moves focus to the chosen tag, and back to the input after clearing', async () => {
  const user = userEvent.setup();
  render(<Harness />);
  await user.type(screen.getByLabelText('Boss'), 'Lugia');
  await user.click(screen.getByRole('button', { name: /^Lugia 1-3-001/ }));
  expect(screen.getByRole('button', { name: 'Clear Boss' })).toHaveFocus();
  await user.click(screen.getByRole('button', { name: 'Clear Boss' }));
  expect(screen.getByLabelText('Boss')).toHaveFocus();
});

it('says how many matches are hidden when results are truncated', async () => {
  const user = userEvent.setup();
  render(<Harness />);
  await user.type(screen.getByLabelText('Boss'), '1-3-0');
  const total = searchTags(TAGS, '1-3-0').length;
  expect(total).toBeGreaterThan(8);
  expect(screen.getByText(`Showing 8 of ${total} — type a code to narrow`)).toBeInTheDocument();
  expect(screen.getAllByRole('button')).toHaveLength(8);
  await user.type(screen.getByLabelText('Boss'), '01');
  expect(screen.getByLabelText('Boss')).toHaveValue('1-3-001');
  expect(screen.getByText('1 match')).toBeInTheDocument();
});
