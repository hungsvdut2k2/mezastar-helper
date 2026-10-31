import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { loadAll, setOwned } from '../storage/db';
import { freshDb } from '../test/freshDb';
import { WithStore } from './testHarness';

beforeEach(freshDb);

it('loads saved data and applies corrections to tags', async () => {
  await setOwned('1-3-001', true);
  render(
    <WithStore>
      {(store) => (
        <p>
          {store.data.owned.join(',')} {store.tags.length}
        </p>
      )}
    </WithStore>,
  );
  expect(await screen.findByText('1-3-001 73')).toBeInTheDocument();
});

it('saves a toggle to storage', async () => {
  const user = userEvent.setup();
  render(
    <WithStore>
      {(store) => (
        <button type="button" onClick={() => store.toggleOwned('1-3-002')}>
          owned: {store.data.owned.length}
        </button>
      )}
    </WithStore>,
  );
  await user.click(await screen.findByRole('button', { name: 'owned: 0' }));
  expect(await screen.findByRole('button', { name: 'owned: 1' })).toBeInTheDocument();
  expect((await loadAll()).owned).toEqual(['1-3-002']);
});
