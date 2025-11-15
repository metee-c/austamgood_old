'use client';

import React, { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import Button from '@/components/ui/Button';

interface AddPreparationAreaFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const AddPreparationAreaForm: React.FC<AddPreparationAreaFormProps> = ({ onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    area_code: '',
    area_name: '',
    description: '',
    warehouse_id: '',
    zone: '',
    area_type: '',
    capacity_sqm: '',
    max_capacity_pallets: '',
    status: 'active'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [zones, setZones] = useState<string[]>([]);
  const [areaTypes, setAreaTypes] = useState<any[]>([]);

  // Fetch warehouses from API
  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const response = await fetch('/api/master-warehouse?status=active');
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(
            (payload && payload.error) || 'ไม่สามารถดึงข้อมูลคลังสินค้าได้'
          );
        }

        const records = Array.isArray(payload) ? payload : [];
        const normalized = records.map((warehouse: any) => ({
          warehouse_id: warehouse.warehouse_id,
          warehouse_name: warehouse.warehouse_name
        }));

        setWarehouses(normalized);
      } catch (err) {
        console.error('[AddPreparationAreaForm] fetchWarehouses error', err);
        setError('ไม่สามารถดึงข้อมูลคลังสินค้าได้');
      }
    };

    fetchWarehouses();
  }, []);

  // Fetch zones from master_location API
  useEffect(() => {
    const fetchZones = async () => {
      try {
        const response = await fetch('/api/master-location/zones');
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(
            (payload && payload.error) || 'ไม่สามารถดึงข้อมูลโซนได้'
          );
        }

        const zoneList: string[] = Array.isArray(payload) ? payload : [];
        setZones(zoneList);
      } catch (err) {
        console.error('[AddPreparationAreaForm] fetchZones error', err);
        // Fallback to default zones if API fails
        setZones(['A', 'B', 'C', 'D']);
      }
    };

    fetchZones();
  }, []);

  // Fetch area types from master_location API
  useEffect(() => {
    const fetchAreaTypes = async () => {
      try {
        const response = await fetch('/api/master-location/location-types');
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(
            (payload && payload.error) || 'ไม่สามารถดึงข้อมูลประเภทพื้นที่ได้'
          );
        }

        const typeList: string[] = Array.isArray(payload) ? payload : [];
        const normalizedTypes = typeList.map((type) => ({
          value: type,
          label: getAreaTypeText(type)
        }));
        setAreaTypes(normalizedTypes);
      } catch (err) {
        console.error('[AddPreparationAreaForm] fetchAreaTypes error', err);
        // Fallback to default area types if API fails
        setAreaTypes([
          { value: 'packing', label: 'บรรจุภัณฑ์' },
          { value: 'quality_check', label: 'ตรวจสอบคุณภาพ' },
          { value: 'consolidation', label: 'รวมสินค้า' },
          { value: 'labeling', label: 'ติดฉลาก' },
          { value: 'other', label: 'อื่นๆ' },
        ]);
      }
    };

    fetchAreaTypes();
  }, []);

  const statuses = [
    { value: 'active', label: 'ใช้งาน' },
    { value: 'inactive', label: 'ไม่ใช้งาน' },
    { value: 'maintenance', label: 'ซ่อมบำรุง' },
  ];

  const getAreaTypeText = (areaType: string) => {
    switch (areaType) {
      case 'packing': return 'บรรจุภัณฑ์';
      case 'quality_check': return 'ตรวจสอบคุณภาพ';
      case 'consolidation': return 'รวมสินค้า';
      case 'labeling': return 'ติดฉลาก';
      default: return areaType;
    }
  };


  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setError(null);
  };

  const validateForm = () => {
    const requiredFields = ['area_code', 'area_name', 'warehouse_id', 'zone', 'area_type'];
    const missingFields = requiredFields.filter(field => !formData[field as keyof typeof formData]);
    
    if (missingFields.length > 0) {
      setError(`กรุณากรอกข้อมูล: ${missingFields.join(', ')}`);
      return false;
    }

    // Validate capacity_sqm is a number
    if (formData.capacity_sqm && isNaN(Number(formData.capacity_sqm))) {
      setError('ความจุ(ตร.ม.) ต้องเป็นตัวเลข');
      return false;
    }

    // Validate max_capacity_pallets is a number
    if (formData.max_capacity_pallets && isNaN(Number(formData.max_capacity_pallets))) {
      setError('ความจุพาเลทต้องเป็นตัวเลข');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const submitData = {
        ...formData,
        capacity_sqm: formData.capacity_sqm ? Number(formData.capacity_sqm) : undefined,
        max_capacity_pallets: formData.max_capacity_pallets ? Number(formData.max_capacity_pallets) : undefined,
      };

      const response = await fetch('/api/preparation-areas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'เกิดข้อผิดพลาดในการเพิ่มข้อมูล');
      }

      alert('เพิ่มพื้นที่จัดเตรียมสินค้าสำเร็จ!');
      onSuccess();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดที่ไม่รู้จัก';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <span className="text-red-600 text-sm font-thai">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Area Code */}
          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-1">
              รหัสพื้นที่ <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-thai-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 text-sm font-thai"
              value={formData.area_code}
              onChange={(e) => handleInputChange('area_code', e.target.value)}
              placeholder="เช่น PREP001"
              required
            />
          </div>

          {/* Area Name */}
          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-1">
              ชื่อพื้นที่ <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-thai-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 text-sm font-thai"
              value={formData.area_name}
              onChange={(e) => handleInputChange('area_name', e.target.value)}
              placeholder="เช่น พื้นที่บรรจุภัณฑ์ A"
              required
            />
          </div>

          {/* Warehouse */}
          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-1">
              คลังสินค้า <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full px-3 py-2 border border-thai-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 text-sm font-thai"
              value={formData.warehouse_id}
              onChange={(e) => handleInputChange('warehouse_id', e.target.value)}
              required
            >
              <option value="">เลือกคลังสินค้า</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.warehouse_id} value={warehouse.warehouse_id}>
                  {warehouse.warehouse_name}
                </option>
              ))}
            </select>
          </div>

          {/* Zone */}
          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-1">
              โซน <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full px-3 py-2 border border-thai-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 text-sm font-thai"
              value={formData.zone}
              onChange={(e) => handleInputChange('zone', e.target.value)}
              required
            >
              <option value="">เลือกโซน</option>
              {zones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
          </div>

          {/* Area Type */}
          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-1">
              ประเภทพื้นที่ <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full px-3 py-2 border border-thai-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 text-sm font-thai"
              value={formData.area_type}
              onChange={(e) => handleInputChange('area_type', e.target.value)}
              required
            >
              <option value="">เลือกประเภท</option>
              {areaTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-1">
              สถานะ <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full px-3 py-2 border border-thai-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 text-sm font-thai"
              value={formData.status}
              onChange={(e) => handleInputChange('status', e.target.value)}
              required
            >
              {statuses.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          {/* Capacity SQM */}
          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-1">
              ความจุ(ตร.ม.)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="w-full px-3 py-2 border border-thai-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 text-sm font-thai"
              value={formData.capacity_sqm}
              onChange={(e) => handleInputChange('capacity_sqm', e.target.value)}
              placeholder="เช่น 100.50"
            />
          </div>

          {/* Max Capacity Pallets */}
          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-1">
              ความจุพาเลท
            </label>
            <input
              type="number"
              min="0"
              className="w-full px-3 py-2 border border-thai-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 text-sm font-thai"
              value={formData.max_capacity_pallets}
              onChange={(e) => handleInputChange('max_capacity_pallets', e.target.value)}
              placeholder="เช่น 50"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-1">
            รายละเอียด
          </label>
          <textarea
            rows={3}
            className="w-full px-3 py-2 border border-thai-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 text-sm font-thai resize-none"
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            placeholder="รายละเอียดเพิ่มเติม..."
          />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4">
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
            className="shadow-lg"
          >
            {loading ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AddPreparationAreaForm;
