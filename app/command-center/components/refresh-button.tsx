'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';

interface RefreshButtonProps {
  autoRefreshInterval?: number; // in seconds, 0 = disabled
}

export function RefreshButton({ autoRefreshInterval = 30 }: RefreshButtonProps) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(autoRefreshInterval > 0);
  const [countdown, setCountdown] = useState(autoRefreshInterval);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => {
      setIsRefreshing(false);
      setCountdown(autoRefreshInterval);
    }, 500);
  }, [router, autoRefreshInterval]);

  // Auto-refresh countdown
  useEffect(() => {
    if (!autoRefresh || autoRefreshInterval <= 0) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Schedule refresh outside of setState to avoid render-during-render
          setTimeout(() => handleRefresh(), 0);
          return autoRefreshInterval;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoRefresh, autoRefreshInterval, handleRefresh]);

  return (
    <div className="flex items-center gap-3">
      {/* Auto-refresh toggle */}
      <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
        <input
          type="checkbox"
          checked={autoRefresh}
          onChange={(e) => {
            setAutoRefresh(e.target.checked);
            setCountdown(autoRefreshInterval);
          }}
          className="rounded border-gray-300"
        />
        <span className="font-thai">รีเฟรชอัตโนมัติ</span>
        {autoRefresh && (
          <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
            {countdown}s
          </span>
        )}
      </label>

      {/* Manual refresh button */}
      <button
        onClick={handleRefresh}
        disabled={isRefreshing}
        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border rounded-md hover:bg-gray-50 disabled:opacity-50"
      >
        <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        <span className="font-thai">รีเฟรช</span>
      </button>
    </div>
  );
}
