/**
 * Production Planning Hook
 * Custom hook สำหรับจัดการข้อมูลแผนการผลิต
 */

import useSWR from 'swr';
import { useState } from 'react';
import {
  ProductionPlanWithItems,
  ProductionPlanFilters,
  ProductionPlanListResponse,
  CreateProductionPlanInput,
  UpdateProductionPlanInput,
  BomCalculationRequest,
  BomCalculationResult,
} from '@/types/production-planning-schema';

const fetcher = (url: string) => fetch(url).then(res => res.json());

/**
 * Hook to fetch production plans list
 */
export function useProductionPlans(filters: ProductionPlanFilters = {}) {
  const params = new URLSearchParams();
  
  if (filters.search) params.set('search', filters.search);
  if (filters.status && filters.status !== 'all') params.set('status', filters.status);
  if (filters.start_date) params.set('start_date', filters.start_date);
  if (filters.end_date) params.set('end_date', filters.end_date);
  if (filters.warehouse_id) params.set('warehouse_id', filters.warehouse_id);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));

  const queryString = params.toString();
  const url = `/api/production/planning${queryString ? `?${queryString}` : ''}`;

  const { data, error, isLoading, mutate } = useSWR<ProductionPlanListResponse>(url, fetcher, {
    revalidateOnFocus: false,
  });

  return {
    plans: data?.data || [],
    totalCount: data?.totalCount || 0,
    summary: data?.summary,
    isLoading,
    error: error?.message || null,
    mutate,
  };
}

/**
 * Hook to fetch single production plan
 */
export function useProductionPlan(planId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<{ data: ProductionPlanWithItems }>(
    planId ? `/api/production/planning/${planId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  return {
    plan: data?.data || null,
    isLoading,
    error: error?.message,
    mutate,
  };
}

/**
 * Hook to fetch SKUs with BOM
 */
export function useSkusWithBom() {
  const { data, error, isLoading } = useSWR<{ data: { sku_id: string; sku_name: string; has_bom: boolean }[] }>(
    '/api/production/planning/skus-with-bom',
    fetcher,
    { revalidateOnFocus: false }
  );

  return {
    skus: data?.data || [],
    isLoading,
    error: error?.message,
  };
}

/**
 * Hook for production plan mutations
 */
export function useProductionPlanMutations() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createPlan = async (input: CreateProductionPlanInput): Promise<ProductionPlanWithItems | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/production/planning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to create plan');
      }
      return result.data;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const updatePlan = async (input: UpdateProductionPlanInput): Promise<ProductionPlanWithItems | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const { plan_id, ...body } = input;
      const response = await fetch(`/api/production/planning/${plan_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to update plan');
      }
      return result.data;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const deletePlan = async (planId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/production/planning/${planId}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete plan');
      }
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const approvePlan = async (planId: string, userId?: number): Promise<ProductionPlanWithItems | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/production/planning/${planId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', userId }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to approve plan');
      }
      return result.data;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const startPlan = async (planId: string): Promise<ProductionPlanWithItems | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/production/planning/${planId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to start production');
      }
      return result.data;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const completePlan = async (planId: string): Promise<ProductionPlanWithItems | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/production/planning/${planId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete' }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to complete plan');
      }
      return result.data;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const cancelPlan = async (planId: string): Promise<ProductionPlanWithItems | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/production/planning/${planId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to cancel plan');
      }
      return result.data;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    createPlan,
    updatePlan,
    deletePlan,
    approvePlan,
    startPlan,
    completePlan,
    cancelPlan,
    isLoading,
    error,
  };
}

/**
 * Hook for BOM calculation
 */
export function useBomCalculation() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BomCalculationResult | null>(null);

  const calculate = async (request: BomCalculationRequest): Promise<BomCalculationResult | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/production/planning/bom-calculation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to calculate BOM');
      }
      setResult(data.data);
      return data.data;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
  };

  return {
    calculate,
    reset,
    result,
    isLoading,
    error,
  };
}
