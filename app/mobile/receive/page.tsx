'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Filter,
  Package,
  ChevronRight,
  AlertTriangle,
  RefreshCw,
  Loader2,
  X,
  User,
  Plus,
  Maximize,
  Minimize,
} from 'lucide-react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
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

function MobileReceivePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [receives, setReceives] = useState<ReceiveDocument[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showFilter, setShowFilter] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Fullscreen handlers
  useEffect(() => {
    const checkFullscreen = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', checkFullscreen);
    return () => document.removeEventListener('fullscreenchange', checkFullscreen);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('Error toggling fullscreen:', err);
    }
  };

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
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Header with Statistics - Compact */}
      <div className="bg-gradient-to-br from-sky-400 to-sky-500 text-white sticky top-0 z-10 shadow-lg mobile-header">
        <div className="p-2">
          {/* Title and Action Buttons - Compact */}
          <div className="flex items-center justify-between mb-1.5">
            <h1 className="text-sm font-bold font-thai">รับสินค้าเข้าคลัง</h1>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  playTapSound();
                  router.push('/mobile/receive/new');
                }}
                className="px-1.5 py-1 bg-white text-sky-600 rounded font-thai text-xs font-semibold hover:bg-sky-50 transition-colors active:scale-95 flex items-center gap-0.5 shadow-sm mobile-btn-sm"
              >
                <Plus className="w-3 h-3" />
                รับ
              </button>
              <button
                onClick={() => {
                  playTapSound();
                  router.push('/mobile/receive/production');
                }}
                className="px-1.5 py-1 bg-emerald-500 text-white rounded font-thai text-xs font-semibold hover:bg-emerald-600 transition-colors active:scale-95 flex items-center gap-0.5 shadow-sm mobile-btn-sm"
              >
                <Package className="w-3 h-3" />
                ผลิต
              </button>
              <button
                onClick={toggleFullscreen}
                className="p-1 bg-white/20 rounded hover:bg-white/30 transition-colors active:scale-95 mobile-icon-btn"
                title={isFullscreen ? 'ออกจากเต็มจอ' : 'เต็มจอ'}
              >
                {isFullscreen ? (
                  <Minimize className="w-3.5 h-3.5" />
                ) : (
                  <Maximize className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-1 bg-white/20 rounded hover:bg-white/30 transition-colors active:scale-95 disabled:opacity-50 mobile-icon-btn"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => router.push('/profile')}
                className="p-1 bg-white/20 rounded hover:bg-white/30 transition-colors active:scale-95 mobile-icon-btn"
              >
                <User className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Search and Filter - Same Row - Compact */}
          <div className="flex items-center gap-1.5 mobile-search">
            {/* Search Box */}
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
              <input
                type="text"
                placeholder="ค้นหา..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-7 pr-6 py-1.5 rounded bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-300 font-thai text-xs"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Filter Button - Compact */}
            <button
              onClick={() => setShowFilter(!showFilter)}
              className="relative bg-white/20 rounded p-1.5 hover:bg-white/30 transition-colors flex-shrink-0"
            >
              <Filter className="w-4 h-4" />
              {(selectedType !== 'all' || selectedStatus !== 'all') && (
                <span className="absolute -top-1 -right-1 bg-yellow-400 text-gray-900 rounded-full w-4 h-4 flex items-center justify-center text-[8px] font-bold">
                  {(selectedType !== 'all' ? 1 : 0) + (selectedStatus !== 'all' ? 1 : 0)}
                </span>
              )}
            </button>
          </div>

          {/* Filter Panel - Compact */}
          {showFilter && (
            <div className="mt-2 bg-white/10 backdrop-blur-sm rounded p-2 space-y-2">
              {/* Type Filter */}
              <div>
                <label className="block text-xs font-thai mb-0.5">ประเภทการรับ</label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full bg-white text-gray-900 rounded px-2 py-1.5 font-thai text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  <option value="all">ทั้งหมด</option>
                  {RECEIVE_TYPES.slice(1).map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-xs font-thai mb-0.5">สถานะ</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full bg-white text-gray-900 rounded px-2 py-1.5 font-thai text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
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
                  className="w-full bg-white/20 hover:bg-white/30 rounded py-1.5 font-thai text-xs transition-colors"
                >
                  ล้างตัวกรอง
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Results Count - Compact */}
      {filteredReceives.length > 0 && (
        <div className="px-2 py-1 bg-white border-b border-gray-200">
          <p className="text-xs text-gray-600 font-thai">
            พบ {filteredReceives.length} รายการ
            {filteredReceives.length !== receives.length && ` จาก ${receives.length}`}
          </p>
        </div>
      )}

      {/* Empty State - Compact */}
      {filteredReceives.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 px-4">
          <Package className="w-12 h-12 text-gray-300 mb-2" />
          <h3 className="text-sm font-bold text-gray-900 font-thai mb-1">
            ไม่พบรายการรับสินค้า
          </h3>
          <p className="text-gray-500 font-thai text-center text-xs mb-2">
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
              className="px-3 py-1.5 bg-blue-600 text-white rounded font-thai text-xs hover:bg-blue-700 transition-colors"
            >
              ล้างตัวกรอง
            </button>
          )}
        </div>
      )}

      {/* Receives List - Compact */}
      <div className="p-1.5 space-y-1.5">
        {filteredReceives.map((receive) => {
          const pendingCount = getPendingScanCount(receive);
          const { totalPacks, totalPieces, totalItems } = getTotalQuantities(receive);
          const hasPending = pendingCount > 0;

          return (
            <div
              key={receive.receive_id}
              onClick={() => handleViewDetail(receive.receive_id)}
              className={`bg-white rounded shadow-sm border p-2 active:scale-98 transition-all cursor-pointer ${
                hasPending ? 'border-amber-300 bg-amber-50/30' : 'border-gray-200'
              }`}
            >
              {/* Header Row - Compact */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 font-mono text-xs">
                    {receive.receive_no}
                  </h3>
                  {hasPending && (
                    <Badge variant="warning" size="sm">
                      <span className="text-[8px]">🔸{pendingCount}</span>
                    </Badge>
                  )}
                  <span className="text-[10px] text-gray-500 font-thai">
                    {formatThaiDate(receive.receive_date)}
                  </span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              </div>

              {/* Reference Doc - Inline if exists */}
              {receive.reference_doc && (
                <div className="text-[10px] text-gray-500 font-thai mb-1">
                  PO: {receive.reference_doc}
                </div>
              )}

              {/* Type, Status, and Supplier - Single Row */}
              <div className="flex items-center gap-1 mb-1 flex-wrap">
                {getTypeBadge(receive.receive_type)}
                {getStatusBadge(receive.status)}
                {receive.master_supplier && (
                  <span className="text-[10px] text-gray-600 font-thai truncate">
                    • {receive.master_supplier.supplier_name}
                  </span>
                )}
                {receive.master_customer && (
                  <span className="text-[10px] text-gray-600 font-thai truncate">
                    • {receive.master_customer.customer_name}
                  </span>
                )}
              </div>

              {/* Stats - Compact Inline */}
              <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                <div className="flex items-center gap-2 text-[10px]">
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

export default function MobileReceivePageWithPermission() {
  return (
    <PermissionGuard 
      permission="mobile.receive"
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="text-center">
            <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
            <p className="text-gray-600">คุณไม่มีสิทธิ์ในการรับสินค้า</p>
          </div>
        </div>
      }
    >
      <MobileReceivePage />
    </PermissionGuard>
  );
}
