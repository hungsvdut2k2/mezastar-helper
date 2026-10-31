import { useEffect, useState, type ReactNode } from 'react';
import { CollectionScreen } from './screens/CollectionScreen';
import { GuideScreen } from './screens/GuideScreen';
import { PlanScreen } from './screens/PlanScreen';
import { PlayScreen } from './screens/PlayScreen';
import { StatsScreen } from './screens/StatsScreen';
import { useAppData } from './useAppData';

type TabId = 'play' | 'plan' | 'collection' | 'guide' | 'stats';

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

  // The panes share one page, so a new tab would otherwise open at the old scroll position.
  useEffect(() => {
    try {
      window.scrollTo(0, 0);
    } catch {
      // not implemented in every environment (e.g. jsdom)
    }
  }, [tab]);

  return (
    <div className="app">
      {store.error && (
        <p className="error banner" role="alert">
          {store.error}{' '}
          <button type="button" onClick={store.dismissError}>
            OK
          </button>
        </p>
      )}
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
        {TABS.map((t) => (
          <button key={t.id} type="button" aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
