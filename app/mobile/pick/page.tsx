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
  RefreshCw,
  Loader2,
  X,
  Package,
  Truck
} from 'lucide-react';
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

const PICKLIST_STATUSES = [
  'all',
  'pending',
  'assigned',
  'completed',
  'cancelled'
] as const;

export default function MobilePickPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [picklists, setPicklists] = useState<Picklist[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showFilter, setShowFilter] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch picklists
  useEffect(() => {
    fetchPicklists();
  }, [selectedStatus]);

  const fetchPicklists = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedStatus !== 'all') {
        params.append('status', selectedStatus);
      }

      const response = await fetch(`/api/picklists?${params.toString()}`);
      const data = await response.json();

      if (data.data) {
        setPicklists(data.data);
      }
    } catch (error) {
      console.error('Error fetching picklists:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchPicklists();
  };

  // Filter picklists
  const filteredPicklists = picklists.filter(picklist => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      picklist.picklist_code.toLowerCase().includes(searchLower) ||
      picklist.receiving_route_trips?.receiving_route_plans?.plan_code?.toLowerCase().includes(searchLower) ||
      picklist.receiving_route_trips?.vehicle_id?.toLowerCase().includes(searchLower);

    return matchesSearch;
  });

  // Get status badge
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' }> = {
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
        return <Clock className="w-4 h-4 text-gray-500" />;
      case 'assigned':
        return <Package className="w-4 h-4 text-blue-500" />;
      case 'picking':
        return <Package className="w-4 h-4 text-yellow-500" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'cancelled':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('th-TH', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

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
            <div className="text-xl font-bold">{picklists.filter(p => p.status === 'assigned').length}</div>
            <div className="text-[10px] opacity-90">มอบหมายแล้ว</div>
          </div>
          <div className="bg-white/15 backdrop-blur-sm rounded-md p-1.5 text-center">
            <div className="text-xl font-bold">{picklists.filter(p => p.status === 'completed').length}</div>
            <div className="text-[10px] opacity-90">เสร็จสิ้น</div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ค้นหา Picklist Code, แผนรถ..."
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-300 font-thai text-sm"
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
      {!loading && filteredPicklists.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center px-4">
          <ClipboardList className="w-16 h-16 text-gray-300 mb-4" />
          <p className="text-gray-500 font-thai text-lg mb-2">ไม่พบรายการ Picklist</p>
          <p className="text-gray-400 text-sm font-thai">
            {searchTerm ? 'ลองค้นหาด้วยคำอื่น' : 'ยังไม่มีรายการที่ต้องเช็ค'}
          </p>
        </div>
      )}

      {/* Picklist List */}
      {!loading && filteredPicklists.length > 0 && (
        <div className="p-4 space-y-3">
          {filteredPicklists.map((picklist) => (
            <div
              key={picklist.id}
              onClick={() => router.push(`/mobile/pick/${picklist.id}`)}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-2.5 active:scale-98 transition-all cursor-pointer"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-2">
                  {getStatusIcon(picklist.status)}
                  <div>
                    <h3 className="font-bold text-gray-900 font-thai">
                      {picklist.picklist_code}
                    </h3>
                    {picklist.receiving_route_trips?.receiving_route_plans && (
                      <p className="text-xs text-gray-500 font-thai">
                        {picklist.receiving_route_trips.receiving_route_plans.plan_code}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusBadge(picklist.status)}
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center space-x-2">
                  <Package className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500 font-thai">จำนวนรายการ</p>
                    <p className="font-semibold text-gray-900 font-thai">
                      {picklist.total_lines} รายการ
                    </p>
                  </div>
                </div>
                {picklist.receiving_route_trips?.vehicle_id && (
                  <div className="flex items-center space-x-2">
                    <Truck className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500 font-thai">รถ</p>
                      <p className="font-semibold text-gray-900 font-thai">
                        {picklist.receiving_route_trips.vehicle_id}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500 font-thai">
                อัปเดต: {formatDate(picklist.updated_at)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
