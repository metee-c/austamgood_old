// Custom React Hook for Stock Adjustment Management
// Uses SWR for data fetching with automatic revalidation

import useSWR from 'swr';
import { useState } from 'react';
import {
  type AdjustmentRecord,
  type AdjustmentReason,
  type CreateAdjustmentPayload,
  type UpdateAdjustmentPayload,
  type AdjustmentFilters,
} from '@/types/stock-adjustment-schema';

// SWR fetcher
const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface UseStockAdjustmentOptions {
  filters?: AdjustmentFilters;
  autoFetch?: boolean;
}

export function useStockAdjustment(options: UseStockAdjustmentOptions = {}) {
  const { filters, autoFetch = true } = options;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build query string from filters
  const buildQueryString = (filters?: AdjustmentFilters): string => {
    if (!filters) return '';
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });
    return params.toString() ? `?${params.toString()}` : '';
  };

  const queryString = buildQueryString(filters);

  // Fetch adjustments list
  const {
    data: adjustmentsResponse,
    error: fetchError,
    mutate,
    isValidating,
  } = useSWR<{ data: AdjustmentRecord[] }>(
    autoFetch ? `/api/stock-adjustments${queryString}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    }
  );

  const adjustments = adjustmentsResponse?.data;

  // Fetch adjustment reasons
  const {
    data: reasonsResponse,
    error: reasonsError,
    mutate: mutateReasons,
  } = useSWR<{ data: AdjustmentReason[] }>('/api/stock-adjustments/reasons', fetcher, {
    revalidateOnFocus: false,
  });

  const reasons = reasonsResponse?.data;

  // Create new adjustment
  const createAdjustment = async (payload: CreateAdjustmentPayload): Promise<AdjustmentRecord> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/stock-adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create adjustment');
      }

      const result = await response.json();
      await mutate(); // Revalidate list
      return result.data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Update adjustment (draft only)
  const updateAdjustment = async (
    id: number,
    payload: UpdateAdjustmentPayload
  ): Promise<AdjustmentRecord> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/stock-adjustments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update adjustment');
      }

      const result = await response.json();
      await mutate(); // Revalidate list
      return result.data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Delete adjustment (draft only)
  const deleteAdjustment = async (id: number): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/stock-adjustments/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete adjustment');
      }

      await mutate(); // Revalidate list
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Submit for approval
  const submitForApproval = async (id: number): Promise<AdjustmentRecord> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/stock-adjustments/${id}/submit`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit adjustment');
      }

      const result = await response.json();
      await mutate(); // Revalidate list
      return result.data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Approve adjustment
  const approveAdjustment = async (id: number): Promise<AdjustmentRecord> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/stock-adjustments/${id}/approve`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to approve adjustment');
      }

      const result = await response.json();
      await mutate(); // Revalidate list
      return result.data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Reject adjustment
  const rejectAdjustment = async (id: number, reason: string): Promise<AdjustmentRecord> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/stock-adjustments/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to reject adjustment');
      }

      const result = await response.json();
      await mutate(); // Revalidate list
      return result.data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Complete adjustment (records to ledger)
  const completeAdjustment = async (id: number): Promise<AdjustmentRecord> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/stock-adjustments/${id}/complete`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to complete adjustment');
      }

      const result = await response.json();
      await mutate(); // Revalidate list
      return result.data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Cancel adjustment
  const cancelAdjustment = async (id: number, reason: string): Promise<AdjustmentRecord> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/stock-adjustments/${id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel adjustment');
      }

      const result = await response.json();
      await mutate(); // Revalidate list
      return result.data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Check stock availability
  const checkAvailability = async (params: {
    warehouse_id: string;
    location_id: string;
    sku_id: string;
    pallet_id?: string | null;
    adjustment_piece_qty: number;
  }): Promise<any> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/stock-adjustments/check-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to check availability');
      }

      return await response.json();
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    // Data
    adjustments,
    reasons,

    // Loading states
    isLoading: isLoading || isValidating,
    error: error || fetchError?.message || reasonsError?.message || null,

    // Mutations
    createAdjustment,
    updateAdjustment,
    deleteAdjustment,
    submitForApproval,
    approveAdjustment,
    rejectAdjustment,
    completeAdjustment,
    cancelAdjustment,
    checkAvailability,

    // Manual revalidation
    mutate,
    mutateReasons,
  };
}

// Hook for fetching single adjustment by ID
export function useAdjustmentById(id: number | null) {
  const { data, error, mutate, isValidating } = useSWR<AdjustmentRecord>(
    id ? `/api/stock-adjustments/${id}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );

  return {
    adjustment: data,
    isLoading: isValidating,
    error: error?.message || null,
    mutate,
  };
}
