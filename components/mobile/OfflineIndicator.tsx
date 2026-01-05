'use client';

import React from 'react';
import { Wifi, WifiOff, Cloud, CloudOff, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { SyncStatus } from '@/lib/offline/sync-manager';

interface OfflineIndicatorProps {
  isOnline: boolean;
  isSyncing: boolean;
  syncStatus: SyncStatus;
  pendingCount: number;
  onSync?: () => void;
  compact?: boolean;
}

export function OfflineIndicator({
  isOnline,
  isSyncing,
  syncStatus,
  pendingCount,
  onSync,
  compact = false,
}: OfflineIndicatorProps) {
  if (compact) {
    // Compact version for header
    return (
      <div className="flex items-center gap-1">
        {!isOnline && (
          <div className="flex items-center gap-1 px-2 py-1 bg-red-500 text-white rounded-full text-xs font-semibold">
            <WifiOff className="w-3 h-3" />
            <span>Offline</span>
          </div>
        )}
        {pendingCount > 0 && (
          <button
            onClick={onSync}
            disabled={!isOnline || isSyncing}
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold transition-colors ${
              isSyncing
                ? 'bg-blue-500 text-white'
                : isOnline
                ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                : 'bg-gray-400 text-white'
            }`}
          >
            {isSyncing ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <Cloud className="w-3 h-3" />
            )}
            <span>{pendingCount}</span>
          </button>
        )}
      </div>
    );
  }

  // Full version
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
      {/* Connection Status */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isOnline ? (
            <>
              <Wifi className="w-5 h-5 text-green-500" />
              <span className="text-sm font-medium text-green-600 font-thai">เชื่อมต่อแล้ว</span>
            </>
          ) : (
            <>
              <WifiOff className="w-5 h-5 text-red-500" />
              <span className="text-sm font-medium text-red-600 font-thai">ไม่มีสัญญาณ</span>
            </>
          )}
        </div>

        {/* Sync Status */}
        {pendingCount > 0 && (
          <div className="flex items-center gap-2">
            {isSyncing ? (
              <div className="flex items-center gap-1 text-blue-600">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span className="text-xs font-thai">กำลัง sync...</span>
              </div>
            ) : syncStatus === 'success' ? (
              <div className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-xs font-thai">Sync สำเร็จ</span>
              </div>
            ) : syncStatus === 'error' ? (
              <div className="flex items-center gap-1 text-red-600">
                <AlertCircle className="w-4 h-4" />
                <span className="text-xs font-thai">Sync ล้มเหลว</span>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Pending Items */}
      {pendingCount > 0 && (
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <CloudOff className="w-4 h-4 text-yellow-500" />
            <span className="text-sm text-gray-600 font-thai">
              รอ sync: <span className="font-semibold text-yellow-600">{pendingCount}</span> รายการ
            </span>
          </div>

          {isOnline && !isSyncing && (
            <button
              onClick={onSync}
              className="px-3 py-1 bg-blue-500 text-white text-xs font-semibold rounded-lg hover:bg-blue-600 transition-colors font-thai"
            >
              Sync ตอนนี้
            </button>
          )}
        </div>
      )}

      {/* Offline Mode Info */}
      {!isOnline && (
        <div className="mt-2 p-2 bg-yellow-50 rounded-lg">
          <p className="text-xs text-yellow-700 font-thai">
            📱 โหมด Offline: สามารถสแกนและทำงานได้ตามปกติ ข้อมูลจะถูกบันทึกเมื่อกลับมา Online
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Floating offline banner
 */
export function OfflineBanner({ isOnline, pendingCount }: { isOnline: boolean; pendingCount: number }) {
  if (isOnline && pendingCount === 0) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 px-4 py-2 text-center text-sm font-semibold font-thai ${
        !isOnline
          ? 'bg-red-500 text-white'
          : 'bg-yellow-500 text-white'
      }`}
    >
      {!isOnline ? (
        <div className="flex items-center justify-center gap-2">
          <WifiOff className="w-4 h-4" />
          <span>ไม่มีสัญญาณ - ทำงานแบบ Offline</span>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2">
          <Cloud className="w-4 h-4" />
          <span>มี {pendingCount} รายการรอ sync</span>
        </div>
      )}
    </div>
  );
}
