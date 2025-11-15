
import React, { useState } from 'react';
import { Upload, X, Download, AlertCircle, CheckCircle, FileText } from 'lucide-react';
import Button from '@/components/ui/Button';

interface ImportCustomerFormProps {
  onSuccess?: () => void;
  onCancel: () => void;
}

const ImportCustomerForm: React.FC<ImportCustomerFormProps> = ({ onSuccess, onCancel }) => {
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
    const csvContent = [
      'customer_id,customer_code,customer_name,customer_type,business_reg_no,tax_id,contact_person,phone,email,line_id,website,billing_address,shipping_address,province,district,subdistrict,postal_code,latitude,longitude,delivery_instructions,preferred_delivery_time,channel_source,customer_segment,status,created_by,remarks',
      'CUS006,RT006,ร้านค้าตัวอย่าง,retail,,,,081-111-1111,,,,,,,,,,,,,,Online,ร้านอาหาร,active,admin,'
    ].join('\n');

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'customer_template.csv');
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

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result;
      if (typeof text !== 'string') {
        setError('ไม่สามารถอ่านไฟล์ได้');
        setLoading(false);
        return;
      }

      try {
        const lines = text.split('\n').filter(line => line.trim() !== '');
        const header = lines[0].split(',').map(h => h.trim());
        const customers = lines.slice(1).map(line => {
          const values = line.split(',');
          const customer = header.reduce((obj, nextKey, index) => {
            obj[nextKey] = values[index];
            return obj;
          }, {} as any);
          return customer;
        });

        const response = await fetch('/api/master-customer/import', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(customers),
        });

        if (response.ok) {
          onSuccess?.();
        } else {
          const errorData = await response.json();
          throw new Error(errorData.error || 'เกิดข้อผิดพลาดในการนำเข้าข้อมูล');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'รูปแบบข้อมูลในไฟล์ไม่ถูกต้อง');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50/80 backdrop-blur-sm border border-red-200/50 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center space-x-3 text-red-600">
              <div className="flex-shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <span className="font-thai text-sm">{error}</span>
            </div>
          </div>
        )}

        <div className="bg-blue-50/80 backdrop-blur-sm border border-blue-200/50 rounded-2xl p-4 shadow-sm">
          <div className="flex items-start space-x-3">
            <FileText className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-blue-900 font-thai mb-1">ดาวน์โหลดแม่แบบ</h4>
              <p className="text-sm text-blue-700 font-thai mb-3">ดาวน์โหลดไฟล์แม่แบบเพื่อช่วยในการจัดเตรียมข้อมูลสำหรับการนำเข้า</p>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                icon={Download} 
                onClick={downloadTemplate} 
                className="bg-blue-100/50 border-blue-300/50 text-blue-700 hover:bg-blue-200/50 backdrop-blur-sm shadow-sm"
              >
                ดาวน์โหลดแม่แบบ CSV
              </Button>
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl p-6 space-y-4 shadow-sm">
          <label className="block text-sm font-medium text-thai-gray-700 font-thai">เลือกไฟล์ข้อมูลลูกค้า</label>
          <div
            className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 backdrop-blur-sm ${dragActive ? 'border-primary-400/50 bg-primary-50/50' : 'border-thai-gray-300/50 hover:border-thai-gray-400/50 bg-white/30'}`}
            onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop}
          >
            {file ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center space-x-3">
                  <CheckCircle className="w-8 h-8 text-green-500" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-thai-gray-900 font-thai">{file.name}</p>
                    <p className="text-xs text-thai-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleRemoveFile} 
                  className="text-red-600 hover:text-red-700 hover:bg-red-50/50 backdrop-blur-sm"
                >
                  ลบไฟล์
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Upload className="w-12 h-12 text-thai-gray-400 mx-auto" />
                <div>
                  <p className="text-sm font-medium text-thai-gray-900 font-thai mb-1">ลากไฟล์มาวางที่นี่ หรือ</p>
                  <label className="cursor-pointer">
                    <span className="text-primary-600 hover:text-primary-700 font-thai font-medium">เลือกไฟล์</span>
                    <input type="file" className="hidden" accept=".csv" onChange={handleFileInputChange} />
                  </label>
                </div>
                <p className="text-xs text-thai-gray-500 font-thai">รองรับไฟล์ CSV เท่านั้น (ขนาดไม่เกิน 10MB)</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-thai-gray-200/50">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel} 
            disabled={loading} 
            icon={X}
            className="bg-white/50 hover:bg-white/80 border-white/30 backdrop-blur-sm shadow-sm"
          >
            ยกเลิก
          </Button>
          <Button 
            type="submit" 
            variant="primary" 
            loading={loading} 
            icon={Upload} 
            disabled={!file} 
            className="bg-blue-500 hover:bg-blue-600 shadow-lg"
          >
            {loading ? 'กำลังนำเข้า...' : 'นำเข้าข้อมูล'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ImportCustomerForm;
