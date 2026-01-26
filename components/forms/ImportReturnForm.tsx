'use client';

import React, { useState, useRef, useMemo } from 'react';
import { Upload, FileSpreadsheet, X, AlertCircle, CheckCircle, Loader2, Trash2, Calendar, Save } from 'lucide-react';
import * as XLSX from 'xlsx';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import ComboBox from '@/components/ui/ComboBox';
import { useWarehouses, useCustomers, useSkus, useLocations, useEmployees } from '@/hooks/useFormOptions';
import { useAuth } from '@/hooks/useAuth';

// Excel column mapping based on "แบบฟอร์มรับเข้า PR.xlsx"
// Columns: วันที่, คลัง, เครดิต/เงินสด, เลขที่ใบสั่งส่ง, รหัสลูกค้า/ผู้ขาย, ชื่อร้านค้า, จังหวัด, 
//          รหัสสินค้า, ชื่อสินค้า, ขนาด (กก.), จำนวน, น้ำหนัก, จำนวนแพ็ครวม, ...

// Interface สำหรับแบ่งจำนวนตามวันหมดอายุ
interface ExpirySplit {
  id: string;
  expiryDate: string;
  quantity: number;
}

interface ParsedReturnItem {
  rowIndex: number;
  date: string;
  warehouse: string;
  creditType: string;
  referenceDoc: string;
  customerId: string;
  customerName: string;
  province: string;
  skuId: string;
  skuName: string;
  sizeKg: number;
  quantity: number; // จำนวน (ติดลบ = คืน)
  weight: number;
  packQuantity: number;
  // Validation
  isValid: boolean;
  errors: string[];
  // Resolved values
  resolvedSkuId?: string;
  resolvedCustomerId?: string;
  resolvedWarehouseId?: string;
  // Expiry date splits - สำหรับแบ่งจำนวนตามวันหมดอายุ
  expirySplits: ExpirySplit[];
  // Location - สถานที่รับสินค้า
  locationId: string;
}

interface GroupedReturn {
  referenceDoc: string;
  customerId: string;
  customerName: string;
  warehouseId: string;
  receiveDate: string;
  items: ParsedReturnItem[];
  // User input fields (not in Excel)
  expiryDate: string;
  locationId: string;
  notes: string;
}

interface ImportReturnFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const ImportReturnForm: React.FC<ImportReturnFormProps> = ({ isOpen, onClose, onSuccess }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedReturnItem[]>([]);
  const [groupedData, setGroupedData] = useState<GroupedReturn[]>([]);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [step, setStep] = useState<'upload' | 'review' | 'complete'>('upload');
  const [saveResults, setSaveResults] = useState<{ success: number; failed: number; errors: string[] }>({ success: 0, failed: 0, errors: [] });

  // Form options
  const { warehouses } = useWarehouses();
  const { customers, loading: customersLoading } = useCustomers();
  const { skus } = useSkus();
  const { employees } = useEmployees();
  const { user: currentUser } = useAuth();

  // Debug: log customers count
  console.log('[ImportReturnForm] customers loaded:', customers.length, 'loading:', customersLoading);

  // Get default warehouse
  const defaultWarehouseId = warehouses.length > 0 ? warehouses[0].warehouse_id : 'WH01';

  // Get locations for Return area
  const { locations } = useLocations(defaultWarehouseId);
  const returnLocation = locations.find(loc => loc.location_id === 'Return');

  // Parse Excel date (Excel serial number or string)
  const parseExcelDate = (value: any): string => {
    if (!value) return '';
    
    // If it's a number (Excel serial date)
    if (typeof value === 'number') {
      const date = new Date((value - 25569) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    }
    
    // If it's a string like "07 01 2026 " or "07/01/2026"
    if (typeof value === 'string') {
      const trimmed = value.trim();
      
      // Format: "DD MM YYYY" or "DD/MM/YYYY"
      const parts = trimmed.split(/[\s\/\-]+/);
      if (parts.length >= 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        let year = parts[2];
        
        // Handle 2-digit year
        if (year.length === 2) {
          year = '20' + year;
        }
        
        return `${year}-${month}-${day}`;
      }
    }
    
    return '';
  };

  // Find SKU by ID or name
  const findSku = (skuId: string, skuName: string): string | undefined => {
    // Try exact match on sku_id first
    const exactMatch = skus.find(s => s.sku_id === skuId);
    if (exactMatch) return exactMatch.sku_id;

    // Try partial match on sku_id
    const partialMatch = skus.find(s => 
      s.sku_id.toLowerCase().includes(skuId.toLowerCase()) ||
      skuId.toLowerCase().includes(s.sku_id.toLowerCase())
    );
    if (partialMatch) return partialMatch.sku_id;

    // Try match on sku_name
    const nameMatch = skus.find(s => 
      s.sku_name?.toLowerCase().includes(skuName.toLowerCase())
    );
    if (nameMatch) return nameMatch.sku_id;

    return undefined;
  };

  // Find customer by ID or name
  const findCustomer = (customerId: string, customerName: string): string | undefined => {
    const trimmedId = customerId.trim();
    const trimmedName = customerName.trim().toLowerCase();
    
    // Try exact match on customer_id (case-insensitive)
    const exactMatch = customers.find(c => 
      c.customer_id?.trim().toLowerCase() === trimmedId.toLowerCase()
    );
    if (exactMatch) return exactMatch.customer_id;

    // Try partial match on customer_id
    const partialIdMatch = customers.find(c => 
      c.customer_id?.trim().toLowerCase().includes(trimmedId.toLowerCase())
    );
    if (partialIdMatch) return partialIdMatch.customer_id;

    // Try match on customer_name
    if (trimmedName) {
      const nameMatch = customers.find(c => 
        c.customer_name?.toLowerCase().includes(trimmedName)
      );
      if (nameMatch) return nameMatch.customer_id;
    }

    return undefined;
  };

  // Find warehouse by name
  const findWarehouse = (warehouseName: string): string | undefined => {
    const match = warehouses.find(w => 
      w.warehouse_name?.toLowerCase().includes(warehouseName.toLowerCase()) ||
      w.warehouse_id?.toLowerCase().includes(warehouseName.toLowerCase())
    );
    return match?.warehouse_id || defaultWarehouseId;
  };

  // Handle file selection
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      '.xlsx',
      '.xls'
    ];
    
    if (!validTypes.some(type => selectedFile.type === type || selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls'))) {
      setParseError('กรุณาเลือกไฟล์ Excel (.xlsx หรือ .xls)');
      return;
    }

    // Check if customers are loaded
    if (customersLoading || customers.length === 0) {
      setParseError('กรุณารอสักครู่ ระบบกำลังโหลดข้อมูลลูกค้า...');
      return;
    }

    setFile(selectedFile);
    setParseError(null);
    setParsing(true);

    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      // Skip header row (index 0)
      const dataRows = jsonData.slice(1).filter(row => row.length > 0 && row[0]);

      const parsed: ParsedReturnItem[] = [];

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const errors: string[] = [];

        // Parse columns based on template
        const date = parseExcelDate(row[0]);
        const warehouse = String(row[1] || '').trim();
        const creditType = String(row[2] || '').trim();
        const referenceDoc = String(row[3] || '').trim();
        const customerId = String(row[4] || '').trim();
        const customerName = String(row[5] || '').trim();
        const province = String(row[6] || '').trim();
        const skuId = String(row[7] || '').trim();
        const skuName = String(row[8] || '').trim();
        const sizeKg = parseFloat(row[9]) || 0;
        const quantity = parseFloat(row[10]) || 0;
        const weight = parseFloat(row[11]) || 0;
        const packQuantity = parseFloat(row[12]) || 0;

        // Skip rows with positive quantity (not returns)
        if (quantity >= 0) continue;

        // Resolve SKU - ไม่บังคับ ถ้าไม่พบก็ใช้ค่าจาก Excel
        const resolvedSkuId = findSku(skuId, skuName) || skuId;

        // Resolve Customer - ไม่บังคับ ถ้าไม่พบก็ใช้ค่าจาก Excel
        const resolvedCustomerId = findCustomer(customerId, customerName) || customerId;

        // Resolve Warehouse
        const resolvedWarehouseId = findWarehouse(warehouse);

        const absQuantity = Math.abs(quantity);
        parsed.push({
          rowIndex: i + 2, // +2 because we skip header and 0-indexed
          date,
          warehouse,
          creditType,
          referenceDoc,
          customerId,
          customerName,
          province,
          skuId,
          skuName,
          sizeKg,
          quantity: absQuantity, // Convert to positive
          weight: Math.abs(weight),
          packQuantity: Math.abs(packQuantity),
          isValid: errors.length === 0,
          errors,
          resolvedSkuId,
          resolvedCustomerId,
          resolvedWarehouseId,
          // Initialize with one expiry split containing all quantity
          expirySplits: [{ id: `${i}-0`, expiryDate: '', quantity: absQuantity }],
          // Default location
          locationId: 'Return',
        });
      }

      if (parsed.length === 0) {
        setParseError('ไม่พบข้อมูลสินค้าคืนในไฟล์ (จำนวนต้องเป็นค่าติดลบ)');
        setParsing(false);
        return;
      }

      setParsedData(parsed);

      // Group by reference_doc
      const grouped = groupByReferenceDoc(parsed);
      setGroupedData(grouped);
      setStep('review');

    } catch (error) {
      console.error('Error parsing Excel:', error);
      setParseError('เกิดข้อผิดพลาดในการอ่านไฟล์ Excel');
    } finally {
      setParsing(false);
    }
  };

  // Group items by reference document
  const groupByReferenceDoc = (items: ParsedReturnItem[]): GroupedReturn[] => {
    const groups: Record<string, GroupedReturn> = {};

    items.forEach(item => {
      const key = item.referenceDoc || 'NO_REF';
      
      if (!groups[key]) {
        groups[key] = {
          referenceDoc: item.referenceDoc,
          customerId: item.resolvedCustomerId || item.customerId,
          customerName: item.customerName,
          warehouseId: item.resolvedWarehouseId || defaultWarehouseId,
          receiveDate: item.date || new Date().toISOString().split('T')[0],
          items: [],
          // User must fill these
          expiryDate: '',
          locationId: 'Return',
          notes: '',
        };
      }

      groups[key].items.push(item);
    });

    return Object.values(groups);
  };

  // Update group field
  const updateGroupField = (index: number, field: keyof GroupedReturn, value: string) => {
    setGroupedData(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Remove group
  const removeGroup = (index: number) => {
    setGroupedData(prev => prev.filter((_, i) => i !== index));
  };

  // Update expiry split for a specific item
  const updateExpirySplit = (itemIndex: number, splitIndex: number, field: 'expiryDate' | 'quantity', value: string | number) => {
    setParsedData(prev => {
      const updated = [...prev];
      const item = { ...updated[itemIndex] };
      const splits = [...item.expirySplits];
      splits[splitIndex] = { ...splits[splitIndex], [field]: value };
      item.expirySplits = splits;
      updated[itemIndex] = item;
      return updated;
    });
  };

  // Add new expiry split to an item
  const addExpirySplit = (itemIndex: number) => {
    setParsedData(prev => {
      const updated = [...prev];
      const item = { ...updated[itemIndex] };
      const newId = `${itemIndex}-${item.expirySplits.length}`;
      item.expirySplits = [...item.expirySplits, { id: newId, expiryDate: '', quantity: 0 }];
      updated[itemIndex] = item;
      return updated;
    });
  };

  // Remove expiry split from an item
  const removeExpirySplit = (itemIndex: number, splitIndex: number) => {
    setParsedData(prev => {
      const updated = [...prev];
      const item = { ...updated[itemIndex] };
      if (item.expirySplits.length > 1) {
        item.expirySplits = item.expirySplits.filter((_, i) => i !== splitIndex);
        updated[itemIndex] = item;
      }
      return updated;
    });
  };

  // Check if expiry splits quantity matches total quantity
  const getExpirySplitStatus = (item: ParsedReturnItem): { valid: boolean; total: number } => {
    const total = item.expirySplits.reduce((sum, split) => sum + (split.quantity || 0), 0);
    return { valid: total === item.quantity, total };
  };

  // Update location for a specific item
  const updateItemLocation = (itemIndex: number, locationId: string) => {
    setParsedData(prev => {
      const updated = [...prev];
      updated[itemIndex] = { ...updated[itemIndex], locationId };
      return updated;
    });
  };

  // Validate all groups before save - ไม่บังคับอะไรแล้ว
  const validateGroups = (): boolean => {
    return true;
  };

  // Save all returns
  const handleSave = async () => {

    // Check expiry splits validation
    for (const item of parsedData) {
      const status = getExpirySplitStatus(item);
      if (!status.valid) {
        alert(`แถว ${item.rowIndex}: จำนวนรวมของวันหมดอายุ (${status.total}) ไม่ตรงกับจำนวนทั้งหมด (${item.quantity})`);
        return;
      }
    }

    setSaving(true);
    const results = { success: 0, failed: 0, errors: [] as string[] };

    for (const group of groupedData) {
      try {
        // Flatten items with expiry splits - each split becomes a separate item
        const flattenedItems: any[] = [];
        for (const item of group.items) {
          for (const split of item.expirySplits) {
            if (split.quantity > 0) {
              const weightPerPiece = item.weight ? item.weight / item.quantity : item.sizeKg;
              flattenedItems.push({
                sku_id: item.resolvedSkuId,
                product_name: item.skuName,
                piece_quantity: split.quantity,
                pack_quantity: Math.ceil(split.quantity),
                weight_kg: weightPerPiece * split.quantity,
                expiry_date: split.expiryDate || undefined,
                location_id: item.locationId || 'Return', // ใช้ location จากแต่ละ item
                pallet_scan_status: 'ไม่จำเป็น',
              });
            }
          }
        }

        const response = await fetch('/api/receive/import-return', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            receive_type: 'รับสินค้าตีกลับ',
            reference_doc: group.referenceDoc,
            customer_id: group.customerId,
            warehouse_id: group.warehouseId,
            receive_date: group.receiveDate,
            received_by: currentUser?.employee_id,
            status: 'รับเข้าแล้ว',
            notes: group.notes || `นำเข้าจากไฟล์ Excel - ${file?.name}`,
            items: flattenedItems,
          }),
        });

        const result = await response.json();

        if (result.success) {
          results.success++;
        } else {
          results.failed++;
          results.errors.push(`${group.referenceDoc}: ${result.error}`);
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`${group.referenceDoc}: ${error}`);
      }
    }

    setSaveResults(results);
    setSaving(false);
    setStep('complete');

    if (results.success > 0) {
      onSuccess?.();
    }
  };

  // Reset form
  const handleReset = () => {
    setFile(null);
    setParsedData([]);
    setGroupedData([]);
    setParseError(null);
    setStep('upload');
    setSaveResults({ success: 0, failed: 0, errors: [] });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Count valid/invalid items
  const validCount = parsedData.filter(item => item.isValid).length;
  const invalidCount = parsedData.filter(item => !item.isValid).length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="นำเข้าสินค้าคืน (Import Return)"
      size="full"
    >
      <div className="space-y-4">
        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-800 mb-2">คำแนะนำ</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• ใช้ไฟล์ตามรูปแบบ "แบบฟอร์มรับเข้า PR.xlsx"</li>
                <li>• ระบบจะนำเข้าเฉพาะรายการที่มี<strong>จำนวนติดลบ</strong> (สินค้าคืน)</li>
                <li>• สามารถกรอก<strong>วันหมดอายุ</strong>เพิ่มเติมหลังนำเข้า (ไม่บังคับ)</li>
              </ul>
            </div>

            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                parsing ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
              }`}
              onClick={() => !parsing && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />

              {parsing ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                  <p className="text-blue-600 font-medium">กำลังอ่านไฟล์...</p>
                </div>
              ) : file ? (
                <div className="flex flex-col items-center">
                  <FileSpreadsheet className="w-12 h-12 text-green-500 mb-4" />
                  <p className="text-green-600 font-medium">{file.name}</p>
                  <p className="text-sm text-gray-500 mt-1">คลิกเพื่อเลือกไฟล์ใหม่</p>
                </div>
              ) : (
                <div className="flex flex-col items-center cursor-pointer">
                  <Upload className="w-12 h-12 text-gray-400 mb-4" />
                  <p className="text-gray-600 font-medium">คลิกเพื่อเลือกไฟล์ Excel</p>
                  <p className="text-sm text-gray-400 mt-1">รองรับ .xlsx และ .xls</p>
                </div>
              )}
            </div>

            {parseError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-red-700">{parseError}</p>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Review - Excel Style Table */}
        {step === 'review' && (
          <div className="space-y-3">
            {/* Summary Bar */}
            <div className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-gray-600">
                  ไฟล์: <span className="font-medium text-gray-800">{file?.name}</span>
                </span>
                <span className="text-green-600 font-medium">
                  ✓ {validCount} รายการ
                </span>
                {invalidCount > 0 && (
                  <span className="text-red-600 font-medium">
                    ✗ {invalidCount} มีปัญหา
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500">
                กรอกวันหมดอายุและจำนวนในแต่ละแถว (สามารถแบ่งหลายวันหมดอายุได้)
              </div>
            </div>

            {/* Excel-Style Table */}
            <div className="border border-gray-300 rounded-lg overflow-hidden overflow-x-auto">
              <div className="max-h-[600px] overflow-y-auto" style={{ minWidth: '1200px' }}>
                <table className="w-full text-[11px] border-collapse min-w-[1200px]">
                  <thead className="bg-green-600 text-white sticky top-0 z-10">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium border-r border-green-500 w-8">#</th>
                      <th className="px-2 py-1.5 text-left font-medium border-r border-green-500 min-w-[80px]">วันที่</th>
                      <th className="px-2 py-1.5 text-left font-medium border-r border-green-500 min-w-[90px]">เลขอ้างอิง</th>
                      <th className="px-2 py-1.5 text-left font-medium border-r border-green-500 min-w-[70px]">รหัสลูกค้า</th>
                      <th className="px-2 py-1.5 text-left font-medium border-r border-green-500 min-w-[100px]">ชื่อลูกค้า</th>
                      <th className="px-2 py-1.5 text-left font-medium border-r border-green-500 min-w-[100px]">รหัส SKU</th>
                      <th className="px-2 py-1.5 text-left font-medium border-r border-green-500 min-w-[150px]">ชื่อสินค้า</th>
                      <th className="px-2 py-1.5 text-right font-medium border-r border-green-500 w-16">จำนวน</th>
                      <th className="px-2 py-1.5 text-center font-medium border-r border-green-500 min-w-[120px]">สถานที่รับสินค้า *</th>
                      <th className="px-2 py-1.5 text-center font-medium border-r border-green-500 min-w-[280px]">วันหมดอายุ / จำนวน (แบ่งได้หลายวัน)</th>
                      <th className="px-2 py-1.5 text-center font-medium w-16">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.map((item, index) => {
                      const splitStatus = getExpirySplitStatus(item);
                      return (
                      <tr 
                        key={index} 
                        className={`
                          ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                          ${!item.isValid ? 'bg-red-50' : ''}
                          hover:bg-blue-50 transition-colors
                        `}
                      >
                        <td className="px-2 py-1 border-r border-gray-200 text-gray-500 text-center align-top">
                          {item.rowIndex}
                        </td>
                        <td className="px-2 py-1 border-r border-gray-200 font-mono align-top">
                          {item.date}
                        </td>
                        <td className="px-2 py-1 border-r border-gray-200 font-mono font-medium text-blue-600 align-top">
                          {item.referenceDoc || '-'}
                        </td>
                        <td className="px-2 py-1 border-r border-gray-200 font-mono align-top">
                          {item.resolvedCustomerId ? (
                            <span className="text-green-700">{item.customerId}</span>
                          ) : (
                            <span className="text-red-500">{item.customerId}</span>
                          )}
                        </td>
                        <td className="px-2 py-1 border-r border-gray-200 truncate max-w-[100px] align-top" title={item.customerName}>
                          {item.customerName}
                        </td>
                        <td className="px-2 py-1 border-r border-gray-200 font-mono align-top">
                          {item.resolvedSkuId ? (
                            <span className="text-green-700 font-medium">{item.resolvedSkuId}</span>
                          ) : (
                            <span className="text-red-500">{item.skuId}</span>
                          )}
                        </td>
                        <td className="px-2 py-1 border-r border-gray-200 truncate max-w-[150px] align-top" title={item.skuName}>
                          {item.skuName}
                        </td>
                        <td className="px-2 py-1 border-r border-gray-200 text-right font-mono font-bold text-blue-600 align-top">
                          {item.quantity.toLocaleString()}
                        </td>
                        {/* Location Column */}
                        <td className="px-2 py-1 border-r border-gray-200 align-top">
                          <select
                            className="px-1 py-0.5 text-[10px] border border-gray-300 rounded w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={item.locationId}
                            onChange={(e) => updateItemLocation(index, e.target.value)}
                          >
                            <option value="Return">Return</option>
                            <option value="Receiving">Receiving</option>
                            <option value="Repair">Repair</option>
                            <option value="Expired">Expired</option>
                          </select>
                        </td>
                        {/* Expiry Splits Column */}
                        <td className="px-2 py-1 border-r border-gray-200">
                          <div className="space-y-1">
                            {item.expirySplits.map((split, splitIdx) => (
                              <div key={split.id} className="flex items-center gap-1">
                                <input
                                  type="date"
                                  value={split.expiryDate}
                                  onChange={(e) => updateExpirySplit(index, splitIdx, 'expiryDate', e.target.value)}
                                  className="px-1 py-0.5 text-[10px] border border-gray-300 rounded w-28 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  placeholder="วันหมดอายุ"
                                />
                                <input
                                  type="number"
                                  value={split.quantity || ''}
                                  onChange={(e) => updateExpirySplit(index, splitIdx, 'quantity', parseInt(e.target.value) || 0)}
                                  className="px-1 py-0.5 text-[10px] border border-gray-300 rounded w-14 text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  placeholder="จำนวน"
                                  min={0}
                                  max={item.quantity}
                                />
                                {item.expirySplits.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeExpirySplit(index, splitIdx)}
                                    className="text-red-500 hover:text-red-700 p-0.5"
                                    title="ลบ"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => addExpirySplit(index)}
                              className="text-[10px] text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
                            >
                              + เพิ่มวันหมดอายุ
                            </button>
                            {/* Show split total status */}
                            <div className={`text-[9px] ${splitStatus.valid ? 'text-green-600' : 'text-red-600'}`}>
                              รวม: {splitStatus.total}/{item.quantity} {splitStatus.valid ? '✓' : '✗'}
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-1 text-center align-top">
                          {item.isValid && splitStatus.valid ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700">
                              ✓ OK
                            </span>
                          ) : (
                            <span 
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700"
                              title={item.errors.join('\n')}
                            >
                              {item.errors.join(', ')}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-100 sticky bottom-0">
                    <tr className="font-semibold">
                      <td colSpan={7} className="px-2 py-1.5 text-right border-r border-gray-200">
                        รวม {parsedData.length} รายการ
                      </td>
                      <td className="px-2 py-1.5 text-right border-r border-gray-200 font-mono text-blue-700">
                        {parsedData.reduce((sum, item) => sum + item.quantity, 0).toLocaleString()}
                      </td>
                      <td className="px-2 py-1.5 text-center border-r border-gray-200">
                        -
                      </td>
                      <td className="px-2 py-1.5 text-center border-r border-gray-200">
                        -
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <span className="text-green-600">{validCount}</span>
                        {invalidCount > 0 && <span className="text-red-600">/{invalidCount}</span>}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between pt-2">
              <Button variant="secondary" size="sm" onClick={handleReset}>
                เลือกไฟล์ใหม่
              </Button>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={onClose}>
                  ยกเลิก
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSave}
                  disabled={saving || !validateGroups()}
                  icon={saving ? Loader2 : Save}
                >
                  {saving ? 'กำลังบันทึก...' : `บันทึก ${parsedData.length} รายการ`}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Complete */}
        {step === 'complete' && (
          <div className="space-y-4 text-center py-8">
            {saveResults.success > 0 && (
              <div className="flex flex-col items-center">
                <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
                <h3 className="text-xl font-semibold text-green-700">
                  นำเข้าสำเร็จ {saveResults.success} รายการ
                </h3>
              </div>
            )}

            {saveResults.failed > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-left">
                <h4 className="font-semibold text-red-700 mb-2">
                  ล้มเหลว {saveResults.failed} รายการ
                </h4>
                <ul className="text-sm text-red-600 space-y-1">
                  {saveResults.errors.map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-center gap-4 pt-4">
              <Button variant="secondary" onClick={handleReset}>
                นำเข้าเพิ่มเติม
              </Button>
              <Button variant="primary" onClick={onClose}>
                ปิด
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ImportReturnForm;
