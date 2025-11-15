'use client';

import React, { useState } from 'react';
import Button from '@/components/ui/Button';
import { Upload, Download, FileText, AlertCircle, CheckCircle, X } from 'lucide-react';

interface ImportDocumentTypeFormProps {
  onSuccess?: () => void;
  onCancel: () => void;
}

const ImportDocumentTypeForm: React.FC<ImportDocumentTypeFormProps> = ({ onSuccess, onCancel }) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResults, setImportResults] = useState<{
    success: number;
    errors: Array<{ row: number; message: string }>;
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        setError('กรุณาเลือกไฟล์ CSV เท่านั้น');
        return;
      }
      setFile(selectedFile);
      setError(null);
      setImportResults(null);
    }
  };

  const downloadTemplate = () => {
    const csvContent = `doc_type_code,doc_type_name,description,return_required,ocr_template_id,storage_location,retention_period_months,is_active,created_by,remarks
IV-SAMPLE,ตัวอย่างประเภทเอกสาร,คำอธิบายตัวอย่าง,true,OCR_001,ตู้เอกสาร A-01,36,true,system,หมายเหตุตัวอย่าง`;
    
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'document_type_template.csv';
    link.click();
  };

  const handleImport = async () => {
    if (!file) {
      setError('กรุณาเลือกไฟล์ CSV');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/master-iv-document-type/import', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setImportResults(result);
        if (result.errors.length === 0) {
          alert(`นำเข้าข้อมูลสำเร็จ ${result.success} รายการ`);
          if (onSuccess) onSuccess();
        }
      } else {
        setError(result.error || 'เกิดข้อผิดพลาดในการนำเข้าข้อมูล');
      }
    } catch (error) {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <div className="flex items-center">
            <AlertCircle className="w-4 h-4 mr-2" />
            <span className="block sm:inline">{error}</span>
          </div>
        </div>
      )}

      {/* Template Download */}
      <div className="bg-blue-50/50 backdrop-blur-sm border border-blue-200/50 rounded-xl p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Download className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-blue-900 font-thai">ดาวน์โหลดแม่แบบ</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          ดาวน์โหลดไฟล์แม่แบบ CSV และกรอกข้อมูลตามรูปแบบที่กำหนด
        </p>
        <Button
          variant="outline"
          onClick={downloadTemplate}
          icon={Download}
          className="border-blue-200 hover:bg-blue-50"
        >
          ดาวน์โหลดแม่แบบ CSV
        </Button>
      </div>

      {/* File Upload */}
      <div className="bg-green-50/50 backdrop-blur-sm border border-green-200/50 rounded-xl p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Upload className="w-5 h-5 text-green-600" />
          <h3 className="text-lg font-semibold text-green-900 font-thai">อัปโหลดไฟล์</h3>
        </div>
        
        <div className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-green-400 transition-colors">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <div className="mt-4">
              <label htmlFor="file-upload" className="cursor-pointer">
                <span className="mt-2 block text-sm font-medium text-gray-900">
                  เลือกไฟล์ CSV หรือลากไฟล์มาวาง
                </span>
                <input
                  id="file-upload"
                  name="file-upload"
                  type="file"
                  accept=".csv"
                  className="sr-only"
                  onChange={handleFileChange}
                />
              </label>
              <p className="mt-1 text-xs text-gray-500">รองรับไฟล์ CSV เท่านั้น</p>
            </div>
          </div>

          {file && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FileText className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-gray-900">{file.name}</span>
                  <span className="text-xs text-gray-500">({(file.size / 1024).toFixed(2)} KB)</span>
                </div>
                <button
                  onClick={() => setFile(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Import Results */}
      {importResults && (
        <div className="bg-gray-50/50 backdrop-blur-sm border border-gray-200/50 rounded-xl p-6">
          <div className="flex items-center space-x-2 mb-4">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900 font-thai">ผลการนำเข้าข้อมูล</h3>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm text-green-700">นำเข้าสำเร็จ: {importResults.success} รายการ</span>
            </div>
            
            {importResults.errors.length > 0 && (
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <span className="text-sm text-red-700">เกิดข้อผิดพลาด: {importResults.errors.length} รายการ</span>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-md p-3 max-h-40 overflow-y-auto">
                  {importResults.errors.map((error, index) => (
                    <div key={index} className="text-xs text-red-700 mb-1">
                      แถว {error.row}: {error.message}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-yellow-50/50 backdrop-blur-sm border border-yellow-200/50 rounded-xl p-6">
        <h4 className="text-sm font-semibold text-yellow-800 mb-2">คำแนะนำการนำเข้าข้อมูล:</h4>
        <ul className="text-xs text-yellow-700 space-y-1">
          <li>• ไฟล์ต้องเป็นรูปแบบ CSV และมี encoding UTF-8</li>
          <li>• คอลัมน์ที่จำเป็น: doc_type_code, doc_type_name, created_by</li>
          <li>• return_required และ is_active ให้ใส่ true หรือ false</li>
          <li>• retention_period_months ให้ใส่ตัวเลข (เดือน)</li>
          <li>• หากมีข้อมูลซ้ำ ระบบจะข้ามการนำเข้า</li>
        </ul>
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} icon={X}>
          ยกเลิก
        </Button>
        <Button
          variant="primary"
          onClick={handleImport}
          loading={loading}
          disabled={!file}
          icon={Upload}
        >
          {loading ? 'กำลังนำเข้า...' : 'นำเข้าข้อมูล'}
        </Button>
      </div>
    </div>
  );
};

export default ImportDocumentTypeForm;