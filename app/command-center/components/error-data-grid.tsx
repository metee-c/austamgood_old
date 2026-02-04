'use client';

import { useState, useCallback, Fragment } from 'react';
import useSWR from 'swr';
import {
  AlertTriangle, Loader2, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, RefreshCw, ChevronRight as Expand
} from 'lucide-react';
import { CommandCenterError } from '../types';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function ErrorDataGrid() {
  const [page, setPage] = useState(1);
  const [limit] = useState(50);

  const { data, error, isLoading, mutate } = useSWR(
    `/api/command-center/errors?page=${page}&limit=${limit}`,
    fetcher,
    { refreshInterval: 15000, revalidateOnFocus: false }
  );

  const errors: CommandCenterError[] = data?.data || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground font-thai">
          {total.toLocaleString()} ข้อผิดพลาด
        </div>
        <button
          onClick={() => mutate()}
          disabled={isLoading}
          className="p-2 border rounded-md hover:bg-accent disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="border rounded-lg overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left" style={{ minWidth: '1200px' }}>
            <thead className="bg-red-50/50 dark:bg-red-950/20 sticky top-0 z-10">
              <tr>
                <th className="w-6 px-1 py-2" />
                <th className="px-2 py-2 text-xs font-medium text-muted-foreground border-b w-[150px] font-thai">เวลา</th>
                <th className="px-2 py-2 text-xs font-medium text-muted-foreground border-b w-[100px]">Error Code</th>
                <th className="px-2 py-2 text-xs font-medium text-muted-foreground border-b w-[120px]">Operation</th>
                <th className="px-2 py-2 text-xs font-medium text-muted-foreground border-b w-[200px]">Path</th>
                <th className="px-2 py-2 text-xs font-medium text-muted-foreground border-b w-[100px] font-thai">ผู้ใช้</th>
                <th className="px-2 py-2 text-xs font-medium text-muted-foreground border-b font-thai">ข้อความ</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && errors.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground font-thai">กำลังโหลด...</span>
                  </td>
                </tr>
              ) : errors.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <div className="text-green-600">
                      <AlertTriangle className="h-6 w-6 mx-auto mb-2" />
                      <span className="text-sm font-thai">ไม่พบข้อผิดพลาด</span>
                    </div>
                  </td>
                </tr>
              ) : (
                errors.map((err) => (
                  <Fragment key={err.error_id}>
                    <tr
                      className="border-b border-border/50 bg-red-50/30 dark:bg-red-950/5 hover:bg-red-100/30 cursor-pointer"
                      onClick={() => setExpandedRow(expandedRow === err.error_id ? null : err.error_id)}
                    >
                      <td className="px-1 py-1.5">
                        <Expand
                          className={`h-3 w-3 text-muted-foreground transition-transform ${
                            expandedRow === err.error_id ? 'rotate-90' : ''
                          }`}
                        />
                      </td>
                      <td className="px-2 py-1.5 text-xs whitespace-nowrap">
                        {err.occurred_at ? new Date(err.occurred_at).toLocaleString('th-TH', {
                          year: '2-digit', month: '2-digit', day: '2-digit',
                          hour: '2-digit', minute: '2-digit', second: '2-digit',
                        }) : '-'}
                      </td>
                      <td className="px-2 py-1.5">
                        <span className="text-xs font-mono bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 px-1.5 py-0.5 rounded">
                          {err.error_code || 'UNKNOWN'}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-xs">{err.operation_type || '-'}</td>
                      <td className="px-2 py-1.5 text-xs font-mono truncate max-w-[200px]" title={err.request_path || ''}>
                        {err.request_path ? err.request_path.replace('/api/', '') : '-'}
                      </td>
                      <td className="px-2 py-1.5 text-xs truncate">
                        {err.user_full_name || err.username || '-'}
                      </td>
                      <td className="px-2 py-1.5 text-xs text-red-700 dark:text-red-400 truncate max-w-[400px]" title={err.error_message}>
                        {err.error_message}
                      </td>
                    </tr>
                    {expandedRow === err.error_id && (
                      <tr key={`${err.error_id}-detail`} className="bg-muted/30">
                        <td colSpan={7} className="px-4 py-3">
                          <div className="space-y-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">Transaction ID:</span>
                              <span className="ml-2 font-mono text-[10px]">{err.transaction_id || '-'}</span>
                            </div>
                            {err.entity_type && (
                              <div>
                                <span className="text-muted-foreground">Entity:</span>
                                <span className="ml-2">{err.entity_type} #{err.entity_id}</span>
                              </div>
                            )}
                            {err.error_stack && (
                              <div>
                                <span className="text-muted-foreground">Stack Trace:</span>
                                <pre className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-2 rounded mt-1 text-[10px] font-mono overflow-x-auto max-h-60 whitespace-pre-wrap">
                                  {err.error_stack}
                                </pre>
                              </div>
                            )}
                            {err.request_body && (
                              <div>
                                <span className="text-muted-foreground">Request Body:</span>
                                <pre className="bg-muted p-2 rounded mt-1 text-[10px] font-mono overflow-x-auto max-h-40">
                                  {JSON.stringify(err.request_body, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/30">
            <div className="text-xs text-muted-foreground font-thai">
              หน้า {page} จาก {totalPages}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(1)} disabled={page <= 1} className="p-1 rounded hover:bg-accent disabled:opacity-30">
                <ChevronsLeft className="h-4 w-4" />
              </button>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="p-1 rounded hover:bg-accent disabled:opacity-30">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs px-2">{page}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-1 rounded hover:bg-accent disabled:opacity-30">
                <ChevronRight className="h-4 w-4" />
              </button>
              <button onClick={() => setPage(totalPages)} disabled={page >= totalPages} className="p-1 rounded hover:bg-accent disabled:opacity-30">
                <ChevronsRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
