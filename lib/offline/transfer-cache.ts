/**
 * Transfer Cache - จัดการ cache ข้อมูลสำหรับ Mobile Transfer
 */

import {
  openDB,
  putToStore,
  getFromStore,
  getAllFromStore,
  deleteFromStore,
  clearStore,
  addToSyncQueue,
  STORES,
  CachedPallet,
  CachedLocation,
} from './indexed-db';

// Cache duration: 24 hours for locations, 1 hour for pallets
const LOCATION_CACHE_DURATION = 24 * 60 * 60 * 1000;
const PALLET_CACHE_DURATION = 60 * 60 * 1000;

export interface PendingMove {
  local_id: string;
  pallet_id: string;
  to_location_id: string;
  to_location_code: string;
  from_location_id?: string; // ✅ ต้นทางที่ถูกต้อง
  pallet_details: any[];
  notes?: string;
  partial_quantities?: { [skuId: string]: number }; // ✅ สำหรับย้ายบางส่วน
  created_at: number;
  status: 'pending' | 'syncing' | 'synced' | 'error';
  error_message?: string;
}

/**
 * Cache pallet data
 */
export async function cachePalletData(palletId: string, data: any[]): Promise<void> {
  const now = Date.now();
  const cached: CachedPallet = {
    pallet_id: palletId,
    data,
    cached_at: now,
    expires_at: now + PALLET_CACHE_DURATION,
  };
  await putToStore(STORES.PALLET_CACHE, cached);
}

/**
 * Get cached pallet data
 */
export async function getCachedPallet(palletId: string): Promise<any[] | null> {
  const cached = await getFromStore<CachedPallet>(STORES.PALLET_CACHE, palletId);
  
  if (!cached) return null;
  
  // Check if expired
  if (Date.now() > cached.expires_at) {
    await deleteFromStore(STORES.PALLET_CACHE, palletId);
    return null;
  }
  
  return cached.data;
}

/**
 * Cache all locations (for offline use)
 */
export async function cacheAllLocations(locations: any[]): Promise<void> {
  const now = Date.now();
  const expiresAt = now + LOCATION_CACHE_DURATION;

  for (const location of locations) {
    const cached: CachedLocation = {
      location_id: location.location_id,
      location_code: location.location_code,
      data: location,
      cached_at: now,
      expires_at: expiresAt,
    };
    await putToStore(STORES.LOCATION_CACHE, cached);
  }
}

/**
 * Get all cached locations
 */
export async function getCachedLocations(): Promise<any[]> {
  const cached = await getAllFromStore<CachedLocation>(STORES.LOCATION_CACHE);
  const now = Date.now();
  
  // Filter out expired and return data
  return cached
    .filter((item) => item.expires_at > now)
    .map((item) => item.data);
}

/**
 * Get cached location by code
 */
export async function getCachedLocationByCode(code: string): Promise<any | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.LOCATION_CACHE, 'readonly');
    const store = tx.objectStore(STORES.LOCATION_CACHE);
    const index = store.index('location_code');
    const request = index.get(code);

    request.onsuccess = () => {
      const result = request.result as CachedLocation | undefined;
      if (result && result.expires_at > Date.now()) {
        resolve(result.data);
      } else {
        resolve(null);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Cache replenishment tasks
 */
export async function cacheReplenishmentTasks(tasks: any[]): Promise<void> {
  // Clear existing and add new
  await clearStore(STORES.REPLENISHMENT_TASKS);
  for (const task of tasks) {
    await putToStore(STORES.REPLENISHMENT_TASKS, task);
  }
}

/**
 * Get cached replenishment tasks
 */
export async function getCachedReplenishmentTasks(): Promise<any[]> {
  return getAllFromStore(STORES.REPLENISHMENT_TASKS);
}

/**
 * Update cached task status
 */
export async function updateCachedTaskStatus(
  queueId: string,
  status: string,
  data?: { confirmed_qty?: number; notes?: string }
): Promise<void> {
  const task = await getFromStore<any>(STORES.REPLENISHMENT_TASKS, queueId);
  if (task) {
    task.status = status;
    if (data?.confirmed_qty !== undefined) {
      task.confirmed_qty = data.confirmed_qty;
    }
    if (data?.notes !== undefined) {
      task.notes = data.notes;
    }
    task.updated_at = new Date().toISOString();
    await putToStore(STORES.REPLENISHMENT_TASKS, task);
  }
}

/**
 * Create pending move (offline)
 */
export async function createPendingMove(move: Omit<PendingMove, 'local_id' | 'created_at' | 'status'>): Promise<PendingMove> {
  const pendingMove: PendingMove = {
    ...move,
    local_id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    created_at: Date.now(),
    status: 'pending',
  };

  await putToStore(STORES.PENDING_MOVES, pendingMove);

  // Add to sync queue — ✅ รวม partial_quantities และ from_location_id
  await addToSyncQueue({
    url: '/api/moves/quick-move',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    data: {
      pallet_id: move.pallet_id,
      to_location_id: move.to_location_id,
      from_location_id: move.from_location_id || null,
      notes: move.notes || 'Quick move from mobile (offline)',
      partial_quantities: move.partial_quantities || null,
    },
    timestamp: Date.now(),
    retryCount: 0,
    type: 'quick-move',
  });

  return pendingMove;
}

/**
 * Get all pending moves
 */
export async function getPendingMoves(): Promise<PendingMove[]> {
  return getAllFromStore<PendingMove>(STORES.PENDING_MOVES);
}

/**
 * Update pending move status
 */
export async function updatePendingMoveStatus(
  localId: string,
  status: PendingMove['status'],
  errorMessage?: string
): Promise<void> {
  const move = await getFromStore<PendingMove>(STORES.PENDING_MOVES, localId);
  if (move) {
    move.status = status;
    if (errorMessage) {
      move.error_message = errorMessage;
    }
    await putToStore(STORES.PENDING_MOVES, move);
  }
}

/**
 * Remove synced pending move
 */
export async function removePendingMove(localId: string): Promise<void> {
  await deleteFromStore(STORES.PENDING_MOVES, localId);
}

/**
 * Queue task status update for sync
 */
export async function queueTaskStatusUpdate(
  queueId: string,
  status: string,
  data?: { confirmed_qty?: number; notes?: string }
): Promise<void> {
  await addToSyncQueue({
    url: `/api/mobile/replenishment/tasks/${queueId}`,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    data: { status, ...data },
    timestamp: Date.now(),
    retryCount: 0,
    type: 'task-update',
  });
}

/**
 * Clear all transfer cache
 */
export async function clearTransferCache(): Promise<void> {
  await clearStore(STORES.PALLET_CACHE);
  await clearStore(STORES.LOCATION_CACHE);
  await clearStore(STORES.REPLENISHMENT_TASKS);
}
