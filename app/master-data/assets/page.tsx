'use client';

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Upload,
  Edit,
  Trash2,
  ChevronsUpDown,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  Settings,
  Calendar,
  Package,
  Search,
} from 'lucide-react';
import Table from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import AddAssetForm from '@/components/forms/AddAssetForm';
import EditAssetForm from '@/components/forms/EditAssetForm';
import ImportAssetForm from '@/components/forms/ImportAssetForm';
import {
  PageContainer,
  PageHeaderWithFilters,
  SearchInput,
  FilterSelect,
  PaginationBar,
} from '@/components/ui/page-components';

interface Asset {
  asset_id: number;
  asset_code: string;
  asset_name: string;
  asset_type: string;
  description?: string;
  warehouse_id?: number;
  location_id?: number;
  brand?: string;
  model?: string;
  serial_number?: string;
  purchase_date?: string;
  warranty_expiry_date?: string;
  maintenance_schedule?: string;
  last_maintenance_date?: string;
  status: string;
  capacity_spec?: string;
  assigned_person_id?: number;
  safety_certificate_expiry?: string;
  remarks?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  warehouse_name?: string;
  location_code?: string;
  assigned_person_name?: string;
}

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

const AssetsPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAssetType, setSelectedAssetType] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 100;

  // Fetch assets on component mount
  useEffect(() => {
    fetchAssets();
  }, []);

  // Fetch assets when search term or filters change
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAssets();
    }, 300); // Debounce search

    return () => clearTimeout(timer);
  }, [searchTerm, selectedAssetType, selectedStatus]);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (selectedAssetType) params.append('asset_type', selectedAssetType);
      if (selectedStatus) params.append('status', selectedStatus);

      // For now, using mock data until API is implemented
      const mockAssets: Asset[] = [
        {
          asset_id: 1,
          asset_code: 'ASSET-001',
          asset_name: 'Forklift Toyota 2.5T',
          asset_type: 'Forklift',
          description: 'Electric forklift for warehouse operations',
          brand: 'Toyota',
          model: '8FBE25',
          serial_number: 'TY25001',
          purchase_date: '2023-01-15',
          warranty_expiry_date: '2025-01-15',
          maintenance_schedule: 'Monthly inspection, Annual service',
          status: 'Active',
          capacity_spec: '2.5 Ton',
          remarks: 'Main warehouse forklift',
          created_by: 'admin',
          created_at: '2023-01-15T10:00:00Z',
          updated_at: '2023-01-15T10:00:00Z'
        },
        {
          asset_id: 2,
          asset_code: 'ASSET-002',
          asset_name: 'Pallet Rack System A1',
          asset_type: 'Rack',
          description: 'Heavy duty pallet racking system',
          brand: 'Dexion',
          model: 'P90',
          serial_number: 'DEX-A1-001',
          purchase_date: '2023-02-01',
          warranty_expiry_date: '2033-02-01',
          maintenance_schedule: 'Annual safety inspection',
          status: 'Active',
          capacity_spec: '2000 Kg per level',
          remarks: 'Zone A storage rack',
          created_by: 'admin',
          created_at: '2023-02-01T10:00:00Z',
          updated_at: '2023-02-01T10:00:00Z'
        },
        {
          asset_id: 3,
          asset_code: 'ASSET-003',
          asset_name: 'Hand Pallet Truck',
          asset_type: 'Hand Pallet',
          description: 'Manual pallet jack for light operations',
          brand: 'Crown',
          model: 'PTH50',
          serial_number: 'CRW-PT001',
          purchase_date: '2023-03-10',
          warranty_expiry_date: '2025-03-10',
          maintenance_schedule: 'Quarterly maintenance',
          status: 'Active',
          capacity_spec: '2.5 Ton',
          remarks: 'Backup lifting equipment',
          created_by: 'admin',
          created_at: '2023-03-10T10:00:00Z',
          updated_at: '2023-03-10T10:00:00Z'
        },
        {
          asset_id: 4,
          asset_code: 'ASSET-004',
          asset_name: 'Barcode Scanner Zebra',
          asset_type: 'Barcode Scanner',
          description: 'Industrial barcode scanner for inventory',
          brand: 'Zebra',
          model: 'TC26',
          serial_number: 'ZEB-TC26-001',
          purchase_date: '2023-04-05',
          warranty_expiry_date: '2025-04-05',
          maintenance_schedule: 'Software update quarterly',
          status: 'Active',
          capacity_spec: 'N/A',
          remarks: 'Primary inventory scanner',
          created_by: 'admin',
          created_at: '2023-04-05T10:00:00Z',
          updated_at: '2023-04-05T10:00:00Z'
        },
        {
          asset_id: 5,
          asset_code: 'ASSET-005',
          asset_name: 'Digital Weighing Scale',
          asset_type: 'Weighing Scale',
          description: 'Platform weighing scale for cargo',
          brand: 'Mettler Toledo',
          model: 'IND560',
          serial_number: 'MT-IND560-01',
          purchase_date: '2023-05-12',
          warranty_expiry_date: '2024-05-12',
          maintenance_schedule: 'Monthly calibration',
          status: 'Under Maintenance',
          capacity_spec: '5000 Kg capacity',
          remarks: 'Requires recalibration',
          created_by: 'admin',
          created_at: '2023-05-12T10:00:00Z',
          updated_at: '2023-05-12T10:00:00Z'
        }
      ];

      // Filter mock data based on search/filters
      let filteredAssets = mockAssets;
      
      if (searchTerm) {
        filteredAssets = filteredAssets.filter(asset =>
          asset.asset_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
          asset.asset_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          asset.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          asset.model?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      if (selectedAssetType) {
        filteredAssets = filteredAssets.filter(asset => asset.asset_type === selectedAssetType);
      }

      if (selectedStatus) {
        filteredAssets = filteredAssets.filter(asset => asset.status === selectedStatus);
      }

      setAssets(filteredAssets);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedAssets = React.useMemo(() => {
    if (!sortField) return assets;

    return [...assets].sort((a, b) => {
      let aValue = a[sortField as keyof Asset];
      let bValue = b[sortField as keyof Asset];

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
  }, [assets, sortField, sortDirection]);

  const handleEdit = (asset: Asset) => {
    setSelectedAsset(asset);
    setShowEditModal(true);
  };

  const handleDelete = async (asset: Asset) => {
    if (window.confirm(`คุณต้องการลบทรัพย์สิน "${asset.asset_name}" หรือไม่?`)) {
      try {
        // TODO: Replace with actual API endpoint when backend is ready
        const response = await fetch(`/api/master-asset/${asset.asset_id}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          alert('ลบทรัพย์สินสำเร็จ');
          fetchAssets(); // Refresh data
        } else {
          const errorData = await response.json();
          setError(errorData.error || 'เกิดข้อผิดพลาดในการลบข้อมูล');
        }
      } catch (err) {
        // For now, simulate successful deletion since API doesn't exist yet
        console.log('Asset to be deleted:', asset.asset_id);
        alert(`ลบทรัพย์สิน "${asset.asset_name}" สำเร็จ (Demo Mode)`);
        fetchAssets(); // Refresh data
      }
    }
  };

  const handleAddSuccess = () => {
    setShowAddModal(false);
    fetchAssets(); // Refresh data
  };

  const handleEditSuccess = () => {
    setShowEditModal(false);
    setSelectedAsset(null);
    fetchAssets(); // Refresh data
  };

  const handleImportSuccess = () => {
    setShowImportModal(false);
    fetchAssets(); // Refresh data
  };

  const getAssetTypeIcon = (type: string) => {
    switch (type) {
      case 'Forklift':
        return <Settings className="w-4 h-4 text-blue-500" />;
      case 'Rack':
        return <Package className="w-4 h-4 text-green-500" />;
      case 'Hand Pallet':
        return <Settings className="w-4 h-4 text-orange-500" />;
      case 'Barcode Scanner':
        return <Search className="w-4 h-4 text-purple-500" />;
      case 'Weighing Scale':
        return <Settings className="w-4 h-4 text-red-500" />;
      case 'Conveyor':
        return <Settings className="w-4 h-4 text-indigo-500" />;
      default:
        return <Settings className="w-4 h-4 text-thai-gray-400" />;
    }
  };

  const assetTypeOptions = [
    { value: '', label: 'ประเภททั้งหมด' },
    { value: 'Forklift', label: 'รถยก' },
    { value: 'Rack', label: 'ชั้นวาง' },
    { value: 'Hand Pallet', label: 'รถเข็นมือ' },
    { value: 'Barcode Scanner', label: 'เครื่องสแกน' },
    { value: 'Weighing Scale', label: 'เครื่องชั่ง' },
    { value: 'Conveyor', label: 'สายพาน' },
    { value: 'Other', label: 'อื่นๆ' },
  ];

  const statusOptions = [
    { value: '', label: 'สถานะทั้งหมด' },
    { value: 'Active', label: 'ใช้งาน' },
    { value: 'Under Maintenance', label: 'ซ่อมบำรุง' },
    { value: 'Out of Service', label: 'เสื่อมสภาพ' },
    { value: 'Retired', label: 'เลิกใช้งาน' },
  ];

  return (
    <PageContainer>
      <PageHeaderWithFilters title="ข้อมูลทรัพย์สินคลัง">
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="ค้นหาทรัพย์สิน รหัส ชื่อ ยี่ห้อ รุ่น..."
        />
        <FilterSelect
          value={selectedAssetType}
          onChange={setSelectedAssetType}
          options={assetTypeOptions}
        />
        <FilterSelect
          value={selectedStatus}
          onChange={setSelectedStatus}
          options={statusOptions}
        />
        <Button
          variant="outline"
          icon={Upload}
          onClick={() => setShowImportModal(true)}
        >
          นำเข้าข้อมูล
        </Button>
        <Button
          variant="primary"
          icon={Plus}
          onClick={() => setShowAddModal(true)}
        >
          เพิ่มทรัพย์สิน
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

      {/* Assets Table */}
      <div className="flex-1 min-h-0 bg-white border rounded-lg shadow-sm flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto thin-scrollbar">
          {loading ? (
            <div className="text-center py-12">
              <div className="loading-spinner w-10 h-10 mx-auto mb-4"></div>
              <p className="text-thai-gray-500 font-thai text-lg">กำลังโหลดข้อมูล...</p>
            </div>
          ) : sortedAssets.length === 0 ? (
            <div className="text-center py-8">
              <Settings className="w-12 h-12 text-thai-gray-400 mx-auto mb-4" />
              <p className="text-thai-gray-500 font-thai">
                {error ? 'เกิดข้อผิดพลาดในการโหลดข้อมูล' : 'ไม่พบข้อมูลทรัพย์สินที่ตรงกับการค้นหา'}
              </p>
            </div>
          ) : (
            <Table>
              <Table.Header>
                <Table.Row>
                  <SortableHeader field="asset_code" className="w-32" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>รหัสทรัพย์สิน</SortableHeader>
                  <SortableHeader field="asset_name" className="min-w-48" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>ชื่อทรัพย์สิน</SortableHeader>
                  <SortableHeader field="asset_type" className="w-32" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>ประเภท</SortableHeader>
                  <SortableHeader field="brand" className="min-w-32" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>ยี่ห้อ/รุ่น</SortableHeader>
                  <SortableHeader field="capacity_spec" className="w-28" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>ความจุ</SortableHeader>
                  <SortableHeader field="purchase_date" className="w-28" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>วันที่ซื้อ</SortableHeader>
                  <SortableHeader field="status" className="w-24" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>สถานะ</SortableHeader>
                  <Table.Head className="w-28">การดำเนินการ</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {sortedAssets.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((asset) => (
                  <Table.Row key={asset.asset_id} className="hover:bg-thai-gray-25">
                    <Table.Cell>
                      <div className="font-mono text-sm font-medium text-primary-600">
                        {asset.asset_code}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="space-y-1">
                        <div className="font-medium font-thai text-sm flex items-center space-x-2">
                          {getAssetTypeIcon(asset.asset_type)}
                          <span>{asset.asset_name}</span>
                        </div>
                        <div className="text-xs text-thai-gray-500 font-mono">
                          ID: {asset.asset_id}
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge variant="default" className="bg-blue-100/50 text-blue-700 border-blue-200/50">
                        {asset.asset_type === 'Forklift' ? 'รถยก' :
                         asset.asset_type === 'Rack' ? 'ชั้นวาง' :
                         asset.asset_type === 'Hand Pallet' ? 'รถเข็นมือ' :
                         asset.asset_type === 'Barcode Scanner' ? 'เครื่องสแกน' :
                         asset.asset_type === 'Weighing Scale' ? 'เครื่องชั่ง' :
                         asset.asset_type === 'Conveyor' ? 'สายพาน' :
                         asset.asset_type}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="space-y-1">
                        <div className="font-medium font-thai text-sm">
                          {asset.brand || '-'}
                        </div>
                        <div className="text-xs text-thai-gray-500">
                          {asset.model || '-'}
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="text-center">
                        <span className="text-sm font-medium text-green-600">
                          {asset.capacity_spec || '-'}
                        </span>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="text-center">
                        {asset.purchase_date ? (
                          <div className="flex items-center justify-center space-x-1">
                            <Calendar className="w-3 h-3 text-thai-gray-400" />
                            <span className="text-xs font-medium">
                              {new Date(asset.purchase_date).toLocaleDateString('th-TH')}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-thai-gray-400">-</span>
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge variant={
                        asset.status === 'Active' ? 'success' : 
                        asset.status === 'Under Maintenance' ? 'warning' :
                        asset.status === 'Out of Service' ? 'danger' :
                        'default'
                      }>
                        {asset.status === 'Active' ? 'ใช้งาน' : 
                         asset.status === 'Under Maintenance' ? 'ซ่อมบำรุง' :
                         asset.status === 'Out of Service' ? 'เสื่อมสภาพ' :
                         asset.status === 'Retired' ? 'เลิกใช้งาน' :
                         asset.status}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex space-x-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          icon={Edit} 
                          onClick={() => handleEdit(asset)}
                          title="แก้ไข"
                          className="hover:bg-blue-50/50 hover:text-blue-600"
                        />
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          icon={Trash2} 
                          onClick={() => handleDelete(asset)}
                          title="ลบ"
                          className="hover:bg-red-50/50 hover:text-red-600"
                        />
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          )}
        </div>
        <PaginationBar
          currentPage={currentPage}
          totalItems={sortedAssets.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Add Asset Modal */}
        <Modal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          title="เพิ่มทรัพย์สินใหม่"
          size="xl"
        >
          <AddAssetForm
            onSuccess={handleAddSuccess}
            onCancel={() => setShowAddModal(false)}
          />
        </Modal>

        {/* Edit Asset Modal */}
        <Modal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          title="แก้ไขทรัพย์สิน"
          size="xl"
        >
          {selectedAsset && (
            <EditAssetForm
              asset={selectedAsset}
              onSuccess={handleEditSuccess}
              onCancel={() => setShowEditModal(false)}
            />
          )}
        </Modal>

        {/* Import Asset Modal */}
        <Modal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          title="นำเข้าข้อมูลทรัพย์สิน"
          size="lg"
        >
          <ImportAssetForm
            onSuccess={handleImportSuccess}
            onCancel={() => setShowImportModal(false)}
          />
        </Modal>
    </PageContainer>
  );
};

export default AssetsPage;
