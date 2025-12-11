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
  Truck
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
        task.receiving_route_trips?.vehicle_id?.toLowerCase().includes(searchLower);
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
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-sky-400 to-sky-500 text-white p-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <ClipboardList className="w-6 h-6" />
            <h1 className="text-lg font-bold font-thai">เช็คสินค้า (Pick)</h1>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition-colors active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-white/15 backdrop-blur-sm rounded-md p-1.5 text-center">
            <div className="text-xl font-bold">
              {tasks.filter(t => 
                (t.type === 'picklist' && t.status === 'assigned') || 
                (t.type === 'face_sheet' && t.status === 'generated')
              ).length}
            </div>
            <div className="text-[10px] opacity-90">รอหยิบ</div>
          </div>
          <div className="bg-white/15 backdrop-blur-sm rounded-md p-1.5 text-center">
            <div className="text-xl font-bold">{tasks.filter(t => t.status === 'completed').length}</div>
            <div className="text-[10px] opacity-90">เสร็จสิ้น</div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative" suppressHydrationWarning>
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ค้นหา Picklist Code, แผนรถ..."
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-300 font-thai text-sm"
            suppressHydrationWarning
          />
        </div>

        {/* Filter Button */}
        <button
          onClick={() => setShowFilter(!showFilter)}
          className="mt-2 w-full bg-white/20 rounded-lg py-1.5 px-3 flex items-center justify-between font-thai text-xs hover:bg-white/30 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5" />
            <span>กรอง: {
              selectedStatus === 'all' ? 'ทั้งหมด' :
              selectedStatus === 'assigned' ? 'มอบหมายแล้ว' :
              selectedStatus === 'completed' ? 'เสร็จสิ้น' :
              selectedStatus === 'pending' ? 'รอดำเนินการ' :
              selectedStatus === 'cancelled' ? 'ยกเลิก' : 'อื่นๆ'
            }</span>
          </span>
          {showFilter ? <X className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Filter Dropdown */}
      {showFilter && (
        <div className="bg-sky-50 border-b border-sky-100 shadow-sm">
          <div className="p-3 space-y-2">
            {PICKLIST_STATUSES.map((status) => (
              <button
                key={status}
                onClick={() => {
                  setSelectedStatus(status);
                  setShowFilter(false);
                }}
                className={`w-full px-3 py-2 rounded-lg text-left font-thai text-sm transition-colors ${
                  selectedStatus === status
                    ? 'bg-sky-500 text-white font-semibold'
                    : 'bg-white text-gray-700 hover:bg-sky-100'
                }`}
              >
                {status === 'all' && 'ทั้งหมด'}
                {status === 'pending' && 'รอดำเนินการ'}
                {status === 'assigned' && 'มอบหมายแล้ว (แนะนำ)'}
                {status === 'completed' && 'เสร็จสิ้น'}
                {status === 'cancelled' && 'ยกเลิก'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredTasks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center px-4">
          <ClipboardList className="w-16 h-16 text-gray-300 mb-4" />
          <p className="text-gray-500 font-thai text-lg mb-2">ไม่พบรายการ</p>
          <p className="text-gray-400 text-sm font-thai">
            {searchTerm ? 'ลองค้นหาด้วยคำอื่น' : 'ยังไม่มีรายการที่ต้องเช็ค'}
          </p>
        </div>
      )}

      {/* Task List - Table Format */}
      {!loading && filteredTasks.length > 0 && (
        <div className="p-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 font-thai">รหัส</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 font-thai">สถานะ</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 font-thai">จำนวน</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 font-thai">อัปเดต</th>
                  <th className="px-3 py-2 w-10"></th>
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
                    <td className="px-2 py-3">
                      <div className="flex items-center space-x-1.5">
                        <div className="flex-shrink-0">
                          {getStatusIcon(task.status)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 font-thai text-xs whitespace-nowrap">
                            {task.type === 'picklist' ? task.picklist_code : task.face_sheet_no}
                          </p>
                          {task.type === 'picklist' && task.receiving_route_trips?.receiving_route_plans && (
                            <p className="text-[10px] text-gray-500 font-thai whitespace-nowrap">
                              {task.receiving_route_trips.receiving_route_plans.plan_code}
                            </p>
                          )}
                          {task.type === 'face_sheet' && (
                            <p className="text-[10px] text-gray-500 font-thai whitespace-nowrap">ใบปะหน้า</p>
                          )}
                          {task.type === 'bonus_face_sheet' && (
                            <p className="text-[10px] text-gray-500 font-thai whitespace-nowrap">ใบปะหน้าของแถม</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* สถานะ */}
                    <td className="px-3 py-3 text-center">
                      {getStatusBadge(task.status)}
                    </td>

                    {/* จำนวน */}
                    <td className="px-3 py-3 text-center">
                      <div>
                        <p className="font-semibold text-gray-900 font-thai text-sm">
                          {task.type === 'picklist' ? `${task.total_lines}` : `${task.total_packages}`}
                        </p>
                        <p className="text-xs text-gray-500 font-thai">
                          {task.type === 'picklist' ? 'รายการ' : 'แพ็ค'}
                        </p>
                      </div>
                    </td>

                    {/* อัปเดต */}
                    <td className="px-3 py-3 text-center" suppressHydrationWarning>
                      <p className="text-xs text-gray-600 font-thai whitespace-nowrap">
                        {formatDate(task.updated_at)}
                      </p>
                    </td>

                    {/* Arrow */}
                    <td className="px-3 py-3 text-center">
                      <ChevronRight className="w-5 h-5 text-gray-400 mx-auto" />
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
