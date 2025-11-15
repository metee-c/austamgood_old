import { useState, useEffect } from 'react';
import { MoveRecord, CreateMovePayload, MoveFilters, MoveItemStatus, MoveStatus } from '@/lib/database/move';

// Hook for getting all move records
export const useMoves = (filters?: MoveFilters) => {
  const [data, setData] = useState<MoveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMoves = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value) params.append(key, value.toString());
        });
      }
      
      const response = await fetch(`/api/moves?${params}`);
      const result = await response.json();
      
      if (result.error) {
        setError(result.error);
        setData([]);
      } else {
        setData(result.data || []);
        setError(null);
      }
    } catch (err) {
      setError('Failed to fetch move records');
      setData([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMoves();
  }, [filters]);

  const refetch = () => {
    fetchMoves();
  };

  return { data, moves: data, loading, error, refetch };
};

// Hook for creating move records
export const useCreateMove = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createMove = async (record: CreateMovePayload) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/moves', {
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
      const errorMessage = err instanceof Error ? err.message : 'Failed to create move record';
      setError(errorMessage);
      setLoading(false);
      return { data: null, error: errorMessage };
    }
  };

  return { createMove, loading, error };
};

// Hook for updating move status
export const useUpdateMoveStatus = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateMoveStatus = async (id: number, status: MoveStatus) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/moves/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
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
      const errorMessage = 'Failed to update move status';
      setError(errorMessage);
      setLoading(false);
      return { data: null, error: errorMessage };
    }
  };

  return { updateMoveStatus, updateStatus: updateMoveStatus, loading, error };
};

// Hook for updating move item status
export const useUpdateMoveItemStatus = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateMoveItemStatus = async (id: number, status: MoveItemStatus) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/moves/item/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
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
      const errorMessage = 'Failed to update move item status';
      setError(errorMessage);
      setLoading(false);
      return { data: null, error: errorMessage };
    }
  };

  return { updateMoveItemStatus, updateItemStatus: updateMoveItemStatus, loading, error };
};

// Hook for getting move by move_no
export const useMoveByNo = (moveNo: string | undefined) => {
  const [data, setData] = useState<MoveRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!moveNo) {
      setLoading(false);
      return;
    }

    const fetchMove = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/moves?move_no=${moveNo}`);
        const result = await response.json();

        if (result.error) {
          setError(result.error);
          setData(null);
        } else {
          // Get first result if array
          const move = Array.isArray(result.data) ? result.data[0] : result.data;
          setData(move || null);
          setError(null);
        }
      } catch (err) {
        setError('Failed to fetch move record');
        setData(null);
      }
      setLoading(false);
    };

    fetchMove();
  }, [moveNo]);

  return { data, loading, error };
};
