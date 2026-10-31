import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as dbModule from '../../storage/db';
import { loadAll, setOwned } from '../../storage/db';
import { freshDb } from '../../test/freshDb';
import { WithStore } from '../testHarness';
import { PlayScreen } from './PlayScreen';

beforeEach(freshDb);
afterEach(() => vi.restoreAllMocks());

async function enterBattle() {
  for (const id of ['1-3-002', '1-3-008', '1-3-012']) await setOwned(id, true);
  const user = userEvent.setup();
  render(<WithStore>{(store) => <PlayScreen store={store} />}</WithStore>);
  await user.type(await screen.findByLabelText('Boss'), 'Lugia');
  await user.click(screen.getByRole('button', { name: /^Lugia 1-3-001/ }));
  await user.type(screen.getByLabelText('Crony 1'), 'Pidgeot');
  await user.click(screen.getByRole('button', { name: /^Pidgeot 1-3-017/ }));
  await user.type(screen.getByLabelText('Crony 2'), 'Koffing');
  await user.click(screen.getByRole('button', { name: /^Koffing 1-3-041/ }));
  return user;
}

it('recommends a team and plan once all three opponents are entered', async () => {
  await enterBattle();
  expect(screen.getByText(/^Team 1:/)).toBeInTheDocument();
  expect(screen.getAllByText(/^Turn 1:/).length).toBeGreaterThan(0);
});

it('lets the player switch the target to a crony', async () => {
  const user = await enterBattle();
  await user.click(screen.getByRole('button', { name: 'Pidgeot' }));
  expect(screen.getByText(/→ Pidgeot \(target\):/)).toBeInTheDocument(); // the reason line
});

it('shows the Catch now warning', async () => {
  const user = await enterBattle();
  await user.click(screen.getByRole('button', { name: 'Catch now' }));
  expect(screen.getByText(/rarely gives Superstars/)).toBeInTheDocument();
});

it('logs the play and saves it on the phone', async () => {
  const user = await enterBattle();
  await user.click(screen.getByRole('button', { name: 'I used this team — log the play' }));
  await user.click(screen.getByRole('button', { name: 'Yes' }));
  await user.click(screen.getByRole('button', { name: 'Lugia' }));
  await user.click(screen.getByRole('button', { name: 'Save play' }));
  expect(await screen.findByText(/Play saved/)).toBeInTheDocument();
  const { log } = await loadAll();
  expect(log).toHaveLength(1);
  expect(log[0]).toMatchObject({ boss: '1-3-001', target: '1-3-001', caught: '1-3-001', bossDefeated: true });
});

it('does not say Play saved when saving failed', async () => {
  const user = await enterBattle();
  vi.spyOn(dbModule, 'addLogEntry').mockRejectedValue(new Error('disk full'));
  await user.click(screen.getByRole('button', { name: 'I used this team — log the play' }));
  await user.click(screen.getByRole('button', { name: 'Save play' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/not saved/i);
  expect(screen.queryByText(/Play saved/)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save play' })).toBeEnabled();
  vi.restoreAllMocks();
});
