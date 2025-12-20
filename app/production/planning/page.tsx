'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  RefreshCw,
  Download,
  Loader2,
  FileText,
  AlertTriangle,
  Plus,
  Calendar,
  Package,
  LayoutGrid,
  List,
  Clock,
  CheckCircle2,
  AlertCircle,
  PlayCircle,
  Box,
  MapPin,
  ChevronLeft,
  ChevronRight,
  TrendingUp
} from 'lucide-react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';

// TODO: Replace with actual data interface from database
interface RepackPlan {
  plan_id: number;
  plan_code: string;
  plan_date: string;
  product_name: string;
  bulk_source: string;
  sku_id: string;
  pack_size: string;
  planned_quantity: number;
  pallet_estimation: number;
  production_line: string;
  shift: string;
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  progress: number;
  created_at: string;
}

const ProductionPlanningPage = () => {
  const router = useRouter();
  const [planningData, setPlanningData] = useState<RepackPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // View mode state
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'calendar'>('grid');

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedLine, setSelectedLine] = useState('all');

  useEffect(() => {
    fetchPlanningData();
  }, [selectedDate, selectedStatus, selectedLine]);

  const fetchPlanningData = async () => {
    try {
      setLoading(true);
      // TODO: Replace with actual API call
      // const response = await fetch('/api/production/planning');
      // const data = await response.json();

      // Mock data for UI demonstration
      const mockData: RepackPlan[] = [
        {
          plan_id: 1,
          plan_code: 'RP-2025-001',
          plan_date: '2025-12-20',
          product_name: 'ผงซักฟอก แบบถุง 3kg',
          bulk_source: 'Bulk Tank A-01',
          sku_id: 'DET-001',
          pack_size: '3 kg',
          planned_quantity: 5000,
          pallet_estimation: 8,
          production_line: 'Line 1',
          shift: 'กะเช้า',
          status: 'in_progress',
          progress: 65,
          created_at: '2025-12-19T08:00:00'
        },
        {
          plan_id: 2,
          plan_code: 'RP-2025-002',
          plan_date: '2025-12-20',
          product_name: 'น้ำยาปรับผ้านุ่ม 2L',
          bulk_source: 'Bulk Tank B-03',
          sku_id: 'SFT-002',
          pack_size: '2 L',
          planned_quantity: 3000,
          pallet_estimation: 5,
          production_line: 'Line 2',
          shift: 'กะบ่าย',
          status: 'planned',
          progress: 0,
          created_at: '2025-12-19T10:30:00'
        },
        {
          plan_id: 3,
          plan_code: 'RP-2025-003',
          plan_date: '2025-12-19',
          product_name: 'น้ำยาล้างจาน 500ml',
          bulk_source: 'Bulk Tank C-05',
          sku_id: 'DSH-003',
          pack_size: '500 ml',
          planned_quantity: 8000,
          pallet_estimation: 12,
          production_line: 'Line 3',
          shift: 'กะเช้า',
          status: 'completed',
          progress: 100,
          created_at: '2025-12-18T07:00:00'
        }
      ];

      setPlanningData(mockData);
    } catch (err: any) {
      setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'planned':
        return {
          badge: <Badge variant="default" size="sm"><span className="text-[10px]">วางแผนแล้ว</span></Badge>,
          icon: <Clock className="w-4 h-4 text-blue-500" />,
          color: 'bg-blue-50 border-blue-200',
          textColor: 'text-blue-700'
        };
      case 'in_progress':
        return {
          badge: <Badge variant="warning" size="sm"><span className="text-[10px]">กำลังผลิต</span></Badge>,
          icon: <PlayCircle className="w-4 h-4 text-orange-500" />,
          color: 'bg-orange-50 border-orange-200',
          textColor: 'text-orange-700'
        };
      case 'completed':
        return {
          badge: <Badge variant="success" size="sm"><span className="text-[10px]">เสร็จสิ้น</span></Badge>,
          icon: <CheckCircle2 className="w-4 h-4 text-green-500" />,
          color: 'bg-green-50 border-green-200',
          textColor: 'text-green-700'
        };
      case 'cancelled':
        return {
          badge: <Badge variant="danger" size="sm"><span className="text-[10px]">ยกเลิก</span></Badge>,
          icon: <AlertCircle className="w-4 h-4 text-red-500" />,
          color: 'bg-red-50 border-red-200',
          textColor: 'text-red-700'
        };
      default:
        return {
          badge: <Badge variant="default" size="sm"><span className="text-[10px]">{status}</span></Badge>,
          icon: <Clock className="w-4 h-4 text-gray-500" />,
          color: 'bg-gray-50 border-gray-200',
          textColor: 'text-gray-700'
        };
    }
  };

  const filteredData = planningData.filter(plan => {
    const matchSearch = !searchTerm ||
      plan.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plan.plan_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plan.sku_id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchStatus = selectedStatus === 'all' || plan.status === selectedStatus;
    const matchLine = selectedLine === 'all' || plan.production_line === selectedLine;
    const matchDate = !selectedDate || plan.plan_date === selectedDate;

    return matchSearch && matchStatus && matchLine && matchDate;
  });

  // Calendar helper functions
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const getPlansByDate = (date: string) => {
    return filteredData.filter(plan => plan.plan_date === date);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  return (
    <div className="h-[calc(100vh-3.25rem)] bg-gradient-to-br from-blue-50 via-white to-indigo-50 overflow-hidden">
      <div className="h-full flex flex-col space-y-3 pt-2 px-3 pb-2">

        {/* Header Section - Smart Factory Style */}
        <div className="bg-white/90 backdrop-blur-sm border-2 border-primary-100 rounded-xl px-4 py-3 shadow-lg flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-md">
                <Box className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 font-thai">แผนการผลิต – รีแพ็คสินค้า</h1>
                <p className="text-xs text-gray-500 font-thai mt-0.5">Production Planning – Repack Operations</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" icon={Download} className="text-xs">
                Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon={TrendingUp}
                className="text-xs"
                onClick={() => router.push('/production/forecast')}
              >
                ยอดประมาณการณ์
              </Button>
              <Button variant="primary" size="sm" icon={Plus} className="text-xs font-semibold">
                สร้างแผนใหม่
              </Button>
            </div>
          </div>
        </div>

        {/* Filters & Controls */}
        <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl px-3 py-2 shadow-sm flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ค้นหาด้วย ชื่อสินค้า, รหัสแผน, SKU..."
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-thai focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-thai focus:outline-none focus:ring-2 focus:ring-primary-500/50 w-36"
              />
            </div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-thai focus:outline-none focus:ring-2 focus:ring-primary-500/50"
            >
              <option value="all">ทุกสถานะ</option>
              <option value="planned">วางแผนแล้ว</option>
              <option value="in_progress">กำลังผลิต</option>
              <option value="completed">เสร็จสิ้น</option>
              <option value="cancelled">ยกเลิก</option>
            </select>
            <select
              value={selectedLine}
              onChange={(e) => setSelectedLine(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-thai focus:outline-none focus:ring-2 focus:ring-primary-500/50"
            >
              <option value="all">ทุกไลน์</option>
              <option value="Line 1">Line 1</option>
              <option value="Line 2">Line 2</option>
              <option value="Line 3">Line 3</option>
            </select>

            {/* View Toggle */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded transition-colors ${
                  viewMode === 'grid' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
                title="มุมมองกริด"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded transition-colors ${
                  viewMode === 'list' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
                title="มุมมองรายการ"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`p-1.5 rounded transition-colors ${
                  viewMode === 'calendar' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
                title="มุมมองปฏิทิน"
              >
                <Calendar className="w-4 h-4" />
              </button>
            </div>

            <Button variant="outline" size="sm" icon={RefreshCw} onClick={fetchPlanningData} disabled={loading} className="text-xs">
              รีเฟรช
            </Button>
          </div>
        </div>

        {/* Planning Board */}
        <div className="flex-1 min-h-0 overflow-auto">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
              <p className="text-sm font-thai">กำลังโหลดแผนการผลิต...</p>
            </div>
          ) : error ? (
            <div className="h-full flex flex-col items-center justify-center text-red-500 gap-2">
              <AlertTriangle className="w-12 h-12" />
              <p className="text-sm font-thai">{error}</p>
            </div>
          ) : filteredData.length === 0 && viewMode !== 'calendar' ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-4">
              <FileText className="w-16 h-16" />
              <div className="text-center">
                <p className="text-base font-semibold font-thai text-gray-600">ไม่พบแผนการผลิต</p>
                <p className="text-sm text-gray-400 mt-1 font-thai">ลองปรับเปลี่ยนตัวกรองหรือสร้างแผนใหม่</p>
              </div>
            </div>
          ) : viewMode === 'calendar' ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              {/* Calendar Header */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => navigateMonth('prev')}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="เดือนก่อนหน้า"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-600" />
                  </button>
                  <h2 className="text-lg font-bold text-gray-900 font-thai min-w-[180px] text-center">
                    {currentMonth.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}
                  </h2>
                  <button
                    onClick={() => navigateMonth('next')}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="เดือนถัดไป"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
                <button
                  onClick={goToToday}
                  className="px-3 py-1.5 text-xs font-thai bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                >
                  วันนี้
                </button>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-2">
                {/* Day Headers */}
                {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map((day) => (
                  <div key={day} className="text-center font-semibold text-sm text-gray-600 font-thai py-2">
                    {day}
                  </div>
                ))}

                {/* Calendar Days */}
                {(() => {
                  const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth);
                  const days = [];

                  // Empty cells for days before month starts
                  for (let i = 0; i < startingDayOfWeek; i++) {
                    days.push(
                      <div key={`empty-${i}`} className="min-h-[100px] bg-gray-50 rounded-lg" />
                    );
                  }

                  // Actual days of the month
                  for (let day = 1; day <= daysInMonth; day++) {
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const dayPlans = getPlansByDate(dateStr);
                    const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();

                    days.push(
                      <div
                        key={day}
                        className={`min-h-[100px] bg-white border-2 rounded-lg p-2 transition-all hover:shadow-md ${
                          isToday ? 'border-primary-500 bg-primary-50' : 'border-gray-200'
                        }`}
                      >
                        <div className={`text-sm font-semibold mb-2 ${isToday ? 'text-primary-600' : 'text-gray-700'}`}>
                          {day}
                        </div>
                        <div className="space-y-1">
                          {dayPlans.slice(0, 3).map((plan) => {
                            const statusConfig = getStatusConfig(plan.status);
                            return (
                              <div
                                key={plan.plan_id}
                                className={`text-[10px] font-thai px-1.5 py-1 rounded border ${statusConfig.color} cursor-pointer hover:shadow-sm transition-shadow`}
                                title={`${plan.plan_code} - ${plan.product_name}`}
                              >
                                <div className="flex items-center gap-1 mb-0.5">
                                  {statusConfig.icon}
                                  <span className="font-mono font-semibold truncate">{plan.plan_code}</span>
                                </div>
                                <div className="truncate text-gray-600">{plan.product_name}</div>
                                <div className="text-gray-500">{plan.production_line}</div>
                              </div>
                            );
                          })}
                          {dayPlans.length > 3 && (
                            <div className="text-[10px] text-center text-gray-500 font-thai py-1">
                              +{dayPlans.length - 3} เพิ่มเติม
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  return days;
                })()}
              </div>

              {/* Calendar Legend */}
              <div className="mt-4 pt-3 border-t border-gray-200">
                <p className="text-xs text-gray-600 font-thai mb-2">สถานะ:</p>
                <div className="flex flex-wrap gap-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-blue-100 border border-blue-200 rounded"></div>
                    <span className="text-xs text-gray-600 font-thai">วางแผนแล้ว</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-orange-100 border border-orange-200 rounded"></div>
                    <span className="text-xs text-gray-600 font-thai">กำลังผลิต</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-green-100 border border-green-200 rounded"></div>
                    <span className="text-xs text-gray-600 font-thai">เสร็จสิ้น</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-red-100 border border-red-200 rounded"></div>
                    <span className="text-xs text-gray-600 font-thai">ยกเลิก</span>
                  </div>
                </div>
              </div>
            </div>
          ) : viewMode === 'grid' ? (
            /* Kanban Board - Status-based columns */
            <div className="h-full">
              <div className="grid grid-cols-4 gap-4 h-full pb-4">
                {/* Kanban Columns */}
                {[
                  { 
                    status: 'planned', 
                    title: 'วางแผนแล้ว', 
                    subtitle: 'Planned',
                    icon: Clock,
                    gradient: 'from-blue-500 to-blue-600',
                    bgColor: 'bg-blue-50',
                    borderColor: 'border-blue-200',
                    countBg: 'bg-blue-100 text-blue-700'
                  },
                  { 
                    status: 'in_progress', 
                    title: 'กำลังผลิต', 
                    subtitle: 'In Progress',
                    icon: PlayCircle,
                    gradient: 'from-orange-500 to-amber-500',
                    bgColor: 'bg-orange-50',
                    borderColor: 'border-orange-200',
                    countBg: 'bg-orange-100 text-orange-700'
                  },
                  { 
                    status: 'completed', 
                    title: 'เสร็จสิ้น', 
                    subtitle: 'Completed',
                    icon: CheckCircle2,
                    gradient: 'from-emerald-500 to-green-500',
                    bgColor: 'bg-emerald-50',
                    borderColor: 'border-emerald-200',
                    countBg: 'bg-emerald-100 text-emerald-700'
                  },
                  { 
                    status: 'cancelled', 
                    title: 'ยกเลิก', 
                    subtitle: 'Cancelled',
                    icon: AlertCircle,
                    gradient: 'from-gray-400 to-gray-500',
                    bgColor: 'bg-gray-50',
                    borderColor: 'border-gray-200',
                    countBg: 'bg-gray-100 text-gray-600'
                  }
                ].map((column) => {
                  const columnPlans = filteredData.filter(p => p.status === column.status);
                  const IconComponent = column.icon;
                  
                  return (
                    <div key={column.status} className="flex flex-col min-h-0">
                      {/* Column Header */}
                      <div className={`bg-gradient-to-r ${column.gradient} rounded-t-xl px-4 py-3 shadow-sm`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                              <IconComponent className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <h3 className="text-sm font-bold text-white font-thai">{column.title}</h3>
                              <p className="text-[10px] text-white/70">{column.subtitle}</p>
                            </div>
                          </div>
                          <div className={`px-2.5 py-1 rounded-full text-xs font-bold ${column.countBg}`}>
                            {columnPlans.length}
                          </div>
                        </div>
                      </div>
                      
                      {/* Column Content */}
                      <div className={`flex-1 ${column.bgColor} border-2 ${column.borderColor} border-t-0 rounded-b-xl p-3 overflow-y-auto thin-scrollbar`}>
                        {columnPlans.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center text-gray-400 py-8">
                            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                              <FileText className="w-6 h-6 text-gray-300" />
                            </div>
                            <p className="text-xs font-thai text-center">ไม่มีแผนในสถานะนี้</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {columnPlans.map((plan) => (
                              <div
                                key={plan.plan_id}
                                className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                              >
                                {/* Card Header */}
                                <div className="px-3 py-2.5 border-b border-gray-100">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                      {plan.plan_code}
                                    </span>
                                    <span className="text-[10px] text-gray-500 font-thai">
                                      {new Date(plan.plan_date).toLocaleDateString('th-TH', {
                                        day: '2-digit',
                                        month: 'short'
                                      })}
                                    </span>
                                  </div>
                                  <h4 className="text-sm font-semibold text-gray-900 font-thai line-clamp-2 group-hover:text-blue-600 transition-colors">
                                    {plan.product_name}
                                  </h4>
                                </div>
                                
                                {/* Card Body */}
                                <div className="px-3 py-2.5 space-y-2">
                                  {/* SKU & Pack Size */}
                                  <div className="flex items-center gap-2 text-xs text-gray-600">
                                    <Package className="w-3.5 h-3.5 text-purple-500" />
                                    <span className="font-mono">{plan.sku_id}</span>
                                    <span className="text-gray-300">|</span>
                                    <span className="font-thai">{plan.pack_size}</span>
                                  </div>
                                  
                                  {/* Source */}
                                  <div className="flex items-center gap-2 text-xs text-gray-600">
                                    <MapPin className="w-3.5 h-3.5 text-blue-500" />
                                    <span className="font-thai">{plan.bulk_source}</span>
                                  </div>
                                  
                                  {/* Quantity & Pallet */}
                                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-500 font-thai">จำนวน:</span>
                                      <span className="text-sm font-bold text-gray-900">{plan.planned_quantity.toLocaleString()}</span>
                                    </div>
                                    <div className="flex items-center gap-1 bg-purple-50 px-2 py-0.5 rounded">
                                      <Box className="w-3 h-3 text-purple-500" />
                                      <span className="text-xs font-semibold text-purple-700">{plan.pallet_estimation} พาเลท</span>
                                    </div>
                                  </div>
                                  
                                  {/* Progress Bar - Only for in_progress */}
                                  {plan.status === 'in_progress' && (
                                    <div className="pt-2">
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] text-gray-500 font-thai">ความคืบหน้า</span>
                                        <span className="text-xs font-bold text-orange-600">{plan.progress}%</span>
                                      </div>
                                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                        <div
                                          className="bg-gradient-to-r from-orange-400 to-amber-500 h-full rounded-full transition-all duration-500 relative"
                                          style={{ width: `${plan.progress}%` }}
                                        >
                                          <div className="absolute inset-0 bg-white/30 animate-pulse" />
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                                
                                {/* Card Footer */}
                                <div className="px-3 py-2 bg-gray-50 rounded-b-xl border-t border-gray-100">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                      <div className="w-5 h-5 rounded-full bg-primary-100 flex items-center justify-center">
                                        <Box className="w-3 h-3 text-primary-600" />
                                      </div>
                                      <span className="text-xs font-medium text-gray-700">{plan.production_line}</span>
                                    </div>
                                    <span className="text-[10px] px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full font-thai">
                                      {plan.shift}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* List View - Table Format */
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="overflow-x-auto thin-scrollbar">
                <table className="w-full table-fixed text-sm">
                  <thead className="sticky top-0 bg-gradient-to-r from-gray-50 to-gray-100 z-10 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide border-r border-gray-200 w-[12%]">
                        รหัสแผน
                      </th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide border-r border-gray-200 w-[8%]">
                        วันที่
                      </th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide border-r border-gray-200 w-[20%]">
                        สินค้า
                      </th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide border-r border-gray-200 w-[15%]">
                        แหล่งวัตถุดิบ
                      </th>
                      <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-700 uppercase tracking-wide border-r border-gray-200 w-[10%]">
                        จำนวน
                      </th>
                      <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-700 uppercase tracking-wide border-r border-gray-200 w-[8%]">
                        พาเลท
                      </th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide border-r border-gray-200 w-[10%]">
                        ไลน์ผลิต
                      </th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide border-r border-gray-200 w-[7%]">
                        กะ
                      </th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide w-[10%]">
                        สถานะ
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((plan) => {
                      const statusConfig = getStatusConfig(plan.status);
                      return (
                        <tr key={plan.plan_id} className="border-b border-gray-100 hover:bg-blue-50/30 transition-colors cursor-pointer">
                          <td className="px-3 py-2 text-xs font-mono font-semibold text-blue-700">
                            {plan.plan_code}
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-700 font-thai">
                            {new Date(plan.plan_date).toLocaleDateString('th-TH', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            })}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs font-semibold text-gray-900 font-thai">{plan.product_name}</span>
                              <div className="flex items-center gap-2 text-[10px] text-gray-500">
                                <span className="font-mono">{plan.sku_id}</span>
                                <span>•</span>
                                <span className="font-thai">{plan.pack_size}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-700 font-thai">
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-3 h-3 text-blue-500 flex-shrink-0" />
                              <span>{plan.bulk_source}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <div className="flex flex-col items-center">
                              <span className="text-sm font-bold text-blue-600">
                                {plan.planned_quantity.toLocaleString()}
                              </span>
                              <span className="text-[10px] text-gray-500 font-thai">ชิ้น</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className="text-sm font-bold text-purple-600">
                              {plan.pallet_estimation}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-700 font-thai font-medium">
                            {plan.production_line}
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-600 font-thai">
                            {plan.shift}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-col gap-1">
                              {statusConfig.badge}
                              {plan.status === 'in_progress' && (
                                <div className="flex items-center gap-1.5">
                                  <div className="flex-1 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                    <div
                                      className="bg-gradient-to-r from-orange-400 to-orange-500 h-full rounded-full transition-all duration-500"
                                      style={{ width: `${plan.progress}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] font-bold text-orange-600 min-w-[32px]">{plan.progress}%</span>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default function ProductionPlanningPageWithPermission() {
  return (
    <PermissionGuard
      permission="production.planning.view"
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
            <p className="text-gray-600">คุณไม่มีสิทธิ์ในการดูข้อมูลวางแผนผลิต</p>
          </div>
        </div>
      }
    >
      <ProductionPlanningPage />
    </PermissionGuard>
  );
}
