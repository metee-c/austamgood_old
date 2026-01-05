/**
 * IndexedDB utilities for offline storage
 * ใช้สำหรับเก็บข้อมูลและ queue actions เมื่อ offline
 */

const DB_NAME = 'mobile-wms-db';
const DB_VERSION = 2;

// Store names
export const STORES = {
  SYNC_QUEUE: 'syncQueue',
  PALLET_CACHE: 'palletCache',
  LOCATION_CACHE: 'locationCache',
  TRANSFER_TASKS: 'transferTasks',
  REPLENISHMENT_TASKS: 'replenishmentTasks',
  PENDING_MOVES: 'pendingMoves',
} as const;

export interface SyncQueueItem {
  id?: number;
  url: string;
  method: string;
  headers: Record<string, string>;
  data: any;
  timestamp: number;
  retryCount: number;
  type: 'quick-move' | 'task-update' | 'move-complete';
}

export interface CachedPallet {
  pallet_id: string;
  data: any[];
  cached_at: number;
  expires_at: number;
}

export interface CachedLocation {
  location_id: string;
  location_code: string;
  data: any;
  cached_at: number;
  expires_at: number;
}

let dbInstance: IDBDatabase | null = null;

/**
 * Open IndexedDB connection
 */
export function openDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open IndexedDB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Sync queue for pending API calls
      if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const syncStore = db.createObjectStore(STORES.SYNC_QUEUE, {
          keyPath: 'id',
          autoIncrement: true,
        });
        syncStore.createIndex('timestamp', 'timestamp', { unique: false });
        syncStore.createIndex('type', 'type', { unique: false });
      }

      // Pallet cache
      if (!db.objectStoreNames.contains(STORES.PALLET_CACHE)) {
        const palletStore = db.createObjectStore(STORES.PALLET_CACHE, {
          keyPath: 'pallet_id',
        });
        palletStore.createIndex('expires_at', 'expires_at', { unique: false });
      }

      // Location cache
      if (!db.objectStoreNames.contains(STORES.LOCATION_CACHE)) {
        const locationStore = db.createObjectStore(STORES.LOCATION_CACHE, {
          keyPath: 'location_id',
        });
        locationStore.createIndex('location_code', 'location_code', { unique: false });
        locationStore.createIndex('expires_at', 'expires_at', { unique: false });
      }

      // Transfer tasks cache
      if (!db.objectStoreNames.contains(STORES.TRANSFER_TASKS)) {
        db.createObjectStore(STORES.TRANSFER_TASKS, { keyPath: 'move_id' });
      }

      // Replenishment tasks cache
      if (!db.objectStoreNames.contains(STORES.REPLENISHMENT_TASKS)) {
        const replenStore = db.createObjectStore(STORES.REPLENISHMENT_TASKS, {
          keyPath: 'queue_id',
        });
        replenStore.createIndex('status', 'status', { unique: false });
      }

      // Pending moves (offline created)
      if (!db.objectStoreNames.contains(STORES.PENDING_MOVES)) {
        const pendingStore = db.createObjectStore(STORES.PENDING_MOVES, {
          keyPath: 'local_id',
        });
        pendingStore.createIndex('created_at', 'created_at', { unique: false });
      }
    };
  });
}

/**
 * Generic get all from store
 */
export async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Generic get by key
 */
export async function getFromStore<T>(storeName: string, key: string | number): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Generic put to store
 */
export async function putToStore<T>(storeName: string, data: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(data);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Generic delete from store
 */
export async function deleteFromStore(storeName: string, key: string | number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear all data from a store
 */
export async function clearStore(storeName: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Add item to sync queue
 */
export async function addToSyncQueue(item: Omit<SyncQueueItem, 'id'>): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
    const store = tx.objectStore(STORES.SYNC_QUEUE);
    const request = store.add(item);

    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all pending sync items
 */
export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  return getAllFromStore<SyncQueueItem>(STORES.SYNC_QUEUE);
}

/**
 * Remove item from sync queue
 */
export async function removeFromSyncQueue(id: number): Promise<void> {
  return deleteFromStore(STORES.SYNC_QUEUE, id);
}

/**
 * Clean expired cache entries
 */
export async function cleanExpiredCache(): Promise<void> {
  const now = Date.now();
  const db = await openDB();

  // Clean pallet cache
  const palletTx = db.transaction(STORES.PALLET_CACHE, 'readwrite');
  const palletStore = palletTx.objectStore(STORES.PALLET_CACHE);
  const palletIndex = palletStore.index('expires_at');
  const palletRange = IDBKeyRange.upperBound(now);
  
  palletIndex.openCursor(palletRange).onsuccess = (event) => {
    const cursor = (event.target as IDBRequest).result;
    if (cursor) {
      cursor.delete();
      cursor.continue();
    }
  };

  // Clean location cache
  const locationTx = db.transaction(STORES.LOCATION_CACHE, 'readwrite');
  const locationStore = locationTx.objectStore(STORES.LOCATION_CACHE);
  const locationIndex = locationStore.index('expires_at');
  const locationRange = IDBKeyRange.upperBound(now);
  
  locationIndex.openCursor(locationRange).onsuccess = (event) => {
    const cursor = (event.target as IDBRequest).result;
    if (cursor) {
      cursor.delete();
      cursor.continue();
    }
  };
}
