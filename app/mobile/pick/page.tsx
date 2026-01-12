'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Filter,
  ClipboardList,
  ChevronRight,
  Clock,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Loader2,
  X,
  Package,
  Truck,
  User,
  Maximize,
  Minimize,
} from 'lucide-react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import Badge from '@/components/ui/Badge';

interface Picklist {
  id: number;
  picklist_code: string;
  status: 'pending' | 'assigned' | 'picking' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
  total_lines: number;
  total_quantity: number;
  trip_id?: number;
  plan_id?: number;
  receiving_route_trips?: {
    trip_sequence: number;
    vehicle_id: string;
    receiving_route_plans?: {
      plan_code: string;
      plan_name: string;
    };
  };
}

interface FaceSheet {
  id: number;
  face_sheet_no: string;
  status: 'generated' | 'picking' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
  total_packages: number;
  total_items: number;
  warehouse_id: string;
}

interface BonusFaceSheet {
  id: number;
  face_sheet_no: string;
  status: string;
  pick_status?: string; // ✅ FIX (edit30): เพิ่ม pick_status สำหรับแสดงสถานะการหยิบ
  created_at: string;
  updated_at: string;
  total_packages: number;
  total_items: number;
  total_orders: number;
  warehouse_id: string;
}

// Face Sheet Statuses: generated (สร้างแล้ว), picking (กำลังหยิบ), completed (เสร็จสิ้น), cancelled (ยกเลิก)

type PickTask = (Picklist & { type: 'picklist' }) | (FaceSheet & { type: 'face_sheet' }) | (BonusFaceSheet & { type: 'bonus_face_sheet' });

const PICKLIST_STATUSES = [
  'all',
  'pending',
  'assigned',
  'completed',
  'cancelled'
] as const;

function MobilePickPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<PickTask[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showFilter, setShowFilter] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [mounted, setMounted] = useState(false);
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

  // Fix hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch both picklists and face sheets
  useEffect(() => {
    fetchTasks();
  }, [selectedStatus]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedStatus !== 'all') {
        params.append('status', selectedStatus);
      }

      // Fetch picklists
      const picklistsResponse = await fetch(`/api/picklists?${params.toString()}`);
      const picklistsData = await picklistsResponse.json();

      // Fetch face sheets
      const faceSheetsResponse = await fetch(`/api/face-sheets/generate?${params.toString()}`);
      const faceSheetsData = await faceSheetsResponse.json();

      // Fetch bonus face sheets
      const bonusFaceSheetsResponse = await fetch(`/api/bonus-face-sheets?${params.toString()}`);
      const bonusFaceSheetsData = await bonusFaceSheetsResponse.json();

      const allTasks: PickTask[] = [];

      // Add picklists
      if (picklistsData.data) {
        allTasks.push(...picklistsData.data.map((p: Picklist) => ({ ...p, type: 'picklist' as const })));
      }

      // Add face sheets (เฉพาะสถานะ picking ขึ้นไป - ไม่แสดง generated)
      if (faceSheetsData.data) {
        const filteredFaceSheets = faceSheetsData.data.filter((f: FaceSheet) => 
          f.status !== 'generated'
        );
        allTasks.push(...filteredFaceSheets.map((f: FaceSheet) => ({ ...f, type: 'face_sheet' as const })));
      }

      // Add bonus face sheets (เฉพาะสถานะ picking ขึ้นไป - ไม่แสดง generated)
      if (bonusFaceSheetsData.data) {
        const filteredBonusFaceSheets = bonusFaceSheetsData.data.filter((f: FaceSheet) => 
          f.status !== 'generated'
        );
        allTasks.push(...filteredBonusFaceSheets.map((f: FaceSheet) => ({ ...f, type: 'bonus_face_sheet' as const })));
      }

      // Sort by updated_at descending
      allTasks.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

      setTasks(allTasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTasks();
  };

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    const searchLower = searchTerm.toLowerCase();
    
    if (task.type === 'picklist') {
      const matchesSearch =
        task.picklist_code.toLowerCase().includes(searchLower) ||
        task.receiving_route_trips?.receiving_route_plans?.plan_code?.toLowerCase().includes(searchLower) ||
        String(task.receiving_route_trips?.vehicle_id || '').toLowerCase().includes(searchLower);
      return matchesSearch;
    } else {
      const matchesSearch =
        task.face_sheet_no.toLowerCase().includes(searchLower) ||
        task.warehouse_id.toLowerCase().includes(searchLower);
      return matchesSearch;
    }
  });

  // Get status badge
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' }> = {
      generated: { label: 'สร้างแล้ว', variant: 'default' },
      pending: { label: 'รอดำเนินการ', variant: 'default' },
      assigned: { label: 'มอบหมายแล้ว', variant: 'info' },
      picking: { label: 'กำลังหยิบ', variant: 'warning' },
      completed: { label: 'เสร็จสิ้น', variant: 'success' },
      cancelled: { label: 'ยกเลิก', variant: 'danger' }
    };

    const match = statusMap[status] || statusMap.pending;
    return (
      <Badge variant={match.variant} size="sm">
        {match.label}
      </Badge>
    );
  };

  // ✅ FIX (edit30): Get pick status badge สำหรับ bonus_face_sheet
  // ใช้ pick_status แทน status เพื่อแสดงสถานะการหยิบที่ถูกต้อง
  const getPickStatusBadge = (pickStatus: string | undefined) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' }> = {
      pending: { label: 'รอหยิบ', variant: 'default' },
      partial: { label: 'กำลังหยิบ', variant: 'warning' },
      picked: { label: 'เสร็จสิ้น', variant: 'success' }
    };

    const match = statusMap[pickStatus || 'pending'] || statusMap.pending;
    return (
      <Badge variant={match.variant} size="sm">
        {match.label}
      </Badge>
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-3.5 h-3.5 text-gray-500" />;
      case 'assigned':
        return <Package className="w-3.5 h-3.5 text-blue-500" />;
      case 'picking':
        return <Package className="w-3.5 h-3.5 text-yellow-500" />;
      case 'completed':
        return <CheckCircle className="w-3.5 h-3.5 text-green-500" />;
      case 'cancelled':
        return <AlertCircle className="w-3.5 h-3.5 text-red-500" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-gray-500" />;
    }
  };

  // ✅ FIX (edit30): Get pick status icon สำหรับ bonus_face_sheet
  const getPickStatusIcon = (pickStatus: string | undefined) => {
    switch (pickStatus) {
      case 'picked':
        return <CheckCircle className="w-3.5 h-3.5 text-green-500" />;
      case 'partial':
        return <Package className="w-3.5 h-3.5 text-yellow-500" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-gray-500" />;
    }
  };

  const formatDate = (dateString: string) => {
    if (typeof window === 'undefined') {
      // Server-side: return simple format
      return new Date(dateString).toISOString().slice(0, 16).replace('T', ' ');
    }
    // Client-side: return localized format
    const date = new Date(dateString);
    return date.toLocaleDateString('th-TH', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <div className="bg-gradient-to-br from-sky-400 to-sky-500 text-white p-4">
          <div className="flex items-center space-x-2">
            <ClipboardList className="w-6 h-6" />
            <h1 className="text-lg font-bold font-thai">เช็คสินค้า (Pick)</h1>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Header - Compact */}
      <div className="bg-gradient-to-br from-sky-400 to-sky-500 text-white p-2 sticky top-0 z-10 shadow-lg mobile-header">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center space-x-1.5">
            <ClipboardList className="w-4 h-4" />
            <h1 className="text-sm font-bold font-thai">เช็คสินค้า (Pick)</h1>
          </div>
          <div className="flex items-center gap-1">
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
        <div className="flex items-center gap-1.5 mobile-search" suppressHydrationWarning>
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหา..."
              className="w-full pl-7 pr-6 py-1.5 rounded bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-300 font-thai text-xs"
              suppressHydrationWarning
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
            {selectedStatus !== 'all' && (
              <span className="absolute -top-1 -right-1 bg-yellow-400 text-gray-900 rounded-full w-4 h-4 flex items-center justify-center text-[8px] font-bold">
                1
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Filter Dropdown - Compact */}
      {showFilter && (
        <div className="bg-sky-50 border-b border-sky-100 shadow-sm">
          <div className="p-2 space-y-1">
            {PICKLIST_STATUSES.map((status) => (
              <button
                key={status}
                onClick={() => {
                  setSelectedStatus(status);
                  setShowFilter(false);
                }}
                className={`w-full px-2 py-1.5 rounded text-left font-thai text-xs transition-colors ${
                  selectedStatus === status
                    ? 'bg-sky-500 text-white font-semibold'
                    : 'bg-white text-gray-700 hover:bg-sky-100'
                }`}
              >
                {status === 'all' && 'ทั้งหมด'}
                {status === 'pending' && 'รอดำเนินการ'}
                {status === 'assigned' && 'มอบหมายแล้ว'}
                {status === 'completed' && 'เสร็จสิ้น'}
                {status === 'cancelled' && 'ยกเลิก'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading State - Compact */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
        </div>
      )}

      {/* Empty State - Compact */}
      {!loading && filteredTasks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center px-4">
          <ClipboardList className="w-12 h-12 text-gray-300 mb-2" />
          <p className="text-gray-500 font-thai text-sm mb-1">ไม่พบรายการ</p>
          <p className="text-gray-400 text-xs font-thai">
            {searchTerm ? 'ลองค้นหาด้วยคำอื่น' : 'ยังไม่มีรายการที่ต้องเช็ค'}
          </p>
        </div>
      )}

      {/* Task List - Table Format - Compact */}
      {!loading && filteredTasks.length > 0 && (
        <div className="p-1.5">
          <div className="bg-white rounded shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-1.5 py-1 text-left text-[10px] font-semibold text-gray-700 font-thai">รหัส</th>
                  <th className="px-1.5 py-1 text-center text-[10px] font-semibold text-gray-700 font-thai">สถานะ</th>
                  <th className="px-1.5 py-1 text-center text-[10px] font-semibold text-gray-700 font-thai">จำนวน</th>
                  <th className="px-1.5 py-1 text-center text-[10px] font-semibold text-gray-700 font-thai">อัปเดต</th>
                  <th className="px-1 py-1 w-6"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTasks.map((task) => (
                  <tr
                    key={`${task.type}-${task.id}`}
                    onClick={() => {
                      if (task.type === 'picklist') {
                        router.push(`/mobile/pick/${task.id}`);
                      } else if (task.type === 'bonus_face_sheet') {
                        router.push(`/mobile/bonus-face-sheet/${task.id}`);
                      } else {
                        router.push(`/mobile/face-sheet/${task.id}`);
                      }
                    }}
                    className="hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer"
                  >
                    {/* รหัส */}
                    <td className="px-1.5 py-2">
                      <div className="flex items-center space-x-1">
                        <div className="flex-shrink-0">
                          {/* ✅ FIX (edit30): ใช้ pick_status icon สำหรับ bonus_face_sheet */}
                          {task.type === 'bonus_face_sheet' 
                            ? getPickStatusIcon((task as BonusFaceSheet).pick_status)
                            : getStatusIcon(task.status)
                          }
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 font-thai text-[10px] whitespace-nowrap">
                            {task.type === 'picklist' ? task.picklist_code : task.face_sheet_no}
                          </p>
                          {task.type === 'picklist' && task.receiving_route_trips?.receiving_route_plans && (
                            <p className="text-[9px] text-gray-500 font-thai whitespace-nowrap">
                              {task.receiving_route_trips.receiving_route_plans.plan_code}
                            </p>
                          )}
                          {task.type === 'face_sheet' && (
                            <p className="text-[9px] text-gray-500 font-thai whitespace-nowrap">ใบปะหน้า</p>
                          )}
                          {task.type === 'bonus_face_sheet' && (
                            <p className="text-[9px] text-gray-500 font-thai whitespace-nowrap">ของแถม</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* สถานะ */}
                    <td className="px-1.5 py-2 text-center">
                      {/* ✅ FIX (edit30): ใช้ pick_status สำหรับ bonus_face_sheet */}
                      {task.type === 'bonus_face_sheet' 
                        ? getPickStatusBadge((task as BonusFaceSheet).pick_status)
                        : getStatusBadge(task.status)
                      }
                    </td>

                    {/* จำนวน */}
                    <td className="px-1.5 py-2 text-center">
                      <div>
                        <p className="font-semibold text-gray-900 font-thai text-xs">
                          {task.type === 'picklist' ? `${task.total_lines}` : `${task.total_packages}`}
                        </p>
                        <p className="text-[9px] text-gray-500 font-thai">
                          {task.type === 'picklist' ? 'รายการ' : 'แพ็ค'}
                        </p>
                      </div>
                    </td>

                    {/* อัปเดต */}
                    <td className="px-1.5 py-2 text-center" suppressHydrationWarning>
                      <p className="text-[9px] text-gray-600 font-thai whitespace-nowrap">
                        {formatDate(task.updated_at)}
                      </p>
                    </td>

                    {/* Arrow */}
                    <td className="px-1 py-2 text-center">
                      <ChevronRight className="w-3.5 h-3.5 text-gray-400 mx-auto" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MobilePickPageWithPermission() {
  return (
    <PermissionGuard 
      permission="mobile.pick"
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="text-center">
            <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
            <p className="text-gray-600">คุณไม่มีสิทธิ์ในการเช็คสินค้า (Pick)</p>
          </div>
        </div>
      }
    >
      <MobilePickPage />
    </PermissionGuard>
  );
}
