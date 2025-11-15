'use client';

import React, { useState, useEffect } from 'react';
import { useForm, UseFormRegister, FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CustomerNoPriceGoodsSchema, CustomerNoPriceGoods } from '@/types/customer-no-price-goods-schema';
import Button from '@/components/ui/Button';
import { Save, X, User, FileText, Calendar, AlertTriangle, Package } from 'lucide-react';

interface EditCustomerNoPriceGoodsFormProps {
  customer: CustomerNoPriceGoods;
  onSuccess?: () => void;
  onCancel: () => void;
}

const EditCustomerNoPriceGoodsForm: React.FC<EditCustomerNoPriceGoodsFormProps> = ({ customer, onSuccess, onCancel }) => {
  const { register, handleSubmit, formState: { errors }, reset } = useForm<CustomerNoPriceGoods>({
    resolver: zodResolver(CustomerNoPriceGoodsSchema),
    defaultValues: customer,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    reset(customer);
  }, [customer, reset]);

  const onSubmit = async (data: CustomerNoPriceGoods) => {
    setLoading(true);
    setError(null);

    try {
      const submitData = {
        ...data,
        effective_start_date: data.effective_start_date || null,
        effective_end_date: data.effective_end_date || null,
      };

      const response = await fetch('/api/master-customer-no-price-goods', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });

      if (response.ok) {
        alert('แก้ไขข้อมูลลูกค้าสำเร็จ');
        if (onSuccess) onSuccess();
      } else {
        const errorData = await response.json();
        setError(errorData.error?.message || 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ');
      }
    } catch (error) {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">ข้อผิดพลาด: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {/* Record ID Display */}
      <div className="bg-blue-100/50 backdrop-blur-sm border border-blue-300/50 rounded-lg p-3">
        <div className="flex items-center space-x-2">
          <Package className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-800">รหัสแถวข้อมูล: {customer.record_id}</span>
        </div>
      </div>

      {/* Customer Information */}
      <div className="bg-blue-50/50 backdrop-blur-sm border border-blue-200/50 rounded-xl p-6">
        <div className="flex items-center space-x-2 mb-4">
          <User className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-blue-900 font-thai">ข้อมูลลูกค้า</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputField
            label="รหัสลูกค้า"
            name="customer_id"
            register={register}
            errors={errors}
            placeholder="เช่น CUST001"
            required
          />
          <InputField
            label="ชื่อลูกค้า/ร้านค้า"
            name="customer_name"
            register={register}
            errors={errors}
            placeholder="เช่น ร้านค้าปลีกเอบีซี"
            required
          />
        </div>
      </div>

      {/* Reason and Notes */}
      <div className="bg-orange-50/50 backdrop-blur-sm border border-orange-200/50 rounded-xl p-6">
        <div className="flex items-center space-x-2 mb-4">
          <FileText className="w-5 h-5 text-orange-600" />
          <h3 className="text-lg font-semibold text-orange-900 font-thai">เหตุผลและหมายเหตุ</h3>
        </div>
        <div className="space-y-4">
          <InputField
            label="เหตุผลที่ไม่ต้องการสินค้ามีราคา"
            name="reason"
            register={register}
            errors={errors}
            placeholder="เช่น ป้องกันการแสดงราคาให้ลูกค้าปลายทาง"
            isTextArea
          />
          <InputField
            label="หมายเหตุสำหรับพนักงานจัดสินค้า"
            name="note_for_picking"
            register={register}
            errors={errors}
            placeholder="เช่น ⚠️ ห้ามวางสินค้าพร้อมสติ๊กเกอร์ราคา"
            isTextArea
          />
        </div>
      </div>

      {/* Effective Dates */}
      <div className="bg-green-50/50 backdrop-blur-sm border border-green-200/50 rounded-xl p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Calendar className="w-5 h-5 text-green-600" />
          <h3 className="text-lg font-semibold text-green-900 font-thai">ระยะเวลาการใช้งาน</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputField
            label="วันที่เริ่มมีผลบังคับ"
            name="effective_start_date"
            type="date"
            register={register}
            errors={errors}
          />
          <InputField
            label="วันที่สิ้นสุด"
            name="effective_end_date"
            type="date"
            register={register}
            errors={errors}
          />
        </div>
        <p className="text-sm text-green-600 mt-2 font-thai">
          💡 หากไม่ระบุวันที่ จะถือว่าใช้งานถาวร
        </p>
      </div>

      {/* Settings */}
      <div className="bg-purple-50/50 backdrop-blur-sm border border-purple-200/50 rounded-xl p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Package className="w-5 h-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-purple-900 font-thai">การตั้งค่า</h3>
        </div>
        <div className="flex items-center space-x-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              {...register('is_active')}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700 font-thai">ใช้งาน</span>
          </label>
        </div>
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} icon={X}>
          ยกเลิก
        </Button>
        <Button type="submit" variant="primary" loading={loading} icon={Save}>
          {loading ? 'กำลังบันทึก...' : 'บันทึก'}
        </Button>
      </div>
    </form>
  );
};

interface InputFieldProps {
  label: string;
  name: keyof CustomerNoPriceGoods;
  register: UseFormRegister<CustomerNoPriceGoods>;
  errors: FieldErrors<CustomerNoPriceGoods>;
  required?: boolean;
  type?: string;
  placeholder?: string;
  isTextArea?: boolean;
}

const InputField: React.FC<InputFieldProps> = ({
  label,
  name,
  register,
  errors,
  required = false,
  type = 'text',
  placeholder = '',
  isTextArea = false
}) => {  const Component = isTextArea ? 'textarea' : 'input';
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <Component
        {...register(name)}
        id={name}
        type={type}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
        rows={isTextArea ? 3 : undefined}
      />
      {errors[name] && (
        <p className="mt-1 text-sm text-red-600">{(errors[name] && errors[name].message as string) || ''}</p>
      )}
    </div>
  );
};

export default EditCustomerNoPriceGoodsForm;