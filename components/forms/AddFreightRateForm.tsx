'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
  Save, 
  X, 
  Calculator,
  Route,
  MapPin,
  DollarSign,
  Calendar,
  AlertCircle
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { freightRateSchema, FreightRateFormValues, PRICE_UNITS, THAI_PROVINCES, MOCK_CARRIERS } from '@/types/freight-rate-schema';

interface AddFreightRateFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const AddFreightRateForm: React.FC<AddFreightRateFormProps> = ({
  onSuccess,
  onCancel
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm<FreightRateFormValues>({
    resolver: zodResolver(freightRateSchema),
    defaultValues: {
      price_unit: 'trip',
      fuel_surcharge_rate: 5.0,
      created_by: 'current_user', // Replace with actual user
      effective_start_date: new Date().toISOString().split('T')[0]
    }
  });

  const watchedFields = watch(['base_price', 'total_distance_km', 'price_unit']);

  // Auto-calculate price per km when base_price or distance changes
  React.useEffect(() => {
    const [basePrice, distance, priceUnit] = watchedFields;
    if (basePrice && distance && priceUnit === 'trip') {
      const pricePerKm = basePrice / distance;
      setValue('calculated_price_per_km', parseFloat(pricePerKm.toFixed(2)));
    }
  }, [watchedFields, setValue]);

  const onSubmit = async (data: FreightRateFormValues) => {
    setLoading(true);
    setError(null);

    try {
      // TODO: Replace with actual API endpoint when backend is ready
      console.log('New freight rate data:', data);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock success response
      alert(`เพิ่มข้อมูลค่าขนส่ง "${data.route_name}" สำเร็จ (Demo Mode)`);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Error Message */}
      {error && (
        <div className="bg-red-50/80 backdrop-blur-sm border border-red-200/50 rounded-xl p-4">
          <div className="flex items-center space-x-3 text-red-600">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="font-thai text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* Route Information */}
      <div className="bg-blue-50/50 backdrop-blur-sm border border-blue-200/50 rounded-xl p-4">
        <div className="flex items-center space-x-2 mb-4">
          <Route className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-blue-900 font-thai">ข้อมูลเส้นทาง</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              ชื่อเส้นทางขนส่ง <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              {...register('route_name')}
              className="
                w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50
                text-sm font-thai transition-all duration-300
              "
              placeholder="เช่น กรุงเทพฯ-เชียงใหม่"
            />
            {errors.route_name && (
              <p className="mt-1 text-sm text-red-600 font-thai">{errors.route_name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              ผู้ให้บริการขนส่ง <span className="text-red-500">*</span>
            </label>
            <select
              {...register('carrier_id', { valueAsNumber: true })}
              className="
                w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50
                text-sm font-thai transition-all duration-300
              "
            >
              <option value="">เลือกผู้ให้บริการ</option>
              {MOCK_CARRIERS.map((carrier) => (
                <option key={carrier.carrier_id} value={carrier.carrier_id}>
                  {carrier.carrier_name}
                </option>
              ))}
            </select>
            {errors.carrier_id && (
              <p className="mt-1 text-sm text-red-600 font-thai">{errors.carrier_id.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              ระยะทางรวม (กม.) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              {...register('total_distance_km', { valueAsNumber: true })}
              className="
                w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50
                text-sm font-thai transition-all duration-300
              "
              placeholder="0.00"
            />
            {errors.total_distance_km && (
              <p className="mt-1 text-sm text-red-600 font-thai">{errors.total_distance_km.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Location Information */}
      <div className="bg-green-50/50 backdrop-blur-sm border border-green-200/50 rounded-xl p-4">
        <div className="flex items-center space-x-2 mb-4">
          <MapPin className="w-5 h-5 text-green-600" />
          <h3 className="text-lg font-semibold text-green-900 font-thai">ข้อมูลจุดต้นทางและปลายทาง</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              จังหวัดต้นทาง <span className="text-red-500">*</span>
            </label>
            <select
              {...register('origin_province')}
              className="
                w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50
                text-sm font-thai transition-all duration-300
              "
            >
              <option value="">เลือกจังหวัดต้นทาง</option>
              {THAI_PROVINCES.map((province) => (
                <option key={province} value={province}>
                  {province}
                </option>
              ))}
            </select>
            {errors.origin_province && (
              <p className="mt-1 text-sm text-red-600 font-thai">{errors.origin_province.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              อำเภอต้นทาง
            </label>
            <input
              type="text"
              {...register('origin_district')}
              className="
                w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50
                text-sm font-thai transition-all duration-300
              "
              placeholder="อำเภอ (ไม่จำเป็น)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              จังหวัดปลายทาง <span className="text-red-500">*</span>
            </label>
            <select
              {...register('destination_province')}
              className="
                w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50
                text-sm font-thai transition-all duration-300
              "
            >
              <option value="">เลือกจังหวัดปลายทาง</option>
              {THAI_PROVINCES.map((province) => (
                <option key={province} value={province}>
                  {province}
                </option>
              ))}
            </select>
            {errors.destination_province && (
              <p className="mt-1 text-sm text-red-600 font-thai">{errors.destination_province.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              อำเภอปลายทาง
            </label>
            <input
              type="text"
              {...register('destination_district')}
              className="
                w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50
                text-sm font-thai transition-all duration-300
              "
              placeholder="อำเภอ (ไม่จำเป็น)"
            />
          </div>
        </div>
      </div>

      {/* Pricing Information */}
      <div className="bg-orange-50/50 backdrop-blur-sm border border-orange-200/50 rounded-xl p-4">
        <div className="flex items-center space-x-2 mb-4">
          <DollarSign className="w-5 h-5 text-orange-600" />
          <h3 className="text-lg font-semibold text-orange-900 font-thai">ข้อมูลราคาค่าขนส่ง</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              หน่วยการคิดราคา <span className="text-red-500">*</span>
            </label>
            <select
              {...register('price_unit')}
              className="
                w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50
                text-sm font-thai transition-all duration-300
              "
            >
              {PRICE_UNITS.map((unit) => (
                <option key={unit.value} value={unit.value}>
                  {unit.label}
                </option>
              ))}
            </select>
            {errors.price_unit && (
              <p className="mt-1 text-sm text-red-600 font-thai">{errors.price_unit.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              ราคาหลัก (บาท) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              {...register('base_price', { valueAsNumber: true })}
              className="
                w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50
                text-sm font-thai transition-all duration-300
              "
              placeholder="0.00"
            />
            {errors.base_price && (
              <p className="mt-1 text-sm text-red-600 font-thai">{errors.base_price.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              ค่าขนส่งขั้นต่ำ (บาท)
            </label>
            <input
              type="number"
              step="0.01"
              {...register('min_charge', { valueAsNumber: true })}
              className="
                w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50
                text-sm font-thai transition-all duration-300
              "
              placeholder="0.00"
            />
            {errors.min_charge && (
              <p className="mt-1 text-sm text-red-600 font-thai">{errors.min_charge.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              ค่าจุดส่งเพิ่ม (บาท)
            </label>
            <input
              type="number"
              step="0.01"
              {...register('extra_drop_price', { valueAsNumber: true })}
              className="
                w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50
                text-sm font-thai transition-all duration-300
              "
              placeholder="0.00"
            />
            {errors.extra_drop_price && (
              <p className="mt-1 text-sm text-red-600 font-thai">{errors.extra_drop_price.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              ค่าเด็กติดรถ (บาท)
            </label>
            <input
              type="number"
              step="0.01"
              {...register('helper_price', { valueAsNumber: true })}
              className="
                w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50
                text-sm font-thai transition-all duration-300
              "
              placeholder="0.00"
            />
            {errors.helper_price && (
              <p className="mt-1 text-sm text-red-600 font-thai">{errors.helper_price.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              อัตราค่าน้ำมัน (%)
            </label>
            <input
              type="number"
              step="0.01"
              {...register('fuel_surcharge_rate', { valueAsNumber: true })}
              className="
                w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50
                text-sm font-thai transition-all duration-300
              "
              placeholder="0.00"
            />
            {errors.fuel_surcharge_rate && (
              <p className="mt-1 text-sm text-red-600 font-thai">{errors.fuel_surcharge_rate.message}</p>
            )}
          </div>
        </div>

        {/* Auto-calculated prices */}
        {watchedFields[0] && watchedFields[1] && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center space-x-2 mb-2">
              <Calculator className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800 font-thai">ราคาที่คำนวณได้</span>
            </div>
            <div className="text-sm text-blue-700 font-thai">
              ราคาต่อกิโลเมตร: {((watchedFields[0] || 0) / (watchedFields[1] || 1)).toFixed(2)} บาท/กม.
            </div>
          </div>
        )}
      </div>

      {/* Effective Dates */}
      <div className="bg-purple-50/50 backdrop-blur-sm border border-purple-200/50 rounded-xl p-4">
        <div className="flex items-center space-x-2 mb-4">
          <Calendar className="w-5 h-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-purple-900 font-thai">วันที่มีผล</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              วันที่เริ่มใช้ราคา <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              {...register('effective_start_date')}
              className="
                w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50
                text-sm font-thai transition-all duration-300
              "
            />
            {errors.effective_start_date && (
              <p className="mt-1 text-sm text-red-600 font-thai">{errors.effective_start_date.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              วันที่สิ้นสุดราคา
            </label>
            <input
              type="date"
              {...register('effective_end_date')}
              className="
                w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50
                text-sm font-thai transition-all duration-300
              "
            />
            {errors.effective_end_date && (
              <p className="mt-1 text-sm text-red-600 font-thai">{errors.effective_end_date.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
          หมายเหตุ
        </label>
        <textarea
          {...register('notes')}
          rows={3}
          className="
            w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
            focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50
            text-sm font-thai transition-all duration-300
          "
          placeholder="หมายเหตุเพิ่มเติม..."
        />
      </div>

      {/* Form Actions */}
      <div className="flex justify-end space-x-3 pt-4 border-t border-thai-gray-200">
        <Button
          type="button"
          variant="outline"
          icon={X}
          onClick={onCancel}
          disabled={loading}
        >
          ยกเลิก
        </Button>
        <Button
          type="submit"
          variant="primary"
          icon={Save}
          loading={loading}
          className="bg-blue-500 hover:bg-blue-600"
        >
          {loading ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
        </Button>
      </div>
    </form>
  );
};

export default AddFreightRateForm;