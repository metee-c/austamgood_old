import { useState, useCallback } from 'react';
import type { RoutePlan } from '../types';
import { fetchRoutePlans as apiFetchRoutePlans, ApiError } from '../api';

interface UseRoutePlansFilters {
  warehouseId?: string | null;
  status?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  search?: string;
}

interface UseRoutePlansPagination {
  page: number;
  pageSize: number;
}

export function useRoutePlans(
  filters: UseRoutePlansFilters = {},
  pagination: UseRoutePlansPagination = { page: 1, pageSize: 20 }
) {
  const [plans, setPlans] = useState<RoutePlan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  
  const fetchPlans = useCallback(async (signal?: AbortSignal) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // ✅ Use API layer instead of direct fetch
      const result = await apiFetchRoutePlans(
        {
          page: pagination.page,
          pageSize: pagination.pageSize,
          warehouseId: filters.warehouseId,
          status: filters.status,
          startDate: filters.startDate,
          endDate: filters.endDate,
          search: filters.search,
        },
        signal
      );
      
      if (!signal?.aborted) {
        setPlans(result.data || []);
        setTotal(result.meta?.total || 0);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      
      console.error('Error fetching route plans:', err);
      if (!signal?.aborted) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
        }
      }
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, [filters, pagination]);
  
  const refetch = useCallback(() => {
    fetchPlans();
  }, [fetchPlans]);
  
  return {
    plans,
    isLoading,
    error,
    total,
    fetchPlans,
    refetch,
  };
}
