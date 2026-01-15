
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { customerSchema, CustomerFormValues } from '@/types/customer-schema';
import Button from '@/components/ui/Button';
import { Save, X, AlertCircle } from 'lucide-react';

interface EditCustomerFormProps {
  customer: CustomerFormValues;
  onSuccess?: () => void;
  onCancel: () => void;
}

const EditCustomerForm: React.FC<EditCustomerFormProps> = ({ customer, onSuccess, onCancel }) => {
  const { register, handleSubmit, formState: { errors } } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: customer,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (data: CustomerFormValues) => {
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/master-customer`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      }
    );

    if (response.ok) {
      alert('แก้ไขข้อมูลลูกค้าสำเร็จ');
      if (onSuccess) onSuccess();
    } else {
      const errorData = await response.json();
      setError(errorData.error);
    }
    setLoading(false);
  };

  return (
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
      <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl p-6 space-y-6 shadow-sm">
         <div className="flex items-center space-x-3">
          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
          <h4 className="text-lg font-semibold text-thai-gray-900 font-thai">ข้อมูลพื้นฐาน</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="customer_id" className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">รหัสลูกค้า</label>
            <input {...register('customer_id')} id="customer_id" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm bg-gray-100" readOnly />
          </div>
          <div>
            <label htmlFor="customer_code" className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">โค้ดลูกค้า</label>
            <input {...register('customer_code')} id="customer_code" className="w-full px-3 py-2 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80 text-sm font-thai transition-all duration-300 backdrop-blur-sm" />
            {errors.customer_code && <p className="text-red-500 text-xs mt-1">{errors.customer_code.message}</p>}
          </div>
          <div>
            <label htmlFor="customer_name" className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">ชื่อลูกค้า</label>
            <input {...register('customer_name')} id="customer_name" className="w-full px-3 py-2 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80 text-sm font-thai transition-all duration-300 backdrop-blur-sm" />
            {errors.customer_name && <p className="text-red-500 text-xs mt-1">{errors.customer_name.message}</p>}
          </div>
          <div>
            <label htmlFor="customer_type" className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">ประเภทลูกค้า</label>
            <select {...register('customer_type')} id="customer_type" className="w-full px-3 py-2 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80 text-sm font-thai transition-all duration-300 backdrop-blur-sm">
              <option value="retail">Retail</option>
              <option value="wholesale">Wholesale</option>
              <option value="distributor">Distributor</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label htmlFor="business_reg_no" className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">เลขทะเบียนธุรกิจ</label>
            <input {...register('business_reg_no')} id="business_reg_no" className="w-full px-3 py-2 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80 text-sm font-thai transition-all duration-300 backdrop-blur-sm" />
          </div>
          <div>
            <label htmlFor="tax_id" className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">เลขประจำตัวผู้เสียภาษี</label>
            <input {...register('tax_id')} id="tax_id" className="w-full px-3 py-2 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80 text-sm font-thai transition-all duration-300 backdrop-blur-sm" />
          </div>
        </div>
      </div>
      <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl p-6 space-y-6 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <h4 className="text-lg font-semibold text-thai-gray-900 font-thai">ข้อมูลติดต่อ</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="contact_person" className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">ผู้ติดต่อ</label>
            <input {...register('contact_person')} id="contact_person" className="w-full px-3 py-2 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80 text-sm font-thai transition-all duration-300 backdrop-blur-sm" />
          </div>
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">เบอร์โทรศัพท์</label>
            <input {...register('phone')} id="phone" className="w-full px-3 py-2 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80 text-sm font-thai transition-all duration-300 backdrop-blur-sm" />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">อีเมล</label>
            <input {...register('email')} id="email" className="w-full px-3 py-2 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80 text-sm font-thai transition-all duration-300 backdrop-blur-sm" />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label htmlFor="line_id" className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">Line ID</label>
            <input {...register('line_id')} id="line_id" className="w-full px-3 py-2 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80 text-sm font-thai transition-all duration-300 backdrop-blur-sm" />
          </div>
          <div>
            <label htmlFor="website" className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">เว็บไซต์</label>
            <input {...register('website')} id="website" className="w-full px-3 py-2 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80 text-sm font-thai transition-all duration-300 backdrop-blur-sm" />
            {errors.website && <p className="text-red-500 text-xs mt-1">{errors.website.message}</p>}
          </div>
        </div>
      </div>
      <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl p-6 space-y-6 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
          <h4 className="text-lg font-semibold text-thai-gray-900 font-thai">ที่อยู่</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="billing_address" className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">ที่อยู่สำหรับออกบิล</label>
            <textarea {...register('billing_address')} id="billing_address" rows={3} className="w-full px-3 py-2 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80 text-sm font-thai transition-all duration-300 backdrop-blur-sm" />
          </div>
          <div>
            <label htmlFor="shipping_address" className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">ที่อยู่สำหรับจัดส่ง</label>
            <textarea {...register('shipping_address')} id="shipping_address" rows={3} className="w-full px-3 py-2 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80 text-sm font-thai transition-all duration-300 backdrop-blur-sm" />
          </div>
          <div>
            <label htmlFor="province" className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">จังหวัด</label>
            <input {...register('province')} id="province" className="w-full px-3 py-2 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80 text-sm font-thai transition-all duration-300 backdrop-blur-sm" />
          </div>
          <div>
            <label htmlFor="district" className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">อำเภอ</label>
            <input {...register('district')} id="district" className="w-full px-3 py-2 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80 text-sm font-thai transition-all duration-300 backdrop-blur-sm" />
          </div>
          <div>
            <label htmlFor="subdistrict" className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">ตำบล</label>
            <input {...register('subdistrict')} id="subdistrict" className="w-full px-3 py-2 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80 text-sm font-thai transition-all duration-300 backdrop-blur-sm" />
          </div>
          <div>
            <label htmlFor="postal_code" className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">รหัสไปรษณีย์</label>
            <input {...register('postal_code')} id="postal_code" className="w-full px-3 py-2 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80 text-sm font-thai transition-all duration-300 backdrop-blur-sm" />
          </div>
          <div>
            <label htmlFor="latitude" className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">ละติจูด</label>
            <input {...register('latitude', { valueAsNumber: true })} id="latitude" type="number" step="any" placeholder="เช่น 13.7563" className="w-full px-3 py-2 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80 text-sm font-thai transition-all duration-300 backdrop-blur-sm placeholder:text-thai-gray-400" />
          </div>
          <div>
            <label htmlFor="longitude" className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">ลองจิจูด</label>
            <input {...register('longitude', { valueAsNumber: true })} id="longitude" type="number" step="any" placeholder="เช่น 100.5018" className="w-full px-3 py-2 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80 text-sm font-thai transition-all duration-300 backdrop-blur-sm placeholder:text-thai-gray-400" />
          </div>
        </div>
      </div>
       <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl p-6 space-y-6 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
          <h4 className="text-lg font-semibold text-thai-gray-900 font-thai">ข้อมูลอื่นๆ</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label htmlFor="delivery_instructions" className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">คำแนะนำการจัดส่ง</label>
                <input {...register('delivery_instructions')} id="delivery_instructions" className="w-full px-3 py-2 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80 text-sm font-thai transition-all duration-300 backdrop-blur-sm" />
            </div>
            <div>
                <label htmlFor="preferred_delivery_time" className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">เวลาจัดส่งที่ต้องการ</label>
                <input {...register('preferred_delivery_time')} id="preferred_delivery_time" className="w-full px-3 py-2 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80 text-sm font-thai transition-all duration-300 backdrop-blur-sm" />
            </div>
            <div>
                <label htmlFor="channel_source" className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">ช่องทาง</label>
                <input {...register('channel_source')} id="channel_source" className="w-full px-3 py-2 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80 text-sm font-thai transition-all duration-300 backdrop-blur-sm" />
            </div>
            <div>
                <label htmlFor="customer_segment" className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">กลุ่มลูกค้า</label>
                <input {...register('customer_segment')} id="customer_segment" className="w-full px-3 py-2 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80 text-sm font-thai transition-all duration-300 backdrop-blur-sm" />
            </div>
            <div>
                <label htmlFor="status" className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">สถานะ</label>
                <select {...register('status')} id="status" className="w-full px-3 py-2 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80 text-sm font-thai transition-all duration-300 backdrop-blur-sm">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                </select>
            </div>
            <div>
                <label htmlFor="hub" className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">Hub</label>
                <input {...register('hub')} id="hub" placeholder="เช่น BKK, CNX, HKT" className="w-full px-3 py-2 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80 text-sm font-thai transition-all duration-300 backdrop-blur-sm placeholder:text-thai-gray-400" />
            </div>
            <div>
                <label htmlFor="remarks" className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">หมายเหตุ</label>
                <textarea {...register('remarks')} id="remarks" rows={3} className="w-full px-3 py-2 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80 text-sm font-thai transition-all duration-300 backdrop-blur-sm" />
            </div>
        </div>
      </div>
      <div className="flex justify-end space-x-3 pt-4 border-t border-thai-gray-200/50">
        <Button 
          type="button" 
          variant="outline" 
          onClick={onCancel} 
          icon={X}
          className="bg-white/50 hover:bg-white/80 border-white/30 backdrop-blur-sm shadow-sm"
        >
          ยกเลิก
        </Button>
        <Button 
          type="submit" 
          variant="primary" 
          icon={Save} 
          loading={loading}
          className="bg-blue-500 hover:bg-blue-600 shadow-lg"
        >
          {loading ? 'กำลังบันทึก...' : 'บันทึก'}
        </Button>
      </div>
    </form>
  );
};

export default EditCustomerForm;
