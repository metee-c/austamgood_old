'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Upload,
  Edit,
  Trash2,
  ChevronsUpDown,
  ChevronUp,
  ChevronDown,
  Users,
  AlertCircle,
  Phone,
  Mail,
  Briefcase,
  Building
} from 'lucide-react';
import Table from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { Employee } from '@/types/employee-schema';
import AddEmployeeForm from '@/components/forms/AddEmployeeForm';
import EditEmployeeForm from '@/components/forms/EditEmployeeForm';
import ImportEmployeeForm from '@/components/forms/ImportEmployeeForm';


const SortableHeader = ({ 
  field, 
  children, 
  className, 
  sortField, 
  sortDirection, 
  handleSort 
}: { 
  field: string, 
  children: React.ReactNode, 
  className?: string,
  sortField: string | null,
  sortDirection: 'asc' | 'desc',
  handleSort: (field: string) => void
}) => {
  const getSortIcon = () => {
    if (sortField !== field) {
      return <ChevronsUpDown className="w-4 h-4 text-thai-gray-400" />;
    }
    return sortDirection === 'asc' 
      ? <ChevronUp className="w-4 h-4 text-primary-600" />
      : <ChevronDown className="w-4 h-4 text-primary-600" />;
  };

  return (
    <Table.Head 
      className={`transition-colors cursor-pointer hover:bg-thai-gray-50/50 ${className || ''}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center justify-between">
        <span>{children}</span>
        {getSortIcon()}
      </div>
    </Table.Head>
  );
};

const EmployeesPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedEmploymentType, setSelectedEmploymentType] = useState('');
  const [selectedWmsRole, setSelectedWmsRole] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);

      const response = await fetch(`/api/master-employee?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }
      const data = await response.json();
      if (Array.isArray(data)) {
        setEmployees(data);
      } else {
        setEmployees([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchEmployees();
    }, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm, selectedDepartment, selectedEmploymentType, selectedWmsRole]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedEmployees = React.useMemo(() => {
    if (!sortField) return employees;

    return [...employees].sort((a, b) => {
      const aValue = a[sortField as keyof Employee];
      const bValue = b[sortField as keyof Employee];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      if (String(aValue).toLowerCase() < String(bValue).toLowerCase()) {
        return sortDirection === 'asc' ? -1 : 1;
      }
      if (String(aValue).toLowerCase() > String(bValue).toLowerCase()) {
        return sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [employees, sortField, sortDirection]);

  const handleEdit = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsEditModalOpen(true);
  };

  const handleDelete = async (employee: Employee) => {
    if (window.confirm(`คุณต้องการลบพนักงาน "${employee.first_name} ${employee.last_name}" หรือไม่?`)) {
      const response = await fetch(`/api/master-employee?id=${employee.employee_id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchEmployees();
      } else {
        const errorData = await response.json();
        setError(errorData.error);
      }
    }
  };

  const columns = [
    { header: 'รหัสพนักงาน', accessor: 'employee_code', className: 'w-32' },
    { header: 'ชื่อ-นามสกุล', accessor: 'first_name', className: 'min-w-48' },
    { header: 'ตำแหน่ง', accessor: 'position', className: 'w-40' },
    { header: 'แผนก', accessor: 'department', className: 'w-40' },
    { header: 'เบอร์โทรศัพท์', accessor: 'phone_number', className: 'w-40' },
    { header: 'อีเมล', accessor: 'email', className: 'min-w-48' },
    { header: 'ประเภทการจ้าง', accessor: 'employment_type', className: 'w-40' },
    { header: 'บทบาท WMS', accessor: 'wms_role', className: 'w-32' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-thai-gray-25 to-white">
      <div className="space-y-3">
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl p-0 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-thai-gray-900 font-thai">ข้อมูลพนักงาน</h1>
              <p className="text-thai-gray-600 font-thai mt-1">จัดการข้อมูลพนักงานในระบบ</p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                icon={Upload} 
                onClick={() => setIsImportModalOpen(true)} 
                className="bg-white/50 hover:bg-white/80 border-white/30 backdrop-blur-sm shadow-sm"
              >
                นำเข้าข้อมูล
              </Button>
              <Button 
                variant="primary" 
                icon={Plus} 
                onClick={() => setIsAddModalOpen(true)} 
                className="bg-blue-500 hover:bg-blue-600 shadow-lg"
              >
                เพิ่มพนักงาน
              </Button>
            </div>
          </div>
        </div>

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
                  placeholder="ค้นหาพนักงาน รหัส ชื่อ นามสกุล..."
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
                  text-sm font-thai transition-all duration-300 backdrop-blur-sm min-w-28
                "
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
              >
                <option value="">แผนกทั้งหมด</option>
                <option value="บัญชี">บัญชี</option>
                <option value="คลังสินค้า">คลังสินค้า</option>
                <option value="ขนส่ง">ขนส่ง</option>
                <option value="บริหาร">บริหาร</option>
                <option value="IT">IT</option>
              </select>

              <select
                className="
                  px-3 py-2 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                  text-sm font-thai transition-all duration-300 backdrop-blur-sm min-w-24
                "
                value={selectedEmploymentType}
                onChange={(e) => setSelectedEmploymentType(e.target.value)}
              >
                <option value="">ประเภททั้งหมด</option>
                <option value="permanent">พนักงานประจำ</option>
                <option value="contract">พนักงานสัญญา</option>
                <option value="temporary">พนักงานชั่วคราว</option>
              </select>

              <select
                className="
                  px-3 py-2 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                  text-sm font-thai transition-all duration-300 backdrop-blur-sm min-w-20
                "
                value={selectedWmsRole}
                onChange={(e) => setSelectedWmsRole(e.target.value)}
              >
                <option value="">บทบาททั้งหมด</option>
                <option value="supervisor">หัวหน้า</option>
                <option value="operator">ผู้ปฏิบัติงาน</option>
                <option value="picker">คัดแยกสินค้า</option>
                <option value="driver">คนขับ</option>
                <option value="forklift">รถยก</option>
                <option value="other">อื่นๆ</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="text-center py-12">
              <div className="loading-spinner w-10 h-10 mx-auto mb-4"></div>
              <p className="text-thai-gray-500 font-thai text-lg">กำลังโหลดข้อมูล...</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <Table.Header>
                    <Table.Row>
                      {columns.map((col) => (
                        <SortableHeader key={col.accessor} field={col.accessor} className={col.className} sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>
                          {col.header}
                        </SortableHeader>
                      ))}
                      <Table.Head className="w-28">การดำเนินการ</Table.Head>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {sortedEmployees.map((employee) => (
                      <Table.Row key={employee.employee_id?.toString()} className="hover:bg-thai-gray-25">
                        <Table.Cell>
                          <div className="font-mono text-sm font-medium text-primary-600">
                            {employee.employee_code}
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <div className="font-medium font-thai text-sm">
                            {employee.prefix}{employee.first_name} {employee.last_name}
                          </div>
                          <div className="text-xs text-thai-gray-500">
                            {employee.nickname}
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                           <div className="flex items-center">
                             <Briefcase className="w-4 h-4 mr-2 text-thai-gray-400" />
                             <span className="text-sm font-thai">{employee.position || '-'}</span>
                           </div>
                        </Table.Cell>
                        <Table.Cell>
                           <div className="flex items-center">
                            <Building className="w-4 h-4 mr-2 text-thai-gray-400" />
                             <span className="text-sm font-thai">{employee.department || '-'}</span>
                           </div>
                        </Table.Cell>
                        <Table.Cell>
                          <div className="flex items-center">
                            <Phone className="w-4 h-4 mr-2 text-thai-gray-400" />
                            <span className="text-sm">{employee.phone_number || '-'}</span>
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <div className="flex items-center">
                            <Mail className="w-4 h-4 mr-2 text-thai-gray-400" />
                            <span className="text-sm">{employee.email || '-'}</span>
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <Badge variant={
                            employee.employment_type === 'permanent' ? 'success' : 
                            employee.employment_type === 'contract' ? 'warning' : 'default'
                          }>
                            {employee.employment_type === 'permanent' ? 'พนักงานประจำ' :
                             employee.employment_type === 'contract' ? 'สัญญาจ้าง' :
                             employee.employment_type === 'temporary' ? 'ชั่วคราว' : 
                             employee.employment_type}
                          </Badge>
                        </Table.Cell>
                        <Table.Cell>
                          <Badge variant={
                            employee.wms_role === 'supervisor' ? 'danger' :
                            employee.wms_role === 'operator' ? 'warning' :
                            employee.wms_role === 'picker' ? 'info' :
                            employee.wms_role === 'driver' ? 'success' : 'default'
                          }>
                            {employee.wms_role === 'supervisor' ? 'หัวหน้า' :
                             employee.wms_role === 'operator' ? 'ผู้ปฏิบัติงาน' :
                             employee.wms_role === 'picker' ? 'คัดแยกสินค้า' :
                             employee.wms_role === 'driver' ? 'คนขับ' :
                             employee.wms_role === 'forklift' ? 'รถยก' :
                             employee.wms_role || '-'}
                          </Badge>
                        </Table.Cell>
                        <Table.Cell>
                          <div className="flex space-x-1">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              icon={Edit} 
                              title="แก้ไข" 
                              onClick={() => handleEdit(employee)}
                              className="hover:bg-blue-50/50 hover:text-blue-600"
                            />
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              icon={Trash2} 
                              title="ลบ" 
                              onClick={() => handleDelete(employee)}
                              className="hover:bg-red-50/50 hover:text-red-600"
                            />
                          </div>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              </div>
              {!loading && sortedEmployees.length === 0 && (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-thai-gray-400 mx-auto mb-4" />
                  <p className="text-thai-gray-500 font-thai">
                    {error ? 'เกิดข้อผิดพลาดในการโหลดข้อมูล' : 'ไม่พบข้อมูลพนักงาน'}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="เพิ่มพนักงานใหม่" size="2xl">
          <AddEmployeeForm 
            onCancel={() => setIsAddModalOpen(false)} 
            onSuccess={() => { setIsAddModalOpen(false); fetchEmployees(); }} 
          />
        </Modal>

        {selectedEmployee && (
          <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="แก้ไขข้อมูลพนักงาน" size="2xl">
            <EditEmployeeForm 
              employee={selectedEmployee} 
              onCancel={() => setIsEditModalOpen(false)} 
              onSuccess={() => { setIsEditModalOpen(false); fetchEmployees(); }} 
            />
          </Modal>
        )}

        <Modal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} title="นำเข้าข้อมูลพนักงาน" size="lg">
          <ImportEmployeeForm 
            onCancel={() => setIsImportModalOpen(false)} 
            onSuccess={() => { setIsImportModalOpen(false); fetchEmployees(); }} 
          />
        </Modal>
      </div>
    </div>
  );
};

export default EmployeesPage;