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
  expect(screen.getByText(/Teams are ranked by their average against every Pokémon from the same set/)).toBeInTheDocument();
  expect(screen.getAllByText(/^Defeats Lugia in \d+% of 200 sampled crony pairs \(of [\d,]+ possible\) from Stardust V3\.$/).length).toBeGreaterThan(0);
});

it('builds target teams from every tag by default, saying which members are missing, or only from owned tags', async () => {
  for (const id of ['1-3-002', '1-3-008']) await setOwned(id, true);
  const user = userEvent.setup();
  render(<WithStore>{(store) => <PlanScreen store={store} />}</WithStore>);
  await user.click(await screen.findByRole('button', { name: 'Lugia 1-3-001' }));
  expect(screen.getByRole('button', { name: 'Every tag' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getAllByText(/^You own \d of 3\. Missing: |^You own all of these\.$/)).toHaveLength(3);
  await user.click(screen.getByRole('button', { name: 'Only my tags' }));
  expect(screen.getByText(/^Team 1: (Ho-Oh \+ Keldeo|Keldeo \+ Ho-Oh)$/)).toBeInTheDocument();
  expect(screen.queryByText(/^You own \d of 3/)).not.toBeInTheDocument();
});

it('leaves out an unticked set when picking from every tag', async () => {
  const user = userEvent.setup();
  render(<WithStore>{(store) => <PlanScreen store={store} />}</WithStore>);
  await user.click(await screen.findByRole('button', { name: 'Ho-Oh 1-3-002' }));
  const teams = () => screen.getAllByText(/^Team \d:/).map((h) => h.textContent).join(' ');
  // Both Calyrex tags are Stardust V4 only, and rank high against Ho-Oh.
  expect(teams()).toContain('Calyrex');
  await user.click(screen.getByRole('checkbox', { name: 'Stardust V4' }));
  expect(teams()).not.toContain('Calyrex');
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

it('shows the best all-round team from Stardust V1–V3 until a target is picked, marking owned tags', async () => {
  const user = userEvent.setup();
  render(<WithStore>{(store) => <PlanScreen store={store} />}</WithStore>);
  expect(await screen.findByRole('heading', { name: 'Best all-round team' })).toBeInTheDocument();
  expect(screen.getAllByText(/^Best team \d:/)).toHaveLength(3);
  expect(screen.getAllByText(/^You own 0 of 3/).length).toBeGreaterThan(0);
  await user.click(screen.getByRole('button', { name: 'Only my tags' }));
  expect(screen.getByText(/Mark at least 2 Stardust V1–V3 tags/)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Lugia 1-3-001' }));
  expect(screen.queryByRole('heading', { name: 'Best all-round team' })).not.toBeInTheDocument();
});
