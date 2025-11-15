import { useState, useEffect } from 'react';

interface SkuOptionsResponse {
  field: string;
  options: string[];
  error?: string;
}

export const useSkuOptions = (field: string) => {
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOptions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/sku-options?field=${encodeURIComponent(field)}`);
      const data: SkuOptionsResponse = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch options');
      }
      
      setOptions(data.options);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch options');
      console.error('Error fetching SKU options:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (field) {
      fetchOptions();
    }
  }, [field]);

  return {
    options,
    loading,
    error,
    refetch: fetchOptions
  };
};