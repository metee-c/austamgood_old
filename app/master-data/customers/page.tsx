'use client';

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Upload,
  Download,
  Edit,
  Trash2,
  ChevronsUpDown,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  Users,
  AlertTriangle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import Table from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import AddCustomerForm from '@/components/forms/AddCustomerForm';
import EditCustomerForm from '@/components/forms/EditCustomerForm';
import ImportCustomerForm from '@/components/forms/ImportCustomerForm';
import { CustomerFormValues } from '@/types/customer-schema';
import {
  PageContainer,
  PageHeaderWithFilters,
  SearchInput,
  FilterSelect,
  PaginationBar,
} from '@/components/ui/page-components';

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
      className={`transition-colors ${className || ''}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center justify-between">
        <span>{children}</span>
        {getSortIcon()}
      </div>
    </Table.Head>
  );
};

const CustomersPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerFormValues | null>(null);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 100;

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (selectedType) params.append('type', selectedType);
      if (selectedStatus) params.append('status', selectedStatus);

      const response = await fetch(`/api/master-customer?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }
      const result = await response.json();
      if (result.data && Array.isArray(result.data)) {
        setCustomers(result.data);
      } else {
        setCustomers([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchCustomers();
    }, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm, selectedType, selectedStatus]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedCustomers = React.useMemo(() => {
    if (!sortField) return customers;

    return [...customers].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];

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
  }, [customers, sortField, sortDirection]);

  const handleEdit = (customer: CustomerFormValues) => {
    setSelectedCustomer(customer);
    setIsEditModalOpen(true);
  };

  const handleDelete = async (customer: CustomerFormValues) => {
    if (window.confirm(`คุณต้องการลบลูกค้า "${customer.customer_name}" หรือไม่?`)) {
      const response = await fetch(`/api/master-customer?id=${customer.customer_id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchCustomers();
      } else {
        const errorData = await response.json();
        setError(errorData.error);
      }
    }
  };

  const handleExportExcel = () => {
    const excelData = sortedCustomers.map((c) => ({
      'รหัสลูกค้า': c.customer_code || '',
      'โค้ดลูกค้า': c.customer_id || '',
      'ชื่อลูกค้า': c.customer_name || '',
      'ประเภท': c.customer_type === 'retail' ? 'ปลีก' : c.customer_type === 'wholesale' ? 'ส่ง' : c.customer_type === 'distributor' ? 'ตัวแทน' : c.customer_type || '',
      'เลขที่ผู้เสียภาษี': c.tax_id || '',
      'เลขทะเบียนธุรกิจ': c.business_reg_no || '',
      'ผู้ติดต่อ': c.contact_person || '',
      'เบอร์โทรศัพท์': c.phone || '',
      'อีเมล': c.email || '',
      'Line ID': c.line_id || '',
      'เว็บไซต์': c.website || '',
      'ที่อยู่เรียกเก็บเงิน': c.billing_address || '',
      'ที่อยู่จัดส่ง': c.shipping_address || '',
      'ตำบล': c.subdistrict || '',
      'อำเภอ': c.district || '',
      'จังหวัด': c.province || '',
      'รหัสไปรษณีย์': c.postal_code || '',
      'Latitude': c.latitude ?? '',
      'Longitude': c.longitude ?? '',
      'คำแนะนำการส่ง': c.delivery_instructions || '',
      'เวลาส่งที่ต้องการ': c.preferred_delivery_time || '',
      'ช่องทาง': c.channel_source || '',
      'กลุ่มลูกค้า': c.customer_segment || '',
      'หน่วย Hub': c.hub || '',
      'หมายเหตุ': c.remarks || '',
      'สร้างโดย': c.created_by || '',
      'สถานะ': c.status === 'active' ? 'ใช้งาน' : 'ไม่ใช้งาน',
      'วันที่สร้าง': c.created_at ? new Date(c.created_at).toLocaleString('th-TH') : '',
      'วันที่แก้ไขล่าสุด': c.updated_at ? new Date(c.updated_at).toLocaleString('th-TH') : '',
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);
    XLSX.utils.book_append_sheet(wb, ws, 'ข้อมูลลูกค้า');
    XLSX.writeFile(wb, `ข้อมูลลูกค้า_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const columns = [
    { header: 'รหัสลูกค้า', accessor: 'customer_code', className: 'w-24' },
    { header: 'โค้ดลูกค้า', accessor: 'customer_id', className: 'w-20' },
    { header: 'ชื่อลูกค้า', accessor: 'customer_name', className: 'w-40' },
    { header: 'ประเภท', accessor: 'customer_type', className: 'w-24' },
    { header: 'เลขที่ผู้เสียภาษี', accessor: 'tax_id', className: 'w-28' },
    { header: 'เลขทะเบียนธุรกิจ', accessor: 'business_reg_no', className: 'w-32' },
    { header: 'ผู้ติดต่อ', accessor: 'contact_person', className: 'w-28' },
    { header: 'เบอร์โทรศัพท์', accessor: 'phone', className: 'w-28' },
    { header: 'อีเมล', accessor: 'email', className: 'w-40' },
    { header: 'Line ID', accessor: 'line_id', className: 'w-24' },
    { header: 'เว็บไซต์', accessor: 'website', className: 'w-32' },
    { header: 'ที่อยู่เรียกเก็บเงิน', accessor: 'billing_address', className: 'w-48' },
    { header: 'ที่อยู่จัดส่ง', accessor: 'shipping_address', className: 'w-48' },
    { header: 'ตำบล', accessor: 'subdistrict', className: 'w-24' },
    { header: 'อำเภอ', accessor: 'district', className: 'w-24' },
    { header: 'จังหวัด', accessor: 'province', className: 'w-24' },
    { header: 'รหัสไปรษณีย์', accessor: 'postal_code', className: 'w-20' },
    { header: 'Latitude', accessor: 'latitude', className: 'w-20' },
    { header: 'Longitude', accessor: 'longitude', className: 'w-20' },
    { header: 'คำแนะนำการส่ง', accessor: 'delivery_instructions', className: 'w-36' },
    { header: 'เวลาส่งที่ต้องการ', accessor: 'preferred_delivery_time', className: 'w-32' },
    { header: 'ช่องทาง', accessor: 'channel_source', className: 'w-24' },
    { header: 'กลุ่มลูกค้า', accessor: 'customer_segment', className: 'w-24' },
    { header: 'หน่วย Hub', accessor: 'hub', className: 'w-24' },
    { header: 'หมายเหตุ', accessor: 'remarks', className: 'w-36' },
    { header: 'สร้างโดย', accessor: 'created_by', className: 'w-24' },
    { header: 'สถานะ', accessor: 'status', className: 'w-20' },
  ];

  const typeOptions = [
    { value: '', label: 'ทุกประเภท' },
    { value: 'retail', label: 'Retail' },
    { value: 'wholesale', label: 'Wholesale' },
    { value: 'distributor', label: 'Distributor' },
    { value: 'other', label: 'Other' },
  ];

  const statusOptions = [
    { value: '', label: 'ทุกสถานะ' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ];

  return (
    <PageContainer>
      <PageHeaderWithFilters title="ข้อมูลลูกค้า">
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="ค้นหาลูกค้า..."
        />
        <FilterSelect
          value={selectedType}
          onChange={setSelectedType}
          options={typeOptions}
        />
        <FilterSelect
          value={selectedStatus}
          onChange={setSelectedStatus}
          options={statusOptions}
        />
        <Button
          variant="outline"
          icon={Download}
          onClick={handleExportExcel}
          disabled={sortedCustomers.length === 0}
        >
          ส่งออก Excel
        </Button>
        <Button
          variant="outline"
          icon={Upload}
          onClick={() => setIsImportModalOpen(true)}
        >
          นำเข้าข้อมูล
        </Button>
        <Button
          variant="primary"
          icon={Plus}
          onClick={() => setIsAddModalOpen(true)}
        >
          เพิ่มลูกค้า
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

      {/* Customers Table */}
      <div className="flex-1 min-h-0 bg-white border rounded-lg shadow-sm flex flex-col overflow-hidden">
        {loading ? (
          <div className="text-center py-12">
            <div className="loading-spinner w-10 h-10 mx-auto mb-4"></div>
            <p className="text-thai-gray-500 font-thai text-lg">กำลังโหลดข้อมูล...</p>
          </div>
        ) : sortedCustomers.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-thai-gray-400 mx-auto mb-4" />
            <p className="text-thai-gray-500 font-thai">
              {error ? 'เกิดข้อผิดพลาดในการโหลดข้อมูล' : 'ไม่พบข้อมูลลูกค้าที่ตรงกับการค้นหา'}
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto thin-scrollbar">
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
                {sortedCustomers.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((customer) => (
                  <Table.Row key={customer.customer_id} className="hover:bg-thai-gray-25">
                    <Table.Cell>
                      <span className="font-mono text-xs">{customer.customer_code || '-'}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-mono text-xs">{customer.customer_id || '-'}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-thai text-xs">{customer.customer_name || '-'}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge variant={
                        customer.customer_type === 'retail' ? 'info' :
                        customer.customer_type === 'wholesale' ? 'success' :
                        customer.customer_type === 'distributor' ? 'warning' : 'default'
                      } className="text-[9px] py-0 px-1">
                        {customer.customer_type === 'retail' && 'ปลีก'}
                        {customer.customer_type === 'wholesale' && 'ส่ง'}
                        {customer.customer_type === 'distributor' && 'ตัวแทน'}
                        {customer.customer_type === 'other' && 'อื่นๆ'}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-mono text-xs">{customer.tax_id || '-'}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-mono text-xs">{customer.business_reg_no || '-'}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-thai text-xs">{customer.contact_person || '-'}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-xs">{customer.phone || '-'}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-xs truncate block max-w-[160px]" title={customer.email || '-'}>
                        {customer.email || '-'}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-xs">{customer.line_id || '-'}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-xs truncate block max-w-[128px]" title={customer.website || '-'}>
                        {customer.website || '-'}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-thai text-xs truncate block max-w-[192px]" title={customer.billing_address || '-'}>
                        {customer.billing_address || '-'}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-thai text-xs truncate block max-w-[192px]" title={customer.shipping_address || '-'}>
                        {customer.shipping_address || '-'}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-thai text-xs">{customer.subdistrict || '-'}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-thai text-xs">{customer.district || '-'}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-thai text-xs">{customer.province || '-'}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-xs">{customer.postal_code || '-'}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-xs">{customer.latitude ? customer.latitude.toFixed(6) : '-'}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-xs">{customer.longitude ? customer.longitude.toFixed(6) : '-'}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-thai text-xs truncate block max-w-[144px]" title={customer.delivery_instructions || '-'}>
                        {customer.delivery_instructions || '-'}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-xs">{customer.preferred_delivery_time || '-'}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-thai text-xs">{customer.channel_source || '-'}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-thai text-xs">{customer.customer_segment || '-'}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-thai text-xs">{customer.hub || '-'}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-thai text-xs truncate block max-w-[144px]" title={customer.remarks || '-'}>
                        {customer.remarks || '-'}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-xs">{customer.created_by || '-'}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge variant={customer.status === 'active' ? 'success' : 'default'} className="text-[10px] py-0 px-1.5">
                        {customer.status === 'active' ? 'ใช้งาน' : 'ไม่ใช้งาน'}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex space-x-0.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Edit}
                          title="แก้ไข"
                          onClick={() => handleEdit(customer)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Trash2}
                          title="ลบ"
                          onClick={() => handleDelete(customer)}
                        />
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
        )}
        <PaginationBar
          currentPage={currentPage}
          totalItems={sortedCustomers.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Add Customer Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="เพิ่มลูกค้าใหม่"
        size="xl"
      >
        <AddCustomerForm
          onCancel={() => setIsAddModalOpen(false)}
          onSuccess={() => { setIsAddModalOpen(false); fetchCustomers(); }}
        />
      </Modal>

      {/* Edit Customer Modal */}
      {selectedCustomer && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="แก้ไขลูกค้า"
          size="xl"
        >
          <EditCustomerForm
            customer={selectedCustomer}
            onCancel={() => setIsEditModalOpen(false)}
            onSuccess={() => { setIsEditModalOpen(false); fetchCustomers(); }}
          />
        </Modal>
      )}

      {/* Import Customers Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="นำเข้าข้อมูลลูกค้า"
        size="lg"
      >
        <ImportCustomerForm
          onCancel={() => setIsImportModalOpen(false)}
          onSuccess={() => { setIsImportModalOpen(false); fetchCustomers(); }}
        />
      </Modal>
    </PageContainer>
  );
};

export default function CustomersPageWithPermission() {
  return (
    <PermissionGuard 
      permission="master_data.customers.view"
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
            <p className="text-gray-600">คุณไม่มีสิทธิ์ในการดูข้อมูลลูกค้า</p>
          </div>
        </div>
      }
    >
      <CustomersPage />
    </PermissionGuard>
  );
}
