'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Search,
  RefreshCw,
  Download,
  Loader2,
  FileText,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  X,
  Package,
  Clock,
  CheckCircle2,
  PlayCircle,
  PauseCircle,
  AlertCircle,
  Trash2,
  Eye,
  ChevronDown,
  ChevronUp,
  MapPin,
  Calendar,
  Check,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import {
  useProductionOrders,
  usePlanDataForOrder,
  useProductionOrderMutations,
} from '@/hooks/useProductionOrders';
import {
  ProductionOrderWithDetails,
  ProductionOrderStatus,
  CreateProductionOrderInput,
  PlanDataForOrder,
} from '@/types/production-order-schema';

// Types for food stock
interface FoodStockPallet {
  balance_id: number;
  pallet_id: string;
  location_id: string;
  location_name: string;
  warehouse_id: string;
  total_piece_qty: number;
  reserved_piece_qty: number;
  available_qty: number;
  production_date: string | null;
  expiry_date: string | null;
}

interface FoodStockByDate {
  sku_id: string;
  sku_name: string;
  production_date: string | null;
  expiry_date: string | null;
  total_qty: number;
  pallets: FoodStockPallet[];
}

// Loading fallback component
function LoadingFallback() {
  return (
    <div className="h-[calc(100vh-3.25rem)] bg-gradient-to-br from-thai-gray-25 to-white flex items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-sm font-thai text-thai-gray-500">กำลังโหลด...</p>
      </div>
    </div>
  );
}

// Main page wrapper with Suspense
export default function ProductionOrdersPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ProductionOrdersContent />
    </Suspense>
  );
}

function ProductionOrdersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planIdFromUrl = searchParams.get('plan_id');

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<ProductionOrderStatus | 'all'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<ProductionOrderWithDetails | null>(null);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);

  const { orders, totalCount, summary, isLoading, error, mutate } = useProductionOrders({
    search: searchTerm,
    status: selectedStatus,
    start_date: dateFrom || undefined,
    end_date: dateTo || undefined,
    page: currentPage,
    pageSize,
  });

  const { deleteOrder } = useProductionOrderMutations();

  useEffect(() => {
    if (planIdFromUrl) {
      setShowCreateModal(true);
    }
  }, [planIdFromUrl]);

  const getStatusConfig = (status: ProductionOrderStatus) => {
    switch (status) {
      case 'planned':
        return { badge: <Badge variant="default" size="sm"><span className="text-[10px]">วางแผน</span></Badge>, icon: <Clock className="w-4 h-4 text-gray-500" /> };
      case 'released':
        return { badge: <Badge variant="info" size="sm"><span className="text-[10px]">ปล่อยงาน</span></Badge>, icon: <CheckCircle2 className="w-4 h-4 text-blue-500" /> };
      case 'in_progress':
        return { badge: <Badge variant="warning" size="sm"><span className="text-[10px]">กำลังผลิต</span></Badge>, icon: <PlayCircle className="w-4 h-4 text-orange-500" /> };
      case 'completed':
        return { badge: <Badge variant="success" size="sm"><span className="text-[10px]">เสร็จสิ้น</span></Badge>, icon: <CheckCircle2 className="w-4 h-4 text-green-500" /> };
      case 'on_hold':
        return { badge: <Badge variant="warning" size="sm"><span className="text-[10px]">พักงาน</span></Badge>, icon: <PauseCircle className="w-4 h-4 text-yellow-500" /> };
      case 'cancelled':
        return { badge: <Badge variant="danger" size="sm"><span className="text-[10px]">ยกเลิก</span></Badge>, icon: <AlertCircle className="w-4 h-4 text-red-500" /> };
      default:
        return { badge: <Badge variant="default" size="sm"><span className="text-[10px]">{status}</span></Badge>, icon: <Clock className="w-4 h-4 text-gray-500" /> };
    }
  };

  const handleDeleteOrder = async (orderId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm('คุณต้องการลบใบสั่งผลิตนี้หรือไม่?')) return;
    setDeletingOrderId(orderId);
    const success = await deleteOrder(orderId);
    setDeletingOrderId(null);
    if (success) {
      mutate();
      if (selectedOrder?.id === orderId) setSelectedOrder(null);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="h-[calc(100vh-3.25rem)] bg-gradient-to-br from-thai-gray-25 to-white overflow-hidden">
      <div className="h-full flex flex-col space-y-1 pt-0 px-2 pb-1">
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg px-2 py-1.5 shadow-sm flex-shrink-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-thai-gray-900 font-thai whitespace-nowrap">ใบสั่งผลิต</h1>
            <div className="flex-1 relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-thai-gray-400" />
              <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="ค้นหา..." className="w-full pl-7 pr-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500/50" />
            </div>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500/50 w-28" />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500/50 w-28" />
            <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value as ProductionOrderStatus | 'all')} className="px-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500/50">
              <option value="all">ทุกสถานะ</option>
              <option value="planned">วางแผน</option>
              <option value="released">ปล่อยงาน</option>
              <option value="in_progress">กำลังผลิต</option>
              <option value="completed">เสร็จสิ้น</option>
              <option value="on_hold">พักงาน</option>
              <option value="cancelled">ยกเลิก</option>
            </select>
            <Button variant="outline" size="sm" icon={Download} className="text-xs py-1 px-2">Excel</Button>
            <Button variant="primary" size="sm" icon={Plus} onClick={() => setShowCreateModal(true)} className="text-xs py-1 px-2">สร้าง</Button>
            <Button variant="outline" size="sm" icon={RefreshCw} onClick={() => mutate()} disabled={isLoading} className="text-xs py-1 px-2">รีเฟรช</Button>
          </div>
        </div>

        {summary && (
          <div className="grid grid-cols-7 gap-2 flex-shrink-0">
            <SummaryCard label="ทั้งหมด" count={summary.total} color="gray" />
            <SummaryCard label="วางแผน" count={summary.planned} color="gray" />
            <SummaryCard label="ปล่อยงาน" count={summary.released} color="blue" />
            <SummaryCard label="กำลังผลิต" count={summary.in_progress} color="orange" />
            <SummaryCard label="เสร็จสิ้น" count={summary.completed} color="green" />
            <SummaryCard label="พักงาน" count={summary.on_hold} color="yellow" />
            <SummaryCard label="ยกเลิก" count={summary.cancelled} color="red" />
          </div>
        )}

        <div className="flex-1 min-h-0 flex flex-col">
          <div className="w-full flex-1 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col overflow-hidden">
            {isLoading ? (
              <div className="h-full flex flex-col items-center justify-center text-thai-gray-500 gap-2">
                <Loader2 className="w-6 h-6 animate-spin" />
                <p className="text-sm font-thai">กำลังโหลดข้อมูลใบสั่งผลิต...</p>
              </div>
            ) : error ? (
              <div className="h-full flex flex-col items-center justify-center text-red-500 gap-2">
                <AlertTriangle className="w-8 h-8" />
                <p className="text-sm font-thai">{error}</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-thai-gray-500 gap-4">
                <FileText className="w-12 h-12" />
                <div className="text-center">
                  <p className="text-sm font-medium font-thai">ไม่พบข้อมูลใบสั่งผลิต</p>
                  <p className="text-xs text-thai-gray-400 mt-1 font-thai">ลองปรับเปลี่ยนตัวกรองหรือสร้างใบสั่งผลิตใหม่</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-auto thin-scrollbar">
                <table className="w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-gray-100">
                    <tr>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">เลขที่ใบสั่งผลิต</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">รหัสสินค้า</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">ชื่อสินค้า</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">จำนวนสั่ง</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">ผลิตได้</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">วันที่เริ่ม</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">กำหนดเสร็จ</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">สถานะ</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100 text-[11px]">
                    {orders.map((order) => {
                      const statusConfig = getStatusConfig(order.status);
                      const isDeleting = deletingOrderId === order.id;
                      return (
                        <tr key={order.id} className="hover:bg-blue-50/30 transition-colors duration-150 cursor-pointer" onClick={() => setSelectedOrder(order)}>
                          <td className="px-2 py-1.5 border-r border-gray-100 whitespace-nowrap"><span className="font-mono font-semibold text-blue-600">{order.production_no}</span></td>
                          <td className="px-2 py-1.5 border-r border-gray-100 whitespace-nowrap"><span className="font-mono text-thai-gray-700">{order.sku_id}</span></td>
                          <td className="px-2 py-1.5 border-r border-gray-100"><span className="text-thai-gray-700 font-thai">{order.sku?.sku_name || order.sku_id}</span></td>
                          <td className="px-2 py-1.5 text-center border-r border-gray-100"><span className="font-bold text-blue-600">{Number(order.quantity).toLocaleString()}</span></td>
                          <td className="px-2 py-1.5 text-center border-r border-gray-100"><span className="font-bold text-green-600">{Number(order.produced_qty || 0).toLocaleString()}</span></td>
                          <td className="px-2 py-1.5 border-r border-gray-100 whitespace-nowrap"><span className="text-thai-gray-600">{new Date(order.start_date).toLocaleDateString('th-TH')}</span></td>
                          <td className="px-2 py-1.5 border-r border-gray-100 whitespace-nowrap"><span className="text-thai-gray-600">{new Date(order.due_date).toLocaleDateString('th-TH')}</span></td>
                          <td className="px-2 py-1.5 border-r border-gray-100">{statusConfig.badge}</td>
                          <td className="px-2 py-1.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); }} className="p-1 rounded hover:bg-blue-100 text-blue-600 transition-colors" title="ดูรายละเอียด"><Eye className="w-4 h-4" /></button>
                              <button onClick={(e) => handleDeleteOrder(order.id, e)} disabled={isDeleting} className="p-1 rounded hover:bg-red-100 text-red-500 transition-colors disabled:opacity-50" title="ลบ">{isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {!isLoading && !error && totalCount > 0 && (
              <div className="flex-shrink-0 flex items-center justify-between px-3 py-1 border-t border-gray-200 bg-white text-xs">
                <span className="text-thai-gray-600 font-thai">แสดง {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, totalCount)} จาก {totalCount.toLocaleString()} รายการ</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="p-1 rounded hover:bg-gray-100 disabled:opacity-50" title="หน้าแรก"><ChevronsLeft className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1} className="p-1 rounded hover:bg-gray-100 disabled:opacity-50" title="หน้าก่อนหน้า"><ChevronLeft className="w-3.5 h-3.5" /></button>
                  <span className="px-2 text-xs font-thai">หน้า {currentPage} / {totalPages}</span>
                  <button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage >= totalPages} className="p-1 rounded hover:bg-gray-100 disabled:opacity-50" title="หน้าถัดไป"><ChevronRight className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage >= totalPages} className="p-1 rounded hover:bg-gray-100 disabled:opacity-50" title="หน้าสุดท้าย"><ChevronsRight className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showCreateModal && (
        <CreateOrderModal
          planId={planIdFromUrl}
          onClose={() => { setShowCreateModal(false); if (planIdFromUrl) router.replace('/production/orders'); }}
          onSuccess={() => { setShowCreateModal(false); if (planIdFromUrl) router.replace('/production/orders'); mutate(); }}
        />
      )}

      {selectedOrder && (
        <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} getStatusConfig={getStatusConfig} onStatusChange={() => mutate()} />
      )}
    </div>
  );
}

function SummaryCard({ label, count, color }: { label: string; count: number; color: string }) {
  const colorClasses: Record<string, string> = {
    gray: 'bg-gray-50 border-gray-200 text-gray-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    red: 'bg-red-50 border-red-200 text-red-700',
  };
  return (
    <div className={`rounded-lg border px-3 py-2 ${colorClasses[color]}`}>
      <p className="text-[10px] font-thai">{label}</p>
      <p className="text-lg font-bold">{count}</p>
    </div>
  );
}


// ========== CreateOrderModal Component ==========
interface CreateOrderModalProps {
  planId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

function CreateOrderModal({ planId, onClose, onSuccess }: CreateOrderModalProps) {
  const { planData, isLoading: loadingPlan } = usePlanDataForOrder(planId);
  const { createOrder, isLoading: creating } = useProductionOrderMutations();

  // Form state
  const [selectedSkuIndex, setSelectedSkuIndex] = useState(0);
  const [quantity, setQuantity] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [remarks, setRemarks] = useState('');

  // Food stock state
  const [foodStock, setFoodStock] = useState<FoodStockByDate[]>([]);
  const [loadingFoodStock, setLoadingFoodStock] = useState(false);
  const [expandedDateRows, setExpandedDateRows] = useState<Set<string>>(new Set());
  const [selectedPallets, setSelectedPallets] = useState<Map<number, number>>(new Map()); // balance_id -> qty

  // Get selected SKU and its materials
  const selectedSku = planData?.items[selectedSkuIndex];
  const foodMaterials = useMemo(() => 
    planData?.materials.filter(m => m.material_sku_id.startsWith('00-')) || [], 
    [planData]
  );
  const nonFoodMaterials = useMemo(() => 
    planData?.materials.filter(m => !m.material_sku_id.startsWith('00-')) || [], 
    [planData]
  );

  // Initialize form when plan data loads
  useEffect(() => {
    if (planData) {
      if (planData.items[0]) {
        setQuantity(String(planData.items[0].required_qty));
      }
      setStartDate(planData.plan_start_date);
      setDueDate(planData.plan_end_date);
    }
  }, [planData]);

  // Fetch food stock when food materials change
  useEffect(() => {
    if (foodMaterials.length > 0) {
      fetchFoodStock(foodMaterials[0].material_sku_id);
    }
  }, [foodMaterials]);

  const fetchFoodStock = async (skuId: string) => {
    setLoadingFoodStock(true);
    try {
      const res = await fetch(`/api/production/orders/food-stock?sku_id=${encodeURIComponent(skuId)}`);
      const data = await res.json();
      setFoodStock(data.data || []);
    } catch (err) {
      console.error('Error fetching food stock:', err);
    } finally {
      setLoadingFoodStock(false);
    }
  };

  const toggleDateRow = (dateKey: string) => {
    setExpandedDateRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dateKey)) newSet.delete(dateKey);
      else newSet.add(dateKey);
      return newSet;
    });
  };

  const togglePalletSelection = (balanceId: number, availableQty: number) => {
    setSelectedPallets(prev => {
      const newMap = new Map(prev);
      if (newMap.has(balanceId)) {
        newMap.delete(balanceId);
      } else {
        newMap.set(balanceId, availableQty);
      }
      return newMap;
    });
  };

  const totalSelectedQty = useMemo(() => {
    let total = 0;
    selectedPallets.forEach(qty => total += qty);
    return total;
  }, [selectedPallets]);

  const requiredFoodQty = foodMaterials[0]?.gross_requirement || 0;

  const handleSubmit = async () => {
    if (!selectedSku || !quantity || !startDate || !dueDate) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    // Build items from materials
    const items = planData?.materials.map(mat => ({
      material_sku_id: mat.material_sku_id,
      required_qty: mat.gross_requirement,
      uom: mat.material_uom,
    })) || [];

    const input: CreateProductionOrderInput = {
      plan_id: planId || undefined,
      sku_id: selectedSku.sku_id,
      quantity: Number(quantity),
      start_date: startDate,
      due_date: dueDate,
      remarks,
      items,
    };

    const result = await createOrder(input);
    if (result) {
      // TODO: Create material requisition tasks for selected pallets
      if (selectedPallets.size > 0) {
        console.log('Selected pallets for requisition:', Array.from(selectedPallets.entries()));
        // Future: POST to /api/production/material-requisition
      }
      onSuccess();
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('th-TH');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-blue-50">
          <h2 className="text-base font-bold text-thai-gray-900 font-thai">
            สร้างใบสั่งผลิต{planId ? `จากแผน: ${planData?.plan_no || planId}` : ''}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded"><X className="w-5 h-5" /></button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {loadingPlan ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              <span className="ml-2 text-sm font-thai">กำลังโหลดข้อมูลแผน...</span>
            </div>
          ) : !planData ? (
            <div className="text-center py-8 text-red-500 font-thai">ไม่พบข้อมูลแผนผลิต</div>
          ) : (
            <>
              {/* Plan Info */}
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <div className="font-semibold text-thai-gray-700 font-thai mb-2">ข้อมูลจากแผนผลิต</div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div><span className="text-gray-500">ชื่อแผน:</span> <span className="font-medium">{planData.plan_name}</span></div>
                  <div><span className="text-gray-500">จำนวนสินค้า:</span> <span className="font-medium">{planData.items.length} รายการ</span></div>
                  <div><span className="text-gray-500">วัตถุดิบ:</span> <span className="font-medium">{planData.materials.length} รายการ</span></div>
                </div>
              </div>

              {/* SKU Selection */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-thai-gray-700 font-thai">เลือกสินค้าที่จะสั่งผลิต *</label>
                <select
                  value={selectedSkuIndex}
                  onChange={(e) => {
                    const idx = Number(e.target.value);
                    setSelectedSkuIndex(idx);
                    setQuantity(String(planData.items[idx]?.required_qty || ''));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  {planData.items.map((item, idx) => (
                    <option key={item.sku_id} value={idx}>
                      {item.sku_id} - {item.sku_name} (จำนวน: {item.required_qty.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-thai-gray-700 font-thai mb-1">จำนวนที่สั่งผลิต *</label>
                  <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thai-gray-700 font-thai mb-1">วันที่เริ่มผลิต *</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thai-gray-700 font-thai mb-1">กำหนดเสร็จ *</label>
                  <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thai-gray-700 font-thai mb-1">หมายเหตุ</label>
                  <input type="text" value={remarks} onChange={(e) => setRemarks(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="หมายเหตุ..." />
                </div>
              </div>

              {/* Food Materials with Stock Selection */}
              {foodMaterials.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-orange-50 px-3 py-2 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-orange-600" />
                      <span className="text-sm font-semibold text-orange-800 font-thai">วัตถุดิบอาหาร (เลือกพาเลทที่จะเบิก)</span>
                    </div>
                    <div className="text-xs font-thai">
                      <span className="text-gray-600">ต้องการ: </span>
                      <span className="font-bold text-orange-600">{requiredFoodQty.toLocaleString()} {foodMaterials[0]?.material_uom || 'กก.'}</span>
                      <span className="mx-2">|</span>
                      <span className="text-gray-600">เลือกแล้ว: </span>
                      <span className={`font-bold ${totalSelectedQty >= requiredFoodQty ? 'text-green-600' : 'text-red-600'}`}>
                        {totalSelectedQty.toLocaleString()} {foodMaterials[0]?.material_uom || 'กก.'}
                      </span>
                    </div>
                  </div>

                  {loadingFoodStock ? (
                    <div className="p-4 text-center">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto text-orange-500" />
                      <span className="text-xs text-gray-500 font-thai">กำลังโหลดสต็อก...</span>
                    </div>
                  ) : foodStock.length === 0 ? (
                    <div className="p-4 text-center text-red-500 text-sm font-thai">
                      <AlertTriangle className="w-6 h-6 mx-auto mb-1" />
                      ไม่พบสต็อกวัตถุดิบอาหาร
                    </div>
                  ) : (
                    <div className="max-h-64 overflow-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-100 sticky top-0">
                          <tr>
                            <th className="px-2 py-1.5 text-left font-thai">วันผลิต</th>
                            <th className="px-2 py-1.5 text-left font-thai">วันหมดอายุ</th>
                            <th className="px-2 py-1.5 text-right font-thai">จำนวนคงเหลือ</th>
                            <th className="px-2 py-1.5 text-center font-thai">พาเลท</th>
                            <th className="px-2 py-1.5 w-8"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {foodStock.map((dateGroup) => {
                            const dateKey = `${dateGroup.production_date}_${dateGroup.expiry_date}`;
                            const isExpanded = expandedDateRows.has(dateKey);
                            const selectedInGroup = dateGroup.pallets.filter(p => selectedPallets.has(p.balance_id)).length;

                            return (
                              <React.Fragment key={dateKey}>
                                {/* Main row - grouped by date */}
                                <tr 
                                  className="border-b hover:bg-blue-50 cursor-pointer"
                                  onClick={() => toggleDateRow(dateKey)}
                                >
                                  <td className="px-2 py-1.5">
                                    <div className="flex items-center gap-1">
                                      {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                      <Calendar className="w-3 h-3 text-gray-400" />
                                      <span>{formatDate(dateGroup.production_date)}</span>
                                    </div>
                                  </td>
                                  <td className="px-2 py-1.5">
                                    <span className={dateGroup.expiry_date && new Date(dateGroup.expiry_date) < new Date() ? 'text-red-600 font-bold' : ''}>
                                      {formatDate(dateGroup.expiry_date)}
                                    </span>
                                  </td>
                                  <td className="px-2 py-1.5 text-right font-bold text-green-600">
                                    {dateGroup.total_qty.toLocaleString()}
                                  </td>
                                  <td className="px-2 py-1.5 text-center">
                                    <Badge variant="default" size="sm">{dateGroup.pallets.length}</Badge>
                                  </td>
                                  <td className="px-2 py-1.5 text-center">
                                    {selectedInGroup > 0 && (
                                      <Badge variant="success" size="sm">{selectedInGroup}</Badge>
                                    )}
                                  </td>
                                </tr>

                                {/* Sub-rows - individual pallets */}
                                {isExpanded && dateGroup.pallets.map((pallet) => {
                                  const isSelected = selectedPallets.has(pallet.balance_id);
                                  return (
                                    <tr 
                                      key={pallet.balance_id}
                                      className={`border-b ${isSelected ? 'bg-green-50' : 'bg-gray-50/50'} hover:bg-blue-50/50`}
                                    >
                                      <td className="px-2 py-1 pl-8" colSpan={2}>
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => togglePalletSelection(pallet.balance_id, pallet.available_qty)}
                                            className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                          />
                                          <span className="font-mono text-[10px] text-gray-600">{pallet.pallet_id}</span>
                                          <span className="text-gray-400">|</span>
                                          <MapPin className="w-3 h-3 text-gray-400" />
                                          <span className="text-[10px]">{pallet.location_name || pallet.location_id}</span>
                                        </div>
                                      </td>
                                      <td className="px-2 py-1 text-right">
                                        <span className="text-green-600">{pallet.available_qty.toLocaleString()}</span>
                                        {pallet.reserved_piece_qty > 0 && (
                                          <span className="text-orange-500 text-[10px] ml-1">(จอง {pallet.reserved_piece_qty})</span>
                                        )}
                                      </td>
                                      <td className="px-2 py-1 text-center">
                                        <span className="text-[10px] text-gray-500">{pallet.warehouse_id}</span>
                                      </td>
                                      <td className="px-2 py-1 text-center">
                                        {isSelected && <Check className="w-4 h-4 text-green-600 mx-auto" />}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Non-Food Materials */}
              {nonFoodMaterials.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-3 py-2 border-b">
                    <span className="text-sm font-semibold text-gray-700 font-thai">วัตถุดิบอื่นๆ ({nonFoodMaterials.length} รายการ)</span>
                  </div>
                  <table className="w-full text-xs">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-thai">รหัสวัตถุดิบ</th>
                        <th className="px-2 py-1.5 text-left font-thai">ชื่อวัตถุดิบ</th>
                        <th className="px-2 py-1.5 text-right font-thai">จำนวน</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nonFoodMaterials.map((mat) => (
                        <tr key={mat.material_sku_id} className="border-b">
                          <td className="px-2 py-1.5 font-mono text-gray-600">{mat.material_sku_id}</td>
                          <td className="px-2 py-1.5 font-thai">{mat.material_name}</td>
                          <td className="px-2 py-1.5 text-right font-bold">{mat.gross_requirement.toLocaleString()} {mat.material_uom || 'ชิ้น'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t bg-gray-50">
          <Button variant="outline" onClick={onClose} disabled={creating}>ยกเลิก</Button>
          <Button 
            variant="primary" 
            onClick={handleSubmit} 
            disabled={creating || loadingPlan || !planData}
            icon={creating ? Loader2 : Plus}
          >
            {creating ? 'กำลังสร้าง...' : 'สร้างใบสั่งผลิต'}
          </Button>
        </div>
      </div>
    </div>
  );
}


// ========== OrderDetailModal Component ==========
interface OrderDetailModalProps {
  order: ProductionOrderWithDetails;
  onClose: () => void;
  getStatusConfig: (status: ProductionOrderStatus) => { badge: React.ReactNode; icon: React.ReactNode };
  onStatusChange: () => void;
}

function OrderDetailModal({ order, onClose, getStatusConfig, onStatusChange }: OrderDetailModalProps) {
  const { performAction, isLoading } = useProductionOrderMutations();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleAction = async (action: string) => {
    setActionLoading(action);
    const result = await performAction(order.id, action);
    setActionLoading(null);
    if (result) {
      onStatusChange();
    }
  };

  const statusConfig = getStatusConfig(order.status);

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('th-TH');
  };

  const getCreatorName = () => {
    if (!order.creator) return '-';
    const { first_name, last_name, nickname } = order.creator;
    if (nickname) return nickname;
    return `${first_name || ''} ${last_name || ''}`.trim() || '-';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-blue-50">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-thai-gray-900 font-thai">
              รายละเอียดใบสั่งผลิต: {order.production_no}
            </h2>
            {statusConfig.badge}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded"><X className="w-5 h-5" /></button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Order Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <h3 className="text-xs font-semibold text-gray-500 mb-2 font-thai">ข้อมูลสินค้า</h3>
              <div className="space-y-1 text-sm">
                <div><span className="text-gray-500">รหัส:</span> <span className="font-mono font-medium">{order.sku_id}</span></div>
                <div><span className="text-gray-500">ชื่อ:</span> <span className="font-thai">{order.sku?.sku_name || '-'}</span></div>
                <div><span className="text-gray-500">จำนวนสั่ง:</span> <span className="font-bold text-blue-600">{Number(order.quantity).toLocaleString()}</span></div>
                <div><span className="text-gray-500">ผลิตได้:</span> <span className="font-bold text-green-600">{Number(order.produced_qty || 0).toLocaleString()}</span></div>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <h3 className="text-xs font-semibold text-gray-500 mb-2 font-thai">กำหนดการ</h3>
              <div className="space-y-1 text-sm">
                <div><span className="text-gray-500">วันเริ่ม:</span> <span>{formatDate(order.start_date)}</span></div>
                <div><span className="text-gray-500">กำหนดเสร็จ:</span> <span>{formatDate(order.due_date)}</span></div>
                <div><span className="text-gray-500">เริ่มจริง:</span> <span>{formatDate(order.actual_start_date)}</span></div>
                <div><span className="text-gray-500">เสร็จจริง:</span> <span>{formatDate(order.actual_completion_date)}</span></div>
              </div>
            </div>
          </div>

          {/* Additional Info */}
          <div className="bg-gray-50 rounded-lg p-3">
            <h3 className="text-xs font-semibold text-gray-500 mb-2 font-thai">ข้อมูลเพิ่มเติม</h3>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div><span className="text-gray-500">แผนผลิต:</span> <span className="font-mono">{order.plan?.plan_no || '-'}</span></div>
              <div><span className="text-gray-500">ผู้สร้าง:</span> <span className="font-thai">{getCreatorName()}</span></div>
              <div><span className="text-gray-500">ลำดับความสำคัญ:</span> <span>{order.priority || 5}</span></div>
            </div>
            {order.remarks && (
              <div className="mt-2 text-sm">
                <span className="text-gray-500">หมายเหตุ:</span> <span className="font-thai">{order.remarks}</span>
              </div>
            )}
          </div>

          {/* Materials */}
          {order.items && order.items.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-100 px-3 py-2 border-b">
                <span className="text-sm font-semibold text-gray-700 font-thai">วัตถุดิบ ({order.items.length} รายการ)</span>
              </div>
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-thai">รหัส</th>
                    <th className="px-2 py-1.5 text-left font-thai">ชื่อวัตถุดิบ</th>
                    <th className="px-2 py-1.5 text-right font-thai">ต้องการ</th>
                    <th className="px-2 py-1.5 text-right font-thai">เบิกแล้ว</th>
                    <th className="px-2 py-1.5 text-center font-thai">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="px-2 py-1.5 font-mono text-gray-600">{item.material_sku_id}</td>
                      <td className="px-2 py-1.5 font-thai">{item.material_sku?.sku_name || item.material_sku_id}</td>
                      <td className="px-2 py-1.5 text-right font-bold">{Number(item.required_qty).toLocaleString()}</td>
                      <td className="px-2 py-1.5 text-right text-green-600">{Number(item.issued_qty || 0).toLocaleString()}</td>
                      <td className="px-2 py-1.5 text-center">
                        <Badge 
                          variant={item.status === 'issued' ? 'success' : item.status === 'partial' ? 'warning' : 'default'} 
                          size="sm"
                        >
                          <span className="text-[10px]">
                            {item.status === 'pending' ? 'รอเบิก' : item.status === 'partial' ? 'เบิกบางส่วน' : item.status === 'issued' ? 'เบิกแล้ว' : item.status}
                          </span>
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer with Actions */}
        <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
          <div className="flex items-center gap-2">
            {order.status === 'planned' && (
              <Button 
                variant="primary" 
                size="sm" 
                onClick={() => handleAction('release')}
                disabled={isLoading}
                icon={actionLoading === 'release' ? Loader2 : CheckCircle2}
              >
                ปล่อยงาน
              </Button>
            )}
            {(order.status === 'planned' || order.status === 'released') && (
              <Button 
                variant="warning" 
                size="sm" 
                onClick={() => handleAction('start')}
                disabled={isLoading}
                icon={actionLoading === 'start' ? Loader2 : PlayCircle}
              >
                เริ่มผลิต
              </Button>
            )}
            {order.status === 'in_progress' && (
              <>
                <Button 
                  variant="success" 
                  size="sm" 
                  onClick={() => handleAction('complete')}
                  disabled={isLoading}
                  icon={actionLoading === 'complete' ? Loader2 : CheckCircle2}
                >
                  เสร็จสิ้น
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleAction('hold')}
                  disabled={isLoading}
                  icon={actionLoading === 'hold' ? Loader2 : PauseCircle}
                >
                  พักงาน
                </Button>
              </>
            )}
            {order.status === 'on_hold' && (
              <Button 
                variant="warning" 
                size="sm" 
                onClick={() => handleAction('start')}
                disabled={isLoading}
                icon={actionLoading === 'start' ? Loader2 : PlayCircle}
              >
                ดำเนินการต่อ
              </Button>
            )}
            {order.status !== 'completed' && order.status !== 'cancelled' && (
              <Button 
                variant="danger" 
                size="sm" 
                onClick={() => handleAction('cancel')}
                disabled={isLoading}
                icon={actionLoading === 'cancel' ? Loader2 : AlertCircle}
              >
                ยกเลิก
              </Button>
            )}
          </div>
          <Button variant="outline" onClick={onClose}>ปิด</Button>
        </div>
      </div>
    </div>
  );
}
