'use client';

import { useState, useEffect, ReactNode } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  Package
} from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  className?: string;
  headerClassName?: string;
  render?: (item: T, index: number) => ReactNode;
  align?: 'left' | 'center' | 'right';
}

export interface DataTableWithPaginationProps<T> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  error?: string | null;
  pageSize?: number;
  emptyIcon?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  getRowKey?: (item: T, index: number) => string;
  getRowClassName?: (item: T, index: number) => string;
  onRowClick?: (item: T, index: number) => void;
}

export default function DataTableWithPagination<T>({
  data,
  columns,
  loading = false,
  error = null,
  pageSize = 100,
  emptyIcon,
  emptyTitle = 'ไม่พบข้อมูล',
  emptyDescription = 'ลองปรับเปลี่ยนตัวกรองหรือค้นหาใหม่',
  getRowKey,
  getRowClassName,
  onRowClick
}: DataTableWithPaginationProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);

  // Reset page when data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [data.length]);

  const totalPages = Math.ceil(data.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(currentPage * pageSize, data.length);
  const paginatedData = data.slice(startIndex, endIndex);

  const getAlignClass = (align?: 'left' | 'center' | 'right') => {
    switch (align) {
      case 'center': return 'text-center';
      case 'right': return 'text-right';
      default: return 'text-left';
    }
  };

  return (
    <div className="w-full flex-1 min-h-0 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col overflow-hidden">
      {loading ? (
        <div className="h-full flex flex-col items-center justify-center text-thai-gray-500 gap-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          <p className="text-sm font-thai">กำลังโหลดข้อมูล...</p>
        </div>
      ) : error ? (
        <div className="h-full flex flex-col items-center justify-center text-red-500 gap-2">
          <p className="text-sm font-thai">{error}</p>
        </div>
      ) : data.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-thai-gray-500 gap-4">
          {emptyIcon || <Package className="w-12 h-12" />}
          <div className="text-center">
            <p className="text-sm font-medium font-thai">{emptyTitle}</p>
            <p className="text-xs text-thai-gray-400 mt-1 font-thai">{emptyDescription}</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto thin-scrollbar">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-gray-100">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-2 py-2 text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap ${getAlignClass(col.align)} ${col.headerClassName || ''}`}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100 text-[11px]">
              {paginatedData.map((item, idx) => {
                const actualIndex = startIndex + idx;
                const rowKey = getRowKey ? getRowKey(item, actualIndex) : `row-${actualIndex}`;
                const rowClassName = getRowClassName ? getRowClassName(item, actualIndex) : '';
                
                return (
                  <tr
                    key={rowKey}
                    className={`hover:bg-blue-50/30 transition-colors duration-150 ${rowClassName} ${onRowClick ? 'cursor-pointer' : ''}`}
                    onClick={() => onRowClick?.(item, actualIndex)}
                  >
                    {columns.map((col) => (
                      <td
                        key={`${rowKey}-${col.key}`}
                        className={`px-2 py-0.5 border-r border-gray-100 whitespace-nowrap ${getAlignClass(col.align)} ${col.className || ''}`}
                      >
                        {col.render ? col.render(item, actualIndex) : (item as any)[col.key]}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Bar - Always at bottom */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-1 border-t border-gray-200 bg-gray-50 rounded-b-lg text-xs">
        <div className="text-sm text-thai-gray-600 font-thai">
          {loading ? 'กำลังโหลด...' : 
           error ? 'เกิดข้อผิดพลาด' :
           data.length === 0 ? 'ไม่พบข้อมูล' :
           `แสดง ${startIndex + 1} - ${endIndex} จาก ${data.length.toLocaleString()} รายการ`}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1 || data.length === 0}
            className="p-1.5 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="หน้าแรก"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage === 1 || data.length === 0}
            className="p-1.5 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="หน้าก่อนหน้า"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-3 py-1 text-sm font-thai">
            หน้า {data.length === 0 ? 0 : currentPage} / {Math.max(1, totalPages)}
          </span>
          <button
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage >= totalPages || data.length === 0}
            className="p-1.5 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="หน้าถัดไป"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage >= totalPages || data.length === 0}
            className="p-1.5 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="หน้าสุดท้าย"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
