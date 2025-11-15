import { useState, useEffect } from 'react';

interface Warehouse {
  warehouse_id: string;
  warehouse_name: string;
  active_status: string;
}

export const useWarehouses = () => {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const response = await fetch('/api/master-warehouse');
        if (!response.ok) {
          throw new Error('Failed to fetch warehouses');
        }
        const result = await response.json();

        const activeWarehouses = (result || []).filter((w: Warehouse) => w.active_status === 'active');
        setWarehouses(activeWarehouses);
        setError(null);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
        console.error("Error fetching warehouses:", errorMessage);
        setError('ไม่สามารถโหลดข้อมูลคลังสินค้าได้');
        setWarehouses([]);
      }
      setLoading(false);
    };

    fetchWarehouses();
  }, []);

  return { warehouses, loading, error };
};
