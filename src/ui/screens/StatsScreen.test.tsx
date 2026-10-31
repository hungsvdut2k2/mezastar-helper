import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeBackup } from '../../storage/backup';
import * as dbModule from '../../storage/db';
import { addLogEntry, loadAll, setOwned } from '../../storage/db';
import { localDate } from '../format';
import { makeLogEntry } from '../../test/factories';
import { freshDb } from '../../test/freshDb';
import { WithStore } from '../testHarness';
import { StatsScreen } from './StatsScreen';

beforeEach(freshDb);
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const renderScreen = () => render(<WithStore>{(store) => <StatsScreen store={store} />}</WithStore>);

it('shows numbers from the play log', async () => {
  await addLogEntry(makeLogEntry({ id: 'a', caught: '1-3-001', bossDefeated: true }));
  await addLogEntry(makeLogEntry({ id: 'b' }));
  renderScreen();
  expect(await screen.findByTestId('plays')).toHaveTextContent('2');
  expect(screen.getByTestId('superstars-caught')).toHaveTextContent('1');
  expect(screen.getByTestId('target-catch')).toHaveTextContent('50% (1/2)');
});

it('deletes a log entry', async () => {
  await addLogEntry(makeLogEntry({ id: 'a' }));
  const user = userEvent.setup();
  renderScreen();
  await user.click(await screen.findByRole('button', { name: /^Delete play/ }));
  await user.click(screen.getByRole('button', { name: 'Yes' }));
  expect(await screen.findByTestId('plays')).toHaveTextContent('0');
  expect((await loadAll()).log).toHaveLength(0);
});

it('rejects a bad backup file and changes nothing', async () => {
  await addLogEntry(makeLogEntry({ id: 'a' }));
  const user = userEvent.setup();
  renderScreen();
  const file = new File(['not json'], 'backup.json', { type: 'application/json' });
  await user.upload(await screen.findByLabelText('Restore from backup'), file);
  expect(await screen.findByRole('alert')).toHaveTextContent(/Restore failed/);
  expect((await loadAll()).log).toHaveLength(1);
});

it('keeps the play when the player says No to deleting it', async () => {
  await addLogEntry(makeLogEntry({ id: 'a' }));
  const user = userEvent.setup();
  renderScreen();
  await user.click(await screen.findByRole('button', { name: /^Delete play/ }));
  expect(screen.getByText('Delete this play?')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'No' }));
  expect(screen.getByTestId('plays')).toHaveTextContent('1');
  expect((await loadAll()).log).toHaveLength(1);
});

it('identifies a play by date, location, boss, target and catch', async () => {
  await addLogEntry(makeLogEntry({ id: 'a', location: 'Mall A', caught: '1-3-001' }));
  renderScreen();
  const row = (await screen.findByRole('listitem')).textContent;
  expect(row).toContain('Mall A');
  expect(row).toContain('Boss Lugia');
  expect(row).toContain('target Lugia');
  expect(row).toContain('caught Lugia');
});

describe('restore', () => {
  const backupFile = () => {
    const backup = makeBackup(
      {
        owned: ['1-3-001', '1-3-002', '1-3-008'],
        corrections: {},
        notes: {},
        log: [makeLogEntry({ id: 'x' }), makeLogEntry({ id: 'y', date: '2026-09-01T12:00:00.000Z' })],
        customTags: [],
      },
      new Date(2026, 8, 5, 12),
    );
    return new File([JSON.stringify(backup)], 'backup.json', { type: 'application/json' });
  };

  async function pickBackup() {
    await addLogEntry(makeLogEntry({ id: 'a' }));
    await setOwned('1-3-017', true);
    const user = userEvent.setup();
    renderScreen();
    await user.upload(await screen.findByLabelText('Restore from backup'), backupFile());
    await screen.findByRole('group', { name: 'Confirm restore' });
    return user;
  }

  it('asks before replacing and describes both sides', async () => {
    await pickBackup();
    expect(screen.getByRole('group', { name: 'Confirm restore' })).toHaveTextContent(
      'This backup is from 2026-09-05: 2 plays, 3 owned tags. It will REPLACE your current 1 play and 1 owned tag.',
    );
    expect((await loadAll()).log.map((e) => e.id)).toEqual(['a']);
  });

  it('says how many tag photos the restore replaces', async () => {
    vi.spyOn(dbModule, 'getAllPhotos').mockResolvedValue({ '1-3-001': new Blob(['a']), '1-3-002': new Blob(['b']) });
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() }));
    const backup = makeBackup(
      { owned: [], corrections: {}, notes: {}, log: [], customTags: [] },
      new Date(2026, 8, 5, 12),
      { '1-3-003': `data:image/png;base64,${btoa('hello')}` },
    );
    const user = userEvent.setup();
    renderScreen();
    await user.upload(await screen.findByLabelText('Restore from backup'), new File([JSON.stringify(backup)], 'b.json', { type: 'application/json' }));
    const group = await screen.findByRole('group', { name: 'Confirm restore' });
    expect(group).toHaveTextContent("It will replace your 2 tag photos with the backup's 1.");
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('warns loudly when the backup has no photos but the player has some', async () => {
    vi.spyOn(dbModule, 'getAllPhotos').mockResolvedValue({ '1-3-001': new Blob(['a']), '1-3-002': new Blob(['b']) });
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() }));
    const user = userEvent.setup();
    renderScreen();
    await user.upload(await screen.findByLabelText('Restore from backup'), backupFile());
    const group = await screen.findByRole('group', { name: 'Confirm restore' });
    expect(group).toHaveTextContent("with the backup's 0.");
    expect(screen.getByRole('alert')).toHaveTextContent('This backup has no photos — all 2 of your tag photos will be deleted.');
  });

  it('does not warn when there are no photos to lose', async () => {
    await pickBackup();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('leaves the data unchanged on Cancel', async () => {
    const user = await pickBackup();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('group', { name: 'Confirm restore' })).not.toBeInTheDocument();
    expect(screen.getByTestId('plays')).toHaveTextContent('1');
    const data = await loadAll();
    expect(data.log.map((e) => e.id)).toEqual(['a']);
    expect(data.owned).toEqual(['1-3-017']);
  });

  it('replaces the data on Replace', async () => {
    const user = await pickBackup();
    await user.click(screen.getByRole('button', { name: 'Replace' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Backup restored');
    expect(screen.getByTestId('plays')).toHaveTextContent('2');
    const data = await loadAll();
    expect(data.log.map((e) => e.id).sort()).toEqual(['x', 'y']);
    expect(data.owned.sort()).toEqual(['1-3-001', '1-3-002', '1-3-008']);
  });

  it('offers to save a backup of the current data first, without restoring', async () => {
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const user = await pickBackup();
    await user.click(screen.getByRole('button', { name: 'Save a backup of current data first' }));
    expect(click).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('group', { name: 'Confirm restore' })).toBeInTheDocument();
    expect((await loadAll()).log.map((e) => e.id)).toEqual(['a']);
  });

  it('shows an error when the file cannot be read', async () => {
    class BrokenReader {
      onerror: (() => void) | null = null;
      error = new Error('unreadable');
      readAsText() {
        queueMicrotask(() => this.onerror?.());
      }
    }
    vi.stubGlobal('FileReader', BrokenReader);
    const user = userEvent.setup();
    renderScreen();
    await user.upload(await screen.findByLabelText('Restore from backup'), backupFile());
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not read that file/);
  });
});

describe('backup', () => {
  const stubNavigator = (share: (d: ShareData) => Promise<void>, canShare = true) => {
    Object.defineProperty(navigator, 'canShare', { value: () => canShare, configurable: true });
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
  };
  afterEach(() => {
    delete (navigator as unknown as Record<string, unknown>).canShare;
    delete (navigator as unknown as Record<string, unknown>).share;
  });

  it('opens the share sheet with a File that has a local-date name', async () => {
    const share = vi.fn(async (_d: ShareData) => {});
    stubNavigator(share);
    const user = userEvent.setup();
    renderScreen();
    await user.click(await screen.findByRole('button', { name: 'Save backup' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Backup created');
    const file = share.mock.calls[0][0].files![0];
    expect(file.name).toBe(`mezastar-backup-${localDate(new Date())}.json`);
    expect(file.type).toBe('application/json');
  });

  it('puts tag photos into the backup file and mentions it', async () => {
    vi.spyOn(dbModule, 'getAllPhotos').mockResolvedValue({ '1-3-001': new Blob(['hello'], { type: 'image/png' }) });
    const share = vi.fn(async (_d: ShareData) => {});
    stubNavigator(share);
    const user = userEvent.setup();
    renderScreen();
    expect(await screen.findByText(/Backups include your tag photos/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save backup' }));
    await screen.findByRole('status');
    const text = await share.mock.calls[0][0].files![0].text();
    expect(JSON.parse(text).photos).toEqual({ '1-3-001': `data:image/png;base64,${btoa('hello')}` });
  });

  it('stops with an error, and saves nothing, when the photos cannot be read for the backup', async () => {
    vi.spyOn(dbModule, 'getAllPhotos').mockResolvedValueOnce({}).mockRejectedValue(new Error('x'));
    const share = vi.fn(async (_d: ShareData) => {});
    stubNavigator(share);
    const user = userEvent.setup();
    renderScreen();
    await user.click(await screen.findByRole('button', { name: 'Save backup' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not create the backup: the tag photos could not be read.');
    expect(share).not.toHaveBeenCalled();
  });

  it('treats closing the share sheet as a cancel, not an error', async () => {
    stubNavigator(async () => {
      throw new DOMException('closed', 'AbortError');
    });
    const user = userEvent.setup();
    renderScreen();
    await user.click(await screen.findByRole('button', { name: 'Save backup' }));
    expect(await screen.findByRole('status')).toHaveTextContent(/cancelled/);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('falls back to a download link that is added to the page, clicked, removed and revoked after 60 s', async () => {
    const createObjectURL = vi.fn(() => 'blob:x');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }));
    let attached = false;
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      attached = document.body.contains(this);
    });
    const timers = vi.spyOn(globalThis, 'setTimeout');
    const user = userEvent.setup();
    renderScreen();
    await user.click(await screen.findByRole('button', { name: 'Save backup' }));
    expect(click).toHaveBeenCalledTimes(1);
    expect(attached).toBe(true);
    expect(document.querySelector('a[download]')).toBeNull();
    expect(timers).toHaveBeenCalledWith(expect.any(Function), 60_000);
    expect(await screen.findByRole('status')).toHaveTextContent('Backup file offered for download. Check the Files app.');
    expect(screen.getByRole('status')).not.toHaveTextContent('Backup created');
  });
});
