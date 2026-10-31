import { useMemo, useState, type ChangeEvent } from 'react';
import { computeStats, type Rate } from '../../engine/stats';
import { makeBackup, parseBackup } from '../../storage/backup';
import type { AppData } from '../../storage/db';
import { localDate, percent } from '../format';
import type { AppStore } from '../useAppData';

const showRate = (r: Rate) => (r.rate === null ? '—' : `${percent(r.rate)} (${r.caught}/${r.count})`);

function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function Row({ label, value, testId }: { label: string; value: string | number; testId?: string }) {
  return (
    <tr>
      <th scope="row">{label}</th>
      <td data-testid={testId}>{value}</td>
    </tr>
  );
}

type Message = { kind: 'ok' | 'error'; text: string };
type PendingRestore = { text: string; data: AppData; photoCount: number; exportedAt: string | null };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';
const timeOf = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export function StatsScreen({ store }: { store: AppStore }) {
  const stats = useMemo(() => computeStats(store.data.log, store.tags), [store.data.log, store.tags]);
  const [message, setMessage] = useState<Message | null>(null);
  const [pending, setPending] = useState<PendingRestore | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const nameOf = (id: string | null) => store.tags.find((t) => t.id === id)?.name ?? 'nothing';

  async function backup() {
    let photos: Record<string, string>;
    try {
      photos = await store.exportPhotos();
    } catch {
      setMessage({ kind: 'error', text: 'Could not create the backup: the tag photos could not be read.' });
      return;
    }
    const json = JSON.stringify(makeBackup(store.data, new Date(), photos), null, 2);
    const file = new File([json], `mezastar-backup-${localDate(new Date())}.json`, { type: 'application/json' });
    // On iPhone the share sheet has "Save to Files"; a plain download link is the fallback.
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        setMessage({ kind: 'ok', text: 'Backup created.' });
        return;
      } catch (e) {
        if (isAbort(e)) {
          setMessage({ kind: 'ok', text: 'Backup cancelled. Nothing was saved.' });
          return;
        }
        // Any other sharing problem: try a normal download instead.
      }
    }
    try {
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setMessage({ kind: 'ok', text: 'Backup file offered for download. Check the Files app.' });
    } catch {
      setMessage({ kind: 'error', text: 'Could not create the backup.' });
    }
  }

  async function pickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setMessage(null);
    setPending(null);
    let text: string;
    try {
      text = await readFileText(file);
    } catch {
      setMessage({ kind: 'error', text: 'Restore failed: could not read that file. Nothing was changed.' });
      return;
    }
    const parsed = parseBackup(text);
    if (!parsed.ok) {
      setMessage({ kind: 'error', text: `Restore failed: ${parsed.error} Nothing was changed.` });
      return;
    }
    let exportedAt: string | null = null;
    try {
      const raw = JSON.parse(text) as { exportedAt?: unknown };
      if (typeof raw.exportedAt === 'string') exportedAt = raw.exportedAt;
    } catch {
      // parseBackup already accepted the text, so this cannot happen; keep the date unknown.
    }
    setPending({ text, data: parsed.data, photoCount: Object.keys(parsed.photos).length, exportedAt });
  }

  async function replace() {
    if (!pending) return;
    const { text } = pending;
    setPending(null);
    const result = await store.restore(text);
    setMessage(
      result.ok
        ? { kind: 'ok', text: 'Backup restored.' }
        : { kind: 'error', text: `Restore failed: ${result.error} Nothing was changed.` },
    );
  }

  function describe(e: (typeof store.data.log)[number]) {
    const when = `${localDate(e.date)} ${timeOf(e.date)}`.trim();
    const where = e.location ? ` · ${e.location}` : '';
    return `${when}${where} · Boss ${nameOf(e.boss)} · target ${nameOf(e.target)} · caught ${nameOf(e.caught)}`;
  }

  return (
    <section>
      <h1>Stats</h1>
      <table className="stats">
        <tbody>
          <Row label="Plays" value={stats.plays} testId="plays" />
          <Row label="Boss defeated" value={stats.wins} />
          <Row label="Caught anything" value={stats.catches} />
          <Row label="Caught your target" value={showRate(stats.targetCatch)} testId="target-catch" />
          <Row label="…when you beat the Boss" value={showRate(stats.whenWon)} />
          <Row label="…when you didn't" value={showRate(stats.whenLost)} />
          <Row label="…when a crony was defeated" value={showRate(stats.cronyDefeated)} />
          <Row label="…when no crony was defeated" value={showRate(stats.noCronyDefeated)} />
          <Row label="Catch now plays" value={showRate(stats.catchNow)} />
          <Row label="Superstars seen" value={stats.superstarsSeen} />
          <Row label="Superstars caught" value={stats.superstarsCaught} testId="superstars-caught" />
          {stats.byTargetGrade.map((g) => (
            <Row key={g.grade} label={`Target ${g.grade}`} value={showRate(g.rate)} />
          ))}
          <Row
            label="Plan's one-hit predictions right"
            value={stats.predictions.rate === null ? '—' : `${percent(stats.predictions.rate)} (${stats.predictions.correct}/${stats.predictions.checked})`}
          />
        </tbody>
      </table>

      {stats.byLocation.length > 0 && (
        <>
          <h2>Superstars by location</h2>
          <table className="stats">
            <tbody>
              {stats.byLocation.map((l) => (
                <Row key={l.location} label={l.location} value={`${l.superstarsSeen} in ${l.plays} plays`} />
              ))}
            </tbody>
          </table>
        </>
      )}

      <h2>Play log</h2>
      <ul className="log">
        {store.data.log.map((e) => (
          <li key={e.id}>
            <span>{describe(e)}</span>
            {confirmingDelete === e.id ? (
              <span role="group" aria-label="Confirm delete">
                Delete this play?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingDelete(null);
                    store.deleteLog(e.id);
                  }}
                >
                  Yes
                </button>{' '}
                <button type="button" onClick={() => setConfirmingDelete(null)}>
                  No
                </button>
              </span>
            ) : (
              <button type="button" aria-label={`Delete play ${describe(e)}`} onClick={() => setConfirmingDelete(e.id)}>
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>

      <h2>Backup</h2>
      <p className="hint">Save a backup to Files or iCloud Drive now and then. Data lives only on this phone.</p>
      <p className="hint">Backups include your tag photos, so the file may be larger.</p>
      <div className="actions">
        <button type="button" className="primary" onClick={backup}>
          Save backup
        </button>
        <label className="file-button">
          Restore from backup
          <input type="file" accept="application/json,.json" onChange={pickFile} />
        </label>
      </div>
      {pending && (
        <div className="notice" role="group" aria-label="Confirm restore">
          <p>
            {`This backup is from ${pending.exportedAt ? localDate(pending.exportedAt) : 'an unknown date'}: ${plural(pending.data.log.length, 'play')}, ${plural(pending.data.owned.length, 'owned tag')}. It will REPLACE your current ${plural(store.data.log.length, 'play')} and ${plural(store.data.owned.length, 'owned tag')}.`}
          </p>
          {!store.photosLoadFailed && (
            <p>{`It will replace your ${plural(store.photos.size, 'tag photo')} with the backup's ${pending.photoCount}.`}</p>
          )}
          {store.photosLoadFailed && (
            <p className="error" role="alert">
              <strong>Your existing tag photos may be deleted.</strong>
            </p>
          )}
          {pending.photoCount === 0 && store.photos.size > 0 && (
            <p className="error" role="alert">
              <strong>{`This backup has no photos — all ${store.photos.size} of your tag photos will be deleted.`}</strong>
            </p>
          )}
          <div className="actions">
            <button type="button" onClick={backup}>
              Save a backup of current data first
            </button>
            <button type="button" className="primary" onClick={replace}>
              Replace
            </button>
            <button
              type="button"
              onClick={() => {
                setPending(null);
                setMessage({ kind: 'ok', text: 'Restore cancelled. Nothing was changed.' });
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {message && (
        <p className={message.kind === 'error' ? 'error' : 'notice'} role={message.kind === 'error' ? 'alert' : 'status'}>
          {message.text}
        </p>
      )}
    </section>
  );
}
