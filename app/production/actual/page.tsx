'use client';

import { useState, useEffect } from 'react';
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
  Check
} from 'lucide-react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';

// Production Receipt interface (from production_receipts table)
interface ProductionReceipt {
  id: string;
  production_order_id: string;
  product_sku_id: string;
  received_qty: number;
  lot_no?: string;
  batch_no?: string;
  produced_by?: number;
  received_at: string;
  remarks?: string;
  created_at: string;
  // Joined data
  production_order?: {
    production_no: string;
    quantity: number;
    produced_qty: number;
    status: string;
  };
  product_sku?: {
    sku_id: string;
    sku_name: string;
  };
  producer?: {
    first_name: string;
    last_name: string;
  };
}

// Production Order for selection
interface ProductionOrderForSelect {
  id: string;
  production_no: string;
  sku_id: string;
  sku_name: string;
  quantity: number;
  produced_qty: number;
  remaining_qty: number;
  uom?: string;
  start_date: string;
  due_date: string;
  production_date?: string;
  expiry_date?: string;
  status: string;
  items?: BomItem[];
}

// BOM Item interface
interface BomItem {
  id: string;
  material_sku_id: string;
  material_name: string;
  required_qty: number;
  issued_qty: number;
  remaining_qty: number;
  uom: string;
  category?: string;
  sub_category?: string;
  is_food: boolean; // วัตถุดิบอาหาร = true
  actual_qty?: string; // สำหรับกรอกจำนวนจริง (เฉพาะที่ไม่ใช่อาหาร)
  mfg_date?: string; // วันผลิตของวัตถุดิบ
  exp_date?: string; // วันหมดอายุของวัตถุดิบ
  pallet_id?: string; // รหัสพาเลท
}

// TODO: Replace with actual data interface from database
interface ActualProduction {
  record_id: number;
  production_date: string;
  order_code: string;
  sku_id: string;
  sku_name: string;
  shift: string;
  actual_quantity: number;
  defect_quantity: number;
  good_quantity: number;
  status: string;
  created_at: string;
  created_by: string;
}

const ActualProductionPage = () => {
  const [actualData, setActualData] = useState<ActualProduction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedShift, setSelectedShift] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 100;

  // Modal states
  const [showSelectOrderModal, setShowSelectOrderModal] = useState(false);
  const [showReceiptFormModal, setShowReceiptFormModal] = useState(false);
  const [inProgressOrders, setInProgressOrders] = useState<ProductionOrderForSelect[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<ProductionOrderForSelect | null>(null);
  const [receiptForm, setReceiptForm] = useState({
    actual_qty: '',
    lot_no: '',
    batch_no: '',
    remarks: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [bomItems, setBomItems] = useState<BomItem[]>([]);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch data when debounced search or filters change
  useEffect(() => {
    fetchActualData(1);
  }, [debouncedSearchTerm, selectedShift, dateFrom, dateTo]);

  const fetchActualData = async (page: number = 1) => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('pageSize', pageSize.toString());
      if (debouncedSearchTerm) params.set('search', debouncedSearchTerm);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const response = await fetch(`/api/production/actual?${params.toString()}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch data');
      }

      // Transform API data to match ActualProduction interface
      const transformedData: ActualProduction[] = (result.data || []).map((receipt: any) => ({
        record_id: receipt.id,
        production_date: receipt.received_at,
        order_code: receipt.production_order?.production_no || '-',
        sku_id: receipt.product_sku?.sku_id || receipt.product_sku_id,
        sku_name: receipt.product_sku?.sku_name || '-',
        shift: '-', // Not tracked in current schema
        actual_quantity: receipt.received_qty,
        defect_quantity: 0, // Not tracked in current schema
        good_quantity: receipt.received_qty,
        status: receipt.production_order?.status || '-',
        created_at: receipt.created_at,
        created_by: receipt.producer 
          ? `${receipt.producer.first_name || ''} ${receipt.producer.last_name || ''}`.trim() || receipt.producer.nickname || '-'
          : '-'
      }));

      setActualData(transformedData);
      setTotalCount(result.totalCount || 0);
      setCurrentPage(page);
    } catch (err: any) {
      setError('เกิดข้อผิดพลาดในการโหลดข้อมูล: ' + err.message);
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch in-progress production orders
  const fetchInProgressOrders = async () => {
    try {
      setLoadingOrders(true);
      const response = await fetch('/api/production/orders?status=in_progress&pageSize=100');
      const result = await response.json();
      
      if (result.data) {
        const orders: ProductionOrderForSelect[] = result.data.map((order: any) => ({
          id: order.id,
          production_no: order.production_no,
          sku_id: order.sku_id,
          sku_name: order.sku?.sku_name || order.sku_id,
          quantity: order.quantity,
          produced_qty: order.produced_qty || 0,
          remaining_qty: order.remaining_qty || (order.quantity - (order.produced_qty || 0)),
          uom: order.uom || order.sku?.uom_base,
          start_date: order.start_date,
          due_date: order.due_date,
          production_date: order.production_date,
          expiry_date: order.expiry_date,
          status: order.status
        }));
        setInProgressOrders(orders);
      }
    } catch (err) {
      console.error('Error fetching in-progress orders:', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  // Open select order modal
  const handleOpenSelectOrder = () => {
    setShowSelectOrderModal(true);
    fetchInProgressOrders();
  };

  // Select an order and open receipt form
  const handleSelectOrder = async (order: ProductionOrderForSelect) => {
    setSelectedOrder(order);
    setReceiptForm({
      actual_qty: '',
      lot_no: '',
      batch_no: '',
      remarks: ''
    });
    setBomItems([]);
    setShowSelectOrderModal(false);
    setShowReceiptFormModal(true);

    // Fetch BOM items from both sources:
    // 1. production_order_items (for packaging)
    // 2. material-requisition API (for food materials from replenishment_queue)
    try {
      // Fetch production order items (packaging)
      const orderResponse = await fetch(`/api/production/orders/${order.id}`);
      const orderResult = await orderResponse.json();
      
      // Fetch material requisition data (food materials with expiry_date)
      const requisitionResponse = await fetch(`/api/production/material-requisition?search=${order.production_no}&pageSize=100`);
      const requisitionResult = await requisitionResponse.json();
      
      const allItems: BomItem[] = [];
      
      // Build a map of food materials with their MFG/EXP dates from replenishment_queue
      const foodMaterialsMap = new Map<string, { 
        requested: number; 
        confirmed: number; 
        sku_name: string; 
        uom: string;
        exp_date?: string;
        mfg_date?: string;
        pallet_id?: string;
      }>();
      
      if (requisitionResult.data && requisitionResult.data.length > 0) {
        requisitionResult.data.forEach((item: any) => {
          if (item.type === 'food' && item.trigger_reference === order.production_no) {
            const existing = foodMaterialsMap.get(item.sku_id);
            if (existing) {
              existing.requested += item.requested_qty || 0;
              existing.confirmed += item.confirmed_qty || 0;
              // Keep the earliest expiry date if multiple pallets
              if (item.expiry_date && (!existing.exp_date || item.expiry_date < existing.exp_date)) {
                existing.exp_date = item.expiry_date;
                existing.mfg_date = item.production_date;
                existing.pallet_id = item.pallet_id;
              }
            } else {
              foodMaterialsMap.set(item.sku_id, {
                requested: item.requested_qty || 0,
                confirmed: item.confirmed_qty || 0,
                sku_name: item.sku_name,
                uom: item.uom,
                exp_date: item.expiry_date,
                mfg_date: item.production_date,
                pallet_id: item.pallet_id
              });
            }
          }
        });
      }
      
      // Process production_order_items (packaging materials)
      if (orderResult.data?.items && orderResult.data.items.length > 0) {
        orderResult.data.items.forEach((item: any) => {
          const category = item.material_sku?.category || '';
          const subCategory = item.material_sku?.sub_category || '';
          const isFood = category === 'วัตถุดิบ' && (subCategory?.includes('อาหาร') || false);
          
          // Debug: Log category and sub_category
          console.log(`[BOM] ${item.material_sku_id}: category="${category}", sub_category="${subCategory}", isFood=${isFood}`);
          
          // Check if this is a food material with data from replenishment_queue
          const foodData = foodMaterialsMap.get(item.material_sku_id);
          
          allItems.push({
            id: item.id,
            material_sku_id: item.material_sku_id,
            material_name: item.material_sku?.sku_name || item.material_sku_id,
            required_qty: parseFloat(item.required_qty) || 0,
            issued_qty: foodData ? foodData.confirmed : (parseFloat(item.issued_qty) || 0),
            remaining_qty: parseFloat(item.remaining_qty) || (parseFloat(item.required_qty) - parseFloat(item.issued_qty)) || 0,
            uom: item.uom || item.material_sku?.uom_base || '-',
            category,
            sub_category: subCategory,
            is_food: isFood,
            actual_qty: '',
            // Use MFG/EXP from replenishment_queue for food materials
            mfg_date: foodData?.mfg_date || undefined,
            exp_date: foodData?.exp_date || undefined,
            pallet_id: foodData?.pallet_id || undefined
          });
        });
      }
      
      // Add food materials that are only in replenishment_queue (not in production_order_items)
      foodMaterialsMap.forEach((foodData, skuId) => {
        const existsInItems = allItems.some(item => item.material_sku_id === skuId);
        if (!existsInItems) {
          allItems.push({
            id: `food-${skuId}`,
            material_sku_id: skuId,
            material_name: foodData.sku_name,
            required_qty: foodData.requested,
            issued_qty: foodData.confirmed,
            remaining_qty: foodData.requested - foodData.confirmed,
            uom: foodData.uom,
            category: 'วัตถุดิบ',
            sub_category: 'อาหาร',
            is_food: true,
            actual_qty: '',
            mfg_date: foodData.mfg_date,
            exp_date: foodData.exp_date,
            pallet_id: foodData.pallet_id
          });
        }
      });
      
      setBomItems(allItems);
    } catch (err) {
      console.error('Error fetching order details:', err);
    }
  };

  // Update BOM item actual qty
  const handleBomActualQtyChange = (itemId: string, value: string) => {
    setBomItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, actual_qty: value } : item
    ));
  };

  // Submit production receipt with variance tracking
  const handleSubmitReceipt = async () => {
    if (!selectedOrder || !receiptForm.actual_qty) {
      alert('กรุณากรอกจำนวนผลิตจริง');
      return;
    }

    const actualQty = parseFloat(receiptForm.actual_qty);
    if (isNaN(actualQty) || actualQty <= 0) {
      alert('จำนวนผลิตจริงต้องมากกว่า 0');
      return;
    }

    // Prepare BOM materials with actual usage for variance tracking
    const bomMaterials = bomItems.map(item => {
      const actualQtyValue = item.actual_qty ? parseFloat(item.actual_qty) : item.issued_qty;
      console.log(`[Submit] ${item.material_sku_id}: is_food=${item.is_food}, category=${item.category}, sub_category=${item.sub_category}`);
      return {
        material_sku_id: item.material_sku_id,
        issued_qty: item.issued_qty,
        actual_qty: actualQtyValue,
        uom: item.uom,
        variance_reason: null, // Can be extended to include reason dropdown
        remarks: null,
        is_food: item.is_food, // ส่ง flag บอกว่าเป็นวัตถุดิบอาหารหรือไม่
        production_order_item_id: item.id.startsWith('food-') ? null : item.id // ID ของ production_order_items (สำหรับ packaging)
      };
    }).filter(m => m.material_sku_id); // Filter out any invalid entries
    
    console.log('=== BOM Materials to send ===', bomMaterials);

    try {
      setSubmitting(true);
      const response = await fetch('/api/production/actual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          production_order_id: selectedOrder.id,
          product_sku_id: selectedOrder.sku_id,
          received_qty: actualQty,
          lot_no: receiptForm.lot_no || null,
          batch_no: receiptForm.batch_no || null,
          remarks: receiptForm.remarks || null,
          bom_materials: bomMaterials // Include variance tracking data
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create production receipt');
      }

      // Show success message with variance summary
      let successMsg = 'บันทึกการผลิตจริงสำเร็จ';
      if (result.materials_tracked > 0) {
        const vs = result.variance_summary;
        successMsg += `\n\nบันทึกวัตถุดิบ ${result.materials_tracked} รายการ`;
        if (vs.shortage > 0 || vs.excess > 0) {
          successMsg += `\n- ตรงกัน: ${vs.exact} รายการ`;
          if (vs.shortage > 0) successMsg += `\n- ใช้น้อยกว่าเบิก: ${vs.shortage} รายการ`;
          if (vs.excess > 0) successMsg += `\n- ใช้มากกว่าเบิก: ${vs.excess} รายการ`;
        }
      }
      
      // แสดงข้อมูล replenishment ที่สร้างอัตโนมัติ
      if (result.replenishment_created && result.replenishment_created.length > 0) {
        successMsg += `\n\n📦 สร้างรายการเบิกเพิ่มเติมอัตโนมัติ ${result.replenishment_created.length} รายการ`;
        successMsg += `\n(ดูได้ที่หน้า เบิกวัตถุดิบ)`;
      }
      
      alert(successMsg);
      setShowReceiptFormModal(false);
      setSelectedOrder(null);
      setBomItems([]);
      fetchActualData(1);
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getShiftBadge = (shift: string) => {
    switch (shift) {
      case 'morning':
        return <Badge variant="info" size="sm" className="whitespace-nowrap"><span className="text-[10px]">เช้า</span></Badge>;
      case 'afternoon':
        return <Badge variant="warning" size="sm" className="whitespace-nowrap"><span className="text-[10px]">บ่าย</span></Badge>;
      case 'night':
        return <Badge variant="default" size="sm" className="whitespace-nowrap"><span className="text-[10px]">ดึก</span></Badge>;
      default:
        return <Badge variant="default" size="sm" className="whitespace-nowrap"><span className="text-[10px]">{shift}</span></Badge>;
    }
  };

  const filteredData = actualData;

  return (
    <div className="h-[calc(100vh-3.25rem)] bg-gradient-to-br from-thai-gray-25 to-white overflow-hidden">
      <div className="h-full flex flex-col space-y-1 pt-0 px-2 pb-1">
        {/* Header + Filters Combined */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg px-2 py-1.5 shadow-sm flex-shrink-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-thai-gray-900 font-thai whitespace-nowrap">บันทึกการผลิตจริง</h1>
            <div className="flex-1 relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-thai-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ค้นหา..."
                className="w-full pl-7 pr-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500/50"
              />
            </div>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500/50 w-28"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500/50 w-28"
            />
            <select
              value={selectedShift}
              onChange={(e) => setSelectedShift(e.target.value)}
              className="px-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500/50"
            >
              <option value="all">ทุกกะ</option>
              <option value="morning">กะเช้า</option>
              <option value="afternoon">กะบ่าย</option>
              <option value="night">กะดึก</option>
            </select>
            <Button variant="outline" size="sm" icon={Download} className="text-xs py-1 px-2">
              Excel
            </Button>
            <Button variant="primary" size="sm" icon={RefreshCw} onClick={() => fetchActualData(1)} disabled={loading} className="text-xs py-1 px-2">
              รีเฟรช
            </Button>
            <Button variant="primary" size="sm" icon={Plus} onClick={handleOpenSelectOrder} className="text-xs py-1 px-2 bg-green-600 hover:bg-green-700">
              สร้างรับผลิตจริง
            </Button>
          </div>
        </div>

        {/* Data Table */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="w-full flex-1 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col overflow-hidden">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center text-thai-gray-500 gap-2">
                <Loader2 className="w-6 h-6 animate-spin" />
                <p className="text-sm font-thai">กำลังโหลดข้อมูลการผลิตจริง...</p>
              </div>
            ) : error ? (
              <div className="h-full flex flex-col items-center justify-center text-red-500 gap-2">
                <p className="text-sm font-thai">{error}</p>
              </div>
            ) : filteredData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-thai-gray-500 gap-4">
                <FileText className="w-12 h-12" />
                <div className="text-center">
                  <p className="text-sm font-medium font-thai">ไม่พบข้อมูลการผลิตจริง</p>
                  <p className="text-xs text-thai-gray-400 mt-1 font-thai">ลองปรับเปลี่ยนตัวกรองหรือค้นหาใหม่</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-auto thin-scrollbar">
                <table className="w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-gray-100">
                    <tr>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">วันที่ผลิต</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">รหัสใบสั่งผลิต</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">รหัสสินค้า</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">ชื่อสินค้า</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">กะ</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">ผลิตได้</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">เสีย</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">ดี</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">วันที่บันทึก</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b whitespace-nowrap">บันทึกโดย</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100 text-[11px]">
                    {filteredData.map((record) => (
                      <tr key={record.record_id} className="hover:bg-blue-50/30 transition-colors duration-150">
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap align-top">
                          <span className="text-thai-gray-600 font-thai">
                            {new Date(record.production_date).toLocaleDateString('th-TH')}
                          </span>
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap align-top">
                          <span className="font-mono text-thai-gray-700">{record.order_code}</span>
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                          <span className="font-mono font-semibold text-thai-gray-700">{record.sku_id}</span>
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                          <span className="text-thai-gray-700 font-thai text-[11px]">{record.sku_name}</span>
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap align-top">
                          {getShiftBadge(record.shift)}
                        </td>
                        <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap">
                          <span className="font-bold text-blue-600">{record.actual_quantity?.toLocaleString()}</span>
                        </td>
                        <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap">
                          <span className="font-bold text-red-600">{record.defect_quantity?.toLocaleString()}</span>
                        </td>
                        <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap">
                          <span className="font-bold text-green-600">{record.good_quantity?.toLocaleString()}</span>
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap align-top">
                          <span className="text-thai-gray-600 font-thai">
                            {new Date(record.created_at).toLocaleString('th-TH', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </td>
                        <td className="px-2 py-0.5 whitespace-nowrap align-top">
                          <span className="text-thai-gray-700 font-thai">{record.created_by}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination - sticky bottom */}
            {!loading && !error && totalCount > 0 && (
              <div className="flex-shrink-0 flex items-center justify-between px-3 py-1 border-t border-gray-200 bg-white text-xs">
                <span className="text-thai-gray-600 font-thai">
                  แสดง {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, totalCount)} จาก {totalCount.toLocaleString()} รายการ
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => fetchActualData(1)}
                    disabled={currentPage === 1}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="หน้าแรก"
                  >
                    <ChevronsLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => fetchActualData(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="หน้าก่อนหน้า"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-2 text-xs font-thai">
                    หน้า {currentPage} / {Math.ceil(totalCount / pageSize)}
                  </span>
                  <button
                    onClick={() => fetchActualData(currentPage + 1)}
                    disabled={currentPage >= Math.ceil(totalCount / pageSize)}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="หน้าถัดไป"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => fetchActualData(Math.ceil(totalCount / pageSize))}
                    disabled={currentPage >= Math.ceil(totalCount / pageSize)}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="หน้าสุดท้าย"
                  >
                    <ChevronsRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal: Select Production Order */}
      {showSelectOrderModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h2 className="text-lg font-semibold font-thai">เลือกใบสั่งผลิต (กำลังผลิต)</h2>
              <button onClick={() => setShowSelectOrderModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {loadingOrders ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                  <span className="ml-2 font-thai">กำลังโหลดข้อมูล...</span>
                </div>
              ) : inProgressOrders.length === 0 ? (
                <div className="text-center py-8 text-gray-500 font-thai">
                  <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>ไม่พบใบสั่งผลิตที่มีสถานะ "กำลังผลิต"</p>
                </div>
              ) : (
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold border-b">เลขที่ใบสั่งผลิต</th>
                      <th className="px-3 py-2 text-left font-semibold border-b">รหัสสินค้า</th>
                      <th className="px-3 py-2 text-left font-semibold border-b">ชื่อสินค้า</th>
                      <th className="px-3 py-2 text-center font-semibold border-b">จำนวนสั่งผลิต</th>
                      <th className="px-3 py-2 text-center font-semibold border-b">ผลิตแล้ว</th>
                      <th className="px-3 py-2 text-center font-semibold border-b">คงเหลือ</th>
                      <th className="px-3 py-2 text-center font-semibold border-b">เลือก</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inProgressOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-blue-50 cursor-pointer" onClick={() => handleSelectOrder(order)}>
                        <td className="px-3 py-2 border-b font-mono text-blue-600">{order.production_no}</td>
                        <td className="px-3 py-2 border-b font-mono">{order.sku_id}</td>
                        <td className="px-3 py-2 border-b font-thai">{order.sku_name}</td>
                        <td className="px-3 py-2 border-b text-center font-bold">{order.quantity.toLocaleString()}</td>
                        <td className="px-3 py-2 border-b text-center text-green-600 font-bold">{order.produced_qty.toLocaleString()}</td>
                        <td className="px-3 py-2 border-b text-center text-orange-600 font-bold">{order.remaining_qty.toLocaleString()}</td>
                        <td className="px-3 py-2 border-b text-center">
                          <button className="px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600">
                            เลือก
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Production Receipt Form - Professional Document Style */}
      {showReceiptFormModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 rounded-t-lg flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold font-thai">ใบรับผลิตจริง</h2>
                  <p className="text-blue-100 text-sm font-thai mt-0.5">Production Receipt Document</p>
                </div>
                <button 
                  onClick={() => setShowReceiptFormModal(false)} 
                  className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
              {/* Document Info - Compact Professional Layout with Quantity */}
              <div className="border border-gray-300 rounded-lg overflow-hidden mb-4">
                {/* Top Row - Product Name (Full Width) */}
                <div className="flex border-b border-gray-200">
                  <div className="bg-gray-50 px-3 py-2 w-24 font-medium text-gray-600 text-xs font-thai border-r border-gray-200">ชื่อสินค้า</div>
                  <div className="px-3 py-2 flex-1">
                    <span className="font-thai text-gray-900 text-sm font-semibold">{selectedOrder.sku_name}</span>
                  </div>
                </div>
                {/* Bottom Grid - 3 Columns */}
                <div className="grid grid-cols-3 divide-x divide-gray-200">
                  {/* Left Column - Order Info */}
                  <div className="divide-y divide-gray-200">
                    <div className="flex">
                      <div className="bg-gray-50 px-3 py-2 w-24 font-medium text-gray-600 text-xs font-thai border-r border-gray-200">ใบสั่งผลิต</div>
                      <div className="px-3 py-2 flex-1">
                        <span className="font-mono font-bold text-blue-600 text-sm">{selectedOrder.production_no}</span>
                      </div>
                    </div>
                    <div className="flex">
                      <div className="bg-gray-50 px-3 py-2 w-24 font-medium text-gray-600 text-xs font-thai border-r border-gray-200">รหัสสินค้า</div>
                      <div className="px-3 py-2 flex-1">
                        <span className="font-mono text-gray-700 text-sm">{selectedOrder.sku_id}</span>
                      </div>
                    </div>
                  </div>
                  {/* Middle Column - Dates */}
                  <div className="divide-y divide-gray-200">
                    <div className="flex">
                      <div className="bg-gray-50 px-3 py-2 w-20 font-medium text-gray-600 text-xs font-thai border-r border-gray-200">MFG</div>
                      <div className="px-3 py-2 flex-1">
                        <span className="font-thai text-gray-900 text-sm font-semibold">
                          {selectedOrder.production_date 
                            ? new Date(selectedOrder.production_date).toLocaleDateString('th-TH')
                            : '-'
                          }
                        </span>
                      </div>
                    </div>
                    <div className="flex">
                      <div className="bg-gray-50 px-3 py-2 w-20 font-medium text-gray-600 text-xs font-thai border-r border-gray-200">EXP</div>
                      <div className="px-3 py-2 flex-1">
                        <span className="font-thai text-gray-900 text-sm font-semibold">
                          {selectedOrder.expiry_date 
                            ? new Date(selectedOrder.expiry_date).toLocaleDateString('th-TH')
                            : '-'
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* Right Column - Quantity Summary */}
                  <div className="divide-y divide-gray-200">
                    <div className="flex">
                      <div className="bg-blue-50 px-3 py-2 w-20 font-medium text-blue-600 text-xs font-thai border-r border-blue-200">สั่งผลิต</div>
                      <div className="px-3 py-2 flex-1 bg-blue-50/50">
                        <span className="font-bold text-blue-700 text-sm">{selectedOrder.quantity.toLocaleString()}</span>
                        <span className="text-blue-500 text-xs ml-1">{selectedOrder.uom || 'หน่วย'}</span>
                      </div>
                    </div>
                    <div className="flex">
                      <div className="bg-green-50 px-3 py-2 w-20 font-medium text-green-600 text-xs font-thai border-r border-green-200">ผลิตแล้ว</div>
                      <div className="px-3 py-2 flex-1 bg-green-50/50">
                        <span className="font-bold text-green-700 text-sm">{selectedOrder.produced_qty.toLocaleString()}</span>
                        <span className="text-green-500 text-xs ml-1">{selectedOrder.uom || 'หน่วย'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* BOM Items Table */}
              {bomItems.length > 0 && (
                <div className="border border-gray-300 rounded-lg overflow-hidden mb-6">
                  <div className="bg-purple-100 px-4 py-2 border-b border-gray-300">
                    <h3 className="font-semibold text-purple-800 font-thai text-sm">รายการวัตถุดิบ (BOM)</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600 border-b border-r text-xs font-thai">#</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600 border-b border-r text-xs font-thai">รหัสวัตถุดิบ</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600 border-b border-r text-xs font-thai">ชื่อวัตถุดิบ</th>
                          <th className="px-3 py-2 text-center font-semibold text-gray-600 border-b border-r text-xs font-thai">ต้องการ</th>
                          <th className="px-3 py-2 text-center font-semibold text-gray-600 border-b border-r text-xs font-thai">เบิกแล้ว</th>
                          <th className="px-3 py-2 text-center font-semibold text-gray-600 border-b border-r text-xs font-thai">หน่วย</th>
                          <th className="px-3 py-2 text-center font-semibold text-gray-600 border-b border-r text-xs font-thai">MFG</th>
                          <th className="px-3 py-2 text-center font-semibold text-gray-600 border-b border-r text-xs font-thai">EXP</th>
                          <th className="px-3 py-2 text-center font-semibold text-gray-600 border-b text-xs font-thai">ใช้จริง</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bomItems.map((item, index) => (
                          <tr key={item.id} className={`${item.is_food ? 'bg-amber-50' : 'bg-white'} hover:bg-gray-50`}>
                            <td className="px-3 py-2 border-b border-r text-center text-gray-500">{index + 1}</td>
                            <td className="px-3 py-2 border-b border-r font-mono text-xs">{item.material_sku_id}</td>
                            <td className="px-3 py-2 border-b border-r font-thai text-xs">
                              {item.material_name}
                              {item.is_food && (
                                <span className="ml-2 px-1.5 py-0.5 bg-amber-200 text-amber-800 text-[10px] rounded font-thai">อาหาร</span>
                              )}
                            </td>
                            <td className="px-3 py-2 border-b border-r text-center font-bold">{item.required_qty.toLocaleString()}</td>
                            <td className="px-3 py-2 border-b border-r text-center text-green-600 font-bold">{item.issued_qty.toLocaleString()}</td>
                            <td className="px-3 py-2 border-b border-r text-center text-gray-500 text-xs">{item.uom}</td>
                            <td className="px-3 py-2 border-b border-r text-center text-xs text-gray-600">
                              {item.is_food && item.mfg_date
                                ? new Date(item.mfg_date).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' })
                                : '-'
                              }
                            </td>
                            <td className="px-3 py-2 border-b border-r text-center text-xs text-gray-600">
                              {item.is_food && item.exp_date
                                ? new Date(item.exp_date).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' })
                                : '-'
                              }
                            </td>
                            <td className="px-3 py-2 border-b text-center">
                              <input
                                type="number"
                                value={item.actual_qty || ''}
                                onChange={(e) => handleBomActualQtyChange(item.id, e.target.value)}
                                placeholder={item.issued_qty.toString()}
                                className="w-20 px-2 py-1 border border-gray-300 rounded text-center text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                min="0"
                                step="0.01"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="bg-gray-50 px-4 py-2 border-t text-xs text-gray-500 font-thai">
                    <span className="inline-block w-3 h-3 bg-amber-200 rounded mr-1"></span> วัตถุดิบอาหาร (กรอกจำนวนใช้จริงได้ หากต่างจากที่เบิก)
                  </div>
                </div>
              )}

              {/* Input Form Table */}
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <div className="bg-green-100 px-4 py-2 border-b border-gray-300">
                  <h3 className="font-semibold text-green-800 font-thai text-sm">ข้อมูลสินค้าสำเร็จรูป</h3>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-gray-200">
                      <td className="bg-gray-50 px-4 py-3 font-medium text-gray-600 w-44 font-thai border-r align-middle">
                        จำนวนผลิตจริง <span className="text-red-500">*</span>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={receiptForm.actual_qty}
                          onChange={(e) => setReceiptForm({ ...receiptForm, actual_qty: e.target.value })}
                          placeholder={`กรอกจำนวน (คงเหลือ: ${selectedOrder.remaining_qty.toLocaleString()})`}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base font-bold"
                          min="0"
                          step="0.01"
                          autoFocus
                        />
                      </td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="bg-gray-50 px-4 py-3 font-medium text-gray-600 font-thai border-r align-middle">
                        หมายเลขล็อต (Lot No.)
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={receiptForm.lot_no}
                          onChange={(e) => setReceiptForm({ ...receiptForm, lot_no: e.target.value })}
                          placeholder="เช่น LOT-202512-001"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="bg-gray-50 px-4 py-3 font-medium text-gray-600 font-thai border-r align-middle">
                        หมายเลขแบทช์ (Batch No.)
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={receiptForm.batch_no}
                          onChange={(e) => setReceiptForm({ ...receiptForm, batch_no: e.target.value })}
                          placeholder="เช่น BATCH-001"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </td>
                    </tr>
                    <tr>
                      <td className="bg-gray-50 px-4 py-3 font-medium text-gray-600 font-thai border-r align-top">
                        หมายเหตุ
                      </td>
                      <td className="px-4 py-2">
                        <textarea
                          value={receiptForm.remarks}
                          onChange={(e) => setReceiptForm({ ...receiptForm, remarks: e.target.value })}
                          placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)..."
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg flex-shrink-0">
              <Button 
                variant="outline" 
                onClick={() => setShowReceiptFormModal(false)} 
                disabled={submitting}
                className="px-6"
              >
                ยกเลิก
              </Button>
              <Button 
                variant="primary" 
                icon={Check} 
                onClick={handleSubmitReceipt} 
                disabled={submitting || !receiptForm.actual_qty}
                className="px-6 bg-green-600 hover:bg-green-700"
              >
                {submitting ? 'กำลังบันทึก...' : 'บันทึกผลิตจริง'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default function ActualProductionPageWithPermission() {
  return (
    <PermissionGuard
      permission="production.actual.view"
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
            <p className="text-gray-600">คุณไม่มีสิทธิ์ในการดูบันทึกการผลิตจริง</p>
          </div>
        </div>
      }
    >
      <ActualProductionPage />
    </PermissionGuard>
  );
}
