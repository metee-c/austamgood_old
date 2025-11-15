'use client';

import React, { useState, useEffect } from 'react';
import { useForm, UseFormRegister, FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { EmployeeSchema, Employee } from '@/types/employee-schema';
import Button from '@/components/ui/Button';
import { Save, X } from 'lucide-react';

interface EditEmployeeFormProps {
  employee: Employee;
  onSuccess?: () => void;
  onCancel: () => void;
}

const EditEmployeeForm: React.FC<EditEmployeeFormProps> = ({ employee, onSuccess, onCancel }) => {
  const { register, handleSubmit, formState: { errors }, reset } = useForm<Employee>({
    resolver: zodResolver(EmployeeSchema),
    defaultValues: employee,
  });

  useEffect(() => {
    reset(employee);
  }, [employee, reset]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (data: Employee) => {
    setLoading(true);
    setError(null);
    const response = await fetch('/api/master-employee', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...employee, ...data }),
    });

    if (response.ok) {
      alert('แก้ไขข้อมูลพนักงานสำเร็จ');
      if (onSuccess) onSuccess();
    } else {
      const errorData = await response.json();
      setError(errorData.error?.message || 'An unknown error occurred');
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
        </div>
      )}

      {/* Personal Information */}
      <div className="p-4 border rounded-lg">
        <h3 className="text-lg font-medium mb-4">ข้อมูลส่วนตัว</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InputField label="รหัสพนักงาน" name="employee_code" register={register} errors={errors} placeholder="e.g., EMP001" required />
          <div>
            <label className="block text-sm font-medium text-gray-700">คำนำหน้าชื่อ</label>
            <select {...register('prefix')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
              <option value="Mr">Mr</option>
              <option value="Mrs">Mrs</option>
              <option value="Ms">Ms</option>
              <option value="อื่นๆ">อื่นๆ</option>
            </select>
          </div>
          <InputField label="ชื่อ" name="first_name" register={register} errors={errors} required />
          <InputField label="นามสกุล" name="last_name" register={register} errors={errors} required />
          <InputField label="ชื่อเล่น" name="nickname" register={register} errors={errors} />
          <div>
            <label className="block text-sm font-medium text-gray-700">เพศ</label>
            <select {...register('gender')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
              <option value="male">ชาย</option>
              <option value="female">หญิง</option>
              <option value="other">อื่น ๆ</option>
            </select>
          </div>
          <InputField label="วันเกิด" name="date_of_birth" type="date" register={register} errors={errors} />
          <InputField label="เลขบัตรประชาชน/พาสปอร์ต" name="national_id" register={register} errors={errors} />
          <InputField label="เบอร์โทร" name="phone_number" register={register} errors={errors} />
          <InputField label="อีเมล" name="email" type="email" register={register} errors={errors} />
          <InputField label="ที่อยู่" name="address" register={register} errors={errors} isTextArea />
        </div>
      </div>

      {/* Emergency Contact */}
      <div className="p-4 border rounded-lg">
        <h3 className="text-lg font-medium mb-4">ผู้ติดต่อกรณีฉุกเฉิน</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField label="ชื่อผู้ติดต่อ" name="emergency_contact_name" register={register} errors={errors} />
            <InputField label="เบอร์โทรผู้ติดต่อ" name="emergency_contact_phone" register={register} errors={errors} />
        </div>
      </div>

      {/* Employment Details */}
      <div className="p-4 border rounded-lg">
        <h3 className="text-lg font-medium mb-4">ข้อมูลการจ้างงาน</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InputField label="วันที่เริ่มงาน" name="hire_date" type="date" register={register} errors={errors} />
            <div>
                <label className="block text-sm font-medium text-gray-700">ประเภทการจ้าง</label>
                <select {...register('employment_type')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    <option value="permanent">Permanent</option>
                    <option value="contract">Contract</option>
                    <option value="part-time">Part-time</option>
                    <option value="temporary">Temporary</option>
                </select>
            </div>
            <InputField label="ตำแหน่ง" name="position" register={register} errors={errors} />
            <InputField label="แผนก" name="department" register={register} errors={errors} />
            <div>
                <label className="block text-sm font-medium text-gray-700">บทบาท WMS</label>
                <select {...register('wms_role')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    <option value="supervisor">Supervisor</option>
                    <option value="operator">Operator</option>
                    <option value="picker">Picker</option>
                    <option value="driver">Driver</option>
                    <option value="forklift">Forklift</option>
                    <option value="other">Other</option>
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700">ประเภทกะ</label>
                <select {...register('shift_type')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    <option value="day">Day</option>
                    <option value="night">Night</option>
                    <option value="rotating">Rotating</option>
                </select>
            </div>
        </div>
      </div>

      {/* System and Other Details */}
      <div className="p-4 border rounded-lg">
        <h3 className="text-lg font-medium mb-4">ข้อมูลอื่น ๆ</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField label="ลิงก์รูปภาพ" name="profile_photo_url" register={register} errors={errors} />
            <InputField label="รหัสอุปกรณ์ RF" name="rf_device_id" register={register} errors={errors} />
            <InputField label="รหัสบาร์โค้ด" name="barcode_id" register={register} errors={errors} />
            <InputField label="ใบรับรอง" name="training_certifications" register={register} errors={errors} isTextArea />
            <InputField label="หมายเหตุ" name="remarks" register={register} errors={errors} isTextArea />
        </div>
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel} icon={X}>ยกเลิก</Button>
        <Button type="submit" variant="primary" loading={loading} icon={Save}>{loading ? 'กำลังบันทึก...' : 'บันทึก'}</Button>
      </div>
    </form>
  );
};

interface InputFieldProps {
  label: string;
  name: keyof Employee;
  register: UseFormRegister<Employee>;
  errors: FieldErrors<Employee>;
  required?: boolean;
  type?: string;
  placeholder?: string;
  isTextArea?: boolean;
}

const InputField: React.FC<InputFieldProps> = ({ label, name, register, errors, required = false, type = 'text', placeholder = '', isTextArea = false }) => {
    const Component = isTextArea ? 'textarea' : 'input';
    return (
        <div>
            <label htmlFor={name} className="block text-sm font-medium text-gray-700">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            <Component
                {...register(name)}
                id={name}
                type={type}
                placeholder={placeholder}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                rows={isTextArea ? 3 : undefined}
            />
            {errors[name] && <p className="mt-2 text-sm text-red-600">{(errors[name].message as string) || ''}</p>}
        </div>
    );
};

export default EditEmployeeForm;
