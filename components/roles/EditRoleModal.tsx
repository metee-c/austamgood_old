'use client';

import React, { useState, useEffect } from 'react';
import { X, Shield, AlertCircle } from 'lucide-react';
import Button from '@/components/ui/Button';
import { SystemRoleWithPermissions } from '@/types/user-management-schema';

interface EditRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: SystemRoleWithPermissions | null;
  onSuccess: () => void;
}

const EditRoleModal: React.FC<EditRoleModalProps> = ({ isOpen, onClose, role, onSuccess }) => {
  const [formData, setFormData] = useState({
    role_name: '',
    description: '',
    is_active: true,
    permissions: [] as number[],
  });
  const [modules, setModules] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchModules();
      if (role) {
        // Edit mode - fetch role permissions
        fetchRolePermissions(role.role_id);
        setFormData({
          role_name: role.role_name,
          description: role.description || '',
          is_active: role.is_active,
          permissions: [],
        });
      } else {
        // Create mode
        setFormData({
          role_name: '',
          description: '',
          is_active: true,
          permissions: [],
        });
      }
      setError(null);
    }
  }, [isOpen, role]);

  const fetchModules = async () => {
    try {
      const response = await fetch('/api/permission-modules');
      if (response.ok) {
        const data = await response.json();
        setModules(data || []);
      }
    } catch (err) {
      console.error('Failed to fetch modules:', err);
    }
  };

  const fetchRolePermissions = async (roleId: number) => {
    try {
      const response = await fetch(`/api/roles/${roleId}/permissions`);
      if (response.ok) {
        const data = await response.json();
        const permissionIds = data.permissions?.map((p: any) => p.module_id) || [];
        setFormData(prev => ({ ...prev, permissions: permissionIds }));
      }
    } catch (err) {
      console.error('Failed to fetch role permissions:', err);
    }
  };

  const togglePermission = (moduleId: number) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(moduleId)
        ? prev.permissions.filter(id => id !== moduleId)
        : [...prev.permissions, moduleId]
    }));
  };

  const toggleCategoryPermissions = (category: string, checked: boolean) => {
    const categoryModules = modules.filter(m => 
      m.module_key?.startsWith(category + '.') || m.module_key === category
    );
    const moduleIds = categoryModules.map(m => m.module_id);
    
    setFormData(prev => ({
      ...prev,
      permissions: checked
        ? [...new Set([...prev.permissions, ...moduleIds])]
        : prev.permissions.filter(id => !moduleIds.includes(id))
    }));
  };

  // จัดกลุ่มโมดูลตามหมวดหมู่
  const groupedModules = modules.reduce((acc, module) => {
    const category = module.module_key?.split('.')[0] || 'other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(module);
    return acc;
  }, {} as { [key: string]: any[] });

  const categoryNames: { [key: string]: string } = {
    'dashboard': '📊 Dashboard',
    'warehouse': '🏭 จัดการคลังสินค้า',
    'orders': '📦 จัดการออเดอร์',
    'routes': '🚚 เส้นทางขนส่ง',
    'picklists': '📋 ใบหยิบสินค้า',
    'face_sheets': '📄 ใบปะหน้า',
    'bonus_face_sheets': '🎁 ใบปะหน้าของแถม',
    'loadlists': '🚛 ใบโหลดสินค้า',
    'replenishment': '🔄 เบิกเติมอัตโนมัติ',
    'shipping': '📮 ส่งสินค้า',
    'reports': '📈 รายงาน',
    'stock': '📊 จัดการสต็อก',
    'mobile': '📱 Mobile Operations',
    'master': '⚙️ ข้อมูลหลัก',
    'production': '🏭 จัดการผลิต',
    'other': '📌 อื่นๆ'
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate permissions
    if (formData.permissions.length === 0) {
      setError('กรุณาเลือกสิทธิ์อย่างน้อย 1 สิทธิ์');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const isEditMode = !!role;
      const url = isEditMode ? `/api/roles/${role.role_id}` : '/api/roles';
      const method = isEditMode ? 'PUT' : 'POST';

      if (isEditMode) {
        // Edit mode: Update role info first, then permissions
        const rolePayload = {
          role_name: formData.role_name,
          description: formData.description,
          is_active: formData.is_active,
        };

        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(rolePayload),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'เกิดข้อผิดพลาดในการแก้ไขบทบาท');
          setLoading(false);
          return;
        }

        // Update permissions
        const permResponse = await fetch(`/api/roles/${role.role_id}/permissions`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            module_ids: formData.permissions
          }),
        });

        if (!permResponse.ok) {
          const permData = await permResponse.json();
          setError(permData.error || 'เกิดข้อผิดพลาดในการบันทึกสิทธิ์');
          setLoading(false);
          return;
        }
      } else {
        // Create mode: Send role with permissions together
        const rolePayload = {
          role_name: formData.role_name,
          description: formData.description,
          is_active: formData.is_active,
          permissions: formData.permissions, // Send module_ids array
        };

        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(rolePayload),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'เกิดข้อผิดพลาดในการสร้างบทบาท');
          setLoading(false);
          return;
        }
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isEditMode = !!role;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-thai-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-thai-gray-900 font-thai">
                {isEditMode ? 'แก้ไขบทบาท' : 'เพิ่มบทบาทใหม่'}
              </h2>
              <p className="text-sm text-thai-gray-600 font-thai">
                {isEditMode ? 'แก้ไขข้อมูลบทบาทและสถานะ' : 'สร้างบทบาทใหม่สำหรับระบบ'}
              </p>
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

          {/* Role Name */}
          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              ชื่อบทบาท *
            </label>
            <input
              type="text"
              name="role_name"
              value={formData.role_name}
              onChange={handleInputChange}
              required
              className="
                w-full px-4 py-3 bg-thai-gray-50 border border-thai-gray-200 rounded-xl
                focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 focus:bg-white
                text-sm font-thai transition-all duration-300
              "
              placeholder="กรอกชื่อบทบาท"
            />
          </div>

          {/* Description */}
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
                focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 focus:bg-white
                text-sm font-thai transition-all duration-300 resize-none
              "
              placeholder="กรอกคำอธิบาย (ถ้ามี)"
            />
          </div>

          {/* Status */}
          <div>
            <label className="flex items-center space-x-3 p-3 bg-thai-gray-50 rounded-xl hover:bg-thai-gray-100 transition-colors cursor-pointer">
              <input
                type="checkbox"
                name="is_active"
                checked={formData.is_active}
                onChange={handleInputChange}
                className="w-4 h-4 text-green-600 bg-white border-thai-gray-300 rounded focus:ring-green-500 focus:ring-2"
              />
              <div>
                <div className="font-medium text-thai-gray-900 font-thai text-sm">เปิดใช้งาน</div>
                <div className="text-xs text-thai-gray-600 font-thai">บทบาทนี้สามารถใช้งานได้</div>
              </div>
            </label>
          </div>

          {/* Permissions Selection */}
          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              สิทธิ์การเข้าถึง *
            </label>
            <div className="border border-thai-gray-200 rounded-xl p-4 max-h-96 overflow-y-auto bg-thai-gray-50">
              {Object.entries(groupedModules).map(([category, categoryModules]) => {
                const modules = Array.isArray(categoryModules) ? categoryModules : [];
                return (
                  <div key={category} className="mb-4 bg-white p-3 rounded-lg shadow-sm">
                    <div className="flex items-center mb-2 pb-2 border-b border-thai-gray-100">
                      <input
                        type="checkbox"
                        checked={modules.every((m: any) =>
                          formData.permissions.includes(m.module_id)
                        )}
                        onChange={(e) => toggleCategoryPermissions(category, e.target.checked)}
                        className="h-5 w-5 text-blue-600 bg-white border-thai-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                      />
                      <label className="ml-3 text-sm font-semibold text-thai-gray-900 font-thai">
                        {categoryNames[category] || category}
                      </label>
                      <span className="ml-2 text-xs text-thai-gray-500">
                        ({modules.filter((m: any) => formData.permissions.includes(m.module_id)).length}/{modules.length})
                      </span>
                    </div>
                    <div className="ml-8 grid grid-cols-1 gap-1.5">
                      {modules.map((module: any) => (
                        <div key={module.module_id} className="flex items-center py-1">
                          <input
                            type="checkbox"
                            checked={formData.permissions.includes(module.module_id)}
                            onChange={() => togglePermission(module.module_id)}
                            className="h-4 w-4 text-blue-600 bg-white border-thai-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                          />
                          <label className="ml-2 text-sm text-thai-gray-700 font-thai">
                            {module.module_name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {Object.keys(groupedModules).length === 0 && (
                <div className="text-center text-thai-gray-500 py-4 font-thai">
                  กำลังโหลดโมดูลสิทธิ์...
                </div>
              )}
            </div>
            <p className="mt-2 text-xs text-thai-gray-500 font-thai">
              เลือกสิทธิ์ที่ต้องการให้บทบาทนี้สามารถเข้าถึงได้ (เลือกอย่างน้อย 1 สิทธิ์)
            </p>
            {formData.permissions.length > 0 && (
              <p className="mt-1 text-xs text-green-600 font-thai">
                ✓ เลือกแล้ว {formData.permissions.length} สิทธิ์
              </p>
            )}
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
              {loading ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditRoleModal;
