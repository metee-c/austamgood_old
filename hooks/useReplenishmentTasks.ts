import useSWR from 'swr';

export type ReplenishmentStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';

export interface ReplenishmentTask {
  queue_id: string;
  alert_id: string; // alias for queue_id
  warehouse_id: string;
  sku_id: string;
  sku_name: string;
  sku_code: string;
  uom_base: string;
  qty_per_pallet: number;
  from_location_id: string | null;
  from_location_code: string;
  from_location_name: string;
  to_location_id: string | null;
  pick_location_code: string;
  pick_location_name: string;
  requested_qty: number;
  confirmed_qty: number;
  shortage_qty: number;
  current_qty: number;
  required_qty: number;
  pallets_needed: number;
  priority: number;
  status: ReplenishmentStatus;
  trigger_source: string | null;
  trigger_reference: string | null;
  alert_reason: string;
  assigned_to: number | null;
  assigned_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  // FEFO fields
  pallet_id: string | null;
  expiry_date: string | null;
  suggested_sources: Array<{
    location_id: string;
    location_code: string;
    available_qty: number;
    pallet_id?: string | null;
  }>;
  master_sku?: {
    sku_id: string;
    sku_name: string;
    uom_base: string;
    qty_per_pack: number;
    qty_per_pallet: number;
  };
  from_location?: {
    location_id: string;
    location_code: string;
    location_name: string;
    zone: string;
    location_type: string;
  };
  to_location?: {
    location_id: string;
    location_code: string;
    location_name: string;
    zone: string;
    location_type: string;
  };
  assigned_user?: {
    user_id: number;
    username: string;
    full_name: string;
  };
}

interface ReplenishmentTasksResponse {
  success: boolean;
  data: ReplenishmentTask[];
  total: number;
}

interface UseReplenishmentTasksOptions {
  status?: ReplenishmentStatus | 'all';
  assignedOnly?: boolean;
  triggerSource?: string;
  showAll?: boolean;
  refreshInterval?: number;
}

const fetcher = async (url: string) => {
  const res = await fetch(url, {
    credentials: 'include'
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to fetch replenishment tasks');
  }
  return res.json();
};

export function useReplenishmentTasks(options: UseReplenishmentTasksOptions = {}) {
  const {
    status = 'all',
    assignedOnly = false,
    triggerSource,
    showAll = false,
    refreshInterval = 30000
  } = options;

  const params = new URLSearchParams();
  if (status) params.append('status', status);
  if (assignedOnly) params.append('assigned_only', 'true');
  if (triggerSource) params.append('trigger_source', triggerSource);
  if (showAll) params.append('show_all', 'true');

  const url = `/api/mobile/replenishment/tasks?${params.toString()}`;

  const { data, error, isLoading, mutate } = useSWR<ReplenishmentTasksResponse>(
    url,
    fetcher,
    {
      refreshInterval,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 5000
    }
  );

  const updateTaskStatus = async (
    queueId: string,
    newStatus: ReplenishmentStatus,
    additionalData?: { confirmed_qty?: number; notes?: string }
  ) => {
    try {
      const res = await fetch(`/api/replenishment/${queueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          ...additionalData
        })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update task status');
      }

      await mutate();
      return { success: true };
    } catch (error) {
      console.error('Error updating task status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  };

  return {
    tasks: data?.data || [],
    total: data?.total || 0,
    isLoading,
    error,
    mutate,
    updateTaskStatus
  };
}
