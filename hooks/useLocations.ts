import { useState, useEffect, useCallback } from 'react';

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
  locations: Location[];
  count: number;
  error?: string;
}

interface UseLocationsParams {
  search?: string;
  warehouse_id?: string;
  location_type?: 'rack' | 'floor' | 'bulk' | 'other' | 'apf_zone' | 'pf_zone' | 'receiving' | 'shipping';
  zone?: string;
  status?: 'active' | 'inactive';
}

export const useLocations = (params: UseLocationsParams = {}) => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLocations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Debug logging  
      console.log('🏠 useLocations fetchLocations called with params:', params);
      
      // Skip API call if no warehouse_id provided
      if (!params.warehouse_id || params.warehouse_id.trim() === '') {
        console.log('🏠 Skipping API call - no warehouse_id provided');
        setLocations([]);
        setLoading(false);
        return;
      }
      
      const searchParams = new URLSearchParams();
      if (params.search) searchParams.append('search', params.search);
      if (params.warehouse_id) searchParams.append('warehouse_id', params.warehouse_id);
      if (params.location_type) searchParams.append('location_type', params.location_type);
      if (params.zone) searchParams.append('zone', params.zone);
      if (params.status) searchParams.append('status', params.status);
      
      const url = `/api/master-location?${searchParams.toString()}`;
      console.log('🏠 Fetching from URL:', url);
      
      const response = await fetch(url);
      const data: LocationsResponse = await response.json();
      
      console.log('🏠 API Response:', { ok: response.ok, status: response.status, locationsCount: data.locations?.length || 0, error: data.error });
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch locations');
      }
      
      setLocations(data.locations);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch locations');
      console.error('Error fetching locations:', err);
    } finally {
      setLoading(false);
    }
  }, [params]); // Add params as dependency for useCallback

  useEffect(() => {
    console.log('🔄 useEffect triggered with params:', params);
    fetchLocations();
  }, [fetchLocations]); // Use fetchLocations as dependency

  // Add manual trigger for testing with useCallback
  const testFetch = useCallback(() => {
    console.log('🧪 Manual test fetch triggered');
    fetchLocations();
  }, [fetchLocations]); // Depend on fetchLocations

  return {
    locations,
    loading,
    error,
    refetch: fetchLocations,
    testFetch // For debugging
  };
};