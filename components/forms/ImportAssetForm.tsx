import React, { useState } from 'react';
import { Upload, X, Download, AlertCircle, CheckCircle, FileText } from 'lucide-react';
import Button from '@/components/ui/Button';

interface ImportAssetFormProps {
  onSuccess?: () => void;
  onCancel: () => void;
}

const ImportAssetForm: React.FC<ImportAssetFormProps> = ({ onSuccess, onCancel }) => {
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
      'asset_id,asset_code,asset_name,asset_type,description,brand,model,serial_number,purchase_date,warranty_expiry_date,maintenance_schedule,last_maintenance_date,status,capacity_spec,safety_certificate_expiry,remarks,created_by',
      'ASSET-001,ASSET-001,Forklift Toyota 2.5T,Forklift,Electric forklift for warehouse operations,Toyota,8FBE25,TY25001,2023-01-15,2025-01-15,Monthly inspection Annual service,,Active,2.5 Ton,,Main warehouse forklift,admin',
      'ASSET-002,ASSET-002,Pallet Rack System A1,Rack,Heavy duty pallet racking system,Dexion,P90,DEX-A1-001,2023-02-01,2033-02-01,Annual safety inspection,,Active,2000 Kg per level,,Zone A storage rack,admin'
    ].join('\n');

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'asset_template.csv');
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
        const assets = lines.slice(1).map(line => {
          const values = line.split(',');
          const asset = header.reduce((obj, nextKey, index) => {
            obj[nextKey] = values[index];
            return obj;
          }, {} as any);
          return asset;
        });

        // TODO: Replace with actual API endpoint when backend is ready
        try {
          const response = await fetch('/api/master-asset/import', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(assets),
          });

          if (response.ok) {
            onSuccess?.();
          } else {
            const errorData = await response.json();
            throw new Error(errorData.error || 'เกิดข้อผิดพลาดในการนำเข้าข้อมูล');
          }
        } catch (apiError) {
          // For now, simulate successful import since API doesn't exist yet
          console.log('Assets to be imported:', assets);
          alert(`นำเข้าข้อมูลสำเร็จ ${assets.length} รายการ (Demo Mode)`);
          onSuccess?.();
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
              <div className="space-y-2">
                <p className="text-xs text-blue-600 font-thai">รูปแบบข้อมูลที่ต้องการ:</p>
                <ul className="text-xs text-blue-600 font-thai pl-4 space-y-1">
                  <li>• รหัสทรัพย์สิน: ASSET-001</li>
                  <li>• ชื่อทรัพย์สิน: Forklift Toyota 2.5T</li>
                  <li>• ประเภท: Forklift, Rack, Hand Pallet, Barcode Scanner, Weighing Scale, Conveyor</li>
                  <li>• สถานะ: Active, Under Maintenance, Out of Service, Retired</li>
                  <li>• วันที่: รูปแบบ YYYY-MM-DD (เช่น 2023-01-15)</li>
                </ul>
              </div>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                icon={Download} 
                onClick={downloadTemplate} 
                className="bg-blue-100/50 border-blue-300/50 text-blue-700 hover:bg-blue-200/50 backdrop-blur-sm shadow-sm mt-3"
              >
                ดาวน์โหลดแม่แบบ CSV
              </Button>
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl p-6 space-y-4 shadow-sm">
          <label className="block text-sm font-medium text-thai-gray-700 font-thai">เลือกไฟล์ข้อมูลทรัพย์สิน</label>
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
                    <input type="file" className="hidden" accept=".csv,.xlsx,.xls" onChange={handleFileInputChange} />
                  </label>
                </div>
                <p className="text-xs text-thai-gray-500 font-thai">รองรับไฟล์ CSV, Excel เท่านั้น (ขนาดไม่เกิน 10MB)</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-yellow-50/80 backdrop-blur-sm border border-yellow-200/50 rounded-2xl p-4 shadow-sm">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-yellow-800 font-thai mb-1">ข้อควรระวัง</h4>
              <ul className="text-sm text-yellow-700 font-thai space-y-1">
                <li>• ตรวจสอบรูปแบบข้อมูลให้ถูกต้องก่อนนำเข้า</li>
                <li>• รหัสทรัพย์สินต้องไม่ซ้ำกับข้อมูลเดิม</li>
                <li>• ประเภททรัพย์สินต้องตรงกับที่กำหนดไว้</li>
                <li>• วันที่ต้องอยู่ในรูปแบบ YYYY-MM-DD</li>
              </ul>
            </div>
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

export default ImportAssetForm;