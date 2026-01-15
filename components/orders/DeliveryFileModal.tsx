'use client';

import React, { useState, useRef, useCallback } from 'react';
import { X, Upload, Download, Plus, Trash2, Search, Loader2, Calendar } from 'lucide-react';
import * as XLSX from 'xlsx';
import Button from '@/components/ui/Button';

// Column definitions based on the Excel template
const COLUMNS = [
  { key: 'date', label: 'วันที่', width: 100 },
  { key: 'sequence', label: 'ลำดับ', width: 60 },
  { key: 'customer_id', label: 'รหัสลูกค้า/ผู้ขาย', width: 120 },
  { key: 'shop_name', label: 'ชื่อร้านค้า', width: 180 },
  { key: 'location_code', label: 'รหัสสถานที่', width: 100 },
  { key: 'address', label: 'ประเภทข้อความแบบยาว 1', width: 250 },
  { key: 'salesperson', label: 'พนักงานขาย', width: 100 },
  { key: 'additional_text_1', label: 'ข้อความเพิ่มเติม 1', width: 150 },
  { key: 'delivery_person', label: 'พนักงานจัดส่ง', width: 120 },
  { key: 'contact_phone', label: 'โทรศัพท์ผู้ติดต่อ', width: 140 },
  { key: 'helper', label: 'พนักงานติดรถ', width: 120 },
  { key: 'ship_date', label: 'วันที่ส่งออกจากโกดัง', width: 130 },
  { key: 'delivery_no', label: 'เลขที่ใบส่งสินค้า', width: 130 },
  { key: 'actual_receive_date', label: 'วันที่รับสินค้าจริง', width: 130 },
  { key: 'delivery_order_no', label: 'เลขที่ใบสั่งส่ง', width: 130 },
  { key: 'sales_order_no', label: 'เลขที่ใบสั่งขาย', width: 130 },
  { key: 'transport_no', label: 'เลขที่ใบขนส่งเอกชน', width: 140 },
  { key: 'invoice_no', label: 'เลขที่ใบขาย', width: 130 },
  { key: 'internal_remarks', label: 'หมายเหตุ (ภายใน)', width: 150 },
  { key: 'piece_count', label: 'จำนวนชิ้น', width: 80 },
  { key: 'doc_receive_date', label: 'วันที่ บัญชีได้รับเอกสาร', width: 150 },
  { key: 'sku_id', label: 'รหัสสินค้า', width: 140 },
  { key: 'sku_name', label: 'ชื่อสินค้า', width: 200 },
  { key: 'specification', label: 'ข้อมูลจำเพาะ', width: 100 },
  { key: 'quantity', label: 'จำนวน', width: 80 },
  { key: 'additional_text_4', label: 'ประเภทข้อความเพิ่มเติม 4', width: 150 },
];

// Map Excel header to column key
const HEADER_MAP: Record<string, string> = {
  'วันที่': 'date',
  'ลำดับ': 'sequence',
  'รหัสลูกค้า/ผู้ขาย': 'customer_id',
  'ชื่อร้านค้า': 'shop_name',
  'รหัสสถานที่': 'location_code',
  'ประเภทข้อความแบบยาว 1': 'address',
  'พนักงานขาย': 'salesperson',
  'ข้อความเพิ่มเติม 1': 'additional_text_1',
  'พนักงานจัดส่ง': 'delivery_person',
  'โทรศัพท์ผู้ติดต่อ': 'contact_phone',
  'พนักงานติดรถ': 'helper',
  'วันที่ส่งออกจากโกดัง': 'ship_date',
  'เลขที่ใบส่งสินค้า': 'delivery_no',
  'วันที่รับสินค้าจริง': 'actual_receive_date',
  'เลขที่ใบสั่งส่ง': 'delivery_order_no',
  'เลขที่ใบสั่งขาย': 'sales_order_no',
  'เลขที่ใบขนส่งเอกชน': 'transport_no',
  'เลขที่ใบขาย': 'invoice_no',
  'หมายเหตุ (ภายใน)': 'internal_remarks',
  'จำนวนชิ้น': 'piece_count',
  'วันที่ บัญชีได้รับเอกสาร': 'doc_receive_date',
  'รหัสสินค้า': 'sku_id',
  'ชื่อสินค้า': 'sku_name',
  'ข้อมูลจำเพาะ': 'specification',
  'จำนวน': 'quantity',
  'ประเภทข้อความเพิ่มเติม 4': 'additional_text_4',
};

// Convert column index to Excel-style letter
const getColumnLetter = (index: number): string => {
  let letter = '';
  let temp = index;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
};

// Format date to DD MM YYYY format
const formatDateForExcel = (dateStr: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day} ${month} ${year} `;
};

// Order type labels (Thai)
const ORDER_TYPE_LABELS: Record<string, string> = {
  route_planning: 'จัดเส้นทาง',
  express: 'ส่งรายชิ้น',
  special: 'สินค้าพิเศษ',
};

// Order type colors for display
const ORDER_TYPE_COLORS: Record<string, string> = {
  route_planning: 'bg-blue-100 text-blue-700',
  express: 'bg-orange-100 text-orange-700',
  special: 'bg-purple-100 text-purple-700',
};

type RowData = Record<string, string | number | null> & {
  _order_type?: string; // Internal field, not exported
};

interface DeliveryFileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DeliveryFileModal({ isOpen, onClose }: DeliveryFileModalProps) {
  const [data, setData] = useState<RowData[]>([]);
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [deliveryDate, setDeliveryDate] = useState<string>('');
  const [isMapping, setIsMapping] = useState(false);
  const [showShipDateModal, setShowShipDateModal] = useState(false);
  const [shipDate, setShipDate] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file upload
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

        if (jsonData.length < 2) {
          alert('ไฟล์ไม่มีข้อมูล');
          return;
        }

        const headers = jsonData[0] as string[];
        const rows: RowData[] = [];

        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          if (!row || row.length === 0) continue;

          const rowData: RowData = {};
          headers.forEach((header, idx) => {
            const key = HEADER_MAP[header] || header;
            rowData[key] = row[idx] ?? null;
          });
          rows.push(rowData);
        }

        setData(rows);
      } catch (error) {
        console.error('Error reading file:', error);
        alert('เกิดข้อผิดพลาดในการอ่านไฟล์');
      }
    };
    reader.readAsArrayBuffer(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Map orders from database
  const handleMapOrders = async () => {
    if (!deliveryDate) {
      alert('กรุณาเลือกวันส่งก่อน');
      return;
    }

    if (data.length === 0) {
      alert('กรุณานำเข้าไฟล์ Excel ก่อน');
      return;
    }

    setIsMapping(true);

    try {
      // Fetch orders from API
      const response = await fetch('/api/orders/with-items');
      if (!response.ok) throw new Error('Failed to fetch orders');
      
      const result = await response.json();
      const orders = result.data || [];

      // Get unique order numbers from Excel data (from delivery_order_no column)
      const excelOrderNos = new Set(
        data.map(row => row.delivery_order_no?.toString().trim()).filter(Boolean)
      );

      // Filter orders that match:
      // 1. Order number exists in Excel
      // 2. Delivery date matches selected date
      const selectedDate = new Date(deliveryDate).toISOString().split('T')[0];
      
      const matchedOrders = orders.filter((order: any) => {
        const orderNo = order.order_no?.toString().trim();
        const orderDeliveryDate = order.delivery_date 
          ? new Date(order.delivery_date).toISOString().split('T')[0]
          : null;
        
        return excelOrderNos.has(orderNo) && orderDeliveryDate === selectedDate;
      });

      // Create a map of order_no to order data for quick lookup
      const orderMap = new Map<string, any>();
      matchedOrders.forEach((order: any) => {
        orderMap.set(order.order_no?.toString().trim(), order);
      });

      // Get unique matched order numbers and assign sequence
      const uniqueMatchedOrderNos = [...new Set(matchedOrders.map((o: any) => o.order_no?.toString().trim()))];
      const sequenceMap = new Map<string, number>();
      uniqueMatchedOrderNos.forEach((orderNo, idx) => {
        sequenceMap.set(orderNo as string, idx + 1);
      });

      // Update data with mapped values
      let matchedRowCount = 0;
      let unmatchedRowCount = 0;
      
      const updatedData = data.map(row => {
        const orderNo = row.delivery_order_no?.toString().trim();
        const matchedOrder = orderNo ? orderMap.get(orderNo) : null;

        if (matchedOrder) {
          matchedRowCount++;
          const isExpress = matchedOrder.order_type === 'express';
          const sequence = sequenceMap.get(orderNo!) || null;
          
          return {
            ...row,
            sequence: sequence,
            // Only set actual_receive_date if NOT express type
            actual_receive_date: isExpress ? row.actual_receive_date : formatDateForExcel(matchedOrder.delivery_date),
            // Store order type for display (internal field, not exported)
            _order_type: matchedOrder.order_type || null,
          };
        }
        unmatchedRowCount++;
        return row;
      });

      setData(updatedData);

      // Show mapping result summary
      const totalExcelRows = data.length;
      const uniqueOrdersInExcel = excelOrderNos.size;
      const matchedUniqueOrders = uniqueMatchedOrderNos.length;
      
      let summaryMessage = `ผลการแมพออเดอร์:\n\n`;
      summaryMessage += `📊 ข้อมูลใน Excel: ${totalExcelRows} แถว (${uniqueOrdersInExcel} ออเดอร์)\n`;
      summaryMessage += `✅ แมพเจอ: ${matchedRowCount} แถว (${matchedUniqueOrders} ออเดอร์)\n`;
      summaryMessage += `❌ แมพไม่เจอ: ${unmatchedRowCount} แถว\n`;
      
      if (matchedRowCount === 0) {
        alert(summaryMessage + '\n⚠️ ไม่พบออเดอร์ที่ตรงกับวันส่งที่เลือก');
        return;
      }

      alert(summaryMessage);

      // Show ship date modal after mapping
      setShowShipDateModal(true);

    } catch (error) {
      console.error('Error mapping orders:', error);
      alert('เกิดข้อผิดพลาดในการแมพออเดอร์');
    } finally {
      setIsMapping(false);
    }
  };

  // Apply ship date to all matched rows
  const applyShipDate = () => {
    if (!shipDate) {
      alert('กรุณาเลือกวันที่ส่งออกจากโกดัง');
      return;
    }

    const formattedShipDate = formatDateForExcel(shipDate);
    
    // Update ship_date for rows that have sequence (matched orders)
    const updatedData = data.map(row => {
      if (row.sequence) {
        return {
          ...row,
          ship_date: formattedShipDate,
        };
      }
      return row;
    });

    setData(updatedData);
    setShowShipDateModal(false);
    setShipDate('');
  };

  // Start editing cell
  const startEdit = (rowIndex: number, colKey: string, value: any) => {
    setEditingCell({ row: rowIndex, col: colKey });
    setEditValue(value?.toString() ?? '');
  };

  // Save cell edit
  const saveEdit = () => {
    if (!editingCell) return;

    setData(prev => {
      const newData = [...prev];
      newData[editingCell.row] = {
        ...newData[editingCell.row],
        [editingCell.col]: editValue,
      };
      return newData;
    });
    setEditingCell(null);
    setEditValue('');
  };

  // Handle key press in edit mode
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveEdit();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setEditValue('');
    }
  };

  // Add new row
  const addRow = () => {
    const newRow: RowData = {};
    COLUMNS.forEach(col => {
      newRow[col.key] = null;
    });
    setData(prev => [...prev, newRow]);
  };

  // Delete row
  const deleteRow = (index: number) => {
    setData(prev => prev.filter((_, i) => i !== index));
  };

  // Export to Excel
  const exportToExcel = () => {
    if (data.length === 0) {
      alert('ไม่มีข้อมูลให้ส่งออก');
      return;
    }

    const wsData: any[][] = [];
    
    const headers = COLUMNS.map(col => {
      const thaiHeader = Object.entries(HEADER_MAP).find(([_, v]) => v === col.key)?.[0] || col.label;
      return thaiHeader;
    });
    wsData.push(headers);

    data.forEach(row => {
      const rowData = COLUMNS.map(col => row[col.key] ?? '');
      wsData.push(rowData);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'สถานะใบสั่งส่งสินค้า');
    XLSX.writeFile(wb, `ใบส่งสินค้า_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[95vw] h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">สร้างไฟล์ใบส่ง</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Toolbar Row 1: File operations */}
        <div className="flex items-center gap-2 p-3 border-b bg-gray-50 flex-shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            variant="secondary"
            size="sm"
            icon={Upload}
            onClick={() => fileInputRef.current?.click()}
          >
            นำเข้าไฟล์ Excel
          </Button>
          <Button variant="secondary" size="sm" icon={Plus} onClick={addRow}>
            เพิ่มแถว
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={Download}
            onClick={exportToExcel}
            disabled={data.length === 0}
          >
            ส่งออก Excel
          </Button>
          <span className="ml-auto text-sm text-gray-500">{data.length} แถว</span>
        </div>

        {/* Toolbar Row 2: Mapping */}
        <div className="flex items-center gap-3 p-3 border-b bg-blue-50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <label className="text-sm font-medium text-gray-700">วันส่ง (แผนส่ง):</label>
            <input
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <Button
            variant="primary"
            size="sm"
            icon={isMapping ? Loader2 : Search}
            onClick={handleMapOrders}
            disabled={isMapping || !deliveryDate || data.length === 0}
            className={isMapping ? 'animate-pulse' : ''}
          >
            {isMapping ? 'กำลังแมพ...' : 'แมพออเดอร์'}
          </Button>
        </div>

        {/* Table Container */}
        <div className="flex-1 overflow-auto p-2">
          {data.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Upload className="w-12 h-12 mb-4 text-gray-300" />
              <p className="text-lg mb-2">ยังไม่มีข้อมูล</p>
              <p className="text-sm">กดปุ่ม "นำเข้าไฟล์ Excel" เพื่อเริ่มต้น</p>
            </div>
          ) : (
            <div className="inline-block min-w-full">
              <table className="border-collapse text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-200">
                    <th className="border border-gray-300 px-1 py-0.5 text-center w-10 bg-gray-200 text-[10px] text-gray-500"></th>
                    <th className="border border-gray-300 px-2 py-0.5 text-center text-[10px] text-gray-500 bg-gray-200" style={{ minWidth: 80 }}>
                      -
                    </th>
                    {COLUMNS.map((col, idx) => (
                      <th
                        key={`letter-${col.key}`}
                        className="border border-gray-300 px-2 py-0.5 text-center text-[10px] text-gray-500 bg-gray-200"
                        style={{ minWidth: col.width }}
                      >
                        {getColumnLetter(idx)}
                      </th>
                    ))}
                    <th className="border border-gray-300 px-1 py-0.5 text-center w-10 bg-gray-200 text-[10px] text-gray-500"></th>
                  </tr>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-1 py-1 text-center w-10 bg-gray-100">#</th>
                    <th className="border border-gray-300 px-2 py-1 text-left font-medium text-gray-700 bg-yellow-100 whitespace-nowrap" style={{ minWidth: 80 }}>
                      ประเภท
                    </th>
                    {COLUMNS.map(col => (
                      <th
                        key={col.key}
                        className="border border-gray-300 px-2 py-1 text-left font-medium text-gray-700 bg-gray-100 whitespace-nowrap"
                        style={{ minWidth: col.width }}
                      >
                        {col.label}
                      </th>
                    ))}
                    <th className="border border-gray-300 px-1 py-1 text-center w-10 bg-gray-100">ลบ</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, rowIndex) => (
                    <tr key={rowIndex} className={`hover:bg-blue-50 ${row.sequence ? 'bg-green-50' : ''}`}>
                      <td className="border border-gray-300 px-1 py-0.5 text-center text-gray-500 bg-gray-50">
                        {rowIndex + 1}
                      </td>
                      <td className="border border-gray-300 px-1 py-0.5 text-center bg-yellow-50" style={{ minWidth: 80 }}>
                        {row._order_type ? (
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${ORDER_TYPE_COLORS[row._order_type] || 'bg-gray-100 text-gray-600'}`}>
                            {ORDER_TYPE_LABELS[row._order_type] || row._order_type}
                          </span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      {COLUMNS.map(col => (
                        <td
                          key={col.key}
                          className="border border-gray-300 px-0 py-0 cursor-pointer"
                          onClick={() => startEdit(rowIndex, col.key, row[col.key])}
                        >
                          {editingCell?.row === rowIndex && editingCell?.col === col.key ? (
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={saveEdit}
                              onKeyDown={handleKeyDown}
                              autoFocus
                              className="w-full px-1 py-0.5 border-2 border-blue-500 outline-none text-xs"
                              style={{ minWidth: col.width - 4 }}
                            />
                          ) : (
                            <div
                              className="px-1 py-0.5 truncate"
                              style={{ minWidth: col.width - 4 }}
                              title={row[col.key]?.toString() ?? ''}
                            >
                              {row[col.key] ?? ''}
                            </div>
                          )}
                        </td>
                      ))}
                      <td className="border border-gray-300 px-1 py-0.5 text-center">
                        <button
                          onClick={() => deleteRow(rowIndex)}
                          className="p-0.5 hover:bg-red-100 rounded text-red-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t flex-shrink-0">
          <Button variant="secondary" size="sm" onClick={onClose}>
            ปิด
          </Button>
        </div>
      </div>

      {/* Loading Overlay */}
      {isMapping && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-6 shadow-xl flex flex-col items-center">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-3" />
            <p className="text-gray-700 font-medium">กำลังแมพออเดอร์...</p>
            <p className="text-gray-500 text-sm">กรุณารอสักครู่</p>
          </div>
        </div>
      )}

      {/* Ship Date Modal */}
      {showShipDateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">วันที่ส่งออกจากโกดัง</h3>
              <button
                onClick={() => setShowShipDateModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-gray-600 mb-4">กรุณาเลือกวันที่ส่งออกจากโกดัง</p>
              <input
                type="date"
                value={shipDate}
                onChange={(e) => setShipDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <Button variant="secondary" size="sm" onClick={() => setShowShipDateModal(false)}>
                ยกเลิก
              </Button>
              <Button variant="primary" size="sm" onClick={applyShipDate} disabled={!shipDate}>
                บันทึก
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
