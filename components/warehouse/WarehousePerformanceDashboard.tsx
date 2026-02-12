'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Package,
  Truck,
  CheckCircle,
  Clock,
  AlertTriangle,
  Calendar,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Download,
  FileText,
  Boxes,
  Scale,
  Warehouse,
  ArrowUpRight,
  ArrowDownRight,
  Minus
} from 'lucide-react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

// Types for Performance Data
interface DailyStats {
  date: string;
  inbound_count: number;
  inbound_qty: number;
  outbound_count: number;
  outbound_qty: number;
  completed_rate: number;
}

interface StatusBreakdown {
  status: string;
  count: number;
  percentage: number;
}

interface InboundMetrics {
  today_count: number;
  today_pallets: number;
  week_count: number;
  month_count: number;
  pending_count: number;
  completed_count: number;
  avg_processing_hours: number;
  status_breakdown: StatusBreakdown[];
}

interface OutboundMetrics {
  today_count: number;
  today_orders: number;
  week_count: number;
  month_count: number;
  pending_count: number;
  in_transit_count: number;
  delivered_count: number;
  otif_rate: number;
  avg_lead_time_hours: number;
  status_breakdown: StatusBreakdown[];
}

interface KPICard {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ElementType;
  color: 'blue' | 'green' | 'orange' | 'red' | 'purple';
  subtitle?: string;
}

interface PerformanceData {
  summary: {
    total_inbound: number;
    total_outbound: number;
    backlog: number;
    completion_rate: number;
    otif_rate: number;
  };
  inbound: InboundMetrics;
  outbound: OutboundMetrics;
  daily_stats: DailyStats[];
  last_updated: string;
}

// Color configurations
const colorConfig = {
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: 'text-blue-600', badge: 'bg-blue-100 text-blue-800' },
  green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', icon: 'text-green-600', badge: 'bg-green-100 text-green-800' },
  orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', icon: 'text-orange-600', badge: 'bg-orange-100 text-orange-800' },
  red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: 'text-red-600', badge: 'bg-red-100 text-red-800' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', icon: 'text-purple-600', badge: 'bg-purple-100 text-purple-800' },
};

// Status colors for tables
const statusColors: Record<string, string> = {
  // Inbound statuses
  'รอรับเข้า': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'รับเข้าแล้ว': 'bg-green-100 text-green-800 border-green-200',
  'กำลังตรวจสอบ': 'bg-blue-100 text-blue-800 border-blue-200',
  'สำเร็จ': 'bg-green-100 text-green-800 border-green-200',
  // Outbound statuses
  'draft': 'bg-gray-100 text-gray-800 border-gray-200',
  'confirmed': 'bg-blue-100 text-blue-800 border-blue-200',
  'in_picking': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'picked': 'bg-purple-100 text-purple-800 border-purple-200',
  'loaded': 'bg-orange-100 text-orange-800 border-orange-200',
  'in_transit': 'bg-blue-100 text-blue-800 border-blue-200',
  'delivered': 'bg-green-100 text-green-800 border-green-200',
  'cancelled': 'bg-red-100 text-red-800 border-red-200',
};

// Status labels in Thai
const statusLabels: Record<string, string> = {
  'draft': 'ร่าง',
  'confirmed': 'ยืนยัน',
  'in_picking': 'กำลังหยิบ',
  'picked': 'หยิบแล้ว',
  'loaded': 'ขึ้นรถแล้ว',
  'in_transit': 'ระหว่างส่ง',
  'delivered': 'ส่งสำเร็จ',
  'cancelled': 'ยกเลิก',
};

export default function WarehousePerformanceDashboard() {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d'>('7d');
  const [activeTab, setActiveTab] = useState<'summary' | 'inbound' | 'outbound'>('summary');

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/dashboard/performance?period=${selectedPeriod}`);
      const result = await response.json();
      if (result.error) {
        setError(result.error);
      } else {
        setData(result.data);
      }
    } catch (err) {
      setError('Failed to fetch performance data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedPeriod]);

  // KPI Cards configuration
  const kpiCards: KPICard[] = useMemo(() => {
    if (!data) return [];

    return [
      {
        title: 'รับเข้าวันนี้',
        value: data.inbound.today_count,
        change: ((data.inbound.today_count - (data.inbound.week_count / 7)) / (data.inbound.week_count / 7) * 100),
        changeLabel: 'เทียบเฉลี่ย 7 วัน',
        icon: Package,
        color: 'blue',
        subtitle: `${data.inbound.today_pallets} พาเลท`,
      },
      {
        title: 'ส่งออกวันนี้',
        value: data.outbound.today_count,
        change: ((data.outbound.today_count - (data.outbound.week_count / 7)) / (data.outbound.week_count / 7) * 100),
        changeLabel: 'เทียบเฉลี่ย 7 วัน',
        icon: Truck,
        color: 'green',
        subtitle: `${data.outbound.today_orders} ออเดอร์`,
      },
      {
        title: 'OTIF %',
        value: `${data.summary.otif_rate.toFixed(1)}%`,
        change: data.summary.otif_rate - 85,
        changeLabel: 'เทียบเป้า 85%',
        icon: CheckCircle,
        color: 'purple',
        subtitle: 'On Time In Full',
      },
      {
        title: 'งานค้าง (Backlog)',
        value: data.summary.backlog,
        change: -5,
        changeLabel: 'จากเมื่อวาน',
        icon: Clock,
        color: 'orange',
        subtitle: `${data.inbound.pending_count} รอรับ / ${data.outbound.pending_count} รอส่ง`,
      },
      {
        title: 'อัตราปิดงาน',
        value: `${data.summary.completion_rate.toFixed(1)}%`,
        icon: TrendingUp,
        color: 'green',
        subtitle: 'เฉลี่ย 7 วัน',
      },
      {
        title: 'Lead Time เฉลี่ย',
        value: `${data.outbound.avg_lead_time_hours.toFixed(1)} ชม.`,
        icon: Clock,
        color: 'blue',
        subtitle: 'สั่งจนถึงส่ง',
      },
    ];
  }, [data]);

  // Change indicator component
  const ChangeIndicator = ({ value, label }: { value?: number; label?: string }) => {
    if (value === undefined) return null;
    const isPositive = value >= 0;
    const Icon = isPositive ? ArrowUpRight : ArrowDownRight;
    const colorClass = isPositive ? 'text-green-600' : 'text-red-600';

    return (
      <div className={`flex items-center gap-1 text-xs ${colorClass}`}>
        <Icon className="h-3 w-3" />
        <span>{Math.abs(value).toFixed(1)}%</span>
        {label && <span className="text-gray-500 ml-1">{label}</span>}
      </div>
    );
  };

  // KPI Card component
  const KPICardComponent = ({ card }: { card: KPICard }) => {
    const colors = colorConfig[card.color];
    const Icon = card.icon;

    return (
      <div className={`${colors.bg} border ${colors.border} rounded-lg p-4`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-600 font-medium">{card.title}</p>
            <p className={`text-2xl font-bold ${colors.text} mt-1`}>{card.value}</p>
            {card.subtitle && <p className="text-xs text-gray-500 mt-1">{card.subtitle}</p>}
          </div>
          <div className={`p-2 rounded-lg ${colors.bg}`}>
            <Icon className={`h-5 w-5 ${colors.icon}`} />
          </div>
        </div>
        {card.change !== undefined && (
          <div className="mt-2">
            <ChangeIndicator value={card.change} label={card.changeLabel} />
          </div>
        )}
      </div>
    );
  };

  // Simple bar chart component
  const BarChart = ({ data, labels, colors }: { data: number[]; labels: string[]; colors: string[] }) => {
    const max = Math.max(...data, 1);

    return (
      <div className="flex items-end gap-2 h-32">
        {data.map((value, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full rounded-t-md transition-all duration-500"
              style={{
                height: `${(value / max) * 100}%`,
                backgroundColor: colors[i % colors.length],
                minHeight: value > 0 ? '4px' : '0',
              }}
            />
            <span className="text-xs text-gray-500">{labels[i]}</span>
          </div>
        ))}
      </div>
    );
  };

  // Pie chart component
  const PieChart = ({ data, labels, colors }: { data: number[]; labels: string[]; colors: string[] }) => {
    const total = data.reduce((a, b) => a + b, 0) || 1;
    let currentAngle = 0;

    return (
      <div className="flex items-center gap-6">
        <svg viewBox="0 0 100 100" className="w-24 h-24">
          {data.map((value, i) => {
            const angle = (value / total) * 360;
            const startAngle = currentAngle;
            currentAngle += angle;
            const endAngle = currentAngle;

            const startRad = (startAngle - 90) * (Math.PI / 180);
            const endRad = (endAngle - 90) * (Math.PI / 180);

            const x1 = 50 + 40 * Math.cos(startRad);
            const y1 = 50 + 40 * Math.sin(startRad);
            const x2 = 50 + 40 * Math.cos(endRad);
            const y2 = 50 + 40 * Math.sin(endRad);

            const largeArc = angle > 180 ? 1 : 0;

            return (
              <path
                key={i}
                d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`}
                fill={colors[i % colors.length]}
                stroke="white"
                strokeWidth="2"
              />
            );
          })}
          <circle cx="50" cy="50" r="20" fill="white" />
        </svg>
        <div className="space-y-1">
          {labels.map((label, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <div
                className="w-3 h-3 rounded"
                style={{ backgroundColor: colors[i % colors.length] }}
              />
              <span className="text-gray-600">{label}</span>
              <span className="font-medium">({data[i]})</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Status Badge
  const StatusBadge = ({ status }: { status: string }) => {
    const colorClass = statusColors[status] || 'bg-gray-100 text-gray-800';
    const label = statusLabels[status] || status;
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium border ${colorClass}`}>
        {label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-red-700 mb-2">เกิดข้อผิดพลาด</h3>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            ลองใหม่
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center text-gray-500">
          <FileText className="h-16 w-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-xl font-semibold mb-2">ไม่มีข้อมูล</h3>
          <p>ไม่พบข้อมูลสำหรับช่วงเวลานี้</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Warehouse Performance Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            รายงานสรุปผลการดำเนินงานคลังสินค้า • อัพเดทล่าสุด: {new Date(data.last_updated).toLocaleString('th-TH')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value as '7d' | '30d')}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="7d">7 วันล่าสุด</option>
            <option value="30d">30 วันล่าสุด</option>
          </select>
          <button
            onClick={fetchData}
            className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpiCards.map((card, i) => (
          <KPICardComponent key={i} card={card} />
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-gray-200">
        {[
          { id: 'summary', label: 'สรุปผล', icon: TrendingUp },
          { id: 'inbound', label: 'สินค้าเข้า (Inbound)', icon: Package },
          { id: 'outbound', label: 'สินค้าออก (Outbound)', icon: Truck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-all ${
                isActive
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Summary Tab */}
      {activeTab === 'summary' && (
        <div className="space-y-6">
          {/* Charts Section */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Inbound vs Outbound Trend */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">แนวโน้มเข้า vs ออก ({selectedPeriod})</h3>
              <BarChart
                data={data.daily_stats.map(d => d.inbound_count + d.outbound_count)}
                labels={data.daily_stats.map(d => {
                  const date = new Date(d.date);
                  return `${date.getDate()}/${date.getMonth() + 1}`;
                })}
                colors={['#3B82F6', '#10B981']}
              />
              <div className="flex items-center justify-center gap-6 mt-4 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded" />
                  <span className="text-gray-600">รับเข้า {data.inbound.week_count} รายการ</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded" />
                  <span className="text-gray-600">ส่งออก {data.outbound.week_count} รายการ</span>
                </div>
              </div>
            </div>

            {/* Status Distribution */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">สถานะงานรวม</h3>
              <PieChart
                data={[
                  data.inbound.completed_count,
                  data.inbound.pending_count,
                  data.outbound.delivered_count,
                  data.outbound.pending_count,
                ]}
                labels={['รับเข้าแล้ว', 'รอรับเข้า', 'ส่งสำเร็จ', 'รอส่ง']}
                colors={['#10B981', '#F59E0B', '#059669', '#EF4444']}
              />
            </div>
          </div>

          {/* Executive Summary */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Executive Summary
            </h3>
            <div className="text-sm text-blue-800 space-y-1">
              <p>
                • วันนี้รับสินค้าเข้า <strong>{data.inbound.today_count}</strong> รายการ ({data.inbound.today_pallets} พาเลท) 
                และส่งออก <strong>{data.outbound.today_count}</strong> รายการ
              </p>
              <p>
                • OTIF (On Time In Full) อยู่ที่ <strong>{data.summary.otif_rate.toFixed(1)}%</strong>
                {data.summary.otif_rate >= 85 ? ' (เกินเป้า 85%)' : ' (ต่ำกว่าเป้า 85%)'}
              </p>
              <p>
                • มีงานค้าง <strong>{data.summary.backlog}</strong> รายการ 
                ({data.inbound.pending_count} รอรับเข้า / {data.outbound.pending_count} รอส่ง)
              </p>
              <p>
                • อัตราการปิดงานเฉลี่ย <strong>{data.summary.completion_rate.toFixed(1)}%</strong>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Inbound Tab */}
      {activeTab === 'inbound' && (
        <div className="space-y-6">
          {/* Inbound KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICardComponent
              card={{
                title: 'รับเข้าวันนี้',
                value: data.inbound.today_count,
                icon: Package,
                color: 'blue',
                subtitle: `${data.inbound.today_pallets} พาเลท`,
              }}
            />
            <KPICardComponent
              card={{
                title: 'รับเข้า 7 วัน',
                value: data.inbound.week_count,
                icon: Calendar,
                color: 'blue',
              }}
            />
            <KPICardComponent
              card={{
                title: 'รอรับเข้า',
                value: data.inbound.pending_count,
                icon: Clock,
                color: 'orange',
              }}
            />
            <KPICardComponent
              card={{
                title: 'เฉลี่ยต่อวัน',
                value: (data.inbound.week_count / 7).toFixed(1),
                icon: TrendingUp,
                color: 'green',
              }}
            />
          </div>

          {/* Status Breakdown */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">สถานะการรับเข้า</h3>
            <div className="space-y-3">
              {data.inbound.status_breakdown.map((item, i) => (
                <div key={i} className="flex items-center gap-4">
                  <StatusBadge status={item.status} />
                  <div className="flex-1">
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-500"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-medium w-16 text-right">{item.count}</span>
                  <span className="text-xs text-gray-500 w-12 text-right">{item.percentage.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Outbound Tab */}
      {activeTab === 'outbound' && (
        <div className="space-y-6">
          {/* Outbound KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICardComponent
              card={{
                title: 'ส่งออกวันนี้',
                value: data.outbound.today_count,
                icon: Truck,
                color: 'green',
                subtitle: `${data.outbound.today_orders} ออเดอร์`,
              }}
            />
            <KPICardComponent
              card={{
                title: 'OTIF %',
                value: `${data.outbound.otif_rate.toFixed(1)}%`,
                icon: CheckCircle,
                color: 'purple',
              }}
            />
            <KPICardComponent
              card={{
                title: 'รอส่ง',
                value: data.outbound.pending_count,
                icon: Clock,
                color: 'orange',
              }}
            />
            <KPICardComponent
              card={{
                title: 'ระหว่างส่ง',
                value: data.outbound.in_transit_count,
                icon: ArrowRight,
                color: 'blue',
              }}
            />
          </div>

          {/* Status Breakdown */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">สถานะการส่งออก</h3>
            <div className="space-y-3">
              {data.outbound.status_breakdown.map((item, i) => (
                <div key={i} className="flex items-center gap-4">
                  <StatusBadge status={item.status} />
                  <div className="flex-1">
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all duration-500"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-medium w-16 text-right">{item.count}</span>
                  <span className="text-xs text-gray-500 w-12 text-right">{item.percentage.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
