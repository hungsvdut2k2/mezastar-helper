import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setOwned } from '../../storage/db';
import { freshDb } from '../../test/freshDb';
import { WithStore } from '../testHarness';
import { PlanScreen } from './PlanScreen';

beforeEach(freshDb);

it('plans for a Superstar picked with one tap, using unknown cronies', async () => {
  for (const id of ['1-3-002', '1-3-008']) await setOwned(id, true);
  const user = userEvent.setup();
  render(<WithStore>{(store) => <PlanScreen store={store} />}</WithStore>);
  await user.click(await screen.findByRole('button', { name: 'Lugia 1-3-001' }));
  expect(screen.getByText(/^Team 1:/)).toBeInTheDocument();
  expect(screen.getAllByText(/Unknown crony/).length).toBeGreaterThan(0);
});

it('offers the Superstars of the chosen set only, labelled with name and code', async () => {
  const user = userEvent.setup();
  render(<WithStore>{(store) => <PlanScreen store={store} />}</WithStore>);
  const set = await screen.findByRole('combobox', { name: 'Set' });
  expect(set).toHaveValue('stardust-v3');
  expect(screen.getByRole('button', { name: 'Lugia 1-3-001' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^Kyurem/ })).not.toBeInTheDocument();
  await user.selectOptions(set, 'stardust-v4');
  const kyurems = screen.getAllByRole('button', { name: /^Kyurem / });
  expect(kyurems.map((b) => b.textContent)).toEqual(['Kyurem 1-4-008', 'Kyurem 1-4-009']);
  expect(screen.queryByRole('button', { name: 'Lugia 1-3-001' })).not.toBeInTheDocument();
  expect(screen.getAllByRole('button').filter((b) => /\d-\d-0(0[1-9]|10)$/.test(b.textContent ?? ''))).toHaveLength(10);
  await user.selectOptions(set, 'all');
  expect(screen.getByRole('button', { name: 'Lugia 1-3-001' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Kyurem 1-4-008' })).toBeInTheDocument();
});
