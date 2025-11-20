import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

export interface Location {
  location_id: string;
  warehouse_id: string;
  warehouse_name?: string;
  location_code: string;
  location_name?: string;
  location_type: 'rack' | 'floor' | 'bulk' | 'other' | 'apf_zone' | 'pf_zone' | 'receiving' | 'shipping';
  max_capacity_qty?: number;
  max_capacity_weight_kg?: number;
  current_qty?: number;
  current_weight_kg?: number;
  putaway_strategy?: string;
  zone?: string;
  aisle?: string;
  rack?: string;
  shelf?: string;
  bin?: string;
  temperature_controlled: boolean;
  humidity_controlled: boolean;
  active_status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
  remarks?: string;
}

interface LocationsResponse {
  data: Location[] | null;
  error: string | null;
}

interface UseLocationsParams {
  search?: string;
  warehouse_id?: string;
  location_type?: 'rack' | 'floor' | 'bulk' | 'other' | 'apf_zone' | 'pf_zone' | 'receiving' | 'shipping';
  zone?: string;
  status?: 'active' | 'inactive';
  limit?: number; // Add limit parameter
}

export const useLocations = (params: UseLocationsParams = {}) => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use ref to track if fetch is in progress to prevent duplicate calls
  const fetchingRef = useRef(false);

  // Memoize params to prevent unnecessary re-fetches
  const stableParams = useMemo(() => JSON.stringify(params), [
    params.search,
    params.warehouse_id,
    params.location_type,
    params.zone,
    params.status,
    params.limit
  ]);

  const fetchLocations = useCallback(async () => {
    // Prevent duplicate fetches
    if (fetchingRef.current) {
      console.log('🏠 Fetch already in progress, skipping duplicate call');
      return;
    }

    try {
      fetchingRef.current = true;
      setLoading(true);
      setError(null);

      const parsedParams = JSON.parse(stableParams);

      // Debug logging
      console.log('🏠 useLocations fetchLocations called with params:', parsedParams);

      // Skip API call if no warehouse_id provided
      if (!parsedParams.warehouse_id || parsedParams.warehouse_id.trim() === '') {
        console.log('🏠 Skipping API call - no warehouse_id provided');
        setLocations([]);
        setLoading(false);
        fetchingRef.current = false;
        return;
      }

      const searchParams = new URLSearchParams();
      if (parsedParams.search) searchParams.append('search', parsedParams.search);
      if (parsedParams.warehouse_id) searchParams.append('warehouse_id', parsedParams.warehouse_id);
      if (parsedParams.location_type) searchParams.append('location_type', parsedParams.location_type);
      if (parsedParams.zone) searchParams.append('zone', parsedParams.zone);
      if (parsedParams.status) searchParams.append('status', parsedParams.status);
      if (parsedParams.limit) searchParams.append('limit', parsedParams.limit.toString());

      const url = `/api/master-location?${searchParams.toString()}`;
      console.log('🏠 Fetching from URL:', url);

      const response = await fetch(url);
      const result: LocationsResponse = await response.json();

      console.log('🏠 API Response:', { ok: response.ok, status: response.status, locationsCount: result.data?.length || 0, error: result.error });

      if (!response.ok || result.error) {
        throw new Error(result.error || 'Failed to fetch locations');
      }

      setLocations(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch locations');
      console.error('Error fetching locations:', err);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [stableParams]);

  useEffect(() => {
    console.log('🔄 useEffect triggered with stableParams:', stableParams);
    fetchLocations();
  }, [stableParams, fetchLocations]);

  // Add manual trigger for testing
  const testFetch = useCallback(() => {
    console.log('🧪 Manual test fetch triggered');
    fetchingRef.current = false; // Reset the flag
    fetchLocations();
  }, [fetchLocations]);

  return {
    locations,
    loading,
    error,
    refetch: fetchLocations,
    testFetch // For debugging
  };
};