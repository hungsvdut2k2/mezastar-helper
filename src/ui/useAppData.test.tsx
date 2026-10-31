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
    const e = makeLogEntry({ id: 'e3', location: 'Tokyo' });
    const retry = { ...e, location: 'Osaka' };
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
              results.push(store.addLog(e), store.addLog(retry));
            }}
          >
            {`log: ${store.data.log.map((l) => l.location).join(',') || 'none'}`}
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
    // The first version is stored, so the failed newer one rolls back to it (not to nothing, not to the failed text).
    expect(screen.getByRole('button', { name: 'log: Tokyo' })).toBeInTheDocument();
  });

  it('removes the entry when two concurrent saves with the same id both fail', async () => {
    const e = makeLogEntry({ id: 'e5', location: 'Tokyo' });
    vi.spyOn(dbModule, 'addLogEntry').mockRejectedValue(new Error('x'));
    const results: Promise<boolean>[] = [];
    render(
      <WithStore>
        {(store) => (
          <button
            type="button"
            onClick={() => {
              results.push(store.addLog(e), store.addLog({ ...e, location: 'Osaka' }));
            }}
          >
            {`log: ${store.data.log.map((l) => l.location).join(',') || 'none'}`}
          </button>
        )}
      </WithStore>,
    );
    await userEvent.setup().click(await screen.findByRole('button', { name: 'log: none' }));
    let outcomes: boolean[] = [];
    await act(async () => {
      outcomes = await Promise.all(results);
    });
    expect(outcomes).toEqual([false, false]);
    expect(screen.getByRole('button', { name: 'log: none' })).toBeInTheDocument();
  });

  it('restores the removed entry when deleting fails', async () => {
    const e = makeLogEntry({ id: 'e6', location: 'Kyoto' });
    await dbModule.addLogEntry(e);
    vi.spyOn(dbModule, 'deleteLogEntry').mockRejectedValue(new Error('x'));
    render(
      <WithStore>
        {(store) => (
          <button type="button" onClick={() => store.deleteLog('e6')}>
            {`log: ${store.data.log.map((l) => l.location).join(',') || 'none'}`}
          </button>
        )}
      </WithStore>,
    );
    await userEvent.setup().click(await screen.findByRole('button', { name: 'log: Kyoto' }));
    await waitFor(() => expect(vi.mocked(dbModule.deleteLogEntry)).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('button', { name: 'log: Kyoto' })).toBeInTheDocument());
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

describe('photos', () => {
  const blob = (s: string) => new Blob([s], { type: 'image/jpeg' });
  let n = 0;
  let created: string[];
  let revoked: string[];
  beforeEach(() => {
    created = [];
    revoked = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      const url = `blob:t/${++n}`;
      created.push(url);
      return url;
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation((u) => void revoked.push(u));
  });

  function Probe({ store }: { store: import('./useAppData').AppStore }) {
    return (
      <>
        <p data-testid="url">{store.photos.get('1-3-001') ?? 'none'}</p>
        <p>{store.error ?? 'no error'}</p>
        <button type="button" onClick={() => store.setPhoto('1-3-001', blob('a'))}>set</button>
        <button type="button" onClick={() => store.removePhoto('1-3-001')}>remove</button>
      </>
    );
  }

  it('adds, replaces (revoking the old URL) and removes a photo', async () => {
    const user = userEvent.setup();
    render(<WithStore>{(store) => <Probe store={store} />}</WithStore>);
    await screen.findByTestId('url');
    await user.click(screen.getByRole('button', { name: 'set' }));
    await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent(created[0]));
    expect(Object.keys(await dbModule.getAllPhotos())).toEqual(['1-3-001']);
    await user.click(screen.getByRole('button', { name: 'set' }));
    await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent(created[1]));
    expect(revoked).toEqual([created[0]]);
    await user.click(screen.getByRole('button', { name: 'remove' }));
    await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('none'));
    expect(revoked).toEqual([created[0], created[1]]);
    expect(await dbModule.getAllPhotos()).toEqual({});
  });

  it('loads stored photos and revokes them on unmount', async () => {
    await dbModule.putPhoto('1-3-001', blob('a'));
    const { unmount } = render(<WithStore>{(store) => <Probe store={store} />}</WithStore>);
    await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent(/^blob:t/));
    const shown = created[created.length - 1];
    unmount();
    expect(revoked).toContain(shown);
  });

  it('shows an error and no picture when saving fails', async () => {
    const user = userEvent.setup();
    vi.spyOn(dbModule, 'putPhoto').mockRejectedValueOnce(new Error('full'));
    render(<WithStore>{(store) => <Probe store={store} />}</WithStore>);
    await user.click(await screen.findByRole('button', { name: 'set' }));
    expect(await screen.findByText('Your photo was not saved.')).toBeInTheDocument();
    expect(screen.getByTestId('url')).toHaveTextContent('none');
  });

  it('restore replaces photos and revokes the old URLs', async () => {
    const user = userEvent.setup();
    const png = `data:image/png;base64,${btoa('hello')}`;
    const text = JSON.stringify({
      app: 'mezastar-helper', version: 1, owned: [], corrections: {}, notes: {}, log: [], photos: { '1-3-001': png },
    });
    render(
      <WithStore>
        {(store) => (
          <>
            <Probe store={store} />
            <button type="button" onClick={() => store.restore(text)}>restore</button>
          </>
        )}
      </WithStore>,
    );
    await user.click(await screen.findByRole('button', { name: 'set' }));
    await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent(created[0]));
    await user.click(screen.getByRole('button', { name: 'restore' }));
    await waitFor(() => expect(created).toHaveLength(2));
    await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent(created[1]));
    expect(revoked).toContain(created[0]);
  });
});
