'use client';

import { useState, useCallback } from 'react';
import { Search, Filter, RefreshCw, X } from 'lucide-react';
import { CommandCenterFilters, CommandCenterFilterOptions } from '../types';

interface ActivityFiltersProps {
  filters: CommandCenterFilters;
  onFiltersChange: (filters: CommandCenterFilters) => void;
  filterOptions?: CommandCenterFilterOptions;
  autoRefresh: boolean;
  onAutoRefreshToggle: () => void;
  onRefresh: () => void;
  total: number;
  isLoading: boolean;
}

export function ActivityFilters({
  filters,
  onFiltersChange,
  filterOptions,
  autoRefresh,
  onAutoRefreshToggle,
  onRefresh,
  total,
  isLoading,
}: ActivityFiltersProps) {
  const [searchInput, setSearchInput] = useState(filters.search || '');

  const handleSearchSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    onFiltersChange({ ...filters, search: searchInput || undefined, page: 1 });
  }, [searchInput, filters, onFiltersChange]);

  const handleFilterChange = useCallback((key: keyof CommandCenterFilters, value: string) => {
    onFiltersChange({ ...filters, [key]: value || undefined, page: 1 });
  }, [filters, onFiltersChange]);

  const handleClearFilters = useCallback(() => {
    setSearchInput('');
    onFiltersChange({ page: 1, limit: filters.limit });
  }, [filters.limit, onFiltersChange]);

  const hasActiveFilters = filters.search || filters.activity_type || filters.status ||
    filters.entity_type || filters.user_id || filters.request_method ||
    filters.date_from || filters.date_to;

  return (
    <div className="bg-card border rounded-lg p-3 space-y-3">
      {/* Row 1: Search + Actions */}
      <div className="flex items-center gap-2">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="ค้นหา SKU, Pallet, Location, Entity, Path..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            ค้นหา
          </button>
        </form>

        <div className="flex items-center gap-1 border-l pl-2">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 text-sm border rounded-md hover:bg-accent disabled:opacity-50"
            title="รีเฟรช"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onAutoRefreshToggle}
            className={`px-2 py-2 text-xs rounded-md border ${
              autoRefresh ? 'bg-green-100 text-green-800 border-green-300' : 'hover:bg-accent'
            }`}
            title={autoRefresh ? 'ปิด Auto-refresh' : 'เปิด Auto-refresh (10s)'}
          >
            {autoRefresh ? 'Auto ON' : 'Auto OFF'}
          </button>
        </div>

        <div className="text-xs text-muted-foreground whitespace-nowrap">
          {total.toLocaleString()} รายการ
        </div>
      </div>

      {/* Row 2: Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground" />

        {/* Status */}
        <select
          value={filters.status || ''}
          onChange={(e) => handleFilterChange('status', e.target.value)}
          className="text-xs border rounded px-2 py-1.5 bg-background"
        >
          <option value="">ทุกสถานะ</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="partial">Partial</option>
        </select>

        {/* Method */}
        <select
          value={filters.request_method || ''}
          onChange={(e) => handleFilterChange('request_method', e.target.value)}
          className="text-xs border rounded px-2 py-1.5 bg-background"
        >
          <option value="">ทุก Method</option>
          {(filterOptions?.request_methods || ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        {/* Activity Type */}
        <select
          value={filters.activity_type || ''}
          onChange={(e) => handleFilterChange('activity_type', e.target.value)}
          className="text-xs border rounded px-2 py-1.5 bg-background max-w-[180px]"
        >
          <option value="">ทุกประเภท</option>
          {(filterOptions?.activity_types || []).slice(0, 50).map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        {/* Entity Type */}
        <select
          value={filters.entity_type || ''}
          onChange={(e) => handleFilterChange('entity_type', e.target.value)}
          className="text-xs border rounded px-2 py-1.5 bg-background max-w-[150px]"
        >
          <option value="">ทุก Entity</option>
          {(filterOptions?.entity_types || []).map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        {/* User */}
        <select
          value={filters.user_id || ''}
          onChange={(e) => handleFilterChange('user_id', e.target.value)}
          className="text-xs border rounded px-2 py-1.5 bg-background max-w-[150px]"
        >
          <option value="">ทุกผู้ใช้</option>
          {(filterOptions?.users || []).map(u => (
            <option key={u.user_id} value={u.user_id.toString()}>
              {u.full_name || u.username}
            </option>
          ))}
        </select>

        {/* Date From */}
        <input
          type="datetime-local"
          value={filters.date_from || ''}
          onChange={(e) => handleFilterChange('date_from', e.target.value)}
          className="text-xs border rounded px-2 py-1.5 bg-background"
          title="ตั้งแต่"
        />

        {/* Date To */}
        <input
          type="datetime-local"
          value={filters.date_to || ''}
          onChange={(e) => handleFilterChange('date_to', e.target.value)}
          className="text-xs border rounded px-2 py-1.5 bg-background"
          title="ถึง"
        />

        {/* Page Size */}
        <select
          value={filters.limit || 100}
          onChange={(e) => handleFilterChange('limit', e.target.value)}
          className="text-xs border rounded px-2 py-1.5 bg-background"
        >
          <option value="50">50/หน้า</option>
          <option value="100">100/หน้า</option>
          <option value="200">200/หน้า</option>
          <option value="500">500/หน้า</option>
        </select>

        {/* Clear */}
        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 px-2 py-1.5 border border-red-200 rounded hover:bg-red-50"
          >
            <X className="h-3 w-3" />
            ล้างตัวกรอง
          </button>
        )}
      </div>
    </div>
  );
}
