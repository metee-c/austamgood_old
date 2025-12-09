'use client';
import React, { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Upload, FileSpreadsheet, Route, Package, Star, Calendar, Warehouse } from 'lucide-react';
import { useWarehouses } from '@/hooks/useWarehouses';
import DuplicateOrdersModal from '@/components/orders/DuplicateOrdersModal';

interface ImportOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (type: string, file: File, warehouse: string, orderDate: string) => void;
  onRefresh?: () => void; // เพิ่ม callback สำหรับ refresh ข้อมูลโดยไม่เรียก API ซ้ำ
}

type ImportType = 'route' | 'piece' | 'special' | null;

const ImportOrderModal: React.FC<ImportOrderModalProps> = ({ isOpen, onClose, onImport, onRefresh }) => {
  const [selectedType, setSelectedType] = useState<ImportType>('route');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const { warehouses, loading: warehousesLoading, error: warehousesError } = useWarehouses();

  // States for conflict resolution
  const [showDuplicatesModal, setShowDuplicatesModal] = useState(false);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [allOrders, setAllOrders] = useState<any[]>([]);



  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleImport = async () => {
    if (selectedFile && selectedType && selectedWarehouse && selectedDate) {
      setIsImporting(true);
      try {
        // Upload file and check for conflicts
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('fileType', selectedType === 'route' ? 'route_planning' : selectedType === 'piece' ? 'express' : 'special');
        formData.append('defaultWarehouseId', selectedWarehouse);
        formData.append('deliveryDate', selectedDate);

        const response = await fetch('/api/orders/import', {
          method: 'POST',
          body: formData
        });

        const result = await response.json();

        if (result.data?.hasConflicts) {
          // Show conflicts modal
          setConflicts(result.data.conflicts || []);
          setDuplicateCount(result.data.stats?.duplicates || 0);
          setNewOrdersCount(result.data.stats?.new || 0);
          setAllOrders(result.data.orders || []);
          setShowDuplicatesModal(true);
          setIsImporting(false);
        } else if (result.error) {
          alert(`เกิดข้อผิดพลาด: ${result.error}`);
          setIsImporting(false);
        } else {
          // Success - no conflicts
          const successCount = result.data?.successCount || 0;
          const duplicateCount = result.data?.duplicateCount || 0;
          const errorCount = result.data?.errorCount || 0;

          let message = '';

          if (successCount > 0) {
            message = `นำเข้าออเดอร์สำเร็จ ${successCount} รายการ`;
            if (duplicateCount > 0) {
              message += ` (ข้ามซ้ำ ${duplicateCount} รายการ)`;
            }
            if (errorCount > 0) {
              message += ` (ผิดพลาด ${errorCount} รายการ)`;
            }
          } else if (duplicateCount > 0) {
            message = `ไม่มีการนำเข้าออเดอร์ใหม่ (พบออเดอร์ซ้ำทั้งหมด ${duplicateCount} รายการ)`;
          } else if (errorCount > 0) {
            message = `การนำเข้าล้มเหลว (ผิดพลาด ${errorCount} รายการ)`;
          } else {
            message = `ไม่พบข้อมูลที่ต้องการนำเข้า`;
          }

          alert(message);
          setIsImporting(false);
          handleClose();
          // Call parent onImport for refresh
          onImport(selectedType, selectedFile, selectedWarehouse, selectedDate);
        }
      } catch (error: any) {
        console.error('Import error:', error);
        alert(`เกิดข้อผิดพลาด: ${error.message || 'ไม่สามารถนำเข้าได้'}`);
        setIsImporting(false);
      }
    }
  };

  const handleConfirmDuplicates = async (selectedOrders: string[]) => {
    try {
      // Prepare data for confirmation
      const confirmedOrders = allOrders.filter(order =>
        selectedOrders.includes(order.order_no) &&
        conflicts.some(c => c.order_no === order.order_no)
      );

      const newOrders = allOrders.filter(order =>
        !conflicts.some(c => c.order_no === order.order_no) &&
        !duplicateCount // Only include if there are no simple duplicates
      );

      const response = await fetch('/api/orders/import/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmedOrders,
          newOrders
        })
      });

      const result = await response.json();

      if (result.error) {
        alert(`เกิดข้อผิดพลาด: ${result.error}`);
      } else {
        // แสดงจำนวนที่อัพเดทและนำเข้า
        const updatedCount = confirmedOrders.length;
        const newCount = newOrders.length;
        const skippedCount = conflicts.length - confirmedOrders.length;

        let message = '';
        if (updatedCount > 0 && newCount > 0) {
          message = `อัพเดทออเดอร์ ${updatedCount} รายการ และนำเข้าใหม่ ${newCount} รายการสำเร็จ`;
        } else if (updatedCount > 0) {
          message = `อัพเดทออเดอร์สำเร็จ ${updatedCount} รายการ`;
        } else if (newCount > 0) {
          message = `นำเข้าออเดอร์ใหม่สำเร็จ ${newCount} รายการ`;
        } else {
          message = `ไม่มีการเปลี่ยนแปลงข้อมูล`;
        }

        if (skippedCount > 0) {
          message += ` (ข้าม ${skippedCount} รายการ)`;
        }

        alert(message);
        setShowDuplicatesModal(false);
        handleClose();
        // Refresh data โดยไม่เรียก API ซ้ำ
        if (onRefresh) {
          onRefresh();
        }
      }
    } catch (error: any) {
      console.error('Confirm error:', error);
      alert(`เกิดข้อผิดพลาด: ${error.message || 'ไม่สามารถยืนยันได้'}`);
    }
  };

  const handleClose = () => {
    if (!isImporting) {
      setSelectedType('route');
      setSelectedFile(null);
      setSelectedWarehouse('');
      setSelectedDate('');
      setIsImporting(false);
      onClose();
    }
  };

  const getTypeInfo = (type: ImportType) => {
    switch (type) {
      case 'route':
        return {
          title: 'จัดเส้นทาง',
          description: 'นำเข้าออเดอร์สำหรับการจัดเส้นทางจัดส่ง',
          columns: 'วันที่, คลัง, เครดิต/เงินสด, เลขที่ใบสั่งส่ง, รหัสลูกค้า, ชื่อร้านค้า, จังหวัด, รหัสสินค้า, ชื่อสินค้า, จำนวน, น้ำหนัก, หมายเหตุ',
          icon: Route,
          color: 'blue'
        };
      case 'piece':
        return {
          title: 'ส่งรายชิ้น',
          description: 'นำเข้าออเดอร์แบบส่งรายชิ้น',
          columns: 'วันที่-ลำดับ, เครดิต/เงินสด, เลขที่ใบขาย, รหัสลูกค้า, ชื่อร้านค้า, จังหวัด, รหัสสินค้า, ชื่อสินค้า, จำนวน, น้ำหนัก, โทรศัพท์, หมายเหตุ',
          icon: Package,
          color: 'green'
        };
      case 'special':
        return {
          title: 'พิเศษ',
          description: 'นำเข้าออเดอร์ประเภทพิเศษ',
          columns: 'คอลัมน์ตามความต้องการพิเศษ',
          icon: Star,
          color: 'purple'
        };
      default:
        return null;
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title="นำเข้าออเดอร์"
        size="md"
      >
        <div className="space-y-6">
          {/* เลือกประเภทการนำเข้า */}
          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              ประเภทการนำเข้า <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedType || ''}
              onChange={(e) => setSelectedType(e.target.value as ImportType)}
              className="w-full px-3 py-2 border border-thai-gray-300 rounded-lg text-sm font-thai
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="route">จัดเส้นทาง</option>
              <option value="piece">ส่งรายชิ้น (ด่วนพิเศษ)</option>
              <option value="special">ออเดอร์พิเศษ (สินค้าของแถม)</option>
            </select>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-center space-x-3 mb-2">
              {selectedType && React.createElement(getTypeInfo(selectedType)!.icon, {
                className: 'w-5 h-5 text-blue-600'
              })}
              <h4 className="font-semibold text-blue-900 font-thai">
                {getTypeInfo(selectedType)?.title}
              </h4>
            </div>
            <p className="text-sm text-blue-800 font-thai">
              {getTypeInfo(selectedType)?.description}
            </p>
          </div>

          {/* เลือกคลัง */}
          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              <Warehouse className="w-4 h-4 inline mr-1" />
              เลือกคลัง <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              className="w-full px-3 py-2 border border-thai-gray-300 rounded-lg text-sm font-thai
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
              disabled={warehousesLoading}
            >
              <option value="">-- {warehousesLoading ? 'กำลังโหลด...' : 'เลือกคลัง'} --</option>
              {warehouses.map(warehouse => (
                <option key={warehouse.warehouse_id} value={warehouse.warehouse_id}>
                  {warehouse.warehouse_name}
                </option>
              ))}
            </select>
            {warehousesError && <p className="text-xs text-red-500 font-thai mt-1">{warehousesError}</p>}
            <p className="text-xs text-thai-gray-500 font-thai mt-1">
              ข้อมูลคลังจากไฟล์จะถูกแทนที่ด้วยคลังที่เลือก
            </p>
          </div>

          {/* เลือกวันที่แผน */}
          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              วันที่แผนจากออเดอร์ <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 border border-thai-gray-300 rounded-lg text-sm font-thai
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
            <p className="text-xs text-thai-gray-500 font-thai mt-1">
              เลือกวันที่แผนที่ต้องการจากออเดอร์ที่นำเข้า
            </p>
          </div>

          {/* อัพโหลดไฟล์ */}
          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              <FileSpreadsheet className="w-4 h-4 inline mr-1" />
              เลือกไฟล์ Excel หรือ CSV (.xlsx, .xls, .csv) <span className="text-red-500">*</span>
            </label>
            <div className={`border-2 border-dashed rounded-lg p-4 text-center transition-all ${
              selectedFile 
                ? 'border-green-500 bg-green-50' 
                : 'border-thai-gray-300 hover:border-blue-500'
            }`}>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center space-y-1.5"
              >
                {selectedFile ? (
                  <>
                    <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-sm font-semibold font-thai text-green-700">
                      ✓ เลือกไฟล์แล้ว
                    </span>
                    <span className="text-sm font-thai text-green-600 break-all px-2">
                      {selectedFile.name}
                    </span>
                    <span className="text-xs font-thai text-green-600">
                      ({(selectedFile.size / 1024).toFixed(2)} KB)
                    </span>
                    <span className="text-xs font-thai text-thai-gray-500">
                      คลิกเพื่อเปลี่ยนไฟล์
                    </span>
                  </>
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-thai-gray-400" />
                    <span className="text-sm font-thai text-thai-gray-600">
                      คลิกเพื่อเลือกไฟล์หรือลากไฟล์มาวางที่นี่
                    </span>
                    <span className="text-xs font-thai text-thai-gray-500">
                      รองรับไฟล์ .xlsx, .xls, .csv (ขนาดไม่เกิน 10MB)
                    </span>
                  </>
                )}
              </label>
            </div>
          </div>

          {/* คอลัมน์ที่ต้องมี */}
          <div className="bg-thai-gray-50 p-4 rounded-lg">
            <h4 className="text-sm font-semibold text-thai-gray-700 font-thai mb-2">
              📋 คอลัมน์ที่ต้องมีในไฟล์:
            </h4>
            <p className="text-xs text-thai-gray-600 font-thai">
              {getTypeInfo(selectedType)?.columns}
            </p>
          </div>

          {/* ปุ่มดำเนินการ */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-thai-gray-200">
            <Button
              variant="secondary"
              onClick={handleClose}
            >
              ยกเลิก
            </Button>
            <Button
              variant="primary"
              onClick={handleImport}
              disabled={!selectedFile || !selectedWarehouse || !selectedDate || isImporting}
              className="bg-blue-600 hover:bg-blue-700 text-white font-thai"
            >
              {isImporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  กำลังนำเข้า...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  นำเข้าออเดอร์
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Loading Overlay */}
      {isImporting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-8 flex flex-col items-center space-y-4 shadow-xl">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-thai-gray-900 font-thai mb-2">
                กำลังนำเข้าข้อมูล
              </h3>
              <p className="text-sm text-thai-gray-600 font-thai">
                กรุณารอสักครู่ ระบบกำลังประมวลผลไฟล์ของคุณ...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Duplicates Resolution Modal */}
      <DuplicateOrdersModal
        isOpen={showDuplicatesModal}
        onClose={() => setShowDuplicatesModal(false)}
        conflicts={conflicts}
        duplicateCount={duplicateCount}
        newOrdersCount={newOrdersCount}
        onConfirm={handleConfirmDuplicates}
      />
    </>
  );
};

export default ImportOrderModal;
