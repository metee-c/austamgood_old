'use client';

import React, { useState } from 'react';
import { Upload, X, Download, AlertCircle, CheckCircle, FileText } from 'lucide-react';
import Button from '@/components/ui/Button';

interface ImportLocationFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const ImportLocationForm: React.FC<ImportLocationFormProps> = ({ onSuccess, onCancel }) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileSelect = (selectedFile: File) => {
    const allowedTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv'
    ];

    if (!allowedTypes.includes(selectedFile.type)) {
      setError('กรุณาเลือกไฟล์ Excel (.xlsx, .xls) หรือ CSV เท่านั้น');
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) { // 10MB limit
      setError('ขนาดไฟล์ต้องไม่เกิน 10MB');
      return;
    }

    setFile(selectedFile);
    setError(null);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setError(null);
  };

  const downloadTemplate = () => {
    // Create a simple CSV template
    const csvHeaders = 'location_id,warehouse_id,warehouse_name,location_code,location_name,location_type,max_capacity_qty,max_capacity_weight_kg,zone,aisle,rack,shelf,bin,putaway_strategy,temperature_controlled,humidity_controlled,active_status,remarks';
    const csvExampleRow1 = 'LOC001,WH001,คลังสินค้าหลัก กรุงเทพฯ,A01-R01-S01,โซน A ชั้นวาง 1 ชั้นที่ 1,rack,1000,500.000,Zone A,A01,R01,S01,B01,FIFO,false,false,active,ตำแหน่งเก็บสินค้าหมุนเวียนเร็ว';
    const csvExampleRow2 = 'LOC002,WH001,คลังสินค้าหลัก กรุงเทพฯ,A01-R01-S02,โซน A ชั้นวาง 1 ชั้นที่ 2,rack,1000,500.000,Zone A,A01,R01,S02,B01,FIFO,false,false,active,ตำแหน่งเก็บสินค้าหมุนเวียนเร็ว';
    const csvExampleRow3 = 'LOC003,WH001,คลังสินค้าหลัก กรุงเทพฯ,RECV-001,พื้นที่รับสินค้า,receiving,500,1000.000,Receiving,RECV,,,none,FIFO,false,false,active,พื้นที่รับสินค้าเข้าคลัง';
    
    // Add BOM for Excel compatibility with UTF-8
    const csvContent = [csvHeaders, csvExampleRow1, csvExampleRow2, csvExampleRow3].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });

    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'location_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      setError('กรุณาเลือกไฟล์ที่ต้องการนำเข้า');
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/master-data/locations/import', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'เกิดข้อผิดพลาดในการนำเข้าข้อมูล');
      }

      alert('นำเข้าข้อมูลโลเคชั่นสำเร็จ!');
      onSuccess();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดที่ไม่รู้จัก';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-red-600 text-sm font-thai">{error}</p>
          </div>
        )}

        {/* Template Download */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start space-x-3">
            <FileText className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-blue-900 font-thai mb-1">
                ดาวน์โหลดแม่แบบ
              </h4>
              <p className="text-sm text-blue-700 font-thai mb-3">
                ดาวน์โหลดไฟล์แม่แบบเพื่อช่วยในการจัดเตรียมข้อมูลสำหรับการนำเข้า
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={Download}
                onClick={downloadTemplate}
                className="border-blue-300 text-blue-700 hover:bg-blue-100"
              >
                ดาวน์โหลดแม่แบบ CSV
              </Button>
            </div>
          </div>
        </div>

        {/* File Upload Area */}
        <div className="space-y-4">
          <label className="block text-sm font-medium text-thai-gray-700 font-thai">
            เลือกไฟล์ข้อมูลโลเคชั่น
          </label>
          
          <div
            className={`
              relative border-2 border-dashed rounded-xl p-8 text-center transition-colors
              ${dragActive 
                ? 'border-primary-400 bg-primary-25' 
                : 'border-thai-gray-300 hover:border-thai-gray-400'
              }
            `}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {file ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center space-x-3">
                  <CheckCircle className="w-8 h-8 text-green-500" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-thai-gray-900 font-thai">
                      {file.name}
                    </p>
                    <p className="text-xs text-thai-gray-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveFile}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  ลบไฟล์
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Upload className="w-12 h-12 text-thai-gray-400 mx-auto" />
                <div>
                  <p className="text-sm font-medium text-thai-gray-900 font-thai mb-1">
                    ลากไฟล์มาวางที่นี่ หรือ
                  </p>
                  <label className="cursor-pointer">
                    <span className="text-primary-600 hover:text-primary-700 font-thai font-medium">
                      เลือกไฟล์
                    </span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileInputChange}
                    />
                  </label>
                </div>
                <p className="text-xs text-thai-gray-500 font-thai">
                  รองรับไฟล์ Excel (.xlsx, .xls) และ CSV เท่านั้น (ขนาดไม่เกิน 10MB)
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Import Instructions */}
        <div className="bg-thai-gray-50 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-thai-gray-900 font-thai mb-3">
            คำแนะนำการนำเข้าข้อมูล
          </h4>
          <ul className="space-y-2 text-sm text-thai-gray-700 font-thai">
            <li className="flex items-start space-x-2">
              <span className="text-primary-500 mt-1">•</span>
              <span>ไฟล์ต้องมีหัวตาราง (Header) ตามแม่แบบที่ให้ไว้</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-primary-500 mt-1">•</span>
              <span>รหัสโลเคชั่น (location_id) และรหัสตำแหน่ง (location_code) ต้องไม่ซ้ำกัน</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-primary-500 mt-1">•</span>
              <span>รหัสคลังสินค้า (warehouse_id) ต้องมีอยู่ในระบบแล้ว</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-primary-500 mt-1">•</span>
              <span>ระบบจะตรวจสอบข้อมูลก่อนการนำเข้า</span>
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
            icon={X}
          >
            ยกเลิก
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            icon={Upload}
            disabled={!file}
            className="shadow-lg"
          >
            {loading ? 'กำลังนำเข้า...' : 'นำเข้าข้อมูล'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ImportLocationForm;
