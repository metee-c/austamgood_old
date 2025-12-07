'use client';

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  UserCheck,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Users,
  Shield,
  Settings
} from 'lucide-react';
import Table from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import AddUserForm from '@/components/forms/AddUserForm';
import { SystemUserWithRoles, SystemRole, CreateUserData } from '@/types/user-management-schema';

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

const UsersTable = ({ data }: { data: SystemUserWithRoles[] }) => {
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
            <Table.Cell className="py-1 px-2">
              <span className="font-mono text-xs text-thai-gray-600">{user.user_id}</span>
            </Table.Cell>
            <Table.Cell className="py-1 px-2">
              <span className="font-mono text-xs font-medium text-primary-600">{user.username}</span>
            </Table.Cell>
            <Table.Cell className="py-1 px-2">
              <div className="space-y-0.5">
                <div className="font-medium font-thai text-xs">
                  {user.full_name}
                </div>
                {user.employee_name && (
                  <div className="text-[10px] text-thai-gray-500">
                    พนักงาน: {user.employee_name}
                  </div>
                )}
              </div>
            </Table.Cell>
            <Table.Cell className="py-1 px-2">
              <span className="text-xs">{user.email || '-'}</span>
            </Table.Cell>
            <Table.Cell className="py-1 px-2">
              <span className="text-xs">{user.phone_number || '-'}</span>
            </Table.Cell>
            <Table.Cell className="py-1 px-2">
              <span className="font-mono text-xs">{user.employee_id || '-'}</span>
            </Table.Cell>
            <Table.Cell className="py-1 px-2">
              <div className="flex flex-wrap gap-1">
                {user.roles?.map((role: any) => (
                  <Badge key={role.role_id} variant="default" className="text-[10px] py-0 px-1">
                    {role.role_name}
                  </Badge>
                )) || <span className="text-thai-gray-500 text-xs">ไม่มีบทบาท</span>}
              </div>
            </Table.Cell>
            <Table.Cell className="py-1 px-2">{getStatusBadge(user.is_active)}</Table.Cell>
            <Table.Cell className="py-1 px-2">
              <span className="text-xs font-thai">
                {user.last_login_at ? 
                  new Date(user.last_login_at).toLocaleString('th-TH') : 
                  '-'
                }
              </span>
            </Table.Cell>
            <Table.Cell className="py-1 px-2">
              <span className="text-xs">{user.created_by || '-'}</span>
            </Table.Cell>
            <Table.Cell className="py-1 px-2">
              <span className="text-xs font-thai">
                {user.created_at ? 
                  new Date(user.created_at).toLocaleString('th-TH') : 
                  '-'
                }
              </span>
            </Table.Cell>
            <Table.Cell className="py-1 px-2">
              <span className="text-xs font-thai">
                {user.updated_at ? 
                  new Date(user.updated_at).toLocaleString('th-TH') : 
                  '-'
                }
              </span>
            </Table.Cell>
            <Table.Cell className="py-1 px-2">
              <span className="text-xs font-thai">{user.remarks || '-'}</span>
            </Table.Cell>
            <Table.Cell className="py-1 px-2">
              <div className="flex space-x-1">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  icon={Edit} 
                  title="แก้ไข"
                />
                <Button 
                  variant="ghost" 
                  size="sm" 
                  icon={Trash2} 
                  title="ลบ"
                />
              </div>
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
        setRoles(data);
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

  return (
    <div className="h-screen bg-gradient-to-br from-thai-gray-25 to-white overflow-hidden">
      <div className="h-full flex flex-col space-y-2 pt-0 px-2 pb-2">
        {/* Modern Page Header */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl p-0 shadow-sm flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-thai-gray-900 font-thai m-0 p-0 leading-tight">ข้อมูลผู้ใช้งาน</h1>
              <p className="text-sm text-thai-gray-600 font-thai mt-0">จัดการข้อมูลผู้ใช้งานและสิทธิ์การเข้าถึง</p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                icon={Shield}
                className="bg-white/50 hover:bg-white/80 border-white/30 backdrop-blur-sm shadow-sm"
                onClick={handleRoleManagement}
              >
                จัดการบทบาท
              </Button>
              <Button 
                variant="primary" 
                icon={Plus}
                className="bg-blue-500 hover:bg-blue-600 shadow-lg"
                onClick={() => setShowAddUserForm(true)}
              >
                เพิ่มผู้ใช้งาน
              </Button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50/80 backdrop-blur-sm border border-red-200/50 rounded-2xl p-4 shadow-sm flex-shrink-0">
            <div className="flex items-center space-x-3 text-red-600">
              <div className="flex-shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <span className="font-thai text-sm">เกิดข้อผิดพลาด: {error}</span>
            </div>
          </div>
        )}

        {/* Modern Search and Filters */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl p-3 shadow-sm flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-thai-gray-400" />
                <input
                  type="text"
                  placeholder="ค้นหาผู้ใช้งาน ชื่อ หรืออีเมล..."
                  className="
                    w-full pl-10 pr-4 py-2 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg
                    focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                    text-sm font-thai transition-all duration-300 backdrop-blur-sm
                    placeholder:text-thai-gray-400
                  "
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            <div className="flex space-x-2">
              <select
                className="
                  px-3 py-2 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                  text-sm font-thai transition-all duration-300 backdrop-blur-sm min-w-32
                "
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
              >
                <option value="">ทุกบทบาท</option>
                {roles.map((role) => (
                  <option key={role.role_id} value={role.role_id}>
                    {role.role_name}
                  </option>
                ))}
              </select>

              <select
                className="
                  px-3 py-2 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                  text-sm font-thai transition-all duration-300 backdrop-blur-sm min-w-24
                "
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="">ทุกสถานะ</option>
                <option value="true">ใช้งาน</option>
                <option value="false">ไม่ใช้งาน</option>
              </select>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="flex-1 min-h-0">
          <div className="w-full h-[74vh] bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col">
            <div className="flex-1 overflow-x-auto overflow-y-auto">
              {renderTable(users, <UsersTable data={users} />)}
            </div>
          </div>
        </div>
      </div>

      {/* Add User Form Modal */}
      <AddUserForm
        isOpen={showAddUserForm}
        onClose={() => setShowAddUserForm(false)}
        onSubmit={handleCreateUser}
      />
    </div>
  );
};

export default UsersPage;
