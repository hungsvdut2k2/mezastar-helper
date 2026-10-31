import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TAGS } from '../../data/tags';
import type { Battle } from '../../engine/battleModel';
import { Recommendations } from './Recommendations';

const byId = (id: string) => TAGS.find((t) => t.id === id)!;
const battle: Battle = { opponents: [byId('1-3-001'), byId('1-3-017'), byId('1-3-041')], targetIndex: 0 };
const owned = ['1-3-002', '1-3-008', '1-3-012'].map(byId);

it('shows reminders, a team, its reason and a turn-by-turn plan', () => {
  render(<Recommendations owned={owned} battle={battle} />);
  expect(screen.getByText(/Scan it before placing any tags/)).toBeInTheDocument();
  expect(screen.getByText(/^Team 1:/)).toBeInTheDocument();
  expect(screen.getByText(/→ Lugia \(target\):/)).toBeInTheDocument(); // the reason line
  expect(screen.getByText('rule of thumb')).toBeInTheDocument();
  expect(screen.getAllByText(/^Turn \d:/)).toHaveLength(3);
});

it('asks for more tags when fewer than 2 are owned', () => {
  render(<Recommendations owned={[byId('1-3-002')]} battle={battle} />);
  expect(screen.getByText(/Mark at least 2 tags as owned/)).toBeInTheDocument();
});

it('lets the player pick the team they used', async () => {
  const onUseTeam = vi.fn();
  render(<Recommendations owned={owned} battle={battle} onUseTeam={onUseTeam} />);
  await userEvent.setup().click(screen.getByRole('button', { name: 'I used this team — log the play' }));
  expect(onUseTeam).toHaveBeenCalledTimes(1);
});

it('notes that numbers are rough estimates when stats are unknown', () => {
  render(<Recommendations owned={owned} battle={battle} />);
  expect(screen.getAllByText(/Some stats are unknown/).length).toBeGreaterThan(0);
});
