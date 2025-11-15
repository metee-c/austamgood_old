'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
  Save, 
  X, 
  AlertCircle,
  User,
  Phone,
  Briefcase,
  Settings,
  UserPlus,
  Calendar,
  MapPin,
  Badge as BadgeIcon,
  Laptop
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { EmployeeSchema, Employee } from '@/types/employee-schema';

interface AddEmployeeFormProps {
  onSuccess?: () => void;
  onCancel: () => void;
}

const AddEmployeeForm: React.FC<AddEmployeeFormProps> = ({ onSuccess, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<Employee>({
    resolver: zodResolver(EmployeeSchema),
    defaultValues: {
      prefix: 'Mr',
      gender: 'male',
      employment_type: 'permanent',
      wms_role: 'operator',
      shift_type: 'day',
      created_by: 'current_user', // Replace with actual user
      hire_date: new Date().toISOString().split('T')[0]
    }
  });

  const onSubmit = async (data: Employee) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/master-employee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        alert('เพิ่มข้อมูลพนักงานสำเร็จ');
        if (onSuccess) onSuccess();
      } else {
        const errorData = await response.json();
        console.error("Server error:", errorData);
        const errorMessage = errorData.error?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล';
        setError(errorMessage);
      }
    } catch (e) {
      console.error("Network or other error:", e);
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
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

      {/* Personal Information */}
      <div className="bg-blue-50/50 backdrop-blur-sm border border-blue-200/50 rounded-xl p-4">
        <div className="flex items-center space-x-2 mb-4">
          <User className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-blue-900 font-thai">ข้อมูลส่วนตัว</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              รหัสพนักงาน <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              {...register('employee_code')}
              className="
                w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50
                text-sm font-thai transition-all duration-300
              "
              placeholder="เช่น EMP001"
            />
            {errors.employee_code && (
              <p className="mt-1 text-sm text-red-600 font-thai">{errors.employee_code.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              คำนำหน้าชื่อ <span className="text-red-500">*</span>
            </label>
            <select
              {...register('prefix')}
              className="
                w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50
                text-sm font-thai transition-all duration-300
              "
            >
              <option value="Mr">นาย</option>
              <option value="Mrs">นาง</option>
              <option value="Ms">นางสาว</option>
              <option value="อื่นๆ">อื่นๆ</option>
            </select>
            {errors.prefix && (
              <p className="mt-1 text-sm text-red-600 font-thai">{errors.prefix.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              เพศ
            </label>
            <select
              {...register('gender')}
              className="
                w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50
                text-sm font-thai transition-all duration-300
              "
            >
              <option value="male">ชาย</option>
              <option value="female">หญิง</option>
              <option value="other">อื่นๆ</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              ชื่อ <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              {...register('first_name')}
              className="
                w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50
                text-sm font-thai transition-all duration-300
              "
              placeholder="ชื่อจริง"
            />
            {errors.first_name && (
              <p className="mt-1 text-sm text-red-600 font-thai">{errors.first_name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              นามสกุล <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              {...register('last_name')}
              className="
                w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50
                text-sm font-thai transition-all duration-300
              "
              placeholder="นามสกุล"
            />
            {errors.last_name && (
              <p className="mt-1 text-sm text-red-600 font-thai">{errors.last_name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              ชื่อเล่น
            </label>
            <input
              type="text"
              {...register('nickname')}
              className="
                w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50
                text-sm font-thai transition-all duration-300
              "
              placeholder="ชื่อเล่น"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              วันเกิด
            </label>
            <input
              type="date"
              {...register('date_of_birth')}
              className="
                w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50
                text-sm font-thai transition-all duration-300
              "
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              เลขบัตรประชาชน
            </label>
            <input
              type="text"
              {...register('national_id')}
              className="
                w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50
                text-sm font-thai transition-all duration-300
              "
              placeholder="1234567890123"
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              ที่อยู่
            </label>
            <textarea
              {...register('address')}
              rows={3}
              className="
                w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50
                text-sm font-thai transition-all duration-300
              "
              placeholder="ที่อยู่ปัจจุบัน..."
            />
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <div className="bg-green-50/50 backdrop-blur-sm border border-green-200/50 rounded-xl p-4">
        <div className="flex items-center space-x-2 mb-4">
          <Phone className="w-5 h-5 text-green-600" />
          <h3 className="text-lg font-semibold text-green-900 font-thai">ข้อมูลการติดต่อ</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              เบอร์โทรศัพท์
            </label>
            <input
              type="tel"
              {...register('phone_number')}
              className="
                w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50
                text-sm font-thai transition-all duration-300
              "
              placeholder="081-234-5678"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              อีเมล
            </label>
            <input
              type="email"
              {...register('email')}
              className="
                w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50
                text-sm font-thai transition-all duration-300
              "
              placeholder="example@company.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              ชื่อผู้ติดต่อฉุกเฉิน
            </label>
            <input
              type="text"
              {...register('emergency_contact_name')}
              className="
                w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50
                text-sm font-thai transition-all duration-300
              "
              placeholder="ชื่อผู้ติดต่อฉุกเฉิน"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              เบอร์โทรผู้ติดต่อฉุกเฉิน
            </label>
            <input
              type="tel"
              {...register('emergency_contact_phone')}
              className="
                w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50
                text-sm font-thai transition-all duration-300
              "
              placeholder="081-234-5678"
            />
          </div>
        </div>
      </div>

      {/* Employment Information */}
      <div className="bg-orange-50/50 backdrop-blur-sm border border-orange-200/50 rounded-xl p-4">
        <div className="flex items-center space-x-2 mb-4">
          <Briefcase className="w-5 h-5 text-orange-600" />
          <h3 className="text-lg font-semibold text-orange-900 font-thai">ข้อมูลการจ้างงาน</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              วันที่เริ่มงาน
            </label>
            <input
              type="date"
              {...register('hire_date')}
              className="
                w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50
                text-sm font-thai transition-all duration-300
              "
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              ประเภทการจ้าง
            </label>
            <select
              {...register('employment_type')}
              className="
                w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50
                text-sm font-thai transition-all duration-300
              "
            >
              <option value="permanent">พนักงานประจำ</option>
              <option value="contract">พนักงานสัญญา</option>
              <option value="part-time">งานพาร์ทไทม์</option>
              <option value="temporary">พนักงานชั่วคราว</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              ประเภทกะ
            </label>
            <select
              {...register('shift_type')}
              className="
                w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50
                text-sm font-thai transition-all duration-300
              "
            >
              <option value="day">กะกลางวัน</option>
              <option value="night">กะกลางคืน</option>
              <option value="rotating">กะหมุนเวียน</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              ตำแหน่งงาน
            </label>
            <input
              type="text"
              {...register('position')}
              className="
                w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50
                text-sm font-thai transition-all duration-300
              "
              placeholder="เช่น หัวหน้าคลัง"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              แผนก
            </label>
            <select
              {...register('department')}
              className="
                w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50
                text-sm font-thai transition-all duration-300
              "
            >
              <option value="">เลือกแผนก</option>
              <option value="บัญชี">บัญชี</option>
              <option value="คลังสินค้า">คลังสินค้า</option>
              <option value="ขนส่ง">ขนส่ง</option>
              <option value="บริหาร">บริหาร</option>
              <option value="IT">IT</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              บทบาทในระบบ WMS
            </label>
            <select
              {...register('wms_role')}
              className="
                w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50
                text-sm font-thai transition-all duration-300
              "
            >
              <option value="supervisor">หัวหน้า</option>
              <option value="operator">ผู้ปฏิบัติงาน</option>
              <option value="picker">คัดแยกสินค้า</option>
              <option value="driver">คนขับ</option>
              <option value="forklift">รถยก</option>
              <option value="other">อื่นๆ</option>
            </select>
          </div>
        </div>
      </div>

      {/* System Information */}
      <div className="bg-purple-50/50 backdrop-blur-sm border border-purple-200/50 rounded-xl p-4">
        <div className="flex items-center space-x-2 mb-4">
          <Settings className="w-5 h-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-purple-900 font-thai">ข้อมูลระบบและอุปกรณ์</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              รหัสอุปกรณ์ RF
            </label>
            <input
              type="text"
              {...register('rf_device_id')}
              className="
                w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50
                text-sm font-thai transition-all duration-300
              "
              placeholder="RF001"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              รหัสบาร์โค้ดพนักงาน
            </label>
            <input
              type="text"
              {...register('barcode_id')}
              className="
                w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50
                text-sm font-thai transition-all duration-300
              "
              placeholder="BC001"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              URL รูปโปรไฟล์
            </label>
            <input
              type="url"
              {...register('profile_photo_url')}
              className="
                w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50
                text-sm font-thai transition-all duration-300
              "
              placeholder="https://example.com/photo.jpg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              ใบรับรองการฝึกอบรม
            </label>
            <input
              type="text"
              {...register('training_certifications')}
              className="
                w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50
                text-sm font-thai transition-all duration-300
              "
              placeholder="ใบรับรอง, วุฒิการศึกษา"
            />
          </div>
        </div>
      </div>

      {/* Additional Notes */}
      <div className="bg-thai-gray-50/50 backdrop-blur-sm border border-thai-gray-200/50 rounded-xl p-4">
        <div className="flex items-center space-x-2 mb-4">
          <UserPlus className="w-5 h-5 text-thai-gray-600" />
          <h3 className="text-lg font-semibold text-thai-gray-900 font-thai">หมายเหตุเพิ่มเติม</h3>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
            หมายเหตุ
          </label>
          <textarea
            {...register('remarks')}
            rows={3}
            className="
              w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-thai-gray-500/50 focus:border-thai-gray-500/50
              text-sm font-thai transition-all duration-300
            "
            placeholder="หมายเหตุเพิ่มเติม..."
          />
        </div>
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

export default AddEmployeeForm;