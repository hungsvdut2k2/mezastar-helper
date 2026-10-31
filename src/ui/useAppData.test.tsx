import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as dbModule from '../storage/db';
import { loadAll, setOwned } from '../storage/db';
import { makeLogEntry } from '../test/factories';
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

describe('addLog when saving fails', () => {
  it('rolls the entry back, and a retry then leaves exactly one entry', async () => {
    const user = userEvent.setup();
    const e = makeLogEntry({ id: 'e1' });
    vi.spyOn(dbModule, 'addLogEntry').mockRejectedValueOnce(new Error('disk full'));
    render(
      <WithStore>
        {(store) => (
          <>
            <button type="button" onClick={() => store.addLog(e)}>
              {`add: ${store.data.log.map((l) => l.id).join(',') || 'none'}`}
            </button>
            <p>{store.error ?? 'no error'}</p>
          </>
        )}
      </WithStore>,
    );
    await user.click(await screen.findByRole('button', { name: 'add: none' }));
    expect(await screen.findByText('Your latest change was not saved.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'add: none' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'add: none' }));
    expect(await screen.findByRole('button', { name: 'add: e1' })).toBeInTheDocument();
    expect((await loadAll()).log.map((l) => l.id)).toEqual(['e1']);
  });

  it('does not duplicate the entry when a retry starts before the first save has failed', async () => {
    const e = makeLogEntry({ id: 'e2' });
    let failFirst!: () => void;
    vi.spyOn(dbModule, 'addLogEntry')
      .mockImplementationOnce(() => new Promise<void>((_, reject) => (failFirst = () => reject(new Error('x')))))
      .mockResolvedValue();
    const results: Promise<boolean>[] = [];
    render(
      <WithStore>
        {(store) => (
          <button
            type="button"
            onClick={() => {
              results.push(store.addLog(e), store.addLog(e));
            }}
          >
            {`log: ${store.data.log.map((l) => l.id).join(',') || 'none'}`}
          </button>
        )}
      </WithStore>,
    );
    await userEvent.setup().click(await screen.findByRole('button', { name: 'log: none' }));
    expect(await screen.findByRole('button', { name: 'log: e2' })).toBeInTheDocument();
    let outcomes: boolean[] = [];
    await act(async () => {
      failFirst();
      outcomes = await Promise.all(results);
    });
    expect(outcomes).toEqual([false, true]);
    // The old failure must not take away the newer, saved attempt.
    expect(screen.getByRole('button', { name: 'log: e2' })).toBeInTheDocument();
  });

  it('keeps the entry when an older save succeeded and a newer one with the same id fails', async () => {
    const e = makeLogEntry({ id: 'e3' });
    let succeedFirst!: () => void;
    let failSecond!: () => void;
    vi.spyOn(dbModule, 'addLogEntry')
      .mockImplementationOnce(() => new Promise<void>((resolve) => (succeedFirst = resolve)))
      .mockImplementationOnce(() => new Promise<void>((_, reject) => (failSecond = () => reject(new Error('x')))));
    const results: Promise<boolean>[] = [];
    render(
      <WithStore>
        {(store) => (
          <button
            type="button"
            onClick={() => {
              results.push(store.addLog(e), store.addLog(e));
            }}
          >
            {`log: ${store.data.log.map((l) => l.id).join(',') || 'none'}`}
          </button>
        )}
      </WithStore>,
    );
    await userEvent.setup().click(await screen.findByRole('button', { name: 'log: none' }));
    let outcomes: boolean[] = [];
    await act(async () => {
      succeedFirst();
      await results[0];
      failSecond();
      outcomes = await Promise.all(results);
    });
    expect(outcomes).toEqual([true, false]);
    // The data is already stored, so the failed retry must not remove it from the screen.
    expect(screen.getByRole('button', { name: 'log: e3' })).toBeInTheDocument();
  });

  it('puts the previous version back when re-saving an existing entry fails', async () => {
    const original = makeLogEntry({ id: 'e4', location: 'Tokyo' });
    await dbModule.addLogEntry(original);
    vi.spyOn(dbModule, 'addLogEntry').mockRejectedValue(new Error('x'));
    render(
      <WithStore>
        {(store) => (
          <button type="button" onClick={() => store.addLog({ ...original, location: 'Osaka' })}>
            {`where: ${store.data.log.map((l) => l.location).join(',')}`}
          </button>
        )}
      </WithStore>,
    );
    await userEvent.setup().click(await screen.findByRole('button', { name: 'where: Tokyo' }));
    await waitFor(() => expect(vi.mocked(dbModule.addLogEntry)).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('button', { name: 'where: Tokyo' })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'where: Osaka' })).not.toBeInTheDocument();
  });
});
