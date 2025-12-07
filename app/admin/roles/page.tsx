'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Role {
  role_id: number;
  role_name: string;
  description?: string;
  is_system: boolean;
  user_count?: number;
  created_at: string;
}

interface Permission {
  permission_id: string;
  permission_key: string;
  permission_name: string;
  permission_type: string;
  module_id: string;
  module_name: string;
}

interface Module {
  module_id: string;
  module_name: string;
  module_key: string;
  parent_module_id?: string;
  permissions: Permission[];
}

export default function RolesPage() {
  const router = useRouter();
  const [roles, setRoles] = useState<Role[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState({
    role_name: '',
    description: '',
    permissions: [] as string[]
  });

  useEffect(() => {
    fetchRoles();
    fetchModules();
  }, []);

  const fetchRoles = async () => {
    try {
      const response = await fetch('/api/admin/roles');
      if (!response.ok) {
        throw new Error('Failed to fetch roles');
      }
      const data = await response.json();
      setRoles(data.roles || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  const fetchModules = async () => {
    try {
      const response = await fetch('/api/admin/permissions/modules');
      if (!response.ok) {
        throw new Error('Failed to fetch modules');
      }
      const data = await response.json();
      setModules(data.modules || []);
    } catch (err) {
      console.error('Failed to load modules:', err);
    }
  };

  const handleCreateRole = async () => {
    try {
      const response = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create role');
      }

      setShowCreateDialog(false);
      setFormData({ role_name: '', description: '', permissions: [] });
      fetchRoles();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create role');
    }
  };

  const handleUpdateRole = async () => {
    if (!selectedRole) return;

    try {
      const response = await fetch(`/api/admin/roles/${selectedRole.role_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update role');
      }

      setShowEditDialog(false);
      setSelectedRole(null);
      setFormData({ role_name: '', description: '', permissions: [] });
      fetchRoles();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update role');
    }
  };

  const handleDeleteRole = async (roleId: number) => {
    if (!confirm('คุณแน่ใจหรือไม่ที่จะลบบทบาทนี้?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/roles/${roleId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete role');
      }

      fetchRoles();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete role');
    }
  };

  const openEditDialog = async (role: Role) => {
    setSelectedRole(role);
    
    // Fetch role permissions
    try {
      const response = await fetch(`/api/admin/roles/${role.role_id}/permissions`);
      if (response.ok) {
        const data = await response.json();
        setFormData({
          role_name: role.role_name,
          description: role.description || '',
          permissions: data.permissions?.map((p: Permission) => p.permission_id) || []
        });
      }
    } catch (err) {
      console.error('Failed to load role permissions:', err);
    }
    
    setShowEditDialog(true);
  };

  const togglePermission = (permissionId: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter(id => id !== permissionId)
        : [...prev.permissions, permissionId]
    }));
  };

  const toggleModulePermissions = (module: Module, checked: boolean) => {
    const modulePermissionIds = module.permissions.map(p => p.permission_id);
    
    setFormData(prev => ({
      ...prev,
      permissions: checked
        ? [...new Set([...prev.permissions, ...modulePermissionIds])]
        : prev.permissions.filter(id => !modulePermissionIds.includes(id))
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            ลองใหม่
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">จัดการบทบาท (Roles)</h1>
        <button
          onClick={() => {
            setFormData({ role_name: '', description: '', permissions: [] });
            setShowCreateDialog(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          + สร้างบทบาทใหม่
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ชื่อบทบาท
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                คำอธิบาย
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ประเภท
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                จำนวนผู้ใช้
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                การจัดการ
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {roles.map((role) => (
              <tr key={role.role_id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{role.role_name}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-500">{role.description || '-'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {role.is_system ? (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                      ระบบ
                    </span>
                  ) : (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      กำหนดเอง
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {role.user_count || 0}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => openEditDialog(role)}
                    className="text-blue-600 hover:text-blue-900 mr-4"
                  >
                    แก้ไข
                  </button>
                  {!role.is_system && (
                    <button
                      onClick={() => handleDeleteRole(role.role_id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      ลบ
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Role Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">สร้างบทบาทใหม่</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ชื่อบทบาท *
              </label>
              <input
                type="text"
                value={formData.role_name}
                onChange={(e) => setFormData({ ...formData, role_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="เช่น Warehouse Manager"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                คำอธิบาย
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="อธิบายบทบาทนี้"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                สิทธิ์การเข้าถึง
              </label>
              <div className="border border-gray-300 rounded-md p-4 max-h-96 overflow-y-auto">
                {modules.map((module) => (
                  <div key={module.module_id} className="mb-4">
                    <div className="flex items-center mb-2">
                      <input
                        type="checkbox"
                        checked={module.permissions.every(p => 
                          formData.permissions.includes(p.permission_id)
                        )}
                        onChange={(e) => toggleModulePermissions(module, e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label className="ml-2 text-sm font-medium text-gray-900">
                        {module.module_name}
                      </label>
                    </div>
                    <div className="ml-6 grid grid-cols-2 gap-2">
                      {module.permissions.map((permission) => (
                        <div key={permission.permission_id} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.permissions.includes(permission.permission_id)}
                            onChange={() => togglePermission(permission.permission_id)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label className="ml-2 text-sm text-gray-700">
                            {permission.permission_name} ({permission.permission_type})
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowCreateDialog(false);
                  setFormData({ role_name: '', description: '', permissions: [] });
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleCreateRole}
                disabled={!formData.role_name || formData.permissions.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                สร้างบทบาท
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Role Dialog */}
      {showEditDialog && selectedRole && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">แก้ไขบทบาท: {selectedRole.role_name}</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ชื่อบทบาท *
              </label>
              <input
                type="text"
                value={formData.role_name}
                onChange={(e) => setFormData({ ...formData, role_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={selectedRole.is_system}
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                คำอธิบาย
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                สิทธิ์การเข้าถึง
              </label>
              <div className="border border-gray-300 rounded-md p-4 max-h-96 overflow-y-auto">
                {modules.map((module) => (
                  <div key={module.module_id} className="mb-4">
                    <div className="flex items-center mb-2">
                      <input
                        type="checkbox"
                        checked={module.permissions.every(p => 
                          formData.permissions.includes(p.permission_id)
                        )}
                        onChange={(e) => toggleModulePermissions(module, e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label className="ml-2 text-sm font-medium text-gray-900">
                        {module.module_name}
                      </label>
                    </div>
                    <div className="ml-6 grid grid-cols-2 gap-2">
                      {module.permissions.map((permission) => (
                        <div key={permission.permission_id} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.permissions.includes(permission.permission_id)}
                            onChange={() => togglePermission(permission.permission_id)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label className="ml-2 text-sm text-gray-700">
                            {permission.permission_name} ({permission.permission_type})
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowEditDialog(false);
                  setSelectedRole(null);
                  setFormData({ role_name: '', description: '', permissions: [] });
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleUpdateRole}
                disabled={!formData.role_name || formData.permissions.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                บันทึกการเปลี่ยนแปลง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
