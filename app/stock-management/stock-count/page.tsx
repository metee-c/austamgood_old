'use client';

import React, { useState, useEffect } from 'react';
import { FileText, Eye, AlertCircle, Check, X, AlertTriangle, Plus, ClipboardList, RefreshCw, Search, ArrowLeft, Package, MapPin, Download } from 'lucide-react';
import { PageContainer, PageHeaderWithFilters, SearchInput, FilterSelect, PaginationBar } from '@/components/ui/page-components';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import { format } from 'date-fns';
import useSWR from 'swr';
import * as XLSX from 'xlsx';

interface Session {
  id: number;
  session_code: string;
  warehouse_id: string;
  count_type?: 'standard' | 'prep_area' | 'premium_ocr' | 'premium_package';
  status: 'in_progress' | 'completed' | 'cancelled';
  total_locations: number;
  matched_count: number;
  mismatched_count: number;
  empty_count: number;
  extra_count: number;
  total_packages?: number; // สำหรับ premium_package
  created_at: string;
  completed_at: string | null;
  counted_by: string | null;
  items?: any[];
}

interface CountItem {
  id: number;
  session_id: number;
  session_code: string;
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

// Premium Package Count Item (บ้านหยิบพรีเมี่ยม)
interface PremiumPackageCountItem {
  id: number;
  session_id: number;
  package_id: number;
  barcode_id: string;
  face_sheet_no: string;
  pack_no: string;
  shop_name: string;
  hub: string;
  expected_location: string;
  actual_location: string;
  location_match: boolean;
  counted_by: string;
  created_at: string;
}

type SessionStatus = 'in_progress' | 'completed' | 'cancelled' | 'all';
type CountType = 'standard' | 'prep_area' | 'premium_ocr' | 'premium_package' | 'all';

const fetcher = (url: string) => fetch(url).then(res => res.json());

function SessionsListView({
  onViewDetail,
  viewMode,
  onViewModeChange,
  searchTerm: externalSearchTerm,
  onSearchChange,
  statusFilter: externalStatusFilter,
  onStatusChange,
  countTypeFilter: externalCountTypeFilter,
  onCountTypeChange
}: {
  onViewDetail: (id: number) => void;
  viewMode: 'sessions' | 'items' | 'detail';
  onViewModeChange: (mode: 'sessions' | 'items' | 'detail') => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  statusFilter: SessionStatus;
  onStatusChange: (status: SessionStatus) => void;
  countTypeFilter: CountType;
  onCountTypeChange: (countType: CountType) => void;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [premiumSessions, setPremiumSessions] = useState<Session[]>([]);
  const [loadingPremium, setLoadingPremium] = useState(false);
  const pageSize = 20;

  // Determine which API to call based on count type filter
  const isPremiumOcr = externalCountTypeFilter === 'premium_ocr';

  const queryParams = new URLSearchParams();
  if (externalStatusFilter !== 'all') queryParams.set('status', externalStatusFilter);
  if (externalCountTypeFilter !== 'all' && externalCountTypeFilter !== 'premium_ocr') {
    queryParams.set('count_type', externalCountTypeFilter);
  }
  if (externalSearchTerm) queryParams.set('search', externalSearchTerm);

  // Fetch regular sessions (when not premium_ocr)
  const { data, isLoading, error, mutate } = useSWR<{ success: boolean; data: Session[] }>(
    !isPremiumOcr ? `/api/stock-count/sessions?${queryParams.toString()}` : null,
    fetcher
  );

  // Fetch premium package sessions
  useEffect(() => {
    if (isPremiumOcr) {
      setLoadingPremium(true);
      const premiumParams = new URLSearchParams();
      if (externalStatusFilter !== 'all') premiumParams.set('status', externalStatusFilter);

      fetch(`/api/stock-count/premium-packages/sessions?${premiumParams.toString()}`)
        .then(res => res.json())
        .then(result => {
          console.log('[PPC] API Response:', result);
          if (result.success && result.data) {
            // Map premium package sessions to Session interface
            const mappedSessions: Session[] = result.data.map((ps: any) => {
              console.log('[PPC] Mapping session:', ps.session_code, {
                matched: ps.matched_count,
                mismatched: ps.mismatched_count
              });
              return {
                id: ps.id,
                session_code: ps.session_code,
                warehouse_id: 'WH001',
                count_type: 'premium_ocr' as const,
                status: ps.status,
                total_locations: ps.total_locations || 1,
                matched_count: ps.matched_count || 0,
                mismatched_count: ps.mismatched_count || 0,
                empty_count: 0, // PPC ไม่มีสถานะว่าง
                extra_count: 0, // PPC ไม่มีสถานะเพิ่มเติม
                created_at: ps.created_at,
                completed_at: ps.completed_at,
                counted_by: ps.counted_by,
                location_code: ps.location_code,
              };
            });
            console.log('[PPC] Mapped sessions:', mappedSessions);
            setPremiumSessions(mappedSessions);
          }
        })
        .catch(err => console.error('Error fetching premium sessions:', err))
        .finally(() => setLoadingPremium(false));
    }
  }, [isPremiumOcr, externalStatusFilter]);

  const sessions = isPremiumOcr ? premiumSessions : (data?.data || []);
  const statusOptions = [
    { value: 'all', label: 'ทุกสถานะ' },
    { value: 'in_progress', label: 'กำลังนับ' },
    { value: 'completed', label: 'เสร็จสิ้น' },
    { value: 'cancelled', label: 'ยกเลิก' },
  ];
  const countTypeOptions = [
    { value: 'all', label: 'ทุกประเภท' },
    { value: 'standard', label: 'มาตรฐาน' },
    { value: 'prep_area', label: 'บ้านหยิบ' },
    { value: 'premium_ocr', label: 'OCR พรีเมี่ยม' },
  ];

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      in_progress: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    const labels: Record<string, string> = {
      in_progress: 'กำลังนับ',
      completed: 'เสร็จสิ้น',
      cancelled: 'ยกเลิก',
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status}
      </span>
    );
  };

  const totalMatched = sessions.reduce((sum, s) => sum + (s.matched_count || 0), 0);
  const totalMismatched = sessions.reduce((sum, s) => sum + (s.mismatched_count || 0), 0);
  const totalEmpty = sessions.reduce((sum, s) => sum + (s.empty_count || 0), 0);
  const totalExtra = sessions.reduce((sum, s) => sum + (s.extra_count || 0), 0);
  const paginatedSessions = sessions.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <PageContainer>
      <PageHeaderWithFilters title="รายงานนับสต็อก (Stock Count)">
        <SearchInput value={externalSearchTerm} onChange={onSearchChange} placeholder="ค้นหาเลขที่รอบนับ..." />
        <FilterSelect value={externalStatusFilter} onChange={(v) => onStatusChange(v as SessionStatus)} options={statusOptions} />
        <FilterSelect value={externalCountTypeFilter} onChange={(v) => onCountTypeChange(v as CountType)} options={countTypeOptions} />
        {/* Toggle View Buttons */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => onViewModeChange('sessions')}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              viewMode === 'sessions'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            มุมมองรอบนับ
          </button>
          <button
            onClick={() => onViewModeChange('items')}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              viewMode === 'items'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            มุมมองรายการ
          </button>
        </div>
        <Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => {
          if (isPremiumOcr) {
            // Refresh premium sessions
            setLoadingPremium(true);
            const premiumParams = new URLSearchParams();
            if (externalStatusFilter !== 'all') premiumParams.set('status', externalStatusFilter);
            fetch(`/api/stock-count/premium-packages/sessions?${premiumParams.toString()}`)
              .then(res => res.json())
              .then(result => {
                console.log('[PPC Refresh] API Response:', result);
                if (result.success && result.data) {
                  const mappedSessions: Session[] = result.data.map((ps: any) => {
                    console.log('[PPC Refresh] Mapping session:', ps.session_code, {
                      matched: ps.matched_count,
                      mismatched: ps.mismatched_count
                    });
                    return {
                      id: ps.id,
                      session_code: ps.session_code,
                      warehouse_id: 'WH001',
                      count_type: 'premium_ocr' as const,
                      status: ps.status,
                      total_locations: ps.total_locations || 1,
                      matched_count: ps.matched_count || 0,
                      mismatched_count: ps.mismatched_count || 0,
                      empty_count: 0, // PPC ไม่มีสถานะว่าง
                      extra_count: 0, // PPC ไม่มีสถานะเพิ่มเติม
                      created_at: ps.created_at,
                      completed_at: ps.completed_at,
                      counted_by: ps.counted_by,
                      location_code: ps.location_code,
                    };
                  });
                  console.log('[PPC Refresh] Mapped sessions:', mappedSessions);
                  setPremiumSessions(mappedSessions);
                }
              })
              .finally(() => setLoadingPremium(false));
          } else {
            mutate();
          }
        }} className="text-xs py-1 px-3">รีเฟรช</Button>
        <Button variant="primary" size="sm" icon={ClipboardList} onClick={() => window.open('/mobile/stock-count', '_blank')} className="text-xs py-1 px-3 bg-blue-500 hover:bg-blue-600 shadow-lg">
          เริ่มนับสต็อก (Mobile)
        </Button>
      </PageHeaderWithFilters>

      {sessions.length > 0 && (
        <div className="grid grid-cols-5 gap-4 mb-4">
          <div className="bg-white rounded-lg shadow-sm p-4 text-center">
            <p className="text-2xl font-bold">{sessions.length}</p>
            <p className="text-xs text-gray-500">รอบนับทั้งหมด</p>
          </div>
          <div className="bg-green-50 rounded-lg shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{totalMatched}</p>
            <p className="text-xs text-green-600">ถูกต้อง</p>
          </div>
          <div className="bg-red-50 rounded-lg shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{totalMismatched}</p>
            <p className="text-xs text-red-600">ไม่ตรง</p>
          </div>
          <div className="bg-yellow-50 rounded-lg shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{totalEmpty}</p>
            <p className="text-xs text-yellow-600">ว่าง</p>
          </div>
          <div className="bg-blue-50 rounded-lg shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{totalExtra}</p>
            <p className="text-xs text-blue-600">เพิ่มเติม</p>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 bg-white border rounded-lg shadow-sm flex flex-col overflow-hidden">
        {(isLoading || loadingPremium) ? (
          <div className="flex flex-col items-center justify-center flex-1 text-gray-400 py-12">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
            <p className="text-sm">กำลังโหลดข้อมูล...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center flex-1 text-red-500 py-12">
            <AlertCircle className="w-12 h-12 mb-2" />
            <p className="text-sm">เกิดข้อผิดพลาด</p>
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
                  <Table.Head width="80px" className="text-center">ดู</Table.Head>
                </tr>
              </Table.Header>
              <Table.Body>
                {paginatedSessions.length > 0 ? paginatedSessions.map((session) => (
                  <tr key={session.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-900">{session.session_code}</span>
                        {session.count_type === 'prep_area' && <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-orange-100 text-orange-700">บ้านหยิบ</span>}
                        {session.count_type === 'premium_ocr' && <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-purple-100 text-purple-700">OCR</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{session.warehouse_id}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{getStatusBadge(session.status)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-center text-xs font-bold text-gray-600">{session.total_locations || 0}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-center text-xs font-bold text-green-600">{session.matched_count || 0}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-center text-xs font-bold text-red-600">{session.mismatched_count || 0}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-center text-xs font-bold text-yellow-600">{session.empty_count || 0}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-center text-xs font-bold text-blue-600">{session.extra_count || 0}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{format(new Date(session.created_at), 'dd/MM/yyyy HH:mm')}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{session.completed_at ? format(new Date(session.completed_at), 'dd/MM/yyyy HH:mm') : '-'}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-center">
                      <button onClick={() => onViewDetail(session.id)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="ดูรายละเอียด">
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <Table.Cell colSpan={11} className="px-4 py-8 text-center">
                      <div className="flex flex-col items-center justify-center text-gray-400">
                        <FileText className="w-12 h-12 mb-2" />
                        <p className="text-sm">ไม่พบข้อมูลการนับสต็อก</p>
                      </div>
                    </Table.Cell>
                  </tr>
                )}
              </Table.Body>
            </Table>
          </div>
        )}
        <PaginationBar currentPage={currentPage} totalItems={sessions.length} pageSize={pageSize} onPageChange={setCurrentPage} />
      </div>
    </PageContainer>
  );
}


function SessionDetailView({ sessionId, onBack }: { sessionId: number; onBack: () => void }) {
  const [detailSearch, setDetailSearch] = useState('');
  const [detailPage, setDetailPage] = useState(1);
  const detailPageSize = 50;

  const { data, isLoading, error, mutate } = useSWR<{ success: boolean; data: Session }>(
    `/api/stock-count/sessions/${sessionId}`,
    fetcher
  );

  const session = data?.data;
  const items = session?.items || [];

  const filteredItems = detailSearch
    ? items.filter((item: any) => {
        const search = detailSearch.toLowerCase();
        return (
          item.location_code?.toLowerCase().includes(search) ||
          item.expected_pallet_id?.toLowerCase().includes(search) ||
          item.scanned_pallet_id?.toLowerCase().includes(search) ||
          item.expected_sku_code?.toLowerCase().includes(search) ||
          item.actual_sku_code?.toLowerCase().includes(search) ||
          item.sku_code?.toLowerCase().includes(search)
        );
      })
    : items;

  const paginatedItems = filteredItems.slice((detailPage - 1) * detailPageSize, detailPage * detailPageSize);

  const getItemStatusBadge = (status: string) => {
    const config: Record<string, { icon: React.ReactNode; style: string; label: string }> = {
      matched: { icon: <Check className="w-3 h-3" />, style: 'bg-green-100 text-green-800', label: 'ถูกต้อง' },
      mismatched: { icon: <X className="w-3 h-3" />, style: 'bg-red-100 text-red-800', label: 'ไม่ตรง' },
      empty: { icon: <AlertTriangle className="w-3 h-3" />, style: 'bg-yellow-100 text-yellow-800', label: 'ว่าง' },
      extra: { icon: <Plus className="w-3 h-3" />, style: 'bg-blue-100 text-blue-800', label: 'เพิ่มเติม' },
    };
    const c = config[status] || { icon: null, style: 'bg-gray-100 text-gray-800', label: 'รอนับ' };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${c.style}`}>
        {c.icon}{c.label}
      </span>
    );
  };

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center flex-1 text-gray-400 py-12">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
          <p className="text-sm">กำลังโหลดข้อมูล...</p>
        </div>
      </PageContainer>
    );
  }

  if (error || !session) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center flex-1 text-red-500 py-12">
          <AlertCircle className="w-12 h-12 mb-2" />
          <p className="text-sm">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
          <Button variant="secondary" size="sm" onClick={onBack} className="mt-4">กลับ</Button>
        </div>
      </PageContainer>
    );
  }

  const isPrepArea = session.count_type === 'prep_area';
  const isPremiumOcr = session.count_type === 'premium_ocr';
  const isPremiumPackage = session.count_type === 'premium_package';

  console.log('Session detail:', { 
    sessionId, 
    count_type: session.count_type, 
    itemsCount: items.length,
    isPremiumPackage 
  });

  const handleExportExcel = () => {
    if (!session || items.length === 0) {
      alert('ไม่มีข้อมูลให้ส่งออก');
      return;
    }

    // เตรียมข้อมูลสำหรับ Excel
    const excelData = items.map((item: any, index: number) => {
      if (isPremiumPackage) {
        // Premium Package items
        return {
          'ลำดับ': index + 1,
          'โลเคชั่น': item.actual_location || '-',
          'บาร์โค้ด': item.barcode_id || '-',
          'Face Sheet': item.face_sheet_no || '-',
          'แพ็ค': item.pack_no || '-',
          'ร้านค้า': item.shop_name || '-',
          'Hub': item.hub || '-',
          'โลเคชั่น (คาดหวัง)': item.expected_location || '-',
          'โลเคชั่น (จริง)': item.actual_location || '-',
          'สถานะ': item.location_match ? 'ถูกต้อง' : 'ไม่ตรง',
          'เวลานับ': item.created_at ? format(new Date(item.created_at), 'dd/MM/yyyy HH:mm:ss') : '-',
          'ผู้นับ': item.counted_by || '-',
        };
      } else {
        // Standard items
        return {
          'ลำดับ': index + 1,
          'โลเคชั่น': item.location_code || '-',
          'พาเลท (คาดหวัง)': item.expected_pallet_id || '-',
          'พาเลท (สแกน)': item.scanned_pallet_id || '-',
          'SKU (คาดหวัง)': item.expected_sku_code || '-',
          'ชื่อสินค้า (คาดหวัง)': item.expected_sku_name || '-',
          'จำนวน (คาดหวัง)': item.expected_quantity || 0,
          'SKU (จริง)': item.actual_sku_code || item.sku_code || '-',
          'ชื่อสินค้า (จริง)': item.actual_sku_name || item.sku_name || '-',
          'จำนวน (จริง)': item.actual_quantity ?? item.quantity ?? 0,
          'สถานะ': item.status === 'matched' ? 'ถูกต้อง' :
                   item.status === 'mismatched' ? 'ไม่ตรง' :
                   item.status === 'empty' ? 'ว่าง' :
                   item.status === 'extra' ? 'เพิ่มเติม' : 'รอนับ',
          'เวลานับ': item.counted_at ? format(new Date(item.counted_at), 'dd/MM/yyyy HH:mm:ss') : '-',
          'ผู้นับ': item.counted_by || '-',
          'หมายเหตุ': item.notes || '-',
        };
      }
    });

    // สร้าง workbook และ worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // ปรับความกว้างคอลัมน์
    const colWidths = [
      { wch: 8 },  // ลำดับ
      { wch: 15 }, // โลเคชั่น
      { wch: 20 }, // พาเลท (คาดหวัง)
      { wch: 20 }, // พาเลท (สแกน)
      { wch: 15 }, // SKU (คาดหวัง)
      { wch: 30 }, // ชื่อสินค้า (คาดหวัง)
      { wch: 12 }, // จำนวน (คาดหวัง)
      { wch: 15 }, // SKU (จริง)
      { wch: 30 }, // ชื่อสินค้า (จริง)
      { wch: 12 }, // จำนวน (จริง)
      { wch: 12 }, // สถานะ
      { wch: 18 }, // เวลานับ
      { wch: 15 }, // ผู้นับ
      { wch: 25 }, // หมายเหตุ
    ];
    ws['!cols'] = colWidths;

    // เพิ่ม worksheet เข้า workbook
    XLSX.utils.book_append_sheet(wb, ws, 'รายละเอียดการนับ');

    // สร้างชื่อไฟล์
    const fileName = `รอบนับ_${session.session_code}_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`;

    // ส่งออกไฟล์
    XLSX.writeFile(wb, fileName);
  };

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="กลับ">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-gray-900">รายละเอียดรอบนับ: {session.session_code}</h1>
              {isPrepArea && <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-700">บ้านหยิบ</span>}
              {isPremiumOcr && <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700">OCR แพ็คพรีเมียม</span>}
              {isPremiumPackage && <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700">บ้านหยิบพรีเมี่ยม</span>}
            </div>
            <p className="text-xs text-gray-500">คลัง: {session.warehouse_id} | สร้างเมื่อ: {format(new Date(session.created_at), 'dd/MM/yyyy HH:mm')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="success" size="sm" icon={Download} onClick={handleExportExcel} className="text-xs py-1 px-3">
            ส่งออก Excel
          </Button>
          <Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => mutate()} className="text-xs py-1 px-3">รีเฟรช</Button>
        </div>
      </div>

      <div className="grid grid-cols-6 gap-3 mb-4">
        <div className="bg-white rounded-lg shadow-sm p-3 text-center"><p className="text-xl font-bold">{items.length}</p><p className="text-[10px] text-gray-500">รายการทั้งหมด</p></div>
        <div className="bg-green-50 rounded-lg shadow-sm p-3 text-center"><p className="text-xl font-bold text-green-600">{session.matched_count || 0}</p><p className="text-[10px] text-green-600">ถูกต้อง</p></div>
        <div className="bg-red-50 rounded-lg shadow-sm p-3 text-center"><p className="text-xl font-bold text-red-600">{session.mismatched_count || 0}</p><p className="text-[10px] text-red-600">ไม่ตรง</p></div>
        <div className="bg-yellow-50 rounded-lg shadow-sm p-3 text-center"><p className="text-xl font-bold text-yellow-600">{session.empty_count || 0}</p><p className="text-[10px] text-yellow-600">ว่าง</p></div>
        <div className="bg-blue-50 rounded-lg shadow-sm p-3 text-center"><p className="text-xl font-bold text-blue-600">{session.extra_count || 0}</p><p className="text-[10px] text-blue-600">เพิ่มเติม</p></div>
        <div className="bg-gray-50 rounded-lg shadow-sm p-3 text-center"><p className="text-xl font-bold text-gray-600">{session.total_locations || 0}</p><p className="text-[10px] text-gray-600">โลเคชั่น</p></div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={detailSearch} onChange={(e) => { setDetailSearch(e.target.value); setDetailPage(1); }} placeholder="ค้นหาในรายการ..." className="w-full pl-10 pr-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <span className="text-xs text-gray-500">แสดง {paginatedItems.length} จาก {filteredItems.length} รายการ</span>
      </div>

      <div className="flex-1 min-h-0 bg-white border rounded-lg shadow-sm flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          <table className="w-full">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-600">#</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-600">
                  {isPremiumPackage ? 'โลเคชั่น' : 'โลเคชั่น'}
                </th>
                {isPremiumPackage ? (
                  <>
                    <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-600">บาร์โค้ด</th>
                    <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-600">Face Sheet</th>
                    <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-600">แพ็ค</th>
                    <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-600">ร้านค้า</th>
                    <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-600">Hub</th>
                    <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-600">โลเคชั่น (คาดหวัง)</th>
                    <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-600">โลเคชั่น (จริง)</th>
                  </>
                ) : (
                  <>
                    <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-600">พาเลท (คาดหวัง)</th>
                    <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-600">พาเลท (สแกน)</th>
                    <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-600">SKU</th>
                    <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-600">จำนวน (คาดหวัง)</th>
                    <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-600">จำนวน (จริง)</th>
                  </>
                )}
                <th className="px-3 py-2 text-center text-[10px] font-medium text-gray-600">สถานะ</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-600">เวลานับ</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-600">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.length > 0 ? paginatedItems.map((item: any, idx: number) => {
                // สำหรับ Premium Package items
                if (isPremiumPackage) {
                  return (
                    <tr key={item.id || idx} className={`border-t border-gray-100 hover:bg-gray-50 ${!item.location_match ? 'bg-red-50/30' : ''}`}>
                      <td className="px-3 py-2 text-[10px] text-gray-500">{(detailPage - 1) * detailPageSize + idx + 1}</td>
                      <td className="px-3 py-2 text-xs font-mono text-gray-900">{item.actual_location || '-'}</td>
                      <td className="px-3 py-2 text-xs font-mono text-gray-700">{item.barcode_id || '-'}</td>
                      <td className="px-3 py-2 text-xs font-mono text-gray-700">{item.face_sheet_no || '-'}</td>
                      <td className="px-3 py-2 text-xs text-gray-700">{item.pack_no || '-'}</td>
                      <td className="px-3 py-2 text-xs text-gray-900">{item.shop_name || '-'}</td>
                      <td className="px-3 py-2 text-xs text-gray-700">{item.hub || '-'}</td>
                      <td className="px-3 py-2 text-xs font-mono text-gray-700">{item.expected_location || '-'}</td>
                      <td className="px-3 py-2 text-xs font-mono text-gray-900">{item.actual_location || '-'}</td>
                      <td className="px-3 py-2 text-center">{getItemStatusBadge(item.location_match ? 'matched' : 'mismatched')}</td>
                      <td className="px-3 py-2 text-[10px] text-gray-500">{item.created_at ? format(new Date(item.created_at), 'HH:mm:ss') : '-'}</td>
                      <td className="px-3 py-2 text-[10px] text-gray-500 max-w-[150px] truncate">{item.counted_by || '-'}</td>
                    </tr>
                  );
                }
                
                // สำหรับ Standard items
                return (
                  <tr key={item.id || idx} className={`border-t border-gray-100 hover:bg-gray-50 ${item.status === 'mismatched' || item.status === 'empty' ? 'bg-red-50/30' : ''}`}>
                    <td className="px-3 py-2 text-[10px] text-gray-500">{(detailPage - 1) * detailPageSize + idx + 1}</td>
                    <td className="px-3 py-2 text-xs font-mono text-gray-900">{item.location_code || '-'}</td>
                    <td className="px-3 py-2 text-xs font-mono text-gray-700">{item.expected_pallet_id || '-'}</td>
                    <td className="px-3 py-2 text-xs font-mono text-gray-700">{item.scanned_pallet_id || '-'}</td>
                    <td className="px-3 py-2">
                      <div className="text-xs text-gray-900">{item.expected_sku_name || item.actual_sku_name || item.sku_name || '-'}</div>
                      <div className="text-[10px] text-gray-500">{item.expected_sku_code || item.actual_sku_code || item.sku_code || ''}</div>
                    </td>
                    <td className="px-3 py-2 text-xs text-right font-mono">{item.expected_quantity?.toLocaleString() || '-'}</td>
                    <td className="px-3 py-2 text-xs text-right font-mono font-bold">{(item.actual_quantity ?? item.quantity)?.toLocaleString() || '-'}</td>
                    <td className="px-3 py-2 text-center">{getItemStatusBadge(item.status || 'pending')}</td>
                    <td className="px-3 py-2 text-[10px] text-gray-500">{item.counted_at ? format(new Date(item.counted_at), 'HH:mm:ss') : '-'}</td>
                    <td className="px-3 py-2 text-[10px] text-gray-500 max-w-[150px] truncate">{item.notes || '-'}</td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-400">
                    {detailSearch ? 'ไม่พบรายการที่ค้นหา' : 'ยังไม่มีรายการที่สแกน'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <PaginationBar currentPage={detailPage} totalItems={filteredItems.length} pageSize={detailPageSize} onPageChange={setDetailPage} />
      </div>
    </PageContainer>
  );
}

export default function StockCountReportPage() {
  const [viewMode, setViewMode] = useState<'sessions' | 'items' | 'detail'>('sessions');
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<SessionStatus>('all');
  const [countTypeFilter, setCountTypeFilter] = useState<CountType>('all');

  // Items view state
  const [itemsData, setItemsData] = useState<CountItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [itemsPage, setItemsPage] = useState(1);
  const itemsPageSize = 50;

  // Sessions data for items view summary
  const [sessionsData, setSessionsData] = useState<Session[]>([]);

  // Fetch all items and sessions when switching to items view
  useEffect(() => {
    if (viewMode === 'items') {
      fetchAllItems();
      fetchSessions();
    }
  }, [viewMode]);

  const fetchAllItems = async () => {
    setLoadingItems(true);
    try {
      const response = await fetch('/api/stock-count/sessions/all-items');
      const result = await response.json();
      if (result.success) {
        setItemsData(result.data || []);
      }
    } catch (err) {
      console.error('Error fetching items:', err);
    } finally {
      setLoadingItems(false);
    }
  };

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/stock-count/sessions');
      const result = await response.json();
      if (result.success) {
        setSessionsData(result.data || []);
      }
    } catch (err) {
      console.error('Error fetching sessions:', err);
    }
  };

  const handleViewDetail = (sessionId: number) => {
    setSelectedSessionId(sessionId);
    setViewMode('detail');
  };

  const handleBackToList = () => {
    setSelectedSessionId(null);
    setViewMode('sessions');
  };

  const handleSwitchToSessionFromItem = (sessionCode: string) => {
    setViewMode('sessions');
    setSearchTerm(sessionCode);
  };

  // Calculate totals from sessions for items view
  const totalSessions = sessionsData.length;
  const totalLocations = sessionsData.reduce((sum, s) => sum + (s.total_locations || 0), 0);  // Filter items
  const filteredItems = itemsData.filter(item => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.session_code?.toLowerCase().includes(term) ||
      item.location_code?.toLowerCase().includes(term) ||
      item.expected_pallet_id?.toLowerCase().includes(term) ||
      item.scanned_pallet_id?.toLowerCase().includes(term) ||
      item.expected_sku_code?.toLowerCase().includes(term) ||
      item.actual_sku_code?.toLowerCase().includes(term)
    );
  });

  const paginatedItems = filteredItems.slice((itemsPage - 1) * itemsPageSize, itemsPage * itemsPageSize);

  const getItemStatusBadge = (status: string) => {
    const config: Record<string, { icon: React.ReactNode; style: string; label: string }> = {
      matched: { icon: <Check className="w-3 h-3" />, style: 'bg-green-100 text-green-800', label: 'ถูกต้อง' },
      mismatched: { icon: <X className="w-3 h-3" />, style: 'bg-red-100 text-red-800', label: 'ไม่ตรง' },
      empty: { icon: <AlertTriangle className="w-3 h-3" />, style: 'bg-yellow-100 text-yellow-800', label: 'ว่าง' },
      extra: { icon: <Plus className="w-3 h-3" />, style: 'bg-blue-100 text-blue-800', label: 'เพิ่มเติม' },
    };
    const c = config[status] || { icon: null, style: 'bg-gray-100 text-gray-800', label: 'รอนับ' };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${c.style}`}>
        {c.icon}{c.label}
      </span>
    );
  };

  if (viewMode === 'detail' && selectedSessionId) {
    return <SessionDetailView sessionId={selectedSessionId} onBack={handleBackToList} />;
  }

  // Sessions List View
  if (viewMode === 'sessions') {
    return (
      <SessionsListView
        onViewDetail={handleViewDetail}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        countTypeFilter={countTypeFilter}
        onCountTypeChange={setCountTypeFilter}
      />
    );
  }

  // Items List View
  return (
    <PageContainer>
      <PageHeaderWithFilters title="รายงานนับสต็อก (Stock Count)">
        <SearchInput value={searchTerm} onChange={(v) => { setSearchTerm(v); setItemsPage(1); }} placeholder="ค้นหารหัสรอบนับ, โลเคชั่น, พาเลท..." />
        <FilterSelect value={statusFilter} onChange={(v) => setStatusFilter(v as SessionStatus)} options={[
          { value: 'all', label: 'ทุกสถานะ' },
          { value: 'in_progress', label: 'กำลังนับ' },
          { value: 'completed', label: 'เสร็จสิ้น' },
          { value: 'cancelled', label: 'ยกเลิก' },
        ]} />
        {/* Toggle View Buttons */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => setViewMode('sessions')}
            className="px-3 py-1 text-xs font-medium transition-colors bg-white text-gray-600 hover:bg-gray-50"
          >
            มุมมองรอบนับ
          </button>
          <button
            onClick={() => setViewMode('items')}
            className="px-3 py-1 text-xs font-medium transition-colors bg-blue-600 text-white"
          >
            มุมมองรายการ
          </button>
        </div>
        <Button variant="secondary" size="sm" icon={RefreshCw} onClick={fetchAllItems} className="text-xs py-1 px-3">รีเฟรช</Button>
        <Button variant="primary" size="sm" icon={ClipboardList} onClick={() => window.open('/mobile/stock-count', '_blank')} className="text-xs py-1 px-3 bg-blue-500 hover:bg-blue-600 shadow-lg">
          เริ่มนับสต็อก (Mobile)
        </Button>
      </PageHeaderWithFilters>

      {/* Summary Cards - แสดงข้อมูลเหมือนมุมมองรอบนับ */}
      {itemsData.length > 0 && (
        <div className="grid grid-cols-7 gap-3 mb-4">
          <div className="bg-white rounded-lg shadow-sm p-3 text-center">
            <p className="text-xl font-bold">{totalSessions}</p>
            <p className="text-[10px] text-gray-500">รอบนับทั้งหมด</p>
          </div>
          <div className="bg-gray-50 rounded-lg shadow-sm p-3 text-center">
            <p className="text-xl font-bold text-gray-600">{totalLocations}</p>
            <p className="text-[10px] text-gray-500">โลเคชั่น</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-3 text-center">
            <p className="text-xl font-bold">{itemsData.length}</p>
            <p className="text-[10px] text-gray-500">รายการทั้งหมด</p>
          </div>
          <div className="bg-green-50 rounded-lg shadow-sm p-3 text-center">
            <p className="text-xl font-bold text-green-600">{itemsData.filter(i => i.status === 'matched').length}</p>
            <p className="text-[10px] text-green-600">ถูกต้อง</p>
          </div>
          <div className="bg-red-50 rounded-lg shadow-sm p-3 text-center">
            <p className="text-xl font-bold text-red-600">{itemsData.filter(i => i.status === 'mismatched').length}</p>
            <p className="text-[10px] text-red-600">ไม่ตรง</p>
          </div>
          <div className="bg-yellow-50 rounded-lg shadow-sm p-3 text-center">
            <p className="text-xl font-bold text-yellow-600">{itemsData.filter(i => i.status === 'empty').length}</p>
            <p className="text-[10px] text-yellow-600">ว่าง</p>
          </div>
          <div className="bg-blue-50 rounded-lg shadow-sm p-3 text-center">
            <p className="text-xl font-bold text-blue-600">{itemsData.filter(i => i.status === 'extra').length}</p>
            <p className="text-[10px] text-blue-600">เพิ่มเติม</p>
          </div>
        </div>
      )}

      {/* Items Table */}
      <div className="flex-1 min-h-0 bg-white border rounded-lg shadow-sm flex flex-col overflow-hidden">
        {loadingItems ? (
          <div className="flex flex-col items-center justify-center flex-1 text-gray-400 py-12">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
            <p className="text-sm">กำลังโหลดข้อมูลรายการ...</p>
          </div>
        ) : (
          <div className="flex-1 overflow-x-auto overflow-y-auto">
            <table className="min-w-[1400px] w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-gray-100">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-semibold border-b whitespace-nowrap">รหัสรอบนับ</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold border-b whitespace-nowrap">โลเคชั่น</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold border-b whitespace-nowrap">พาเลท (คาดหวัง)</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold border-b whitespace-nowrap">พาเลท (สแกน)</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold border-b whitespace-nowrap">รหัส SKU (คาดหวัง)</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold border-b whitespace-nowrap">ชื่อ SKU (คาดหวัง)</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold border-b whitespace-nowrap">รหัส SKU (จริง)</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold border-b whitespace-nowrap">ชื่อ SKU (จริง)</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold border-b whitespace-nowrap">จำนวน (คาดหวัง)</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold border-b whitespace-nowrap">จำนวน (จริง)</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold border-b whitespace-nowrap">สถานะ</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold border-b whitespace-nowrap">เวลานับ</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold border-b whitespace-nowrap">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {paginatedItems.length > 0 ? paginatedItems.map((item) => (
                  <tr key={item.id} className={`hover:bg-gray-50/80 transition-colors duration-200 ${item.status === 'mismatched' || item.status === 'empty' ? 'bg-red-50/30' : ''}`}>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">
                      <button
                        onClick={() => handleSwitchToSessionFromItem(item.session_code)}
                        className="font-semibold text-blue-600 font-mono hover:underline"
                      >
                        {item.session_code}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-cyan-100 text-cyan-700 text-xs font-medium">
                        <MapPin className="w-3 h-3 mr-1" />
                        {item.location_code || '-'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs font-mono text-gray-700 whitespace-nowrap">{item.expected_pallet_id || '-'}</td>
                    <td className="px-3 py-2 text-xs font-mono text-gray-700 whitespace-nowrap">{item.scanned_pallet_id || '-'}</td>
                    <td className="px-3 py-2 text-xs font-mono text-gray-700 whitespace-nowrap">{item.expected_sku_code || '-'}</td>
                    <td className="px-3 py-2 text-xs text-gray-900 whitespace-nowrap">{item.expected_sku_name || '-'}</td>
                    <td className="px-3 py-2 text-xs font-mono text-gray-700 whitespace-nowrap">{item.actual_sku_code || '-'}</td>
                    <td className="px-3 py-2 text-xs text-gray-900 whitespace-nowrap">{item.actual_sku_name || '-'}</td>
                    <td className="px-3 py-2 text-xs text-right font-mono whitespace-nowrap">{item.expected_quantity?.toLocaleString() || '-'}</td>
                    <td className="px-3 py-2 text-xs text-right font-mono font-bold whitespace-nowrap">{item.actual_quantity?.toLocaleString() || '-'}</td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">{getItemStatusBadge(item.status || 'pending')}</td>
                    <td className="px-3 py-2 text-[10px] text-gray-500 whitespace-nowrap">{item.counted_at ? format(new Date(item.counted_at), 'dd/MM HH:mm') : '-'}</td>
                    <td className="px-3 py-2 text-[10px] text-gray-500 whitespace-nowrap">{item.notes || '-'}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={13} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                          <Package className="w-8 h-8 text-blue-600" />
                        </div>
                        <p className="text-sm text-gray-600 mb-2">ไม่พบข้อมูลรายการนับสต็อก</p>
                        <p className="text-xs text-gray-500">ลองเปลี่ยนตัวกรองหรือเริ่มนับสต็อกใหม่</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <PaginationBar currentPage={itemsPage} totalItems={filteredItems.length} pageSize={itemsPageSize} onPageChange={setItemsPage} />
      </div>
    </PageContainer>
  );
}
