'use client';

import React, { useState, useEffect } from 'react';
import { X, Shield, Check, Save, AlertCircle } from 'lucide-react';
import Button from '@/components/ui/Button';
import { SystemRoleWithPermissions } from '@/types/user-management-schema';

interface EditPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: SystemRoleWithPermissions | null;
  onSuccess: () => void;
  currentUserRole: string;
}

const EditPermissionsModal: React.FC<EditPermissionsModalProps> = ({ 
  isOpen, 
  onClose, 
  role,
  onSuccess,
  currentUserRole
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<{ [key: string]: any }>({});

  const isSuperAdmin = currentUserRole === 'Super Admin';

  useEffect(() => {
    if (isOpen && role) {
      console.log('EditPermissionsModal - isSuperAdmin:', isSuperAdmin);
      console.log('EditPermissionsModal - currentUserRole:', currentUserRole);
      fetchData();
    }
  }, [isOpen, role]);

  const fetchData = async () => {
    if (!role) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Fetch role with permissions
      const roleResponse = await fetch(`/api/roles/${role.role_id}`);
      const roleData = await roleResponse.json();
      
      // Fetch all modules
      const modulesResponse = await fetch('/api/admin/permissions/modules');
      const modulesData = await modulesResponse.json();
      
      if (roleResponse.ok && modulesResponse.ok) {
        setModules(modulesData.modules || []);
        
        // Build permissions map
        const permMap: { [key: string]: any } = {};
        (roleData.role?.permissions || []).forEach((perm: any) => {
          permMap[perm.module_id] = perm;
        });
        setPermissions(permMap);
      } else {
        setError('ไม่สามารถโหลดข้อมูลได้');
      }
    } catch (err) {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionChange = (moduleId: number, permType: string, value: boolean) => {
    setPermissions(prev => ({
      ...prev,
      [moduleId]: {
        ...prev[moduleId],
        module_id: moduleId,
        [permType]: value
      }
    }));
  };

  const handleSelectAllForPermission = (permType: string, value: boolean) => {
    const updatedPermissions = { ...permissions };
    modules.forEach((module) => {
      updatedPermissions[module.module_id] = {
        ...updatedPermissions[module.module_id],
        module_id: module.module_id,
        [permType]: value
      };
    });
    setPermissions(updatedPermissions);
  };

  const handleSelectAllForModule = (moduleId: number, value: boolean) => {
    const updatedPerm = { ...permissions[moduleId], module_id: moduleId };
    permissionTypes.forEach(({ key }) => {
      updatedPerm[key] = value;
    });
    setPermissions(prev => ({
      ...prev,
      [moduleId]: updatedPerm
    }));
  };

  const handleSave = async () => {
    if (!role || !isSuperAdmin) return;

    setSaving(true);
    setError(null);

    try {
      const permissionsArray = Object.values(permissions);
      
      const response = await fetch(`/api/roles/${role.role_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role_name: role.role_name,
          description: role.description,
          permissions: permissionsArray
        }),
      });

      const data = await response.json();

      if (response.ok) {
        onSuccess();
        onClose();
      } else {
        setError(data.error || 'เกิดข้อผิดพลาดในการบันทึก');
      }
    } catch (err) {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !role) return null;

  const permissionTypes = [
    { key: 'can_view', label: 'ดู' },
    { key: 'can_create', label: 'สร้าง' },
    { key: 'can_edit', label: 'แก้ไข' },
    { key: 'can_delete', label: 'ลบ' },
    { key: 'can_approve', label: 'อนุมัติ' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-thai-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-thai-gray-900 font-thai">
                {isSuperAdmin ? 'จัดการสิทธิ์การเข้าถึง' : 'ดูสิทธิ์การเข้าถึง'}
              </h2>
              <p className="text-sm text-thai-gray-600 font-thai">{role.role_name}</p>
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
              <div className="flex items-center space-x-3 text-red-600">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="font-thai text-sm">{error}</span>
              </div>
            </div>
          )}

          {!isSuperAdmin && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4">
              <div className="flex items-center space-x-3 text-yellow-700">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="font-thai text-sm">เฉพาะ Super Admin เท่านั้นที่สามารถแก้ไขสิทธิ์ได้</span>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <div className="loading-spinner w-10 h-10 mx-auto mb-4"></div>
              <p className="text-thai-gray-500 font-thai">กำลังโหลดข้อมูล...</p>
            </div>
          ) : modules.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="w-12 h-12 text-thai-gray-400 mx-auto mb-4" />
              <p className="text-thai-gray-500 font-thai">ไม่พบข้อมูลโมดูล</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Select All Controls */}
              {isSuperAdmin && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <h3 className="font-semibold text-thai-gray-900 font-thai mb-3">
                    เลือกทั้งหมดสำหรับแต่ละสิทธิ์
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {permissionTypes.map(({ key, label }) => {
                      const allChecked = modules.every(m => permissions[m.module_id]?.[key]);
                      const someChecked = modules.some(m => permissions[m.module_id]?.[key]);
                      
                      return (
                        <div key={key} className="flex flex-col space-y-2">
                          <button
                            onClick={() => handleSelectAllForPermission(key, !allChecked)}
                            className={`
                              flex items-center justify-center space-x-2 p-3 rounded-lg transition-all
                              ${allChecked 
                                ? 'bg-green-500 text-white hover:bg-green-600' 
                                : someChecked
                                ? 'bg-green-200 text-green-800 hover:bg-green-300'
                                : 'bg-white text-thai-gray-700 hover:bg-thai-gray-100 border border-thai-gray-300'
                              }
                            `}
                          >
                            <Check className={`w-4 h-4 ${allChecked ? 'opacity-100' : 'opacity-0'}`} />
                            <span className="text-sm font-medium font-thai">{label}</span>
                          </button>
                          <button
                            onClick={() => handleSelectAllForPermission(key, false)}
                            className="text-xs text-thai-gray-500 hover:text-thai-gray-700 font-thai"
                          >
                            ล้างทั้งหมด
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Individual Module Permissions */}
              <div className="space-y-4">
                {modules.map((module: any) => {
                  const perm = permissions[module.module_id] || {};
                  const allChecked = permissionTypes.every(({ key }) => perm[key]);
                  const someChecked = permissionTypes.some(({ key }) => perm[key]);
                  
                  return (
                    <div key={module.module_id} className="bg-thai-gray-50 rounded-xl p-4">
                      <div className="mb-3 flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-thai-gray-900 font-thai">
                            {module.module_name}
                          </h3>
                          {module.description && (
                            <p className="text-sm text-thai-gray-600 font-thai mt-1">
                              {module.description}
                            </p>
                          )}
                        </div>
                        {isSuperAdmin && (
                          <div className="flex items-center space-x-2 ml-4">
                            <button
                              onClick={() => handleSelectAllForModule(module.module_id, true)}
                              className="text-xs text-green-600 hover:text-green-700 font-thai px-2 py-1 rounded hover:bg-green-50 transition-colors"
                            >
                              ✓ เลือกทั้งหมด
                            </button>
                            <span className="text-thai-gray-300">|</span>
                            <button
                              onClick={() => handleSelectAllForModule(module.module_id, false)}
                              className="text-xs text-red-600 hover:text-red-700 font-thai px-2 py-1 rounded hover:bg-red-50 transition-colors"
                            >
                              ✗ ล้างทั้งหมด
                            </button>
                          </div>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                        {permissionTypes.map(({ key, label }) => (
                          <label 
                            key={key}
                            className={`
                              flex items-center space-x-2 p-2 rounded-lg transition-colors
                              ${isSuperAdmin ? 'cursor-pointer hover:bg-white' : 'cursor-not-allowed opacity-60'}
                              ${perm[key] ? 'bg-green-100' : 'bg-white'}
                            `}
                          >
                            <input
                              type="checkbox"
                              checked={perm[key] || false}
                              onChange={(e) => handlePermissionChange(module.module_id, key, e.target.checked)}
                              disabled={!isSuperAdmin}
                              className="w-4 h-4 text-green-600 bg-white border-thai-gray-300 rounded focus:ring-green-500 focus:ring-2"
                            />
                            <span className="text-sm font-thai">{label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-6 border-t border-thai-gray-200">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {isSuperAdmin ? 'ยกเลิก' : 'ปิด'}
          </Button>
          {isSuperAdmin && (
            <Button 
              variant="primary" 
              icon={Save}
              onClick={handleSave}
              loading={saving}
              className="bg-blue-500 hover:bg-blue-600"
            >
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EditPermissionsModal;
