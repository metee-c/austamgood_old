'use client';

import React, { useState, useEffect } from 'react';
import { X, Shield, AlertCircle, Settings, Check, Eye, PlusCircle, Pencil, Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import { PermissionModule, CreateRoleData } from '@/types/user-management-schema';

interface AddRoleFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (roleData: CreateRoleData) => Promise<void>;
}

const AddRoleForm: React.FC<AddRoleFormProps> = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState<CreateRoleData>({
    role_name: '',
    description: '',
    is_active: true,
    permissions: [],
  });

  const [modules, setModules] = useState<PermissionModule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchModules();
      // Reset form when opening
      setFormData({
        role_name: '',
        description: '',
        is_active: true,
        permissions: [],
      });
      setError(null);
    }
  }, [isOpen]);

  const fetchModules = async () => {
    try {
      const response = await fetch('/api/permission-modules');
      const data = await response.json();
      if (response.ok) {
        setModules(data);
        // Initialize permissions for all modules with default false values
        const initialPermissions = data.map((module: PermissionModule) => ({
          module_id: module.module_id,
          can_view: false,
          can_create: false,
          can_edit: false,
          can_delete: false,
          can_approve: false,
        }));
        setFormData(prev => ({
          ...prev,
          permissions: initialPermissions
        }));
      }
    } catch (err) {
      console.error('Failed to fetch modules:', err);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handlePermissionChange = (moduleId: number, permission: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions?.map(p => 
        p.module_id === moduleId 
          ? { ...p, [permission]: checked }
          : p
      ) || []
    }));
  };

  const handleSelectAllPermissions = (moduleId: number, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions?.map(p => 
        p.module_id === moduleId 
          ? { 
              ...p, 
              can_view: checked,
              can_create: checked,
              can_edit: checked,
              can_delete: checked,
              can_approve: checked
            }
          : p
      ) || []
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.role_name.trim()) {
      setError('กรุณากรอกชื่อบทบาท');
      return;
    }

    setLoading(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-thai-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-thai-gray-900 font-thai">เพิ่มบทบาทใหม่</h2>
              <p className="text-sm text-thai-gray-600 font-thai">สร้างบทบาทและกำหนดสิทธิ์การเข้าถึง</p>
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
                  ชื่อบทบาท *
                </label>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-thai-gray-400" />
                  <input
                    type="text"
                    name="role_name"
                    value={formData.role_name}
                    onChange={handleInputChange}
                    required
                    className="
                      w-full pl-10 pr-4 py-3 bg-thai-gray-50 border border-thai-gray-200 rounded-xl
                      focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 focus:bg-white
                      text-sm font-thai transition-all duration-300
                    "
                    placeholder="กรอกชื่อบทบาท"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
                  สถานะ
                </label>
                <label className="flex items-center space-x-3 p-3 bg-thai-gray-50 rounded-xl">
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={formData.is_active}
                    onChange={handleInputChange}
                    className="w-4 h-4 text-green-600 bg-white border-thai-gray-300 rounded focus:ring-green-500 focus:ring-2"
                  />
                  <div className="flex items-center space-x-2">
                    <Check className="w-4 h-4 text-green-600" />
                    <span className="font-medium text-thai-gray-900 font-thai text-sm">เปิดใช้งาน</span>
                  </div>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
                คำอธิบาย
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={3}
                className="
                  w-full px-4 py-3 bg-thai-gray-50 border border-thai-gray-200 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 focus:bg-white
                  text-sm font-thai transition-all duration-300 resize-none
                "
                placeholder="กรอกคำอธิบายบทบาท (ถ้ามี)"
              />
            </div>
          </div>

          {/* Permissions */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-thai-gray-900 font-thai">กำหนดสิทธิ์การเข้าถึง</h3>
            
            <div className="bg-thai-gray-50 rounded-xl p-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-thai-gray-200">
                      <th className="text-left py-3 px-4 font-thai font-medium text-thai-gray-700">โมดูล</th>
                      <th className="text-center py-3 px-4 font-thai font-medium text-thai-gray-700 min-w-16">
                        <Eye className="w-4 h-4 mx-auto" />
                        <span className="block text-xs mt-1">ดู</span>
                      </th>
                      <th className="text-center py-3 px-4 font-thai font-medium text-thai-gray-700 min-w-16">
                        <PlusCircle className="w-4 h-4 mx-auto" />
                        <span className="block text-xs mt-1">เพิ่ม</span>
                      </th>
                      <th className="text-center py-3 px-4 font-thai font-medium text-thai-gray-700 min-w-16">
                        <Pencil className="w-4 h-4 mx-auto" />
                        <span className="block text-xs mt-1">แก้ไข</span>
                      </th>
                      <th className="text-center py-3 px-4 font-thai font-medium text-thai-gray-700 min-w-16">
                        <Trash2 className="w-4 h-4 mx-auto" />
                        <span className="block text-xs mt-1">ลบ</span>
                      </th>
                      <th className="text-center py-3 px-4 font-thai font-medium text-thai-gray-700 min-w-16">
                        <Check className="w-4 h-4 mx-auto" />
                        <span className="block text-xs mt-1">อนุมัติ</span>
                      </th>
                      <th className="text-center py-3 px-4 font-thai font-medium text-thai-gray-700 min-w-20">
                        <span className="block text-xs">เลือกทั้งหมด</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {modules.map((module) => {
                      const permission = formData.permissions?.find(p => p.module_id === module.module_id);
                      return (
                        <tr key={module.module_id} className="border-b border-thai-gray-100 hover:bg-white/50">
                          <td className="py-3 px-4">
                            <div>
                              <div className="font-medium text-thai-gray-900 font-thai">
                                {module.module_name}
                              </div>
                              {module.description && (
                                <div className="text-xs text-thai-gray-600 font-thai mt-1">
                                  {module.description}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={permission?.can_view || false}
                              onChange={(e) => handlePermissionChange(module.module_id, 'can_view', e.target.checked)}
                              className="w-4 h-4 text-blue-600 bg-white border-thai-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                            />
                          </td>
                          <td className="py-3 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={permission?.can_create || false}
                              onChange={(e) => handlePermissionChange(module.module_id, 'can_create', e.target.checked)}
                              className="w-4 h-4 text-green-600 bg-white border-thai-gray-300 rounded focus:ring-green-500 focus:ring-2"
                            />
                          </td>
                          <td className="py-3 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={permission?.can_edit || false}
                              onChange={(e) => handlePermissionChange(module.module_id, 'can_edit', e.target.checked)}
                              className="w-4 h-4 text-yellow-600 bg-white border-thai-gray-300 rounded focus:ring-yellow-500 focus:ring-2"
                            />
                          </td>
                          <td className="py-3 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={permission?.can_delete || false}
                              onChange={(e) => handlePermissionChange(module.module_id, 'can_delete', e.target.checked)}
                              className="w-4 h-4 text-red-600 bg-white border-thai-gray-300 rounded focus:ring-red-500 focus:ring-2"
                            />
                          </td>
                          <td className="py-3 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={permission?.can_approve || false}
                              onChange={(e) => handlePermissionChange(module.module_id, 'can_approve', e.target.checked)}
                              className="w-4 h-4 text-purple-600 bg-white border-thai-gray-300 rounded focus:ring-purple-500 focus:ring-2"
                            />
                          </td>
                          <td className="py-3 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={permission?.can_view && permission?.can_create && permission?.can_edit && permission?.can_delete && permission?.can_approve}
                              onChange={(e) => handleSelectAllPermissions(module.module_id, e.target.checked)}
                              className="w-4 h-4 text-thai-gray-600 bg-white border-thai-gray-300 rounded focus:ring-thai-gray-500 focus:ring-2"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
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
              className="bg-green-500 hover:bg-green-600"
            >
              {loading ? 'กำลังบันทึก...' : 'บันทึกบทบาท'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddRoleForm;