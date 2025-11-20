import { useState, useEffect } from 'react';
import { ReceiveRecord, CreateReceiveRecord, ReceiveFilters } from '@/lib/database/receive';

// Hook for getting all receive records
export const useReceives = (filters?: ReceiveFilters) => {
  const [data, setData] = useState<ReceiveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReceives = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value) params.append(key, value.toString());
        });
      }
      
      const response = await fetch(`/api/receives?${params}`);
      const result = await response.json();
      
      if (result.error) {
        setError(result.error);
        setData([]);
      } else {
        setData(result.data || []);
        setError(null);
      }
    } catch (err) {
      setError('Failed to fetch receive records');
      setData([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReceives();
  }, [filters]);

  const refetch = () => {
    fetchReceives();
  };

  return { data, loading, error, refetch };
};

// Hook for getting single receive record
export const useReceive = (id: number | null) => {
  const [data, setData] = useState<ReceiveRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReceive = async (receiveId: number) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/receives/${receiveId}`);
      const result = await response.json();
      
      if (result.error) {
        setError(result.error);
        setData(null);
      } else {
        setData(result.data);
        setError(null);
      }
    } catch (err) {
      setError('Failed to fetch receive record');
      setData(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (id) {
      fetchReceive(id);
    }
  }, [id]);

  const refetch = () => {
    if (id) {
      fetchReceive(id);
    }
  };

  return { data, loading, error, refetch };
};

// Hook for dashboard stats
export const useReceiveDashboard = () => {
  const [data, setData] = useState<{
    totalToday: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/receives/dashboard');
      const result = await response.json();
      
      if (result.error) {
        setError(result.error);
        setData(null);
      } else {
        setData(result.data);
        setError(null);
      }
    } catch (err) {
      setError('Failed to fetch dashboard stats');
      setData(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const refetch = () => {
    fetchStats();
  };

  return { data, loading, error, refetch };
};

// Hook for creating receive records
export const useCreateReceive = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createReceive = async (record: CreateReceiveRecord) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/receives', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(record),
      });

      const result = await response.json();
      
      if (result.error) {
        setError(result.error);
        setLoading(false);
        return { data: null, error: result.error };
      }

      setLoading(false);
      return { data: result.data, error: null };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create receive record';
      setError(errorMessage);
      setLoading(false);
      return { data: null, error: errorMessage };
    }
  };

  return { createReceive, loading, error };
};

// Hook for updating receive records
export const useUpdateReceive = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateReceive = async (id: number, updates: Partial<ReceiveRecord>) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/receives/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      const result = await response.json();
      
      if (result.error) {
        setError(result.error);
        setLoading(false);
        return { data: null, error: result.error };
      }

      setLoading(false);
      return { data: result.data, error: null };
    } catch (err) {
      const errorMessage = 'Failed to update receive record';
      setError(errorMessage);
      setLoading(false);
      return { data: null, error: errorMessage };
    }
  };

  return { updateReceive, loading, error };
};

// Hook for generating receive numbers
export const useGenerateReceiveNo = () => {
  const generateReceiveNo = async () => {
    try {
      const response = await fetch('/api/receives/generate-receive-no', {
        method: 'POST',
      });
      const result = await response.json();
      return { data: result.data, error: result.error };
    } catch (err) {
      return { data: null, error: 'Failed to generate receive number' };
    }
  };

  return { generateReceiveNo };
};

// Hook for generating pallet IDs
export const useGeneratePalletId = () => {
  const generatePalletId = async () => {
    try {
      const response = await fetch('/api/receives/generate-pallet-id', {
        method: 'POST',
      });
      const result = await response.json();
      return { data: result.data, error: result.error };
    } catch (err) {
      return { data: null, error: 'Failed to generate pallet ID' };
    }
  };

  const generateMultiplePalletIds = async (count: number) => {
    try {
      const response = await fetch('/api/receives/generate-pallet-id', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ count }),
      });
      const result = await response.json();
      return { data: result.data, error: result.error };
    } catch (err) {
      return { data: null, error: 'Failed to generate multiple pallet IDs' };
    }
  };

  const getLatestPalletId = async () => {
    try {
      const response = await fetch('/api/receives/latest-pallet-id');
      const result = await response.json();
      return { data: result.data, error: result.error };
    } catch (err) {
      return { data: null, error: 'Failed to get latest pallet ID' };
    }
  };

  return { generatePalletId, generateMultiplePalletIds, getLatestPalletId };
};

// Hook for pallet scan validation
export const usePalletScanValidation = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validatePalletScan = async (palletId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/receives/validate-pallet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ palletId }),
      });
      
      const result = await response.json();
      
      if (result.error) {
        setError(result.error);
        setLoading(false);
        return { data: false, error: result.error };
      }

      setLoading(false);
      return { data: result.data, error: null };
    } catch (err) {
      const errorMessage = 'Failed to validate pallet scan';
      setError(errorMessage);
      setLoading(false);
      return { data: false, error: errorMessage };
    }
  };

  return { validatePalletScan, loading, error };
};
