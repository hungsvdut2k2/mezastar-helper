import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { freshDb } from '../../test/freshDb';
import { WithStore } from '../testHarness';
import { CollectionScreen } from './CollectionScreen';

beforeEach(freshDb);

const renderScreen = () => render(<WithStore>{(store) => <CollectionScreen store={store} />}</WithStore>);

it('toggles owned and keeps it after reopening', async () => {
  const user = userEvent.setup();
  const { unmount } = renderScreen();
  await screen.findByText('Owned 0 / 73');
  await user.click(screen.getByRole('button', { name: 'Not owned: Lugia 1-3-001' }));
  expect(await screen.findByText('Owned 1 / 73')).toBeInTheDocument();
  unmount();
  renderScreen();
  expect(await screen.findByText('Owned 1 / 73')).toBeInTheDocument();
});

it('searches by name or number', async () => {
  const user = userEvent.setup();
  renderScreen();
  await user.type(await screen.findByPlaceholderText('Search name or number'), '1-3-045');
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
