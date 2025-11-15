'use client';

import React, { useState, useCallback } from 'react';
import { Upload, Download, File, AlertCircle, CheckCircle, X, Package } from 'lucide-react';
import Button from '@/components/ui/Button';

interface ImportStorageStrategyFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

interface ImportSummary {
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
}

const ImportStorageStrategyForm: React.FC<ImportStorageStrategyFormProps> = ({ onSuccess, onCancel }) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = useCallback(async () => {
    try {
      const response = await fetch('/api/storage-strategies/template');
      if (!response.ok) {
        throw new Error('ไม่สามารถดาวน์โหลดเทมเพลตได้');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'storage_strategies_template.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการดาวน์โหลดเทมเพลต');
    }
  }, []);

  const handleFileSelect = useCallback((selectedFile: File) => {
    // Validate file type
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (!allowedTypes.includes(selectedFile.type) && 
        !selectedFile.name.endsWith('.csv') && 
        !selectedFile.name.endsWith('.xlsx') && 
        !selectedFile.name.endsWith('.xls')) {
      setError('กรุณาเลือกไฟล์ CSV, XLSX หรือ XLS เท่านั้น');
      return;
    }

    // Validate file size (max 10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('ขนาดไฟล์ต้องไม่เกิน 10MB');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setImportSummary(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  }, [handleFileSelect]);

  const handleImport = useCallback(async () => {
    if (!file) {
      setError('กรุณาเลือกไฟล์ก่อนนำเข้าข้อมูล');
      return;
    }

    setLoading(true);
    setError(null);
    setImportSummary(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/storage-strategies/import', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'เกิดข้อผิดพลาดในการนำเข้าข้อมูล');
      }

      setImportSummary(result.summary as ImportSummary);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดที่ไม่รู้จัก';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [file]);

  return (
    <div className="space-y-4">
      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-800 mb-2">คำแนะนำในการนำเข้าข้อมูล</h3>
        <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
          <li>ดาวน์โหลดเทมเพลต CSV และกรอกข้อมูลตามรูปแบบ</li>
          <li>ไฟล์ต้องเป็นรูปแบบ CSV, XLSX หรือ XLS เท่านั้น</li>
          <li>ขนาดไฟล์ต้องไม่เกิน 10MB</li>
          <li>รหัสกลยุทธ์ต้องไม่ซ้ำกันในคลังสินค้าเดียวกัน</li>
          <li>ชื่อคลังสินค้าต้องมีอยู่ในระบบก่อนนำเข้า</li>
        </ul>
      </div>

      {/* Download Template */}
      <div className="flex justify-center">
        <Button
          variant="outline"
          icon={Download}
          onClick={handleDownloadTemplate}
          className="w-full justify-center"
        >
          ดาวน์โหลดเทมเพลต CSV
        </Button>
      </div>

      {/* File Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          file ? 'border-green-300 bg-green-50' : 'border-gray-300 bg-gray-50 hover:border-gray-400'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={handleFileInputChange}
        />

        {!file ? (
          <div className="space-y-2">
            <Upload className="w-12 h-12 text-gray-400 mx-auto" />
            <p className="text-sm text-gray-600">ลากไฟล์มาวางที่นี่ หรือ</p>
            <Button
              variant="outline"
              icon={Package}
              onClick={() => fileInputRef.current?.click()}
              className="text-sm"
            >
              เลือกไฟล์
            </Button>
            <p className="text-xs text-gray-500">รองรับไฟล์ CSV, XLSX, XLS (สูงสุด 10MB)</p>
          </div>
        ) : (
          <div className="space-y-2">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
            <p className="text-sm font-medium text-gray-700">ไฟล์ถูกเลือกแล้ว</p>
            <div className="flex items-center justify-center space-x-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
              <File className="w-5 h-5 text-gray-500" />
              <span className="text-sm text-gray-700 truncate max-w-xs">{file.name}</span>
              <span className="text-xs text-gray-500">({(file.size / 1024).toFixed(1)} KB)</span>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  setError(null);
                  setImportSummary(null);
                }}
                className="text-gray-400 hover:text-red-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {/* Import Summary */}
      {importSummary && (
        <div className="space-y-3">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              <span className="text-sm font-medium text-green-800">นำเข้าข้อมูลสำเร็จ!</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white rounded p-2">
                <div className="font-semibold text-green-700">{importSummary.inserted}</div>
                <div className="text-gray-600">เพิ่มใหม่</div>
              </div>
              <div className="bg-white rounded p-2">
                <div className="font-semibold text-blue-700">{importSummary.updated}</div>
                <div className="text-gray-600">อัปเดต</div>
              </div>
              <div className="bg-white rounded p-2">
                <div className="font-semibold text-yellow-700">{importSummary.skipped}</div>
                <div className="text-gray-600">ข้าม</div>
              </div>
              <div className="bg-white rounded p-2">
                <div className="font-semibold text-gray-700">{importSummary.total}</div>
                <div className="text-gray-600">ทั้งหมด</div>
              </div>
            </div>
          </div>

          {importSummary.errors.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <h4 className="text-sm font-semibold text-yellow-800 mb-2">รายละเอียดข้อผิดพลาด ({importSummary.errors.length} รายการ)</h4>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {importSummary.errors.map((err, index) => (
                  <div key={index} className="text-xs text-yellow-700 bg-white rounded px-2 py-1">
                    แถว {err.row}: {err.message}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end space-x-2 pt-4">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={loading}
          icon={X}
        >
          ปิด
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

export default ImportStorageStrategyForm;
