import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { assetSchema, AssetFormValues, ASSET_TYPES, ASSET_STATUS, FUEL_TYPES } from '@/types/asset-schema';
import Button from '@/components/ui/Button';
import { Save, X, AlertCircle } from 'lucide-react';

interface EditAssetFormProps {
  asset: any; // Asset data to edit
  onSuccess?: () => void;
  onCancel: () => void;
}

const EditAssetForm: React.FC<EditAssetFormProps> = ({ asset, onSuccess, onCancel }) => {
  const { register, handleSubmit, formState: { errors } } = useForm<AssetFormValues>({
    resolver: zodResolver(assetSchema),
    defaultValues: {
      ...asset,
      created_by: asset.created_by || 'admin@austamgood.com',
    },
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (data: AssetFormValues) => {
    setLoading(true);
    setError(null);

    try {
      // TODO: Replace with actual API endpoint when backend is ready
      const response = await fetch(`/api/master-asset/${asset.asset_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        alert('แก้ไขข้อมูลทรัพย์สินสำเร็จ');
        if (onSuccess) onSuccess();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'เกิดข้อผิดพลาดในการแก้ไขข้อมูล');
      }
    } catch (err) {
      // For now, simulate successful update since API doesn't exist yet
      console.log('Asset data to be updated:', { id: asset.asset_id, ...data });
      alert('แก้ไขข้อมูลทรัพย์สินสำเร็จ (Demo Mode)');
      if (onSuccess) onSuccess();
    } finally {
      setLoading(false);
    }
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
              <span className="font-thai text-sm">{error}</span>
            </div>
          </div>
        )}

        {/* Basic Information */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl p-6 space-y-4 shadow-sm">
          <h3 className="text-lg font-semibold text-thai-gray-900 font-thai mb-4">ข้อมูลพื้นฐาน</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-thai-gray-700 font-thai" htmlFor="asset_code">
                รหัสทรัพย์สิน *
              </label>
              <input
                {...register('asset_code')}
                id="asset_code"
                readOnly
                className="
                  w-full px-4 py-3 bg-thai-gray-100/50 border border-thai-gray-200/50 rounded-xl
                  text-sm font-thai font-mono text-thai-gray-600 cursor-not-allowed backdrop-blur-sm
                "
              />
              {errors.asset_code && (
                <p className="text-red-500 text-xs font-thai mt-1">{errors.asset_code.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-thai-gray-700 font-thai" htmlFor="asset_name">
                ชื่อทรัพย์สิน *
              </label>
              <input
                {...register('asset_name')}
                id="asset_name"
                className="
                  w-full px-4 py-3 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                  text-sm font-thai transition-all duration-300 backdrop-blur-sm
                "
              />
              {errors.asset_name && (
                <p className="text-red-500 text-xs font-thai mt-1">{errors.asset_name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-thai-gray-700 font-thai" htmlFor="asset_type">
                ประเภททรัพย์สิน *
              </label>
              <select
                {...register('asset_type')}
                id="asset_type"
                className="
                  w-full px-4 py-3 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                  text-sm font-thai transition-all duration-300 backdrop-blur-sm
                "
              >
                <option value="">เลือกประเภททรัพย์สิน</option>
                {ASSET_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              {errors.asset_type && (
                <p className="text-red-500 text-xs font-thai mt-1">{errors.asset_type.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-thai-gray-700 font-thai" htmlFor="status">
                สถานะ
              </label>
              <select
                {...register('status')}
                id="status"
                className="
                  w-full px-4 py-3 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                  text-sm font-thai transition-all duration-300 backdrop-blur-sm
                "
              >
                {ASSET_STATUS.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="block text-sm font-medium text-thai-gray-700 font-thai" htmlFor="description">
                รายละเอียด
              </label>
              <textarea
                {...register('description')}
                id="description"
                rows={3}
                className="
                  w-full px-4 py-3 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                  text-sm font-thai transition-all duration-300 backdrop-blur-sm resize-none
                "
              />
            </div>
          </div>
        </div>

        {/* Technical Specifications */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl p-6 space-y-4 shadow-sm">
          <h3 className="text-lg font-semibold text-thai-gray-900 font-thai mb-4">ข้อมูลทางเทคนิค</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <label className="block text-sm font-medium text-thai-gray-700 font-thai" htmlFor="serial_number">
                หมายเลขซีเรียล
              </label>
              <input
                {...register('serial_number')}
                id="serial_number"
                className="
                  w-full px-4 py-3 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                  text-sm font-thai transition-all duration-300 backdrop-blur-sm
                "
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-thai-gray-700 font-thai" htmlFor="capacity_spec">
                ข้อมูลความจุ/สเปค
              </label>
              <input
                {...register('capacity_spec')}
                id="capacity_spec"
                className="
                  w-full px-4 py-3 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                  text-sm font-thai transition-all duration-300 backdrop-blur-sm
                "
              />
            </div>
          </div>
        </div>

        {/* Purchase and Warranty Information */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl p-6 space-y-4 shadow-sm">
          <h3 className="text-lg font-semibold text-thai-gray-900 font-thai mb-4">ข้อมูลการซื้อและรับประกัน</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-thai-gray-700 font-thai" htmlFor="purchase_date">
                วันที่จัดซื้อ
              </label>
              <input
                type="date"
                {...register('purchase_date')}
                id="purchase_date"
                className="
                  w-full px-4 py-3 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                  text-sm font-thai transition-all duration-300 backdrop-blur-sm
                "
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-thai-gray-700 font-thai" htmlFor="warranty_expiry_date">
                วันหมดอายุรับประกัน
              </label>
              <input
                type="date"
                {...register('warranty_expiry_date')}
                id="warranty_expiry_date"
                className="
                  w-full px-4 py-3 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                  text-sm font-thai transition-all duration-300 backdrop-blur-sm
                "
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-thai-gray-700 font-thai" htmlFor="safety_certificate_expiry">
                วันหมดอายุใบรับรองความปลอดภัย
              </label>
              <input
                type="date"
                {...register('safety_certificate_expiry')}
                id="safety_certificate_expiry"
                className="
                  w-full px-4 py-3 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                  text-sm font-thai transition-all duration-300 backdrop-blur-sm
                "
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-thai-gray-700 font-thai" htmlFor="last_maintenance_date">
                วันที่บำรุงรักษาล่าสุด
              </label>
              <input
                type="date"
                {...register('last_maintenance_date')}
                id="last_maintenance_date"
                className="
                  w-full px-4 py-3 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                  text-sm font-thai transition-all duration-300 backdrop-blur-sm
                "
              />
            </div>
          </div>
        </div>

        {/* Maintenance and Additional Information */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl p-6 space-y-4 shadow-sm">
          <h3 className="text-lg font-semibold text-thai-gray-900 font-thai mb-4">การบำรุงรักษาและข้อมูลเพิ่มเติม</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-thai-gray-700 font-thai" htmlFor="maintenance_schedule">
                รอบการบำรุงรักษา
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
              />
            </div>

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
            {loading ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default EditAssetForm;