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
  Check
} from 'lucide-react';
import Table from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { SystemRoleWithPermissions, PermissionModule } from '@/types/user-management-schema';

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

const RolesTable = ({ data }: { data: SystemRoleWithPermissions[] }) => {
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
                />
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

const RolesPage = () => {
  const [roles, setRoles] = useState<SystemRoleWithPermissions[]>([]);
  const [modules, setModules] = useState<PermissionModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

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

      const response = await fetch(`/api/roles?${params}`);
      const data = await response.json();

      if (response.ok) {
        setRoles(data);
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
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-thai-gray-900 font-thai">จัดการบทบาท</h1>
              <p className="text-thai-gray-600 font-thai mt-1">จัดการบทบาทและสิทธิ์การเข้าถึงระบบ</p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                icon={Settings}
                className="bg-white/50 hover:bg-white/80 border-white/30 backdrop-blur-sm shadow-sm"
              >
                จัดการสิทธิ์
              </Button>
              <Button 
                variant="primary" 
                icon={Plus}
                className="bg-green-500 hover:bg-green-600 shadow-lg"
              >
                เพิ่มบทบาท
              </Button>
            </div>
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

        {/* Modern Search and Filters */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl p-3 shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-thai-gray-400" />
                <input
                  type="text"
                  placeholder="ค้นหาบทบาท..."
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

        {/* Permission Modules Overview */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-thai-gray-700 flex items-center font-thai mb-4">
            <Settings className="w-5 h-5 mr-3 text-primary-500"/>
            โมดูลที่สามารถกำหนดสิทธิ์ได้
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {modules.map((module) => (
              <div key={module.module_id} className="bg-thai-gray-50/50 rounded-xl p-3 border border-thai-gray-200/50">
                <div className="font-medium text-thai-gray-900 font-thai text-sm mb-1">
                  {module.module_name}
                </div>
                <div className="text-xs text-thai-gray-600 font-thai">
                  {module.description}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Roles Table */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-6 border-b border-white/20">
            <h2 className="text-xl font-semibold text-thai-gray-700 flex items-center font-thai">
              <Shield className="w-5 h-5 mr-3 text-primary-500"/>
              รายการบทบาท
            </h2>
          </div>
          <div className="overflow-x-auto">
            {renderTable(roles, <RolesTable data={roles} />)}
          </div>
        </div>

        {/* Permission Matrix Preview */}
        {roles.length > 0 && (
          <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-white/20">
              <h2 className="text-xl font-semibold text-thai-gray-700 flex items-center font-thai">
                <Eye className="w-5 h-5 mr-3 text-primary-500"/>
                ตัวอย่างสิทธิ์ (บทบาทแรก 3 อันดับ)
              </h2>
            </div>
            <div className="p-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-thai-gray-200">
                    <th className="text-left py-3 px-4 font-thai font-medium text-thai-gray-700">โมดูล</th>
                    {roles.slice(0, 3).map((role) => (
                      <th key={role.role_id} className="text-center py-3 px-4 font-thai font-medium text-thai-gray-700">
                        {role.role_name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {modules.slice(0, 8).map((module) => (
                    <tr key={module.module_id} className="border-b border-thai-gray-100 hover:bg-thai-gray-25">
                      <td className="py-3 px-4 font-thai text-thai-gray-900">
                        {module.module_name}
                      </td>
                      {roles.slice(0, 3).map((role) => {
                        const permission = role.permissions?.find(p => p.module_id === module.module_id);
                        return (
                          <td key={role.role_id} className="py-3 px-4 text-center">
                            <div className="flex justify-center space-x-1">
                              {permission?.can_view && <Badge variant="success" className="text-xs">ดู</Badge>}
                              {permission?.can_create && <Badge variant="info" className="text-xs">เพิ่ม</Badge>}
                              {permission?.can_edit && <Badge variant="warning" className="text-xs">แก้</Badge>}
                              {permission?.can_delete && <Badge variant="danger" className="text-xs">ลบ</Badge>}
                              {!permission && <span className="text-thai-gray-400">-</span>}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RolesPage;
