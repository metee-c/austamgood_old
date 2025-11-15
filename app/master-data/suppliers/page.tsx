'use client';

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  Eye,
  Users,
  Phone,
  Mail,
  MapPin,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Star,
  Building,
  Globe
} from 'lucide-react';
import Table from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import AddSupplierForm from '@/components/forms/AddSupplierForm';
import ImportSupplierForm from '@/components/forms/ImportSupplierForm';
import { Supplier } from '@/types/supplier';

const SortableHeader = ({ 
  field, 
  children, 
  className, 
  sortField, 
  sortDirection, 
  handleSort 
}: { 
  field: keyof Supplier, 
  children: React.ReactNode, 
  className?: string,
  sortField: keyof Supplier | null,
  sortDirection: 'asc' | 'desc',
  handleSort: (field: keyof Supplier) => void
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
      className={`transition-colors cursor-pointer hover:bg-thai-gray-50 ${className || ''}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center justify-between">
        <span>{children}</span>
        {getSortIcon()}
      </div>
    </Table.Head>
  );
};

const SuppliersPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [sortField, setSortField] = useState<keyof Supplier | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Fetch data on component mount
  useEffect(() => {
    fetchSuppliers();
  }, []);

  // Fetch data when search term or filters change
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSuppliers();
    }, 300); // Debounce search

    return () => clearTimeout(timer);
  }, [searchTerm, selectedType, selectedStatus]);

  const fetchSuppliers = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (selectedType && selectedType !== 'ทั้งหมด') params.append('type', selectedType);
      if (selectedStatus && selectedStatus !== 'ทั้งหมด') params.append('status', selectedStatus);

      const response = await fetch(`/api/master-supplier?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch suppliers');
      }
      
      const data = await response.json();
      setSuppliers(data);
    } catch (err) {
      setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      console.error('Error fetching suppliers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: keyof Supplier) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedSuppliers = React.useMemo(() => {
    if (!sortField) return suppliers;

    return [...suppliers].sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];

      // Handle null/undefined values
      if (aValue === null || aValue === undefined) aValue = '';
      if (bValue === null || bValue === undefined) bValue = '';

      // Convert to string for comparison
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();

      if (sortDirection === 'asc') {
        return aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
      } else {
        return aStr > bStr ? -1 : aStr < bStr ? 1 : 0;
      }
    });
  }, [suppliers, sortField, sortDirection]);

  const handleEdit = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setShowEditModal(true);
  };

  const handleDelete = async (supplier: Supplier) => {
    if (window.confirm(`คุณต้องการลบซัพพลายเออร์ "${supplier.supplier_name}" หรือไม่?`)) {
      try {
        const response = await fetch(`/api/master-supplier?id=${supplier.supplier_id}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('Failed to delete supplier');
        }

        fetchSuppliers(); // Refresh data
      } catch (err) {
        setError('เกิดข้อผิดพลาดในการลบข้อมูล');
        console.error('Error deleting supplier:', err);
      }
    }
  };

  const handleAddSuccess = () => {
    setShowAddModal(false);
    fetchSuppliers(); // Refresh data
  };

  const handleImportSuccess = () => {
    setShowImportModal(false);
    fetchSuppliers(); // Refresh data
  };

  const getSupplierTypeLabel = (type: string) => {
    switch (type) {
      case 'vendor': return 'ผู้จำหน่าย';
      case 'service_provider': return 'ผู้ให้บริการ';
      case 'both': return 'ทั้งสองอย่าง';
      default: return type;
    }
  };

  const getSupplierTypeColor = (type: string) => {
    switch (type) {
      case 'vendor': return 'info';
      case 'service_provider': return 'success';
      case 'both': return 'warning';
      default: return 'default';
    }
  };

  const getRatingStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-3 h-3 ${
          i < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
        }`}
      />
    ));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-thai-gray-25 to-white">
      <div className="space-y-3">
        {/* Modern Page Header */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl p-0 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-thai-gray-900 font-thai">ข้อมูลซัพพลายเออร์</h1>
              <p className="text-thai-gray-600 font-thai mt-1">จัดการข้อมูลผู้จำหน่ายและคู่ค้าทางธุรกิจ</p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                icon={Users}
                onClick={() => setShowImportModal(true)}
                className="bg-white/50 hover:bg-white/80 border-white/30 backdrop-blur-sm shadow-sm"
              >
                นำเข้าข้อมูล
              </Button>
              <Button 
                variant="primary" 
                icon={Plus}
                onClick={() => setShowAddModal(true)}
                className="bg-blue-500 hover:bg-blue-600 shadow-lg"
              >
                เพิ่มผู้จำหน่าย
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
                  placeholder="ค้นหาผู้จำหน่าย รหัส หรือ ผู้ติดต่อ..."
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
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
              >
                <option value="">ประเภททั้งหมด</option>
                <option value="vendor">ผู้จำหน่าย</option>
                <option value="service_provider">ผู้ให้บริการ</option>
                <option value="both">ทั้งสองอย่าง</option>
              </select>

              <select
                className="
                  px-3 py-2 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                  text-sm font-thai transition-all duration-300 backdrop-blur-sm min-w-28
                "
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="">สถานะทั้งหมด</option>
                <option value="active">ใช้งาน</option>
                <option value="inactive">ไม่ใช้งาน</option>
              </select>
            </div>
          </div>
        </div>

        {/* Modern Suppliers Table */}
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
                <SortableHeader 
                  field="supplier_code" 
                  sortField={sortField} 
                  sortDirection={sortDirection} 
                  handleSort={handleSort}
                >
                  รหัส
                </SortableHeader>
                <SortableHeader 
                  field="supplier_name" 
                  sortField={sortField} 
                  sortDirection={sortDirection} 
                  handleSort={handleSort}
                >
                  ชื่อผู้จำหน่าย
                </SortableHeader>
                <Table.Head>ประเภท</Table.Head>
                <Table.Head>ผู้ติดต่อ</Table.Head>
                <Table.Head>โทรศัพท์</Table.Head>
                <Table.Head>อีเมล</Table.Head>
                <SortableHeader 
                  field="rating" 
                  sortField={sortField} 
                  sortDirection={sortDirection} 
                  handleSort={handleSort}
                >
                  คะแนน
                </SortableHeader>
                <Table.Head>สถานะ</Table.Head>
                <Table.Head>การดำเนินการ</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {sortedSuppliers.map((supplier) => (
                <Table.Row key={supplier.supplier_id} className="hover:bg-thai-gray-25">
                  <Table.Cell>
                    <div className="font-mono text-sm font-medium text-primary-600">
                      {supplier.supplier_code}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="space-y-1">
                      <div className="font-medium font-thai text-sm">
                        {supplier.supplier_name}
                      </div>
                      {supplier.tax_id && (
                        <div className="text-xs text-thai-gray-500 font-mono">
                          เลขที่ผู้เสียภาษี: {supplier.tax_id}
                        </div>
                      )}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant={getSupplierTypeColor(supplier.supplier_type)}>
                      {getSupplierTypeLabel(supplier.supplier_type)}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-sm font-thai">{supplier.contact_person || '-'}</span>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center">
                      <Phone className="w-4 h-4 mr-2 text-thai-gray-400" />
                      <span className="text-sm">{supplier.phone || '-'}</span>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center">
                      <Mail className="w-4 h-4 mr-2 text-thai-gray-400" />
                      <span className="text-sm">{supplier.email || '-'}</span>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center">
                      {getRatingStars(supplier.rating)}
                      <span className="ml-2 text-sm text-thai-gray-600">
                        {supplier.rating.toFixed(1)}
                      </span>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant={supplier.status === 'active' ? 'success' : 'default'}>
                      {supplier.status === 'active' ? 'ใช้งาน' : 'ไม่ใช้งาน'}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex space-x-1">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        icon={Eye}
                        onClick={() => {/* TODO: View details */}}
                        title="ดูรายละเอียด"
                      />
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        icon={Edit}
                        onClick={() => handleEdit(supplier)}
                        title="แก้ไข"
                      />
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        icon={Trash2}
                        onClick={() => handleDelete(supplier)}
                        title="ลบ"
                      />
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
              </div>

              {!loading && sortedSuppliers.length === 0 && (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-thai-gray-400 mx-auto mb-4" />
                  <p className="text-thai-gray-500 font-thai">
                    {error ? 'เกิดข้อผิดพลาดในการโหลดข้อมูล' : 'ไม่พบผู้จำหน่ายที่ตรงกับการค้นหา'}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Add Supplier Modal */}
        <Modal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          title="เพิ่มผู้จำหน่าย"
          size="xl"
        >
          <AddSupplierForm
            onSuccess={handleAddSuccess}
            onCancel={() => setShowAddModal(false)}
          />
        </Modal>

        {/* Import Suppliers Modal */}
        <Modal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          title="นำเข้าข้อมูลผู้จำหน่าย"
          size="lg"
        >
          <ImportSupplierForm
            onSuccess={handleImportSuccess}
            onCancel={() => setShowImportModal(false)}
          />
        </Modal>
      </div>
    </div>
  );
};

export default SuppliersPage;