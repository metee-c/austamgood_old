'use client';

import { useState, useEffect } from 'react';
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
        <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
      </div>
    );
  }

  if (!faceSheet) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-3">
        <AlertCircle className="w-12 h-12 text-red-500 mb-3" />
        <p className="text-gray-700 font-thai text-sm">ไม่พบข้อมูลใบปะหน้า</p>
        <button
          onClick={() => router.push('/mobile/pick')}
          className="mt-3 px-3 py-1.5 bg-sky-500 text-white rounded-lg font-thai text-sm"
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
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Compact Header */}
      <div className="bg-gradient-to-br from-sky-400 to-sky-500 text-white p-2.5 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => router.push('/mobile/pick')}
            className="p-1 bg-white/20 rounded hover:bg-white/30 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold font-thai truncate">{faceSheet.face_sheet_no}</h1>
            <p className="text-[10px] opacity-90 font-thai">ใบปะหน้าสินค้า</p>
          </div>
        </div>

        {/* Progress */}
        <div className="bg-white/20 rounded-full h-1.5 mb-1">
          <div
            className="bg-white rounded-full h-1.5 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-[10px] text-center font-thai">
          หยิบแล้ว {pickedCount}/{totalCount} ({progress.toFixed(0)}%)
        </p>
      </div>

      {/* Summary - Compact */}
      <div className="p-2 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between text-xs">
          <span className="font-thai text-gray-600">
            แพ็คเกจ: <span className="font-bold text-gray-900">{faceSheet.total_packages}</span>
          </span>
          <span className="font-thai text-gray-600">
            รายการ: <span className="font-bold text-gray-900">{faceSheet.total_items}</span>
          </span>
        </div>
      </div>

      {/* Items by Package - Compact with scroll */}
      <div className="p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-180px)]">
        {Object.entries(itemsByPackage).map(([packageNum, items]) => {
          const packagePicked = items.filter(i => i.status === 'picked').length;
          const packageTotal = items.length;
          const packageAllPicked = packagePicked === packageTotal;

          return (
            <div key={packageNum} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              {/* Package Header - Compact */}
              <div className={`p-2 ${packageAllPicked ? 'bg-green-50' : 'bg-gray-50'} border-b border-gray-200`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-gray-600" />
                    <h3 className="font-bold text-gray-900 font-thai text-xs">
                      แพ็คเกจ {packageNum}
                    </h3>
                  </div>
                  {packageAllPicked ? (
                    <Badge variant="success" size="sm">
                      <CheckCircle className="w-2.5 h-2.5 mr-0.5" />
                      เสร็จ
                    </Badge>
                  ) : (
                    <Badge variant="default" size="sm">
                      {packagePicked}/{packageTotal}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Items Table - Compact */}
              <div className="overflow-x-auto max-h-40 overflow-y-auto">
                <table className="w-full text-[10px]">
                  <thead className="bg-gray-100 border-b border-gray-200 sticky top-0">
                    <tr>
                      <th className="px-1.5 py-1 text-left font-thai text-gray-700">สินค้า</th>
                      <th className="px-1.5 py-1 text-center font-thai text-gray-700 w-14">จำนวน</th>
                      <th className="px-1.5 py-1 text-center font-thai text-gray-700 w-8">✓</th>
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
                        <td className="px-1.5 py-1">
                          <div className="font-thai text-gray-900 font-medium truncate max-w-[140px]">
                            {item.sku_name}
                          </div>
                          <div className="text-gray-500 text-[9px]">
                            {item.sku_id}
                          </div>
                        </td>
                        <td className="px-1.5 py-1 text-center font-thai text-gray-700">
                          {item.quantity_to_pick}
                        </td>
                        <td className="px-1.5 py-1 text-center">
                          {item.status === 'picked' ? (
                            <CheckCircle className="w-3.5 h-3.5 text-green-500 mx-auto" />
                          ) : (
                            <div className="w-3 h-3 border border-gray-300 rounded mx-auto" />
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

      {/* Confirm Button - Compact */}
      {!allPicked && (
        <div className="fixed bottom-14 left-0 right-0 p-2 bg-white border-t border-gray-200 shadow-lg z-40">
          <button
            onClick={handleConfirmAll}
            disabled={scanning}
            className="w-full py-2 bg-sky-500 text-white rounded-lg font-thai text-sm font-medium hover:bg-sky-600 active:scale-98 transition-all disabled:opacity-50"
          >
            ยืนยันหยิบทั้งหมด
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

      {/* Scanning Overlay - Compact */}
      {scanning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-sky-500 mx-auto mb-2" />
            <p className="text-gray-700 font-thai text-sm">กำลังบันทึก...</p>
          </div>
        </div>
      )}
    </div>
  );
}
