import { useState, useEffect } from 'react';

export interface Sku {
  sku_id: string;
  sku_name: string;
  sku_description?: string;
  category?: string;
  sub_category?: string;
  brand?: string;
  product_type?: string;
  uom_base: string;
  qty_per_pack?: number;
  qty_per_pallet?: number;
  weight_per_piece_kg?: number;
  weight_per_pack_kg?: number;
  barcode?: string;
  pack_barcode?: string;
  pallet_barcode?: string;
  storage_condition?: string;
  shelf_life_days?: number;
  lot_tracking_required: boolean;
  expiry_date_required: boolean;
  reorder_point?: number;
  safety_stock?: number;
  default_location?: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

interface SkusResponse {
  skus: Sku[];
  count: number;
  error?: string;
}

interface UseSkusParams {
  search?: string;
  category?: string;
  status?: 'active' | 'inactive';
}

export const useSkus = (params: UseSkusParams = {}) => {
  const [skus, setSkus] = useState<Sku[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSkus = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const searchParams = new URLSearchParams();
      if (params.search) searchParams.append('search', params.search);
      if (params.category) searchParams.append('category', params.category);
      if (params.status) searchParams.append('status', params.status);
      
      const response = await fetch(`/api/skus?${searchParams.toString()}`);
      const data: SkusResponse = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch SKUs');
      }
      
      setSkus(data.skus);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch SKUs');
      console.error('Error fetching SKUs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSkus();
  }, [params.search, params.category, params.status]);

  return {
    skus,
    loading,
    error,
    refetch: fetchSkus
  };
};