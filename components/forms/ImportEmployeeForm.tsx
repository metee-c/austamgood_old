'use client';

import React, { useState } from 'react';
import { Upload, X, Download, AlertCircle, CheckCircle, FileText } from 'lucide-react';
import Button from '@/components/ui/Button';

interface ImportEmployeeFormProps {
  onSuccess?: () => void;
  onCancel: () => void;
}

const ImportEmployeeForm: React.FC<ImportEmployeeFormProps> = ({ onSuccess, onCancel }) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFileSelect = (selectedFile: File) => {
    const allowedTypes = ['text/csv'];
    if (!allowedTypes.includes(selectedFile.type)) {
      setError('กรุณาเลือกไฟล์ CSV เท่านั้น');
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) { // 10MB limit
      setError('ขนาดไฟล์ต้องไม่เกิน 10MB');
      return;
    }
    setFile(selectedFile);
    setError(null);
  };

  const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const downloadTemplate = () => {
    const header = ["employee_code","prefix","first_name","last_name","nickname","gender","date_of_birth","national_id","phone_number","email","address","emergency_contact_name","emergency_contact_phone","hire_date","employment_type","position","department","profile_photo_url","wms_role","allowed_warehouses","rf_device_id","barcode_id","shift_type","training_certifications","remarks"];
    const example = ["EMP001","Mr","John","Doe","JD","male","1990-01-15","1234567890123","0812345678","john.d@example.com","123 Main St","Jane Doe","0898765432","2023-01-10","permanent","Warehouse Manager","Operations",,"supervisor","['WH01', 'WH02']",,"EMP-BC-001","day",,"New hire"];
    const csvContent = [header.join(','), example.join(',')].join('\n');
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'employee_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('กรุณาเลือกไฟล์');
      return;
    }
    setLoading(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      try {
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
        const header = lines[0].split(',').map(h => h.trim());
        const employees = lines.slice(1).map(line => {
          const values = line.split(',');
          return header.reduce((obj, nextKey, index) => {
            obj[nextKey] = values[index] || null;
            return obj;
          }, {} as any);
        });

        const response = await fetch('/api/master-employee/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(employees),
        });

        if (response.ok) {
          alert('นำเข้าข้อมูลพนักงานสำเร็จ');
          onSuccess?.();
        } else {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Import failed');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Invalid file format');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">{error}</div>}
        
        <div className="bg-blue-50/80 p-4 rounded-lg">
            <h4 className="font-semibold text-blue-800">ดาวน์โหลดแม่แบบ</h4>
            <p className="text-sm text-blue-700">ใช้ไฟล์แม่แบบเพื่อให้แน่ใจว่าข้อมูลของคุณอยู่ในรูปแบบที่ถูกต้อง</p>
            <Button type="button" variant="outline" size="sm" icon={Download} onClick={downloadTemplate} className="mt-2">
                ดาวน์โหลดแม่แบบ CSV
            </Button>
        </div>

        <div onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop} className={`border-2 border-dashed rounded-lg p-8 text-center ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}>
            {file ? (
                <div>
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
                    <p>{file.name}</p>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setFile(null)} className="text-red-500">Remove</Button>
                </div>
            ) : (
                <div>
                    <Upload className="w-12 h-12 text-gray-400 mx-auto" />
                    <p>ลากไฟล์มาวาง หรือ <label className="text-blue-500 cursor-pointer">เลือกไฟล์<input type="file" className="hidden" accept=".csv" onChange={handleFileInputChange} /></label></p>
                    <p className="text-xs text-gray-500">รองรับไฟล์ CSV เท่านั้น (ไม่เกิน 10MB)</p>
                </div>
            )}
        </div>

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading} icon={X}>ยกเลิก</Button>
          <Button type="submit" variant="primary" loading={loading} icon={Upload} disabled={!file}> {loading ? 'กำลังนำเข้า...' : 'นำเข้า'}</Button>
        </div>
      </form>
    </div>
  );
};

export default ImportEmployeeForm;
