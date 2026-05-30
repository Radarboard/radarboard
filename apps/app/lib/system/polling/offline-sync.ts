/* biome-ignore-all lint/suspicious/noExplicitAny: offline queue payloads are intentionally transport-agnostic. */
/**
 * Offline Sync Manager
 *
 * Provides an IndexedDB-backed queue for actions performed while offline.
 */

export interface SyncAction {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
}

const DB_NAME = "radarboard-sync";
const STORE_NAME = "queue";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function queueAction(type: string, payload: any) {
  const db = await openDb();
  const action: SyncAction = {
    id: crypto.randomUUID(),
    type,
    payload,
    timestamp: Date.now(),
  };

  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(action);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getSyncQueue(): Promise<SyncAction[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function clearSyncAction(id: string) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
