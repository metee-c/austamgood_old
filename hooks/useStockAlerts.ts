import useSWR from 'swr';
import { ActiveStockAlert, StockAlertStatus } from '@/types/stock-alerts';

interface StockAlertsResponse {
  success: boolean;
  data: ActiveStockAlert[];
  total: number;
}

interface UseStockAlertsOptions {
  warehouseId?: string;
  status?: StockAlertStatus | 'all';
  priority?: number;
  refreshInterval?: number;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to fetch stock alerts');
  }
  return res.json();
};

export function useStockAlerts(options: UseStockAlertsOptions = {}) {
  const {
    warehouseId,
    status = 'pending',
    priority,
    refreshInterval = 30000 // Refresh every 30 seconds
  } = options;

  // Build query params
  const params = new URLSearchParams();
  if (warehouseId) params.append('warehouse_id', warehouseId);
  if (status) params.append('status', status);
  if (priority) params.append('priority', priority.toString());

  const url = `/api/stock-alerts?${params.toString()}`;

  const { data, error, isLoading, mutate } = useSWR<StockAlertsResponse>(
    url,
    fetcher,
    {
      refreshInterval,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 5000
    }
  );

  const updateAlertStatus = async (
    alertId: string,
    newStatus: StockAlertStatus,
    notes?: string
  ) => {
    try {
      const res = await fetch('/api/stock-alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alert_id: alertId,
          status: newStatus,
          notes
        })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update alert status');
      }

      // Revalidate the alerts list
      await mutate();

      return { success: true };
    } catch (error) {
      console.error('Error updating alert status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  };

  return {
    alerts: data?.data || [],
    total: data?.total || 0,
    isLoading,
    error,
    mutate,
    updateAlertStatus
  };
}
