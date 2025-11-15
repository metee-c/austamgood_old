'use client';

import React, { useState, useRef } from 'react';
import { Upload, Download, AlertCircle, CheckCircle, X, FileText } from 'lucide-react';
import Button from '@/components/ui/Button';
import { masterSkuService } from '@/lib/database/master-sku';
import { MasterSkuInsert } from '@/types/database/supabase';

interface ImportDataFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

const ImportDataForm: React.FC<ImportDataFormProps> = ({ onSuccess, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      if (!selectedFile.name.endsWith('.csv') && !selectedFile.name.endsWith('.xlsx')) {
        setError('กรุณาเลือกไฟล์ CSV หรือ Excel (.xlsx) เท่านั้น');
        return;
      }
      
      setFile(selectedFile);
      setError(null);
      setImportResult(null);
    }
  };

  const parseCSV = (csvText: string): any[] => {
    const lines = csvText.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      const row: any = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      
      data.push(row);
    }
    
    return data;
  };

  const mapRowToMasterSku = (row: any): MasterSkuInsert => {
    return {
      sku_id: row['รหัส SKU'] || row['sku_id'] || '',
      sku_name: row['ชื่อสินค้า'] || row['sku_name'] || '',
      sku_description: row['รายละเอียด'] || row['description'] || undefined,
      category: row['หมวดหมู่'] || row['category'] || undefined,
      sub_category: row['หมวดหมู่ย่อย'] || row['sub_category'] || undefined,
      brand: row['แบรนด์'] || row['brand'] || undefined,
      product_type: row['ประเภท'] || row['product_type'] || undefined,
      uom_base: row['หน่วย'] || row['uom_base'] || 'ชิ้น',
      qty_per_pack: parseInt(row['จำนวน/แพ็ค'] || row['qty_per_pack'] || '1'),
      qty_per_pallet: row['จำนวน/พาเลท'] || row['qty_per_pallet'] ? parseInt(row['จำนวน/พาเลท'] || row['qty_per_pallet']) : undefined,
      weight_per_piece_kg: row['น้ำหนัก/ชิ้น'] || row['weight_per_piece_kg'] ? parseFloat(row['น้ำหนัก/ชิ้น'] || row['weight_per_piece_kg']) : undefined,
      weight_per_pack_kg: row['น้ำหนัก/แพ็ค'] || row['weight_per_pack_kg'] ? parseFloat(row['น้ำหนัก/แพ็ค'] || row['weight_per_pack_kg']) : undefined,
      weight_per_pallet_kg: row['น้ำหนัก/พาเลท'] || row['weight_per_pallet_kg'] ? parseFloat(row['น้ำหนัก/พาเลท'] || row['weight_per_pallet_kg']) : undefined,
      dimension_length_cm: row['ความยาว'] || row['dimension_length_cm'] ? parseFloat(row['ความยาว'] || row['dimension_length_cm']) : undefined,
      dimension_width_cm: row['ความกว้าง'] || row['dimension_width_cm'] ? parseFloat(row['ความกว้าง'] || row['dimension_width_cm']) : undefined,
      dimension_height_cm: row['ความสูง'] || row['dimension_height_cm'] ? parseFloat(row['ความสูง'] || row['dimension_height_cm']) : undefined,
      barcode: row['บาร์โค้ด'] || row['barcode'] || undefined,
      pack_barcode: row['บาร์โค้ดแพ็ค'] || row['pack_barcode'] || undefined,
      pallet_barcode: row['บาร์โค้ดพาเลท'] || row['pallet_barcode'] || undefined,
      storage_condition: row['เงื่อนไขเก็บ'] || row['storage_condition'] || 'อุณหภูมิห้อง',
      shelf_life_days: row['อายุ(วัน)'] || row['shelf_life_days'] ? parseInt(row['อายุ(วัน)'] || row['shelf_life_days']) : undefined,
      lot_tracking_required: (row['ติดตาม Lot'] || row['lot_tracking_required'] || '').toLowerCase() === 'true' || (row['ติดตาม Lot'] || row['lot_tracking_required'] || '').toLowerCase() === 'ใช่',
      expiry_date_required: (row['บันทึกวันหมดอายุ'] || row['expiry_date_required'] || '').toLowerCase() === 'true' || (row['บันทึกวันหมดอายุ'] || row['expiry_date_required'] || '').toLowerCase() === 'ใช่',
      reorder_point: parseInt(row['จุดสั่งซื้อ'] || row['reorder_point'] || '0'),
      safety_stock: parseInt(row['สต็อกปลอดภัย'] || row['safety_stock'] || '0'),
      default_location: row['Location'] || row['default_location'] || undefined,
      created_by: 'admin', // TODO: Get from auth context
      status: (row['สถานะ'] || row['status'] || 'active') === 'ใช้งาน' || (row['สถานะ'] || row['status'] || 'active') === 'active' ? 'active' : 'inactive'
    };
  };

  const handleImport = async () => {
    if (!file) {
      setError('กรุณาเลือกไฟล์');
      return;
    }

    setLoading(true);
    setError(null);
    setImportResult(null);

    try {
      const fileText = await file.text();
      const data = parseCSV(fileText);
      
      if (data.length === 0) {
        throw new Error('ไม่พบข้อมูลในไฟล์');
      }

      const results: ImportResult = {
        success: 0,
        failed: 0,
        errors: []
      };

      // Process each row
      for (let i = 0; i < data.length; i++) {
        try {
          const row = data[i];
          const masterSku = mapRowToMasterSku(row);
          
          // Validate required fields
          if (!masterSku.sku_id || !masterSku.sku_name || !masterSku.uom_base) {
            throw new Error(`แถวที่ ${i + 2}: ข้อมูลไม่ครบถ้วน (ต้องมี รหัส SKU, ชื่อสินค้า, หน่วย)`);
          }

          const { error } = await masterSkuService.createMasterSku(masterSku);
          
          if (error) {
            throw new Error(`แถวที่ ${i + 2}: ${error}`);
          }

          results.success++;
        } catch (err) {
          results.failed++;
          results.errors.push(err instanceof Error ? err.message : `แถวที่ ${i + 2}: เกิดข้อผิดพลาด`);
        }
      }

      setImportResult(results);
      
      if (results.success > 0) {
        setTimeout(() => {
          onSuccess();
        }, 2000);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการนำเข้าข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const headers = [
      'รหัส SKU',
      'ชื่อสินค้า',
      'รายละเอียด',
      'หมวดหมู่',
      'หมวดหมู่ย่อย',
      'แบรนด์',
      'ประเภท',
      'หน่วย',
      'จำนวน/แพ็ค',
      'จำนวน/พาเลท',
      'น้ำหนัก/ชิ้น',
      'น้ำหนัก/แพ็ค',
      'น้ำหนัก/พาเลท',
      'ความยาว',
      'ความกว้าง',
      'ความสูง',
      'บาร์โค้ด',
      'บาร์โค้ดแพ็ค',
      'บาร์โค้ดพาเลท',
      'เงื่อนไขเก็บ',
      'อายุ(วัน)',
      'ติดตาม Lot',
      'บันทึกวันหมดอายุ',
      'จุดสั่งซื้อ',
      'สต็อกปลอดภัย',
      'Location',
      'สถานะ'
    ];

    const sampleData = [
      'CAT001',
      'อาหารแมว วิสกัส ปลาทูน่า 400กรัม',
      'อาหารแมวเปียกรสปลาทูน่า สำหรับแมวโตทุกสายพันธุ์',
      'อาหารสัตว์',
      'อาหารแมว',
      'Whiskas',
      'อาหารแมวเปียก',
      'กระป๋อง',
      '24',
      '480',
      '0.400',
      '9.600',
      '192.000',
      '7.50',
      '7.50',
      '3.20',
      '8850124042261',
      '8850124042261-24',
      '',
      'อุณหภูมิห้อง',
      '1095',
      'ใช่',
      'ใช่',
      '100',
      '50',
      'A-01-001',
      'ใช้งาน'
    ];

    const csvContent = [headers.join(','), sampleData.join(',')].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'master_sku_template.csv';
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 font-thai mb-2">คำแนะนำการนำเข้าข้อมูล</h4>
        <ul className="text-sm text-blue-800 font-thai space-y-1">
          <li>• รองรับไฟล์ CSV เท่านั้น</li>
          <li>• ต้องมีคอลัมน์: รหัส SKU, ชื่อสินค้า, หน่วย</li>
          <li>• ดาวน์โหลดไฟล์ตัวอย่างเพื่อดูรูปแบบที่ถูกต้อง</li>
          <li>• รหัส SKU ต้องไม่ซ้ำกัน</li>
        </ul>
      </div>

      {/* Download Template */}
      <div className="flex justify-between items-center">
        <h4 className="text-md font-medium text-thai-gray-900 font-thai">
          1. ดาวน์โหลดไฟล์ตัวอย่าง
        </h4>
        <Button
          variant="outline"
          onClick={downloadTemplate}
          icon={Download}
          size="sm"
        >
          ดาวน์โหลดตัวอย่าง
        </Button>
      </div>

      {/* File Upload */}
      <div>
        <h4 className="text-md font-medium text-thai-gray-900 font-thai mb-3">
          2. เลือกไฟล์ที่ต้องการนำเข้า
        </h4>
        
        <div className="border-2 border-dashed border-thai-gray-300 rounded-lg p-6">
          <div className="text-center">
            <FileText className="w-12 h-12 text-thai-gray-400 mx-auto mb-4" />
            
            {file ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-thai-gray-900 font-thai">
                  ไฟล์ที่เลือก: {file.name}
                </p>
                <p className="text-xs text-thai-gray-500">
                  ขนาด: {(file.size / 1024).toFixed(2)} KB
                </p>
                <button
                  onClick={() => setFile(null)}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  เลือกไฟล์ใหม่
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-thai-gray-600 font-thai">
                  วางไฟล์ที่นี่ หรือคลิกเพื่อเลือกไฟล์
                </p>
                <p className="text-xs text-thai-gray-500">
                  รองรับ CSV เท่านั้น
                </p>
              </div>
            )}
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            {!file && (
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                icon={Upload}
                className="mt-3"
              >
                เลือกไฟล์
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
            <p className="text-red-600 text-sm font-thai">{error}</p>
          </div>
        </div>
      )}

      {/* Import Result */}
      {importResult && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center mb-3">
            <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
            <h4 className="font-medium text-green-900 font-thai">ผลการนำเข้าข้อมูล</h4>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div>
              <p className="text-sm text-green-800 font-thai">
                สำเร็จ: <span className="font-bold">{importResult.success}</span> รายการ
              </p>
            </div>
            <div>
              <p className="text-sm text-red-800 font-thai">
                ไม่สำเร็จ: <span className="font-bold">{importResult.failed}</span> รายการ
              </p>
            </div>
          </div>

          {importResult.errors.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-medium text-red-800 font-thai mb-2">ข้อผิดพลาด:</p>
              <ul className="text-xs text-red-700 space-y-1 max-h-32 overflow-y-auto">
                {importResult.errors.slice(0, 10).map((error, index) => (
                  <li key={index} className="font-thai">• {error}</li>
                ))}
                {importResult.errors.length > 10 && (
                  <li className="font-thai">• และอีก {importResult.errors.length - 10} รายการ...</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end space-x-3 pt-6 border-t border-thai-gray-200">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={loading}
          icon={X}
        >
          ยกเลิก
        </Button>
        <Button
          variant="primary"
          onClick={handleImport}
          disabled={!file || loading}
          loading={loading}
          icon={Upload}
        >
          {loading ? 'กำลังนำเข้า...' : 'นำเข้าข้อมูล'}
        </Button>
      </div>
    </div>
  );
};

export default ImportDataForm;