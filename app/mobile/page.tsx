'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Truck,
  Move,
  Package,
  QrCode,
  Bell,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

interface ActivitySummary {
  receives: { total: number; pending: number };
  moves: { total: number; pending: number };
  loading: { total: number; pending: number };
}

interface RecentActivity {
  id: string;
  type: 'receive' | 'move' | 'loading';
  action: string;
  time: string;
  status: 'completed' | 'pending' | 'in_progress';
}

export default function MobileDashboardPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<ActivitySummary>({
    receives: { total: 0, pending: 0 },
    moves: { total: 0, pending: 0 },
    loading: { total: 0, pending: 0 }
  });
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch receives
      const receivesRes = await fetch('/api/receives?limit=100');
      const receivesData = await receivesRes.json();
      const receives = receivesData.data || [];

      // Fetch moves
      const movesRes = await fetch('/api/moves?limit=100');
      const movesData = await movesRes.json();
      const moves = movesData.data || [];

      // Calculate summaries
      setSummary({
        receives: {
          total: receives.length,
          pending: receives.filter((r: any) => r.status === 'รอดำเนินการ').length
        },
        moves: {
          total: moves.length,
          pending: moves.filter((m: any) => m.status === 'รอดำเนินการ').length
        },
        loading: { total: 0, pending: 0 }
      });

      // Build recent activities
      const activities: RecentActivity[] = [];

      receives.slice(0, 3).forEach((r: any) => {
        activities.push({
          id: `receive-${r.id}`,
          type: 'receive',
          action: `รับสินค้า ${r.receive_no}`,
          time: r.created_at,
          status: r.status === 'รอดำเนินการ' ? 'pending' : 'completed'
        });
      });

      moves.slice(0, 3).forEach((m: any) => {
        activities.push({
          id: `move-${m.id}`,
          type: 'move',
          action: `ย้ายสินค้า ${m.move_no}`,
          time: m.created_at,
          status: m.status === 'รอดำเนินการ' ? 'pending' : 'completed'
        });
      });

      // Sort by time and take top 5
      activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      setRecentActivities(activities.slice(0, 5));

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'receive': return Package;
      case 'move': return Move;
      case 'loading': return Truck;
      default: return Package;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600';
      case 'pending': return 'text-orange-600';
      case 'in_progress': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-white pb-20">
      {/* Compact Header */}
      <div className="bg-gradient-to-r from-sky-400 to-sky-500 text-white sticky top-0 z-10 shadow-md">
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-lg font-bold font-thai">ภาพรวมกิจกรรม</h1>
            <button className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition-colors">
              <Bell className="w-4 h-4" />
            </button>
          </div>
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/15 backdrop-blur-sm rounded-lg p-2">
              <div className="flex items-center gap-1 mb-0.5">
                <Package className="w-3 h-3" />
                <span className="text-[10px]">รับสินค้า</span>
              </div>
              <p className="text-lg font-bold">{summary.receives.pending}</p>
              <p className="text-[10px] text-white/80">รอดำเนินการ</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-lg p-2">
              <div className="flex items-center gap-1 mb-0.5">
                <Move className="w-3 h-3" />
                <span className="text-[10px]">ย้ายสินค้า</span>
              </div>
              <p className="text-lg font-bold">{summary.moves.pending}</p>
              <p className="text-[10px] text-white/80">รอดำเนินการ</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-lg p-2">
              <div className="flex items-center gap-1 mb-0.5">
                <Truck className="w-3 h-3" />
                <span className="text-[10px]">โหลดสินค้า</span>
              </div>
              <p className="text-lg font-bold">{summary.loading.pending}</p>
              <p className="text-[10px] text-white/80">รอดำเนินการ</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-2 space-y-2">
        {/* Notifications */}
        {(summary.receives.pending > 0 || summary.moves.pending > 0) && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-2.5">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-orange-900 font-thai mb-1">
                  มีงานที่รอดำเนินการ
                </p>
                <div className="space-y-0.5">
                  {summary.receives.pending > 0 && (
                    <p className="text-[11px] text-orange-700 font-thai">
                      • รับสินค้า {summary.receives.pending} รายการ
                    </p>
                  )}
                  {summary.moves.pending > 0 && (
                    <p className="text-[11px] text-orange-700 font-thai">
                      • ย้ายสินค้า {summary.moves.pending} รายการ
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Activities */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100">
          <div className="p-2 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-sky-600" />
              <h2 className="text-sm font-semibold text-gray-900 font-thai">กิจกรรมล่าสุด</h2>
            </div>
            <TrendingUp className="w-3.5 h-3.5 text-gray-400" />
          </div>
          <div className="divide-y divide-gray-100">
            {loading ? (
              <div key="loading" className="p-3 text-center">
                <p className="text-xs text-gray-500 font-thai">กำลังโหลด...</p>
              </div>
            ) : recentActivities.length === 0 ? (
              <div key="empty" className="p-3 text-center">
                <p className="text-xs text-gray-500 font-thai">ยังไม่มีกิจกรรม</p>
              </div>
            ) : (
              recentActivities.map((activity, index) => {
                const Icon = getActivityIcon(activity.type);
                return (
                  <div key={`activity-${activity.id}-${index}`} className="p-2 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-sky-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Icon className="w-3.5 h-3.5 text-sky-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900 font-thai truncate">
                          {activity.action}
                        </p>
                        <p className="text-[10px] text-gray-500 font-thai">
                          {format(new Date(activity.time), 'HH:mm · dd MMM', { locale: th })}
                        </p>
                      </div>
                      <div className={`flex-shrink-0 ${getStatusColor(activity.status)}`}>
                        {activity.status === 'completed' ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <Clock className="w-4 h-4" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Quick Access */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100">
          <div className="p-2 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900 font-thai">เมนูด่วน</h2>
          </div>
          <div className="grid grid-cols-2 gap-1.5 p-1.5">
            {[
              { path: '/mobile/receive', icon: Package, label: 'รับสินค้า', color: 'purple' },
              { path: '/mobile/transfer', icon: Move, label: 'ย้ายสินค้า', color: 'green' },
              { path: '/mobile/loading', icon: Truck, label: 'โหลดสินค้า', color: 'blue' },
              { path: '/mobile/pick', icon: QrCode, label: 'หยิบสินค้า', color: 'orange' }
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.path}
                  onClick={() => router.push(item.path)}
                  className="p-2.5 bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-lg hover:shadow-md transition-all active:scale-95"
                >
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="w-10 h-10 bg-gradient-to-br from-sky-400 to-sky-500 rounded-lg flex items-center justify-center shadow-sm">
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xs font-medium text-gray-900 font-thai">{item.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
