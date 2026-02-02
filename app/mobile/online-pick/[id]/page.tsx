'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle, Loader2, Package, AlertTriangle, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';

interface OnlinePicklistItem {
  id: number;
  sku_id: string;
  sku_name: string;
  quantity_to_pick: number;
  quantity_picked: number;
  status: string;
  source_location_id?: string;
  notes?: string;
}

interface OnlinePicklist {
  id: number;
  picklist_code: string;
  platform: string;
  status: string;
  total_lines: number;
  total_quantity: number;
  notes?: string;
  created_at: string;
}

export default function MobileOnlinePickDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [picklist, setPicklist] = useState<OnlinePicklist | null>(null);
  const [items, setItems] = useState<OnlinePicklistItem[]>([]);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [showValidationPopup, setShowValidationPopup] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [skuCorrections, setSkuCorrections] = useState<{[key: number]: string}>({});
  const [isSavingCorrections, setIsSavingCorrections] = useState(false);

  useEffect(() => {
    if (id) fetchPicklist();
  }, [id]);

  const fetchPicklist = async () => {
    try {
      setLoading(true);
      const supabase = createClient();

      // Fetch online picklist
      const { data: picklistData, error: picklistError } = await supabase
        .from('online_picklists')
        .select('*')
        .eq('id', id)
        .single();

      if (picklistError) throw picklistError;
      setPicklist(picklistData);

      // Fetch items
      const { data: itemsData, error: itemsError } = await supabase
        .from('online_picklist_items')
        .select('*')
        .eq('picklist_id', id)
        .order('id');

      if (itemsError) throw itemsError;
      setItems(itemsData || []);

    } catch (error) {
      console.error('Error fetching online picklist:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleValidateAndConfirm = async () => {
    if (!picklist) return;

    const unpickedItems = items.filter(item => item.status !== 'completed');
    if (unpickedItems.length === 0) {
      alert('รายการทั้งหมดหยิบแล้ว');
      return;
    }

    setIsValidating(true);

    try {
      // Step 1: Validate SKUs first
      const validateResponse = await fetch('/api/online-picklists/validate-skus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ picklist_id: id })
      });

      const validateResult = await validateResponse.json();

      if (!validateResponse.ok || !validateResult.success) {
        throw new Error(validateResult.error || 'Failed to validate SKUs');
      }

      setValidationResult(validateResult);

      // If there are invalid SKUs, show popup and don't proceed
      if (!validateResult.is_valid) {
        setShowValidationPopup(true);
        return;
      }

      // All SKUs valid, proceed with confirmation
      await proceedWithConfirmation(unpickedItems);

    } catch (error: any) {
      console.error('Error validating SKUs:', error);
      alert(`เกิดข้อผิดพลาด: ${error.message}`);
    } finally {
      setIsValidating(false);
    }
  };

  const handleSaveCorrections = async () => {
    const updates = Object.entries(skuCorrections)
      .filter(([_, newSku]) => newSku && newSku.trim() !== '')
      .map(([itemId, newSku]) => {
        const invalidSku = validationResult?.invalid_skus?.find((s: any) => s.item_id === parseInt(itemId));
        return {
          item_id: parseInt(itemId),
          old_sku_id: invalidSku?.original_sku_id,
          new_sku_id: newSku.trim()
        };
      });

    if (updates.length === 0) {
      alert('กรุณาใส่รหัส SKU ที่ถูกต้องอย่างน้อย 1 รายการ');
      return;
    }

    setIsSavingCorrections(true);

    try {
      const response = await fetch('/api/online-picklists/update-sku', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update SKUs');
      }

      if (result.error_count > 0) {
        const errors = result.results.filter((r: any) => !r.success);
        alert(`บันทึกสำเร็จ ${result.success_count} รายการ\nล้มเหลว ${result.error_count} รายการ:\n${errors.map((e: any) => `- ${e.new_sku_id}: ${e.error}`).join('\n')}`);
      } else {
        alert(`บันทึกสำเร็จ ${result.success_count} รายการ`);
      }

      // Refresh data and close popup
      setShowValidationPopup(false);
      setSkuCorrections({});
      await fetchPicklist();

    } catch (error: any) {
      console.error('Error saving corrections:', error);
      alert(`เกิดข้อผิดพลาด: ${error.message}`);
    } finally {
      setIsSavingCorrections(false);
    }
  };

  const proceedWithConfirmation = async (unpickedItems: OnlinePicklistItem[]) => {
    if (!confirm(`ยืนยันหยิบสินค้าทั้งหมด ${unpickedItems.length} รายการ และย้ายสต็อกไป E-Commerce?`)) {
      return;
    }

    setIsConfirming(true);

    try {
      // Call API to confirm all items with stock movement
      const response = await fetch('/api/online-picklists/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          picklist_id: id,
          items: unpickedItems.map(item => ({
            id: item.id,
            sku_id: item.sku_id,
            quantity: item.quantity_to_pick
          }))
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to confirm pick');
      }

      alert('ยืนยันหยิบสินค้าและย้ายสต็อกเรียบร้อยแล้ว');
      router.push('/mobile/pick');

    } catch (error: any) {
      console.error('Error confirming pick:', error);
      alert(`เกิดข้อผิดพลาด: ${error.message}`);
    } finally {
      setIsConfirming(false);
    }
  };


  const getPlatformColor = (platform: string): string => {
    switch (platform) {
      case 'Shopee': return 'bg-orange-500';
      case 'Lazada': return 'bg-blue-500';
      case 'TikTok': case 'TikTok Shop': return 'bg-pink-500';
      case 'Line': case 'Line Shopping': return 'bg-green-500';
      case 'Facebook': return 'bg-indigo-500';
      default: return 'bg-gray-500';
    }
  };

  const totalCount = items.length;
  const isCompleted = picklist?.status === 'completed';

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
      </div>
    );
  }

  if (!picklist) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
        <p className="text-gray-500 mb-4">ไม่พบใบหยิบสินค้า</p>
        <Button variant="outline" onClick={() => router.push('/mobile/pick')}>
          กลับหน้ารายการ
        </Button>
      </div>
    );
  }

  // Validation Popup Component
  const ValidationPopup = () => {
    if (!showValidationPopup || !validationResult) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="bg-red-500 text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-semibold">ไม่สามารถยืนยันหยิบได้</span>
            </div>
            <button onClick={() => setShowValidationPopup(false)} className="p-1 hover:bg-red-600 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 overflow-auto flex-1">
            <p className="text-sm text-gray-700 mb-4">
              พบ <span className="font-bold text-red-600">{validationResult.invalid_count}</span> รายการที่ไม่พบใน Master SKU
            </p>

            {/* Invalid SKUs - รหัสที่ผิด แสดงว่าควรเป็นรหัสอะไรในระบบ */}
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-red-600 mb-2 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                SKU ที่ไม่พบใน Master SKU ({validationResult.invalid_count} รายการ)
              </h3>
              
              {/* ตารางสีแดง - รหัสที่ผิด */}
              <div className="bg-red-50 border border-red-200 rounded-lg overflow-hidden mb-3">
                <table className="w-full text-xs">
                  <thead className="bg-red-100">
                    <tr>
                      <th className="px-2 py-1.5 text-left text-red-700">รหัสในใบหยิบ (ผิด)</th>
                      <th className="px-2 py-1.5 text-left text-red-700">ชื่อสินค้า</th>
                      <th className="px-2 py-1.5 text-center text-red-700 w-12">จำนวน</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-100">
                    {validationResult.invalid_skus?.map((sku: any, idx: number) => (
                      <tr key={idx} className="bg-white">
                        <td className="px-2 py-1.5 font-mono text-red-600 font-bold">{sku.original_sku_id}</td>
                        <td className="px-2 py-1.5 text-gray-700 truncate max-w-[150px]">{sku.original_sku_name}</td>
                        <td className="px-2 py-1.5 text-center font-bold">{sku.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ตารางสีเขียว - ใส่รหัสที่ถูกต้อง */}
              <h4 className="text-xs font-semibold text-green-600 mb-1 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                ใส่รหัส Master SKU ที่ถูกต้อง:
              </h4>
              <div className="bg-green-50 border border-green-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-green-100">
                    <tr>
                      <th className="px-2 py-1.5 text-left text-green-700">รหัสที่ผิด</th>
                      <th className="px-2 py-1.5 text-center text-green-700 w-6">→</th>
                      <th className="px-2 py-1.5 text-left text-green-700">ใส่รหัส Master SKU ที่ถูกต้อง</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-green-100">
                    {validationResult.invalid_skus?.map((sku: any, idx: number) => (
                      <tr key={idx} className="bg-white">
                        <td className="px-2 py-1.5 font-mono text-red-500 line-through text-xs">{sku.original_sku_id}</td>
                        <td className="px-2 py-1.5 text-center text-gray-400">→</td>
                        <td className="px-2 py-1.5">
                          <input
                            type="text"
                            placeholder="ใส่รหัส SKU ที่ถูกต้อง"
                            className="w-full px-2 py-1 text-xs border border-green-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500 font-mono"
                            value={skuCorrections[sku.item_id] || ''}
                            onChange={(e) => setSkuCorrections(prev => ({
                              ...prev,
                              [sku.item_id]: e.target.value
                            }))}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-gray-500 mt-2">
                💡 ใส่รหัส SKU หรือ Barcode ที่มีอยู่ใน Master SKU แล้วกดบันทึก
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t p-4 bg-gray-50 space-y-2">
            <Button
              variant="success"
              className="w-full"
              onClick={handleSaveCorrections}
              disabled={isSavingCorrections || Object.values(skuCorrections).every(v => !v || v.trim() === '')}
              loading={isSavingCorrections}
            >
              💾 บันทึกการแก้ไข
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setShowValidationPopup(false);
                setSkuCorrections({});
              }}
              disabled={isSavingCorrections}
            >
              ยกเลิก
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Validation Popup */}
      <ValidationPopup />

      {/* Header */}
      <div className={`${getPlatformColor(picklist.platform)} text-white px-3 py-2 sticky top-0 z-10`}>
        <div className="flex items-center justify-between">
          <button onClick={() => router.push('/mobile/pick')} className="p-1">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-center flex-1">
            <p className="font-semibold text-sm">{picklist.picklist_code}</p>
            <p className="text-xs opacity-80">🛒 {picklist.platform}</p>
          </div>
          <div className="w-6"></div>
        </div>
      </div>

      {/* Summary Info */}
      <div className="bg-white border-b px-3 py-2">
        <div className="flex justify-between text-xs">
          <span className="text-gray-600">รายการทั้งหมด: <span className="font-bold text-gray-800">{totalCount}</span> รายการ</span>
          <span className="text-gray-600">จำนวนรวม: <span className="font-bold text-primary-600">{items.reduce((sum, i) => sum + i.quantity_to_pick, 0)}</span> ชิ้น</span>
        </div>
        <div className="text-xs text-green-600 mt-1">ปลายทาง: E-Commerce</div>
      </div>

      {/* Items Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-100 sticky top-0">
            <tr>
              <th className="px-2 py-2 text-left text-gray-600 font-semibold w-8">#</th>
              <th className="px-2 py-2 text-left text-gray-600 font-semibold">รหัสสินค้า</th>
              <th className="px-2 py-2 text-left text-gray-600 font-semibold">ชื่อสินค้า</th>
              <th className="px-2 py-2 text-center text-gray-600 font-semibold w-16">จำนวน</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {items.map((item, idx) => (
              <tr key={item.id} className={item.status === 'completed' ? 'bg-green-50' : ''}>
                <td className="px-2 py-2 text-gray-400">{idx + 1}</td>
                <td className="px-2 py-2 font-mono text-gray-700">{item.sku_id}</td>
                <td className="px-2 py-2 text-gray-800 truncate max-w-[150px]">{item.sku_name || '-'}</td>
                <td className="px-2 py-2 text-center font-bold text-primary-600 text-sm">{item.quantity_to_pick}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50">
            <tr>
              <td colSpan={3} className="px-2 py-2 text-right font-semibold text-gray-700">รวมทั้งหมด</td>
              <td className="px-2 py-2 text-center font-bold text-primary-600 text-sm">{items.reduce((sum, i) => sum + i.quantity_to_pick, 0)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Footer Actions - add pb-16 for mobile bottom nav */}
      <div className="bg-white border-t p-3 sticky bottom-0 pb-20">
        <Button
          variant="success"
          size="lg"
          className="w-full"
          onClick={handleValidateAndConfirm}
          disabled={isConfirming || isCompleted || isValidating}
          loading={isConfirming || isValidating}
        >
          {isCompleted ? (
            <>
              <CheckCircle className="w-5 h-5 mr-2" />
              หยิบครบแล้ว
            </>
          ) : (
            <>
              <Package className="w-5 h-5 mr-2" />
              ยืนยันหยิบทั้งหมด ({totalCount} รายการ)
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
