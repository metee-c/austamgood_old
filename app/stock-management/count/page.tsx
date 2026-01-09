'use client';

import React, { useState } from 'react';
import {
  FileText,
  Eye,
  AlertCircle,
  Check,
  X,
  AlertTriangle,
  Plus,
  ClipboardList,
  RefreshCw,
} from 'lucide-react';
import { PageContainer, PageHeaderWithFilters, SearchInput, FilterSelect, PaginationBar } from '@/components/ui/page-components';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import { format } from 'date-fns';
import useSWR from 'swr';

interface CountItem {
  id: number;
  location_code: string;
  expected_pallet_id: string | null;
  expected_sku_code: string | null;
  expected_sku_name: string | null;
  expected_quantity: number | null;
  scanned_pallet_id: string | null;
  actual_sku_code: string | null;
  actual_sku_name: string | null;
  actual_quantity: number | null;
  status: 'pending' | 'matched' | 'mismatched' | 'empty' | 'extra';
  counted_at: string | null;
  counted_by: string | null;
  notes: string | null;
}

interface Session {
  id: number;
  session_code: string;
  warehouse_id: string;
  status: 'in_progress' | 'completed' | 'cancelled';
  total_locations: number;
  matched_count: number;
  mismatched_count: number;
  empty_count: number;
  extra_count: number;
  created_at: string;
  completed_at: string | null;
  counted_by: string | null;
  items?: CountItem[];
}

type SessionStatus = 'in_progress' | 'completed' | 'cancelled' | 'all';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function StockCountReportPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<SessionStatus>('all');
  const [viewingSession, setViewingSession] = useState<Session | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // Build query params
  const queryParams = new URLSearchParams();
  if (statusFilter !== 'all') queryParams.set('status', statusFilter);
  if (searchTerm) queryParams.set('search', searchTerm);

  const { data, isLoading, error, mutate } = useSWR<{ success: boolean; data: Session[] }>(
    `/api/stock-count/sessions?${queryParams.toString()}`,
    fetcher
  );

  const sessions = data?.data || [];

  const handleView = async (session: Session) => {
    // Load session detail with items
    const res = await fetch(`/api/stock-count/sessions/${session.id}`);
    const detail = await res.json();
    if (detail.success) {
      setViewingSession(detail.data);
    }
  };

  // Status options
  const statusOptions = [
    { value: 'all', label: 'ทุกสถานะ' },
    { value: 'in_progress', label: 'กำลังนับ' },
    { value: 'completed', label: 'เสร็จสิ้น' },
    { value: 'cancelled', label: 'ยกเลิก' },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_progress':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-yellow-100 text-yellow-800 font-thai">กำลังนับ</span>;
      case 'completed':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-800 font-thai">เสร็จสิ้น</span>;
      case 'cancelled':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-800 font-thai">ยกเลิก</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-800 font-thai">{status}</span>;
    }
  };

  const getItemStatusBadge = (status: string) => {
    switch (status) {
      case 'matched':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-800"><Check className="w-3 h-3" />ถูกต้อง</span>;
      case 'mismatched':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-800"><X className="w-3 h-3" />ไม่ตรง</span>;
      case 'empty':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-yellow-100 text-yellow-800"><AlertTriangle className="w-3 h-3" />ว่าง</span>;
      case 'extra':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-800"><Plus className="w-3 h-3" />เพิ่มเติม</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-800">รอนับ</span>;
    }
  };

  // Calculate totals
  const totalMatched = sessions.reduce((sum, s) => sum + (s.matched_count || 0), 0);
  const totalMismatched = sessions.reduce((sum, s) => sum + (s.mismatched_count || 0), 0);
  const totalEmpty = sessions.reduce((sum, s) => sum + (s.empty_count || 0), 0);
  const totalExtra = sessions.reduce((sum, s) => sum + (s.extra_count || 0), 0);

  return (
    <PageContainer>
      {/* Header + Filters */}
      <PageHeaderWithFilters title="รายงานนับสต็อก (Stock Count)">
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="ค้นหาเลขที่รอบนับ..."
        />
        <FilterSelect
          value={statusFilter}
          onChange={(value) => setStatusFilter(value as SessionStatus)}
          options={statusOptions}
        />
        <Button
          variant="secondary"
          size="sm"
          icon={RefreshCw}
          onClick={() => mutate()}
          className="text-xs py-1 px-3"
        >
          รีเฟรช
        </Button>
        <Button
          variant="primary"
          size="sm"
          icon={ClipboardList}
          onClick={() => window.open('/mobile/stock-count', '_blank')}
          className="text-xs py-1 px-3 bg-blue-500 hover:bg-blue-600 shadow-lg"
        >
          เริ่มนับสต็อก (Mobile)
        </Button>
      </PageHeaderWithFilters>

      {/* Summary Cards */}
      {sessions.length > 0 && (
        <div className="grid grid-cols-5 gap-4 mb-4">
          <div className="bg-white rounded-lg shadow-sm p-4 text-center">
            <p className="text-2xl font-bold">{sessions.length}</p>
            <p className="text-xs text-gray-500 font-thai">รอบนับทั้งหมด</p>
          </div>
          <div className="bg-green-50 rounded-lg shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{totalMatched}</p>
            <p className="text-xs text-green-600 font-thai">ถูกต้อง</p>
          </div>
          <div className="bg-red-50 rounded-lg shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{totalMismatched}</p>
            <p className="text-xs text-red-600 font-thai">ไม่ตรง</p>
          </div>
          <div className="bg-yellow-50 rounded-lg shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{totalEmpty}</p>
            <p className="text-xs text-yellow-600 font-thai">ว่าง (ในระบบมี)</p>
          </div>
          <div className="bg-blue-50 rounded-lg shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{totalExtra}</p>
            <p className="text-xs text-blue-600 font-thai">เพิ่มเติม</p>
          </div>
        </div>
      )}

      {/* Table Container */}
      <div className="flex-1 min-h-0 bg-white border rounded-lg shadow-sm flex flex-col overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center flex-1 text-thai-gray-400">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
            <p className="text-sm font-thai">กำลังโหลดข้อมูล...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center flex-1 text-red-500">
            <AlertCircle className="w-12 h-12 mb-2" />
            <p className="text-sm font-thai">เกิดข้อผิดพลาด</p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <Table>
              <Table.Header>
                <tr>
                  <Table.Head>เลขที่รอบนับ</Table.Head>
                  <Table.Head>คลัง</Table.Head>
                  <Table.Head width="100px">สถานะ</Table.Head>
                  <Table.Head className="text-center">โลเคชั่น</Table.Head>
                  <Table.Head className="text-center">ถูกต้อง</Table.Head>
                  <Table.Head className="text-center">ไม่ตรง</Table.Head>
                  <Table.Head className="text-center">ว่าง</Table.Head>
                  <Table.Head className="text-center">เพิ่มเติม</Table.Head>
                  <Table.Head>วันที่สร้าง</Table.Head>
                  <Table.Head>วันที่เสร็จ</Table.Head>
                  <Table.Head width="80px">จัดการ</Table.Head>
                </tr>
              </Table.Header>
              <Table.Body>
                {sessions.length > 0 ? (
                  sessions.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((session) => (
                    <SessionRow
                      key={session.id}
                      session={session}
                      onView={handleView}
                      getStatusBadge={getStatusBadge}
                    />
                  ))
                ) : (
                  <tr>
                    <Table.Cell colSpan={11} className="px-4 py-8 text-center">
                      <div className="flex flex-col items-center justify-center text-thai-gray-400">
                        <FileText className="w-12 h-12 mb-2" />
                        <p className="text-sm font-thai">ไม่พบข้อมูลการนับสต็อก</p>
                        <p className="text-xs text-thai-gray-400 mt-1 font-thai">
                          คลิก "เริ่มนับสต็อก" เพื่อเริ่มต้น
                        </p>
                      </div>
                    </Table.Cell>
                  </tr>
                )}
              </Table.Body>
            </Table>
          </div>
        )}
        <PaginationBar
          currentPage={currentPage}
          totalItems={sessions.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Detail Modal */}
      {viewingSession && (
        <SessionDetailModal
          session={viewingSession}
          onClose={() => setViewingSession(null)}
          getItemStatusBadge={getItemStatusBadge}
        />
      )}
    </PageContainer>
  );
}

// Session Row Component
function SessionRow({
  session,
  onView,
  getStatusBadge,
}: {
  session: Session;
  onView: (session: Session) => void;
  getStatusBadge: (status: string) => React.ReactNode;
}) {
  const totalItems = (session.matched_count || 0) + (session.mismatched_count || 0) + (session.empty_count || 0) + (session.extra_count || 0);

  return (
    <tr className="hover:bg-thai-gray-50 transition-colors">
      <td className="px-3 py-2 whitespace-nowrap">
        <span className="text-xs font-medium text-thai-gray-900 font-thai">
          {session.session_code}
        </span>
      </td>
      <td className="px-3 py-2 whitespace-nowrap text-xs text-thai-gray-700 font-thai">
        {session.warehouse_id}
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        {getStatusBadge(session.status)}
      </td>
      <td className="px-3 py-2 whitespace-nowrap text-center">
        <span className="text-xs font-bold text-gray-600">{session.total_locations || 0}</span>
      </td>
      <td className="px-3 py-2 whitespace-nowrap text-center">
        <span className="text-xs font-bold text-green-600">{session.matched_count || 0}</span>
      </td>
      <td className="px-3 py-2 whitespace-nowrap text-center">
        <span className="text-xs font-bold text-red-600">{session.mismatched_count || 0}</span>
      </td>
      <td className="px-3 py-2 whitespace-nowrap text-center">
        <span className="text-xs font-bold text-yellow-600">{session.empty_count || 0}</span>
      </td>
      <td className="px-3 py-2 whitespace-nowrap text-center">
        <span className="text-xs font-bold text-blue-600">{session.extra_count || 0}</span>
      </td>
      <td className="px-3 py-2 whitespace-nowrap text-xs text-thai-gray-700 font-thai">
        {format(new Date(session.created_at), 'dd/MM/yyyy HH:mm')}
      </td>
      <td className="px-3 py-2 whitespace-nowrap text-xs text-thai-gray-700 font-thai">
        {session.completed_at ? format(new Date(session.completed_at), 'dd/MM/yyyy HH:mm') : '-'}
      </td>
      <td className="px-3 py-2 whitespace-nowrap text-right text-xs font-medium">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => onView(session)}
            className="text-thai-primary hover:text-thai-primary-dark p-2 rounded-lg hover:bg-thai-primary/10 transition-colors"
            title="ดูรายละเอียด"
            disabled={totalItems === 0}
          >
            <Eye className={`w-4 h-4 ${totalItems === 0 ? 'opacity-30' : ''}`} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// Session Detail Modal
function SessionDetailModal({
  session,
  onClose,
  getItemStatusBadge,
}: {
  session: Session;
  onClose: () => void;
  getItemStatusBadge: (status: string) => React.ReactNode;
}) {
  const items = session.items || [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold font-thai">รายละเอียดการนับสต็อก</h2>
            <p className="text-sm text-gray-500">{session.session_code}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary */}
        <div className="px-6 py-4 border-b bg-gray-50">
          <div className="grid grid-cols-5 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{items.length}</p>
              <p className="text-xs text-gray-500 font-thai">รายการทั้งหมด</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{session.matched_count || 0}</p>
              <p className="text-xs text-green-600 font-thai">ถูกต้อง</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{session.mismatched_count || 0}</p>
              <p className="text-xs text-red-600 font-thai">ไม่ตรง</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">{session.empty_count || 0}</p>
              <p className="text-xs text-yellow-600 font-thai">ว่าง (ในระบบมี)</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{session.extra_count || 0}</p>
              <p className="text-xs text-blue-600 font-thai">เพิ่มเติม</p>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-600 font-thai">#</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-600 font-thai">โลเคชั่น</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-600 font-thai">พาเลท (คาดหวัง)</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-600 font-thai">พาเลท (สแกน)</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-600 font-thai">SKU</th>
                <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-600 font-thai">จำนวน (คาดหวัง)</th>
                <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-600 font-thai">จำนวน (จริง)</th>
                <th className="px-3 py-2 text-center text-[10px] font-medium text-gray-600 font-thai">สถานะ</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-600 font-thai">เวลานับ</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-600 font-thai">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {items.length > 0 ? (
                items.map((item, idx) => (
                  <tr key={item.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 text-[10px] text-gray-500">{idx + 1}</td>
                    <td className="px-3 py-2 text-xs font-mono text-gray-900">{item.location_code}</td>
                    <td className="px-3 py-2 text-xs font-mono text-gray-700">{item.expected_pallet_id || '-'}</td>
                    <td className="px-3 py-2 text-xs font-mono text-gray-700">{item.scanned_pallet_id || '-'}</td>
                    <td className="px-3 py-2">
                      <div className="text-xs text-gray-900 font-thai">{item.expected_sku_name || item.actual_sku_name || '-'}</div>
                      <div className="text-[10px] text-gray-500">{item.expected_sku_code || item.actual_sku_code || ''}</div>
                    </td>
                    <td className="px-3 py-2 text-xs text-right font-mono">{item.expected_quantity?.toLocaleString() || '-'}</td>
                    <td className="px-3 py-2 text-xs text-right font-mono">{item.actual_quantity?.toLocaleString() || '-'}</td>
                    <td className="px-3 py-2 text-center">{getItemStatusBadge(item.status)}</td>
                    <td className="px-3 py-2 text-[10px] text-gray-500">
                      {item.counted_at ? format(new Date(item.counted_at), 'HH:mm:ss') : '-'}
                    </td>
                    <td className="px-3 py-2 text-[10px] text-gray-500 font-thai max-w-[150px] truncate">{item.notes || '-'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-400 font-thai">
                    ยังไม่มีรายการที่สแกน
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-thai"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}
