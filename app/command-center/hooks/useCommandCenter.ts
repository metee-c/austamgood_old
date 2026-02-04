'use client';

import useSWR from 'swr';
import { CommandCenterActivity, CommandCenterFilters, CommandCenterFilterOptions } from '../types';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function useCommandCenter(filters: CommandCenterFilters, autoRefresh: boolean = false) {
  const params = new URLSearchParams();

  if (filters.search) params.set('search', filters.search);
  if (filters.activity_type) params.set('activity_type', filters.activity_type);
  if (filters.status) params.set('status', filters.status);
  if (filters.entity_type) params.set('entity_type', filters.entity_type);
  if (filters.user_id) params.set('user_id', filters.user_id);
  if (filters.request_method) params.set('request_method', filters.request_method);
  if (filters.date_from) params.set('date_from', filters.date_from);
  if (filters.date_to) params.set('date_to', filters.date_to);
  if (filters.page) params.set('page', filters.page.toString());
  if (filters.limit) params.set('limit', filters.limit.toString());
  if (filters.sort_by) params.set('sort_by', filters.sort_by);
  if (filters.sort_dir) params.set('sort_dir', filters.sort_dir);

  const { data, error, isLoading, mutate } = useSWR<{
    data: CommandCenterActivity[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>(
    `/api/command-center/activities?${params.toString()}`,
    fetcher,
    {
      refreshInterval: autoRefresh ? 10000 : 0,
      revalidateOnFocus: false,
      dedupingInterval: 2000,
    }
  );

  return {
    activities: data?.data || [],
    total: data?.total || 0,
    page: data?.page || 1,
    totalPages: data?.totalPages || 0,
    error,
    isLoading,
    mutate,
  };
}

export function useCommandCenterFilters() {
  const { data, error, isLoading } = useSWR<CommandCenterFilterOptions>(
    '/api/command-center/filters',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // Cache for 1 minute
    }
  );

  return {
    filterOptions: data,
    error,
    isLoading,
  };
}
