import { useState, useEffect } from 'react';
import { Supplier } from '@/types/supplier';

interface SuppliersResponse {
  suppliers: Supplier[];
  error?: string;
}

export const useSuppliers = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/suppliers');
      const data: SuppliersResponse = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch suppliers');
      }
      
      setSuppliers(data.suppliers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch suppliers');
      console.error('Error fetching suppliers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  return {
    suppliers,
    loading,
    error,
    refetch: fetchSuppliers
  };
};