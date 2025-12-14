'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';
import Badge from '@/components/ui/Badge';
import EmployeeSelectionModal from '@/components/mobile/EmployeeSelectionModal';

interface PicklistItem {
  id: number;
  sku_id: string;
  sku_name: string;
  uom: string;
  order_no: string;
  order_id: number;
  stop_id: number;
  quantity_to_pick: number;
  quantity_picked: number;
  source_location_id: string;
  status: 'pending' | 'picked' | 'shortage' | 'substituted';
  shop_name?: string;
  master_sku?: {
    sku_name: string;
    barcode: string;
    qty_per_pack: number;
  };
  master_location?: {
    location_code: string;
    location_name: string;
  };
}

interface Picklist {
  id: number;
  picklist_code: string;
  status: string;
  total_lines: number;
  total_quantity: number;
  loading_door_number?: string;
  trip?: {
    trip_code: string;
    vehicle?: {
      plate_number: string;
    };
  };
  plan?: {
    plan_code: string;
    plan_name: string;
  };
  picklist_items: PicklistItem[];
}

export default function MobilePickDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [picklist, setPicklist] = useState<Picklist | null>(null);
  const [scanning, setScanning] = useState(false);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [pendingShopItems, setPendingShopItems] = useState<PicklistItem[]>([]);

  useEffect(() => {
    if (id) {
      fetchPicklist();
    }
  }, [id]);

  const fetchPicklist = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/mobile/pick/tasks/${id}`);
      const data = await response.json();

      if (response.ok) {
        setPicklist(data);
      }
    } catch (error) {
      // Silently handle error
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmShop = async (shopItems: PicklistItem[], shopName: string) => {
    const unpickedItems = shopItems.filter(item => item.status !== 'picked');
    
    if (unpickedItems.length === 0) {
      alert('รายการทั้งหมดหยิบแล้ว');
      return;
    }

    // ตรวจสอบว่าหลังจากหยิบร้านนี้แล้ว จะเหลือร้านที่ยังไม่หยิบหรือไม่
    const allItems = picklist?.picklist_items || [];
    const itemsAfterPicking = allItems.map(item => {
      // ถ้าเป็น item ในร้านนี้ ให้ถือว่าหยิบแล้ว
      const itemShopName = item.shop_name || item.order_no || 'ไม่ระบุร้าน';
      if (itemShopName === shopName) {
        return { ...item, status: 'picked' as const };
      }
      return item;
    });

    // นับว่ายังมีร้านที่ยังไม่หยิบครบหรือไม่
    const shopsAfter = itemsAfterPicking.reduce((acc, item) => {
      const itemShopName = item.shop_name || item.order_no || 'ไม่ระบุร้าน';
      if (!acc[itemShopName]) {
        acc[itemShopName] = { total: 0, picked: 0 };
      }
      acc[itemShopName].total++;
      if (item.status === 'picked') {
        acc[itemShopName].picked++;
      }
      return acc;
    }, {} as Record<string, { total: number; picked: number }>);

    const hasUnpickedShops = Object.values(shopsAfter).some(
      shop => shop.picked < shop.total
    );

    // ถ้าไม่มีร้านที่ยังไม่หยิบแล้ว = ร้านนี้เป็นร้านสุดท้าย
    const isLastShop = !hasUnpickedShops;

    console.log('🔍 Shop check:', { shopName, isLastShop, hasUnpickedShops, shopsAfter });

    // ถ้าเป็นร้านสุดท้าย แสดง modal เลือกพนักงาน
    if (isLastShop) {
      setPendingShopItems(unpickedItems);
      setShowEmployeeModal(true);
    } else {
      // ร้านอื่นๆ ยืนยันตามปกติ
      if (!confirm(`ยืนยันการหยิบสินค้าทั้งหมด ${unpickedItems.length} รายการ?`)) {
        return;
      }
      await processPickItems(unpickedItems, [], []);
    }
  };

  const handleEmployeeConfirm = async (checkerIds: string[], pickerIds: string[]) => {
    setShowEmployeeModal(false);
    await processPickItems(pendingShopItems, checkerIds, pickerIds);
  };

  const processPickItems = async (
    items: PicklistItem[], 
    checkerIds: string[], 
    pickerIds: string[]
  ) => {
    try {
      setScanning(true);

      // ✅ เรียก API แบบ parallel เพื่อความเร็ว
      const promises = items.map(item => 
        fetch('/api/mobile/pick/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            picklist_id: picklist?.id,
            item_id: item.id,
            quantity_picked: item.quantity_to_pick,
            scanned_code: picklist?.picklist_code,
            checker_ids: checkerIds.length > 0 ? checkerIds : undefined,
            picker_ids: pickerIds.length > 0 ? pickerIds : undefined
          })
        }).then(async (response) => {
          const result = await response.json();
          if (!response.ok) {
            throw new Error(result.error || 'เกิดข้อผิดพลาด');
          }
          return result;
        })
      );

      // รอให้ทุก request เสร็จ
      await Promise.all(promises);
      
      alert('บันทึกการหยิบสำเร็จ');
      fetchPicklist();
    } catch (error: any) {
      console.error('Error picking items:', error);
      alert(`เกิดข้อผิดพลาด: ${error.message || 'ไม่สามารถบันทึกได้'}`);
    } finally {
      setScanning(false);
      setPendingShopItems([]);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
      </div>
    );
  }

  if (!picklist) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <p className="text-gray-700 font-thai text-lg">ไม่พบข้อมูลใบหยิบ</p>
        <button
          onClick={() => router.push('/mobile/pick')}
          className="mt-4 px-4 py-2 bg-sky-500 text-white rounded-lg font-thai"
        >
          กลับ
        </button>
      </div>
    );
  }

  const pickedCount = picklist.picklist_items.filter(i => i.status === 'picked').length;
  const totalCount = picklist.picklist_items.length;
  const progress = totalCount > 0 ? (pickedCount / totalCount) * 100 : 0;

  // Group items by shop
  const itemsByShop = picklist.picklist_items.reduce((acc, item) => {
    const shopKey = item.shop_name || item.order_no || 'ไม่ระบุร้าน';
    if (!acc[shopKey]) {
      acc[shopKey] = [];
    }
    acc[shopKey].push(item);
    return acc;
  }, {} as Record<string, PicklistItem[]>);

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
            <h1 className="text-lg font-bold font-thai">{picklist.picklist_code}</h1>
            {picklist.plan && (
              <p className="text-xs opacity-90 font-thai">{picklist.plan.plan_code}</p>
            )}
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

      {/* Items by Shop */}
      <div className="p-3 space-y-4">
        {Object.entries(itemsByShop).map(([shopName, items]) => {
          const shopPicked = items.filter(i => i.status === 'picked').length;
          const shopTotal = items.length;
          const allPicked = shopPicked === shopTotal;

          return (
            <div key={shopName} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              {/* Shop Header */}
              <div className={`p-3 ${allPicked ? 'bg-green-50' : 'bg-gray-50'} border-b border-gray-200`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-gray-900 font-thai text-sm">{shopName}</h3>
                  {allPicked ? (
                    <Badge variant="success" size="sm">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      เสร็จสิ้น
                    </Badge>
                  ) : (
                    <Badge variant="default" size="sm">
                      {shopPicked}/{shopTotal}
                    </Badge>
                  )}
                </div>
                {!allPicked && (
                  <button
                    onClick={() => handleConfirmShop(items, shopName)}
                    disabled={scanning}
                    className="w-full py-2 bg-sky-500 text-white rounded-lg font-thai text-sm font-medium hover:bg-sky-600 active:scale-98 transition-all disabled:opacity-50"
                  >
                    ยืนยันการหยิบทั้งหมด
                  </button>
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
                      <tr
                        key={item.id}
                        className={`border-b border-gray-100 ${
                          item.status === 'picked' ? 'bg-green-50/50' : ''
                        }`}
                      >
                        <td className="px-2 py-2">
                          <div className="font-thai text-gray-900 font-medium">
                            {item.master_sku?.sku_name || item.sku_name}
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

      {/* Employee Selection Modal */}
      <EmployeeSelectionModal
        isOpen={showEmployeeModal}
        onClose={() => {
          setShowEmployeeModal(false);
          setPendingShopItems([]);
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
