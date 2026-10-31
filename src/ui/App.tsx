import { useEffect, useState, type ReactNode } from 'react';
import { setById } from '../data/setInfo';
import { StarBadge, TAB_ICONS } from './components/icons';
import { CollectionScreen } from './screens/CollectionScreen';
import { GuideScreen } from './screens/GuideScreen';
import { PlanScreen } from './screens/PlanScreen';
import { PlayScreen } from './screens/PlayScreen';
import { StatsScreen } from './screens/StatsScreen';
import { DEFAULT_SET } from './setChoices';
import { useAppData } from './useAppData';

type TabId = 'play' | 'plan' | 'collection' | 'guide' | 'stats';

/** The machine set the app is tuned for. There is no global setting yet, so this is the default set. */
const MACHINE_SET = DEFAULT_SET === 'all' ? null : setById(DEFAULT_SET);

const TABS: { id: TabId; label: string }[] = [
  { id: 'play', label: 'Play' },
  { id: 'plan', label: 'Plan' },
  { id: 'collection', label: 'Collection' },
  { id: 'guide', label: 'Guide' },
  { id: 'stats', label: 'Stats' },
];

/** Every screen stays mounted so typed input survives a tab switch; the inactive ones are only hidden. */
function Pane({ active, children }: { active: boolean; children: ReactNode }) {
  return <div hidden={!active}>{children}</div>;
}

export function App() {
  const store = useAppData();
  const [tab, setTab] = useState<TabId>('play');

  // Ask the browser not to evict our data under storage pressure; the answer does not matter.
  useEffect(() => {
    try {
      void navigator.storage?.persist?.()?.catch(() => {});
    } catch {
      // ignore
    }
  }, []);

  // The panes share one page, so a new tab would otherwise open at the old scroll position.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <StarBadge className="logo" />
          <p className="brand">
            <span className="brand-1">MEZASTAR</span> <span className="brand-2">HELPER</span>
          </p>
          {MACHINE_SET && (
            <span className="machine-chip">
              <span aria-hidden="true">★</span> <span className="sr-only">Machine set:</span> {MACHINE_SET.name}
            </span>
          )}
        </div>
        {store.error && (
          <p className="error banner" role="alert">
            {store.error}{' '}
            <button type="button" onClick={store.dismissError}>
              OK
            </button>
          </p>
        )}
      </header>
      <main>
        {!store.loaded ? (
          <p>Loading…</p>
        ) : (
          <>
            <Pane active={tab === 'play'}>
              <PlayScreen store={store} />
            </Pane>
            <Pane active={tab === 'plan'}>
              <PlanScreen store={store} />
            </Pane>
            <Pane active={tab === 'collection'}>
              <CollectionScreen store={store} />
            </Pane>
            <Pane active={tab === 'guide'}>
              <GuideScreen store={store} />
            </Pane>
            <Pane active={tab === 'stats'}>
              <StatsScreen store={store} />
            </Pane>
          </>
        )}
      </main>
      <nav className="tabbar" aria-label="Main">
        {TABS.map((t) => {
          const Icon = TAB_ICONS[t.id];
          return (
            <button key={t.id} type="button" aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
              <Icon />
              <span>{t.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
