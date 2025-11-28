'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  Package,
  MapPin,
  CheckCircle,
  AlertCircle,
  Loader2,
  QrCode,
  ChevronRight
} from 'lucide-react';
import Badge from '@/components/ui/Badge';

interface PicklistItem {
  id: number;
  sku_id: string;
  sku_name: string;
  uom: string;
  order_no: string;
  quantity_to_pick: number;
  quantity_picked: number;
  source_location_id: string;
  status: 'pending' | 'picked' | 'shortage' | 'substituted';
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
  const [selectedItem, setSelectedItem] = useState<PicklistItem | null>(null);

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
      } else {
        console.error('Error:', data.error);
      }
    } catch (error) {
      console.error('Error fetching picklist:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePickItem = async (item: PicklistItem) => {
    if (item.status === 'picked') {
      alert('รายการนี้หยิบแล้ว');
      return;
    }

    const quantityPicked = prompt(
      `จำนวนที่หยิบ (ต้องการ: ${item.quantity_to_pick} ${item.uom})`,
      item.quantity_to_pick.toString()
    );

    if (!quantityPicked) return;

    const qty = parseInt(quantityPicked);
    if (isNaN(qty) || qty <= 0) {
      alert('กรุณาระบุจำนวนที่ถูกต้อง');
      return;
    }

    if (qty > item.quantity_to_pick) {
      alert(`จำนวนที่หยิบ (${qty}) มากกว่าที่ต้องการ (${item.quantity_to_pick})`);
      return;
    }

    try {
      setScanning(true);
      const response = await fetch('/api/mobile/pick/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          picklist_id: picklist?.id,
          item_id: item.id,
          quantity_picked: qty,
          scanned_code: picklist?.picklist_code
        })
      });

      const result = await response.json();

      if (response.ok) {
        alert(result.message || 'บันทึกการหยิบสำเร็จ');
        
        if (result.picklist_completed) {
          alert('หยิบสินค้าครบทุกรายการแล้ว!');
          router.push('/mobile/pick');
        } else {
          fetchPicklist(); // Refresh data
        }
      } else {
        alert(result.error || 'เกิดข้อผิดพลาด');
      }
    } catch (error) {
      console.error('Error picking item:', error);
      alert('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setScanning(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' }> = {
      pending: { label: 'รอหยิบ', variant: 'default' },
      picked: { label: 'หยิบแล้ว', variant: 'success' },
      shortage: { label: 'ขาดสต็อค', variant: 'danger' },
      substituted: { label: 'ทดแทน', variant: 'warning' }
    };

    const match = statusMap[status] || statusMap.pending;
    return (
      <Badge variant={match.variant} size="sm">
        {match.label}
      </Badge>
    );
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

      {/* Items List */}
      <div className="p-4 space-y-3">
        {picklist.picklist_items.map((item) => (
          <div
            key={item.id}
            onClick={() => item.status !== 'picked' && handlePickItem(item)}
            className={`bg-white rounded-lg shadow-sm border p-3 ${
              item.status === 'picked'
                ? 'border-green-200 bg-green-50 opacity-75'
                : 'border-gray-200 active:scale-98 cursor-pointer'
            } transition-all`}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 font-thai text-sm">
                  {item.master_sku?.sku_name || item.sku_name}
                </h3>
                <p className="text-xs text-gray-500 font-thai">
                  SKU: {item.sku_id}
                </p>
                {item.master_sku?.barcode && (
                  <p className="text-xs text-gray-500 font-thai">
                    Barcode: {item.master_sku.barcode}
                  </p>
                )}
              </div>
              {getStatusBadge(item.status)}
            </div>

            {/* Location */}
            <div className="flex items-center space-x-2 mb-2 text-sm">
              <MapPin className="w-4 h-4 text-gray-400" />
              <span className="text-gray-700 font-thai">
                {item.master_location?.location_code || item.source_location_id}
              </span>
            </div>

            {/* Quantity */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-2">
                <Package className="w-4 h-4 text-gray-400" />
                <span className="text-gray-700 font-thai">
                  จำนวน: {item.quantity_to_pick} {item.uom}
                </span>
              </div>
              {item.status === 'picked' ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-400" />
              )}
            </div>

            {/* Order Info */}
            {item.order_no && (
              <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500 font-thai">
                ออเดอร์: {item.order_no}
              </div>
            )}
          </div>
        ))}
      </div>

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
