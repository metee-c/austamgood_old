'use client';

import React, { useState, useEffect } from 'react';
import { Save, X, AlertCircle, MapPin } from 'lucide-react';
import Button from '@/components/ui/Button';
import { locationService, warehouseService } from '@/lib/database/warehouse';
import { UpdateLocationData, MasterWarehouse, LocationWithWarehouse } from '@/types/database/warehouse';

interface EditLocationFormProps {
  location: LocationWithWarehouse;
  onSuccess: () => void;
  onCancel: () => void;
}

const EditLocationForm: React.FC<EditLocationFormProps> = ({ location, onSuccess, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warehouses, setWarehouses] = useState<MasterWarehouse[]>([]);
  const [formData, setFormData] = useState<Partial<UpdateLocationData>>({
    location_id: location.location_id,
    warehouse_id: location.warehouse_id,
    warehouse_name: location.warehouse_name || location.warehouse?.warehouse_name,
    location_code: location.location_code,
    location_name: location.location_name,
    location_type: location.location_type,
    max_capacity_qty: location.max_capacity_qty || undefined,
    max_capacity_weight_kg: location.max_capacity_weight_kg || undefined,
    current_qty: location.current_qty,
    current_weight_kg: location.current_weight_kg,
    putaway_strategy: location.putaway_strategy,
    zone: location.zone,
    aisle: location.aisle,
    rack: location.rack,
    shelf: location.shelf,
    bin: location.bin,
    temperature_controlled: location.temperature_controlled,
    humidity_controlled: location.humidity_controlled,
    active_status: location.active_status,
    remarks: location.remarks
  });

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const fetchWarehouses = async () => {
    const { data, error } = await warehouseService.getAllWarehouses();
    if (!error) {
      setWarehouses(data);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? null : Number(value)) :
              type === 'checkbox' ? (e.target as HTMLInputElement).checked :
              value
    }));

    // Auto-update warehouse_name when warehouse_id changes
    if (name === 'warehouse_id') {
      const selectedWarehouse = warehouses.find(w => w.warehouse_id === value);
      setFormData(prev => ({
        ...prev,
        warehouse_name: selectedWarehouse?.warehouse_name || ''
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate required fields
      if (!formData.location_id || !formData.warehouse_id || !formData.location_code) {
        throw new Error('กรุณากรอกข้อมูลที่จำเป็น: รหัสโลเคชั่น, คลังสินค้า, และรหัสตำแหน่ง');
      }

      const result = await locationService.updateLocation(formData as UpdateLocationData);
      
      if (result.error) {
        throw new Error(result.error);
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการแก้ไขโลเคชั่น');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-h-[80vh] overflow-y-auto">
      <form onSubmit={handleSubmit} className="space-y-8">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-red-600 text-sm font-thai">{error}</p>
          </div>
        )}

        {/* Basic Information */}
        <div className="bg-white border border-thai-gray-200 rounded-xl p-6 space-y-6">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <h4 className="text-lg font-semibold text-thai-gray-900 font-thai">ข้อมูลพื้นฐาน</h4>
          </div>
        
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-thai-gray-600 uppercase tracking-wider font-thai">
                รหัสโลเคชั่น <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="location_id"
                value={formData.location_id || ''}
                onChange={handleInputChange}
                className="
                  w-full px-4 py-3 bg-thai-gray-100 border border-thai-gray-200 rounded-xl
                  text-sm font-mono text-thai-gray-600 cursor-not-allowed
                "
                placeholder="เช่น LOC001"
                disabled
              />
              <p className="text-xs text-thai-gray-500 font-thai">รหัสโลเคชั่นไม่สามารถแก้ไขได้</p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-thai-gray-600 uppercase tracking-wider font-thai">
                คลังสินค้า <span className="text-red-500">*</span>
              </label>
              <select
                name="warehouse_id"
                value={formData.warehouse_id || ''}
                onChange={handleInputChange}
                className="
                  w-full px-4 py-3 bg-thai-gray-50 border border-thai-gray-200 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:bg-white
                  text-sm font-thai transition-all duration-200
                "
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

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-thai-gray-600 uppercase tracking-wider font-thai">
                รหัสตำแหน่ง <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="location_code"
                value={formData.location_code || ''}
                onChange={handleInputChange}
                className="
                  w-full px-4 py-3 bg-thai-gray-50 border border-thai-gray-200 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:bg-white
                  text-sm font-mono transition-all duration-200
                  placeholder:text-thai-gray-400
                "
                placeholder="เช่น A01-R01-S01"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-thai-gray-600 uppercase tracking-wider font-thai">
                ชื่อโลเคชั่น
              </label>
              <input
                type="text"
                name="location_name"
                value={formData.location_name || ''}
                onChange={handleInputChange}
                className="
                  w-full px-4 py-3 bg-thai-gray-50 border border-thai-gray-200 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:bg-white
                  text-sm font-thai transition-all duration-200
                  placeholder:text-thai-gray-400
                "
                placeholder="ชื่อหรือคำอธิบายโลเคชั่น"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-thai-gray-600 uppercase tracking-wider font-thai">
                ประเภทโลเคชั่น
              </label>
              <select
                name="location_type"
                value={formData.location_type || ''}
                onChange={handleInputChange}
                className="
                  w-full px-4 py-3 bg-thai-gray-50 border border-thai-gray-200 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:bg-white
                  text-sm font-thai transition-all duration-200
                "
              >
                <option value="rack">ชั้นวาง</option>
                <option value="floor">กองพื้น</option>
                <option value="bulk">พื้นที่รวม</option>
                <option value="other">อื่นๆ</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-thai-gray-600 uppercase tracking-wider font-thai">
                สถานะ
              </label>
              <select
                name="active_status"
                value={formData.active_status || ''}
                onChange={handleInputChange}
                className="
                  w-full px-4 py-3 bg-thai-gray-50 border border-thai-gray-200 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:bg-white
                  text-sm font-thai transition-all duration-200
                "
              >
                <option value="active">ใช้งาน</option>
                <option value="inactive">ไม่ใช้งาน</option>
              </select>
            </div>
          </div>
        </div>

        {/* Location Details */}
        <div className="bg-white border border-thai-gray-200 rounded-xl p-6 space-y-6">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <h4 className="text-lg font-semibold text-thai-gray-900 font-thai">รายละเอียดตำแหน่ง</h4>
          </div>
        
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
                โซน
              </label>
              <input
                type="text"
                name="zone"
                value={formData.zone || ''}
                onChange={handleInputChange}
                className="
                  w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                  text-sm font-thai
                "
                placeholder="เช่น Zone A"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
                ทางเดิน
              </label>
              <input
                type="text"
                name="aisle"
                value={formData.aisle || ''}
                onChange={handleInputChange}
                className="
                  w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                  text-sm font-thai
                "
                placeholder="เช่น A01"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
                ชั้นวาง
              </label>
              <input
                type="text"
                name="rack"
                value={formData.rack || ''}
                onChange={handleInputChange}
                className="
                  w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                  text-sm font-thai
                "
                placeholder="เช่น R01"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
                ชั้น
              </label>
              <input
                type="text"
                name="shelf"
                value={formData.shelf || ''}
                onChange={handleInputChange}
                className="
                  w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                  text-sm font-thai
                "
                placeholder="เช่น S01"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
                ช่อง
              </label>
              <input
                type="text"
                name="bin"
                value={formData.bin || ''}
                onChange={handleInputChange}
                className="
                  w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                  text-sm font-thai
                "
                placeholder="เช่น B01"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
                กลยุทธ์การจัดเก็บ
              </label>
              <select
                name="putaway_strategy"
                value={formData.putaway_strategy || ''}
                onChange={handleInputChange}
                className="
                  w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                  text-sm font-thai
                "
              >
                <option value="">เลือกกลยุทธ์</option>
                <option value="FIFO">FIFO - เข้าก่อนออกก่อน</option>
                <option value="LIFO">LIFO - เข้าหลังออกก่อน</option>
                <option value="ABC">ABC - จัดเก็บตามความสำคัญ</option>
                <option value="Zone">Zone - จัดเก็บตามโซน</option>
              </select>
            </div>
          </div>
        </div>

        {/* Capacity Information */}
        <div className="bg-white border border-thai-gray-200 rounded-xl p-6 space-y-6">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
            <h4 className="text-lg font-semibold text-thai-gray-900 font-thai">ข้อมูลความจุ</h4>
          </div>
        
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
                ความจุสูงสุด (จำนวน)
              </label>
              <input
                type="number"
                name="max_capacity_qty"
                value={formData.max_capacity_qty || ''}
                onChange={handleInputChange}
                min="0"
                className="
                  w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                  text-sm font-thai
                "
                placeholder="จำนวนชิ้น"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
                ความจุสูงสุด (น้ำหนัก กก.)
              </label>
              <input
                type="number"
                name="max_capacity_weight_kg"
                value={formData.max_capacity_weight_kg || ''}
                onChange={handleInputChange}
                min="0"
                step="0.001"
                className="
                  w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                  text-sm font-thai
                "
                placeholder="กิโลกรัม"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
                จำนวนปัจจุบัน
              </label>
              <input
                type="number"
                name="current_qty"
                value={formData.current_qty || ''}
                onChange={handleInputChange}
                min="0"
                className="
                  w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                  text-sm font-thai
                "
                placeholder="จำนวนชิ้น"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
                น้ำหนักปัจจุบัน (กก.)
              </label>
              <input
                type="number"
                name="current_weight_kg"
                value={formData.current_weight_kg || ''}
                onChange={handleInputChange}
                min="0"
                step="0.001"
                className="
                  w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                  text-sm font-thai
                "
                placeholder="กิโลกรัม"
              />
            </div>
          </div>
        </div>

        {/* Environmental Controls */}
        <div className="bg-white border border-thai-gray-200 rounded-xl p-6 space-y-6">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
            <h4 className="text-lg font-semibold text-thai-gray-900 font-thai">การควบคุมสภาพแวดล้อม</h4>
          </div>
        
          <div className="flex items-center space-x-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                name="temperature_controlled"
                checked={formData.temperature_controlled || false}
                onChange={handleInputChange}
                className="mr-2 rounded border-thai-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-thai-gray-700 font-thai">ควบคุมอุณหภูมิ</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                name="humidity_controlled"
                checked={formData.humidity_controlled || false}
                onChange={handleInputChange}
                className="mr-2 rounded border-thai-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-thai-gray-700 font-thai">ควบคุมความชื้น</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              หมายเหตุ
            </label>
            <textarea
              name="remarks"
              value={formData.remarks || ''}
              onChange={handleInputChange}
              rows={3}
              className="
                w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                text-sm font-thai resize-none
              "
              placeholder="หมายเหตุเพิ่มเติมเกี่ยวกับโลเคชั่น"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-thai-gray-50 rounded-xl p-6 mt-8">
          <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={loading}
              icon={X}
              className="sm:order-1"
            >
              ยกเลิก
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={loading}
              icon={Save}
              className="sm:order-2 shadow-lg"
            >
              {loading ? 'กำลังแก้ไข...' : 'แก้ไข'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default EditLocationForm;