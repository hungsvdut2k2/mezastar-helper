import { useMemo, useState, type ChangeEvent } from 'react';
import { computeStats, type Rate } from '../../engine/stats';
import { makeBackup } from '../../storage/backup';
import { percent } from '../format';
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

export function StatsScreen({ store }: { store: AppStore }) {
  const stats = useMemo(() => computeStats(store.data.log, store.tags), [store.data.log, store.tags]);
  const [message, setMessage] = useState<string | null>(null);
  const nameOf = (id: string | null) => store.tags.find((t) => t.id === id)?.name ?? 'nothing';

  function backup() {
    const json = JSON.stringify(makeBackup(store.data), null, 2);
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `mezastar-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function restore(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const result = await store.restore(await readFileText(file));
    setMessage(result.ok ? 'Backup restored.' : `Restore failed: ${result.error} Nothing was changed.`);
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
            <span>{`${e.date.slice(0, 10)} · Boss ${nameOf(e.boss)} · caught ${nameOf(e.caught)}`}</span>
            <button type="button" aria-label={`Delete play ${e.date.slice(0, 10)} ${nameOf(e.boss)}`} onClick={() => store.deleteLog(e.id)}>
              ✕
            </button>
          </li>
        ))}
      </ul>

      <h2>Backup</h2>
      <p className="hint">Save a backup to Files or iCloud Drive now and then. Data lives only on this phone.</p>
      <div className="actions">
        <button type="button" className="primary" onClick={backup}>
          Save backup
        </button>
        <label className="file-button">
          Restore from backup
          <input type="file" accept="application/json,.json" onChange={restore} />
        </label>
      </div>
      {message && <p className="notice">{message}</p>}
    </section>
  );
}
