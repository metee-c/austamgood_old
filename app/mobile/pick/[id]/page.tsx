'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';
import Badge from '@/components/ui/Badge';
import EmployeeSelectionModal from '@/components/mobile/EmployeeSelectionModal';
import PickProgressModal, { PickItemProgress } from '@/components/mobile/PickProgressModal';

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
  trip?: { trip_code: string; vehicle?: { plate_number: string } };
  plan?: { plan_code: string; plan_name: string };
  picklist_items: PicklistItem[];
}

export default function MobilePickDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [picklist, setPicklist] = useState<Picklist | null>(null);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [pendingShopItems, setPendingShopItems] = useState<PicklistItem[]>([]);
  const [pendingShopName, setPendingShopName] = useState('');
  
  // Progress Modal State
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressItems, setProgressItems] = useState<PickItemProgress[]>([]);
  const [currentProgressItem, setCurrentProgressItem] = useState<PickItemProgress | undefined>();
  const [totalProgressItems, setTotalProgressItems] = useState(0);
  const [completedProgressItems, setCompletedProgressItems] = useState(0);
  const [hasProgressError, setHasProgressError] = useState(false);
  const [errorProgressItem, setErrorProgressItem] = useState<PickItemProgress | undefined>();
  const [pendingCheckerIds, setPendingCheckerIds] = useState<string[]>([]);
  const [pendingPickerIds, setPendingPickerIds] = useState<string[]>([]);

  useEffect(() => {
    if (id) fetchPicklist();
  }, [id]);

  const fetchPicklist = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/mobile/pick/tasks/${id}`);
      const data = await response.json();
      if (response.ok) setPicklist(data);
    } catch (error) {
      console.error('Error fetching picklist:', error);
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

    const allItems = picklist?.picklist_items || [];
    const itemsAfterPicking = allItems.map(item => {
      const itemShopName = item.shop_name || item.order_no || 'ไม่ระบุร้าน';
      if (itemShopName === shopName) return { ...item, status: 'picked' as const };
      return item;
    });

    const shopsAfter = itemsAfterPicking.reduce((acc, item) => {
      const itemShopName = item.shop_name || item.order_no || 'ไม่ระบุร้าน';
      if (!acc[itemShopName]) acc[itemShopName] = { total: 0, picked: 0 };
      acc[itemShopName].total++;
      if (item.status === 'picked') acc[itemShopName].picked++;
      return acc;
    }, {} as Record<string, { total: number; picked: number }>);

    const hasUnpickedShops = Object.values(shopsAfter).some(shop => shop.picked < shop.total);
    const isLastShop = !hasUnpickedShops;

    if (isLastShop) {
      setPendingShopItems(unpickedItems);
      setPendingShopName(shopName);
      setShowEmployeeModal(true);
    } else {
      setPendingShopItems(unpickedItems);
      setPendingShopName(shopName);
      setPendingCheckerIds([]);
      setPendingPickerIds([]);
      await processPickItemsSequential(unpickedItems, shopName, [], []);
    }
  };

  const handleEmployeeConfirm = async (checkerIds: string[], pickerIds: string[]) => {
    setShowEmployeeModal(false);
    setPendingCheckerIds(checkerIds);
    setPendingPickerIds(pickerIds);
    await processPickItemsSequential(pendingShopItems, pendingShopName, checkerIds, pickerIds);
  };

  const processPickItemsSequential = useCallback(async (
    items: PicklistItem[],
    shopName: string,
    checkerIds: string[],
    pickerIds: string[]
  ) => {
    // Reset progress state
    setProgressItems([]);
    setCurrentProgressItem(undefined);
    setTotalProgressItems(items.length);
    setCompletedProgressItems(0);
    setHasProgressError(false);
    setErrorProgressItem(undefined);
    setShowProgressModal(true);

    let successCount = 0;
    const processedItems: PickItemProgress[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const skuName = item.master_sku?.sku_name || item.sku_name || item.sku_id;
      const itemShopName = item.shop_name || item.order_no || shopName;

      // Create progress item
      const progressItem: PickItemProgress = {
        id: item.id,
        sku_id: item.sku_id,
        sku_name: skuName,
        shop_name: itemShopName,
        quantity: item.quantity_to_pick,
        status: 'checking',
        source_location: item.source_location_id || item.master_location?.location_code,
        dest_location: 'Dispatch'
      };

      setCurrentProgressItem(progressItem);

      try {
        // Step 1: Checking reservation
        progressItem.status = 'checking';
        progressItem.message = `กำลังตรวจสอบยอดจอง ${item.quantity_to_pick} ชิ้น...`;
        setCurrentProgressItem({ ...progressItem });
        await new Promise(r => setTimeout(r, 200)); // Small delay for UI

        // Step 2: Moving stock - Call API
        progressItem.status = 'moving';
        progressItem.message = 'กำลังย้ายสต็อก...';
        setCurrentProgressItem({ ...progressItem });

        const response = await fetch('/api/mobile/pick/scan', {
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
        });

        const result = await response.json();

        if (!response.ok) {
          // Check if already processed (skip, not error)
          if (result.already_processed) {
            progressItem.status = 'skipped';
            progressItem.message = 'รายการนี้หยิบไปแล้ว';
            successCount++;
          } else {
            // Real error - stop processing
            progressItem.status = 'error';
            progressItem.message = result.error || 'เกิดข้อผิดพลาด';
            progressItem.error_details = result.details || {
              message: result.error,
              order_no: item.order_no,
              shop_name: itemShopName,
              sku_id: item.sku_id,
              sku_name: skuName,
              quantity: item.quantity_to_pick
            };

            processedItems.push({ ...progressItem });
            setProgressItems([...processedItems]);
            setCompletedProgressItems(successCount);
            setHasProgressError(true);
            setErrorProgressItem(progressItem);
            setCurrentProgressItem(undefined);
            return; // Stop processing on error
          }
        } else {
          // Success
          progressItem.status = 'success';
          progressItem.reservation_found = item.quantity_to_pick;
          progressItem.message = `ย้ายสำเร็จ: ลดสต็อก ${item.source_location_id || 'บ้านหยิบ'} → เพิ่ม Dispatch`;
          successCount++;
        }

        processedItems.push({ ...progressItem });
        setProgressItems([...processedItems]);
        setCompletedProgressItems(successCount);
        setCurrentProgressItem(undefined);

      } catch (error: any) {
        progressItem.status = 'error';
        progressItem.message = error.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
        progressItem.error_details = { message: error.message };

        processedItems.push({ ...progressItem });
        setProgressItems([...processedItems]);
        setCompletedProgressItems(successCount);
        setHasProgressError(true);
        setErrorProgressItem(progressItem);
        setCurrentProgressItem(undefined);
        return; // Stop on error
      }
    }

    // All done successfully
    setCurrentProgressItem(undefined);
  }, [picklist]);

  const handleProgressClose = () => {
    setShowProgressModal(false);
    setProgressItems([]);
    setCurrentProgressItem(undefined);
    setHasProgressError(false);
    setErrorProgressItem(undefined);
    fetchPicklist(); // Refresh data
  };

  const handleProgressRetry = async () => {
    // Close modal and re-trigger the same shop
    setShowProgressModal(false);
    setHasProgressError(false);
    setErrorProgressItem(undefined);
    
    // Re-fetch to get latest status
    await fetchPicklist();
    
    // Find remaining unpicked items for the same shop
    if (picklist && pendingShopName) {
      const shopItems = picklist.picklist_items.filter(item => {
        const itemShopName = item.shop_name || item.order_no || 'ไม่ระบุร้าน';
        return itemShopName === pendingShopName;
      });
      const unpickedItems = shopItems.filter(item => item.status !== 'picked');
      
      if (unpickedItems.length > 0) {
        await processPickItemsSequential(unpickedItems, pendingShopName, pendingCheckerIds, pendingPickerIds);
      } else {
        alert('ไม่มีรายการที่ต้องหยิบเพิ่มเติม');
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
      </div>
    );
  }

  if (!picklist) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-3">
        <AlertCircle className="w-12 h-12 text-red-500 mb-3" />
        <p className="text-gray-700 font-thai text-sm">ไม่พบข้อมูลใบหยิบ</p>
        <button
          onClick={() => router.push('/mobile/pick')}
          className="mt-3 px-3 py-1.5 bg-sky-500 text-white rounded-lg font-thai text-sm"
        >
          กลับ
        </button>
      </div>
    );
  }

  const pickedCount = picklist.picklist_items.filter(i => i.status === 'picked').length;
  const totalCount = picklist.picklist_items.length;
  const progress = totalCount > 0 ? (pickedCount / totalCount) * 100 : 0;

  const itemsByShop = picklist.picklist_items.reduce((acc, item) => {
    const shopKey = item.shop_name || item.order_no || 'ไม่ระบุร้าน';
    if (!acc[shopKey]) acc[shopKey] = [];
    acc[shopKey].push(item);
    return acc;
  }, {} as Record<string, PicklistItem[]>);

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Header */}
      <div className="bg-gradient-to-br from-sky-400 to-sky-500 text-white p-2.5 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => router.push('/mobile/pick')}
            className="p-1 bg-white/20 rounded hover:bg-white/30 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold font-thai truncate">{picklist.picklist_code}</h1>
            {picklist.plan && (
              <p className="text-[10px] opacity-90 font-thai truncate">{picklist.plan.plan_code}</p>
            )}
          </div>
        </div>
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

      {/* Items by Shop */}
      <div className="p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-120px)]">
        {Object.entries(itemsByShop).map(([shopName, items]) => {
          const shopPicked = items.filter(i => i.status === 'picked').length;
          const shopTotal = items.length;
          const allPicked = shopPicked === shopTotal;

          return (
            <div key={shopName} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className={`p-2 ${allPicked ? 'bg-green-50' : 'bg-gray-50'} border-b border-gray-200`}>
                <div className="flex items-center justify-between mb-1.5">
                  <h3 className="font-bold text-gray-900 font-thai text-xs truncate flex-1 mr-2">{shopName}</h3>
                  {allPicked ? (
                    <Badge variant="success" size="sm">
                      <CheckCircle className="w-2.5 h-2.5 mr-0.5" />
                      เสร็จ
                    </Badge>
                  ) : (
                    <Badge variant="default" size="sm">{shopPicked}/{shopTotal}</Badge>
                  )}
                </div>
                {!allPicked && (
                  <button
                    onClick={() => handleConfirmShop(items, shopName)}
                    disabled={showProgressModal}
                    className="w-full py-1.5 bg-sky-500 text-white rounded font-thai text-xs font-medium hover:bg-sky-600 active:scale-98 transition-all disabled:opacity-50"
                  >
                    ยืนยันหยิบทั้งหมด
                  </button>
                )}
              </div>

              <div className="overflow-x-auto max-h-48 overflow-y-auto">
                <table className="w-full text-[10px]">
                  <thead className="bg-gray-100 border-b border-gray-200 sticky top-0">
                    <tr>
                      <th className="px-1.5 py-1 text-left font-thai text-gray-700">สินค้า</th>
                      <th className="px-1.5 py-1 text-center font-thai text-gray-700 w-16">จำนวน</th>
                      <th className="px-1.5 py-1 text-center font-thai text-gray-700 w-10">✓</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr
                        key={item.id}
                        className={`border-b border-gray-100 ${item.status === 'picked' ? 'bg-green-50/50' : ''}`}
                      >
                        <td className="px-1.5 py-1">
                          <div className="font-thai text-gray-900 font-medium truncate max-w-[140px]">
                            {item.master_sku?.sku_name || item.sku_name}
                          </div>
                          <div className="text-gray-500 text-[9px]">{item.sku_id}</div>
                        </td>
                        <td className="px-1.5 py-1 text-center font-thai text-gray-700">{item.quantity_to_pick}</td>
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

      {/* Modals */}
      <EmployeeSelectionModal
        isOpen={showEmployeeModal}
        onClose={() => { setShowEmployeeModal(false); setPendingShopItems([]); }}
        onConfirm={handleEmployeeConfirm}
        title="เลือกพนักงาน"
      />

      <PickProgressModal
        isOpen={showProgressModal}
        items={progressItems}
        totalItems={totalProgressItems}
        completedItems={completedProgressItems}
        currentItem={currentProgressItem}
        hasError={hasProgressError}
        errorItem={errorProgressItem}
        onClose={handleProgressClose}
        onRetry={handleProgressRetry}
      />
    </div>
  );
}
