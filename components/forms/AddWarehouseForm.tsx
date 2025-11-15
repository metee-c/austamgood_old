'use client';

import React, { useState } from 'react';
import { Building } from 'lucide-react';
import Button from '@/components/ui/Button';

interface AddWarehouseFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const AddWarehouseForm: React.FC<AddWarehouseFormProps> = ({
  onSuccess,
  onCancel
}) => {
  const [formData, setFormData] = useState({
    warehouse_code: '',
    warehouse_name: '',
    address: '',
    phone: '',
    active_status: 'active' as 'active' | 'inactive'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // TODO: Implement warehouse creation API call
      console.log('Creating warehouse:', formData);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      onSuccess();
    } catch (err) {
      setError('เกิดข้อผิดพลาดในการสร้างคลังสินค้า');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600 text-sm font-thai">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              รหัสคลังสินค้า *
            </label>
            <input
              type="text"
              name="warehouse_code"
              value={formData.warehouse_code}
              onChange={handleInputChange}
              required
              className="
                w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                font-thai text-sm
              "
              placeholder="เช่น WH001"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              ชื่อคลังสินค้า *
            </label>
            <input
              type="text"
              name="warehouse_name"
              value={formData.warehouse_name}
              onChange={handleInputChange}
              required
              className="
                w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                font-thai text-sm
              "
              placeholder="ชื่อคลังสินค้า"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
            ที่อยู่
          </label>
          <input
            type="text"
            name="address"
            value={formData.address}
            onChange={handleInputChange}
            className="
              w-full px-3 py-2 border border-thai-gray-300 rounded-lg
              focus:ring-2 focus:ring-primary-500 focus:border-primary-500
              font-thai text-sm
            "
            placeholder="ที่อยู่คลังสินค้า"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              เบอร์โทรศัพท์
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              className="
                w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                font-thai text-sm
              "
              placeholder="เบอร์โทรศัพท์"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              สถานะ
            </label>
            <select
              name="active_status"
              value={formData.active_status}
              onChange={handleInputChange}
              className="
                w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                font-thai text-sm
              "
            >
              <option value="active">ใช้งาน</option>
              <option value="inactive">ไม่ใช้งาน</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
          >
            ยกเลิก
          </Button>
          <Button
            type="submit"
            variant="primary"
            icon={Building}
            loading={loading}
          >
            เพิ่มคลังสินค้า
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AddWarehouseForm;