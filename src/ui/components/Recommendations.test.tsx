import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TAGS } from '../../data/tags';
import type { Battle } from '../../engine/battleModel';
import { unknownOpponent } from '../../engine/recommend';
import { makeTag } from '../../test/factories';
import { Recommendations } from './Recommendations';

const byId = (id: string) => TAGS.find((t) => t.id === id)!;
// Galaxy V2 has no stats yet, so these plans fall back to the rule of thumb.
const battle: Battle = { opponents: [byId('2-2-001'), byId('2-2-031'), byId('2-2-032')], targetIndex: 0 };
const owned = ['2-2-002', '2-2-012', '2-2-015'].map(byId);

it('shows reminders, a team, its reason and a turn-by-turn plan', () => {
  render(<Recommendations owned={owned} battle={battle} />);
  expect(screen.getByText(/Scan it before placing any tags/)).toBeInTheDocument();
  expect(screen.getByText(/^Team 1:/)).toBeInTheDocument();
  expect(screen.getByText(/→ Zacian \(target\):/)).toBeInTheDocument(); // the reason line
  expect(screen.getByText('rule of thumb')).toBeInTheDocument();
  expect(screen.getAllByText(/^Turn \d$/)).toHaveLength(3);
  // Each step reads as a turn timeline entry: "Turn 1 ▶ Attacker → Target", with its trust badge.
  const step = screen.getAllByText(/^Turn \d$/)[0].closest('li')!;
  expect(step).toHaveTextContent(/^Turn 1 ▶ .+ → .+/);
  expect(step.querySelector('.trust')?.getAttribute('class')).toMatch(/^trust trust-(confirmed|community|player|open|estimate)$/);
});

it('asks for more tags when fewer than 2 are owned', () => {
  render(<Recommendations owned={[byId('2-2-002')]} battle={battle} />);
  expect(screen.getByText(/Mark at least 2 tags as owned/)).toBeInTheDocument();
});

it('shows each team member as a card', () => {
  const { container } = render(<Recommendations owned={owned} battle={battle} photos={new Map([['2-2-002', 'blob:mine']])} />);
  const team = container.querySelector('.card .team-grid')!;
  expect(team.querySelectorAll('.tc-medium').length).toBeGreaterThanOrEqual(2);
  expect(container.querySelector('img[src="blob:mine"]')).toHaveAttribute('alt', '');
});

it('lets the player pick the team they used', async () => {
  const onUseTeam = vi.fn();
  render(<Recommendations owned={owned} battle={battle} onUseTeam={onUseTeam} />);
  await userEvent.setup().click(screen.getByRole('button', { name: 'I used this team — log the play' }));
  expect(onUseTeam).toHaveBeenCalledTimes(1);
});

it('notes once that numbers are rough when a plan was searched with some unknown stats', () => {
  const mine = [makeTag('a'), makeTag('b', { stats: { defense: null } })];
  const opp = [makeTag('o1'), makeTag('o2'), makeTag('o3')];
  render(<Recommendations owned={mine} battle={{ opponents: [opp[0], opp[1], opp[2]], targetIndex: 0 }} />);
  expect(screen.queryByText('rule of thumb')).not.toBeInTheDocument();
  expect(screen.getAllByText(/unknown/i)).toHaveLength(1);
  expect(screen.getByText('Some stats are unknown, so these numbers are rough estimates.')).toBeInTheDocument();
});

it('does not show the rough-estimates hint on a rule-of-thumb plan', () => {
  render(<Recommendations owned={owned} battle={battle} />);
  expect(screen.getByText('rule of thumb')).toBeInTheDocument();
  expect(screen.queryByText(/these numbers are rough estimates/)).not.toBeInTheDocument();
  expect(screen.getAllByText(/Add them in Collection/).length).toBeGreaterThan(0);
});

it('tells the player to enter real opponents when a crony is the unknown placeholder', () => {
  const planBattle: Battle = {
    opponents: [byId('1-3-001'), unknownOpponent(1), unknownOpponent(2)],
    targetIndex: 0,
  };
  render(<Recommendations owned={owned} battle={planBattle} />);
  expect(screen.getAllByText(/Enter the real opponents at the machine for a searched plan/).length).toBeGreaterThan(0);
  expect(screen.queryByText(/Add them in Collection/)).not.toBeInTheDocument();
});
