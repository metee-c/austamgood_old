'use client';

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Edit,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Users,
  Shield,
} from 'lucide-react';
import Table from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import AddUserForm from '@/components/forms/AddUserForm';
import EditUserModal from '@/components/forms/EditUserModal';
import { SystemUserWithRoles, SystemRole, CreateUserData } from '@/types/user-management-schema';
import {
  PageContainer,
  PageHeaderWithFilters,
  SearchInput,
  FilterSelect,
  PaginationBar,
} from '@/components/ui/page-components';

// Types for sorting
interface SortConfig {
  key: string;
  direction: 'ascending' | 'descending';
}

// Re-usable hook for sorting
const useSortableData = (items: any[], config: SortConfig | null = null) => {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(config);

  const sortedItems = React.useMemo(() => {
    let sortableItems = [...items];
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

const UsersTable = ({
  data,
  onEdit
}: {
  data: SystemUserWithRoles[];
  onEdit: (user: SystemUserWithRoles) => void;
}) => {
  const { items, requestSort, sortConfig } = useSortableData(data);

  return (
    <Table>
      <Table.Header>
        <Table.Row>
          <SortableHead name="ID" sortKey="user_id" requestSort={requestSort} sortConfig={sortConfig} />
          <SortableHead name="ชื่อผู้ใช้" sortKey="username" requestSort={requestSort} sortConfig={sortConfig} />
          <SortableHead name="ชื่อ-นามสกุล" sortKey="full_name" requestSort={requestSort} sortConfig={sortConfig} />
          <SortableHead name="อีเมล" sortKey="email" requestSort={requestSort} sortConfig={sortConfig} />
          <SortableHead name="เบอร์โทรศัพท์" sortKey="phone_number" requestSort={requestSort} sortConfig={sortConfig} />
          <SortableHead name="รหัสพนักงาน" sortKey="employee_id" requestSort={requestSort} sortConfig={sortConfig} />
          <SortableHead name="บทบาท" sortKey="roles" requestSort={requestSort} sortConfig={sortConfig} />
          <SortableHead name="สถานะ" sortKey="is_active" requestSort={requestSort} sortConfig={sortConfig} />
          <SortableHead name="เข้าใช้งานล่าสุด" sortKey="last_login_at" requestSort={requestSort} sortConfig={sortConfig} />
          <SortableHead name="สร้างโดย" sortKey="created_by" requestSort={requestSort} sortConfig={sortConfig} />
          <SortableHead name="วันที่สร้าง" sortKey="created_at" requestSort={requestSort} sortConfig={sortConfig} />
          <SortableHead name="แก้ไขล่าสุด" sortKey="updated_at" requestSort={requestSort} sortConfig={sortConfig} />
          <Table.Head>หมายเหตุ</Table.Head>
          <Table.Head className="w-28">การดำเนินการ</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {items.map((user) => (
          <Table.Row key={user.user_id} className="hover:bg-thai-gray-25">
            <Table.Cell className="py-0.5 px-1.5">
              <span className="font-mono text-[11px] text-thai-gray-600">{user.user_id}</span>
            </Table.Cell>
            <Table.Cell className="py-0.5 px-1.5">
              <span className="font-mono text-[11px] font-medium text-primary-600">{user.username}</span>
            </Table.Cell>
            <Table.Cell className="py-0.5 px-1.5">
              <div className="space-y-0.5">
                <div className="font-medium font-thai text-[11px]">
                  {user.full_name}
                </div>
                {user.employee_name && (
                  <div className="text-[9px] text-thai-gray-500">
                    พนักงาน: {user.employee_name}
                  </div>
                )}
              </div>
            </Table.Cell>
            <Table.Cell className="py-0.5 px-1.5">
              <span className="text-[11px]">{user.email || '-'}</span>
            </Table.Cell>
            <Table.Cell className="py-0.5 px-1.5">
              <span className="text-[11px]">{user.phone_number || '-'}</span>
            </Table.Cell>
            <Table.Cell className="py-0.5 px-1.5">
              <span className="font-mono text-[11px]">{user.employee_id || '-'}</span>
            </Table.Cell>
            <Table.Cell className="py-0.5 px-1.5">
              <div className="flex flex-wrap gap-0.5">
                {user.roles?.map((role: any) => (
                  <span key={role.role_id} className="text-[10px] text-gray-700 font-medium">
                    {role.role_name}
                  </span>
                )) || <span className="text-thai-gray-500 text-[10px]">-</span>}
              </div>
            </Table.Cell>
            <Table.Cell className="py-0.5 px-1.5">
              <span className={`text-[10px] font-medium ${user.is_active ? 'text-green-600' : 'text-gray-500'}`}>
                {user.is_active ? 'ใช้งาน' : 'ไม่ใช้งาน'}
              </span>
            </Table.Cell>
            <Table.Cell className="py-0.5 px-1.5">
              <span className="text-[11px] font-thai">
                {user.last_login_at ?
                  new Date(user.last_login_at).toLocaleString('th-TH') :
                  '-'
                }
              </span>
            </Table.Cell>
            <Table.Cell className="py-0.5 px-1.5">
              <span className="text-[11px]">{user.created_by || '-'}</span>
            </Table.Cell>
            <Table.Cell className="py-0.5 px-1.5">
              <span className="text-[11px] font-thai">
                {user.created_at ?
                  new Date(user.created_at).toLocaleString('th-TH') :
                  '-'
                }
              </span>
            </Table.Cell>
            <Table.Cell className="py-0.5 px-1.5">
              <span className="text-[11px] font-thai">
                {user.updated_at ?
                  new Date(user.updated_at).toLocaleString('th-TH') :
                  '-'
                }
              </span>
            </Table.Cell>
            <Table.Cell className="py-0.5 px-1.5">
              <span className="text-[11px] font-thai">{user.remarks || '-'}</span>
            </Table.Cell>
            <Table.Cell className="py-0.5 px-1.5">
              <button
                onClick={() => onEdit(user)}
                className="h-7 w-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors"
                title="แก้ไข"
              >
                <Edit className="h-4 w-4" />
              </button>
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
};

const UsersPage = () => {
  const [users, setUsers] = useState<SystemUserWithRoles[]>([]);
  const [roles, setRoles] = useState<SystemRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUserWithRoles | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 100;

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 300); // Debounce search

    return () => clearTimeout(timer);
  }, [searchTerm, selectedRole, selectedStatus]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([
      fetchUsers(),
      fetchRoles()
    ]);
    setLoading(false);
  };

  const fetchUsers = async () => {
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (selectedRole) params.append('role_id', selectedRole);
      if (selectedStatus) params.append('is_active', selectedStatus);

      const response = await fetch(`/api/users?${params}`);
      const data = await response.json();

      if (response.ok) {
        setUsers(data);
        setError(null);
      } else {
        setError(data.error || 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
      }
    } catch (err) {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await fetch('/api/roles');
      const data = await response.json();

      if (response.ok) {
        setRoles(data.roles || []);
      }
    } catch (err) {
      console.error('Failed to fetch roles:', err);
    }
  };

  const handleCreateUser = async (userData: CreateUserData) => {
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const data = await response.json();

      if (response.ok) {
        // Refresh users list
        await fetchUsers();
        setShowAddUserForm(false);
        setError(null);
      } else {
        throw new Error(data.error || 'เกิดข้อผิดพลาดในการสร้างผู้ใช้งาน');
      }
    } catch (err) {
      throw err; // Re-throw to let the form handle the error
    }
  };

  const handleEditUser = (user: SystemUserWithRoles) => {
    setEditingUser(user);
    setShowEditUserModal(true);
  };

  const handleRoleManagement = () => {
    // Navigate to roles page
    window.location.href = '/master-data/roles';
  };

  const renderTable = (data: SystemUserWithRoles[], component: React.ReactNode) => {
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
          <Users className="w-12 h-12 text-thai-gray-400 mx-auto mb-4" />
          <p className="text-thai-gray-500 font-thai">
            {error ? 'เกิดข้อผิดพลาดในการโหลดข้อมูล' : 'ไม่พบข้อมูลผู้ใช้งาน'}
          </p>
        </div>
      );
    }
    return component;
  };

  const roleOptions = [
    { value: '', label: 'ทุกบทบาท' },
    ...roles.map((role) => ({ value: role.role_id.toString(), label: role.role_name }))
  ];

  const statusOptions = [
    { value: '', label: 'ทุกสถานะ' },
    { value: 'true', label: 'ใช้งาน' },
    { value: 'false', label: 'ไม่ใช้งาน' },
  ];

  return (
    <PageContainer>
      <PageHeaderWithFilters title="ข้อมูลผู้ใช้งาน">
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="ค้นหาผู้ใช้งาน ชื่อ หรืออีเมล..."
        />
        <FilterSelect
          value={selectedRole}
          onChange={setSelectedRole}
          options={roleOptions}
        />
        <FilterSelect
          value={selectedStatus}
          onChange={setSelectedStatus}
          options={statusOptions}
        />
        <Button
          variant="outline"
          icon={Shield}
          onClick={handleRoleManagement}
        >
          จัดการบทบาท
        </Button>
        <Button
          variant="primary"
          icon={Plus}
          onClick={() => setShowAddUserForm(true)}
        >
          เพิ่มผู้ใช้งาน
        </Button>
      </PageHeaderWithFilters>

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

      {/* Users Table */}
      <div className="flex-1 min-h-0 bg-white border rounded-lg shadow-sm flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto thin-scrollbar">
          {renderTable(users, <UsersTable data={users.slice((currentPage - 1) * pageSize, currentPage * pageSize)} onEdit={handleEditUser} />)}
        </div>
        <PaginationBar
          currentPage={currentPage}
          totalItems={users.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Add User Form Modal */}
      <AddUserForm
        isOpen={showAddUserForm}
        onClose={() => setShowAddUserForm(false)}
        onSubmit={handleCreateUser}
      />

      {/* Edit User Modal */}
      <EditUserModal
        isOpen={showEditUserModal}
        onClose={() => {
          setShowEditUserModal(false);
          setEditingUser(null);
        }}
        user={editingUser}
        onSuccess={() => {
          fetchUsers();
          setShowEditUserModal(false);
          setEditingUser(null);
        }}
      />
    </PageContainer>
  );
};

export default UsersPage;
