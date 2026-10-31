import type { ReactNode } from 'react';
import { useAppData, type AppStore } from './useAppData';

/** Renders a screen with a real store backed by the (fake) IndexedDB. */
export function WithStore({ children }: { children: (store: AppStore) => ReactNode }) {
  const store = useAppData();
  return store.loaded ? <>{children(store)}</> : <p>Loading…</p>;
}
