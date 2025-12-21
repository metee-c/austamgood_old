/**
 * Production Orders Hook
 * Custom hook สำหรับจัดการข้อมูลใบสั่งผลิต
 */

import useSWR from 'swr';
import { useState } from 'react';
import {
  ProductionOrderWithDetails,
  ProductionOrderFilters,
  ProductionOrderListResponse,
  CreateProductionOrderInput,
  UpdateProductionOrderInput,
  PlanDataForOrder,
} from '@/types/production-order-schema';

const fetcher = (url: string) => fetch(url).then(res => res.json());

/**
 * Hook to fetch production orders list
 */
export function useProductionOrders(filters: ProductionOrderFilters = {}) {
  const params = new URLSearchParams();
  
  if (filters.search) params.set('search', filters.search);
  if (filters.status && filters.status !== 'all') params.set('status', filters.status);
  if (filters.plan_id) params.set('plan_id', filters.plan_id);
  if (filters.start_date) params.set('start_date', filters.start_date);
  if (filters.end_date) params.set('end_date', filters.end_date);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));

  const queryString = params.toString();
  const url = `/api/production/orders${queryString ? `?${queryString}` : ''}`;

  const { data, error, isLoading, mutate } = useSWR<ProductionOrderListResponse>(url, fetcher, {
    revalidateOnFocus: false,
  });

  return {
    orders: data?.data || [],
    totalCount: data?.totalCount || 0,
    summary: data?.summary,
    isLoading,
    error: error?.message,
    mutate,
  };
}

/**
 * Hook to fetch single production order
 */
export function useProductionOrder(orderId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<{ data: ProductionOrderWithDetails }>(
    orderId ? `/api/production/orders/${orderId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  return {
    order: data?.data || null,
    isLoading,
    error: error?.message,
    mutate,
  };
}

/**
 * Hook to fetch plan data for creating order
 */
export function usePlanDataForOrder(planId: string | null) {
  const { data, error, isLoading } = useSWR<{ data: PlanDataForOrder }>(
    planId ? `/api/production/orders/plan-data?plan_id=${planId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  return {
    planData: data?.data || null,
    isLoading,
    error: error?.message,
  };
}

/**
 * Hook for production order mutations
 */
export function useProductionOrderMutations() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createOrder = async (input: CreateProductionOrderInput): Promise<ProductionOrderWithDetails | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/production/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to create order');
      }
      return result.data;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const createOrdersFromPlan = async (planId: string): Promise<ProductionOrderWithDetails[] | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/production/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_from_plan', plan_id: planId }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to create orders from plan');
      }
      return result.data;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const updateOrder = async (input: UpdateProductionOrderInput): Promise<ProductionOrderWithDetails | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const { id, ...body } = input;
      const response = await fetch(`/api/production/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to update order');
      }
      return result.data;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteOrder = async (orderId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/production/orders/${orderId}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete order');
      }
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const performAction = async (orderId: string, action: string, data?: any): Promise<ProductionOrderWithDetails | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/production/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...data }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || `Failed to ${action} order`);
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
    createOrder,
    createOrdersFromPlan,
    updateOrder,
    deleteOrder,
    performAction,
    isLoading,
    error,
  };
}
