'use client';

import { useState, useEffect } from 'react';

export interface Employee {
  employee_id: number;
  employee_code?: string;
  first_name: string;
  last_name: string;
  email?: string;
  status: 'active' | 'inactive';
  wms_role?: string;
  role_id?: number;
}

interface UseEmployeesFilters {
  search?: string;
  status?: string;
}

interface UseEmployeesResult {
  data: Employee[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useEmployees(filters: UseEmployeesFilters = {}): UseEmployeesResult {
  const [data, setData] = useState<Employee[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      setError(null);

      const searchParams = new URLSearchParams();
      if (filters.search) searchParams.append('search', filters.search);
      if (filters.status) searchParams.append('status', filters.status);

      const response = await fetch(`/api/master-employee?${searchParams.toString()}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'เกิดข้อผิดพลาดในการโหลดข้อมูลพนักงาน');
      }

      setData(result.data || []);
    } catch (err) {
      console.error('Error fetching employees:', err);
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [filters.search, filters.status]);

  return {
    data,
    loading,
    error,
    refetch: fetchEmployees
  };
}