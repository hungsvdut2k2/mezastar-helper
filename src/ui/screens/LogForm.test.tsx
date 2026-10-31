import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TAGS } from '../../data/tags';
import type { PlayLogEntry } from '../../data/types';
import type { Battle } from '../../engine/battleModel';
import { recommend } from '../../engine/recommend';
import { LogForm } from './LogForm';

const byId = (id: string) => TAGS.find((t) => t.id === id)!;
const battle: Battle = { opponents: [byId('1-3-001'), byId('1-3-017'), byId('1-3-041')], targetIndex: 0 };
const [rec] = recommend(['1-3-002', '1-3-008', '1-3-012'].map(byId), battle);

it('builds a log entry from a few taps', async () => {
  const user = userEvent.setup();
  const onSave = vi.fn<(e: PlayLogEntry) => void>();
  render(<LogForm mode="battle" battle={battle} rec={rec} lastLocation="Mall A" onSave={onSave} onCancel={() => {}} />);
  await user.click(screen.getByRole('button', { name: '1' }));
  await user.click(screen.getByRole('button', { name: 'Yes' }));
  await user.click(screen.getByRole('button', { name: 'Lugia' }));
  await user.click(screen.getByRole('button', { name: 'Ultra' }));
  await user.click(screen.getByRole('checkbox', { name: 'Add turn detail' }));
  await user.click(screen.getAllByRole('checkbox', { name: 'Defeated it' })[0]);
  await user.click(screen.getByRole('button', { name: 'Save play' }));

  const entry = onSave.mock.calls[0][0];
  expect(entry).toMatchObject({
    mode: 'battle',
    location: 'Mall A',
    boss: '1-3-001',
    cronies: ['1-3-017', '1-3-041'],
    target: '1-3-001',
    superstarAppeared: true,
    teamUsed: rec.team.map((t) => t.id),
    cronyDefeatedCount: 1,
    bossDefeated: true,
    ballType: 'ultra',
    caught: '1-3-001',
  });
  expect(entry.turns).toHaveLength(3);
  expect(entry.turns[0].defeated).toBe(entry.turns[0].aimedAt);
  expect(entry.turns[1].defeated).toBeUndefined();
});
