'use client';

import React, { useState, useEffect } from 'react';
import { X, Shield, Check, Minus, Save, Edit2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import { SystemRoleWithPermissions } from '@/types/user-management-schema';
import { useAuthContext } from '@/contexts/AuthContext';

interface ViewPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: SystemRoleWithPermissions | null;
  onSuccess?: () => void;
}

const ViewPermissionsModal: React.FC<ViewPermissionsModalProps> = ({ isOpen, onClose, role, onSuccess }) => {
  const { user } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [editedPermissions, setEditedPermissions] = useState<any[]>([]);
  const [modules, setModules] = useState<any[]>([]);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (isOpen && role) {
      fetchData();
    }
  }, [isOpen, role]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([
      fetchPermissions(),
      fetchModules()
    ]);
    setLoading(false);
  };

  const fetchPermissions = async () => {
    if (!role) return;
    
    try {
      const response = await fetch(`/api/roles/${role.role_id}?include_permissions=true`);
      const data = await response.json();
      
      if (response.ok && data.role) {
        const perms = data.role.permissions || [];
        setPermissions(perms);
        setEditedPermissions(JSON.parse(JSON.stringify(perms))); // Deep copy
      }
    } catch (err) {
      console.error('Failed to fetch permissions:', err);
    }
  };

  const fetchModules = async () => {
    try {
      const response = await fetch('/api/permission-modules');
      const data = await response.json();
      
      if (response.ok) {
        setModules(data);
      }
    } catch (err) {
      console.error('Failed to fetch modules:', err);
    }
  };

  const handleTogglePermission = (moduleId: number, permissionKey: string) => {
    setEditedPermissions(prev => 
      prev.map(perm => {
        if (perm.module_id === moduleId) {
          return {
            ...perm,
            [permissionKey]: !perm[permissionKey]
          };
        }
        return perm;
      })
    );
  };

  const handleSavePermissions = async () => {
    if (!role) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/roles/${role.role_id}/permissions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          permissions: editedPermissions.map(perm => ({
            module_id: perm.module_id,
            can_view: perm.can_view || false,
            can_create: perm.can_create || false,
            can_edit: perm.can_edit || false,
            can_delete: perm.can_delete || false,
            can_approve: perm.can_approve || false,
            can_import: perm.can_import || false,
            can_export: perm.can_export || false,
            can_print: perm.can_print || false,
            can_scan: perm.can_scan || false,
            can_assign: perm.can_assign || false,
            can_complete: perm.can_complete || false,
            can_cancel: perm.can_cancel || false,
            can_rollback: perm.can_rollback || false,
            can_publish: perm.can_publish || false,
            can_optimize: perm.can_optimize || false,
            can_change_status: perm.can_change_status || false,
            can_manage_coordinates: perm.can_manage_coordinates || false,
            can_reset_reservations: perm.can_reset_reservations || false,
          }))
        }),
      });

      const data = await response.json();

      if (response.ok) {
        alert('บันทึกสิทธิ์สำเร็จ');
        setPermissions(editedPermissions);
        setIsEditing(false);
        if (onSuccess) onSuccess();
      } else {
        alert(data.error || 'เกิดข้อผิดพลาดในการบันทึกสิทธิ์');
      }
    } catch (err) {
      console.error('Failed to save permissions:', err);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = () => {
    // If no permissions exist, create empty permissions for all modules
    if (permissions.length === 0 && modules.length > 0) {
      const emptyPerms = modules.map(module => ({
        role_id: role?.role_id,
        module_id: module.module_id,
        master_permission_module: module,
        can_view: false,
        can_create: false,
        can_edit: false,
        can_delete: false,
        can_approve: false,
        can_import: false,
        can_export: false,
        can_print: false,
        can_scan: false,
        can_assign: false,
        can_complete: false,
        can_cancel: false,
        can_rollback: false,
        can_publish: false,
        can_optimize: false,
        can_change_status: false,
        can_manage_coordinates: false,
        can_reset_reservations: false,
      }));
      setEditedPermissions(emptyPerms);
    } else {
      setEditedPermissions(JSON.parse(JSON.stringify(permissions)));
    }
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditedPermissions(JSON.parse(JSON.stringify(permissions))); // Reset to original
    setIsEditing(false);
  };

  if (!isOpen || !role) return null;

  const isSuperAdmin = user?.role_id === 1;
  const canEdit = isSuperAdmin && !isEditing;
  const displayPermissions = isEditing ? editedPermissions : permissions;

  const permissionLabels: { [key: string]: string } = {
    can_view: 'ดู',
    can_create: 'สร้าง',
    can_edit: 'แก้ไข',
    can_delete: 'ลบ',
    can_approve: 'อนุมัติ',
    can_import: 'นำเข้า',
    can_export: 'ส่งออก',
    can_print: 'พิมพ์',
    can_scan: 'สแกน',
    can_assign: 'มอบหมาย',
    can_complete: 'เสร็จสิ้น',
    can_cancel: 'ยกเลิก',
    can_rollback: 'ย้อนกลับ',
    can_publish: 'เผยแพร่',
    can_optimize: 'ปรับปรุง',
    can_change_status: 'เปลี่ยนสถานะ',
    can_manage_coordinates: 'จัดการพิกัด',
    can_reset_reservations: 'รีเซ็ตการจอง',
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-thai-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-thai-gray-900 font-thai">
                {isEditing ? 'แก้ไขสิทธิ์การเข้าถึง' : 'สิทธิ์การเข้าถึง'}
              </h2>
              <p className="text-sm text-thai-gray-600 font-thai">{role.role_name}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                icon={Edit2}
                onClick={handleStartEdit}
                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              >
                แก้ไข
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              icon={X}
              onClick={onClose}
              className="text-thai-gray-400 hover:text-thai-gray-600"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="loading-spinner w-10 h-10 mx-auto mb-4"></div>
              <p className="text-thai-gray-500 font-thai">กำลังโหลดข้อมูล...</p>
            </div>
          ) : displayPermissions.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="w-12 h-12 text-thai-gray-400 mx-auto mb-4" />
              <p className="text-thai-gray-500 font-thai mb-4">ยังไม่มีการกำหนดสิทธิ์สำหรับบทบาทนี้</p>
              {isSuperAdmin && (
                <Button
                  variant="primary"
                  icon={Edit2}
                  onClick={handleStartEdit}
                  className="bg-blue-500 hover:bg-blue-600"
                >
                  เริ่มกำหนดสิทธิ์
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {displayPermissions.map((perm: any) => {
                const module = perm.master_permission_module;
                const activePermissions = Object.keys(permissionLabels).filter(
                  key => perm[key] === true
                );

                const availablePermissions = Object.keys(permissionLabels).filter(key => perm[key] === true);
                const allChecked = availablePermissions.every(key => perm[key] === true);

                return (
                  <div key={`${perm.role_id}-${perm.module_id}`} className="bg-thai-gray-50 rounded-xl p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-thai-gray-900 font-thai">
                          {module?.module_name || 'Unknown Module'}
                        </h3>
                        {module?.description && (
                          <p className="text-sm text-thai-gray-600 font-thai mt-1">
                            {module.description}
                          </p>
                        )}
                      </div>
                      {isEditing && availablePermissions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newValue = !allChecked;
                            setEditedPermissions(prev =>
                              prev.map(p => {
                                if (p.module_id === perm.module_id) {
                                  const updated = { ...p };
                                  availablePermissions.forEach(key => {
                                    updated[key] = newValue;
                                  });
                                  return updated;
                                }
                                return p;
                              })
                            );
                          }}
                          className="px-3 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors font-thai ml-2 flex-shrink-0"
                        >
                          {allChecked ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
                        </button>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {availablePermissions.map(key => (
                          <label
                            key={key}
                            className="flex items-center space-x-2 px-3 py-2 bg-white rounded-lg border border-thai-gray-200 hover:border-blue-300 cursor-pointer transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={perm[key] || false}
                              onChange={() => handleTogglePermission(perm.module_id, key)}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm font-thai text-thai-gray-700">
                              {permissionLabels[key]}
                            </span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {activePermissions.length > 0 ? (
                          activePermissions.map(key => (
                            <span
                              key={key}
                              className="inline-flex items-center space-x-1 px-3 py-1 bg-green-100 text-green-700 rounded-lg text-sm font-thai"
                            >
                              <Check className="w-3 h-3" />
                              <span>{permissionLabels[key]}</span>
                            </span>
                          ))
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-3 py-1 bg-gray-100 text-gray-500 rounded-lg text-sm font-thai">
                            <Minus className="w-3 h-3" />
                            <span>ไม่มีสิทธิ์</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between p-6 border-t border-thai-gray-200">
          {isEditing ? (
            <>
              <Button 
                variant="outline" 
                onClick={handleCancelEdit}
                disabled={saving}
              >
                ยกเลิก
              </Button>
              <Button 
                variant="primary" 
                icon={Save}
                onClick={handleSavePermissions}
                disabled={saving}
                className="bg-green-500 hover:bg-green-600"
              >
                {saving ? 'กำลังบันทึก...' : 'บันทึก'}
              </Button>
            </>
          ) : (
            <>
              <div></div>
              <Button variant="outline" onClick={onClose}>
                ปิด
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ViewPermissionsModal;
