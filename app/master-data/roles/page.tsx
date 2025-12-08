'use client';

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  Shield,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Users,
  Settings,
  Eye,
  PlusCircle,
  Pencil,
  X,
  Check,
  AlertTriangle
} from 'lucide-react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import Table from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { SystemRoleWithPermissions, PermissionModule } from '@/types/user-management-schema';
import EditRoleModal from '@/components/roles/EditRoleModal';
import ViewPermissionsModal from '@/components/roles/ViewPermissionsModal';

// Types for sorting
interface SortConfig {
  key: string;
  direction: 'ascending' | 'descending';
}

// Re-usable hook for sorting
const useSortableData = (items: any[], config: SortConfig | null = null) => {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(config);

  const sortedItems = React.useMemo(() => {
    // Ensure items is always an array
    const itemsArray = Array.isArray(items) ? items : [];
    let sortableItems = [...itemsArray];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [items, sortConfig]);

  const requestSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  return { items: sortedItems, requestSort, sortConfig };
};

const SortableHead = ({ 
  name, 
  sortKey, 
  requestSort, 
  sortConfig 
}: {
  name: string;
  sortKey: string;
  requestSort: (key: string) => void;
  sortConfig: SortConfig | null;
}) => {
  const getIcon = () => {
    if (!sortConfig || sortConfig.key !== sortKey) {
      return <ChevronsUpDown className="w-4 h-4 ml-2 text-thai-gray-400" />;
    }
    return sortConfig.direction === 'ascending' ? 
      <ChevronUp className="w-4 h-4 ml-2 text-primary-600" /> : 
      <ChevronDown className="w-4 h-4 ml-2 text-primary-600" />;
  };

  return (
    <Table.Head onClick={() => requestSort(sortKey)} className="cursor-pointer transition-colors">
      <div className={`flex items-center justify-between ${sortConfig && sortConfig.key === sortKey ? 'text-primary-600' : ''}`}>
        <span>{name}</span>
        {getIcon()}
      </div>
    </Table.Head>
  );
};

const RolesTable = ({ 
  data,
  onView,
  onEdit,
  onDelete
}: { 
  data: SystemRoleWithPermissions[];
  onView: (role: SystemRoleWithPermissions) => void;
  onEdit: (role: SystemRoleWithPermissions) => void;
  onDelete: (role: SystemRoleWithPermissions) => void;
}) => {
  const { items, requestSort, sortConfig } = useSortableData(data);

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? 
      <Badge variant="success">ใช้งาน</Badge> : 
      <Badge variant="default">ไม่ใช้งาน</Badge>;
  };

  return (
    <Table>
      <Table.Header>
        <Table.Row>
          <SortableHead name="ชื่อบทบาท" sortKey="role_name" requestSort={requestSort} sortConfig={sortConfig} />
          <SortableHead name="คำอธิบาย" sortKey="description" requestSort={requestSort} sortConfig={sortConfig} />
          <SortableHead name="จำนวนผู้ใช้" sortKey="user_count" requestSort={requestSort} sortConfig={sortConfig} />
          <SortableHead name="สถานะ" sortKey="is_active" requestSort={requestSort} sortConfig={sortConfig} />
          <SortableHead name="วันที่สร้าง" sortKey="created_at" requestSort={requestSort} sortConfig={sortConfig} />
          <Table.Head className="w-28">การดำเนินการ</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {items.map((role) => (
          <Table.Row key={role.role_id} className="hover:bg-thai-gray-25">
            <Table.Cell>
              <div className="space-y-1">
                <div className="font-medium text-primary-600 font-thai">
                  {role.role_name}
                </div>
                <div className="text-xs text-thai-gray-500 font-mono">
                  ID: {role.role_id}
                </div>
              </div>
            </Table.Cell>
            <Table.Cell>
              <span className="text-sm font-thai text-thai-gray-700">
                {role.description || '-'}
              </span>
            </Table.Cell>
            <Table.Cell>
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-thai-gray-400" />
                <span className="font-medium text-blue-600">
                  {role.user_count || 0}
                </span>
              </div>
            </Table.Cell>
            <Table.Cell>{getStatusBadge(role.is_active)}</Table.Cell>
            <Table.Cell>
              <span className="text-sm font-thai">
                {new Date(role.created_at).toLocaleString('th-TH')}
              </span>
            </Table.Cell>
            <Table.Cell>
              <div className="flex space-x-1">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  icon={Eye} 
                  title="ดูสิทธิ์"
                  onClick={() => onView(role)}
                />
                <Button 
                  variant="ghost" 
                  size="sm" 
                  icon={Edit} 
                  title="แก้ไข"
                  onClick={() => onEdit(role)}
                />
                <Button 
                  variant="ghost" 
                  size="sm" 
                  icon={Trash2} 
                  title="ลบ"
                  onClick={() => onDelete(role)}
                />
              </div>
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
};

const RolesPage = () => {
  const [roles, setRoles] = useState<SystemRoleWithPermissions[]>([]);
  const [modules, setModules] = useState<PermissionModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedRole, setSelectedRole] = useState<SystemRoleWithPermissions | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [isModulesExpanded, setIsModulesExpanded] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRoles();
    }, 300); // Debounce search

    return () => clearTimeout(timer);
  }, [searchTerm, selectedStatus]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([
      fetchRoles(),
      fetchModules()
    ]);
    setLoading(false);
  };

  const fetchRoles = async () => {
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (selectedStatus) params.append('is_active', selectedStatus);
      params.append('include_user_count', 'true');

      const response = await fetch(`/api/roles?${params}`);
      const data = await response.json();

      if (response.ok) {
        // Handle both array and object with roles property
        setRoles(Array.isArray(data) ? data : (data.roles || []));
        setError(null);
      } else {
        setError(data.error || 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
      }
    } catch (err) {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
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

  const handleViewPermissions = (role: SystemRoleWithPermissions) => {
    setSelectedRole(role);
    setShowPermissionsModal(true);
  };

  const handleAddRole = () => {
    setSelectedRole(null);
    setShowEditModal(true);
  };

  const handleEditRole = (role: SystemRoleWithPermissions) => {
    setSelectedRole(role);
    setShowEditModal(true);
  };

  const handleDeleteRole = async (role: SystemRoleWithPermissions) => {
    console.log('🗑️ [DELETE ROLE] Starting delete process for:', role);
    
    // Check if role has users
    if (role.user_count && role.user_count > 0) {
      console.log('❌ [DELETE ROLE] Cannot delete - has users:', role.user_count);
      alert(`ไม่สามารถลบบทบาท "${role.role_name}" ได้\nเนื่องจากมีผู้ใช้ ${role.user_count} คนที่ใช้บทบาทนี้อยู่`);
      return;
    }

    if (!confirm(`คุณต้องการลบบทบาท "${role.role_name}" ใช่หรือไม่?`)) {
      console.log('❌ [DELETE ROLE] User cancelled');
      return;
    }

    console.log('📤 [DELETE ROLE] Sending DELETE request to:', `/api/roles/${role.role_id}`);
    
    try {
      const response = await fetch(`/api/roles/${role.role_id}`, {
        method: 'DELETE',
      });

      console.log('📥 [DELETE ROLE] Response status:', response.status);
      
      const data = await response.json();
      console.log('📥 [DELETE ROLE] Response data:', data);

      if (response.ok) {
        console.log('✅ [DELETE ROLE] Delete successful, refreshing roles...');
        await fetchRoles();
        alert('ลบบทบาทสำเร็จ');
      } else {
        console.error('❌ [DELETE ROLE] Delete failed:', data);
        alert(data.error || 'เกิดข้อผิดพลาดในการลบบทบาท');
      }
    } catch (err) {
      console.error('❌ [DELETE ROLE] Exception:', err);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  const renderTable = (data: SystemRoleWithPermissions[], component: React.ReactNode) => {
    if (loading) {
      return (
        <div className="text-center py-12">
          <div className="loading-spinner w-10 h-10 mx-auto mb-4"></div>
          <p className="text-thai-gray-500 font-thai text-lg">กำลังโหลดข้อมูล...</p>
        </div>
      );
    }
    if (!data || data.length === 0) {
      return (
        <div className="text-center py-8">
          <Shield className="w-12 h-12 text-thai-gray-400 mx-auto mb-4" />
          <p className="text-thai-gray-500 font-thai">
            {error ? 'เกิดข้อผิดพลาดในการโหลดข้อมูล' : 'ไม่พบข้อมูลบทบาท'}
          </p>
        </div>
      );
    }
    return component;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-thai-gray-25 to-white">
      <div className="space-y-3">
        {/* Modern Page Header */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl p-0 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-thai-gray-900 font-thai">จัดการบทบาท</h1>
              <p className="text-thai-gray-600 font-thai mt-1">จัดการบทบาทและสิทธิ์การเข้าถึงระบบ</p>
            </div>
            <Button
              variant="primary"
              icon={Plus}
              onClick={handleAddRole}
              className="bg-green-500 hover:bg-green-600 shadow-lg"
            >
              เพิ่มบทบาท
            </Button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50/80 backdrop-blur-sm border border-red-200/50 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center space-x-3 text-red-600">
              <div className="flex-shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <span className="font-thai text-sm">เกิดข้อผิดพลาด: {error}</span>
            </div>
          </div>
        )}

        {/* Roles Table */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-6 border-b border-white/20">
            <h2 className="text-xl font-semibold text-thai-gray-700 flex items-center justify-between font-thai">
              <div className="flex items-center">
                <Shield className="w-5 h-5 mr-3 text-primary-500"/>
                รายการบทบาท
              </div>
            </h2>
          </div>
          <div className="overflow-x-auto">
            {renderTable(roles, <RolesTable data={roles} onView={handleViewPermissions} onEdit={handleEditRole} onDelete={handleDeleteRole} />)}
          </div>
        </div>

        {/* Permission Modules Overview */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl overflow-hidden shadow-sm">
          <div
            className="p-6 border-b border-white/20 cursor-pointer hover:bg-thai-gray-25/50 transition-colors"
            onClick={() => setIsModulesExpanded(!isModulesExpanded)}
          >
            <h2 className="text-xl font-semibold text-thai-gray-700 flex items-center justify-between font-thai">
              <div className="flex items-center">
                <Settings className="w-5 h-5 mr-3 text-primary-500"/>
                โมดูลที่สามารถกำหนดสิทธิ์ได้
                <span className="ml-3 text-sm text-thai-gray-500 font-normal">
                  ({modules.length} โมดูล)
                </span>
              </div>
              <div className="transition-transform duration-200" style={{ transform: isModulesExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                <ChevronDown className="w-5 h-5 text-thai-gray-400" />
              </div>
            </h2>
          </div>
          {isModulesExpanded && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-thai-gray-50/50">
                  <tr className="border-b border-thai-gray-200">
                    <th className="text-left py-3 px-4 font-thai font-semibold text-thai-gray-700 w-1/3">โมดูล</th>
                    <th className="text-left py-3 px-4 font-thai font-semibold text-thai-gray-700 w-2/3">คำอธิบาย</th>
                  </tr>
                </thead>
                <tbody>
                  {modules.map((module, index) => (
                    <tr
                      key={module.module_id}
                      className={`border-b border-thai-gray-100 hover:bg-thai-gray-25 transition-colors ${
                        index % 2 === 0 ? 'bg-white' : 'bg-thai-gray-25/30'
                      }`}
                    >
                      <td className="py-2.5 px-4">
                        <span className="font-medium text-thai-gray-900 font-thai">
                          {module.module_name}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="text-thai-gray-600 font-thai">
                          {module.description}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* Modals */}
      <EditRoleModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        role={selectedRole}
        onSuccess={fetchRoles}
      />

      <ViewPermissionsModal
        isOpen={showPermissionsModal}
        onClose={() => setShowPermissionsModal(false)}
        role={selectedRole}
        onSuccess={fetchRoles}
      />
    </div>
  );
};

export default function RolesPageWithPermission() {
  return (
    <PermissionGuard 
      permission="user_management.roles.view"
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
            <p className="text-gray-600">คุณไม่มีสิทธิ์ในการจัดการบทบาท</p>
          </div>
        </div>
      }
    >
      <RolesPage />
    </PermissionGuard>
  );
}
