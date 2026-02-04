'use client';

import { useState, useCallback, ReactNode } from 'react';
import { Activity, AlertTriangle, BarChart3, Database } from 'lucide-react';
import { CommandCenterFilters, TabType } from '../types';
import { useCommandCenter, useCommandCenterFilters } from '../hooks/useCommandCenter';
import { ActivityFilters } from './activity-filters';
import { ActivityDataGrid } from './activity-data-grid';
import { ErrorDataGrid } from './error-data-grid';

const TABS: { key: TabType; label: string; icon: ReactNode }[] = [
  { key: 'activities', label: 'กิจกรรมทั้งหมด', icon: <Activity className="h-4 w-4" /> },
  { key: 'errors', label: 'ข้อผิดพลาด', icon: <AlertTriangle className="h-4 w-4" /> },
  { key: 'health', label: 'System Health', icon: <BarChart3 className="h-4 w-4" /> },
  { key: 'stock', label: 'Stock Integrity', icon: <Database className="h-4 w-4" /> },
];

interface CommandCenterClientProps {
  systemHealthSlot: ReactNode;
  stockIntegritySlot: ReactNode;
}

export function CommandCenterClient({
  systemHealthSlot,
  stockIntegritySlot,
}: CommandCenterClientProps) {
  const [activeTab, setActiveTab] = useState<TabType>('activities');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [filters, setFilters] = useState<CommandCenterFilters>({
    page: 1,
    limit: 100,
    sort_by: 'logged_at',
    sort_dir: 'desc',
  });

  const { activities, total, page, totalPages, isLoading, mutate } = useCommandCenter(filters, autoRefresh);
  const { filterOptions } = useCommandCenterFilters();

  const handleFiltersChange = useCallback((newFilters: CommandCenterFilters) => {
    setFilters(newFilters);
  }, []);

  const handleRefresh = useCallback(() => {
    mutate();
  }, [mutate]);

  const handleAutoRefreshToggle = useCallback(() => {
    setAutoRefresh(prev => !prev);
  }, []);

  return (
    <div className="space-y-3">
      {/* Tabs */}
      <div className="flex border-b">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-thai border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600 font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'activities' && (
        <div className="space-y-3">
          <ActivityFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
            filterOptions={filterOptions}
            autoRefresh={autoRefresh}
            onAutoRefreshToggle={handleAutoRefreshToggle}
            onRefresh={handleRefresh}
            total={total}
            isLoading={isLoading}
          />
          <ActivityDataGrid
            activities={activities}
            total={total}
            page={page}
            totalPages={totalPages}
            isLoading={isLoading}
            filters={filters}
            onFiltersChange={handleFiltersChange}
          />
        </div>
      )}

      {activeTab === 'errors' && <ErrorDataGrid />}

      {activeTab === 'health' && (
        <div className="space-y-4">{systemHealthSlot}</div>
      )}

      {activeTab === 'stock' && (
        <div className="space-y-4">{stockIntegritySlot}</div>
      )}
    </div>
  );
}
