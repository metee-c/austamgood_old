/**
 * useOfflineTransfer - Hook สำหรับจัดการ Transfer แบบ Offline-First
 * 
 * Features:
 * - Cache pallet และ location data
 * - ทำงานได้แม้ไม่มี internet
 * - Auto sync เมื่อกลับมา online
 * - แสดงสถานะ sync
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  cachePalletData,
  getCachedPallet,
  cacheAllLocations,
  getCachedLocations,
  getCachedLocationByCode,
  cacheReplenishmentTasks,
  getCachedReplenishmentTasks,
  updateCachedTaskStatus,
  createPendingMove,
  getPendingMoves,
  queueTaskStatusUpdate,
  PendingMove,
} from '@/lib/offline/transfer-cache';
import {
  syncPendingItems,
  onSyncStatusChange,
  setupNetworkListeners,
  SyncStatus,
  SyncResult,
  getSyncQueueCount,
} from '@/lib/offline/sync-manager';

export interface UseOfflineTransferOptions {
  autoSync?: boolean;
  syncInterval?: number;
}

export interface OfflineTransferState {
  isOnline: boolean;
  isSyncing: boolean;
  syncStatus: SyncStatus;
  pendingCount: number;
  lastSyncResult: SyncResult | null;
  pendingMoves: PendingMove[];
}

export function useOfflineTransfer(options: UseOfflineTransferOptions = {}) {
  const { autoSync = true, syncInterval = 30000 } = options;

  const [state, setState] = useState<OfflineTransferState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isSyncing: false,
    syncStatus: 'idle',
    pendingCount: 0,
    lastSyncResult: null,
    pendingMoves: [],
  });

  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Update online status
  useEffect(() => {
    const handleOnline = () => setState((s) => ({ ...s, isOnline: true }));
    const handleOffline = () => setState((s) => ({ ...s, isOnline: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Setup sync status listener
  useEffect(() => {
    const unsubscribe = onSyncStatusChange((status, result) => {
      setState((s) => ({
        ...s,
        syncStatus: status,
        isSyncing: status === 'syncing',
        lastSyncResult: result || s.lastSyncResult,
      }));
    });

    return unsubscribe;
  }, []);

  // Setup network listeners and auto sync
  useEffect(() => {
    if (autoSync) {
      cleanupRef.current = setupNetworkListeners();

      // Periodic sync check
      syncIntervalRef.current = setInterval(async () => {
        if (navigator.onLine) {
          const count = await getSyncQueueCount();
          if (count > 0) {
            await syncPendingItems();
          }
        }
      }, syncInterval);
    }

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [autoSync, syncInterval]);

  // Update pending count
  const updatePendingCount = useCallback(async () => {
    const count = await getSyncQueueCount();
    const moves = await getPendingMoves();
    setState((s) => ({ ...s, pendingCount: count, pendingMoves: moves }));
  }, []);

  useEffect(() => {
    updatePendingCount();
    const interval = setInterval(updatePendingCount, 5000);
    return () => clearInterval(interval);
  }, [updatePendingCount]);

  /**
   * Fetch pallet data (with offline fallback)
   */
  const fetchPalletData = useCallback(async (palletId: string): Promise<{
    data: any[] | null;
    fromCache: boolean;
    error?: string;
  }> => {
    // Try online first
    if (navigator.onLine) {
      try {
        const response = await fetch(
          `/api/inventory/balances?pallet_id=${encodeURIComponent(palletId.trim())}`
        );
        const result = await response.json();

        if (result.error || !result.data || result.data.length === 0) {
          // Check cache as fallback
          const cached = await getCachedPallet(palletId);
          if (cached) {
            return { data: cached, fromCache: true };
          }
          return { data: null, fromCache: false, error: `ไม่พบ Pallet ID: ${palletId}` };
        }

        // Filter and cache
        const filteredData = result.data.filter((item: any) => item.total_piece_qty > 0);
        if (filteredData.length > 0) {
          await cachePalletData(palletId, filteredData);
        }

        return { data: filteredData, fromCache: false };
      } catch (error) {
        // Network error - try cache
        const cached = await getCachedPallet(palletId);
        if (cached) {
          return { data: cached, fromCache: true };
        }
        return { data: null, fromCache: false, error: 'ไม่สามารถเชื่อมต่อ server ได้' };
      }
    } else {
      // Offline - use cache
      const cached = await getCachedPallet(palletId);
      if (cached) {
        return { data: cached, fromCache: true };
      }
      return { data: null, fromCache: true, error: 'ไม่มีข้อมูล Pallet ใน cache (Offline)' };
    }
  }, []);

  /**
   * Fetch locations (with offline fallback)
   */
  const fetchLocations = useCallback(async (): Promise<{
    data: any[];
    fromCache: boolean;
    error?: string;
  }> => {
    // Try online first
    if (navigator.onLine) {
      try {
        const response = await fetch('/api/master-location');
        const result = await response.json();

        if (result.error) {
          const cached = await getCachedLocations();
          if (cached.length > 0) {
            return { data: cached, fromCache: true };
          }
          return { data: [], fromCache: false, error: result.error };
        }

        const locations = result.data || result || [];
        
        // Cache for offline use
        if (locations.length > 0) {
          await cacheAllLocations(locations);
        }

        return { data: locations, fromCache: false };
      } catch (error) {
        const cached = await getCachedLocations();
        if (cached.length > 0) {
          return { data: cached, fromCache: true };
        }
        return { data: [], fromCache: false, error: 'ไม่สามารถเชื่อมต่อ server ได้' };
      }
    } else {
      // Offline - use cache
      const cached = await getCachedLocations();
      if (cached.length > 0) {
        return { data: cached, fromCache: true };
      }
      return { data: [], fromCache: true, error: 'ไม่มีข้อมูล Location ใน cache (Offline)' };
    }
  }, []);

  /**
   * Validate location by scanning (with offline support)
   */
  const validateLocation = useCallback(async (locationCode: string): Promise<{
    valid: boolean;
    location: any | null;
    fromCache: boolean;
    error?: string;
  }> => {
    // Try cache first for faster response
    const cachedLocation = await getCachedLocationByCode(locationCode);
    
    if (navigator.onLine) {
      try {
        const response = await fetch(
          `/api/master-location?location_code=${encodeURIComponent(locationCode)}`
        );
        const result = await response.json();

        if (result.data && result.data.length > 0) {
          return { valid: true, location: result.data[0], fromCache: false };
        }

        // Fallback to cache
        if (cachedLocation) {
          return { valid: true, location: cachedLocation, fromCache: true };
        }

        return { valid: false, location: null, fromCache: false, error: `ไม่พบ Location: ${locationCode}` };
      } catch (error) {
        if (cachedLocation) {
          return { valid: true, location: cachedLocation, fromCache: true };
        }
        return { valid: false, location: null, fromCache: false, error: 'ไม่สามารถตรวจสอบ Location ได้' };
      }
    } else {
      // Offline
      if (cachedLocation) {
        return { valid: true, location: cachedLocation, fromCache: true };
      }
      return { valid: false, location: null, fromCache: true, error: 'ไม่พบ Location ใน cache (Offline)' };
    }
  }, []);

  /**
   * Execute quick move (with offline queue)
   */
  const executeQuickMove = useCallback(async (
    palletId: string,
    toLocationId: string,
    toLocationCode: string,
    palletDetails: any[],
    notes?: string
  ): Promise<{
    success: boolean;
    offline: boolean;
    localId?: string;
    error?: string;
  }> => {
    if (navigator.onLine) {
      try {
        const response = await fetch('/api/moves/quick-move', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Cookie': document.cookie
          },
          credentials: 'include',
          body: JSON.stringify({
            pallet_id: palletId,
            to_location_id: toLocationId,
            notes: notes || 'Quick move from mobile',
          }),
        });

        const result = await response.json();

        if (result.error) {
          return { success: false, offline: false, error: result.error };
        }

        return { success: true, offline: false };
      } catch (error) {
        // Network error - queue for later
        const pendingMove = await createPendingMove({
          pallet_id: palletId,
          to_location_id: toLocationId,
          to_location_code: toLocationCode,
          pallet_details: palletDetails,
          notes,
        });

        await updatePendingCount();

        return { success: true, offline: true, localId: pendingMove.local_id };
      }
    } else {
      // Offline - queue for later
      const pendingMove = await createPendingMove({
        pallet_id: palletId,
        to_location_id: toLocationId,
        to_location_code: toLocationCode,
        pallet_details: palletDetails,
        notes,
      });

      await updatePendingCount();

      return { success: true, offline: true, localId: pendingMove.local_id };
    }
  }, [updatePendingCount]);

  /**
   * Update task status (with offline queue)
   */
  const updateTaskStatus = useCallback(async (
    queueId: string,
    status: string,
    data?: { confirmed_qty?: number; notes?: string }
  ): Promise<{
    success: boolean;
    offline: boolean;
    error?: string;
  }> => {
    // Update local cache immediately
    await updateCachedTaskStatus(queueId, status, data);

    if (navigator.onLine) {
      try {
        const response = await fetch(`/api/mobile/replenishment/tasks/${queueId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status, ...data }),
        });

        const result = await response.json();

        if (!response.ok) {
          return { success: false, offline: false, error: result.error || 'Update failed' };
        }

        return { success: true, offline: false };
      } catch (error) {
        // Queue for later
        await queueTaskStatusUpdate(queueId, status, data);
        await updatePendingCount();
        return { success: true, offline: true };
      }
    } else {
      // Queue for later
      await queueTaskStatusUpdate(queueId, status, data);
      await updatePendingCount();
      return { success: true, offline: true };
    }
  }, [updatePendingCount]);

  /**
   * Manual sync trigger
   */
  const triggerSync = useCallback(async (): Promise<SyncResult> => {
    if (!navigator.onLine) {
      return { success: false, synced: 0, failed: 0, errors: [] };
    }
    const result = await syncPendingItems();
    await updatePendingCount();
    return result;
  }, [updatePendingCount]);

  /**
   * Pre-cache locations for offline use
   */
  const preCacheLocations = useCallback(async (): Promise<boolean> => {
    if (!navigator.onLine) return false;

    try {
      const response = await fetch('/api/master-location');
      const result = await response.json();
      const locations = result.data || result || [];
      
      if (locations.length > 0) {
        await cacheAllLocations(locations);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  return {
    // State
    ...state,

    // Actions
    fetchPalletData,
    fetchLocations,
    validateLocation,
    executeQuickMove,
    updateTaskStatus,
    triggerSync,
    preCacheLocations,
  };
}
