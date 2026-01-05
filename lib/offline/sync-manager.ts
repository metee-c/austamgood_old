/**
 * Sync Manager - จัดการ sync ข้อมูลเมื่อกลับมา online
 */

import {
  getPendingSyncItems,
  removeFromSyncQueue,
  putToStore,
  STORES,
  SyncQueueItem,
} from './indexed-db';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'success';

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: Array<{ id: number; error: string }>;
}

let isSyncing = false;
let syncListeners: Array<(status: SyncStatus, result?: SyncResult) => void> = [];

/**
 * Register sync status listener
 */
export function onSyncStatusChange(
  listener: (status: SyncStatus, result?: SyncResult) => void
): () => void {
  syncListeners.push(listener);
  return () => {
    syncListeners = syncListeners.filter((l) => l !== listener);
  };
}

/**
 * Notify all listeners
 */
function notifyListeners(status: SyncStatus, result?: SyncResult) {
  syncListeners.forEach((listener) => listener(status, result));
}

/**
 * Check if currently syncing
 */
export function getIsSyncing(): boolean {
  return isSyncing;
}

/**
 * Get sync queue count
 */
export async function getSyncQueueCount(): Promise<number> {
  try {
    const items = await getPendingSyncItems();
    return items.length;
  } catch {
    return 0;
  }
}

/**
 * Sync all pending items
 */
export async function syncPendingItems(): Promise<SyncResult> {
  if (isSyncing) {
    return { success: false, synced: 0, failed: 0, errors: [] };
  }

  if (!navigator.onLine) {
    return { success: false, synced: 0, failed: 0, errors: [] };
  }

  isSyncing = true;
  notifyListeners('syncing');

  const result: SyncResult = {
    success: true,
    synced: 0,
    failed: 0,
    errors: [],
  };

  try {
    const pendingItems = await getPendingSyncItems();

    if (pendingItems.length === 0) {
      isSyncing = false;
      notifyListeners('success', result);
      return result;
    }

    // Sort by timestamp (oldest first)
    pendingItems.sort((a, b) => a.timestamp - b.timestamp);

    for (const item of pendingItems) {
      try {
        const response = await fetch(item.url, {
          method: item.method,
          headers: {
            'Content-Type': 'application/json',
            ...item.headers,
          },
          body: item.data ? JSON.stringify(item.data) : undefined,
        });

        if (response.ok) {
          await removeFromSyncQueue(item.id!);
          result.synced++;
        } else {
          const errorText = await response.text();
          
          // If it's a conflict or validation error, remove from queue
          if (response.status === 409 || response.status === 400) {
            await removeFromSyncQueue(item.id!);
            result.failed++;
            result.errors.push({
              id: item.id!,
              error: `Validation error: ${errorText}`,
            });
          } else {
            // Retry later
            result.failed++;
            result.errors.push({
              id: item.id!,
              error: `HTTP ${response.status}: ${errorText}`,
            });
          }
        }
      } catch (error) {
        result.failed++;
        result.errors.push({
          id: item.id!,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    result.success = result.failed === 0;
    notifyListeners(result.success ? 'success' : 'error', result);
  } catch (error) {
    result.success = false;
    notifyListeners('error', result);
  } finally {
    isSyncing = false;
  }

  return result;
}

/**
 * Register for background sync (if supported)
 */
export async function registerBackgroundSync(): Promise<boolean> {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await (registration as any).sync.register('sync-mobile-actions');
      return true;
    } catch (error) {
      console.error('Background sync registration failed:', error);
      return false;
    }
  }
  return false;
}

/**
 * Setup online/offline listeners
 */
export function setupNetworkListeners(): () => void {
  const handleOnline = async () => {
    console.log('Network online - starting sync...');
    await syncPendingItems();
  };

  const handleOffline = () => {
    console.log('Network offline - queuing enabled');
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Initial sync if online
  if (navigator.onLine) {
    syncPendingItems();
  }

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}
