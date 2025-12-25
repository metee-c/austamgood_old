'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Filter,
  Truck,
  ChevronRight,
  Clock,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Loader2,
  X,
  User
} from 'lucide-react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import Badge from '@/components/ui/Badge';

interface LoadlistTask {
  loadlist_id: number;
  loadlist_code: string;
  status: string;
  total_items: number;
  total_pieces: number;
  total_packs: number;
  total_weight: number;
  created_at: string;
  updated_at: string;
  vehicle?: { plate_number: string };
  driver?: { first_name: string; last_name: string };
  document_types?: string[];
}

const LOADLIST_STATUSES = [
  'all',
  'pending',
  'loaded',
  'completed'
] as const;

function MobileLoadingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadlists, setLoadlists] = useState<LoadlistTask[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showFilter, setShowFilter] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch loadlists
  useEffect(() => {
    fetchLoadlists();
  }, [selectedStatus]);

  const fetchLoadlists = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedStatus !== 'all') {
        params.append('status', selectedStatus);
      }

      const response = await fetch(`/api/mobile/loading/tasks?${params.toString()}`);
      const data = await response.json();

      if (data.data) {
        setLoadlists(data.data);
      }
    } catch (error) {
      console.error('Error fetching loadlists:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchLoadlists();
  };

  // Filter loadlists
  const filteredLoadlists = loadlists.filter(loadlist => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      loadlist.loadlist_code.toLowerCase().includes(searchLower) ||
      loadlist.vehicle?.plate_number?.toLowerCase().includes(searchLower) ||
      loadlist.driver?.first_name?.toLowerCase().includes(searchLower) ||
      loadlist.driver?.last_name?.toLowerCase().includes(searchLower);

    return matchesSearch;
  });

  // Get status badge
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' }> = {
      pending: { label: 'รอโหลด', variant: 'warning' },
      loaded: { label: 'โหลดแล้ว', variant: 'success' },
      completed: { label: 'เสร็จสิ้น', variant: 'info' }
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
        return <Clock className="w-3.5 h-3.5 text-yellow-500" />;
      case 'loaded':
        return <CheckCircle className="w-3.5 h-3.5 text-green-500" />;
      case 'completed':
        return <CheckCircle className="w-3.5 h-3.5 text-blue-500" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-gray-500" />;
    }
  };

  const formatDate = (dateString: string) => {
    if (typeof window === 'undefined') {
      // Server-side: return simple format
      return new Date(dateString).toISOString().slice(0, 16).replace('T', ' ');
    }
    // Client-side: use Thai locale
    const date = new Date(dateString);
    return date.toLocaleDateString('th-TH', {
      day: 'numeric',
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
            <Truck className="w-6 h-6" />
            <h1 className="text-lg font-bold font-thai">โหลดสินค้า (Loading)</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition-colors active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => router.push('/profile')}
              className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition-colors active:scale-95"
            >
              <User className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search and Filter - Same Row */}
        <div className="flex items-center gap-2 mb-2">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหา Loadlist Code, ทะเบียนรถ..."
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

          {/* Filter Button - Compact */}
          <button
            onClick={() => setShowFilter(!showFilter)}
            className="relative bg-white/20 rounded-lg p-2 hover:bg-white/30 transition-colors flex-shrink-0"
          >
            <Filter className="w-5 h-5" />
            {selectedStatus !== 'all' && (
              <span className="absolute -top-1 -right-1 bg-yellow-400 text-gray-900 rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">
                1
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Filter Dropdown */}
      {showFilter && (
        <div className="bg-sky-50 border-b border-sky-100 shadow-sm">
          <div className="p-3 space-y-2">
            {LOADLIST_STATUSES.map((status) => (
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
                {status === 'pending' && 'รอโหลด (แนะนำ)'}
                {status === 'loaded' && 'โหลดแล้ว'}
                {status === 'completed' && 'เสร็จสิ้น'}
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
      {!loading && filteredLoadlists.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center px-4">
          <Truck className="w-16 h-16 text-gray-300 mb-4" />
          <p className="text-gray-500 font-thai text-lg mb-2">ไม่พบรายการใบโหลด</p>
          <p className="text-gray-400 text-sm font-thai">
            {searchTerm ? 'ลองค้นหาด้วยคำอื่น' : 'ยังไม่มีรายการที่ต้องโหลด'}
          </p>
        </div>
      )}

      {/* Loadlist List - Table Format */}
      {!loading && filteredLoadlists.length > 0 && (
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
                {filteredLoadlists.map((loadlist) => (
                  <tr
                    key={loadlist.loadlist_id}
                    onClick={() => router.push(`/mobile/loading/${loadlist.loadlist_code}`)}
                    className="hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer"
                  >
                    {/* รหัส */}
                    <td className="px-2 py-3">
                      <div className="flex items-center space-x-1.5">
                        <div className="flex-shrink-0">
                          {getStatusIcon(loadlist.status)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 font-thai text-xs whitespace-nowrap">
                            {loadlist.loadlist_code}
                          </p>
                          {loadlist.vehicle && (
                            <p className="text-[10px] text-gray-500 font-thai whitespace-nowrap">
                              {loadlist.vehicle.plate_number}
                            </p>
                          )}
                          {loadlist.document_types && loadlist.document_types.length > 0 && (
                            <p className="text-[9px] text-sky-600 font-thai whitespace-nowrap mt-0.5">
                              {loadlist.document_types.join(', ')}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* สถานะ */}
                    <td className="px-3 py-3 text-center">
                      {getStatusBadge(loadlist.status)}
                    </td>

                    {/* จำนวน */}
                    <td className="px-3 py-3 text-center">
                      <div>
                        <p className="font-semibold text-gray-900 font-thai text-sm">
                          {loadlist.total_items}
                        </p>
                        <p className="text-xs text-gray-500 font-thai">
                          รายการ
                        </p>
                      </div>
                    </td>

                    {/* อัปเดต */}
                    <td className="px-3 py-3 text-center" suppressHydrationWarning>
                      <p className="text-xs text-gray-600 font-thai whitespace-nowrap">
                        {formatDate(loadlist.updated_at)}
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

export default function MobileLoadingPageWithPermission() {
  return (
    <PermissionGuard 
      permission="mobile.loading"
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="text-center">
            <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
            <p className="text-gray-600">คุณไม่มีสิทธิ์ในการโหลดสินค้า</p>
          </div>
        </div>
      }
    >
      <MobileLoadingPage />
    </PermissionGuard>
  );
}
