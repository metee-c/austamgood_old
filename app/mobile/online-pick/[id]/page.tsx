'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle, Loader2, Package, ShoppingCart } from 'lucide-react';
import Badge from '@/components/ui/Badge';
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

  const handleConfirmAll = async () => {
    if (!picklist) return;

    const unpickedItems = items.filter(item => item.status !== 'completed');
    if (unpickedItems.length === 0) {
      alert('รายการทั้งหมดหยิบแล้ว');
      return;
    }

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

  const handleConfirmItem = async (item: OnlinePicklistItem) => {
    if (item.status === 'completed') return;

    try {
      // Call API to confirm single item with stock movement
      const response = await fetch('/api/online-picklists/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          picklist_id: id,
          items: [{
            id: item.id,
            sku_id: item.sku_id,
            quantity: item.quantity_to_pick
          }]
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to confirm item');
      }

      // Refresh items
      await fetchPicklist();

    } catch (error: any) {
      console.error('Error confirming item:', error);
      alert(`เกิดข้อผิดพลาด: ${error.message}`);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'success' | 'warning' }> = {
      pending: { label: 'รอหยิบ', variant: 'default' },
      picking: { label: 'กำลังหยิบ', variant: 'warning' },
      completed: { label: 'หยิบแล้ว', variant: 'success' }
    };
    const match = statusMap[status] || statusMap.pending;
    return <Badge variant={match.variant} size="sm">{match.label}</Badge>;
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

  const completedCount = items.filter(i => i.status === 'completed').length;
  const totalCount = items.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

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

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
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

      {/* Progress Bar */}
      <div className="bg-white border-b px-3 py-2">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-gray-600">ความคืบหน้า</span>
          <span className="font-semibold text-gray-800">{completedCount}/{totalCount} รายการ</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-green-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-auto p-2">
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div
              key={item.id}
              className={`bg-white rounded-lg border p-3 ${
                item.status === 'completed' ? 'border-green-200 bg-green-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-400">#{idx + 1}</span>
                    {getStatusBadge(item.status)}
                  </div>
                  <p className="font-mono text-xs text-gray-600 mb-1">{item.sku_id}</p>
                  <p className="text-sm font-medium text-gray-800 truncate">{item.sku_name || '-'}</p>
                </div>
                <div className="text-right ml-2">
                  <p className="text-lg font-bold text-primary-600">{item.quantity_to_pick}</p>
                  <p className="text-[10px] text-gray-500">ชิ้น</p>
                </div>
              </div>

              {item.status !== 'completed' && (
                <button
                  onClick={() => handleConfirmItem(item)}
                  className="mt-2 w-full bg-green-500 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1 hover:bg-green-600 active:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4" />
                  ยืนยันหยิบ
                </button>
              )}

              {item.status === 'completed' && (
                <div className="mt-2 flex items-center justify-center gap-1 text-green-600 text-sm">
                  <CheckCircle className="w-4 h-4" />
                  หยิบแล้ว
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="bg-white border-t p-3 sticky bottom-0">
        <Button
          variant="success"
          size="lg"
          className="w-full"
          onClick={handleConfirmAll}
          disabled={isConfirming || completedCount === totalCount}
          loading={isConfirming}
        >
          {completedCount === totalCount ? (
            <>
              <CheckCircle className="w-5 h-5 mr-2" />
              หยิบครบแล้ว
            </>
          ) : (
            <>
              <Package className="w-5 h-5 mr-2" />
              ยืนยันหยิบทั้งหมด ({totalCount - completedCount} รายการ)
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
