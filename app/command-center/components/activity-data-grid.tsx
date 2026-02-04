'use client';

import { useState, useCallback, Fragment } from 'react';
import {
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, Loader2, AlertTriangle,
  ChevronRight as Expand
} from 'lucide-react';
import { CommandCenterActivity, CommandCenterFilters } from '../types';

interface ActivityDataGridProps {
  activities: CommandCenterActivity[];
  total: number;
  page: number;
  totalPages: number;
  isLoading: boolean;
  filters: CommandCenterFilters;
  onFiltersChange: (filters: CommandCenterFilters) => void;
}

// Column definitions
const COLUMNS = [
  { key: 'logged_at', label: 'เวลา', width: 150, sortable: true },
  { key: 'user_full_name', label: 'ผู้ใช้', width: 110, sortable: false },
  { key: 'activity_status', label: 'สถานะ', width: 75, sortable: true },
  { key: 'request_method', label: 'Method', width: 65, sortable: false },
  { key: 'operation_type', label: 'Operation', width: 140, sortable: true },
  { key: 'request_path', label: 'Path', width: 220, sortable: true },
  { key: 'entity_type', label: 'Entity', width: 100, sortable: true },
  { key: 'entity_id', label: 'Entity ID', width: 90, sortable: false },
  { key: 'entity_no', label: 'เลขที่', width: 120, sortable: false },
  { key: 'sku_id', label: 'SKU', width: 110, sortable: false },
  { key: 'location_id', label: 'Location', width: 100, sortable: false },
  { key: 'pallet_id', label: 'Pallet', width: 100, sortable: false },
  { key: 'warehouse_id', label: 'คลัง', width: 80, sortable: false },
  { key: 'qty_before', label: 'ก่อน', width: 70, sortable: false },
  { key: 'qty_after', label: 'หลัง', width: 70, sortable: false },
  { key: 'qty_delta', label: 'เปลี่ยน', width: 70, sortable: false },
  { key: 'duration_ms', label: 'ms', width: 65, sortable: true },
  { key: 'error_message', label: 'Error', width: 250, sortable: false },
] as const;

function formatTimestamp(ts: string | null): string {
  if (!ts) return '-';
  try {
    const d = new Date(ts);
    return d.toLocaleString('th-TH', {
      year: '2-digit', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch {
    return ts;
  }
}

function getStatusStyle(status: string): string {
  switch (status) {
    case 'success': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    case 'failed': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    case 'partial': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    default: return 'bg-gray-100 text-gray-800';
  }
}

function getMethodStyle(method: string | null): string {
  switch (method) {
    case 'GET': return 'text-blue-600';
    case 'POST': return 'text-green-600';
    case 'PUT': case 'PATCH': return 'text-orange-600';
    case 'DELETE': return 'text-red-600';
    default: return 'text-gray-600';
  }
}

function getRowBg(status: string): string {
  switch (status) {
    case 'failed': return 'bg-red-50/50 dark:bg-red-950/10 hover:bg-red-100/50';
    case 'partial': return 'bg-yellow-50/50 dark:bg-yellow-950/10 hover:bg-yellow-100/50';
    default: return 'hover:bg-accent/50';
  }
}

function formatNumber(val: number | null): string {
  if (val === null || val === undefined) return '';
  return Number(val).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function CellValue({ activity, colKey }: { activity: CommandCenterActivity; colKey: string }) {
  const val = (activity as any)[colKey];

  switch (colKey) {
    case 'logged_at':
      return <span className="text-xs whitespace-nowrap">{formatTimestamp(val)}</span>;

    case 'user_full_name':
      return (
        <span className="text-xs truncate" title={val || activity.username || ''}>
          {val || activity.username || '-'}
        </span>
      );

    case 'activity_status':
      return (
        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${getStatusStyle(val)}`}>
          {val}
        </span>
      );

    case 'request_method':
      return (
        <span className={`text-xs font-mono font-bold ${getMethodStyle(val)}`}>
          {val || '-'}
        </span>
      );

    case 'request_path':
      return (
        <span className="text-xs font-mono truncate" title={val || ''}>
          {val ? val.replace('/api/', '') : '-'}
        </span>
      );

    case 'qty_before':
    case 'qty_after':
      return <span className="text-xs text-right font-mono">{formatNumber(val)}</span>;

    case 'qty_delta':
      if (val === null || val === undefined) return <span className="text-xs">-</span>;
      const num = Number(val);
      return (
        <span className={`text-xs font-mono font-medium ${
          num > 0 ? 'text-green-600' : num < 0 ? 'text-red-600' : 'text-gray-500'
        }`}>
          {num > 0 ? '+' : ''}{formatNumber(val)}
        </span>
      );

    case 'duration_ms':
      if (val === null || val === undefined) return <span className="text-xs">-</span>;
      return (
        <span className={`text-xs font-mono ${Number(val) > 5000 ? 'text-red-600 font-bold' : Number(val) > 1000 ? 'text-orange-600' : 'text-gray-600'}`}>
          {Number(val).toLocaleString()}
        </span>
      );

    case 'error_message':
      if (!val) return <span className="text-xs text-gray-400">-</span>;
      return (
        <span className="text-xs text-red-600 truncate" title={val}>
          {activity.error_code ? `[${activity.error_code}] ` : ''}{val}
        </span>
      );

    default:
      return (
        <span className="text-xs truncate" title={val || ''}>
          {val || '-'}
        </span>
      );
  }
}

export function ActivityDataGrid({
  activities,
  total,
  page,
  totalPages,
  isLoading,
  filters,
  onFiltersChange,
}: ActivityDataGridProps) {
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const handleSort = useCallback((key: string) => {
    const isCurrentSort = filters.sort_by === key;
    const newDir = isCurrentSort && filters.sort_dir === 'desc' ? 'asc' : 'desc';
    onFiltersChange({ ...filters, sort_by: key, sort_dir: newDir });
  }, [filters, onFiltersChange]);

  const handlePageChange = useCallback((newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    onFiltersChange({ ...filters, page: newPage });
  }, [filters, totalPages, onFiltersChange]);

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left" style={{ minWidth: '1800px' }}>
          {/* Header */}
          <thead className="bg-muted/50 sticky top-0 z-10">
            <tr>
              <th className="w-6 px-1 py-2" />
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  style={{ width: col.width, minWidth: col.width }}
                  className={`px-2 py-2 text-xs font-medium text-muted-foreground border-b ${
                    col.sortable ? 'cursor-pointer hover:text-foreground select-none' : ''
                  }`}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <div className="flex items-center gap-1">
                    <span className="font-thai">{col.label}</span>
                    {col.sortable && filters.sort_by === col.key && (
                      filters.sort_dir === 'desc'
                        ? <ChevronDown className="h-3 w-3" />
                        : <ChevronUp className="h-3 w-3" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {isLoading && activities.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="text-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground font-thai">กำลังโหลด...</span>
                </td>
              </tr>
            ) : activities.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="text-center py-12">
                  <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground font-thai">ไม่พบข้อมูล</span>
                </td>
              </tr>
            ) : (
              activities.map((activity) => (
                <Fragment key={activity.log_id}>
                  <tr
                    className={`border-b border-border/50 transition-colors cursor-pointer ${getRowBg(activity.activity_status)}`}
                    onClick={() => setExpandedRow(expandedRow === activity.log_id ? null : activity.log_id)}
                  >
                    <td className="px-1 py-1.5">
                      <Expand
                        className={`h-3 w-3 text-muted-foreground transition-transform ${
                          expandedRow === activity.log_id ? 'rotate-90' : ''
                        }`}
                      />
                    </td>
                    {COLUMNS.map(col => (
                      <td
                        key={col.key}
                        style={{ width: col.width, maxWidth: col.width }}
                        className="px-2 py-1.5 overflow-hidden"
                      >
                        <CellValue activity={activity} colKey={col.key} />
                      </td>
                    ))}
                  </tr>
                  {/* Expanded Detail Row */}
                  {expandedRow === activity.log_id && (
                    <tr key={`${activity.log_id}-detail`} className="bg-muted/30">
                      <td colSpan={COLUMNS.length + 1} className="px-4 py-3">
                        <ExpandedDetail activity={activity} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/30">
          <div className="text-xs text-muted-foreground font-thai">
            หน้า {page} จาก {totalPages} ({total.toLocaleString()} รายการ)
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePageChange(1)}
              disabled={page <= 1}
              className="p-1 rounded hover:bg-accent disabled:opacity-30"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1}
              className="p-1 rounded hover:bg-accent disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs px-2">{page}</span>
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages}
              className="p-1 rounded hover:bg-accent disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => handlePageChange(totalPages)}
              disabled={page >= totalPages}
              className="p-1 rounded hover:bg-accent disabled:opacity-30"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Expanded row detail
function ExpandedDetail({ activity }: { activity: CommandCenterActivity }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
      <div>
        <span className="text-muted-foreground">Transaction ID:</span>
        <p className="font-mono text-[10px] break-all">{activity.transaction_id || '-'}</p>
      </div>
      <div>
        <span className="text-muted-foreground">IP Address:</span>
        <p className="font-mono">{activity.ip_address || '-'}</p>
      </div>
      <div>
        <span className="text-muted-foreground">Reserved Before/After:</span>
        <p>{formatNumber(activity.reserved_before)} / {formatNumber(activity.reserved_after)}</p>
      </div>
      <div>
        <span className="text-muted-foreground">Transaction Status:</span>
        <p>{activity.transaction_status || '-'}</p>
      </div>

      {activity.remarks && (
        <div className="col-span-2">
          <span className="text-muted-foreground">Remarks:</span>
          <p>{activity.remarks}</p>
        </div>
      )}

      {activity.error_message && (
        <div className="col-span-full">
          <span className="text-muted-foreground text-red-600">Error:</span>
          <p className="text-red-600 bg-red-50 dark:bg-red-950/20 p-2 rounded mt-1 font-mono text-[11px] whitespace-pre-wrap">
            {activity.error_code && `[${activity.error_code}] `}{activity.error_message}
          </p>
        </div>
      )}

      {activity.metadata && Object.keys(activity.metadata).length > 0 && (
        <div className="col-span-full">
          <span className="text-muted-foreground">Metadata:</span>
          <pre className="bg-muted p-2 rounded mt-1 text-[10px] font-mono overflow-x-auto max-h-40">
            {JSON.stringify(activity.metadata, null, 2)}
          </pre>
        </div>
      )}

      {activity.request_body && Object.keys(activity.request_body).length > 0 && (
        <div className="col-span-full">
          <span className="text-muted-foreground">Request Body (summary):</span>
          <pre className="bg-muted p-2 rounded mt-1 text-[10px] font-mono overflow-x-auto max-h-40">
            {JSON.stringify(activity.request_body, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
