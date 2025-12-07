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
  Building,
  Loader2
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
    <div className="h-screen bg-gradient-to-br from-thai-gray-25 to-white overflow-hidden">
      <div className="h-full flex flex-col space-y-2 pt-0 px-2 pb-2">
        {/* Page Header */}
        <div className="flex items-center justify-between gap-2 pt-1 flex-shrink-0">
          <h1 className="text-xl font-bold text-thai-gray-900 font-thai m-0 p-0 leading-tight">ข้อมูลพนักงาน</h1>
          <div className="flex gap-2">
            <Button variant="outline" icon={Upload} onClick={() => setIsImportModalOpen(true)}>
              นำเข้าข้อมูล
            </Button>
            <Button variant="primary" icon={Plus} onClick={() => setIsAddModalOpen(true)}>
              เพิ่มพนักงาน
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl p-3 shadow-sm flex-shrink-0">
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

        {/* Data Table */}
        <div className="flex-1 min-h-0">
          <div className="w-full h-[74vh] bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center text-thai-gray-500 gap-2">
                <Loader2 className="w-6 h-6 animate-spin" />
                <p className="text-sm font-thai">กำลังโหลดข้อมูล...</p>
              </div>
            ) : error ? (
              <div className="h-full flex flex-col items-center justify-center text-red-500 gap-2">
                <AlertCircle className="w-6 h-6" />
                <p className="text-sm font-thai">{error}</p>
              </div>
            ) : sortedEmployees.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-thai-gray-500 gap-4">
                <Users className="w-12 h-12" />
                <div className="text-center">
                  <p className="text-sm font-medium font-thai">ไม่พบข้อมูลพนักงาน</p>
                  <p className="text-xs text-thai-gray-400 mt-1 font-thai">ลองปรับเปลี่ยนตัวกรองหรือค้นหาใหม่</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-x-auto overflow-y-auto" style={{ 
                scrollbarWidth: 'thin',
                scrollbarColor: '#cbd5e1 #f1f5f9'
              }}>
                <table className="min-w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-gray-100">
                    <tr>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap" style={{ minWidth: '100px' }}>รหัสพนักงาน</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap" style={{ minWidth: '60px' }}>คำนำหน้า</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap" style={{ minWidth: '100px' }}>ชื่อ</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap" style={{ minWidth: '100px' }}>นามสกุล</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap" style={{ minWidth: '80px' }}>ชื่อเล่น</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap" style={{ minWidth: '60px' }}>เพศ</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap" style={{ minWidth: '100px' }}>วันเกิด</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap" style={{ minWidth: '120px' }}>เลขบัตรประชาชน</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap" style={{ minWidth: '110px' }}>เบอร์โทรศัพท์</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap" style={{ minWidth: '200px' }}>อีเมล</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap" style={{ minWidth: '200px' }}>ที่อยู่</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap" style={{ minWidth: '120px' }}>ผู้ติดต่อฉุกเฉิน</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap" style={{ minWidth: '110px' }}>เบอร์ฉุกเฉิน</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap" style={{ minWidth: '100px' }}>วันที่เริ่มงาน</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap" style={{ minWidth: '100px' }}>ประเภทการจ้าง</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap" style={{ minWidth: '150px' }}>ตำแหน่ง</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap" style={{ minWidth: '120px' }}>แผนก</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap" style={{ minWidth: '100px' }}>บทบาท WMS</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap" style={{ minWidth: '100px' }}>RF Device ID</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap" style={{ minWidth: '100px' }}>Barcode ID</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap" style={{ minWidth: '80px' }}>กะ</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap" style={{ minWidth: '150px' }}>ใบรับรอง</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap" style={{ minWidth: '150px' }}>หมายเหตุ</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-gray-200 whitespace-nowrap" style={{ minWidth: '80px' }}>จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100 text-[11px]">
                    {sortedEmployees.map((employee) => (
                      <tr key={employee.employee_id?.toString()} className="hover:bg-blue-50/30 border-b border-gray-100">
                        <td className="px-2 py-1 border-r border-gray-100">
                          <span className="font-mono text-primary-600 font-semibold">{employee.employee_code}</span>
                        </td>
                        <td className="px-2 py-1 border-r border-gray-100">
                          <span className="font-thai">{employee.prefix || '-'}</span>
                        </td>
                        <td className="px-2 py-1 border-r border-gray-100">
                          <span className="font-thai">{employee.first_name}</span>
                        </td>
                        <td className="px-2 py-1 border-r border-gray-100">
                          <span className="font-thai">{employee.last_name}</span>
                        </td>
                        <td className="px-2 py-1 border-r border-gray-100">
                          <span className="font-thai">{employee.nickname || '-'}</span>
                        </td>
                        <td className="px-2 py-1 text-center border-r border-gray-100">
                          <span>{employee.gender === 'male' ? 'ชาย' : employee.gender === 'female' ? 'หญิง' : '-'}</span>
                        </td>
                        <td className="px-2 py-1 border-r border-gray-100">
                          <span>{employee.date_of_birth ? new Date(employee.date_of_birth).toLocaleDateString('th-TH') : '-'}</span>
                        </td>
                        <td className="px-2 py-1 border-r border-gray-100">
                          <span className="font-mono">{employee.national_id || '-'}</span>
                        </td>
                        <td className="px-2 py-1 border-r border-gray-100">
                          <span>{employee.phone_number || '-'}</span>
                        </td>
                        <td className="px-2 py-1 border-r border-gray-100">
                          <span className="text-[10px]">{employee.email || '-'}</span>
                        </td>
                        <td className="px-2 py-1 border-r border-gray-100">
                          <span className="text-[10px] font-thai">{employee.address || '-'}</span>
                        </td>
                        <td className="px-2 py-1 border-r border-gray-100">
                          <span className="font-thai">{employee.emergency_contact_name || '-'}</span>
                        </td>
                        <td className="px-2 py-1 border-r border-gray-100">
                          <span>{employee.emergency_contact_phone || '-'}</span>
                        </td>
                        <td className="px-2 py-1 border-r border-gray-100">
                          <span>{employee.hire_date ? new Date(employee.hire_date).toLocaleDateString('th-TH') : '-'}</span>
                        </td>
                        <td className="px-2 py-1 text-center border-r border-gray-100">
                          <Badge variant={employee.employment_type === 'permanent' ? 'success' : employee.employment_type === 'contract' ? 'warning' : 'default'} size="sm">
                            <span className="text-[10px]">
                              {employee.employment_type === 'permanent' ? 'ประจำ' : employee.employment_type === 'contract' ? 'สัญญา' : employee.employment_type === 'part-time' ? 'พาร์ทไทม์' : employee.employment_type}
                            </span>
                          </Badge>
                        </td>
                        <td className="px-2 py-1 border-r border-gray-100">
                          <span className="font-thai">{employee.position || '-'}</span>
                        </td>
                        <td className="px-2 py-1 border-r border-gray-100">
                          <span className="font-thai">{employee.department || '-'}</span>
                        </td>
                        <td className="px-2 py-1 text-center border-r border-gray-100">
                          <Badge variant={employee.wms_role === 'supervisor' ? 'danger' : employee.wms_role === 'operator' ? 'warning' : employee.wms_role === 'picker' ? 'info' : employee.wms_role === 'driver' ? 'success' : 'default'} size="sm">
                            <span className="text-[10px]">
                              {employee.wms_role === 'supervisor' ? 'หัวหน้า' : employee.wms_role === 'operator' ? 'ปฏิบัติงาน' : employee.wms_role === 'picker' ? 'คัดแยก' : employee.wms_role === 'driver' ? 'คนขับ' : employee.wms_role === 'forklift' ? 'รถยก' : employee.wms_role || '-'}
                            </span>
                          </Badge>
                        </td>
                        <td className="px-2 py-1 border-r border-gray-100">
                          <span className="font-mono">{employee.rf_device_id || '-'}</span>
                        </td>
                        <td className="px-2 py-1 border-r border-gray-100">
                          <span className="font-mono">{employee.barcode_id || '-'}</span>
                        </td>
                        <td className="px-2 py-1 text-center border-r border-gray-100">
                          <span>{employee.shift_type === 'day' ? 'กลางวัน' : employee.shift_type === 'night' ? 'กลางคืน' : employee.shift_type === 'rotating' ? 'หมุนเวียน' : '-'}</span>
                        </td>
                        <td className="px-2 py-1 border-r border-gray-100">
                          <span className="text-[10px] font-thai">{employee.training_certifications || '-'}</span>
                        </td>
                        <td className="px-2 py-1 border-r border-gray-100">
                          <span className="text-[10px] font-thai">{employee.remarks || '-'}</span>
                        </td>
                        <td className="px-2 py-1 text-center border-gray-100">
                          <div className="flex justify-center gap-1">
                            <button onClick={() => handleEdit(employee)} className="p-1 hover:bg-blue-100 rounded" title="แก้ไข">
                              <Edit className="w-3 h-3 text-blue-600" />
                            </button>
                            <button onClick={() => handleDelete(employee)} className="p-1 hover:bg-red-100 rounded" title="ลบ">
                              <Trash2 className="w-3 h-3 text-red-600" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
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