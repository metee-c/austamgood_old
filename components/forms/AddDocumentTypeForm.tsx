'use client';

import React, { useState } from 'react';
import { useForm, UseFormRegister, FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { DocumentTypeSchema, DocumentType } from '@/types/document-type-schema';
import Button from '@/components/ui/Button';
import { Save, X, FileText, Database, Settings, Clock, FileCheck } from 'lucide-react';

interface AddDocumentTypeFormProps {
  onSuccess?: () => void;
  onCancel: () => void;
}

const AddDocumentTypeForm: React.FC<AddDocumentTypeFormProps> = ({ onSuccess, onCancel }) => {
  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<DocumentType>({
    resolver: zodResolver(DocumentTypeSchema),
    defaultValues: {
      return_required: true,
      is_active: true,
      created_by: 'current_user',
    },
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [specialCustomers, setSpecialCustomers] = useState<Array<{id: string, name: string}>>([]);
  const [requiredCaseJson, setRequiredCaseJson] = useState('');

  const addSpecialCustomer = () => {
    setSpecialCustomers([...specialCustomers, { id: '', name: '' }]);
  };

  const removeSpecialCustomer = (index: number) => {
    const newCustomers = specialCustomers.filter((_, i) => i !== index);
    setSpecialCustomers(newCustomers);
    updateSpecialCustomersData(newCustomers);
  };

  const updateSpecialCustomer = (index: number, field: 'id' | 'name', value: string) => {
    const newCustomers = [...specialCustomers];
    newCustomers[index][field] = value;
    setSpecialCustomers(newCustomers);
    updateSpecialCustomersData(newCustomers);
  };

  const updateSpecialCustomersData = (customers: Array<{id: string, name: string}>) => {
    const ids = customers.map(c => c.id).filter(id => id.trim() !== '');
    const names = customers.map(c => c.name).filter(name => name.trim() !== '');
    setValue('special_customer_ids', ids.length > 0 ? ids : undefined);
    setValue('special_customer_names', names.length > 0 ? names : undefined);
  };

  const onSubmit = async (data: DocumentType) => {
    setLoading(true);
    setError(null);

    try {
      // Parse required_case JSON if provided
      let parsedRequiredCase = null;
      if (requiredCaseJson.trim()) {
        try {
          parsedRequiredCase = JSON.parse(requiredCaseJson);
        } catch (e) {
          setError('รูปแบบ JSON ของเงื่อนไขทั่วไปไม่ถูกต้อง');
          setLoading(false);
          return;
        }
      }

      const submitData = {
        ...data,
        required_case: parsedRequiredCase,
        retention_period_months: data.retention_period_months || null,
      };

      const response = await fetch('/api/master-iv-document-type', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });

      if (response.ok) {
        alert('เพิ่มประเภทเอกสารสำเร็จ');
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

      {/* Basic Information */}
      <div className="bg-blue-50/50 backdrop-blur-sm border border-blue-200/50 rounded-xl p-6">
        <div className="flex items-center space-x-2 mb-4">
          <FileText className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-blue-900 font-thai">ข้อมูลพื้นฐาน</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputField
            label="รหัสประเภทเอกสาร"
            name="doc_type_code"
            register={register}
            errors={errors}
            placeholder="เช่น IV-ORIGINAL, COPY-ACCOUNT"
            required
          />
          <InputField
            label="ชื่อประเภทเอกสาร"
            name="doc_type_name"
            register={register}
            errors={errors}
            placeholder="เช่น ต้นฉบับอินวอยซ์, สำเนาบัญชี"
            required
          />
          <div className="md:col-span-2">
            <InputField
              label="คำอธิบาย"
              name="description"
              register={register}
              errors={errors}
              placeholder="คำอธิบายเพิ่มเติมเกี่ยวกับประเภทเอกสาร"
              isTextArea
            />
          </div>
        </div>
      </div>

      {/* Conditions */}
      <div className="bg-green-50/50 backdrop-blur-sm border border-green-200/50 rounded-xl p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Database className="w-5 h-5 text-green-600" />
          <h3 className="text-lg font-semibold text-green-900 font-thai">เงื่อนไขและข้อกำหนด</h3>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              เงื่อนไขทั่วไป (JSON Format)
            </label>
            <textarea
              value={requiredCaseJson}
              onChange={(e) => setRequiredCaseJson(e.target.value)}
              placeholder='{"payment_type": ["cash","credit"], "customer_type": ["special","normal"]}'
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
              rows={3}
            />
            <p className="text-xs text-gray-500 mt-1">
              ตัวอย่าง: {`{"payment_type": ["cash","credit"], "customer_type": ["special","normal"]}`}
            </p>
          </div>

          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                {...register('return_required')}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">ต้องดึงเอกสารกลับคืน</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                {...register('is_active')}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">ใช้งาน</span>
            </label>
          </div>
        </div>
      </div>

      {/* Special Customers */}
      <div className="bg-orange-50/50 backdrop-blur-sm border border-orange-200/50 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <FileCheck className="w-5 h-5 text-orange-600" />
            <h3 className="text-lg font-semibold text-orange-900 font-thai">ลูกค้าพิเศษ</h3>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={addSpecialCustomer}
            className="text-sm"
          >
            เพิ่มลูกค้า
          </Button>
        </div>
        <div className="space-y-3">
          {specialCustomers.map((customer, index) => (
            <div key={index} className="flex space-x-3">
              <input
                type="text"
                placeholder="รหัสลูกค้า (เช่น CUST0001)"
                value={customer.id}
                onChange={(e) => updateSpecialCustomer(index, 'id', e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="text"
                placeholder="ชื่อลูกค้า (เช่น บริษัท เอ บี ซี จำกัด)"
                value={customer.name}
                onChange={(e) => updateSpecialCustomer(index, 'name', e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => removeSpecialCustomer(index)}
                className="text-red-600 hover:bg-red-50"
              >
                ลบ
              </Button>
            </div>
          ))}
          {specialCustomers.length === 0 && (
            <p className="text-sm text-gray-500 italic">ไม่มีลูกค้าพิเศษ คลิก "เพิ่มลูกค้า" เพื่อเพิ่มลูกค้าพิเศษ</p>
          )}
        </div>
      </div>

      {/* System Settings */}
      <div className="bg-purple-50/50 backdrop-blur-sm border border-purple-200/50 rounded-xl p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Settings className="w-5 h-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-purple-900 font-thai">การตั้งค่าระบบ</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputField
            label="รหัสเทมเพลต OCR"
            name="ocr_template_id"
            register={register}
            errors={errors}
            placeholder="เช่น OCR_TEMPLATE_001"
          />
          <InputField
            label="ตำแหน่งจัดเก็บเอกสาร"
            name="storage_location"
            register={register}
            errors={errors}
            placeholder="เช่น ตู้เอกสาร A-01, /drive/path"
          />
        </div>
      </div>

      {/* Retention & Notes */}
      <div className="bg-gray-50/50 backdrop-blur-sm border border-gray-200/50 rounded-xl p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Clock className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900 font-thai">ระยะเวลาและหมายเหตุ</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputField
            label="ระยะเวลาเก็บรักษา (เดือน)"
            name="retention_period_months"
            type="number"
            register={register}
            errors={errors}
            placeholder="เช่น 36"
          />
          <div className="md:col-span-2">
            <InputField
              label="หมายเหตุ"
              name="remarks"
              register={register}
              errors={errors}
              placeholder="หมายเหตุเพิ่มเติม"
              isTextArea
            />
          </div>
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
  name: keyof DocumentType;
  register: UseFormRegister<DocumentType>;
  errors: FieldErrors<DocumentType>;
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
        {...register(name, { valueAsNumber: type === 'number' })}
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

export default AddDocumentTypeForm;