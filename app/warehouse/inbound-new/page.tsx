'use client';

import React, { useState, useEffect } from 'react';
import { 
  TruckIcon, 
  Search, 
  Plus, 
  Eye, 
  Edit, 
  CheckCircle,
  Clock,
  AlertTriangle,
  Package,
  Calendar,
  User,
  ExternalLink,
  PrinterIcon,
  Trash2
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Table from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { wmsReceiveNewService } from '@/lib/database/wms-receive-new';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useSkus } from '@/hooks/useSkus';
import { useWarehouses } from '@/hooks/useWarehouses';

interface ReceiveDetailForm {
  temp_id: string;
  line_no: number;
  sku_id: string;
  lot_no?: string;
  batch_no?: string;
  serial_no?: string;
  expiry_date?: string;
  manufacture_date?: string;
  expected_qty: number;
  received_qty: number;
  damaged_qty?: number;
  uom: string;
  qty_per_pallet?: number;
  generate_pallets?: boolean;
  qc_required?: boolean;
  qc_status?: string;
  qc_notes?: string;
  sku_name?: string;
  estimated_pallets?: number;
}

const WarehouseInboundPage = () => {
  const { suppliers, loading: suppliersLoading } = useSuppliers();
  const { skus, loading: skusLoading } = useSkus({ status: 'active' });
  const { warehouses, loading: warehousesLoading } = useWarehouses();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [inboundData, setInboundData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedReceive, setSelectedReceive] = useState<any>(null);
  
  // Location states
  const [locations, setLocations] = useState<any[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  
  // Form states for new receive
  const [receiveForm, setReceiveForm] = useState({
    warehouse_id: '',
    supplier_id: '',
    receiving_location_id: '',
    created_by: 'EMP001',
    receive_type: 'domestic',
    pallet_mode: 'auto',
    allow_mixed_sku: false,
    auto_generate_putaway: true,
    container_no: '',
    seal_no: '',
    bill_of_lading: '',
    customs_doc_no: '',
    po_number: '',
    invoice_number: '',
    delivery_note: '',
    receive_date: new Date().toISOString().split('T')[0],
    remarks: ''
  });

  // Form states for receive details (SKU items)
  const [receiveDetails, setReceiveDetails] = useState<ReceiveDetailForm[]>([
    {
      temp_id: '1',
      line_no: 1,
      sku_id: '',
      lot_no: '',
      batch_no: '',
      serial_no: '',
      expiry_date: '',
      manufacture_date: '',
      expected_qty: 0,
      received_qty: 0,
      damaged_qty: 0,
      uom: 'ชิ้น',
      qty_per_pallet: 0,
      generate_pallets: false,
      qc_required: false,
      qc_status: 'pending',
      qc_notes: ''
    }
  ]);

  // Fetch receiving locations when warehouse changes
  useEffect(() => {
    if (receiveForm.warehouse_id) {
      const fetchLocations = async () => {
        setLocationsLoading(true);
        try {
          const response = await fetch(`/api/warehouse/locations?warehouse_id=${receiveForm.warehouse_id}&location_type=receiving`);
          const result = await response.json();
          if (result.data) {
            setLocations(result.data);
          }
        } catch (error) {
          console.error('Error fetching locations:', error);
        } finally {
          setLocationsLoading(false);
        }
      };
      fetchLocations();
    }
  }, [receiveForm.warehouse_id]);

  // Auto-select first warehouse when warehouses are loaded
  useEffect(() => {
    if (warehouses.length > 0 && !receiveForm.warehouse_id) {
      setReceiveForm(prev => ({
        ...prev,
        warehouse_id: warehouses[0].warehouse_id
      }));
    }
  }, [warehouses, receiveForm.warehouse_id]);

  // Auto-select first location when locations are loaded
  useEffect(() => {
    if (locations.length > 0 && !receiveForm.receiving_location_id) {
      setReceiveForm(prev => ({
        ...prev,
        receiving_location_id: locations[0].location_id
      }));
    }
  }, [locations, receiveForm.receiving_location_id]);

  // Fetch inbound data from database
  useEffect(() => {
    const fetchInboundData = async () => {
      try {
        setLoading(true);
        const result = await wmsReceiveNewService.getAllReceives({
          search: searchTerm,
          limit: 100
        });
        
        if (result.error) {
          setError(result.error);
        } else {
          setInboundData(result.data);
        }
      } catch (err) {
        setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
        console.error('Error fetching inbound data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchInboundData();
  }, [searchTerm]);

  // Handler functions
  const handleViewReceive = (receive: any) => {
    setSelectedReceive(receive);
    setViewModalOpen(true);
  };

  const handleDeleteReceive = async (receive: any) => {
    const confirmMessage = `คุณต้องการลบการรับสินค้า #${receive.receive_id} หรือไม่?

ข้อมูลที่จะถูกลบ:
- วันที่รับ: ${new Date(receive.receive_date).toLocaleDateString('th-TH')}
- ซัพพลายเออร์: ${receive.supplier_name || '-'}
- จำนวนสินค้า: ${receive.total_items || 0} รายการ
- จำนวนพาเลท: ${receive.total_pallets || 0} พาเลท

⚠️ การลบไม่สามารถยกเลิกได้`;

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      const result = await wmsReceiveNewService.deleteReceive(receive.receive_id);
      
      if (result.error) {
        alert('เกิดข้อผิดพลาดในการลบ: ' + result.error);
        return;
      }
      
      // Refresh data after successful deletion
      const refreshResult = await wmsReceiveNewService.getAllReceives({
        search: searchTerm,
        limit: 100
      });
      
      if (!refreshResult.error) {
        setInboundData(refreshResult.data);
      }
      
      alert('ลบการรับสินค้าสำเร็จ');
    } catch (error) {
      console.error('Error deleting receive:', error);
      alert('เกิดข้อผิดพลาดในการลบข้อมูล');
    }
  };

  const handleAddNewReceive = () => {
    setSelectedReceive(null);
    // Reset forms
    setReceiveForm({
      warehouse_id: warehouses.length > 0 ? warehouses[0].warehouse_id : '',
      supplier_id: '',
      receiving_location_id: locations.length > 0 ? locations[0].location_id : '',
      created_by: 'EMP001',
      receive_type: 'domestic',
      pallet_mode: 'auto',
      allow_mixed_sku: false,
      auto_generate_putaway: true,
      container_no: '',
      seal_no: '',
      bill_of_lading: '',
      customs_doc_no: '',
      po_number: '',
      invoice_number: '',
      delivery_note: '',
      receive_date: new Date().toISOString().split('T')[0],
      remarks: ''
    });
    
    // Reset receive details
    setReceiveDetails([{
      temp_id: '1',
      line_no: 1,
      sku_id: '',
      lot_no: '',
      batch_no: '',
      serial_no: '',
      expiry_date: '',
      manufacture_date: '',
      expected_qty: 0,
      received_qty: 0,
      damaged_qty: 0,
      uom: 'ชิ้น',
      qty_per_pallet: 0,
      generate_pallets: false,
      qc_required: false,
      qc_status: 'pending',
      qc_notes: ''
    }]);
    
    setAddModalOpen(true);
  };

  // Add new detail row
  const addDetailRow = () => {
    const newId = (Math.max(...receiveDetails.map(d => parseInt(d.temp_id) || 0)) + 1).toString();
    const newDetail: ReceiveDetailForm = {
      temp_id: newId,
      line_no: receiveDetails.length + 1,
      sku_id: '',
      lot_no: '',
      batch_no: '',
      serial_no: '',
      expiry_date: '',
      manufacture_date: '',
      expected_qty: 0,
      received_qty: 0,
      damaged_qty: 0,
      uom: 'ชิ้น',
      qty_per_pallet: 0,
      generate_pallets: false,
      qc_required: false,
      qc_status: 'pending',
      qc_notes: ''
    };
    setReceiveDetails([...receiveDetails, newDetail]);
  };

  // Remove detail row
  const removeDetailRow = (tempId: string) => {
    if (receiveDetails.length > 1) {
      setReceiveDetails(receiveDetails.filter(d => d.temp_id !== tempId));
    }
  };

  // Update detail row
  const updateDetailRow = (tempId: string, field: string, value: any) => {
    setReceiveDetails(prev => prev.map(detail => {
      if (detail.temp_id !== tempId) return detail;
      
      const updated = { ...detail, [field]: value };
      
      // Auto-fill UOM when SKU is selected
      if (field === 'sku_id' && value) {
        const selectedSku = skus.find(sku => sku.sku_id === value);
        if (selectedSku) {
          updated.uom = selectedSku.uom_base;
          updated.sku_name = selectedSku.sku_name;
        }
        
        // Auto-enable pallet generation for applicable receive types
        if (['domestic', 'import', 'production'].includes(receiveForm.receive_type)) {
          updated.generate_pallets = true;
        }
      }
      
      // Calculate estimated pallets if qty_per_pallet is set
      if (field === 'received_qty' || field === 'qty_per_pallet') {
        if (updated.generate_pallets && updated.qty_per_pallet && updated.received_qty) {
          updated.estimated_pallets = Math.ceil(updated.received_qty / updated.qty_per_pallet);
        }
      }
      
      return updated;
    }));
  };

  const handleSaveReceive = async () => {
    try {
      // Validate required fields
      if (!receiveForm.supplier_id) {
        alert('กรุณาเลือกซัพพลายเออร์');
        return;
      }

      if (!receiveForm.warehouse_id) {
        alert('กรุณาเลือกคลัง');
        return;
      }

      if (!receiveForm.receiving_location_id) {
        alert('กรุณาเลือกจุดรับสินค้า');
        return;
      }

      // Validate import-specific fields
      if (receiveForm.receive_type === 'import') {
        if (!receiveForm.container_no || !receiveForm.bill_of_lading) {
          alert('กรุณากรอกเลขตู้และเลขใบส่งของสำหรับสินค้านำเข้า');
          return;
        }
      }

      // Validate details
      const validDetails = receiveDetails.filter(detail => 
        detail.sku_id && detail.received_qty && detail.received_qty > 0
      );

      if (validDetails.length === 0) {
        alert('กรุณาเพิ่มรายละเอียดสินค้าอย่างน้อย 1 รายการ');
        return;
      }

      // Prepare detail data (remove temp_id and other form-specific fields)
      const detailsData = validDetails.map((detail, index) => ({
        line_no: index + 1,
        sku_id: detail.sku_id,
        lot_no: detail.lot_no || null,
        batch_no: detail.batch_no || null,
        serial_no: detail.serial_no || null,
        expiry_date: detail.expiry_date || null,
        manufacture_date: detail.manufacture_date || null,
        expected_qty: detail.expected_qty || detail.received_qty,
        received_qty: detail.received_qty,
        damaged_qty: detail.damaged_qty || 0,
        uom: detail.uom,
        qty_per_pallet: detail.qty_per_pallet || null,
        generate_pallets: detail.generate_pallets || false,
        qc_required: detail.qc_required || false,
        qc_status: detail.qc_status || 'pending',
        qc_notes: detail.qc_notes || null
      }));
      
      const result = await wmsReceiveNewService.createReceive(receiveForm, detailsData);
      
      if (result.error) {
        alert('เกิดข้อผิดพลาด: ' + result.error);
        return;
      }
      
      // Refresh data
      const refreshResult = await wmsReceiveNewService.getAllReceives({
        search: searchTerm,
        limit: 100
      });
      
      if (!refreshResult.error) {
        setInboundData(refreshResult.data);
      }
      
      alert('บันทึกการรับสินค้าสำเร็จ');
      closeAllModals();
    } catch (error) {
      console.error('Error creating receive:', error);
      alert('เกิดข้อผิดพลาดในการบันทึก');
    }
  };

  const closeAllModals = () => {
    setViewModalOpen(false);
    setAddModalOpen(false);
    setSelectedReceive(null);
  };

  // Get receive status badge
  const getStatusBadge = (receive: any) => {
    switch (receive.status) {
      case 'pending':
        return <Badge variant="warning">รอรับ</Badge>;
      case 'in_progress':
        return <Badge variant="info">กำลังรับ</Badge>;
      case 'completed':
        return <Badge variant="success">สำเร็จ</Badge>;
      case 'cancelled':
        return <Badge variant="danger">ยกเลิก</Badge>;
      default:
        return <Badge variant="default">{receive.status}</Badge>;
    }
  };

  const getReceiveTypeBadge = (receiveType: string) => {
    switch (receiveType) {
      case 'domestic':
        return <Badge variant="default" size="sm">ในประเทศ</Badge>;
      case 'import':
        return <Badge variant="info" size="sm">ต่างประเทศ</Badge>;
      case 'production':
        return <Badge variant="success" size="sm">จากผลิต</Badge>;
      case 'return':
        return <Badge variant="warning" size="sm">คืนสินค้า</Badge>;
      case 'transfer':
        return <Badge variant="secondary" size="sm">โอนย้าย</Badge>;
      case 'adjustment':
        return <Badge variant="default" size="sm">ปรับปรุง</Badge>;
      default:
        return <Badge variant="default" size="sm">{receiveType}</Badge>;
    }
  };

  const filteredData = inboundData.filter(item => {
    const matchesSearch = 
      (item.receive_no?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.po_number?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.container_no?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.bill_of_lading?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      item.receive_id.toString().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || item.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const totalInbound = inboundData.length;
  const pendingInbound = inboundData.filter(item => item.status === 'pending').length;
  const receivingInbound = inboundData.filter(item => item.status === 'in_progress').length;
  const completedInbound = inboundData.filter(item => item.status === 'completed').length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-thai-gray-900 font-thai">
            รับสินค้าเข้าคลัง
          </h1>
          <p className="text-thai-gray-600 font-thai mt-1">
            จัดการการรับสินค้าเข้าคลัง พร้อมการเจน Pallet ID อัตโนมัติ
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <Button variant="primary" icon={Plus} onClick={handleAddNewReceive}>
            รับสินค้าเข้า
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-thai-gray-600 font-thai">
                ทั้งหมด
              </p>
              <p className="text-2xl font-bold text-thai-gray-900 font-thai">
                {totalInbound}
              </p>
            </div>
            <Package className="w-8 h-8 text-blue-500" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-thai-gray-600 font-thai">
                รอรับ
              </p>
              <p className="text-2xl font-bold text-orange-600 font-thai">
                {pendingInbound}
              </p>
            </div>
            <Clock className="w-8 h-8 text-orange-500" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-thai-gray-600 font-thai">
                กำลังรับ
              </p>
              <p className="text-2xl font-bold text-blue-600 font-thai">
                {receivingInbound}
              </p>
            </div>
            <TruckIcon className="w-8 h-8 text-blue-500" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-thai-gray-600 font-thai">
                สำเร็จ
              </p>
              <p className="text-2xl font-bold text-green-600 font-thai">
                {completedInbound}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-thai-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="ค้นหาด้วยเลขเอกสาร, เลขตู้, ซัพพลายเออร์..."
                className="w-full pl-10 pr-4 py-2 border border-thai-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-thai"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <select
              className="px-4 py-2 border border-thai-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-thai"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="all">สถานะทั้งหมด</option>
              <option value="pending">รอรับ</option>
              <option value="in_progress">กำลังรับ</option>
              <option value="completed">สำเร็จ</option>
              <option value="cancelled">ยกเลิก</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Data Table */}
      <Card>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-thai-gray-600 font-thai">กำลังโหลด...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-red-600 font-thai">{error}</p>
            </div>
          ) : (
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.Head className="w-32">เลขรับสินค้า</Table.Head>
                  <Table.Head className="w-32">วันที่รับ</Table.Head>
                  <Table.Head className="w-32">ประเภท</Table.Head>
                  <Table.Head className="w-48">เลขเอกสารอ้างอิง</Table.Head>
                  <Table.Head className="w-48">ซัพพลายเออร์</Table.Head>
                  <Table.Head className="w-32">คลัง</Table.Head>
                  <Table.Head className="w-24 text-center">จำนวนสินค้า</Table.Head>
                  <Table.Head className="w-24 text-center">จำนวนพาเลท</Table.Head>
                  <Table.Head className="w-24">สถานะ</Table.Head>
                  <Table.Head className="w-40">จัดการ</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {filteredData.length === 0 ? (
                  <Table.Row>
                    <Table.Cell colSpan={10} className="text-center py-8">
                      <span className="text-thai-gray-500 font-thai">ไม่พบข้อมูลการรับสินค้า</span>
                    </Table.Cell>
                  </Table.Row>
                ) : (
                  filteredData.map((receive) => (
                    <Table.Row key={receive.receive_id}>
                      <Table.Cell className="w-32">
                        <span className="font-mono text-sm">{receive.receive_no}</span>
                      </Table.Cell>
                      <Table.Cell className="w-32">
                        <span className="font-thai text-sm">
                          {new Date(receive.receive_date).toLocaleDateString('th-TH')}
                        </span>
                      </Table.Cell>
                      <Table.Cell className="w-32">
                        {getReceiveTypeBadge(receive.receive_type)}
                      </Table.Cell>
                      <Table.Cell className="w-48">
                        <span className="font-thai text-sm">{receive.po_number || receive.container_no || '-'}</span>
                      </Table.Cell>
                      <Table.Cell className="w-48">
                        <span className="font-thai text-sm">
                          {receive.supplier_name || '-'}
                        </span>
                      </Table.Cell>
                      <Table.Cell className="w-32">
                        <span className="font-thai text-sm">{receive.warehouse_name || '-'}</span>
                      </Table.Cell>
                      <Table.Cell className="w-24 text-center">
                        <span className="font-thai text-sm">{receive.total_items || 0}</span>
                      </Table.Cell>
                      <Table.Cell className="w-24 text-center">
                        <span className="font-thai text-sm">{receive.total_pallets || 0}</span>
                      </Table.Cell>
                      <Table.Cell className="w-24">
                        {getStatusBadge(receive)}
                      </Table.Cell>
                      <Table.Cell className="w-40">
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            icon={Eye}
                            onClick={() => handleViewReceive(receive)}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            ดู
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            icon={Trash2}
                            onClick={() => handleDeleteReceive(receive)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            ลบ
                          </Button>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  ))
                )}
              </Table.Body>
            </Table>
          )}
        </div>
      </Card>

      {/* Add Receive Modal */}
      <Modal
        isOpen={addModalOpen}
        onClose={closeAllModals}
        title="รับสินค้าเข้าคลัง"
        size="2xl"
      >
        <div className="space-y-6">
          {/* Receive Information */}
          <div className="border-b pb-6">
            <h3 className="text-lg font-semibold text-thai-gray-900 font-thai mb-4">
              ข้อมูลการรับสินค้า
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Warehouse Selection */}
              <div>
                <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-1">
                  คลัง *
                </label>
                <select
                  className="w-full px-3 py-2 border border-thai-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-thai"
                  value={receiveForm.warehouse_id}
                  onChange={(e) => setReceiveForm(prev => ({ ...prev, warehouse_id: e.target.value }))}
                  required
                >
                  <option value="">เลือกคลัง</option>
                  {warehouses.map(warehouse => (
                    <option key={warehouse.warehouse_id} value={warehouse.warehouse_id}>
                      {warehouse.warehouse_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Receive Location */}
              <div>
                <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-1">
                  จุดรับสินค้า *
                </label>
                <select
                  className="w-full px-3 py-2 border border-thai-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-thai"
                  value={receiveForm.receiving_location_id}
                  onChange={(e) => setReceiveForm(prev => ({ ...prev, receiving_location_id: e.target.value }))}
                  required
                >
                  <option value="">เลือกจุดรับสินค้า</option>
                  {locations.map(location => (
                    <option key={location.location_id} value={location.location_id}>
                      {location.location_name} ({location.location_code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Receive Type */}
              <div>
                <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-1">
                  ประเภทการรับ *
                </label>
                <select
                  className="w-full px-3 py-2 border border-thai-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-thai"
                  value={receiveForm.receive_type}
                  onChange={(e) => setReceiveForm(prev => ({ 
                    ...prev, 
                    receive_type: e.target.value,
                    // Reset import fields if not import
                    container_no: e.target.value !== 'import' ? '' : prev.container_no,
                    seal_no: e.target.value !== 'import' ? '' : prev.seal_no,
                    bill_of_lading: e.target.value !== 'import' ? '' : prev.bill_of_lading
                  }))}
                  required
                >
                  <option value="domestic">รับสินค้าในประเทศ</option>
                  <option value="import">รับสินค้าต่างประเทศ</option>
                  <option value="production">รับสินค้าจากการผลิต</option>
                  <option value="return">รับสินค้าคืน</option>
                  <option value="transfer">รับสินค้าโอนย้าย</option>
                  <option value="adjustment">ปรับปรุงสต็อก</option>
                </select>
              </div>

              {/* Supplier Selection */}
              <div>
                <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-1">
                  ซัพพลายเออร์ *
                </label>
                <select
                  className="w-full px-3 py-2 border border-thai-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-thai"
                  value={receiveForm.supplier_id}
                  onChange={(e) => setReceiveForm(prev => ({ ...prev, supplier_id: e.target.value }))}
                  required
                >
                  <option value="">เลือกซัพพลายเออร์</option>
                  {suppliers.map(supplier => (
                    <option key={supplier.supplier_id} value={supplier.supplier_id}>
                      {supplier.supplier_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Receive Date */}
              <div>
                <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-1">
                  วันที่รับ *
                </label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border border-thai-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-thai"
                  value={receiveForm.receive_date}
                  onChange={(e) => setReceiveForm(prev => ({ ...prev, receive_date: e.target.value }))}
                  required
                />
              </div>

              {/* PO Number */}
              <div>
                <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-1">
                  เลข PO / เอกสารอ้างอิง
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-thai-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-thai"
                  value={receiveForm.po_number}
                  onChange={(e) => setReceiveForm(prev => ({ ...prev, po_number: e.target.value }))}
                  placeholder="เลขใบสั่งซื้อ หรือ เลขอ้างอิง"
                />
              </div>

              {/* Pallet Mode */}
              <div>
                <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-1">
                  โหมดการติดตาม Pallet
                </label>
                <select
                  className="w-full px-3 py-2 border border-thai-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-thai"
                  value={receiveForm.pallet_mode}
                  onChange={(e) => setReceiveForm(prev => ({ ...prev, pallet_mode: e.target.value }))}
                >
                  <option value="none">ไม่เจน Pallet ID</option>
                  <option value="manual">กำหนดจำนวนต่อพาเลทเอง</option>
                  <option value="auto">ใช้ข้อมูลจาก Master SKU</option>
                </select>
              </div>
            </div>

            {/* Import-specific fields */}
            {receiveForm.receive_type === 'import' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 p-4 bg-blue-50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-1">
                    เลขตู้ *
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-thai-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-thai"
                    value={receiveForm.container_no}
                    onChange={(e) => setReceiveForm(prev => ({ ...prev, container_no: e.target.value }))}
                    placeholder="XXXX123456-7"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-1">
                    เลขซีล
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-thai-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-thai"
                    value={receiveForm.seal_no}
                    onChange={(e) => setReceiveForm(prev => ({ ...prev, seal_no: e.target.value }))}
                    placeholder="เลขซีลตู้"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-1">
                    เลขใบส่งของ *
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-thai-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-thai"
                    value={receiveForm.bill_of_lading}
                    onChange={(e) => setReceiveForm(prev => ({ ...prev, bill_of_lading: e.target.value }))}
                    placeholder="B/L Number"
                    required
                  />
                </div>
              </div>
            )}

            {/* Additional Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="allow_mixed_sku"
                  className="mr-2"
                  checked={receiveForm.allow_mixed_sku}
                  onChange={(e) => setReceiveForm(prev => ({ ...prev, allow_mixed_sku: e.target.checked }))}
                />
                <label htmlFor="allow_mixed_sku" className="text-sm text-thai-gray-700 font-thai">
                  อนุญาตให้ผสม SKU ในพาเลทเดียวกัน
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="auto_generate_putaway"
                  className="mr-2"
                  checked={receiveForm.auto_generate_putaway}
                  onChange={(e) => setReceiveForm(prev => ({ ...prev, auto_generate_putaway: e.target.checked }))}
                />
                <label htmlFor="auto_generate_putaway" className="text-sm text-thai-gray-700 font-thai">
                  สร้างงานจัดเก็บอัตโนมัติ
                </label>
              </div>
            </div>

            {/* Remarks */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-1">
                หมายเหตุ
              </label>
              <textarea
                className="w-full px-3 py-2 border border-thai-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-thai"
                rows={3}
                value={receiveForm.remarks}
                onChange={(e) => setReceiveForm(prev => ({ ...prev, remarks: e.target.value }))}
                placeholder="หมายเหตุเพิ่มเติม..."
              />
            </div>
          </div>

          {/* Product Details Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-thai-gray-900 font-thai">
                รายละเอียดสินค้า
              </h3>
              <Button variant="outline" size="sm" icon={Plus} onClick={addDetailRow}>
                เพิ่มสินค้า
              </Button>
            </div>

            <div className="space-y-4">
              {receiveDetails.map((detail, index) => (
                <div key={detail.temp_id} className="border border-thai-gray-200 rounded-lg p-4 bg-thai-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-thai-gray-700 font-thai">
                      สินค้าที่ {index + 1}
                    </span>
                    {receiveDetails.length > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeDetailRow(detail.temp_id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        ลบ
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* SKU Selection */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-1">
                        SKU *
                      </label>
                      <select
                        className="w-full px-3 py-2 border border-thai-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-thai"
                        value={detail.sku_id}
                        onChange={(e) => updateDetailRow(detail.temp_id, 'sku_id', e.target.value)}
                        required
                      >
                        <option value="">เลือก SKU</option>
                        {skus.map(sku => (
                          <option key={sku.sku_id} value={sku.sku_id}>
                            {sku.sku_id} - {sku.sku_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Expected Quantity */}
                    <div>
                      <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-1">
                        จำนวนที่คาดว่าจะรับ
                      </label>
                      <input
                        type="number"
                        className="w-full px-3 py-2 border border-thai-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-thai"
                        value={detail.expected_qty || ''}
                        onChange={(e) => updateDetailRow(detail.temp_id, 'expected_qty', parseInt(e.target.value) || 0)}
                        min="0"
                      />
                    </div>

                    {/* Received Quantity */}
                    <div>
                      <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-1">
                        จำนวนที่รับจริง *
                      </label>
                      <input
                        type="number"
                        className="w-full px-3 py-2 border border-thai-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-thai"
                        value={detail.received_qty || ''}
                        onChange={(e) => updateDetailRow(detail.temp_id, 'received_qty', parseInt(e.target.value) || 0)}
                        min="1"
                        required
                      />
                    </div>

                    {/* UOM */}
                    <div>
                      <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-1">
                        หน่วย
                      </label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-thai-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-thai"
                        value={detail.uom}
                        onChange={(e) => updateDetailRow(detail.temp_id, 'uom', e.target.value)}
                        readOnly
                      />
                    </div>

                    {/* Lot/Batch Numbers */}
                    <div>
                      <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-1">
                        Lot No.
                      </label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-thai-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-thai"
                        value={detail.lot_no || ''}
                        onChange={(e) => updateDetailRow(detail.temp_id, 'lot_no', e.target.value)}
                        placeholder="Lot Number"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-1">
                        Batch No.
                      </label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-thai-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-thai"
                        value={detail.batch_no || ''}
                        onChange={(e) => updateDetailRow(detail.temp_id, 'batch_no', e.target.value)}
                        placeholder="Batch Number"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-1">
                        วันหมดอายุ
                      </label>
                      <input
                        type="date"
                        className="w-full px-3 py-2 border border-thai-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-thai"
                        value={detail.expiry_date || ''}
                        onChange={(e) => updateDetailRow(detail.temp_id, 'expiry_date', e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-1">
                        จำนวนที่เสียหาย
                      </label>
                      <input
                        type="number"
                        className="w-full px-3 py-2 border border-thai-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-thai"
                        value={detail.damaged_qty || ''}
                        onChange={(e) => updateDetailRow(detail.temp_id, 'damaged_qty', parseInt(e.target.value) || 0)}
                        min="0"
                      />
                    </div>
                  </div>

                  {/* Pallet Configuration */}
                  {receiveForm.pallet_mode !== 'none' && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                      <h4 className="text-sm font-medium text-thai-gray-700 font-thai mb-3">
                        การตั้งค่า Pallet
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id={`generate_pallet_${detail.temp_id}`}
                            className="mr-2"
                            checked={detail.generate_pallets}
                            onChange={(e) => updateDetailRow(detail.temp_id, 'generate_pallets', e.target.checked)}
                          />
                          <label htmlFor={`generate_pallet_${detail.temp_id}`} className="text-sm text-thai-gray-700 font-thai">
                            เจน Pallet ID อัตโนมัติ
                          </label>
                        </div>

                        {receiveForm.pallet_mode === 'manual' && detail.generate_pallets && (
                          <div>
                            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-1">
                              จำนวนชิ้นต่อพาเลท
                            </label>
                            <input
                              type="number"
                              className="w-full px-3 py-2 border border-thai-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-thai"
                              value={detail.qty_per_pallet || ''}
                              onChange={(e) => updateDetailRow(detail.temp_id, 'qty_per_pallet', parseInt(e.target.value) || 0)}
                              min="1"
                              placeholder="จำนวนต่อพาเลท"
                            />
                          </div>
                        )}

                        {detail.generate_pallets && detail.estimated_pallets && detail.estimated_pallets > 0 && (
                          <div className="text-sm text-thai-gray-600 font-thai">
                            จะสร้าง {detail.estimated_pallets} พาเลท
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-6 border-t">
            <Button variant="outline" onClick={closeAllModals}>
              ยกเลิก
            </Button>
            <Button variant="primary" onClick={handleSaveReceive}>
              บันทึกการรับสินค้า
            </Button>
          </div>
        </div>
      </Modal>

      {/* View Receive Modal */}
      <Modal
        isOpen={viewModalOpen}
        onClose={closeAllModals}
        title={`ดูการรับสินค้า ${selectedReceive?.receive_no || ''}`}
        size="2xl"
      >
        {selectedReceive && (
          <div className="space-y-6">
            {/* Header Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-thai-gray-50 rounded-lg">
              <div>
                <span className="text-sm text-thai-gray-600 font-thai">ประเภทการรับ:</span>
                <div className="mt-1">{getReceiveTypeBadge(selectedReceive.receive_type)}</div>
              </div>
              
              <div>
                <span className="text-sm text-thai-gray-600 font-thai">วันที่รับ:</span>
                <p className="text-sm font-thai font-medium">
                  {new Date(selectedReceive.receive_date).toLocaleDateString('th-TH')}
                </p>
              </div>
              
              <div>
                <span className="text-sm text-thai-gray-600 font-thai">สถานะ:</span>
                <div className="mt-1">{getStatusBadge(selectedReceive)}</div>
              </div>
              
              {selectedReceive.warehouse_name && (
                <div>
                  <span className="text-sm text-thai-gray-600 font-thai">คลัง:</span>
                  <p className="text-sm font-thai font-medium">{selectedReceive.warehouse_name}</p>
                </div>
              )}
              
              {selectedReceive.supplier_name && (
                <div>
                  <span className="text-sm text-thai-gray-600 font-thai">ซัพพลายเออร์:</span>
                  <p className="text-sm font-thai font-medium">{selectedReceive.supplier_name}</p>
                </div>
              )}
              
              {selectedReceive.po_number && (
                <div>
                  <span className="text-sm text-thai-gray-600 font-thai">เลข PO:</span>
                  <p className="text-sm font-thai font-medium">{selectedReceive.po_number}</p>
                </div>
              )}
              
              {selectedReceive.container_no && (
                <div>
                  <span className="text-sm text-thai-gray-600 font-thai">เลขตู้:</span>
                  <p className="text-sm font-thai font-medium">{selectedReceive.container_no}</p>
                </div>
              )}
              
              {selectedReceive.bill_of_lading && (
                <div>
                  <span className="text-sm text-thai-gray-600 font-thai">เลขใบส่งของ:</span>
                  <p className="text-sm font-thai font-medium">{selectedReceive.bill_of_lading}</p>
                </div>
              )}
            </div>

            {/* Product Details */}
            <div>
              <h3 className="text-lg font-semibold text-thai-gray-900 font-thai mb-4">
                รายละเอียดสินค้า
              </h3>
              
              <div className="space-y-4">
                {selectedReceive.details?.map((detail: any, detailIndex: number) => (
                  <div key={detail.receive_detail_id} className="border border-thai-gray-200 rounded-lg overflow-hidden">
                    {/* Product Header */}
                    <div className="bg-thai-gray-50 px-4 py-3 border-b border-thai-gray-200">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <span className="text-sm text-thai-gray-600 font-thai">SKU:</span>
                          <p className="text-sm font-thai font-medium">{detail.sku_id}</p>
                          {detail.sku_name && (
                            <p className="text-xs text-thai-gray-500 font-thai">{detail.sku_name}</p>
                          )}
                        </div>
                        
                        <div>
                          <span className="text-sm text-thai-gray-600 font-thai">จำนวนรับ:</span>
                          <p className="text-sm font-thai font-medium">{detail.received_qty} {detail.uom}</p>
                        </div>
                        
                        <div>
                          <span className="text-sm text-thai-gray-600 font-thai">จำนวนพาเลท:</span>
                          <p className="text-sm font-thai font-medium">{detail.pallets?.length || 0} พาเลท</p>
                        </div>
                        
                        {detail.lot_no && (
                          <div>
                            <span className="text-sm text-thai-gray-600 font-thai">Lot No.:</span>
                            <p className="text-sm font-thai font-medium">{detail.lot_no}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Pallet Table */}
                    {detail.pallets && detail.pallets.length > 0 ? (
                      <div className="overflow-x-auto">
                        <Table>
                          <Table.Header>
                            <Table.Row>
                              <Table.Head className="w-16">#</Table.Head>
                              <Table.Head className="w-48">Pallet ID</Table.Head>
                              <Table.Head className="w-24">ลำดับ</Table.Head>
                              <Table.Head className="w-24">จำนวน</Table.Head>
                              <Table.Head className="w-24">หน่วย</Table.Head>
                              <Table.Head className="w-32">สถานะป้าย</Table.Head>
                              <Table.Head className="w-24">ตำแหน่ง</Table.Head>
                            </Table.Row>
                          </Table.Header>
                          <Table.Body>
                            {detail.pallets.map((pallet: any, palletIndex: number) => (
                              <Table.Row key={pallet.pallet_id}>
                                <Table.Cell className="w-16">
                                  <span className="text-sm font-thai">{palletIndex + 1}</span>
                                </Table.Cell>
                                <Table.Cell className="w-48">
                                  <div className="flex items-center space-x-2">
                                    <span className="font-mono text-sm font-medium">{pallet.pallet_id}</span>
                                    {pallet.label_printed && (
                                      <Badge variant="success" size="sm">
                                        <PrinterIcon className="w-3 h-3 mr-1" />
                                        พิมพ์แล้ว
                                      </Badge>
                                    )}
                                  </div>
                                </Table.Cell>
                                <Table.Cell className="w-24">
                                  <span className="text-sm font-thai">{pallet.sequence_no}</span>
                                </Table.Cell>
                                <Table.Cell className="w-24">
                                  <span className="text-sm font-thai font-medium">{pallet.qty_in_pallet}</span>
                                </Table.Cell>
                                <Table.Cell className="w-24">
                                  <span className="text-sm font-thai">{detail.uom}</span>
                                </Table.Cell>
                                <Table.Cell className="w-32">
                                  {pallet.label_printed ? (
                                    <Badge variant="success" size="sm">พิมพ์แล้ว</Badge>
                                  ) : (
                                    <Badge variant="warning" size="sm">ยังไม่พิมพ์</Badge>
                                  )}
                                </Table.Cell>
                                <Table.Cell className="w-24">
                                  <span className="text-sm font-thai text-thai-gray-500">
                                    {pallet.current_location_id || 'RCV'}
                                  </span>
                                </Table.Cell>
                              </Table.Row>
                            ))}
                          </Table.Body>
                        </Table>
                      </div>
                    ) : (
                      <div className="p-4 text-center text-thai-gray-500 font-thai">
                        ไม่มีพาเลทสำหรับสินค้านี้
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default WarehouseInboundPage;