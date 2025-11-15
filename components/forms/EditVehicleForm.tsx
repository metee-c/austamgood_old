
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { vehicleSchema, VehicleFormValues } from '@/types/vehicle-schema';
import Button from '@/components/ui/Button';
import { Save, X, AlertCircle } from 'lucide-react';

interface EditVehicleFormProps {
  vehicle: VehicleFormValues;
  onSuccess?: () => void;
  onCancel: () => void;
}

const EditVehicleForm: React.FC<EditVehicleFormProps> = ({ vehicle, onSuccess, onCancel }) => {
  const { register, handleSubmit, formState: { errors } } = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: vehicle,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (data: VehicleFormValues) => {
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/master-vehicle`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      }
    );

    if (response.ok) {
      alert('แก้ไขข้อมูลยานพาหนะสำเร็จ');
      if (onSuccess) onSuccess();
    } else {
      const errorData = await response.json();
      setError(errorData.error);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <div className="bg-red-50/80 backdrop-blur-sm border border-red-200/50 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center space-x-3 text-red-600">
              <div className="flex-shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <span className="font-thai text-sm">{typeof error === 'string' ? error : JSON.stringify(error)}</span>
            </div>
          </div>
        )}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl p-6 space-y-4 shadow-sm">
          <h3 className="text-lg font-semibold text-thai-gray-900 font-thai mb-4">ข้อมูลพื้นฐาน</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-thai-gray-700 font-thai" htmlFor="vehicle_code">
                รหัสยานพาหนะ *
              </label>
              <input
                {...register('vehicle_code')}
                id="vehicle_code"
                readOnly
                className="
                  w-full px-4 py-3 bg-thai-gray-100/50 border border-thai-gray-200/50 rounded-xl
                  text-sm font-thai font-mono text-thai-gray-600 cursor-not-allowed backdrop-blur-sm
                "
              />
              {errors.vehicle_code && (
                <p className="text-red-500 text-xs font-thai mt-1">{errors.vehicle_code.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-thai-gray-700 font-thai" htmlFor="plate_number">
                ทะเบียนรถ *
              </label>
              <input
                {...register('plate_number')}
                id="plate_number"
                className="
                  w-full px-4 py-3 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                  text-sm font-thai transition-all duration-300 backdrop-blur-sm
                "
              />
              {errors.plate_number && (
                <p className="text-red-500 text-xs font-thai mt-1">{errors.plate_number.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-thai-gray-700 font-thai" htmlFor="vehicle_type">
                ประเภทยานพาหนะ
              </label>
              <input
                {...register('vehicle_type')}
                id="vehicle_type"
                className="
                  w-full px-4 py-3 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                  text-sm font-thai transition-all duration-300 backdrop-blur-sm
                "
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-thai-gray-700 font-thai" htmlFor="brand">
                ยี่ห้อ
              </label>
              <input
                {...register('brand')}
                id="brand"
                className="
                  w-full px-4 py-3 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                  text-sm font-thai transition-all duration-300 backdrop-blur-sm
                "
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-thai-gray-700 font-thai" htmlFor="model">
                รุ่น
              </label>
              <input
                {...register('model')}
                id="model"
                className="
                  w-full px-4 py-3 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                  text-sm font-thai transition-all duration-300 backdrop-blur-sm
                "
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-thai-gray-700 font-thai" htmlFor="year_of_manufacture">
                ปีที่ผลิต
              </label>
              <input
                type="number"
                {...register('year_of_manufacture', { valueAsNumber: true })}
                id="year_of_manufacture"
                className="
                  w-full px-4 py-3 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                  text-sm font-thai transition-all duration-300 backdrop-blur-sm
                "
              />
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl p-6 space-y-4 shadow-sm">
          <h3 className="text-lg font-semibold text-thai-gray-900 font-thai mb-4">ข้อมูลความจุและเชื้อเพลิง</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-thai-gray-700 font-thai" htmlFor="capacity_kg">
                ความจุ (กิโลกรัม)
              </label>
              <input
                type="number"
                {...register('capacity_kg', { valueAsNumber: true })}
                id="capacity_kg"
                className="
                  w-full px-4 py-3 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                  text-sm font-thai transition-all duration-300 backdrop-blur-sm
                "
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-thai-gray-700 font-thai" htmlFor="capacity_cbm">
                ความจุ (ลูกบาศก์เมตร)
              </label>
              <input
                type="number"
                {...register('capacity_cbm', { valueAsNumber: true })}
                id="capacity_cbm"
                step="0.1"
                className="
                  w-full px-4 py-3 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                  text-sm font-thai transition-all duration-300 backdrop-blur-sm
                "
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-thai-gray-700 font-thai" htmlFor="fuel_type">
                ประเภทเชื้อเพลิง
              </label>
              <select
                {...register('fuel_type')}
                id="fuel_type"
                className="
                  w-full px-4 py-3 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                  text-sm font-thai transition-all duration-300 backdrop-blur-sm
                "
              >
                <option value="">เลือกประเภทเชื้อเพลิง</option>
                <option value="Gasoline">เบนซิน</option>
                <option value="Diesel">ดีเซล</option>
                <option value="LPG">แก๊ส LPG</option>
                <option value="NGV">แก๊ส NGV</option>
                <option value="Electric">ไฟฟ้า</option>
                <option value="Hybrid">ไฮบริด</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-thai-gray-700 font-thai" htmlFor="current_status">
                สถานะ
              </label>
              <select
                {...register('current_status')}
                id="current_status"
                className="
                  w-full px-4 py-3 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                  text-sm font-thai transition-all duration-300 backdrop-blur-sm
                "
              >
                <option value="Active">ใช้งาน</option>
                <option value="Under Maintenance">อยู่ระหว่างซ่อมบำรุง</option>
                <option value="Inactive">ไม่ใช้งาน</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl p-6 space-y-4 shadow-sm">
          <h3 className="text-lg font-semibold text-thai-gray-900 font-thai mb-4">หมายเหตุเพิ่มเติม</h3>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-thai-gray-700 font-thai" htmlFor="remarks">
              หมายเหตุ
            </label>
            <textarea
              {...register('remarks')}
              id="remarks"
              rows={3}
              className="
                w-full px-4 py-3 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-xl
                focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                text-sm font-thai transition-all duration-300 backdrop-blur-sm resize-none
              "
            />
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
            icon={Save}
            className="bg-blue-500 hover:bg-blue-600 shadow-lg"
          >
            {loading ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default EditVehicleForm;
