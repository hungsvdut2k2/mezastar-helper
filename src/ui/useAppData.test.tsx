import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as dbModule from '../storage/db';
import { loadAll, setOwned } from '../storage/db';
import { freshDb } from '../test/freshDb';
import { WithStore } from './testHarness';

beforeEach(freshDb);
afterEach(() => vi.restoreAllMocks());

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

it('shows an error when saving fails, but keeps the change on screen', async () => {
  const user = userEvent.setup();
  vi.spyOn(dbModule, 'setOwned').mockRejectedValueOnce(new Error('disk full'));
  render(
    <WithStore>
      {(store) => (
        <>
          <button type="button" onClick={() => store.toggleOwned('1-3-002')}>
            owned: {store.data.owned.length}
          </button>
          <p>{store.error ?? 'no error'}</p>
        </>
      )}
    </WithStore>,
  );
  await user.click(await screen.findByRole('button', { name: 'owned: 0' }));
  expect(await screen.findByText('Your latest change was not saved.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'owned: 1' })).toBeInTheDocument();
});

it('never duplicates an id on fast double taps', async () => {
  render(
    <WithStore>
      {(store) => (
        <button
          type="button"
          onClick={() => {
            store.toggleOwned('1-3-002');
            store.toggleOwned('1-3-002');
            store.toggleOwned('1-3-002');
          }}
        >
          owned: {store.data.owned.join(',') || 'none'}
        </button>
      )}
    </WithStore>,
  );
  await userEvent.setup().click(await screen.findByRole('button', { name: 'owned: none' }));
  expect(await screen.findByRole('button', { name: 'owned: 1-3-002' })).toBeInTheDocument();
});

it('reports whether a write was saved', async () => {
  let result: { ok: boolean[] } = { ok: [] };
  render(
    <WithStore>
      {(store) => (
        <button
          type="button"
          onClick={async () => {
            result.ok.push(await store.saveNote('lanes', 'a'));
            vi.spyOn(dbModule, 'saveNote').mockRejectedValue(new Error('disk full'));
            result.ok.push(await store.saveNote('lanes', 'b'));
          }}
        >
          go
        </button>
      )}
    </WithStore>,
  );
  await userEvent.setup().click(await screen.findByRole('button', { name: 'go' }));
  await vi.waitFor(() => expect(result.ok).toEqual([true, false]));
});
