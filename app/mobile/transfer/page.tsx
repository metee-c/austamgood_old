'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import MobileLayout from '@/components/layout/MobileLayout';
import MobileButton from '@/components/mobile/MobileButton';
import MobileBadge from '@/components/mobile/MobileBadge';
import {
  Package,
  Search,
  Filter,
  Clock,
  MapPin,
  ArrowRight,
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  PlayCircle,
  Users,
  ChevronRight
} from 'lucide-react';
import { useMoves } from '@/hooks/useMoves';
import { MoveRecord, MoveStatus, MoveType } from '@/lib/database/move';

// Type labels
const MOVE_TYPE_LABELS: Record<MoveType, string> = {
  'putaway': 'จัดเก็บสินค้า',
  'transfer': 'ย้ายสินค้า',
  'replenishment': 'เติมสินค้า',
  'adjustment': 'ปรับสต๊อก'
};

const MOVE_STATUS_LABELS: Record<MoveStatus, string> = {
  'draft': 'ร่าง',
  'pending': 'รอดำเนินการ',
  'in_progress': 'กำลังดำเนินการ',
  'completed': 'เสร็จสิ้น',
  'cancelled': 'ยกเลิก'
};

// Badge variant mapping
const STATUS_BADGE_VARIANTS: Record<MoveStatus, 'default' | 'info' | 'warning' | 'success' | 'danger'> = {
  'draft': 'default',
  'pending': 'default',
  'in_progress': 'warning',
  'completed': 'success',
  'cancelled': 'danger'
};

// Status icons
const STATUS_ICONS: Record<MoveStatus, any> = {
  'draft': Clock,
  'pending': Clock,
  'in_progress': PlayCircle,
  'completed': CheckCircle2,
  'cancelled': AlertCircle
};

export default function MobileTransferListPage() {
  const router = useRouter();

  // Data fetching
  const { data: allMoves, loading, error, refetch } = useMoves();

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<MoveStatus | 'all'>('all');
  const [selectedType, setSelectedType] = useState<MoveType | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Audio feedback
  const playTapSound = () => {
    try {
      const audio = new Audio('/audio/tap.mp3');
      audio.volume = 0.3;
      audio.play().catch(() => {});
    } catch (err) {
      // Silent fail
    }
  };

  // Filter and search logic
  const filteredMoves = useMemo(() => {
    if (!allMoves) return [];

    let result = [...allMoves];

    // Filter by status
    if (selectedStatus !== 'all') {
      result = result.filter(move => move.status === selectedStatus);
    }

    // Filter by type
    if (selectedType !== 'all') {
      result = result.filter(move => move.move_type === selectedType);
    }

    // Search by move_no or source_document
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter(move =>
        move.move_no?.toLowerCase().includes(term) ||
        move.source_document?.toLowerCase().includes(term)
      );
    }

    // Sort by scheduled_at (newest first), then by created_at
    result.sort((a, b) => {
      const dateA = new Date(a.scheduled_at || a.created_at).getTime();
      const dateB = new Date(b.scheduled_at || b.created_at).getTime();
      return dateB - dateA;
    });

    return result;
  }, [allMoves, selectedStatus, selectedType, searchTerm]);

  // Statistics
  const stats = useMemo(() => {
    if (!allMoves) return { total: 0, assigned: 0, inProgress: 0, completed: 0 };

    return {
      total: allMoves.length,
      assigned: allMoves.filter(m => m.status === 'pending').length,
      inProgress: allMoves.filter(m => m.status === 'in_progress').length,
      completed: allMoves.filter(m => m.status === 'completed').length
    };
  }, [allMoves]);

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    playTapSound();
    await refetch();
    setTimeout(() => setRefreshing(false), 500);
  };

  // Handle move card click
  const handleMoveClick = (move: MoveRecord) => {
    playTapSound();
    router.push(`/mobile/transfer/${move.move_no}`);
  };

  // Calculate progress for a move
  const calculateProgress = (move: MoveRecord) => {
    const items = move.wms_move_items || [];
    if (items.length === 0) return 0;

    const completedCount = items.filter(item => item.status === 'completed').length;
    return Math.round((completedCount / items.length) * 100);
  };

  // Get first from/to locations
  const getLocationSummary = (move: MoveRecord) => {
    const items = move.wms_move_items || [];
    if (items.length === 0) return { from: '-', to: '-' };

    const fromLocations = items
      .map(item => item.from_location?.location_name || item.from_location?.location_code || item.from_location_id)
      .filter(Boolean);

    const toLocations = items
      .map(item => item.to_location?.location_name || item.to_location?.location_code || item.to_location_id)
      .filter(Boolean);

    const uniqueFroms = [...new Set(fromLocations)];
    const uniqueTos = [...new Set(toLocations)];

    const fromText = uniqueFroms.length > 1
      ? `${uniqueFroms[0]} และอื่นๆ`
      : uniqueFroms[0] || '-';

    const toText = uniqueTos.length > 1
      ? `${uniqueTos[0]} และอื่นๆ`
      : uniqueTos[0] || '-';

    return { from: fromText, to: toText };
  };

  // Format date
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    // If today
    if (diffDays === 0) {
      if (diffMins < 60) {
        return `${diffMins} นาทีที่แล้ว`;
      }
      return `${diffHours} ชั่วโมงที่แล้ว`;
    }

    // If within 7 days
    if (diffDays < 7) {
      return `${diffDays} วันที่แล้ว`;
    }

    // Format as date
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <MobileLayout title="รายการย้ายสินค้า">
      <div className="flex flex-col h-full bg-gradient-to-b from-blue-50 to-white">

        {/* Statistics Cards */}
        <div className="p-4 pb-2">
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-white rounded-lg p-3 shadow-sm text-center">
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-xs text-gray-500 mt-1">ทั้งหมด</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 shadow-sm text-center border border-blue-200">
              <div className="text-2xl font-bold text-blue-700">{stats.assigned}</div>
              <div className="text-xs text-blue-600 mt-1">รอดำเนินการ</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3 shadow-sm text-center border border-yellow-200">
              <div className="text-2xl font-bold text-yellow-700">{stats.inProgress}</div>
              <div className="text-xs text-yellow-600 mt-1">ดำเนินการ</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 shadow-sm text-center border border-green-200">
              <div className="text-2xl font-bold text-green-700">{stats.completed}</div>
              <div className="text-xs text-green-600 mt-1">เสร็จสิ้น</div>
            </div>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="px-4 pb-3 space-y-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาเลขใบย้าย..."
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
            />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => {
              setShowFilters(!showFilters);
              playTapSound();
            }}
            className="flex items-center justify-between w-full px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 active:bg-gray-50"
          >
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4" />
              <span>ตัวกรอง</span>
              {(selectedStatus !== 'all' || selectedType !== 'all') && (
                <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {(selectedStatus !== 'all' ? 1 : 0) + (selectedType !== 'all' ? 1 : 0)}
                </span>
              )}
            </div>
            <ChevronRight className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-90' : ''}`} />
          </button>

          {/* Filter Options */}
          {showFilters && (
            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm space-y-3">
              {/* Status Filter */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">สถานะ</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => {
                    setSelectedStatus(e.target.value as MoveStatus | 'all');
                    playTapSound();
                  }}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">ทุกสถานะ</option>
                  <option value="draft">ร่าง</option>
                  <option value="pending">รอดำเนินการ</option>
                  <option value="in_progress">กำลังดำเนินการ</option>
                  <option value="completed">เสร็จสิ้น</option>
                  <option value="cancelled">ยกเลิก</option>
                </select>
              </div>

              {/* Type Filter */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">ประเภท</label>
                <select
                  value={selectedType}
                  onChange={(e) => {
                    setSelectedType(e.target.value as MoveType | 'all');
                    playTapSound();
                  }}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">ทุกประเภท</option>
                  <option value="putaway">จัดเก็บสินค้า</option>
                  <option value="transfer">ย้ายสินค้า</option>
                  <option value="replenishment">เติมสินค้า</option>
                  <option value="adjustment">ปรับสต๊อก</option>
                </select>
              </div>

              {/* Clear Filters */}
              {(selectedStatus !== 'all' || selectedType !== 'all') && (
                <button
                  onClick={() => {
                    setSelectedStatus('all');
                    setSelectedType('all');
                    playTapSound();
                  }}
                  className="w-full px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg active:bg-gray-200"
                >
                  ล้างตัวกรอง
                </button>
              )}
            </div>
          )}
        </div>

        {/* Refresh Button */}
        <div className="px-4 pb-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg active:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'กำลังรีเฟรช...' : 'รีเฟรชข้อมูล'}</span>
          </button>
        </div>

        {/* Move List */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {loading && !refreshing ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <Loader2 className="w-8 h-8 animate-spin mb-3" />
              <p className="text-sm">กำลังโหลดข้อมูล...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 text-red-500 px-4">
              <AlertCircle className="w-12 h-12 mb-3" />
              <p className="text-sm text-center font-medium">{error}</p>
              <button
                onClick={handleRefresh}
                className="mt-4 px-6 py-2 bg-red-500 text-white text-sm font-medium rounded-lg active:bg-red-600"
              >
                ลองใหม่
              </button>
            </div>
          ) : filteredMoves.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <Package className="w-16 h-16 mb-3" />
              <p className="text-sm font-medium">ไม่พบรายการย้ายสินค้า</p>
              <p className="text-xs mt-1">
                {searchTerm || selectedStatus !== 'all' || selectedType !== 'all'
                  ? 'ลองปรับเงื่อนไขการค้นหา'
                  : 'ยังไม่มีใบย้ายในระบบ'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMoves.map((move) => {
                const items = move.wms_move_items || [];
                const progress = calculateProgress(move);
                const locations = getLocationSummary(move);
                const StatusIcon = STATUS_ICONS[move.status];

                return (
                  <div
                    key={move.move_id}
                    onClick={() => handleMoveClick(move)}
                    className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 active:scale-98 transition-transform"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-base font-bold text-gray-900">{move.move_no}</h3>
                          <StatusIcon className="w-4 h-4 text-gray-400" />
                        </div>
                        <div className="flex items-center gap-2">
                          <MobileBadge variant={STATUS_BADGE_VARIANTS[move.status]} size="sm">
                            {MOVE_STATUS_LABELS[move.status]}
                          </MobileBadge>
                          <span className="text-xs text-gray-500">
                            {MOVE_TYPE_LABELS[move.move_type]}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
                    </div>

                    {/* Info Grid */}
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      {/* Items Count */}
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-blue-500 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs text-gray-500">รายการ</div>
                          <div className="text-sm font-semibold text-gray-900">
                            {items.length} items
                          </div>
                        </div>
                      </div>

                      {/* Scheduled Date */}
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-orange-500 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs text-gray-500">กำหนดการ</div>
                          <div className="text-sm font-semibold text-gray-900 truncate">
                            {formatDate(move.scheduled_at || move.created_at)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Locations */}
                    <div className="bg-gray-50 rounded-lg p-3 mb-3">
                      <div className="flex items-center gap-2 text-xs">
                        <MapPin className="w-4 h-4 text-green-600 flex-shrink-0" />
                        <span className="text-gray-600 truncate">{locations.from}</span>
                      </div>
                      <div className="flex items-center justify-center my-1">
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        <span className="text-gray-600 truncate">{locations.to}</span>
                      </div>
                    </div>

                    {/* Progress */}
                    {move.status !== 'completed' && move.status !== 'cancelled' && items.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-600">ความคืบหน้า</span>
                          <span className="font-semibold text-blue-600">{progress}%</span>
                        </div>
                        <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {items.filter(i => i.status === 'completed').length} / {items.length} รายการ
                        </div>
                      </div>
                    )}

                    {/* Completed Badge */}
                    {move.status === 'completed' && (
                      <div className="flex items-center justify-center gap-2 bg-green-50 text-green-700 py-2 rounded-lg">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-sm font-semibold">เสร็จสิ้นแล้ว</span>
                      </div>
                    )}

                    {/* Reference Doc */}
                    {move.source_document && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <div className="text-xs text-gray-500">
                          อ้างอิง: <span className="text-gray-700 font-medium">{move.source_document}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Results Count */}
        {!loading && filteredMoves.length > 0 && (
          <div className="px-4 py-3 bg-white border-t border-gray-200">
            <p className="text-sm text-center text-gray-600">
              แสดง <span className="font-semibold text-gray-900">{filteredMoves.length}</span> รายการ
              {(searchTerm || selectedStatus !== 'all' || selectedType !== 'all') && (
                <span> จากทั้งหมด <span className="font-semibold text-gray-900">{allMoves?.length || 0}</span> รายการ</span>
              )}
            </p>
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
