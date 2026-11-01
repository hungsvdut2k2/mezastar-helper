import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as dbModule from '../../storage/db';
import { loadAll, saveCorrection } from '../../storage/db';
import { freshDb } from '../../test/freshDb';
import { WithStore } from '../testHarness';
import { CollectionScreen } from './CollectionScreen';

beforeEach(freshDb);

const renderScreen = () => render(<WithStore>{(store) => <CollectionScreen store={store} />}</WithStore>);

it('toggles owned and keeps it after reopening', async () => {
  const user = userEvent.setup();
  const { unmount } = renderScreen();
  await screen.findByText('Owned 0 / 73');
  const toggle = screen.getByRole('button', { name: 'Owned: Lugia 1-3-001' });
  expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await user.click(toggle);
  expect(await screen.findByText('Owned 1 / 73')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Owned: Lugia 1-3-001' })).toHaveAttribute('aria-pressed', 'true');
  unmount();
  renderScreen();
  expect(await screen.findByText('Owned 1 / 73')).toBeInTheDocument();
});

it('searches by name or number', async () => {
  const user = userEvent.setup();
  renderScreen();
  await user.type(await screen.findByRole('searchbox', { name: 'Search tags' }), '1-3-045');
  expect(screen.getByRole('button', { name: /^Metagross 1-3-045/ })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^Lugia/ })).not.toBeInTheDocument();
});

it('saves a correction from the back of the tag', async () => {
  const user = userEvent.setup();
  renderScreen();
  await user.click(await screen.findByRole('button', { name: /^Lugia 1-3-001/ }));
  await user.type(screen.getByLabelText('Attack'), '150');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await user.click(await screen.findByRole('button', { name: /^Lugia 1-3-001/ }));
  expect(screen.getByLabelText('Attack')).toHaveValue(150);
  expect(screen.getByText(/player correction/)).toBeInTheDocument();
});

it('stores only the fields that differ from the shipped tag', async () => {
  const user = userEvent.setup();
  renderScreen();
  await user.click(await screen.findByRole('button', { name: /^Lugia 1-3-001/ }));
  await user.type(screen.getByLabelText('Attack'), '150');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByRole('heading', { name: 'Collection' });
  expect((await loadAll()).corrections).toEqual({ '1-3-001': { stats: { attack: 150 } } });
});

it('stores no correction when nothing was changed', async () => {
  const user = userEvent.setup();
  renderScreen();
  await user.click(await screen.findByRole('button', { name: /^Lugia 1-3-001/ }));
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByRole('heading', { name: 'Collection' });
  expect((await loadAll()).corrections).toEqual({});
});

it('clears an old correction when its box is emptied', async () => {
  const user = userEvent.setup();
  await saveCorrection('1-3-001', { stats: { attack: 150 } });
  renderScreen();
  await user.click(await screen.findByRole('button', { name: /^Lugia 1-3-001/ }));
  await user.clear(screen.getByLabelText('Attack'));
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByRole('heading', { name: 'Collection' });
  expect((await loadAll()).corrections).toEqual({});
});

it('keeps a second edit on top of an earlier one', async () => {
  const user = userEvent.setup();
  await saveCorrection('1-3-001', { stats: { attack: 150 } });
  renderScreen();
  await user.click(await screen.findByRole('button', { name: /^Lugia 1-3-001/ }));
  await user.type(screen.getByLabelText('HP'), '900');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByRole('heading', { name: 'Collection' });
  expect((await loadAll()).corrections).toEqual({ '1-3-001': { stats: { attack: 150, hp: 900 } } });
});

it('rejects decimals and negatives with an alert', async () => {
  const user = userEvent.setup();
  renderScreen();
  await user.click(await screen.findByRole('button', { name: /^Lugia 1-3-001/ }));
  await user.type(screen.getByLabelText('Attack'), '1.5');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Attack must be a whole number, 0 or more.');
});

it('moves focus to the editor heading, then back to the tag row', async () => {
  const user = userEvent.setup();
  renderScreen();
  await user.click(await screen.findByRole('button', { name: /^Lugia 1-3-001/ }));
  expect(screen.getByRole('heading', { name: /Lugia/ })).toHaveFocus();
  await user.click(screen.getByRole('button', { name: /Back/ }));
  expect(screen.getByRole('button', { name: /^Lugia 1-3-001/ })).toHaveFocus();
});

it('groups the filter buttons', async () => {
  renderScreen();
  expect(await screen.findByRole('group', { name: 'Show tags' })).toBeInTheDocument();
});

it('keeps the tag editor open when saving fails', async () => {
  const user = userEvent.setup();
  const spy = vi.spyOn(dbModule, 'saveCorrection').mockRejectedValueOnce(new Error('disk full'));
  renderScreen();
  await user.click(await screen.findByRole('button', { name: /^Lugia 1-3-001/ }));
  await user.type(screen.getByLabelText('Attack'), '150');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await vi.waitFor(() => expect(spy).toHaveBeenCalled());
  await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled());
  expect(screen.getByRole('heading', { level: 1, name: /Lugia/ })).toBeInTheDocument();
  expect(screen.getByLabelText('Attack')).toHaveValue(150);
  vi.restoreAllMocks();
});
