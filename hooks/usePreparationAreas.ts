import { useState, useEffect } from 'react';

export interface PreparationArea {
  area_id: string;
  area_code: string;
  area_name: string;
  description?: string;
  warehouse_id: string;
  zone: string;
  area_type: string;
  capacity_sqm?: number;
  current_utilization_pct?: number;
  max_capacity_pallets?: number;
  current_pallets?: number;
  status: string;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
  master_warehouse?: {
    warehouse_name: string;
  };
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface UsePreparationAreasOptions {
  page?: number;
  limit?: number;
  search?: string;
  warehouse_id?: string;
  zone?: string;
  area_type?: string;
  status?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export function usePreparationAreas(options: UsePreparationAreasOptions = {}) {
  const [preparationAreas, setPreparationAreas] = useState<PreparationArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  });

  const fetchPreparationAreas = async (params: UsePreparationAreasOptions = {}) => {
    setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams();
      
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.limit) queryParams.append('limit', params.limit.toString());
      if (params.search) queryParams.append('search', params.search);
      if (params.warehouse_id) queryParams.append('warehouse_id', params.warehouse_id);
      if (params.zone) queryParams.append('zone', params.zone);
      if (params.area_type) queryParams.append('area_type', params.area_type);
      if (params.status) queryParams.append('status', params.status);
      if (params.sort_by) queryParams.append('sort_by', params.sort_by);
      if (params.sort_order) queryParams.append('sort_order', params.sort_order);

      const response = await fetch(`/api/preparation-areas?${queryParams}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch preparation areas');
      }

      const data = await response.json();
      setPreparationAreas(data.data || []);
      setPagination(data.pagination || pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const createPreparationArea = async (data: Partial<PreparationArea>) => {
    try {
      const response = await fetch('/api/preparation-areas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create preparation area');
      }

      const newArea = await response.json();
      setPreparationAreas(prev => [...prev, newArea]);
      return newArea;
    } catch (err) {
      throw err;
    }
  };

  const updatePreparationArea = async (id: string, data: Partial<PreparationArea>) => {
    try {
      const response = await fetch(`/api/preparation-areas/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update preparation area');
      }

      const updatedArea = await response.json();
      setPreparationAreas(prev => 
        prev.map(area => 
          area.area_id === id ? updatedArea : area
        )
      );
      return updatedArea;
    } catch (err) {
      throw err;
    }
  };

  const deletePreparationArea = async (id: string) => {
    try {
      const response = await fetch(`/api/preparation-areas/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete preparation area');
      }

      setPreparationAreas(prev => 
        prev.filter(area => area.area_id !== id)
      );
    } catch (err) {
      throw err;
    }
  };

  const importPreparationAreas = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/preparation-areas/import', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to import preparation areas');
      }

      const result = await response.json();
      
      // Refresh data after import
      await fetchPreparationAreas(options);
      
      return result;
    } catch (err) {
      throw err;
    }
  };

  const downloadTemplate = async () => {
    try {
      const response = await fetch('/api/preparation-areas/template');
      
      if (!response.ok) {
        throw new Error('Failed to download template');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'preparation_areas_template.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      throw err;
    }
  };

  useEffect(() => {
    fetchPreparationAreas(options);
  }, [options.page, options.limit, options.search, options.warehouse_id, 
      options.zone, options.area_type, options.status, options.sort_by, options.sort_order]);

  return {
    preparationAreas,
    loading,
    error,
    pagination,
    fetchPreparationAreas,
    createPreparationArea,
    updatePreparationArea,
    deletePreparationArea,
    importPreparationAreas,
    downloadTemplate,
    refetch: () => fetchPreparationAreas(options)
  };
}
