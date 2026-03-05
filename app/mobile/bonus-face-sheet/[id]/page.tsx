'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Package,
  MapPin,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Gift,
  QrCode
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import EmployeeSelectionModal from '@/components/mobile/EmployeeSelectionModal';

interface BonusFaceSheetItem {
  id: number;
  sku_id: string;
  product_name: string;
  quantity_to_pick: number;
  quantity_picked: number;
  status: string;
  package_number?: string;
  barcode_id?: string;
  order_id?: number;
  order_no?: string;
  shop_name?: string;
}

interface BonusFaceSheetData {
  id: number;
  face_sheet_no: string;
  status: string;
  warehouse_id: string;
  created_date: string;
  total_packages: number;
  total_items: number;
  total_orders: number;
  checker_employee_ids: number[];
  picker_employee_ids: number[];
  picking_started_at?: string;
  picking_completed_at?: string;
  items: BonusFaceSheetItem[];
}

const BonusFaceSheetPickPage = () => {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [bonusFaceSheet, setBonusFaceSheet] = useState<BonusFaceSheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scanningItemId, setScanningItemId] = useState<number | null>(null);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [selectedEmployees, setSelectedEmployees] = useState<{
    checkers: number[];
    pickers: number[];
  }>({ checkers: [], pickers: [] });
  const [confirmingAll, setConfirmingAll] = useState(false);

  useEffect(() => {
    fetchBonusFaceSheetData();
  }, [id]);

  const fetchBonusFaceSheetData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/mobile/bonus-face-sheet/tasks/${id}`);
      const result = await response.json();

      if (!response.ok || result.error) {
        setError(result.error || 'ไม่สามารถดึงข้อมูลได้');
        return;
      }

      setBonusFaceSheet(result.data);
      setSelectedEmployees({
        checkers: result.data.checker_employee_ids || [],
        pickers: result.data.picker_employee_ids || []
      });
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  const handleItemScan = async (item: BonusFaceSheetItem) => {
    if (item.status === 'picked') {
      alert('รายการนี้หยิบเสร็จแล้ว');
      return;
    }

    setScanningItemId(item.id);

    try {
      const response = await fetch('/api/mobile/bonus-face-sheet/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bonus_face_sheet_id: bonusFaceSheet?.id,
          item_id: item.id,
          quantity_picked: item.quantity_to_pick,
          scanned_code: bonusFaceSheet?.face_sheet_no,
          checker_ids: selectedEmployees.checkers,
          picker_ids: selectedEmployees.pickers
        })
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        alert(result.error || 'เกิดข้อผิดพลาดในการสแกน');
        return;
      }

      await fetchBonusFaceSheetData();

      if (result.bonus_face_sheet_completed) {
        alert('หยิบสินค้าครบทุกรายการแล้ว!');
      }
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาดในการสแกน');
    } finally {
      setScanningItemId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'picked':
        return <Badge variant="success" size="sm">หยิบแล้ว</Badge>;
      case 'picking':
        return <Badge variant="warning" size="sm">กำลังหยิบ</Badge>;
      default:
        return <Badge variant="default" size="sm">รอหยิบ</Badge>;
    }
  };

  const getItemStatusIcon = (status: string) => {
    switch (status) {
      case 'picked':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'picking':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      default:
        return <Package className="w-5 h-5 text-gray-400" />;
    }
  };

  const completedItems = bonusFaceSheet?.items.filter(item => item.status === 'picked').length || 0;
  const totalItems = bonusFaceSheet?.items.length || 0;
  const progress = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;
  const allPicked = completedItems === totalItems;

  // Group items by package
  const itemsByPackage = bonusFaceSheet?.items.reduce((acc, item) => {
    const packageKey = item.package_number || 'unknown';
    if (!acc[packageKey]) {
      acc[packageKey] = [];
    }
    acc[packageKey].push(item);
    return acc;
  }, {} as Record<string, BonusFaceSheetItem[]>) || {};

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-2" />
          <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  if (error || !bonusFaceSheet) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <p className="text-red-600 mb-4">{error || 'ไม่พบข้อมูล'}</p>
          <Button onClick={() => router.push('/mobile/pick')} variant="secondary">
            <ArrowLeft className="w-4 h-4 mr-2" />
            กลับ
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
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
            <h1 className="text-lg font-bold font-thai">{bonusFaceSheet.face_sheet_no}</h1>
            <p className="text-xs opacity-90 font-thai flex items-center gap-1">
              <Gift className="w-3 h-3" />
              ใบปะหน้าสินค้าของแถม
            </p>
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
          หยิบแล้ว {completedItems} / {totalItems} รายการ ({progress.toFixed(0)}%)
        </p>
      </div>

      {/* Summary */}
      <div className="p-3 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between text-sm font-thai text-gray-600">
          <div>
            จำนวนแพ็ค: <span className="font-bold text-gray-900">{bonusFaceSheet.total_packages}</span>
          </div>
          <div>
            จำนวนรายการ: <span className="font-bold text-gray-900">{bonusFaceSheet.total_items}</span>
          </div>
          <div>
            จำนวนออเดอร์: <span className="font-bold text-gray-900">{bonusFaceSheet.total_orders}</span>
          </div>
        </div>
      </div>

      {/* Items by Package */}
      <div className="p-3 space-y-4">
        {Object.entries(itemsByPackage).map(([packageNum, items]) => {
          const packagePicked = items.filter(i => i.status === 'picked').length;
          const packageTotal = items.length;
          const packageAllPicked = packagePicked === packageTotal;
          const firstItem = items[0];

          return (
            <div key={packageNum} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              {/* Package Header */}
              <div className={`p-3 ${packageAllPicked ? 'bg-green-50' : 'bg-sky-50'} border-b border-gray-200`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <Package className="w-4 h-4 text-gray-600" />
                    <h3 className="font-bold text-gray-900 font-thai text-sm">
                      แพ็คที่ {packageNum}
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
                {firstItem?.order_no && (
                  <div className="text-xs text-gray-600">
                    <span className="font-semibold">ออเดอร์:</span> {firstItem.order_no}
                    {firstItem.shop_name && <span className="ml-2">• {firstItem.shop_name}</span>}
                  </div>
                )}
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
                      <tr key={item.id} className={`border-b border-gray-100 ${item.status === 'picked' ? 'bg-green-50' : ''}`}>
                        <td className="px-2 py-2">
                          <div className="font-semibold text-gray-900">{item.product_name}</div>
                          <div className="text-gray-500 font-mono">{item.sku_id}</div>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <span className="font-bold text-sky-600">
                            {item.quantity_to_pick}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-center">
                          {item.status === 'picked' ? (
                            <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                          ) : (
                            <Clock className="w-4 h-4 text-gray-400 mx-auto" />
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

      {/* Confirm All Button */}
      {!allPicked && (
        <div className="p-3 bg-white border-t border-gray-200 mt-3">
          <Button
            onClick={() => {
              console.log('Button clicked, opening modal...');
              setShowEmployeeModal(true);
            }}
            variant="primary"
            className="w-full py-2.5 text-sm font-semibold"
            disabled={confirmingAll}
          >
            {confirmingAll ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                กำลังยืนยัน...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                ยืนยันหยิบทั้งหมด ({totalItems - completedItems} รายการ)
              </>
            )}
          </Button>
        </div>
      )}

      {/* Employee Selection Modal */}
      <EmployeeSelectionModal
        isOpen={showEmployeeModal}
        onClose={() => {
          console.log('Modal closing...');
          setShowEmployeeModal(false);
        }}
        onConfirm={async (checkers, pickers) => {
          setShowEmployeeModal(false);

          // ยืนยันการหยิบทั้งหมด
          if (confirm(`ยืนยันการหยิบสินค้าทั้งหมด ${totalItems - completedItems} รายการ?`)) {
            setConfirmingAll(true);
            try {
              const unpickedItems = bonusFaceSheet.items.filter(i => i.status !== 'picked');
              let successCount = 0;
              let errorMessages: string[] = [];

              for (const item of unpickedItems) {
                const response = await fetch('/api/mobile/bonus-face-sheet/scan', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    bonus_face_sheet_id: bonusFaceSheet.id,
                    item_id: item.id,
                    quantity_picked: item.quantity_to_pick,
                    scanned_code: bonusFaceSheet.face_sheet_no,
                    checker_ids: checkers,
                    picker_ids: pickers
                  })
                });

                const result = await response.json();

                if (!response.ok || result.error) {
                  errorMessages.push(`${item.sku_id}: ${result.error}`);
                  continue; // ไม่ break - ดำเนินการต่อกับ item อื่น
                }

                if (result.skipped) {
                  console.log(`⏭️ Skipped: ${item.sku_id} - ${result.message}`);
                }

                successCount++;
              }

              // Refresh data
              await fetchBonusFaceSheetData();

              if (errorMessages.length > 0) {
                alert(`หยิบสำเร็จ ${successCount}/${unpickedItems.length} รายการ\n\nข้อผิดพลาด:\n${errorMessages.join('\n')}`);
              } else {
                alert('ยืนยันการหยิบสินค้าเรียบร้อย!');
              }
            } catch (err: any) {
              await fetchBonusFaceSheetData();
              alert(`เกิดข้อผิดพลาด: ${err.message}`);
            } finally {
              setConfirmingAll(false);
            }
          }
        }}
        title="ยืนยันการหยิบสินค้า"
        mode="both"
      />

      {/* Loading Overlay */}
      {confirmingAll && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 shadow-2xl max-w-sm mx-4">
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="w-16 h-16 text-sky-500 animate-spin" />
              <div className="text-center">
                <h3 className="text-lg font-bold text-gray-900 font-thai mb-2">
                  กำลังบันทึกข้อมูล
                </h3>
                <p className="text-sm text-gray-600 font-thai">
                  กรุณารอสักครู่...
                </p>
              </div>
            </div>
          </div>
        </div>
      )}


    </div>
  );
};

export default BonusFaceSheetPickPage;
