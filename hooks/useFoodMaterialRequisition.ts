/**
 * Hook for fetching food material requisition data
 * ดึงรายการวัตถุดิบอาหารที่ต้องเบิกจากใบสั่งผลิต
 */

import useSWR from 'swr';

export interface FoodMaterialItem {
  id: string;
  production_order_id: string;
  production_order_no: string;
  production_order_status: string;
  material_sku_id: string;
  material_sku_name: string;
  category: string;
  sub_category: string;
  required_qty: number;
  issued_qty: number;
  remaining_qty: number;
  uom: string;
  status: 'pending' | 'partial' | 'issued' | 'completed';
  created_at: string;
  updated_at: string;
  remarks: string | null;
}

export interface FoodMaterialSummary {
  total: number;
  pending: number;
  partial: number;
  issued: number;
  completed: number;
}

interface UseFoodMaterialRequisitionOptions {
  status?: string;
  productionOrderId?: string;
  refreshInterval?: number;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to fetch');
  }
  return res.json();
};

export function useFoodMaterialRequisition(options: UseFoodMaterialRequisitionOptions = {}) {
  const { status = 'all', productionOrderId, refreshInterval = 30000 } = options;

  const params = new URLSearchParams();
  if (status && status !== 'all') params.append('status', status);
  if (productionOrderId) params.append('production_order_id', productionOrderId);

  const { data, error, isLoading, mutate } = useSWR<{
    data: FoodMaterialItem[];
    totalCount: number;
    summary: FoodMaterialSummary;
  }>(`/api/production/material-requisition/food?${params.toString()}`, fetcher, {
    refreshInterval,
    revalidateOnFocus: true,
  });

  // Create replenishment task for a food material item
  const createReplenishmentTask = async (
    itemId: string,
    options?: {
      from_location_id?: string;
      to_location_id?: string;
      pallet_id?: string;
      notes?: string;
    }
  ) => {
    try {
      const response = await fetch('/api/production/material-requisition/food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          production_order_item_id: itemId,
          ...options,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        return { success: false, error: result.error || 'Failed to create task' };
      }

      // Refresh data
      await mutate();

      return { success: true, data: result.data };
    } catch (err: any) {
      return { success: false, error: err.message || 'Unknown error' };
    }
  };

  return {
    items: data?.data || [],
    totalCount: data?.totalCount || 0,
    summary: data?.summary || { total: 0, pending: 0, partial: 0, issued: 0, completed: 0 },
    isLoading,
    error: error?.message,
    mutate,
    createReplenishmentTask,
  };
}
