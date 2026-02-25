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
  ChevronDown,
  MapPin,
  Calendar,
  Check,
  Printer,
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
  available_qty: number; // in kg
  available_bags: number; // in bags
  production_date: string | null;
  expiry_date: string | null;
}

// Selection mode for pallet
type PalletSelectionMode = 'full' | 'partial'; // full = ทั้งพาเลท, partial = รายถุง

interface PalletSelection {
  mode: PalletSelectionMode;
  qty: number; // จำนวนถุงที่เลือก
  maxQty: number; // จำนวนถุงทั้งหมดในพาเลท
}

interface FoodStockByDate {
  sku_id: string;
  sku_name: string;
  production_date: string | null;
  expiry_date: string | null;
  total_qty: number; // in kg
  total_bags: number; // in bags
  weight_per_bag: number;
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
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);

  const { orders, totalCount, isLoading, error, mutate } = useProductionOrders({
    search: searchTerm,
    status: selectedStatus,
    start_date: dateFrom || undefined,
    end_date: dateTo || undefined,
    page: currentPage,
    pageSize,
  });

  const { deleteOrder, performAction } = useProductionOrderMutations();
  const [startingOrderId, setStartingOrderId] = useState<string | null>(null);

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
    }
  };

  const handlePrintOrder = async (order: ProductionOrderWithDetails, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    // Auto-approve: change status to in_progress before printing
    // (order has already been reviewed during planning phase)
    if (order.status === 'planned' || order.status === 'released') {
      setStartingOrderId(order.id);
      const result = await performAction(order.id, 'start');
      setStartingOrderId(null);
      
      if (!result) {
        alert('ไม่สามารถเปลี่ยนสถานะใบสั่งผลิตได้');
        return;
      }
      
      // Update order with new status for print document
      order = { ...order, status: 'in_progress' };
      mutate(); // Refresh the list
    }
    
    // Generate print HTML and open in new window
    const formatDate = (dateStr: string | null | undefined) => {
      if (!dateStr) return '-';
      return new Date(dateStr).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
    };
    
    const getStatusText = (status: string) => {
      const map: Record<string, string> = { planned: 'วางแผน', released: 'ปล่อยงาน', in_progress: 'กำลังผลิต', completed: 'เสร็จสิ้น', on_hold: 'พักงาน', cancelled: 'ยกเลิก' };
      return map[status] || status;
    };

    const materialsRows = order.items?.map((item, i) => `
      <tr>
        <td style="border:1px solid #000;padding:4px;text-align:center">${i + 1}</td>
        <td style="border:1px solid #000;padding:4px;font-family:monospace">${item.material_sku_id}</td>
        <td style="border:1px solid #000;padding:4px">${item.material_sku?.sku_name || item.material_sku_id}</td>
        <td style="border:1px solid #000;padding:4px;text-align:right">${Number(item.required_qty).toLocaleString()} ${item.uom || ''}</td>
      </tr>
    `).join('') || '';

    const printHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>ใบสั่งผลิต ${order.production_no}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    body { font-family: 'Sarabun', 'Noto Sans Thai', sans-serif; font-size: 11pt; color: #000; margin: 0; padding: 15mm; }
    table { border-collapse: collapse; width: 100%; }
    .header { border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 15px; }
    .title { font-size: 16pt; font-weight: bold; text-align: center; margin: 10px 0; border: 1px solid #000; padding: 6px; }
    .section-title { font-weight: bold; margin: 15px 0 8px 0; border-left: 3px solid #000; padding-left: 8px; }
    .signatures { margin-top: 30px; }
    .footer { margin-top: 20px; font-size: 9pt; border-top: 1px solid #000; padding-top: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <div style="font-size:14pt;font-weight:bold">AUSTAMGOOD CO., LTD.</div>
    <div style="font-size:9pt">ระบบจัดการคลังสินค้า (WMS)</div>
  </div>
  
  <div class="title">ใบสั่งผลิต (Production Order)</div>
  <div style="text-align:center;font-size:12pt;font-weight:bold;margin-bottom:15px">เลขที่: ${order.production_no}</div>
  
  <!-- ข้อมูลใบสั่งผลิต -->
  <table style="margin-bottom:15px">
    <tr>
      <td style="border:1px solid #000;padding:6px;width:50%;vertical-align:top">
        <div style="font-weight:bold;border-bottom:1px solid #000;padding-bottom:4px;margin-bottom:6px">ข้อมูลใบสั่งผลิต</div>
        <table style="width:100%;border:none">
          <tr><td style="padding:2px 0">สถานะ:</td><td style="padding:2px 0;text-align:right;font-weight:bold">${getStatusText(order.status)}</td></tr>
          <tr><td style="padding:2px 0">วันที่เริ่ม:</td><td style="padding:2px 0;text-align:right">${formatDate(order.start_date)}</td></tr>
          <tr><td style="padding:2px 0">กำหนดเสร็จ:</td><td style="padding:2px 0;text-align:right">${formatDate(order.due_date)}</td></tr>
        </table>
      </td>
      <td style="border:1px solid #000;padding:6px;width:50%;vertical-align:top">
        <div style="font-weight:bold;border-bottom:1px solid #000;padding-bottom:4px;margin-bottom:6px">ข้อมูลแผนการผลิต</div>
        <table style="width:100%;border:none">
          <tr><td style="padding:2px 0">รหัสแผน:</td><td style="padding:2px 0;text-align:right">${order.plan?.plan_no || '-'}</td></tr>
          <tr><td style="padding:2px 0">ชื่อแผน:</td><td style="padding:2px 0;text-align:right">${order.plan?.plan_name || '-'}</td></tr>
          <tr><td style="padding:2px 0">วันที่สร้าง:</td><td style="padding:2px 0;text-align:right">${formatDate(order.created_at)}</td></tr>
        </table>
      </td>
    </tr>
  </table>
  
  <!-- สินค้าที่ผลิต -->
  <table style="margin-bottom:15px">
    <tr style="background:#000;color:#fff">
      <th colspan="4" style="padding:8px;text-align:left;font-weight:bold">สินค้าที่ผลิต (Finished Goods)</th>
    </tr>
    <tr>
      <td colspan="4" style="border:1px solid #000;padding:8px">
        <div style="font-size:13pt;font-weight:bold;margin-bottom:4px">${order.sku?.sku_name || order.sku_id}</div>
        <div style="font-size:10pt;color:#333">รหัส: <span style="font-family:monospace">${order.sku_id}</span></div>
      </td>
    </tr>
    <tr>
      <td style="border:1px solid #000;padding:10px;text-align:center;width:25%">
        <div style="font-size:16pt;font-weight:bold">${Number(order.quantity).toLocaleString()}</div>
        <div style="font-size:9pt">จำนวนสั่งผลิต</div>
      </td>
      <td style="border:1px solid #000;padding:10px;text-align:center;width:25%">
        <div style="font-size:16pt;font-weight:bold">${Number(order.produced_qty || 0).toLocaleString()}</div>
        <div style="font-size:9pt">ผลิตได้แล้ว</div>
      </td>
      <td style="border:1px solid #000;padding:10px;text-align:center;width:25%">
        <div style="font-size:12pt;font-weight:bold">${order.production_date ? formatDate(order.production_date) : '-'}</div>
        <div style="font-size:9pt">วันผลิต FG</div>
      </td>
      <td style="border:1px solid #000;padding:10px;text-align:center;width:25%">
        <div style="font-size:12pt;font-weight:bold">${order.expiry_date ? formatDate(order.expiry_date) : '-'}</div>
        <div style="font-size:9pt">วันหมดอายุ FG</div>
      </td>
    </tr>
  </table>
  
  ${order.items && order.items.length > 0 ? `
  <div class="section-title">รายการวัตถุดิบที่ต้องใช้ (${order.items.length} รายการ)</div>
  <table>
    <thead>
      <tr style="background:#eee">
        <th style="border:1px solid #000;padding:6px;width:5%">#</th>
        <th style="border:1px solid #000;padding:6px;width:20%">รหัส</th>
        <th style="border:1px solid #000;padding:6px">ชื่อวัตถุดิบ</th>
        <th style="border:1px solid #000;padding:6px;width:15%">จำนวน</th>
      </tr>
    </thead>
    <tbody>${materialsRows}</tbody>
  </table>
  ` : ''}
  
  ${order.remarks ? `<div style="margin-top:15px;padding:8px;border:1px solid #000"><strong>หมายเหตุ:</strong> ${order.remarks}</div>` : ''}
  ${order.fg_remarks ? `<div style="margin-top:10px;padding:8px;border:1px solid #000;background:#f9f9f9"><strong>หมายเหตุ FG:</strong> ${order.fg_remarks}</div>` : ''}
  
  <!-- ลายเซ็น -->
  <table class="signatures">
    <tr>
      <td style="width:33%;text-align:center;padding-top:50px;border-top:1px solid #000">
        <div style="font-weight:bold">ผู้สั่งผลิต</div>
        <div style="font-size:9pt">วันที่: ____/____/____</div>
      </td>
      <td style="width:33%;text-align:center;padding-top:50px;border-top:1px solid #000">
        <div style="font-weight:bold">ผู้ตรวจสอบ</div>
        <div style="font-size:9pt">วันที่: ____/____/____</div>
      </td>
      <td style="width:34%;text-align:center;padding-top:50px;border-top:1px solid #000">
        <div style="font-weight:bold">ผู้อนุมัติ</div>
        <div style="font-size:9pt">วันที่: ____/____/____</div>
      </td>
    </tr>
  </table>
  
  <div class="footer">
    <table style="width:100%">
      <tr>
        <td style="text-align:left">พิมพ์เมื่อ: ${new Date().toLocaleString('th-TH')}</td>
        <td style="text-align:right">หน้า 1/1</td>
      </tr>
    </table>
  </div>
</body>
</html>`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printHtml);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
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
            <Button variant="primary" size="sm" icon={Plus} onClick={() => {
              if (!planIdFromUrl) {
                alert('กรุณาเลือกแผนผลิตจากหน้าวางแผนผลิตก่อนสร้างใบสั่งผลิต');
                router.push('/production/planning');
                return;
              }
              setShowCreateModal(true);
            }} className="text-xs py-1 px-2">สร้าง</Button>
            <Button variant="outline" size="sm" icon={RefreshCw} onClick={() => mutate()} disabled={isLoading} className="text-xs py-1 px-2">รีเฟรช</Button>
          </div>
        </div>

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
                        <tr key={order.id} className="hover:bg-blue-50/30 transition-colors duration-150">
                          <td className="px-2 py-1.5 border-r border-gray-100 whitespace-nowrap"><span className="font-mono font-semibold text-blue-600">{order.production_no}</span></td>
                          <td className="px-2 py-1.5 border-r border-gray-100 whitespace-nowrap"><span className="font-mono text-thai-gray-700">{order.sku_id}</span></td>
                          <td className="px-2 py-1.5 border-r border-gray-100"><span className="text-thai-gray-700 font-thai">{order.sku?.sku_name || order.sku_id}</span></td>
                          <td className="px-2 py-1.5 text-center border-r border-gray-100"><span className="font-bold text-blue-600">{Number(order.quantity).toLocaleString()}</span></td>
                          <td className="px-2 py-1.5 text-center border-r border-gray-100"><span className="font-bold text-green-600">{Number(order.produced_qty || 0).toLocaleString()}</span></td>
                          <td className="px-2 py-1.5 border-r border-gray-100 whitespace-nowrap"><span className="text-thai-gray-600">{new Date(order.start_date).toLocaleDateString('en-GB')}</span></td>
                          <td className="px-2 py-1.5 border-r border-gray-100 whitespace-nowrap"><span className="text-thai-gray-600">{new Date(order.due_date).toLocaleDateString('en-GB')}</span></td>
                          <td className="px-2 py-1.5 border-r border-gray-100">{statusConfig.badge}</td>
                          <td className="px-2 py-1.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={(e) => handlePrintOrder(order, e)} disabled={startingOrderId === order.id} className="p-1 rounded hover:bg-green-100 text-green-600 transition-colors disabled:opacity-50" title="พิมพ์">{startingOrderId === order.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}</button>
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

  // If no planId provided, show error and close
  if (!planId) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-thai-gray-900 font-thai mb-2">ไม่พบข้อมูลแผนผลิต</h2>
          <p className="text-sm text-gray-600 font-thai mb-4">กรุณาเลือกแผนผลิตจากหน้าวางแผนผลิตก่อนสร้างใบสั่งผลิต</p>
          <Button variant="primary" onClick={onClose} className="w-full">ยกเลิก</Button>
        </div>
      </div>
    );
  }

  // Form state
  const [selectedSkuIndex, setSelectedSkuIndex] = useState(0);
  const [quantity, setQuantity] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [remarks, setRemarks] = useState('');
  
  // FG (Finished Goods) production date and expiry date
  const [fgProductionDate, setFgProductionDate] = useState(new Date().toISOString().split('T')[0]);
  const [fgExpiryDate, setFgExpiryDate] = useState('');
  const [fgRemarks, setFgRemarks] = useState('');

  // Food stock state
  const [foodStock, setFoodStock] = useState<FoodStockByDate[]>([]);
  const [loadingFoodStock, setLoadingFoodStock] = useState(false);
  const [expandedDateRows, setExpandedDateRows] = useState<Set<string>>(new Set());
  const [selectedPallets, setSelectedPallets] = useState<Map<number, PalletSelection>>(new Map()); // balance_id -> PalletSelection
  const [editingPalletQty, setEditingPalletQty] = useState<number | null>(null); // balance_id ที่กำลังแก้ไขจำนวน

  // Get selected SKU and its materials (filtered by finished_sku_id)
  const selectedSku = planData?.items[selectedSkuIndex];
  const selectedSkuMaterials = useMemo(() => {
    if (!planData?.materials || !selectedSku) return [];
    // Filter materials by finished_sku_id matching selected SKU
    return planData.materials.filter(m => m.finished_sku_id === selectedSku.sku_id);
  }, [planData, selectedSku]);
  const foodMaterials = useMemo(() =>
    selectedSkuMaterials.filter(m => m.material_sku_id.startsWith('00-')),
    [selectedSkuMaterials]
  );
  const nonFoodMaterials = useMemo(() =>
    selectedSkuMaterials.filter(m => !m.material_sku_id.startsWith('00-')),
    [selectedSkuMaterials]
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

  const togglePalletSelection = (balanceId: number, availableBags: number, availableKg: number) => {
    setSelectedPallets(prev => {
      const newMap = new Map(prev);
      if (newMap.has(balanceId)) {
        newMap.delete(balanceId);
        setEditingPalletQty(null);
      } else {
        // Default: เลือกทั้งพาเลท
        newMap.set(balanceId, {
          mode: 'full',
          qty: availableBags,
          maxQty: availableBags
        });
      }
      return newMap;
    });
  };

  const togglePartialMode = (balanceId: number, availableBags: number) => {
    setSelectedPallets(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(balanceId);
      if (current) {
        if (current.mode === 'full') {
          // เปลี่ยนเป็น partial mode และเปิด input
          newMap.set(balanceId, {
            mode: 'partial',
            qty: current.qty,
            maxQty: availableBags
          });
          setEditingPalletQty(balanceId);
        } else {
          // เปลี่ยนกลับเป็น full mode
          newMap.set(balanceId, {
            mode: 'full',
            qty: availableBags,
            maxQty: availableBags
          });
          setEditingPalletQty(null);
        }
      }
      return newMap;
    });
  };

  const updatePalletQty = (balanceId: number, newQty: number) => {
    setSelectedPallets(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(balanceId);
      if (current) {
        const validQty = Math.max(1, Math.min(newQty, current.maxQty));
        newMap.set(balanceId, {
          ...current,
          qty: validQty
        });
      }
      return newMap;
    });
  };

  const totalSelectedQty = useMemo(() => {
    let total = 0;
    selectedPallets.forEach((selection) => {
      // คำนวณ กก. จากจำนวนถุง (ใช้ weight_per_bag จาก foodStock หรือ default 20 กก./ถุง)
      const weightPerBag = foodStock[0]?.weight_per_bag || 20;
      total += selection.qty * weightPerBag;
    });
    return total;
  }, [selectedPallets, foodStock]);

  const totalSelectedBags = useMemo(() => {
    let total = 0;
    selectedPallets.forEach((selection) => {
      total += selection.qty;
    });
    return total;
  }, [selectedPallets]);

  const requiredFoodQty = foodMaterials[0]?.gross_requirement || 0;

  const handleSubmit = async () => {
    if (!selectedSku || !quantity || !startDate || !dueDate) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }
    
    if (!fgProductionDate || !fgExpiryDate) {
      alert('กรุณากรอกวันผลิตและวันหมดอายุของสินค้า FG');
      return;
    }

    // ตรวจสอบว่าเลือกวัตถุดิบอาหารครบยอดหรือเกิน (ถ้ามีวัตถุดิบอาหาร)
    if (foodMaterials.length > 0 && requiredFoodQty > 0) {
      if (totalSelectedQty < requiredFoodQty) {
        alert(`กรุณาเลือกวัตถุดิบอาหารให้ครบยอด\n\nต้องการ: ${requiredFoodQty.toLocaleString()} ${foodMaterials[0]?.material_uom || 'กก.'}\nเลือกแล้ว: ${totalSelectedQty.toLocaleString()} ${foodMaterials[0]?.material_uom || 'กก.'}\n\nยังขาดอีก: ${(requiredFoodQty - totalSelectedQty).toLocaleString()} ${foodMaterials[0]?.material_uom || 'กก.'}`);
        return;
      }
    }

    // Build items from materials - เฉพาะวัตถุดิบที่ไม่ใช่อาหาร (packaging)
    // วัตถุดิบอาหาร (SKU ขึ้นต้นด้วย 00-) จะใช้ selected_pallets แทน ไม่ต้องใส่ใน items
    // เพื่อป้องกันการสร้างรายการซ้ำ
    const items = selectedSkuMaterials
      .filter(mat => !mat.material_sku_id.startsWith('00-')) // กรองเอาเฉพาะ non-food materials
      .map(mat => ({
        material_sku_id: mat.material_sku_id,
        required_qty: mat.gross_requirement,
        uom: mat.material_uom,
      }));

    // Build selected_pallets from selectedPallets Map
    const selected_pallets: Array<{
      balance_id: number;
      pallet_id: string;
      location_id: string;
      qty: number;
      sku_id: string;
    }> = [];

    if (selectedPallets.size > 0 && foodStock.length > 0) {
      // Find pallet details from foodStock
      for (const dateGroup of foodStock) {
        for (const pallet of dateGroup.pallets) {
          const selection = selectedPallets.get(pallet.balance_id);
          if (selection) {
            selected_pallets.push({
              balance_id: pallet.balance_id,
              pallet_id: pallet.pallet_id,
              location_id: pallet.location_id,
              qty: selection.qty, // ส่งจำนวนถุงที่เลือกจริง (อาจเป็นบางส่วนของพาเลท)
              sku_id: dateGroup.sku_id,
            });
          }
        }
      }
    }

    const input: CreateProductionOrderInput = {
      plan_id: planId || undefined,
      sku_id: selectedSku.sku_id,
      quantity: Number(quantity),
      start_date: startDate,
      due_date: dueDate,
      production_date: fgProductionDate,
      expiry_date: fgExpiryDate,
      fg_remarks: fgRemarks || undefined,
      remarks,
      items,
      selected_pallets: selected_pallets.length > 0 ? selected_pallets : undefined,
    };

    const result = await createOrder(input);
    if (result) {
      onSuccess();
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB');
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
            <div className="text-center py-8">
              <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
              <p className="text-red-500 font-thai font-semibold mb-2">ไม่พบข้อมูลแผนผลิต</p>
              <p className="text-sm text-gray-500 font-thai mb-4">กรุณาเลือกแผนผลิตจากหน้าวางแผนผลิตก่อน</p>
              <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
            </div>
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
                    // Reset selected pallets when changing SKU
                    setSelectedPallets(new Map());
                    setFoodStock([]);
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
              <div className="grid grid-cols-3 gap-3">
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
              </div>

              {/* FG Production Date & Expiry Date */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="text-xs font-semibold text-blue-800 font-thai mb-2">ข้อมูลสินค้าสำเร็จรูป (FG) ที่จะผลิต</div>
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <div>
                    <label className="block text-xs font-medium text-blue-700 font-thai mb-1">วันผลิต FG *</label>
                    <input type="date" value={fgProductionDate} onChange={(e) => setFgProductionDate(e.target.value)} className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-blue-700 font-thai mb-1">วันหมดอายุ FG *</label>
                    <input type="date" value={fgExpiryDate} onChange={(e) => setFgExpiryDate(e.target.value)} className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm bg-white" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-blue-700 font-thai mb-1">หมายเหตุ FG</label>
                  <input type="text" value={fgRemarks} onChange={(e) => setFgRemarks(e.target.value)} className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm bg-white" placeholder="หมายเหตุสำหรับสินค้า FG..." />
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
                      <span className="text-gray-400 ml-1">({totalSelectedBags} ถุง)</span>
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
                            <th className="px-2 py-1.5 text-right font-thai">จำนวนคงเหลือ (กก.)</th>
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
                                  const selection = selectedPallets.get(pallet.balance_id);
                                  const isSelected = !!selection;
                                  const isPartial = selection?.mode === 'partial';
                                  const isEditing = editingPalletQty === pallet.balance_id;
                                  return (
                                    <tr 
                                      key={pallet.balance_id}
                                      className={`border-b ${isSelected ? (isPartial ? 'bg-yellow-50' : 'bg-green-50') : 'bg-gray-50/50'} hover:bg-blue-50/50`}
                                    >
                                      <td className="px-2 py-1 pl-8" colSpan={2}>
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => togglePalletSelection(pallet.balance_id, pallet.available_bags, pallet.available_qty)}
                                            className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                          />
                                          <span className="font-mono text-[10px] text-gray-600">{pallet.pallet_id}</span>
                                          <span className="text-gray-400">|</span>
                                          <MapPin className="w-3 h-3 text-gray-400" />
                                          <span className="text-[10px]">{pallet.location_name || pallet.location_id}</span>
                                          {isSelected && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                togglePartialMode(pallet.balance_id, pallet.available_bags);
                                              }}
                                              className={`ml-2 px-1.5 py-0.5 text-[9px] rounded ${isPartial ? 'bg-yellow-200 text-yellow-800' : 'bg-gray-200 text-gray-600'} hover:opacity-80`}
                                              title={isPartial ? 'คลิกเพื่อเลือกทั้งพาเลท' : 'คลิกเพื่อเลือกรายถุง'}
                                            >
                                              {isPartial ? 'รายถุง' : 'ทั้งพาเลท'}
                                            </button>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-2 py-1 text-right">
                                        {isSelected && isPartial ? (
                                          <div className="flex items-center justify-end gap-1">
                                            <input
                                              type="number"
                                              min={1}
                                              max={pallet.available_bags}
                                              value={selection?.qty || 0}
                                              onChange={(e) => updatePalletQty(pallet.balance_id, parseInt(e.target.value) || 1)}
                                              onClick={(e) => e.stopPropagation()}
                                              className="w-14 px-1 py-0.5 text-[10px] text-right border border-yellow-400 rounded bg-yellow-50 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                                            />
                                            <span className="text-[10px] text-gray-500">/ {pallet.available_bags} ถุง</span>
                                          </div>
                                        ) : (
                                          <>
                                            <span className="text-green-600">{pallet.available_qty.toLocaleString()} กก.</span>
                                            <span className="text-gray-400 text-[10px] ml-1">({pallet.available_bags} ถุง)</span>
                                          </>
                                        )}
                                        {pallet.reserved_piece_qty > 0 && (
                                          <span className="text-orange-500 text-[10px] ml-1">(จอง {pallet.reserved_piece_qty})</span>
                                        )}
                                      </td>
                                      <td className="px-2 py-1 text-center">
                                        <span className="text-[10px] text-gray-500">{pallet.warehouse_id}</span>
                                      </td>
                                      <td className="px-2 py-1 text-center">
                                        {isSelected && (
                                          <div className="flex flex-col items-center">
                                            <Check className={`w-4 h-4 ${isPartial ? 'text-yellow-600' : 'text-green-600'}`} />
                                            {isPartial && (
                                              <span className="text-[9px] text-yellow-600 font-bold">{selection?.qty}</span>
                                            )}
                                          </div>
                                        )}
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
