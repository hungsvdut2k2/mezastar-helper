import { IDBFactory } from 'fake-indexeddb';
import { resetDbConnection } from '../storage/db';

/** Give each test an empty IndexedDB. */
export function freshDb() {
  // Cast: fake-indexeddb's IDBFactory type is not identical to the DOM one.
  (globalThis as unknown as { indexedDB: unknown }).indexedDB = new IDBFactory();
  resetDbConnection();
}
