'use client';

import React, { useState, useEffect } from 'react';
import { X, User, Mail, Phone, Lock, UserCheck, AlertCircle, Search } from 'lucide-react';
import Button from '@/components/ui/Button';
import { SystemRole, SystemUserWithRoles, Employee } from '@/types/user-management-schema';

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: SystemUserWithRoles | null;
  onSuccess: () => void;
}

interface EditUserData {
  username: string;
  email: string;
  full_name: string;
  phone_number: string;
  employee_id?: number;
  role_ids: number[];
  is_active: boolean;
  email_verified: boolean;
  remarks: string;
  // Optional password fields
  new_password?: string;
}

const EditUserModal: React.FC<EditUserModalProps> = ({ isOpen, onClose, user, onSuccess }) => {
  const [formData, setFormData] = useState<EditUserData>({
    username: '',
    email: '',
    full_name: '',
    phone_number: '',
    employee_id: undefined,
    role_ids: [],
    is_active: true,
    email_verified: true,
    remarks: '',
  });

  const [roles, setRoles] = useState<SystemRole[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changePassword, setChangePassword] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      fetchRoles();
      fetchEmployees();

      // Populate form with user data
      setFormData({
        username: user.username,
        email: user.email || '',
        full_name: user.full_name,
        phone_number: user.phone_number || '',
        employee_id: user.employee_id,
        role_ids: user.roles?.map(r => r.role_id) || [],
        is_active: user.is_active,
        email_verified: (user as any).email_verified || true,
        remarks: user.remarks || '',
      });

      // Set employee search if employee exists
      if (user.employee_id && user.employee_name) {
        setEmployeeSearch(`${user.employee_id} - ${user.employee_name}`);
      } else {
        setEmployeeSearch('');
      }

      setNewPassword('');
      setConfirmPassword('');
      setChangePassword(false);
      setShowEmployeeDropdown(false);
      setError(null);
    }
  }, [isOpen, user]);

  // Debounced employee search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (employeeSearch && showEmployeeDropdown) {
        fetchEmployees(employeeSearch);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [employeeSearch, showEmployeeDropdown]);

  const fetchRoles = async () => {
    try {
      const response = await fetch('/api/roles/list');
      const data = await response.json();
      if (response.ok) {
        setRoles(Array.isArray(data) ? data : (data.roles || []));
      }
    } catch (err) {
      console.error('Failed to fetch roles:', err);
    }
  };

  const fetchEmployees = async (search?: string) => {
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);

      const response = await fetch(`/api/employees?${params}`);
      const data = await response.json();
      if (response.ok) {
        setEmployees(data);
      }
    } catch (err) {
      console.error('Failed to fetch employees:', err);
    }
  };

  const handleEmployeeSelect = (employee: Employee) => {
    setFormData(prev => ({
      ...prev,
      employee_id: employee.employee_id,
      full_name: employee.employee_name,
    }));
    setEmployeeSearch(`${employee.employee_code} - ${employee.employee_name}`);
    setShowEmployeeDropdown(false);
  };

  const handleEmployeeSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmployeeSearch(value);
    setShowEmployeeDropdown(true);

    if (!value) {
      setFormData(prev => ({
        ...prev,
        employee_id: undefined,
      }));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleRoleChange = (roleId: number, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      role_ids: checked
        ? [...prev.role_ids, roleId]
        : prev.role_ids.filter(id => id !== roleId)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (formData.role_ids.length === 0) {
      setError('กรุณาเลือกบทบาทอย่างน้อย 1 บทบาท');
      return;
    }

    // Validate password if changing
    if (changePassword) {
      if (!newPassword || newPassword.length < 6) {
        setError('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');
        return;
      }
      if (newPassword !== confirmPassword) {
        setError('รหัสผ่านไม่ตรงกัน');
        return;
      }
    }

    setLoading(true);
    try {
      const updateData: any = {
        ...formData,
      };

      // Add password if changing
      if (changePassword && newPassword) {
        updateData.password = newPassword;
      }

      const response = await fetch(`/api/users/${user?.user_id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'เกิดข้อผิดพลาดในการแก้ไขผู้ใช้งาน');
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-thai-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-thai-gray-900 font-thai">แก้ไขผู้ใช้งาน</h2>
              <p className="text-sm text-thai-gray-600 font-thai">แก้ไขข้อมูลผู้ใช้งาน: {user.username}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon={X}
            onClick={onClose}
            className="text-thai-gray-400 hover:text-thai-gray-600"
          />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center space-x-3 text-red-600">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="font-thai text-sm">{error}</span>
              </div>
            </div>
          )}

          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-thai-gray-900 font-thai">ข้อมูลพื้นฐาน</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
                  ชื่อผู้ใช้ *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-thai-gray-400" />
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    required
                    className="
                      w-full pl-10 pr-4 py-3 bg-thai-gray-50 border border-thai-gray-200 rounded-xl
                      focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 focus:bg-white
                      text-sm font-thai transition-all duration-300
                    "
                    placeholder="กรอกชื่อผู้ใช้"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
                  อีเมล *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-thai-gray-400" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="
                      w-full pl-10 pr-4 py-3 bg-thai-gray-50 border border-thai-gray-200 rounded-xl
                      focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 focus:bg-white
                      text-sm font-thai transition-all duration-300
                    "
                    placeholder="กรอกอีเมล"
                  />
                </div>
              </div>
            </div>

            {/* Employee Selection */}
            <div>
              <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
                เลือกพนักงาน (ถ้ามี)
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-thai-gray-400" />
                <input
                  type="text"
                  value={employeeSearch}
                  onChange={handleEmployeeSearchChange}
                  onFocus={() => setShowEmployeeDropdown(true)}
                  className="
                    w-full pl-10 pr-4 py-3 bg-thai-gray-50 border border-thai-gray-200 rounded-xl
                    focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 focus:bg-white
                    text-sm font-thai transition-all duration-300
                  "
                  placeholder="ค้นหาพนักงาน (รหัส หรือ ชื่อ)"
                />

                {/* Employee Dropdown */}
                {showEmployeeDropdown && employees.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-thai-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                    {employees.map((employee) => (
                      <div
                        key={employee.employee_id}
                        onClick={() => handleEmployeeSelect(employee)}
                        className="p-3 hover:bg-thai-gray-50 cursor-pointer border-b border-thai-gray-100 last:border-b-0"
                      >
                        <div className="font-medium text-thai-gray-900 font-thai text-sm">
                          {employee.employee_code} - {employee.employee_name}
                        </div>
                        {(employee.position || employee.department) && (
                          <div className="text-xs text-thai-gray-600 font-thai mt-1">
                            {employee.position && employee.department
                              ? `${employee.position} • ${employee.department}`
                              : employee.position || employee.department
                            }
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
                ชื่อ-นามสกุล *
              </label>
              <input
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleInputChange}
                required
                className="
                  w-full px-4 py-3 bg-thai-gray-50 border border-thai-gray-200 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 focus:bg-white
                  text-sm font-thai transition-all duration-300
                "
                placeholder="กรอกชื่อ-นามสกุล"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
                เบอร์โทรศัพท์
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-thai-gray-400" />
                <input
                  type="tel"
                  name="phone_number"
                  value={formData.phone_number}
                  onChange={handleInputChange}
                  className="
                    w-full pl-10 pr-4 py-3 bg-thai-gray-50 border border-thai-gray-200 rounded-xl
                    focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 focus:bg-white
                    text-sm font-thai transition-all duration-300
                  "
                  placeholder="กรอกเบอร์โทรศัพท์"
                />
              </div>
            </div>
          </div>

          {/* Change Password Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-thai-gray-900 font-thai">รหัสผ่าน</h3>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={changePassword}
                  onChange={(e) => setChangePassword(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-white border-thai-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                />
                <span className="text-sm font-medium text-thai-gray-700 font-thai">เปลี่ยนรหัสผ่าน</span>
              </label>
            </div>

            {changePassword && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
                    รหัสผ่านใหม่ *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-thai-gray-400" />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required={changePassword}
                      minLength={6}
                      className="
                        w-full pl-10 pr-4 py-3 bg-thai-gray-50 border border-thai-gray-200 rounded-xl
                        focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 focus:bg-white
                        text-sm font-thai transition-all duration-300
                      "
                      placeholder="กรอกรหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
                    ยืนยันรหัสผ่านใหม่ *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-thai-gray-400" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required={changePassword}
                      className="
                        w-full pl-10 pr-4 py-3 bg-thai-gray-50 border border-thai-gray-200 rounded-xl
                        focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 focus:bg-white
                        text-sm font-thai transition-all duration-300
                      "
                      placeholder="ยืนยันรหัสผ่านใหม่"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Roles */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-thai-gray-900 font-thai">บทบาท *</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {roles.map((role) => (
                <label key={role.role_id} className="flex items-center space-x-3 p-3 bg-thai-gray-50 rounded-xl hover:bg-thai-gray-100 transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.role_ids.includes(role.role_id)}
                    onChange={(e) => handleRoleChange(role.role_id, e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-white border-thai-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-thai-gray-900 font-thai text-sm">{role.role_name}</div>
                    {role.description && (
                      <div className="text-xs text-thai-gray-600 font-thai">{role.description}</div>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Status Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-thai-gray-900 font-thai">สถานะ</h3>

            <div className="space-y-3">
              <label className="flex items-center space-x-3 p-3 bg-thai-gray-50 rounded-xl hover:bg-thai-gray-100 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleInputChange}
                  className="w-4 h-4 text-green-600 bg-white border-thai-gray-300 rounded focus:ring-green-500 focus:ring-2"
                />
                <div className="flex items-center space-x-2">
                  <UserCheck className="w-4 h-4 text-green-600" />
                  <div>
                    <div className="font-medium text-thai-gray-900 font-thai text-sm">เปิดใช้งาน</div>
                    <div className="text-xs text-thai-gray-600 font-thai">ผู้ใช้สามารถเข้าสู่ระบบได้</div>
                  </div>
                </div>
              </label>

              <label className="flex items-center space-x-3 p-3 bg-thai-gray-50 rounded-xl hover:bg-thai-gray-100 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  name="email_verified"
                  checked={formData.email_verified}
                  onChange={handleInputChange}
                  className="w-4 h-4 text-blue-600 bg-white border-thai-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                />
                <div className="flex items-center space-x-2">
                  <Mail className="w-4 h-4 text-blue-600" />
                  <div>
                    <div className="font-medium text-thai-gray-900 font-thai text-sm">ยืนยันอีเมลแล้ว</div>
                    <div className="text-xs text-thai-gray-600 font-thai">อีเมลได้รับการยืนยันแล้ว</div>
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              หมายเหตุ
            </label>
            <textarea
              name="remarks"
              value={formData.remarks}
              onChange={handleInputChange}
              rows={3}
              className="
                w-full px-4 py-3 bg-thai-gray-50 border border-thai-gray-200 rounded-xl
                focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 focus:bg-white
                text-sm font-thai transition-all duration-300 resize-none
              "
              placeholder="กรอกหมายเหตุ (ถ้ามี)"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-thai-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              ยกเลิก
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={loading}
              className="bg-blue-500 hover:bg-blue-600"
            >
              {loading ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditUserModal;
