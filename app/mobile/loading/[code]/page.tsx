'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Loader2,
  Gift,
  X
} from 'lucide-react';
import Badge from '@/components/ui/Badge';
import EmployeeSelectionModal from '@/components/mobile/EmployeeSelectionModal';
import LoadingProgressModal, { LoadingItemProgress } from '@/components/mobile/LoadingProgressModal';

interface LoadlistItem {
  order_code: string;
  customer_name: string;
  items: Array<{
    sku_id?: string;
    sku_name: string;
    quantity: number;
    uom?: string;
    package_number?: string | number;
    weight?: number;
  }>;
}

interface Loadlist {
  loadlist_code: string;
  status: string;
  total_weight: number;
  checker_employee_id?: number;
  checker_employee?: {
    employee_id: number;
    first_name: string;
    last_name: string;
    nickname?: string;
    employee_code: string;
  };
  picker_employee?: {
    employee_id: number;
    first_name: string;
    last_name: string;
    nickname?: string;
    employee_code: string;
  };
  picker_employees?: Array<{
    employee_id: number;
    first_name: string;
    last_name: string;
    nickname?: string;
    employee_code: string;
  }>;
  checker_employees?: Array<{
    employee_id: number;
    first_name: string;
    last_name: string;
    nickname?: string;
    employee_code: string;
  }>;
  vehicle?: {
    plate_number: string;
  };
  driver?: {
    first_name: string;
    last_name: string;
  };
  orders: LoadlistItem[];
}

// ✅ NEW: Interface สำหรับ related BFS loadlists
interface RelatedBonusLoadlist {
  loadlist_id: number;
  loadlist_code: string;
  status: string;
  order_nos: string[];
  shop_names: string[];
  total_packages: number;
}

export default function MobileLoadingDetailPage() {
  const router = useRouter();
  const params = useParams();
  const code = params?.code as string;

  const [loading, setLoading] = useState(true);
  const [loadlist, setLoadlist] = useState<Loadlist | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  
  // ✅ NEW: State สำหรับ related BFS loadlists popup
  const [showBonusPopup, setShowBonusPopup] = useState(false);
  const [relatedBonusLoadlists, setRelatedBonusLoadlists] = useState<RelatedBonusLoadlist[]>([]);
  const [pendingCheckerId, setPendingCheckerId] = useState<number | null>(null);
  const [loadingBonus, setLoadingBonus] = useState(false);
  
  // ✅ NEW: State สำหรับ Loading Progress Modal
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressItems, setProgressItems] = useState<LoadingItemProgress[]>([]);
  const [currentProgressItem, setCurrentProgressItem] = useState<LoadingItemProgress | undefined>();
  const [progressTotalItems, setProgressTotalItems] = useState(0);
  const [progressCompletedItems, setProgressCompletedItems] = useState(0);
  const [progressHasError, setProgressHasError] = useState(false);
  const [progressErrorItem, setProgressErrorItem] = useState<LoadingItemProgress | undefined>();

  useEffect(() => {
    if (code) {
      fetchLoadlist();
    }
  }, [code]);

  const fetchLoadlist = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/mobile/loading/loadlist-detail?code=${code}`);
      const data = await response.json();

      if (data.success && data.data) {
        setLoadlist(data.data);
      } else {
        setErrorMessage(data.error || 'ไม่พบข้อมูลใบโหลด');
      }
    } catch (error) {
      setErrorMessage('เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmLoading = () => {
    if (!loadlist || confirming) return;
    // Show employee selection modal
    setShowEmployeeModal(true);
  };

  const handleEmployeeConfirm = async (checkerIds: string[], _pickerIds: string[]) => {
    if (checkerIds.length === 0) {
      setErrorMessage('กรุณาเลือกผู้เช็คสินค้า');
      return;
    }

    const checkerId = parseInt(checkerIds[0]);
    setShowEmployeeModal(false);
    setPendingCheckerId(checkerId);

    // ✅ ตรวจสอบว่ามี related BFS loadlists หรือไม่
    try {
      setLoadingBonus(true);
      const relatedResponse = await fetch(`/api/mobile/loading/related-bonus-loadlists?loadlist_code=${loadlist?.loadlist_code}`);
      const relatedData = await relatedResponse.json();

      if (relatedData.success && relatedData.has_related && relatedData.related_loadlists.length > 0) {
        // มี BFS loadlists ที่แมพกับ picklist เดียวกัน → แสดง popup
        setRelatedBonusLoadlists(relatedData.related_loadlists);
        setShowBonusPopup(true);
        setLoadingBonus(false);
        return;
      }
    } catch (error) {
      console.error('Error checking related bonus loadlists:', error);
    } finally {
      setLoadingBonus(false);
    }

    // ไม่มี related BFS → ดำเนินการโหลดปกติ
    await processLoadingComplete(checkerId, []);
  };

  // ✅ Function สำหรับ process loading complete - เรียก API ก่อน แล้วค่อยแสดง progress
  const processLoadingComplete = async (checkerId: number, bonusLoadlistCodes: string[]) => {
    if (!loadlist) return;

    try {
      setConfirming(true);
      setErrorMessage('');
      setShowProgressModal(true);
      setProgressItems([]);
      setProgressCompletedItems(0);
      setProgressHasError(false);
      setProgressErrorItem(undefined);
      setCurrentProgressItem(undefined);
      setProgressTotalItems(0);
      
      // ✅ Step 1: สร้าง progress items จาก loadlist.orders
      let items: LoadingItemProgress[] = [];
      let itemId = 1;
      
      for (const order of loadlist.orders) {
        for (const orderItem of order.items) {
          const skuIdentifier = orderItem.sku_id || orderItem.sku_name || '';
          const isSticker = skuIdentifier.toUpperCase().includes('STICKER');
          
          items.push({
            id: itemId++,
            sku_id: orderItem.sku_id || '-',
            sku_name: orderItem.sku_name,
            quantity: orderItem.quantity,
            status: isSticker ? 'skipped' : 'pending' as const,
            source_location: 'Dispatch',
            dest_location: 'Delivery-In-Progress'
          });
        }
      }

      // ถ้าไม่มี items จาก orders ให้ลอง fetch จาก preview API
      if (items.length === 0) {
        const previewResponse = await fetch(`/api/mobile/loading/preview?loadlist_code=${loadlist.loadlist_code}`);
        const previewData = await previewResponse.json();
        
        if (previewData.success && previewData.items && previewData.items.length > 0) {
          items = previewData.items.map((item: any, idx: number) => ({
            id: idx + 1,
            sku_id: item.sku_id,
            sku_name: item.sku_name,
            quantity: item.quantity,
            status: item.status === 'skip' ? 'skipped' : 'pending' as const,
            source_location: item.source_location,
            dest_location: item.target_location,
            available_qty: item.available_qty
          }));
        }
      }

      setProgressItems(items);
      setProgressTotalItems(items.length);
      setProgressCompletedItems(items.filter(i => i.status === 'skipped').length);

      // ✅ Step 2: เรียก API ก่อนเลย - ตรวจสอบสต็อกจริง
      const apiResponse = await fetch('/api/mobile/loading/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          loadlist_code: loadlist.loadlist_code,
          checker_employee_id: checkerId
        })
      });

      const data = await apiResponse.json();

      // ✅ Step 3: ถ้า API ตอบว่าสต็อกไม่พอ - แสดง error ทันที
      // Check: API returns 400 with insufficient_items OR success: false
      if (!apiResponse.ok || data.error) {
        if (data.insufficient_items && data.insufficient_items.length > 0) {
          // อัพเดท items - แสดง error สำหรับ SKU ที่ไม่พอ
          const updatedItems = items.map((item) => {
            if (item.status === 'skipped') return item;
            
            const insufficientItem = data.insufficient_items.find(
              (i: any) => i.sku_id === item.sku_id
            );
            
            if (insufficientItem) {
              return {
                ...item,
                status: 'error' as const,
                available_qty: insufficientItem.available || 0,
                error_details: {
                  message: `สต็อกไม่เพียงพอ (มี ${insufficientItem.available || 0} ต้องการ ${insufficientItem.required || item.quantity})`,
                  sku_id: item.sku_id,
                  sku_name: insufficientItem.sku_name || item.sku_name,
                  quantity: item.quantity
                }
              };
            }
            return { ...item, status: 'pending' as const };
          });
          
          const errorItem = updatedItems.find(i => i.status === 'error');
          
          setProgressItems(updatedItems);
          setProgressCompletedItems(updatedItems.filter(i => i.status === 'skipped').length);
          setProgressHasError(true);
          setProgressErrorItem(errorItem);
          setCurrentProgressItem(undefined);
          setErrorMessage(data.error || 'สต็อกไม่เพียงพอ');
          setConfirming(false);
          return;
        }
        
        // ✅ Handle already-loaded picklist/face sheet error
        if (data.already_loaded_picklists || data.already_loaded_face_sheets) {
          const loadedBy = data.already_loaded_picklists?.[0]?.loaded_by || 
                          data.already_loaded_face_sheets?.[0]?.loaded_by || 
                          'ใบโหลดอื่น';
          setProgressHasError(true);
          setProgressErrorItem({
            id: 0,
            sku_id: '-',
            sku_name: 'เอกสารถูกโหลดแล้ว',
            quantity: 0,
            status: 'error',
            error_details: {
              message: `ใบจัดสินค้า/ใบปะหน้าถูกโหลดไปแล้วโดย ${loadedBy}`
            }
          });
          setErrorMessage(data.message || data.error || 'เอกสารถูกโหลดไปแล้ว');
          setConfirming(false);
          return;
        }
        
        // Other errors
        setProgressHasError(true);
        setProgressErrorItem({
          id: 0,
          sku_id: '-',
          sku_name: 'ข้อผิดพลาดระบบ',
          quantity: 0,
          status: 'error',
          error_details: {
            message: data.error || 'เกิดข้อผิดพลาดในการโหลดสินค้า'
          }
        });
        setErrorMessage(data.error || 'เกิดข้อผิดพลาด');
        setConfirming(false);
        return;
      }

      // ✅ Step 4: API สำเร็จ - แสดง progress animation
      const pendingItems = items.filter(i => i.status === 'pending');
      let completedCount = items.filter(i => i.status === 'skipped').length;

      for (let i = 0; i < pendingItems.length; i++) {
        const item = pendingItems[i];
        
        // Checking
        setCurrentProgressItem({ ...item, status: 'checking', message: `กำลังตรวจสอบสต็อก ${item.quantity} ชิ้น...` });
        setProgressItems(prev => prev.map(p => 
          p.id === item.id ? { ...p, status: 'checking' } : p
        ));
        await new Promise(r => setTimeout(r, 80));

        // Moving
        setCurrentProgressItem({ ...item, status: 'moving', message: 'กำลังย้ายสต็อก...' });
        setProgressItems(prev => prev.map(p => 
          p.id === item.id ? { ...p, status: 'moving' } : p
        ));
        await new Promise(r => setTimeout(r, 80));

        // Success
        setProgressItems(prev => prev.map(p => 
          p.id === item.id ? { ...p, status: 'success', message: `ย้ายสำเร็จ: ${item.source_location} → ${item.dest_location}` } : p
        ));
        
        completedCount++;
        setProgressCompletedItems(completedCount);
        setCurrentProgressItem(undefined);
      }

      // ✅ Step 5: Process BFS loadlists (if any)
      for (const bonusCode of bonusLoadlistCodes) {
        try {
          await fetch('/api/mobile/loading/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              loadlist_code: bonusCode,
              checker_employee_id: checkerId
            })
          });
        } catch (err) {
          console.error('Error loading bonus:', bonusCode, err);
        }
      }

      // สร้าง success message
      let message = 'โหลดสินค้าเสร็จสิ้น';
      if (bonusLoadlistCodes.length > 0) {
        message += ` (รวมของแถม ${bonusLoadlistCodes.length} ใบ)`;
      }
      
      setSuccessMessage(message);
      
      // Wait a moment then redirect
      setTimeout(() => {
        setShowProgressModal(false);
        router.push('/mobile/loading');
      }, 1500);

    } catch (error: any) {
      console.error('Loading error:', error);
      setProgressHasError(true);
      setProgressErrorItem({
        id: 0,
        sku_id: '-',
        sku_name: 'ข้อผิดพลาดระบบ',
        quantity: 0,
        status: 'error',
        error_details: {
          message: error.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ'
        }
      });
      setErrorMessage(error.message || 'เกิดข้อผิดพลาด');
    } finally {
      setConfirming(false);
    }
  };

  // ✅ NEW: Handler สำหรับยืนยันโหลดพร้อมของแถม
  const handleConfirmWithBonus = () => {
    if (!pendingCheckerId) return;
    setShowBonusPopup(false);
    const bonusCodes = relatedBonusLoadlists.map(l => l.loadlist_code);
    processLoadingComplete(pendingCheckerId, bonusCodes);
  };

  // ✅ NEW: Handler สำหรับโหลดเฉพาะ loadlist หลัก (ไม่รวมของแถม)
  const handleConfirmWithoutBonus = () => {
    if (!pendingCheckerId) return;
    setShowBonusPopup(false);
    processLoadingComplete(pendingCheckerId, []);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
      </div>
    );
  }

  if (!loadlist) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <p className="text-gray-700 font-thai text-lg mb-2">ไม่พบข้อมูลใบโหลด</p>
        {errorMessage && (
          <p className="text-gray-500 font-thai text-sm mb-4">{errorMessage}</p>
        )}
        <button
          onClick={() => router.push('/mobile/loading')}
          className="px-4 py-2 bg-sky-500 text-white rounded-lg font-thai"
        >
          กลับ
        </button>
      </div>
    );
  }

  const totalOrders = loadlist.orders.length;
  const totalItems = loadlist.orders.reduce((sum, order) => sum + order.items.length, 0);

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* Header - Compact */}
      <div className="bg-gradient-to-br from-sky-400 to-sky-500 text-white p-3 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center space-x-2 mb-2">
          <button
            onClick={() => router.push('/mobile/loading')}
            className="p-1 bg-white/20 rounded hover:bg-white/30 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1">
            <h1 className="text-sm font-bold font-thai">{loadlist.loadlist_code}</h1>
            {loadlist.vehicle && (
              <p className="text-[10px] opacity-90 font-thai">{loadlist.vehicle.plate_number}</p>
            )}
          </div>
          <Badge variant={loadlist.status === 'loaded' ? 'success' : 'warning'} size="sm">
            {loadlist.status === 'loaded' ? 'โหลดแล้ว' : 'รอโหลด'}
          </Badge>
        </div>

        {/* Stats - Compact */}
        <div className="grid grid-cols-3 gap-1.5">
          <div className="bg-white/15 backdrop-blur-sm rounded p-1 text-center">
            <div className="text-sm font-bold">{totalOrders}</div>
            <div className="text-[9px] opacity-90">ออเดอร์</div>
          </div>
          <div className="bg-white/15 backdrop-blur-sm rounded p-1 text-center">
            <div className="text-sm font-bold">{totalItems}</div>
            <div className="text-[9px] opacity-90">รายการ</div>
          </div>
          <div className="bg-white/15 backdrop-blur-sm rounded p-1 text-center">
            <div className="text-sm font-bold">{loadlist.total_weight.toFixed(0)}</div>
            <div className="text-[9px] opacity-90">กก.</div>
          </div>
        </div>
      </div>

      {/* Messages - Compact */}
      <div className="p-2 space-y-2">
        {successMessage && (
          <div className="bg-green-50 border border-green-200 rounded p-2 flex items-start gap-1.5">
            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
            <span className="text-green-700 text-xs font-thai">{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="bg-red-50 border border-red-200 rounded p-2 flex items-start gap-1.5">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <span className="text-red-700 text-xs font-thai">{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Orders by Shop - Compact */}
      <div className="p-2 space-y-2">
        {loadlist.orders.map((order, orderIdx) => (
          <div key={orderIdx} className="bg-white rounded shadow-sm border border-gray-200 overflow-hidden">
            {/* Order Header - Compact */}
            <div className="p-2 bg-sky-50 border-b border-sky-100">
              <div className="flex items-center justify-between mb-0.5">
                <h3 className="font-bold text-gray-900 font-thai text-xs">
                  {orderIdx + 1}. {order.order_code}
                </h3>
                <Badge variant="info" size="sm">
                  {order.items.length} รายการ
                </Badge>
              </div>
              <p className="text-[10px] text-gray-600 font-thai">{order.customer_name}</p>
            </div>

            {/* Items Table - Compact */}
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead className="bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="px-1.5 py-1 text-left font-thai text-gray-700">สินค้า</th>
                    <th className="px-1.5 py-1 text-center font-thai text-gray-700">แพ็ค</th>
                    <th className="px-1.5 py-1 text-center font-thai text-gray-700">จำนวน</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item, itemIdx) => (
                    <tr
                      key={itemIdx}
                      className="border-b border-gray-100 last:border-0"
                    >
                      <td className="px-1.5 py-1.5">
                        <div className="font-thai text-gray-900 font-medium">
                          {item.sku_name}
                        </div>
                        <div className="text-gray-500 mt-0.5 text-[9px]">
                          {item.sku_id}
                        </div>
                      </td>
                      <td className="px-1.5 py-1.5 text-center">
                        {item.package_number && (
                          <span className="inline-block bg-amber-100 text-amber-700 px-1 py-0.5 rounded text-[9px] font-medium">
                            #{item.package_number}
                          </span>
                        )}
                      </td>
                      <td className="px-1.5 py-1.5 text-center">
                        <span className="font-semibold text-sky-600 font-thai">
                          {item.quantity}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Confirm Button - Fixed at bottom - Compact */}
      {loadlist.status !== 'loaded' && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-2 pb-16 shadow-lg z-30">
          <button
            onClick={handleConfirmLoading}
            disabled={confirming}
            className="w-full bg-green-500 hover:bg-green-600 text-white py-2 rounded font-thai font-medium text-sm flex items-center justify-center gap-1.5 active:scale-98 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {confirming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                ยืนยันโหลดสินค้า
              </>
            )}
          </button>
        </div>
      )}

      {/* Employee Selection Modal */}
      {showEmployeeModal && (
        <EmployeeSelectionModal
          isOpen={showEmployeeModal}
          onClose={() => setShowEmployeeModal(false)}
          onConfirm={handleEmployeeConfirm}
          title="ยืนยันการโหลดสินค้า"
          mode="checker-only"
          defaultCheckerId={loadlist?.checker_employee_id}
          checkerEmployee={loadlist?.checker_employee}
          pickerEmployee={loadlist?.picker_employee}
          pickerEmployees={loadlist?.picker_employees}
          checkerEmployees={loadlist?.checker_employees}
        />
      )}

      {/* ✅ NEW: Bonus Loadlists Popup */}
      {showBonusPopup && relatedBonusLoadlists.length > 0 && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full max-h-[80vh] overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-400 to-orange-500 text-white p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gift className="w-6 h-6" />
                  <h3 className="font-bold font-thai text-lg">พบของแถม!</h3>
                </div>
                <button
                  onClick={() => setShowBonusPopup(false)}
                  className="p-1 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm opacity-90 mt-1 font-thai">
                คันนี้มีของแถมที่ต้องโหลดไปด้วย
              </p>
            </div>

            {/* Content */}
            <div className="p-4 max-h-[50vh] overflow-y-auto">
              {relatedBonusLoadlists.map((bonus) => (
                <div 
                  key={bonus.loadlist_id}
                  className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3 last:mb-0"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-amber-800 font-thai text-sm">
                      {bonus.loadlist_code}
                    </span>
                    <Badge variant="warning" size="sm">
                      {bonus.total_packages} แพ็ค
                    </Badge>
                  </div>
                  
                  {/* Order Numbers */}
                  <div className="mb-2">
                    <span className="text-xs text-gray-600 font-thai">เลขเอกสาร:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {bonus.order_nos.map((orderNo, i) => (
                        <span 
                          key={i}
                          className="inline-block bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-xs font-medium"
                        >
                          {orderNo}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Shop Names */}
                  {bonus.shop_names.length > 0 && (
                    <div>
                      <span className="text-xs text-gray-600 font-thai">ร้านค้า:</span>
                      <div className="text-xs text-gray-700 mt-0.5 font-thai">
                        {bonus.shop_names.join(', ')}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Summary */}
              <div className="bg-gray-100 rounded-lg p-3 mt-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 font-thai">รวมของแถม:</span>
                  <span className="font-bold text-gray-900 font-thai">
                    {relatedBonusLoadlists.length} ใบโหลด, {relatedBonusLoadlists.reduce((sum, l) => sum + l.total_packages, 0)} แพ็ค
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-gray-200 space-y-2">
              <button
                onClick={handleConfirmWithBonus}
                disabled={confirming}
                className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-thai font-medium text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {confirming ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    ยืนยันโหลดพร้อมของแถม
                  </>
                )}
              </button>
              <button
                onClick={handleConfirmWithoutBonus}
                disabled={confirming}
                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 py-2.5 rounded-lg font-thai font-medium text-sm transition-colors disabled:opacity-50"
              >
                โหลดเฉพาะใบหลัก (ไม่รวมของแถม)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Bonus Check Overlay */}
      {loadingBonus && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-2xl max-w-xs mx-4">
            <div className="flex flex-col items-center space-y-3">
              <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
              <div className="text-center">
                <h3 className="text-sm font-bold text-gray-900 font-thai mb-1">
                  กำลังตรวจสอบของแถม
                </h3>
                <p className="text-xs text-gray-600 font-thai">
                  กรุณารอสักครู่...
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✅ NEW: Loading Progress Modal */}
      <LoadingProgressModal
        isOpen={showProgressModal}
        items={progressItems}
        totalItems={progressTotalItems}
        completedItems={progressCompletedItems}
        currentItem={currentProgressItem}
        hasError={progressHasError}
        errorItem={progressErrorItem}
        onClose={() => {
          setShowProgressModal(false);
          if (!progressHasError) {
            router.push('/mobile/loading');
          }
        }}
        onRetry={() => {
          setShowProgressModal(false);
          setProgressHasError(false);
          // User can try again by clicking confirm button
        }}
      />
    </div>
  );
}
