'use client';

import React, { useState, useRef } from 'react';
import { 
  Upload, 
  Download, 
  FileText, 
  AlertCircle, 
  Check,
  X,
  Package
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { bomSkuService } from '@/lib/database/bom-sku';
import { CreateBomSkuData } from '@/types/database/bom-sku';

interface ImportBomFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

interface ParsedBomData {
  bom_id: string;
  finished_sku_id: string;
  material_sku_id: string;
  material_qty: number;
  material_uom: string;
  step_order: number;
  step_name?: string;
  step_description?: string;
  waste_qty?: number;
  created_by: string;
  status: 'active' | 'inactive';
}

const ImportBomForm: React.FC<ImportBomFormProps> = ({ onSuccess, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedBomData[]>([]);
  const [importResults, setImportResults] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const headers = [
      'bom_id',
      'finished_sku_id', 
      'material_sku_id',
      'material_qty',
      'material_uom',
      'step_order',
      'step_name',
      'step_description', 
      'waste_qty',
      'created_by',
      'status'
    ];

    const thaiHeaders = [
      'รหัส BOM',
      'รหัสสินค้าสำเร็จรูป',
      'รหัสวัตถุดิบ', 
      'ปริมาณวัตถุดิบ',
      'หน่วยวัด',
      'ลำดับขั้นตอน',
      'ชื่อขั้นตอน',
      'รายละเอียดขั้นตอน',
      'ปริมาณเสีย',
      'ผู้สร้าง',
      'สถานะ'
    ];

    const sampleData = [
      'BOM001',
      'PROD001',
      'MAT001', 
      '2.500',
      'กก.',
      '1',
      'ผสมส่วนผสม',
      'ผสมวัตถุดิบตามสูตร',
      '0.100',
      'admin@austamgood.com',
      'active'
    ];

    const csvContent = [
      headers.join(','),
      thaiHeaders.join(','),
      sampleData.join(',')
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'bom_import_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCSV = (text: string): ParsedBomData[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('ไฟล์ CSV ต้องมีอย่างน้อย 2 บรรทัด (header และข้อมูล)');
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const data: ParsedBomData[] = [];

    // Skip header row(s) - support both English and Thai headers
    const startRow = lines[1].includes('รหัส BOM') ? 2 : 1;

    for (let i = startRow; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      
      if (values.length < headers.length) continue;

      try {
        const rowData: ParsedBomData = {
          bom_id: values[0] || '',
          finished_sku_id: values[1] || '',
          material_sku_id: values[2] || '',
          material_qty: parseFloat(values[3]) || 0,
          material_uom: values[4] || '',
          step_order: parseInt(values[5]) || 1,
          step_name: values[6] || undefined,
          step_description: values[7] || undefined,
          waste_qty: values[8] ? parseFloat(values[8]) : undefined,
          created_by: values[9] || 'admin@austamgood.com',
          status: (values[10] === 'active' || values[10] === 'ใช้งาน') ? 'active' : 'inactive'
        };

        // Validate required fields
        if (!rowData.bom_id || !rowData.finished_sku_id || !rowData.material_sku_id || 
            !rowData.material_qty || !rowData.material_uom) {
          continue; // Skip invalid rows
        }

        data.push(rowData);
      } catch (err) {
        console.error(`Error parsing row ${i + 1}:`, err);
      }
    }

    return data;
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setSuccess(null);
    setParsedData([]);

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('กรุณาเลือกไฟล์ CSV เท่านั้น');
      return;
    }

    try {
      const text = await file.text();
      const data = parseCSV(text);
      
      if (data.length === 0) {
        setError('ไม่พบข้อมูลที่ถูกต้องในไฟล์ CSV');
        return;
      }

      setParsedData(data);
      setSuccess(`พบข้อมูล ${data.length} รายการพร้อมนำเข้า`);
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการอ่านไฟล์');
    }
  };

  const handleImport = async () => {
    if (parsedData.length === 0) {
      setError('ไม่พบข้อมูลที่จะนำเข้า');
      return;
    }

    setLoading(true);
    setError(null);

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (const [index, item] of parsedData.entries()) {
      try {
        const { error } = await bomSkuService.createBomSku(item as CreateBomSkuData);
        
        if (error) {
          results.failed++;
          results.errors.push(`แถว ${index + 1}: ${error}`);
        } else {
          results.success++;
        }
      } catch (err: any) {
        results.failed++;
        results.errors.push(`แถว ${index + 1}: ${err.message || 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ'}`);
      }
    }

    setImportResults(results);
    setLoading(false);

    if (results.success > 0) {
      setTimeout(() => {
        onSuccess();
      }, 2000);
    }
  };

  const resetForm = () => {
    setParsedData([]);
    setError(null);
    setSuccess(null);
    setImportResults(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-white/20">
      {/* Header */}
      <div className="flex items-center space-x-3 pb-4 border-b border-thai-gray-200">
        <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center">
          <Upload className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-thai-gray-900 font-thai">
            นำเข้าข้อมูล BOM
          </h3>
          <p className="text-sm text-thai-gray-600 font-thai">
            อัปโหลดไฟล์ CSV เพื่อนำเข้าข้อมูล BOM จำนวนมาก
          </p>
        </div>
      </div>

      <div className="space-y-6 mt-6">
        {/* Download Template */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-medium text-blue-900 font-thai mb-2">
                ดาวน์โหลดไฟล์ Template
              </h4>
              <p className="text-sm text-blue-700 font-thai mb-3">
                ดาวน์โหลดไฟล์ตัวอย่างเพื่อดูรูปแบบข้อมูลที่ถูกต้อง
              </p>
              <Button
                variant="outline"
                size="sm"
                icon={Download}
                onClick={downloadTemplate}
                className="border-blue-300 text-blue-700 hover:bg-blue-100"
              >
                ดาวน์โหลด Template
              </Button>
            </div>
          </div>
        </div>

        {/* File Upload */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              เลือกไฟล์ CSV
            </label>
            <div className="border-2 border-dashed border-thai-gray-300 rounded-lg p-6 text-center hover:border-thai-gray-400 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload" className="cursor-pointer">
                <Upload className="w-8 h-8 text-thai-gray-400 mx-auto mb-2" />
                <p className="text-sm text-thai-gray-600 font-thai mb-1">
                  คลิกเพื่อเลือกไฟล์ CSV
                </p>
                <p className="text-xs text-thai-gray-500 font-thai">
                  รองรับเฉพาะไฟล์ .csv เท่านั้น
                </p>
              </label>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <p className="text-red-600 text-sm font-thai">{error}</p>
              </div>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <Check className="w-4 h-4 text-green-600" />
                <p className="text-green-600 text-sm font-thai">{success}</p>
              </div>
            </div>
          )}

          {/* Import Results */}
          {importResults && (
            <div className="bg-thai-gray-50 border border-thai-gray-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-thai-gray-900 font-thai mb-3">
                ผลการนำเข้าข้อมูล
              </h4>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Check className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-green-600 font-thai">
                    สำเร็จ: {importResults.success} รายการ
                  </span>
                </div>
                {importResults.failed > 0 && (
                  <div className="flex items-center space-x-2">
                    <X className="w-4 h-4 text-red-600" />
                    <span className="text-sm text-red-600 font-thai">
                      ล้มเหลว: {importResults.failed} รายการ
                    </span>
                  </div>
                )}
                {importResults.errors.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-thai-gray-600 font-thai mb-2">รายละเอียดข้อผิดพลาด:</p>
                    <div className="max-h-32 overflow-y-auto bg-white border border-thai-gray-200 rounded p-2">
                      {importResults.errors.map((error, index) => (
                        <p key={index} className="text-xs text-red-600 font-thai mb-1">
                          {error}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Preview Data */}
          {parsedData.length > 0 && !importResults && (
            <div className="bg-thai-gray-50 border border-thai-gray-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-thai-gray-900 font-thai mb-3">
                ตัวอย่างข้อมูลที่จะนำเข้า (5 รายการแรก)
              </h4>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="border-b border-thai-gray-200">
                      <th className="text-left p-2 font-thai">BOM ID</th>
                      <th className="text-left p-2 font-thai">สินค้าสำเร็จรูป</th>
                      <th className="text-left p-2 font-thai">วัตถุดิบ</th>
                      <th className="text-left p-2 font-thai">ปริมาณ</th>
                      <th className="text-left p-2 font-thai">หน่วย</th>
                      <th className="text-left p-2 font-thai">ลำดับ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.slice(0, 5).map((item, index) => (
                      <tr key={index} className="border-b border-thai-gray-100">
                        <td className="p-2 font-mono">{item.bom_id}</td>
                        <td className="p-2 font-mono">{item.finished_sku_id}</td>
                        <td className="p-2 font-mono">{item.material_sku_id}</td>
                        <td className="p-2">{item.material_qty}</td>
                        <td className="p-2">{item.material_uom}</td>
                        <td className="p-2">{item.step_order}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedData.length > 5 && (
                  <p className="text-xs text-thai-gray-500 font-thai mt-2 text-center">
                    ... และอีก {parsedData.length - 5} รายการ
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-6 border-t border-thai-gray-200">
          <Button
            variant="outline"
            onClick={importResults ? resetForm : onCancel}
            disabled={loading}
            icon={importResults ? Package : X}
          >
            {importResults ? 'นำเข้าชุดใหม่' : 'ยกเลิก'}
          </Button>
          
          {parsedData.length > 0 && !importResults && (
            <Button
              variant="primary"
              onClick={handleImport}
              loading={loading}
              icon={Upload}
              className="bg-green-500 hover:bg-green-600"
            >
              {loading ? 'กำลังนำเข้า...' : `นำเข้าข้อมูล ${parsedData.length} รายการ`}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportBomForm;