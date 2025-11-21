'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Filter,
  Package,
  ChevronRight,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Loader2,
  X,
  Calendar,
  TruckIcon,
  User,
  Plus
} from 'lucide-react';
import Badge from '@/components/ui/Badge';

// Types (aligned with desktop inbound)
interface ReceiveItem {
  item_id: number;
  sku_id: string;
  product_name: string;
  barcode?: string;
  piece_quantity: number;
  pack_quantity: number;
  pallet_id?: string;
  pallet_id_external?: string;
  pallet_scan_status: 'ไม่จำเป็น' | 'รอดำเนินการ' | 'สแกนแล้ว';
  production_date?: string;
  expiry_date?: string;
  location_id?: string;
  master_sku?: {
    sku_name: string;
    barcode: string;
  };
  master_location?: {
    location_code: string;
  };
}

interface ReceiveDocument {
  receive_id: number;
  receive_no: string;
  receive_type: string;
  reference_doc?: string;
  receive_date: string;
  status: string;
  warehouse_id: string;
  supplier_id?: string;
  customer_id?: string;
  notes?: string;
  wms_receive_items: ReceiveItem[];
  master_supplier?: {
    supplier_name: string;
  };
  master_customer?: {
    customer_name: string;
  };
  received_by_employee?: {
    first_name: string;
    last_name: string;
  };
}

// Status และ Type Enums
const RECEIVE_TYPES = [
  'all',
  'รับสินค้าปกติ',
  'รับสินค้าชำรุด',
  'รับสินค้าหมดอายุ',
  'รับสินค้าคืน',
  'รับสินค้าตีกลับ'
] as const;

const RECEIVE_STATUSES = [
  'all',
  'รอรับเข้า',
  'รับเข้าแล้ว',
  'กำลังตรวจสอบ',
  'สำเร็จ'
] as const;

export default function MobileReceivePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [receives, setReceives] = useState<ReceiveDocument[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showFilter, setShowFilter] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch receives
  useEffect(() => {
    fetchReceives();
  }, []);

  const fetchReceives = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/receives');
      const result = await response.json();

      if (result.data) {
        setReceives(result.data);
      }
    } catch (error) {
      console.error('Error fetching receives:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchReceives();
    setRefreshing(false);
    playTapSound();
  };

  const playTapSound = () => {
    try {
      const audio = new Audio('/audio/tap.mp3');
      audio.volume = 0.3;
      audio.play().catch(() => {});
    } catch (err) {
      // Silent fail
    }
  };

  // Client-side filtering
  const filteredReceives = useMemo(() => {
    let filtered = [...receives];

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(r =>
        r.receive_no?.toLowerCase().includes(term) ||
        r.reference_doc?.toLowerCase().includes(term) ||
        r.master_supplier?.supplier_name?.toLowerCase().includes(term) ||
        r.master_customer?.customer_name?.toLowerCase().includes(term)
      );
    }

    // Filter by type
    if (selectedType !== 'all') {
      filtered = filtered.filter(r => r.receive_type === selectedType);
    }

    // Filter by status
    if (selectedStatus !== 'all') {
      if (selectedStatus === 'pending_scan') {
        filtered = filtered.filter(r =>
          r.wms_receive_items?.some(item => item.pallet_scan_status === 'รอดำเนินการ')
        );
      } else {
        filtered = filtered.filter(r => r.status === selectedStatus);
      }
    }

    // Sort by date descending
    filtered.sort((a, b) =>
      new Date(b.receive_date).getTime() - new Date(a.receive_date).getTime()
    );

    return filtered;
  }, [receives, searchTerm, selectedType, selectedStatus]);

  // Statistics
  const stats = useMemo(() => {
    const total = receives.length;
    const pending = receives.filter(r => r.status === 'รอรับเข้า').length;
    const received = receives.filter(r => r.status === 'รับเข้าแล้ว').length;
    const checking = receives.filter(r => r.status === 'กำลังตรวจสอบ').length;
    const completed = receives.filter(r => r.status === 'สำเร็จ').length;
    const pendingScan = receives.filter(r =>
      r.wms_receive_items?.some(item => item.pallet_scan_status === 'รอดำเนินการ')
    ).length;

    return { total, pending, received, checking, completed, pendingScan };
  }, [receives]);

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'รอรับเข้า':
        return <Badge variant="default" size="sm">รอรับเข้า</Badge>;
      case 'รับเข้าแล้ว':
        return <Badge variant="info" size="sm">รับเข้าแล้ว</Badge>;
      case 'กำลังตรวจสอบ':
        return <Badge variant="warning" size="sm">กำลังตรวจสอบ</Badge>;
      case 'สำเร็จ':
        return <Badge variant="success" size="sm">สำเร็จ</Badge>;
      default:
        return <Badge variant="default" size="sm">{status}</Badge>;
    }
  };

  // Get type badge
  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'รับสินค้าปกติ':
        return <Badge variant="info" size="sm">{type}</Badge>;
      case 'รับสินค้าชำรุด':
        return <Badge variant="danger" size="sm">{type}</Badge>;
      case 'รับสินค้าหมดอายุ':
        return <Badge variant="warning" size="sm">{type}</Badge>;
      case 'รับสินค้าคืน':
        return <Badge variant="warning" size="sm">{type}</Badge>;
      case 'รับสินค้าตีกลับ':
        return <Badge variant="default" size="sm">{type}</Badge>;
      default:
        return <Badge variant="default" size="sm">{type}</Badge>;
    }
  };

  // Format Thai date
  const formatThaiDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  // Get pending scan count
  const getPendingScanCount = (receive: ReceiveDocument) => {
    return receive.wms_receive_items?.filter(item => item.pallet_scan_status === 'รอดำเนินการ').length || 0;
  };

  // Get total quantities
  const getTotalQuantities = (receive: ReceiveDocument) => {
    const items = receive.wms_receive_items || [];
    const totalPacks = items.reduce((sum, item) => sum + (item.pack_quantity || 0), 0);
    const totalPieces = items.reduce((sum, item) => sum + (item.piece_quantity || 0), 0);
    const totalItems = items.length;
    return { totalPacks, totalPieces, totalItems };
  };

  // Navigate to detail
  const handleViewDetail = (receiveId: number) => {
    playTapSound();
    router.push(`/mobile/receive/${receiveId}`);
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-thai">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header with Statistics */}
      <div className="bg-gradient-to-br from-sky-400 to-sky-500 text-white sticky top-0 z-10 shadow-lg">
        <div className="p-3">
          {/* Title and Action Buttons */}
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-lg font-bold font-thai">รับสินค้าเข้าคลัง</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  playTapSound();
                  router.push('/mobile/receive/new');
                }}
                className="px-2.5 py-1.5 bg-white text-sky-600 rounded-lg font-thai text-sm font-semibold hover:bg-sky-50 transition-colors active:scale-95 flex items-center gap-1 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                รับสินค้า
              </button>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition-colors active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Statistics Cards - Compact */}
          <div className="grid grid-cols-4 gap-1.5 mb-2">
            <div className="bg-white/15 backdrop-blur-sm rounded-md p-1.5 text-center">
              <div className="text-xl font-bold">{stats.total}</div>
              <div className="text-[10px] text-sky-100">ทั้งหมด</div>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-md p-1.5 text-center">
              <div className="text-xl font-bold">{stats.received}</div>
              <div className="text-[10px] text-sky-100">รับแล้ว</div>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-md p-1.5 text-center">
              <div className="text-xl font-bold">{stats.checking}</div>
              <div className="text-[10px] text-sky-100">ตรวจสอบ</div>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-md p-1.5 text-center">
              <div className="text-xl font-bold text-yellow-300">{stats.pendingScan}</div>
              <div className="text-[10px] text-sky-100">รอสแกน</div>
            </div>
          </div>

          {/* Search - Compact */}
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="ค้นหา..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-300 font-thai text-sm"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter Toggle - Compact */}
          <button
            onClick={() => setShowFilter(!showFilter)}
            className="w-full bg-white/20 rounded-lg py-1.5 px-3 flex items-center justify-between font-thai text-xs hover:bg-white/30 transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5" />
              <span>ตัวกรอง</span>
              {(selectedType !== 'all' || selectedStatus !== 'all') && (
                <span className="bg-yellow-400 text-gray-900 rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                  {(selectedType !== 'all' ? 1 : 0) + (selectedStatus !== 'all' ? 1 : 0)}
                </span>
              )}
            </div>
            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showFilter ? 'rotate-90' : ''}`} />
          </button>

          {/* Filter Panel */}
          {showFilter && (
            <div className="mt-3 bg-white/10 backdrop-blur-sm rounded-lg p-3 space-y-3">
              {/* Type Filter */}
              <div>
                <label className="block text-sm font-thai mb-1">ประเภทการรับ</label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full bg-white text-gray-900 rounded-lg px-3 py-2 font-thai text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  <option value="all">ทั้งหมด</option>
                  {RECEIVE_TYPES.slice(1).map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-thai mb-1">สถานะ</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full bg-white text-gray-900 rounded-lg px-3 py-2 font-thai text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  <option value="all">ทั้งหมด</option>
                  {RECEIVE_STATUSES.slice(1).map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                  <option value="pending_scan">รอสแกนพาเลท</option>
                </select>
              </div>

              {/* Clear Filters */}
              {(selectedType !== 'all' || selectedStatus !== 'all') && (
                <button
                  onClick={() => {
                    setSelectedType('all');
                    setSelectedStatus('all');
                  }}
                  className="w-full bg-white/20 hover:bg-white/30 rounded-lg py-2 font-thai text-sm transition-colors"
                >
                  ล้างตัวกรอง
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Results Count */}
      {filteredReceives.length > 0 && (
        <div className="px-4 py-2 bg-white border-b border-gray-200">
          <p className="text-sm text-gray-600 font-thai">
            พบ {filteredReceives.length} รายการ
            {filteredReceives.length !== receives.length && ` จากทั้งหมด ${receives.length} รายการ`}
          </p>
        </div>
      )}

      {/* Empty State */}
      {filteredReceives.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <Package className="w-20 h-20 text-gray-300 mb-4" />
          <h3 className="text-lg font-bold text-gray-900 font-thai mb-2">
            ไม่พบรายการรับสินค้า
          </h3>
          <p className="text-gray-500 font-thai text-center mb-4">
            {searchTerm || selectedType !== 'all' || selectedStatus !== 'all'
              ? 'ลองปรับเปลี่ยนเงื่อนไขการค้นหา'
              : 'ยังไม่มีรายการรับสินค้าในขณะนี้'}
          </p>
          {(searchTerm || selectedType !== 'all' || selectedStatus !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedType('all');
                setSelectedStatus('all');
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-thai hover:bg-blue-700 transition-colors"
            >
              ล้างตัวกรอง
            </button>
          )}
        </div>
      )}

      {/* Receives List */}
      <div className="p-2 space-y-2">
        {filteredReceives.map((receive) => {
          const pendingCount = getPendingScanCount(receive);
          const { totalPacks, totalPieces, totalItems } = getTotalQuantities(receive);
          const hasPending = pendingCount > 0;

          return (
            <div
              key={receive.receive_id}
              onClick={() => handleViewDetail(receive.receive_id)}
              className={`bg-white rounded-lg shadow-sm border p-2.5 active:scale-98 transition-all cursor-pointer ${
                hasPending ? 'border-amber-300 bg-amber-50/30' : 'border-gray-200'
              }`}
            >
              {/* Header Row - Compact */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 font-mono text-sm">
                    {receive.receive_no}
                  </h3>
                  {hasPending && (
                    <Badge variant="warning" size="sm">
                      <span className="text-[10px]">🔸{pendingCount}</span>
                    </Badge>
                  )}
                  <span className="text-[11px] text-gray-500 font-thai">
                    {formatThaiDate(receive.receive_date)}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </div>

              {/* Reference Doc - Inline if exists */}
              {receive.reference_doc && (
                <div className="text-[11px] text-gray-500 font-thai mb-1.5">
                  PO: {receive.reference_doc}
                </div>
              )}

              {/* Type, Status, and Supplier - Single Row */}
              <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                {getTypeBadge(receive.receive_type)}
                {getStatusBadge(receive.status)}
                {receive.master_supplier && (
                  <span className="text-[11px] text-gray-600 font-thai truncate">
                    • {receive.master_supplier.supplier_name}
                  </span>
                )}
                {receive.master_customer && (
                  <span className="text-[11px] text-gray-600 font-thai truncate">
                    • {receive.master_customer.customer_name}
                  </span>
                )}
              </div>

              {/* Stats - Compact Inline */}
              <div className="flex items-center justify-between pt-1.5 border-t border-gray-100">
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="text-gray-600 font-thai">
                    <span className="font-semibold text-gray-900">{totalItems}</span> รายการ
                  </span>
                  <span className="text-green-600 font-thai">
                    <span className="font-semibold">{totalPacks}</span> แพ็ค
                  </span>
                  <span className="text-sky-600 font-thai">
                    <span className="font-semibold">{totalPieces}</span> ชิ้น
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
