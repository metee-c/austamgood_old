'use client';

import { useState, useEffect } from 'react';

export interface SystemUser {
  user_id: number;
  username: string;
  full_name: string;
  email?: string;
  is_active: boolean;
  role_id?: number;
}

interface UseSystemUsersFilters {
  search?: string;
  activeOnly?: boolean;
}

interface UseSystemUsersResult {
  data: SystemUser[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useSystemUsers(filters: UseSystemUsersFilters = {}): UseSystemUsersResult {
  const [data, setData] = useState<SystemUser[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const searchParams = new URLSearchParams();
      if (filters.search) searchParams.append('search', filters.search);
      if (filters.activeOnly !== undefined) {
        searchParams.append('active_only', String(filters.activeOnly));
      }

      const response = await fetch(`/api/system-users?${searchParams.toString()}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'เกิดข้อผิดพลาดในการโหลดข้อมูลผู้ใช้งาน');
      }

      setData(result.data || []);
    } catch (err) {
      console.error('Error fetching system users:', err);
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [filters.search, filters.activeOnly]);

  return {
    data,
    loading,
    error,
    refetch: fetchUsers
  };
}
