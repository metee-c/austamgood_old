'use client';

import React, { useState } from 'react';
import { 
  Upload, 
  Download, 
  File, 
  AlertCircle, 
  CheckCircle, 
  X,
  FileText,
  Info
} from 'lucide-react';
import Button from '@/components/ui/Button';

interface ImportFreightRateFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

interface ImportResult {
  total: number;
  success: number;
  failed: number;
  errors: Array<{
    row: number;
    field: string;
    message: string;
  }>;
}

const ImportFreightRateForm: React.FC<ImportFreightRateFormProps> = ({
  onSuccess,
  onCancel
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
        setError('กรุณาเลือกไฟล์ CSV เท่านั้น');
        return;
      }
      setSelectedFile(file);
      setError(null);
      setImportResult(null);
    }
  };

  const handleDownloadTemplate = () => {
    // Create CSV template with headers and sample data (only constant/master data fields)
    const csvContent = '\uFEFF' + [
      'เส้นทางขนส่ง,ผู้ให้บริการ,จังหวัดต้นทาง,อำเภอต้นทาง,จังหวัดปลายทาง,อำเภอปลายทาง,ระยะทาง(กม.),โหมดราคา,ราคาหลัก(บาท),ค่าจุดส่งเพิ่ม(บาท),ค่าเด็กติดรถ(บาท),หน่วยราคา,วันที่เริ่มใช้,วันที่สิ้นสุด,หมายเหตุ',
      'กรุงเทพฯ-เชียงใหม่,บริษัท ขนส่งไทย จำกัด,กรุงเทพมหานคร,บางซื่อ,เชียงใหม่,เมืองเชียงใหม่,700.00,flat,21000.00,,,trip,2024-01-01,,เส้นทางภาคเหนือ',
      'สมุทรปราการ-ขอนแก่น,บริษัท ขนส่งรวดเร็ว จำกัด,สมุทรปราการ,เมืองสมุทรปราการ,ขอนแก่น,เมืองขอนแก่น,450.00,formula,12000.00,500.00,800.00,trip,2024-01-01,,ราคาแบบคำนวณ',
      'กรุงเทพฯ-หาดใหญ่,บริษัท ขนส่งปลอดภัย จำกัด,กรุงเทพมหานคร,ห้วยขวาง,สงขลา,หาดใหญ่,950.00,flat,18000.00,,,trip,2024-01-01,,เส้นทางภาคใต้'
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'freight_rate_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = async () => {
    if (!selectedFile) {
      setError('กรุณาเลือกไฟล์ CSV');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Read file content
      const fileContent = await selectedFile.text();
      
      // Parse CSV (simple implementation)
      const lines = fileContent.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        throw new Error('ไฟล์ CSV ต้องมีข้อมูลอย่างน้อย 1 แถว (นอกจากหัวตาราง)');
      }

      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mock import result
      const mockResult: ImportResult = {
        total: lines.length - 1, // Exclude header
        success: Math.floor((lines.length - 1) * 0.8), // 80% success
        failed: Math.ceil((lines.length - 1) * 0.2), // 20% failed
        errors: [
          {
            row: 3,
            field: 'ระยะทาง',
            message: 'ระยะทางต้องเป็นตัวเลขที่มากกว่า 0'
          },
          {
            row: 5,
            field: 'ราคาหลัก',
            message: 'ราคาหลักไม่สามารถเว้นว่างได้'
          }
        ]
      };

      setImportResult(mockResult);

      if (mockResult.success > 0) {
        // Some data was imported successfully
        setTimeout(() => {
          onSuccess();
        }, 3000);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการนำเข้าข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setImportResult(null);
    setError(null);
    // Reset file input
    const fileInput = document.getElementById('csv-file') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="bg-blue-50/50 backdrop-blur-sm border border-blue-200/50 rounded-xl p-4">
        <div className="flex items-start space-x-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 font-thai">
            <h4 className="font-semibold mb-2">คำแนะนำการนำเข้าข้อมูล</h4>
            <ul className="list-disc list-inside space-y-1 text-blue-700">
              <li>ไฟล์ต้องเป็นรูปแบบ CSV (Comma-separated values)</li>
              <li>ข้อมูลที่จำเป็น: เส้นทางขนส่ง, ผู้ให้บริการ, จังหวัดต้นทางและปลายทาง, ระยะทาง, ราคาหลัก</li>
              <li>โหมดราคา: flat (แบบเหมา), formula (แบบคำนวณ)</li>
              <li>หน่วยราคา: trip (ต่อเที่ยว), kg (ต่อกิโลกรัม), pallet (ต่อพาเลท), other (อื่นๆ)</li>
              <li>สำหรับโหมด formula สามารถระบุค่าจุดส่งเพิ่มและค่าเด็กติดรถได้ (ถ้ามี)</li>
              <li>วันที่ใช้รูปแบบ YYYY-MM-DD (เช่น 2024-01-01)</li>
              <li>ดาวน์โหลดไฟล์ตัวอย่างเพื่อดูรูปแบบที่ถูกต้อง</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50/80 backdrop-blur-sm border border-red-200/50 rounded-xl p-4">
          <div className="flex items-center space-x-3 text-red-600">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="font-thai text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* Download Template */}
      <div className="flex justify-center">
        <Button
          variant="outline"
          icon={Download}
          onClick={handleDownloadTemplate}
          className="border-green-300 text-green-700 hover:bg-green-50"
        >
          ดาวน์โหลดไฟล์ตัวอย่าง
        </Button>
      </div>

      {/* File Upload */}
      <div className="bg-thai-gray-50/50 backdrop-blur-sm border border-thai-gray-200/50 rounded-xl p-6">
        <div className="text-center">
          <div className="mb-4">
            <FileText className="w-12 h-12 text-thai-gray-400 mx-auto" />
          </div>
          
          <label htmlFor="csv-file" className="cursor-pointer">
            <div className="border-2 border-dashed border-thai-gray-300 rounded-lg p-6 hover:border-blue-400 transition-colors">
              <p className="text-thai-gray-600 font-thai mb-2">
                คลิกเพื่อเลือกไฟล์ CSV หรือลากไฟล์มาวางที่นี่
              </p>
              <p className="text-sm text-thai-gray-500 font-thai">
                รองรับไฟล์ .csv เท่านั้น
              </p>
            </div>
          </label>
          
          <input
            id="csv-file"
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* Selected File Info */}
        {selectedFile && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <File className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-800 font-thai">
                {selectedFile.name}
              </span>
              <span className="text-xs text-green-600">
                ({(selectedFile.size / 1024).toFixed(1)} KB)
              </span>
              <button
                onClick={handleReset}
                className="ml-auto text-green-600 hover:text-green-800"
                title="เลือกไฟล์ใหม่"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Import Results */}
      {importResult && (
        <div className="bg-white/80 backdrop-blur-sm border border-thai-gray-200/50 rounded-xl p-4">
          <h4 className="font-semibold text-thai-gray-900 font-thai mb-4">ผลการนำเข้าข้อมูล</h4>
          
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{importResult.total}</div>
              <div className="text-sm text-blue-700 font-thai">รวมทั้งหมด</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{importResult.success}</div>
              <div className="text-sm text-green-700 font-thai">สำเร็จ</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{importResult.failed}</div>
              <div className="text-sm text-red-700 font-thai">ไม่สำเร็จ</div>
            </div>
          </div>

          {/* Error Details */}
          {importResult.errors.length > 0 && (
            <div className="mt-4">
              <h5 className="font-medium text-red-800 font-thai mb-2">รายละเอียดข้อผิดพลาด:</h5>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {importResult.errors.map((error, index) => (
                  <div key={index} className="text-sm p-2 bg-red-50 border border-red-200 rounded">
                    <span className="font-medium text-red-700">แถว {error.row}:</span>
                    <span className="text-red-600 ml-2">[{error.field}] {error.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Success Message */}
          {importResult.success > 0 && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-green-800 font-thai text-sm">
                  นำเข้าข้อมูลสำเร็จ {importResult.success} รายการ
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Form Actions */}
      <div className="flex justify-end space-x-3 pt-4 border-t border-thai-gray-200">
        <Button
          variant="outline"
          icon={X}
          onClick={onCancel}
          disabled={loading}
        >
          ยกเลิก
        </Button>
        <Button
          variant="primary"
          icon={Upload}
          onClick={handleImport}
          disabled={!selectedFile || loading}
          loading={loading}
          className="bg-blue-500 hover:bg-blue-600"
        >
          {loading ? 'กำลังนำเข้า...' : 'นำเข้าข้อมูล'}
        </Button>
      </div>
    </div>
  );
};

export default ImportFreightRateForm;