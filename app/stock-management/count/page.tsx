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

interface PrepAreaCountItem {
  id: number;
  sku_code: string;
  sku_name: string | null;
  quantity: number;
  counted_at: string | null;
  counted_by: string | null;
}

interface PremiumOcrItem {
  id: number;
  barcode_id: string;
  face_sheet_no: string | null;
  pack_no: string | null;
  shop_name: string | null;
  hub: string | null;
  lot_no: string | null;
  storage_location: string | null;
  created_at: string | null;
  counted_by: string | null;
}

interface Session {
  id: number;
  session_code: string;
  warehouse_id: string;
  count_type?: 'standard' | 'prep_area' | 'premium_ocr';
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
  prepAreaItems?: PrepAreaCountItem[];
  premiumOcrItems?: PremiumOcrItem[];
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
      const sessionData = detail.data;
      // ถ้าเป็น prep_area ให้ใส่ items ใน prepAreaItems
      if (sessionData.count_type === 'prep_area') {
        sessionData.prepAreaItems = sessionData.items;
        sessionData.items = [];
      } else if (sessionData.count_type === 'premium_ocr') {
        sessionData.premiumOcrItems = sessionData.items;
        sessionData.items = [];
      }
      setViewingSession(sessionData);
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
          onRefresh={() => mutate()}
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
  const isPrepArea = session.count_type === 'prep_area';
  const isPremiumOcr = session.count_type === 'premium_ocr';

  return (
    <tr className="hover:bg-thai-gray-50 transition-colors">
      <td className="px-3 py-2 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-thai-gray-900 font-thai">
            {session.session_code}
          </span>
          {isPrepArea && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-orange-100 text-orange-700 font-thai">
              บ้านหยิบ
            </span>
          )}
          {isPremiumOcr && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-purple-100 text-purple-700 font-thai">
              OCR แพ็คพรีเมียม
            </span>
          )}
        </div>
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
            disabled={totalItems === 0 && !isPrepArea && !isPremiumOcr}
          >
            <Eye className={`w-4 h-4 ${totalItems === 0 && !isPrepArea && !isPremiumOcr ? 'opacity-30' : ''}`} />
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
  onRefresh,
}: {
  session: Session;
  onClose: () => void;
  getItemStatusBadge: (status: string) => React.ReactNode;
  onRefresh?: () => void;
}) {
  const items = session.items || [];
  const prepAreaItems = session.prepAreaItems || [];
  const premiumOcrItems = session.premiumOcrItems || [];
  const isPrepArea = session.count_type === 'prep_area';
  const isPremiumOcr = session.count_type === 'premium_ocr';
  const [viewMode, setViewMode] = useState<'items' | 'compare'>('items');
  const [comparison, setComparison] = useState<any>(null);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [creatingAdjustment, setCreatingAdjustment] = useState(false);

  // โหลดผลเปรียบเทียบ
  const loadComparison = async () => {
    if (!isPrepArea) return;
    setLoadingCompare(true);
    try {
      const res = await fetch(`/api/stock-count/sessions/${session.id}/compare`);
      const data = await res.json();
      if (data.success) {
        setComparison(data.data);
      }
    } catch (error) {
      console.error('Error loading comparison:', error);
    } finally {
      setLoadingCompare(false);
    }
  };

  // สร้างใบปรับสต็อก
  const handleCreateAdjustment = async () => {
    if (!confirm('ยืนยันการสร้างใบปรับสต็อกจากผลนับนี้?')) return;
    
    setCreatingAdjustment(true);
    try {
      const res = await fetch(`/api/stock-count/sessions/${session.id}/create-adjustment`, {
        method: 'POST'
      });
      const data = await res.json();
      
      if (data.success) {
        if (data.data.adjustment_ids?.length > 0) {
          const goToAdjustment = confirm(
            `สร้างใบปรับสต็อกสำเร็จ ${data.data.adjustment_ids.length} ใบ\n\n` +
            `เพิ่ม: ${data.data.increase_count} รายการ\n` +
            `ลด: ${data.data.decrease_count} รายการ\n\n` +
            `ต้องการไปหน้าปรับสต็อกหรือไม่?`
          );
          if (goToAdjustment) {
            window.open('/stock-management/adjustment', '_blank');
          }
          onRefresh?.();
        } else {
          alert(data.message || 'ผลนับตรงกับระบบ ไม่จำเป็นต้องปรับสต็อก');
        }
      } else {
        alert(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch (error) {
      console.error('Error creating adjustment:', error);
      alert('เกิดข้อผิดพลาดในการสร้างใบปรับสต็อก');
    } finally {
      setCreatingAdjustment(false);
    }
  };

  // โหลดผลเปรียบเทียบเมื่อเปลี่ยน tab
  React.useEffect(() => {
    if (viewMode === 'compare' && !comparison && isPrepArea) {
      loadComparison();
    }
  }, [viewMode]);

  const getCompareStatusBadge = (status: string) => {
    switch (status) {
      case 'matched':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-800"><Check className="w-3 h-3" />ตรง</span>;
      case 'over':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-800"><Plus className="w-3 h-3" />เกิน</span>;
      case 'short':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-800"><AlertTriangle className="w-3 h-3" />ขาด</span>;
      case 'missing':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-yellow-100 text-yellow-800"><AlertCircle className="w-3 h-3" />ไม่ได้นับ</span>;
      case 'extra':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-100 text-purple-800"><Plus className="w-3 h-3" />พบเพิ่ม</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold font-thai">รายละเอียดการนับสต็อก</h2>
              {isPrepArea && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700 font-thai">
                  บ้านหยิบ
                </span>
              )}
              {isPremiumOcr && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 font-thai">
                  OCR แพ็คพรีเมียม
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">{session.session_code}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs for prep_area */}
        {isPrepArea && (
          <div className="px-6 pt-4 border-b bg-white">
            <div className="flex gap-4">
              <button
                onClick={() => setViewMode('items')}
                className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
                  viewMode === 'items'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                รายการที่นับ ({prepAreaItems.length})
              </button>
              <button
                onClick={() => setViewMode('compare')}
                className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
                  viewMode === 'compare'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                เปรียบเทียบกับระบบ
              </button>
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="px-6 py-4 border-b bg-gray-50">
          {isPrepArea && viewMode === 'compare' && comparison ? (
            // Summary สำหรับการเปรียบเทียบ
            <div className="grid grid-cols-6 gap-3 text-center">
              <div>
                <p className="text-xl font-bold">{comparison.summary.total_items}</p>
                <p className="text-[10px] text-gray-500 font-thai">รายการทั้งหมด</p>
              </div>
              <div className="bg-green-50 rounded-lg p-2">
                <p className="text-xl font-bold text-green-600">{comparison.summary.matched_count}</p>
                <p className="text-[10px] text-green-600 font-thai">ตรง</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-2">
                <p className="text-xl font-bold text-blue-600">{comparison.summary.over_count}</p>
                <p className="text-[10px] text-blue-600 font-thai">เกิน</p>
              </div>
              <div className="bg-red-50 rounded-lg p-2">
                <p className="text-xl font-bold text-red-600">{comparison.summary.short_count}</p>
                <p className="text-[10px] text-red-600 font-thai">ขาด</p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-2">
                <p className="text-xl font-bold text-yellow-600">{comparison.summary.missing_count}</p>
                <p className="text-[10px] text-yellow-600 font-thai">ไม่ได้นับ</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-2">
                <p className="text-xl font-bold text-purple-600">{comparison.summary.extra_count}</p>
                <p className="text-[10px] text-purple-600 font-thai">พบเพิ่ม</p>
              </div>
            </div>
          ) : isPrepArea ? (
            // Summary สำหรับบ้านหยิบ (รายการที่นับ)
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{prepAreaItems.length}</p>
                <p className="text-xs text-gray-500 font-thai">รายการทั้งหมด</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-600">
                  {prepAreaItems.reduce((sum, item) => sum + (item.quantity || 0), 0).toLocaleString()}
                </p>
                <p className="text-xs text-orange-600 font-thai">จำนวนรวม (ชิ้น)</p>
              </div>
            </div>
          ) : isPremiumOcr ? (
            // Summary สำหรับ premium_ocr
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{premiumOcrItems.length}</p>
                <p className="text-xs text-gray-500 font-thai">แพ็คที่สแกน</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-600">
                  {[...new Set(premiumOcrItems.map(item => item.face_sheet_no))].length}
                </p>
                <p className="text-xs text-purple-600 font-thai">Face Sheet</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">
                  {[...new Set(premiumOcrItems.map(item => item.lot_no).filter(Boolean))].length}
                </p>
                <p className="text-xs text-blue-600 font-thai">โล MR</p>
              </div>
            </div>
          ) : (
            // Summary สำหรับ standard
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
          )}
        </div>

        {/* Items Table */}
        <div className="flex-1 overflow-auto">
          {isPrepArea && viewMode === 'compare' ? (
            // ตารางเปรียบเทียบ
            loadingCompare ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="ml-2 text-sm text-gray-500 font-thai">กำลังโหลด...</span>
              </div>
            ) : comparison ? (
              <table className="w-full">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-600 font-thai">#</th>
                    <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-600 font-thai">รหัส SKU</th>
                    <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-600 font-thai">ชื่อสินค้า</th>
                    <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-600 font-thai">นับได้</th>
                    <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-600 font-thai">ในระบบ</th>
                    <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-600 font-thai">ผลต่าง</th>
                    <th className="px-3 py-2 text-center text-[10px] font-medium text-gray-600 font-thai">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.items.length > 0 ? (
                    comparison.items.map((item: any, idx: number) => (
                      <tr key={idx} className={`border-t border-gray-100 hover:bg-gray-50 ${
                        item.status !== 'matched' ? 'bg-red-50/30' : ''
                      }`}>
                        <td className="px-3 py-2 text-[10px] text-gray-500">{idx + 1}</td>
                        <td className="px-3 py-2 text-xs font-mono text-gray-900">{item.sku_id}</td>
                        <td className="px-3 py-2 text-xs text-gray-700 font-thai">{item.sku_name || '-'}</td>
                        <td className="px-3 py-2 text-sm text-right font-mono font-bold text-orange-600">
                          {item.counted_qty.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-sm text-right font-mono text-gray-600">
                          {item.system_qty.toLocaleString()}
                        </td>
                        <td className={`px-3 py-2 text-sm text-right font-mono font-bold ${
                          item.variance > 0 ? 'text-blue-600' : item.variance < 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {item.variance > 0 ? '+' : ''}{item.variance.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-center">{getCompareStatusBadge(item.status)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-400 font-thai">
                        ไม่มีข้อมูลเปรียบเทียบ
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              <div className="flex items-center justify-center py-12 text-gray-400 font-thai">
                ไม่สามารถโหลดข้อมูลเปรียบเทียบได้
              </div>
            )
          ) : isPrepArea ? (
            // ตารางสำหรับบ้านหยิบ
            <table className="w-full">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-600 font-thai">#</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-600 font-thai">รหัส SKU</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-600 font-thai">ชื่อสินค้า</th>
                  <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-600 font-thai">จำนวน (ชิ้น)</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-600 font-thai">เวลานับ</th>
                </tr>
              </thead>
              <tbody>
                {prepAreaItems.length > 0 ? (
                  prepAreaItems.map((item, idx) => (
                    <tr key={item.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2 text-[10px] text-gray-500">{idx + 1}</td>
                      <td className="px-3 py-2 text-xs font-mono text-gray-900">{item.sku_code}</td>
                      <td className="px-3 py-2 text-xs text-gray-700 font-thai">{item.sku_name || '-'}</td>
                      <td className="px-3 py-2 text-sm text-right font-mono font-bold text-orange-600">
                        {item.quantity?.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-[10px] text-gray-500">
                        {item.counted_at ? format(new Date(item.counted_at), 'HH:mm:ss') : '-'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400 font-thai">
                      ยังไม่มีรายการที่สแกน
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : isPremiumOcr ? (
            // ตารางสำหรับ premium_ocr
            <table className="w-full">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-600 font-thai">#</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-600 font-thai">Barcode ID</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-600 font-thai">Face Sheet</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-600 font-thai">Pack No</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-600 font-thai">ร้านค้า</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-600 font-thai">Hub</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-600 font-thai">โล MR</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-600 font-thai">ตำแหน่งจัดเก็บ</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-600 font-thai">เวลาสแกน</th>
                </tr>
              </thead>
              <tbody>
                {premiumOcrItems.length > 0 ? (
                  premiumOcrItems.map((item, idx) => (
                    <tr key={item.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2 text-[10px] text-gray-500">{idx + 1}</td>
                      <td className="px-3 py-2 text-xs font-mono text-purple-700 font-bold">{item.barcode_id}</td>
                      <td className="px-3 py-2 text-xs font-mono text-gray-700">{item.face_sheet_no || '-'}</td>
                      <td className="px-3 py-2 text-xs text-gray-700">{item.pack_no || '-'}</td>
                      <td className="px-3 py-2 text-xs text-gray-700 font-thai max-w-[120px] truncate">{item.shop_name || '-'}</td>
                      <td className="px-3 py-2 text-xs text-gray-700">{item.hub || '-'}</td>
                      <td className="px-3 py-2 text-xs font-mono text-blue-600 font-bold">{item.lot_no || '-'}</td>
                      <td className="px-3 py-2 text-xs font-mono text-gray-600">{item.storage_location || '-'}</td>
                      <td className="px-3 py-2 text-[10px] text-gray-500">
                        {item.created_at ? format(new Date(item.created_at), 'HH:mm:ss') : '-'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-400 font-thai">
                      ยังไม่มีรายการที่สแกน
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            // ตารางสำหรับ standard
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
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-between items-center">
          <div>
            {isPrepArea && session.status === 'completed' && (
              <button
                onClick={handleCreateAdjustment}
                disabled={creatingAdjustment}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed font-thai flex items-center gap-2"
              >
                {creatingAdjustment ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    กำลังสร้าง...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    สร้างใบปรับสต็อก
                  </>
                )}
              </button>
            )}
          </div>
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
