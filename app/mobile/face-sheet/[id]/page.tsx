'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Loader2,
  Package
} from 'lucide-react';
import Badge from '@/components/ui/Badge';
import EmployeeSelectionModal from '@/components/mobile/EmployeeSelectionModal';

interface FaceSheetItem {
  id: number;
  sku_id: string;
  sku_name: string;
  uom: string;
  quantity_to_pick: number;
  quantity_picked: number;
  source_location_id: string;
  status: 'pending' | 'picked' | 'shortage' | 'substituted';
  package_number?: number;
  barcode_id?: string;
}

interface FaceSheet {
  id: number;
  face_sheet_no: string;
  status: string;
  total_packages: number;
  total_items: number;
  items: FaceSheetItem[];
}

export default function MobileFaceSheetPickPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [faceSheet, setFaceSheet] = useState<FaceSheet | null>(null);
  const [scanning, setScanning] = useState(false);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [pendingItems, setPendingItems] = useState<FaceSheetItem[]>([]);

  useEffect(() => {
    if (id) {
      fetchFaceSheet();
    }
  }, [id]);

  const fetchFaceSheet = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/mobile/face-sheet/tasks/${id}`);
      const data = await response.json();

      if (response.ok) {
        setFaceSheet(data);
      }
    } catch (error) {
      console.error('Error fetching face sheet:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAll = async () => {
    if (!faceSheet) return;

    const unpickedItems = faceSheet.items.filter(item => item.status !== 'picked');
    
    if (unpickedItems.length === 0) {
      alert('รายการทั้งหมดหยิบแล้ว');
      return;
    }

    // แสดง modal เลือกพนักงาน
    setPendingItems(unpickedItems);
    setShowEmployeeModal(true);
  };

  const handleEmployeeConfirm = async (checkerIds: string[], pickerIds: string[]) => {
    setShowEmployeeModal(false);
    await processPickItems(pendingItems, checkerIds, pickerIds);
  };

  const processPickItems = async (
    items: FaceSheetItem[], 
    checkerIds: string[], 
    pickerIds: string[]
  ) => {
    try {
      setScanning(true);
      let hasError = false;

      for (const item of items) {
        const response = await fetch('/api/mobile/face-sheet/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            face_sheet_id: faceSheet?.id,
            item_id: item.id,
            quantity_picked: item.quantity_to_pick,
            scanned_code: faceSheet?.face_sheet_no,
            checker_ids: checkerIds.length > 0 ? checkerIds : undefined,
            picker_ids: pickerIds.length > 0 ? pickerIds : undefined
          })
        });

        const result = await response.json();

        if (!response.ok) {
          alert(`เกิดข้อผิดพลาด: ${result.error}`);
          hasError = true;
          break;
        }
      }

      if (!hasError) {
        alert('บันทึกการหยิบสำเร็จ');
        router.push('/mobile/pick');
      }
    } catch (error) {
      console.error('Error picking items:', error);
      alert('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setScanning(false);
      setPendingItems([]);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
      </div>
    );
  }

  if (!faceSheet) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <p className="text-gray-700 font-thai text-lg">ไม่พบข้อมูลใบปะหน้า</p>
        <button
          onClick={() => router.push('/mobile/pick')}
          className="mt-4 px-4 py-2 bg-sky-500 text-white rounded-lg font-thai"
        >
          กลับ
        </button>
      </div>
    );
  }

  const pickedCount = faceSheet.items.filter(i => i.status === 'picked').length;
  const totalCount = faceSheet.items.length;
  const progress = totalCount > 0 ? (pickedCount / totalCount) * 100 : 0;
  const allPicked = pickedCount === totalCount;

  // Group items by package
  const itemsByPackage = faceSheet.items.reduce((acc, item) => {
    const packageKey = item.package_number || 0;
    if (!acc[packageKey]) {
      acc[packageKey] = [];
    }
    acc[packageKey].push(item);
    return acc;
  }, {} as Record<number, FaceSheetItem[]>);

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <div className="bg-gradient-to-br from-sky-400 to-sky-500 text-white p-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center space-x-3 mb-3">
          <button
            onClick={() => router.push('/mobile/pick')}
            className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold font-thai">{faceSheet.face_sheet_no}</h1>
            <p className="text-xs opacity-90 font-thai">ใบปะหน้าสินค้า</p>
          </div>
        </div>

        {/* Progress */}
        <div className="bg-white/20 rounded-full h-2 mb-2">
          <div
            className="bg-white rounded-full h-2 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-center font-thai">
          หยิบแล้ว {pickedCount} / {totalCount} รายการ ({progress.toFixed(0)}%)
        </p>
      </div>

      {/* Summary */}
      <div className="p-3 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="text-sm font-thai text-gray-600">
            จำนวนแพ็คเกจ: <span className="font-bold text-gray-900">{faceSheet.total_packages}</span>
          </div>
          <div className="text-sm font-thai text-gray-600">
            จำนวนรายการ: <span className="font-bold text-gray-900">{faceSheet.total_items}</span>
          </div>
        </div>
      </div>

      {/* Items by Package */}
      <div className="p-3 space-y-4">
        {Object.entries(itemsByPackage).map(([packageNum, items]) => {
          const packagePicked = items.filter(i => i.status === 'picked').length;
          const packageTotal = items.length;
          const packageAllPicked = packagePicked === packageTotal;

          return (
            <div key={packageNum} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              {/* Package Header */}
              <div className={`p-3 ${packageAllPicked ? 'bg-green-50' : 'bg-gray-50'} border-b border-gray-200`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <Package className="w-4 h-4 text-gray-600" />
                    <h3 className="font-bold text-gray-900 font-thai text-sm">
                      แพ็คเกจที่ {packageNum}
                    </h3>
                  </div>
                  {packageAllPicked ? (
                    <Badge variant="success" size="sm">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      เสร็จสิ้น
                    </Badge>
                  ) : (
                    <Badge variant="default" size="sm">
                      {packagePicked}/{packageTotal}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-100 border-b border-gray-200">
                    <tr>
                      <th className="px-2 py-2 text-left font-thai text-gray-700">สินค้า</th>
                      <th className="px-2 py-2 text-center font-thai text-gray-700">จำนวน</th>
                      <th className="px-2 py-2 text-center font-thai text-gray-700">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr
                        key={item.id}
                        className={`border-b border-gray-100 ${
                          item.status === 'picked' ? 'bg-green-50/50' : ''
                        }`}
                      >
                        <td className="px-2 py-2">
                          <div className="font-thai text-gray-900 font-medium">
                            {item.sku_name}
                          </div>
                          <div className="text-gray-500 mt-0.5">
                            {item.sku_id}
                          </div>
                        </td>
                        <td className="px-2 py-2 text-center font-thai text-gray-700">
                          {item.quantity_to_pick} {item.uom}
                        </td>
                        <td className="px-2 py-2 text-center">
                          {item.status === 'picked' ? (
                            <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                          ) : (
                            <div className="w-4 h-4 border-2 border-gray-300 rounded mx-auto" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirm Button */}
      {!allPicked && (
        <div className="fixed bottom-16 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-lg z-40">
          <button
            onClick={handleConfirmAll}
            disabled={scanning}
            className="w-full py-3 bg-sky-500 text-white rounded-lg font-thai text-base font-medium hover:bg-sky-600 active:scale-98 transition-all disabled:opacity-50"
          >
            ยืนยันการหยิบทั้งหมด
          </button>
        </div>
      )}

      {/* Employee Selection Modal */}
      <EmployeeSelectionModal
        isOpen={showEmployeeModal}
        onClose={() => {
          setShowEmployeeModal(false);
          setPendingItems([]);
        }}
        onConfirm={handleEmployeeConfirm}
        title="เลือกพนักงาน"
      />

      {/* Scanning Overlay */}
      {scanning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 text-center">
            <Loader2 className="w-12 h-12 animate-spin text-sky-500 mx-auto mb-3" />
            <p className="text-gray-700 font-thai">กำลังบันทึก...</p>
          </div>
        </div>
      )}
    </div>
  );
}
