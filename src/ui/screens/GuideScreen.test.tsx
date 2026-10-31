import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { loadAll } from '../../storage/db';
import { freshDb } from '../../test/freshDb';
import { WithStore } from '../testHarness';
import { GuideScreen } from './GuideScreen';

beforeEach(freshDb);

it('groups mechanics by trust level', async () => {
  render(<WithStore>{(store) => <GuideScreen store={store} />}</WithStore>);
  expect(await screen.findByText('Tiredness')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Official' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Community tip' })).toBeInTheDocument();
});

it('saves the player\'s answer to an open question', async () => {
  const user = userEvent.setup();
  render(<WithStore>{(store) => <GuideScreen store={store} />}</WithStore>);
  await user.type(await screen.findByLabelText(/How many tags can you place/), 'Three lanes');
  await user.click(screen.getAllByRole('button', { name: 'Save answer' })[0]);
  expect(await screen.findByText('Saved')).toBeInTheDocument();
  expect((await loadAll()).notes.lanes).toBe('Three lanes');
});
