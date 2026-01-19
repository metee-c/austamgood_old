'use client';

import { useState, useEffect, useRef } from 'react';
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
  Check,
  Printer,
  Edit
} from 'lucide-react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { ProductionReceiptForPrint } from '@/components/production/ProductionReceiptPrintDocument';

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

// Interface for calculated production data
interface CalculatedData {
  fg_planned_qty: number;
  fg_actual_qty: number;
  fg_received_qty: number; // จำนวน FG ที่รับเข้าจาก wms_receive_items
  fg_variance: number; // ส่วนต่าง: บันทึกจริง - รับเข้า
  food_actual_qty: number;
  food_actual_kg: number;
  packaging_actual_qty: number;
  avg_weight_per_bag: number;
  waste_per_piece: number;
  total_waste: number;
  food_materials: Array<{
    sku_id: string;
    sku_name: string;
    issued_qty: number;
    actual_qty: number;
    variance_qty: number;
    variance_type: string;
    uom: string;
  }>;
  packaging_materials: Array<{
    sku_id: string;
    sku_name: string;
    issued_qty: number;
    actual_qty: number;
    variance_qty: number;
    variance_type: string;
    uom: string;
  }>;
}

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
  // ข้อมูลเพิ่มเติมที่คำนวณ
  calculated?: CalculatedData;
}

const ActualProductionPage = () => {
  const [actualData, setActualData] = useState<ActualProduction[]>([]);
  const [rawReceiptData, setRawReceiptData] = useState<any[]>([]); // เก็บข้อมูลดิบจาก API สำหรับปริ้น
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

  // Edit modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    actual_qty: '',
    lot_no: '',
    batch_no: '',
    remarks: ''
  });
  const [editBomItems, setEditBomItems] = useState<BomItem[]>([]);

  // Print states
  const printRef = useRef<HTMLDivElement>(null);

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

      // เก็บข้อมูลดิบสำหรับปริ้น
      setRawReceiptData(result.data || []);

      // Transform API data to match ActualProduction interface
      const transformedData: ActualProduction[] = (result.data || []).map((receipt: any) => ({
        record_id: receipt.id,
        // ใช้ start_date จาก production_order (วันที่สั่งผลิต) แทน received_at (วันที่บันทึก)
        production_date: receipt.production_order?.start_date || receipt.received_at,
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
          : '-',
        // ข้อมูลเพิ่มเติมที่คำนวณจาก API
        calculated: receipt.calculated || null
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

  // Handle print receipt - ไปหน้าพิมพ์เลยโดยไม่ต้องมี preview
  const handlePrintReceipt = (recordId: string) => {
    const rawReceipt = rawReceiptData.find((r: any) => r.id === recordId);
    if (rawReceipt) {
      // เรียก executePrint โดยตรงโดยส่ง receipt เข้าไป
      executePrintDirect(rawReceipt as ProductionReceiptForPrint);
    }
  };

  // Execute print directly - สร้าง HTML พร้อม CSS ครบถ้วนสำหรับปริ้น (แบบทางการ ขาวดำ)
  const executePrintDirect = (receipt: ProductionReceiptForPrint) => {
    const calc = receipt.calculated;
    
    const formatDate = (dateStr: string | null | undefined) => {
      if (!dateStr) return '-';
      const date = new Date(dateStr);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear(); // ค.ศ.
      return `${day}/${month}/${year}`;
    };

    const formatDateTime = (dateStr: string | null | undefined) => {
      if (!dateStr) return '-';
      const date = new Date(dateStr);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear(); // ค.ศ.
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    };

    const producerName = receipt.producer
      ? `${receipt.producer.first_name || ''} ${receipt.producer.last_name || ''}`.trim() || receipt.producer.nickname || '-'
      : '-';

    const fgPlanned = calc?.fg_planned_qty || receipt.production_order?.quantity || 0;
    const fgActual = calc?.fg_actual_qty || receipt.received_qty || 0;
    const efficiency = fgPlanned > 0 ? ((fgActual / fgPlanned) * 100).toFixed(1) : '0';

    // สร้าง HTML สำหรับตารางรวม (สินค้าสำเร็จรูป + วัตถุดิบอาหาร + วัสดุบรรจุภัณฑ์)
    let combinedTableHtml = '';
    
    // Helper function สำหรับ format วันที่แบบสั้น (ปี ค.ศ. 4 หลัก)
    const formatDateShort = (dateStr: string | null | undefined) => {
      if (!dateStr) return '-';
      const date = new Date(dateStr);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear(); // ค.ศ. 4 หลัก
      return `${day}/${month}/${year}`;
    };
    
    // สร้าง rows สำหรับวัตถุดิบอาหาร (พร้อมแถวย่อยรายพาเลท)
    let foodRows = '';
    let foodTotal = 0;
    if (calc?.food_materials && calc.food_materials.length > 0) {
      foodRows = calc.food_materials.map((item: any, index: number) => {
        // แถวหลักของวัตถุดิบ พร้อมวันผลิต/วันหมดอายุ
        // ถ้า material_production_date/material_expiry_date เป็น null ให้ดึงจาก pallet_details แทน
        let mfgDate = '-';
        let expDate = '-';
        
        if (item.material_production_date) {
          mfgDate = formatDateShort(item.material_production_date);
        } else if (item.pallet_details && item.pallet_details.length > 0 && item.pallet_details[0].production_date) {
          mfgDate = formatDateShort(item.pallet_details[0].production_date);
        }
        
        if (item.material_expiry_date) {
          expDate = formatDateShort(item.material_expiry_date);
        } else if (item.pallet_details && item.pallet_details.length > 0 && item.pallet_details[0].expiry_date) {
          expDate = formatDateShort(item.pallet_details[0].expiry_date);
        }
        
        let mainRow = `
          <tr>
            <td style="padding: 6px; border: 1px solid #000; text-align: center;">${index + 1}</td>
            <td style="padding: 6px; border: 1px solid #000; font-family: monospace; font-size: 9pt;">${item.sku_id}</td>
            <td style="padding: 6px; border: 1px solid #000;">${item.sku_name || '-'}</td>
            <td style="padding: 6px; border: 1px solid #000; text-align: right; font-weight: bold;">${item.actual_qty.toLocaleString()} ${item.uom}</td>
            <td style="padding: 6px; border: 1px solid #000; font-size: 8pt;">EXP: ${expDate}</td>
          </tr>
        `;
        
        // แถวย่อยรายพาเลท (ถ้ามี)
        let palletRows = '';
        if (item.pallet_details && item.pallet_details.length > 0) {
          palletRows = item.pallet_details.map((pallet: any, pIdx: number) => `
            <tr style="background: #fafafa;">
              <td style="padding: 4px 6px; border: 1px solid #ddd; text-align: center; font-size: 8pt; color: #666;">${index + 1}.${pIdx + 1}</td>
              <td style="padding: 4px 6px; border: 1px solid #ddd; font-family: monospace; font-size: 8pt; color: #333;">${pallet.pallet_id || '-'}</td>
              <td style="padding: 4px 6px; border: 1px solid #ddd; font-size: 8pt;">
                <span style="color: #666;">EXP:</span> ${formatDateShort(pallet.expiry_date)}
              </td>
              <td style="padding: 4px 6px; border: 1px solid #ddd; text-align: right; font-size: 8pt;">${pallet.qty?.toLocaleString() || '-'} ${item.uom}</td>
              <td style="padding: 4px 6px; border: 1px solid #ddd; font-size: 8pt; color: #666;">${pallet.from_location_id || ''}</td>
            </tr>
          `).join('');
        }
        
        return mainRow + palletRows;
      }).join('');
      foodTotal = calc.food_materials.reduce((sum: number, m: any) => sum + m.actual_qty, 0);
    }

    // สร้าง rows สำหรับวัสดุบรรจุภัณฑ์
    let packagingRows = '';
    let packagingTotal = 0;
    if (calc?.packaging_materials && calc.packaging_materials.length > 0) {
      packagingRows = calc.packaging_materials.map((item: any, index: number) => `
        <tr>
          <td style="padding: 6px; border: 1px solid #000; text-align: center;">${index + 1}</td>
          <td style="padding: 6px; border: 1px solid #000; font-family: monospace; font-size: 9pt;">${item.sku_id}</td>
          <td style="padding: 6px; border: 1px solid #000;">${item.sku_name || '-'}</td>
          <td style="padding: 6px; border: 1px solid #000; text-align: right; font-weight: bold;">${item.actual_qty.toLocaleString()} ${item.uom}</td>
          <td style="padding: 6px; border: 1px solid #000;"></td>
        </tr>
      `).join('');
      packagingTotal = calc.packaging_materials.reduce((sum: number, m: any) => sum + m.actual_qty, 0);
    }

    // รวมทุกส่วนเป็นตารางเดียว
    combinedTableHtml = `
      <table style="width: 100%; border-collapse: collapse; font-size: 9pt; border: 1px solid #000; margin-bottom: 15px;">
        <!-- Section: สินค้าสำเร็จรูป -->
        <tr style="background: #e5e5e5;">
          <td colspan="5" style="padding: 8px 10px; font-weight: bold; font-size: 10pt; border: 1px solid #000;">สินค้าสำเร็จรูป (Finished Goods)</td>
        </tr>
        <tr style="background: #f5f5f5;">
          <th style="padding: 6px; text-align: left; font-weight: 600; width: 6%; border: 1px solid #000;">#</th>
          <th style="padding: 6px; text-align: left; font-weight: 600; width: 18%; border: 1px solid #000;">รหัสสินค้า</th>
          <th style="padding: 6px; text-align: left; font-weight: 600; border: 1px solid #000;">ชื่อสินค้า</th>
          <th style="padding: 6px; text-align: right; font-weight: 600; width: 15%; border: 1px solid #000;">ชิ้น (จริง)</th>
          <th style="padding: 6px; text-align: left; font-weight: 600; width: 20%; border: 1px solid #000;">หมายเหตุ</th>
        </tr>
        <tr>
          <td style="padding: 6px; border: 1px solid #000; text-align: center;">1</td>
          <td style="padding: 6px; border: 1px solid #000; font-family: monospace; font-size: 9pt;">${receipt.product_sku_id}</td>
          <td style="padding: 6px; border: 1px solid #000;">${receipt.product_sku?.sku_name || '-'}</td>
          <td style="padding: 6px; border: 1px solid #000; text-align: right; font-weight: bold;">${Number(fgActual).toLocaleString()}</td>
          <td style="padding: 6px; border: 1px solid #000;"></td>
        </tr>
        <tr style="background: #f5f5f5;">
          <td colspan="3" style="padding: 6px; text-align: right; border: 1px solid #000; font-weight: bold;">รวม:</td>
          <td style="padding: 6px; text-align: right; font-weight: bold; border: 1px solid #000;">${Number(fgActual).toLocaleString()}</td>
          <td style="padding: 6px; border: 1px solid #000;"></td>
        </tr>
        
        ${calc?.food_materials && calc.food_materials.length > 0 ? `
        <!-- Section: วัตถุดิบอาหาร -->
        <tr style="background: #e5e5e5;">
          <td colspan="5" style="padding: 8px 10px; font-weight: bold; font-size: 10pt; border: 1px solid #000;">วัตถุดิบอาหาร (${calc.food_materials.length} รายการ)</td>
        </tr>
        <tr style="background: #f5f5f5;">
          <th style="padding: 6px; text-align: left; font-weight: 600; width: 6%; border: 1px solid #000;">#</th>
          <th style="padding: 6px; text-align: left; font-weight: 600; width: 18%; border: 1px solid #000;">รหัสวัตถุดิบ</th>
          <th style="padding: 6px; text-align: left; font-weight: 600; border: 1px solid #000;">ชื่อวัตถุดิบ</th>
          <th style="padding: 6px; text-align: right; font-weight: 600; width: 15%; border: 1px solid #000;">ใช้จริง</th>
          <th style="padding: 6px; text-align: left; font-weight: 600; width: 20%; border: 1px solid #000;">หมายเหตุ</th>
        </tr>
        ${foodRows}
        <tr style="background: #f5f5f5;">
          <td colspan="3" style="padding: 6px; text-align: right; border: 1px solid #000; font-weight: bold;">รวม:</td>
          <td style="padding: 6px; text-align: right; font-weight: bold; border: 1px solid #000;">${foodTotal.toLocaleString()}</td>
          <td style="padding: 6px; border: 1px solid #000;"></td>
        </tr>
        ` : ''}
        
        ${calc?.packaging_materials && calc.packaging_materials.length > 0 ? `
        <!-- Section: วัสดุบรรจุภัณฑ์ -->
        <tr style="background: #e5e5e5;">
          <td colspan="5" style="padding: 8px 10px; font-weight: bold; font-size: 10pt; border: 1px solid #000;">วัสดุบรรจุภัณฑ์ (${calc.packaging_materials.length} รายการ)</td>
        </tr>
        <tr style="background: #f5f5f5;">
          <th style="padding: 6px; text-align: left; font-weight: 600; width: 6%; border: 1px solid #000;">#</th>
          <th style="padding: 6px; text-align: left; font-weight: 600; width: 18%; border: 1px solid #000;">รหัสวัตถุดิบ</th>
          <th style="padding: 6px; text-align: left; font-weight: 600; border: 1px solid #000;">ชื่อวัตถุดิบ</th>
          <th style="padding: 6px; text-align: right; font-weight: 600; width: 15%; border: 1px solid #000;">ใช้จริง</th>
          <th style="padding: 6px; text-align: left; font-weight: 600; width: 20%; border: 1px solid #000;">หมายเหตุ</th>
        </tr>
        ${packagingRows}
        <tr style="background: #f5f5f5;">
          <td colspan="3" style="padding: 6px; text-align: right; border: 1px solid #000; font-weight: bold;">รวม:</td>
          <td style="padding: 6px; text-align: right; font-weight: bold; border: 1px solid #000;">${packagingTotal.toLocaleString()}</td>
          <td style="padding: 6px; border: 1px solid #000;"></td>
        </tr>
        ` : ''}
      </table>
    `;

    const printHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>ใบรับผลิตจริง - ${receipt.production_order?.production_no || ''}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap');
          * { box-sizing: border-box; }
          body { 
            margin: 0; 
            padding: 0; 
            font-family: 'Sarabun', 'Noto Sans Thai', sans-serif; 
            font-size: 10pt;
            color: #000;
            line-height: 1.4;
          }
          @media print {
            @page { size: A4 portrait; margin: 10mm; }
          }
        </style>
      </head>
      <body>
        <div style="width: 210mm; min-height: 297mm; padding: 12mm; margin: 0 auto; background: white;">
          <!-- Header -->
          <div style="border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <div style="font-size: 16pt; font-weight: bold; color: #000; margin-bottom: 2px;">AUSTAMGOOD CO., LTD.</div>
                <div style="font-size: 8pt; color: #333;">ระบบจัดการคลังสินค้า (WMS) - Production Module</div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 8pt; color: #333;">เลขที่เอกสาร</div>
                <div style="font-size: 10pt; font-weight: bold;">${receipt.production_order?.production_no || '-'}</div>
              </div>
            </div>
          </div>

          <!-- Document Title -->
          <div style="font-size: 14pt; font-weight: bold; text-align: center; color: #000; margin: 12px 0; padding: 8px; border: 2px solid #000;">ใบรับผลิตจริง (Production Receipt)</div>

          <!-- Info Grid -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 15px;">
            <!-- Receipt Info -->
            <div style="border: 1px solid #000; padding: 10px;">
              <div style="font-size: 9pt; font-weight: bold; color: #000; text-transform: uppercase; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid #000;">ข้อมูลการรับผลิต</div>
              <div style="display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px dotted #999;"><span style="color: #333; font-size: 9pt;">วันที่สั่งผลิต:</span><span style="font-weight: 600; color: #000;">${formatDate(receipt.production_order?.start_date)}</span></div>
              <div style="display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px dotted #999;"><span style="color: #333; font-size: 9pt;">Lot No.:</span><span style="font-weight: 600; color: #000;">${receipt.lot_no || '-'}</span></div>
              <div style="display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px dotted #999;"><span style="color: #333; font-size: 9pt;">Batch No.:</span><span style="font-weight: 600; color: #000;">${receipt.batch_no || '-'}</span></div>
              <div style="display: flex; justify-content: space-between; padding: 3px 0;"><span style="color: #333; font-size: 9pt;">ผู้บันทึก:</span><span style="font-weight: 600; color: #000;">${producerName}</span></div>
            </div>
            <!-- FG Dates Info -->
            <div style="border: 1px solid #000; padding: 10px;">
              <div style="font-size: 9pt; font-weight: bold; color: #000; text-transform: uppercase; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid #000;">วันที่สินค้าสำเร็จรูป</div>
              <div style="display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px dotted #999;"><span style="color: #333; font-size: 9pt;">วันผลิต (MFG):</span><span style="font-weight: 600; color: #000;">${formatDate(receipt.production_order?.production_date)}</span></div>
              <div style="display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px dotted #999;"><span style="color: #333; font-size: 9pt;">วันหมดอายุ (EXP):</span><span style="font-weight: 600; color: #000;">${formatDate(receipt.production_order?.expiry_date)}</span></div>
              <div style="display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px dotted #999;"><span style="color: #333; font-size: 9pt;">สถานะใบสั่งผลิต:</span><span style="font-weight: 600; color: #000;">${receipt.production_order?.status === 'completed' ? 'เสร็จสิ้น' : receipt.production_order?.status === 'in_progress' ? 'กำลังผลิต' : receipt.production_order?.status || '-'}</span></div>
              <div style="display: flex; justify-content: space-between; padding: 3px 0;"><span style="color: #333; font-size: 9pt;">วันที่บันทึก:</span><span style="font-weight: 600; color: #000;">${formatDateTime(receipt.created_at)}</span></div>
            </div>
          </div>

          <!-- Combined Table: สินค้าสำเร็จรูป + วัตถุดิบอาหาร + วัสดุบรรจุภัณฑ์ -->
          ${combinedTableHtml}

          <!-- Remarks -->
          ${receipt.remarks ? `
            <div style="margin-bottom: 15px; padding: 10px; border: 1px solid #000;">
              <div style="font-weight: bold; color: #000; margin-bottom: 4px; font-size: 9pt;">หมายเหตุ:</div>
              <div style="font-size: 9pt;">${receipt.remarks}</div>
            </div>
          ` : ''}

          <!-- Summary Section - Table Format (moved before signature) -->
          <div style="margin-bottom: 15px;">
            <div style="font-size: 10pt; font-weight: bold; color: #000; margin-bottom: 8px; padding: 6px 10px; background: #f5f5f5; border-left: 4px solid #000;">สรุปประสิทธิผลการผลิต</div>
            <table style="width: 100%; border-collapse: collapse; font-size: 9pt; border: 1px solid #000;">
              <thead>
                <tr style="background: #e5e5e5;">
                  <th style="padding: 8px; border: 1px solid #000; text-align: center; font-weight: bold;">น้ำหนักเฉลี่ย/ถุง (กก.)</th>
                  <th style="padding: 8px; border: 1px solid #000; text-align: center; font-weight: bold;">เวสต่อชิ้น</th>
                  <th style="padding: 8px; border: 1px solid #000; text-align: center; font-weight: bold;">เวสรวม</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="padding: 12px; border: 1px solid #000; text-align: center; font-size: 14pt; font-weight: bold;">${calc?.avg_weight_per_bag?.toFixed(3) || '-'}</td>
                  <td style="padding: 12px; border: 1px solid #000; text-align: center; font-size: 14pt; font-weight: bold;">${calc?.waste_per_piece?.toFixed(3) || '0'}</td>
                  <td style="padding: 12px; border: 1px solid #000; text-align: center; font-size: 14pt; font-weight: bold;">${calc?.total_waste?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || '0'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Signature Section -->
          <div style="margin-top: 25px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px;">
            <div style="text-align: center; padding-top: 40px; border-top: 1px solid #000;">
              <div style="font-weight: 600; margin-bottom: 4px; font-size: 9pt;">ผู้วางแผน/สั่งผลิต</div>
              <div style="font-size: 8pt; color: #333;">ชื่อ: ____________________</div>
              <div style="font-size: 8pt; color: #333;">วันที่: ____/____/____</div>
            </div>
            <div style="text-align: center; padding-top: 40px; border-top: 1px solid #000;">
              <div style="font-weight: 600; margin-bottom: 4px; font-size: 9pt;">ผู้ผลิต</div>
              <div style="font-size: 8pt; color: #333;">ชื่อ: ____________________</div>
              <div style="font-size: 8pt; color: #333;">วันที่: ____/____/____</div>
            </div>
            <div style="text-align: center; padding-top: 40px; border-top: 1px solid #000;">
              <div style="font-weight: 600; margin-bottom: 4px; font-size: 9pt;">ผู้รับสินค้า</div>
              <div style="font-size: 8pt; color: #333;">ชื่อ: ____________________</div>
              <div style="font-size: 8pt; color: #333;">วันที่: ____/____/____</div>
            </div>
            <div style="text-align: center; padding-top: 40px; border-top: 1px solid #000;">
              <div style="font-weight: 600; margin-bottom: 4px; font-size: 9pt;">ผู้ตรวจสอบ</div>
              <div style="font-size: 8pt; color: #333;">ชื่อ: ____________________</div>
              <div style="font-size: 8pt; color: #333;">วันที่: ____/____/____</div>
            </div>
          </div>

          <!-- Footer -->
          <div style="margin-top: 20px; padding-top: 8px; border-top: 1px solid #000; display: flex; justify-content: space-between; font-size: 8pt; color: #333;">
            <div>พิมพ์เมื่อ: ${new Date().toLocaleString('th-TH')}</div>
            <div>เอกสารนี้สร้างโดยระบบ WMS อัตโนมัติ</div>
            <div>หน้า 1/1</div>
          </div>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printHtml);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
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

  // Handle edit receipt - เปิด modal แก้ไขพร้อมข้อมูลเดิม
  const handleEditReceipt = async (recordId: string) => {
    const rawReceipt = rawReceiptData.find((r: any) => r.id === recordId);
    if (!rawReceipt) {
      alert('ไม่พบข้อมูลที่ต้องการแก้ไข');
      return;
    }

    setEditingReceipt(rawReceipt);
    setEditForm({
      actual_qty: rawReceipt.received_qty?.toString() || '',
      lot_no: rawReceipt.lot_no || '',
      batch_no: rawReceipt.batch_no || '',
      remarks: rawReceipt.remarks || ''
    });

    // ดึงข้อมูล BOM materials จาก production_receipt_materials
    const materials = rawReceipt.materials || [];
    const calc = rawReceipt.calculated;
    
    // รวม food_materials และ packaging_materials
    const allMaterials: BomItem[] = [];
    
    if (calc?.food_materials) {
      calc.food_materials.forEach((m: any) => {
        allMaterials.push({
          id: `food-${m.sku_id}`,
          material_sku_id: m.sku_id,
          material_name: m.sku_name || m.sku_id,
          required_qty: m.issued_qty || 0,
          issued_qty: m.issued_qty || 0,
          remaining_qty: 0,
          uom: m.uom || 'ชิ้น',
          is_food: true,
          actual_qty: m.actual_qty?.toString() || ''
        });
      });
    }
    
    if (calc?.packaging_materials) {
      calc.packaging_materials.forEach((m: any) => {
        allMaterials.push({
          id: `pkg-${m.sku_id}`,
          material_sku_id: m.sku_id,
          material_name: m.sku_name || m.sku_id,
          required_qty: m.issued_qty || 0,
          issued_qty: m.issued_qty || 0,
          remaining_qty: 0,
          uom: m.uom || 'ชิ้น',
          is_food: false,
          actual_qty: m.actual_qty?.toString() || ''
        });
      });
    }
    
    setEditBomItems(allMaterials);
    setShowEditModal(true);
  };

  // Update BOM item actual qty for edit
  const handleEditBomActualQtyChange = (itemId: string, value: string) => {
    setEditBomItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, actual_qty: value } : item
    ));
  };

  // Submit edit receipt
  const handleSubmitEdit = async () => {
    if (!editingReceipt || !editForm.actual_qty) {
      alert('กรุณากรอกจำนวนผลิตจริง');
      return;
    }

    const actualQty = parseFloat(editForm.actual_qty);
    if (isNaN(actualQty) || actualQty <= 0) {
      alert('จำนวนผลิตจริงต้องมากกว่า 0');
      return;
    }

    // Prepare BOM materials with actual usage
    const bomMaterials = editBomItems.map(item => {
      const actualQtyValue = item.actual_qty ? parseFloat(item.actual_qty) : item.issued_qty;
      return {
        material_sku_id: item.material_sku_id,
        issued_qty: item.issued_qty,
        actual_qty: actualQtyValue,
        uom: item.uom,
        is_food: item.is_food
      };
    }).filter(m => m.material_sku_id);

    try {
      setSubmitting(true);
      const response = await fetch(`/api/production/actual/${editingReceipt.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          received_qty: actualQty,
          lot_no: editForm.lot_no || null,
          batch_no: editForm.batch_no || null,
          remarks: editForm.remarks || null,
          bom_materials: bomMaterials
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update production receipt');
      }

      alert('แก้ไขข้อมูลสำเร็จ');
      setShowEditModal(false);
      setEditingReceipt(null);
      setEditBomItems([]);
      fetchActualData(currentPage);
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
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap bg-blue-50">ชิ้น (แผน)</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap bg-green-50">ชิ้น (จริง)</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap bg-teal-50">รับเข้า FG</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap bg-orange-50">ส่วนต่าง FG</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap bg-amber-50">อาหาร (กก.)</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap bg-purple-50">ถุง/สติ๊กเกอร์</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap bg-cyan-50">กก./ถุง</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap bg-red-50">เวส/ชิ้น</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap bg-red-50">เวสรวม</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">วันที่บันทึก</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">บันทึกโดย</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">สถานะ</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap">แก้ไข/ปริ้น</th>
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
                        {/* ชิ้น (แผน) */}
                        <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap bg-blue-50/30">
                          <span className="font-bold text-blue-600">
                            {record.calculated?.fg_planned_qty?.toLocaleString() || '-'}
                          </span>
                        </td>
                        {/* ชิ้น (จริง) */}
                        <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap bg-green-50/30">
                          <span className="font-bold text-green-600">
                            {record.calculated?.fg_actual_qty?.toLocaleString() || record.actual_quantity?.toLocaleString() || '-'}
                          </span>
                        </td>
                        {/* รับเข้า FG (จาก wms_receive_items) */}
                        <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap bg-teal-50/30">
                          <span className="font-bold text-teal-600">
                            {record.calculated?.fg_received_qty?.toLocaleString() || '-'}
                          </span>
                        </td>
                        {/* ส่วนต่าง FG (บันทึกจริง - รับเข้า) */}
                        <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap bg-orange-50/30">
                          {record.calculated?.fg_received_qty !== undefined && record.calculated?.fg_received_qty > 0 ? (
                            <span className={`font-bold ${
                              record.calculated?.fg_variance === 0 
                                ? 'text-green-600' 
                                : record.calculated?.fg_variance > 0 
                                  ? 'text-orange-600' 
                                  : 'text-red-600'
                            }`}>
                              {record.calculated?.fg_variance === 0 
                                ? '✓ ตรง' 
                                : record.calculated?.fg_variance > 0 
                                  ? `+${record.calculated?.fg_variance?.toLocaleString()}`
                                  : record.calculated?.fg_variance?.toLocaleString()
                              }
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        {/* อาหาร (กก.) */}
                        <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap bg-amber-50/30">
                          <span className="font-bold text-amber-700">
                            {record.calculated?.food_actual_kg?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || '-'}
                          </span>
                          {record.calculated?.food_actual_qty ? (
                            <span className="text-[9px] text-amber-500 ml-0.5">
                              ({record.calculated.food_actual_qty} ถุง)
                            </span>
                          ) : null}
                        </td>
                        {/* ถุง/สติ๊กเกอร์ */}
                        <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap bg-purple-50/30">
                          <span className="font-bold text-purple-600">
                            {record.calculated?.packaging_actual_qty?.toLocaleString() || '-'}
                          </span>
                        </td>
                        {/* กก./ถุง (น้ำหนักเฉลี่ย) */}
                        <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap bg-cyan-50/30">
                          <span className="font-bold text-cyan-700">
                            {record.calculated?.avg_weight_per_bag 
                              ? record.calculated.avg_weight_per_bag.toFixed(3)
                              : '-'
                            }
                          </span>
                        </td>
                        {/* เวส/ชิ้น */}
                        <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap bg-red-50/30">
                          <span className="font-bold text-red-600">
                            {record.calculated?.waste_per_piece 
                              ? record.calculated.waste_per_piece.toFixed(3)
                              : '-'
                            }
                          </span>
                        </td>
                        {/* เวสรวม */}
                        <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap bg-red-50/30">
                          <span className="font-bold text-red-600">
                            {record.calculated?.total_waste 
                              ? record.calculated.total_waste.toLocaleString(undefined, { maximumFractionDigits: 2 })
                              : '-'
                            }
                          </span>
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
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap align-top">
                          <span className="text-thai-gray-700 font-thai">{record.created_by}</span>
                        </td>
                        {/* สถานะ */}
                        <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap align-top">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            record.status === 'completed' 
                              ? 'bg-green-100 text-green-700' 
                              : record.status === 'in_progress'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {record.status === 'completed' ? 'เสร็จสิ้น' : 
                             record.status === 'in_progress' ? 'กำลังผลิต' : 
                             record.status || '-'}
                          </span>
                        </td>
                        {/* ปุ่มแก้ไข + ปริ้น */}
                        <td className="px-2 py-0.5 text-center whitespace-nowrap align-top">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleEditReceipt(record.record_id as unknown as string)}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="แก้ไขข้อมูล"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handlePrintReceipt(record.record_id as unknown as string)}
                              className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                              title="ปริ้นใบรับผลิตจริง"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                          </div>
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
                                step="1"
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
                          step="1"
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

      {/* Modal: Edit Production Receipt */}
      {showEditModal && editingReceipt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white px-6 py-4 rounded-t-lg flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold font-thai">แก้ไขใบรับผลิตจริง</h2>
                  <p className="text-amber-100 text-sm font-thai mt-0.5">Edit Production Receipt</p>
                </div>
                <button 
                  onClick={() => { setShowEditModal(false); setEditingReceipt(null); setEditBomItems([]); }} 
                  className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
              {/* Document Info */}
              <div className="border border-gray-300 rounded-lg overflow-hidden mb-4">
                <div className="flex border-b border-gray-200">
                  <div className="bg-gray-50 px-3 py-2 w-24 font-medium text-gray-600 text-xs font-thai border-r border-gray-200">ชื่อสินค้า</div>
                  <div className="px-3 py-2 flex-1">
                    <span className="font-thai text-gray-900 text-sm font-semibold">{editingReceipt.product_sku?.sku_name || '-'}</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 divide-x divide-gray-200">
                  <div className="divide-y divide-gray-200">
                    <div className="flex">
                      <div className="bg-gray-50 px-3 py-2 w-24 font-medium text-gray-600 text-xs font-thai border-r border-gray-200">ใบสั่งผลิต</div>
                      <div className="px-3 py-2 flex-1">
                        <span className="font-mono font-bold text-blue-600 text-sm">{editingReceipt.production_order?.production_no || '-'}</span>
                      </div>
                    </div>
                    <div className="flex">
                      <div className="bg-gray-50 px-3 py-2 w-24 font-medium text-gray-600 text-xs font-thai border-r border-gray-200">รหัสสินค้า</div>
                      <div className="px-3 py-2 flex-1">
                        <span className="font-mono text-gray-700 text-sm">{editingReceipt.product_sku_id}</span>
                      </div>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-200">
                    <div className="flex">
                      <div className="bg-gray-50 px-3 py-2 w-20 font-medium text-gray-600 text-xs font-thai border-r border-gray-200">MFG</div>
                      <div className="px-3 py-2 flex-1">
                        <span className="font-thai text-gray-900 text-sm font-semibold">
                          {editingReceipt.production_order?.production_date 
                            ? new Date(editingReceipt.production_order.production_date).toLocaleDateString('th-TH')
                            : '-'
                          }
                        </span>
                      </div>
                    </div>
                    <div className="flex">
                      <div className="bg-gray-50 px-3 py-2 w-20 font-medium text-gray-600 text-xs font-thai border-r border-gray-200">EXP</div>
                      <div className="px-3 py-2 flex-1">
                        <span className="font-thai text-gray-900 text-sm font-semibold">
                          {editingReceipt.production_order?.expiry_date 
                            ? new Date(editingReceipt.production_order.expiry_date).toLocaleDateString('th-TH')
                            : '-'
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-200">
                    <div className="flex">
                      <div className="bg-blue-50 px-3 py-2 w-20 font-medium text-blue-600 text-xs font-thai border-r border-blue-200">สั่งผลิต</div>
                      <div className="px-3 py-2 flex-1 bg-blue-50/50">
                        <span className="font-bold text-blue-700 text-sm">{editingReceipt.production_order?.quantity?.toLocaleString() || '-'}</span>
                      </div>
                    </div>
                    <div className="flex">
                      <div className="bg-green-50 px-3 py-2 w-20 font-medium text-green-600 text-xs font-thai border-r border-green-200">ผลิตแล้ว</div>
                      <div className="px-3 py-2 flex-1 bg-green-50/50">
                        <span className="font-bold text-green-700 text-sm">{editingReceipt.production_order?.produced_qty?.toLocaleString() || '-'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* BOM Items Table for Edit */}
              {editBomItems.length > 0 && (
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
                          <th className="px-3 py-2 text-center font-semibold text-gray-600 border-b border-r text-xs font-thai">เบิกแล้ว</th>
                          <th className="px-3 py-2 text-center font-semibold text-gray-600 border-b border-r text-xs font-thai">หน่วย</th>
                          <th className="px-3 py-2 text-center font-semibold text-gray-600 border-b text-xs font-thai">ใช้จริง</th>
                        </tr>
                      </thead>
                      <tbody>
                        {editBomItems.map((item, index) => (
                          <tr key={item.id} className={`${item.is_food ? 'bg-amber-50' : 'bg-white'} hover:bg-gray-50`}>
                            <td className="px-3 py-2 border-b border-r text-center text-gray-500">{index + 1}</td>
                            <td className="px-3 py-2 border-b border-r font-mono text-xs">{item.material_sku_id}</td>
                            <td className="px-3 py-2 border-b border-r font-thai text-xs">
                              {item.material_name}
                              {item.is_food && (
                                <span className="ml-2 px-1.5 py-0.5 bg-amber-200 text-amber-800 text-[10px] rounded font-thai">อาหาร</span>
                              )}
                            </td>
                            <td className="px-3 py-2 border-b border-r text-center text-green-600 font-bold">{item.issued_qty.toLocaleString()}</td>
                            <td className="px-3 py-2 border-b border-r text-center text-gray-500 text-xs">{item.uom}</td>
                            <td className="px-3 py-2 border-b text-center">
                              <input
                                type="number"
                                value={item.actual_qty || ''}
                                onChange={(e) => handleEditBomActualQtyChange(item.id, e.target.value)}
                                placeholder={item.issued_qty.toString()}
                                className="w-20 px-2 py-1 border border-gray-300 rounded text-center text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                min="0"
                                step="1"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Input Form Table */}
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <div className="bg-amber-100 px-4 py-2 border-b border-gray-300">
                  <h3 className="font-semibold text-amber-800 font-thai text-sm">ข้อมูลสินค้าสำเร็จรูป</h3>
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
                          value={editForm.actual_qty}
                          onChange={(e) => setEditForm({ ...editForm, actual_qty: e.target.value })}
                          placeholder="กรอกจำนวน"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-base font-bold"
                          min="0"
                          step="1"
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
                          value={editForm.lot_no}
                          onChange={(e) => setEditForm({ ...editForm, lot_no: e.target.value })}
                          placeholder="เช่น LOT-202512-001"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
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
                          value={editForm.batch_no}
                          onChange={(e) => setEditForm({ ...editForm, batch_no: e.target.value })}
                          placeholder="เช่น BATCH-001"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        />
                      </td>
                    </tr>
                    <tr>
                      <td className="bg-gray-50 px-4 py-3 font-medium text-gray-600 font-thai border-r align-top">
                        หมายเหตุ
                      </td>
                      <td className="px-4 py-2">
                        <textarea
                          value={editForm.remarks}
                          onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })}
                          placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)..."
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none"
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
                onClick={() => { setShowEditModal(false); setEditingReceipt(null); setEditBomItems([]); }} 
                disabled={submitting}
                className="px-6"
              >
                ยกเลิก
              </Button>
              <Button 
                variant="primary" 
                icon={Check} 
                onClick={handleSubmitEdit} 
                disabled={submitting || !editForm.actual_qty}
                className="px-6 bg-amber-600 hover:bg-amber-700"
              >
                {submitting ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
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
