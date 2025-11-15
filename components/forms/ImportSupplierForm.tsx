'use client';

import React, { useState, useRef } from 'react';
import { Upload, Download, AlertCircle, CheckCircle, X, FileText, Users } from 'lucide-react';
import Button from '@/components/ui/Button';
import { CreateSupplierRequest } from '@/types/supplier';

interface ImportSupplierFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

const ImportSupplierForm: React.FC<ImportSupplierFormProps> = ({ onSuccess, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      if (!selectedFile.name.endsWith('.csv')) {
        setError('กรุณาเลือกไฟล์ CSV เท่านั้น');
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

  const generateSupplierId = (index: number) => {
    const timestamp = Date.now() + index;
    return `SUP${timestamp.toString().slice(-6)}`;
  };

  const generateSupplierCode = (type: string, index: number) => {
    const prefix = type === 'vendor' ? 'VND' : 
                   type === 'service_provider' ? 'SVC' : 'BTH';
    const timestamp = Date.now() + index;
    return `${prefix}${timestamp.toString().slice(-3)}`;
  };

  const mapRowToSupplier = (row: any, index: number): CreateSupplierRequest => {
    const supplierType = row['ประเภท'] || row['supplier_type'] || 'vendor';
    
    return {
      supplier_id: row['รหัสผู้จำหน่าย'] || row['supplier_id'] || generateSupplierId(index),
      supplier_code: row['รหัสอ้างอิง'] || row['supplier_code'] || generateSupplierCode(supplierType, index),
      supplier_name: row['ชื่อผู้จำหน่าย'] || row['supplier_name'] || '',
      supplier_type: supplierType === 'ผู้จำหน่าย' ? 'vendor' : 
                     supplierType === 'ผู้ให้บริการ' ? 'service_provider' :
                     supplierType === 'ทั้งสองอย่าง' ? 'both' : supplierType,
      business_reg_no: row['เลขที่นิติบุคคล'] || row['business_reg_no'] || '',
      tax_id: row['เลขที่ผู้เสียภาษี'] || row['tax_id'] || '',
      contact_person: row['ผู้ติดต่อ'] || row['contact_person'] || '',
      phone: row['เบอร์โทรศัพท์'] || row['phone'] || '',
      email: row['อีเมล'] || row['email'] || '',
      website: row['เว็บไซต์'] || row['website'] || '',
      billing_address: row['ที่อยู่บิล'] || row['billing_address'] || '',
      shipping_address: row['ที่อยู่จัดส่ง'] || row['shipping_address'] || '',
      payment_terms: row['เงื่อนไขการชำระเงิน'] || row['payment_terms'] || '',
      service_category: row['หมวดหมู่บริการ'] || row['service_category'] || '',
      product_category: row['หมวดหมู่สินค้า'] || row['product_category'] || '',
      rating: row['คะแนน'] || row['rating'] ? parseFloat(row['คะแนน'] || row['rating']) : 0,
      status: (row['สถานะ'] || row['status'] || 'active') === 'ใช้งาน' || 
              (row['สถานะ'] || row['status'] || 'active') === 'active' ? 'active' : 'inactive',
      created_by: 'admin@austamgood.com', // TODO: Get from auth context
      remarks: row['หมายเหตุ'] || row['remarks'] || ''
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
          const supplier = mapRowToSupplier(row, i);
          
          // Validate required fields
          if (!supplier.supplier_name) {
            throw new Error(`แถวที่ ${i + 2}: ต้องมีชื่อผู้จำหน่าย`);
          }

          const response = await fetch('/api/master-supplier', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(supplier),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`แถวที่ ${i + 2}: ${errorData.error || 'เกิดข้อผิดพลาด'}`);
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
      'ชื่อผู้จำหน่าย',
      'ประเภท',
      'รหัสอ้างอิง',
      'เลขที่นิติบุคคล',
      'เลขที่ผู้เสียภาษี',
      'ผู้ติดต่อ',
      'เบอร์โทรศัพท์',
      'อีเมล',
      'เว็บไซต์',
      'ที่อยู่บิล',
      'ที่อยู่จัดส่ง',
      'เงื่อนไขการชำระเงิน',
      'หมวดหมู่สินค้า',
      'หมวดหมู่บริการ',
      'คะแนน',
      'สถานะ',
      'หมายเหตุ'
    ];

    const sampleData = [
      'บริษัท ตัวอย่างผู้จำหน่าย จำกัด',
      'vendor',
      'VND001',
      '0105558123456',
      '0105558123456',
      'นาย สมชาย ตัวอย่าง',
      '02-123-4567',
      'contact@example.com',
      'https://www.example.com',
      '123 ถนนตัวอย่าง แขวงตัวอย่าง เขตตัวอย่าง กรุงเทพมหานคร 10110',
      '123 ถนนตัวอย่าง แขวงตัวอย่าง เขตตัวอย่าง กรุงเทพมหานคร 10110',
      '30 วัน',
      'อุปกรณ์อิเล็กทรอนิกส์',
      '',
      '4.0',
      'active',
      'ผู้จำหน่ายตัวอย่าง'
    ];

    const csvContent = [headers.join(','), sampleData.join(',')].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'supplier_template.csv';
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center mb-2">
          <Users className="w-5 h-5 text-blue-600 mr-2" />
          <h4 className="font-medium text-blue-900 font-thai">คำแนะนำการนำเข้าข้อมูลผู้จำหน่าย</h4>
        </div>
        <ul className="text-sm text-blue-800 font-thai space-y-1">
          <li>• รองรับไฟล์ CSV เท่านั้น</li>
          <li>• ต้องมีคอลัมน์: ชื่อผู้จำหน่าย (บังคับ)</li>
          <li>• ประเภท: vendor, service_provider, both</li>
          <li>• สถานะ: active, inactive</li>
          <li>• ดาวน์โหลดไฟล์ตัวอย่างเพื่อดูรูปแบบที่ถูกต้อง</li>
          <li>• รหัสผู้จำหน่ายจะถูกสร้างอัตโนมัติหากไม่ระบุ</li>
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
            <h4 className="font-medium text-green-900 font-thai">ผลการนำเข้าข้อมูลผู้จำหน่าย</h4>
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

export default ImportSupplierForm;