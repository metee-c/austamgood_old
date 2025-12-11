
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { vehicleSchema, VehicleFormValues } from '@/types/vehicle-schema';
import Button from '@/components/ui/Button';
import { Save, X, AlertCircle, Truck, Package, MapPin, Calendar } from 'lucide-react';

interface AddVehicleFormProps {
  onSuccess?: () => void;
  onCancel: () => void;
}

const AddVehicleForm: React.FC<AddVehicleFormProps> = ({ onSuccess, onCancel }) => {
  const { register, handleSubmit, formState: { errors } } = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      current_status: 'Active',
      created_by: 'admin@austamgood.com', // This should be replaced with the current user
    },
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (data: VehicleFormValues) => {
    setLoading(true);
    setError(null);
    const response = await fetch('/api/master-vehicle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      alert('เพิ่มข้อมูลยานพาหนะสำเร็จ');
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

        {/* ข้อมูลพื้นฐาน */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Truck className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-thai-gray-900 font-thai">ข้อมูลพื้นฐาน</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-thai-gray-700 font-thai" htmlFor="vehicle_code">
                รหัสยานพาหนะ *
              </label>
              <input
                {...register('vehicle_code')}
                id="vehicle_code"
                placeholder="เช่น VH001"
                className="
                  w-full px-4 py-3 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                  text-sm font-thai transition-all duration-300 backdrop-blur-sm
                  placeholder:text-thai-gray-400
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
                placeholder="เช่น กข1234"
                className="
                  w-full px-4 py-3 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                  text-sm font-thai transition-all duration-300 backdrop-blur-sm
                  placeholder:text-thai-gray-400
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
                placeholder="เช่น รถบรรทุก, รถตู้, รถกระบะ"
                className="
                  w-full px-4 py-3 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                  text-sm font-thai transition-all duration-300 backdrop-blur-sm
                  placeholder:text-thai-gray-400
                "
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-thai-gray-700 font-thai" htmlFor="brand">
                บริษัทขนส่ง
              </label>
              <input
                {...register('brand')}
                id="brand"
                placeholder="เช่น ห้างหุ้นส่วนจำกัด ละอองเอก 786 โลจิสติกส์"
                className="
                  w-full px-4 py-3 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                  text-sm font-thai transition-all duration-300 backdrop-blur-sm
                  placeholder:text-thai-gray-400
                "
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-thai-gray-700 font-thai" htmlFor="model">
                ชื่อพนักงานขับรถ
              </label>
              <input
                {...register('model')}
                id="model"
                placeholder="เช่น กัมพล, เกรียงไกร"
                className="
                  w-full px-4 py-3 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                  text-sm font-thai transition-all duration-300 backdrop-blur-sm
                  placeholder:text-thai-gray-400
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
                placeholder="เช่น 2023"
                className="
                  w-full px-4 py-3 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                  text-sm font-thai transition-all duration-300 backdrop-blur-sm
                  placeholder:text-thai-gray-400
                "
              />
            </div>
          </div>
        </div>

        {/* ความจุและประสิทธิภาพ */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Package className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-thai-gray-900 font-thai">ความจุและประสิทธิภาพ</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-thai-gray-700 font-thai" htmlFor="capacity_kg">
                ความจุ (กิโลกรัม)
              </label>
              <input
                type="number"
                {...register('capacity_kg', { valueAsNumber: true })}
                id="capacity_kg"
                placeholder="เช่น 1000"
                className="
                  w-full px-4 py-3 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                  text-sm font-thai transition-all duration-300 backdrop-blur-sm
                  placeholder:text-thai-gray-400
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
                placeholder="เช่น 2.5"
                step="0.1"
                className="
                  w-full px-4 py-3 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                  text-sm font-thai transition-all duration-300 backdrop-blur-sm
                  placeholder:text-thai-gray-400
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

        {/* ข้อมูลเพิ่มเติม */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-thai-gray-900 font-thai">ข้อมูลเพิ่มเติม</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-thai-gray-700 font-thai" htmlFor="driver_id">
                พนักงานขับรถ (ID)
              </label>
              <input
                type="number"
                {...register('driver_id', { valueAsNumber: true })}
                id="driver_id"
                className="
                  w-full px-4 py-3 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                  text-sm font-thai transition-all duration-300 backdrop-blur-sm
                "
                placeholder="ระบุ ID พนักงานขับ"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-thai-gray-700 font-thai" htmlFor="gps_device_id">
                รหัส GPS Device
              </label>
              <input
                {...register('gps_device_id')}
                id="gps_device_id"
                className="
                  w-full px-4 py-3 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                  text-sm font-thai font-mono transition-all duration-300 backdrop-blur-sm
                "
                placeholder="เช่น GPS-12345"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-thai-gray-700 font-thai" htmlFor="location_base_id">
                ฐานที่ตั้ง (Location Base)
              </label>
              <input
                {...register('location_base_id')}
                id="location_base_id"
                className="
                  w-full px-4 py-3 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                  text-sm font-thai font-mono transition-all duration-300 backdrop-blur-sm
                "
                placeholder="เช่น BASE-01"
              />
            </div>
          </div>
        </div>

        {/* เอกสารและการบำรุงรักษา */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-orange-600" />
            </div>
            <h3 className="text-lg font-semibold text-thai-gray-900 font-thai">เอกสารและการบำรุงรักษา</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-thai-gray-700 font-thai" htmlFor="registration_expiry_date">
                วันหมดอายุทะเบียน
              </label>
              <input
                type="date"
                {...register('registration_expiry_date')}
                id="registration_expiry_date"
                className="
                  w-full px-4 py-3 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                  text-sm font-thai transition-all duration-300 backdrop-blur-sm
                "
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-thai-gray-700 font-thai" htmlFor="insurance_expiry_date">
                วันหมดอายุประกันภัย
              </label>
              <input
                type="date"
                {...register('insurance_expiry_date')}
                id="insurance_expiry_date"
                className="
                  w-full px-4 py-3 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                  text-sm font-thai transition-all duration-300 backdrop-blur-sm
                "
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-medium text-thai-gray-700 font-thai" htmlFor="maintenance_schedule">
                กำหนดการซ่อมบำรุง
              </label>
              <textarea
                {...register('maintenance_schedule')}
                id="maintenance_schedule"
                rows={2}
                className="
                  w-full px-4 py-3 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                  text-sm font-thai transition-all duration-300 backdrop-blur-sm resize-none
                "
                placeholder="ระบุกำหนดการซ่อมบำรุง เช่น ทุกๆ 10,000 กม."
              />
            </div>
          </div>
        </div>

        {/* หมายเหตุ */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-gray-600" />
            </div>
            <h3 className="text-lg font-semibold text-thai-gray-900 font-thai">หมายเหตุเพิ่มเติม</h3>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-thai-gray-700 font-thai" htmlFor="remarks">
              หมายเหตุ
            </label>
            <textarea
              {...register('remarks')}
              id="remarks"
              rows={3}
              placeholder="ข้อมูลเพิ่มเติมหรือหมายเหตุพิเศษ"
              className="
                w-full px-4 py-3 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-xl
                focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                text-sm font-thai transition-all duration-300 backdrop-blur-sm resize-none
                placeholder:text-thai-gray-400
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

export default AddVehicleForm;
