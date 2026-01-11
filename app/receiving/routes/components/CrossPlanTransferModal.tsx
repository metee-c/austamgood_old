'use client';

// ===== CrossPlanTransferModal Component =====
// Phase 5: Feature ใหม่ - ย้าย/แบ่งออเดอร์ข้ามแผน ตาม edit21.md
// Updated: เพิ่มการเลือกระดับรายการสินค้า (item-level selection)

import React, { useEffect, useState } from 'react';
import { Loader2, TruckIcon, ArrowRight, Package } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import type { EditorStop, RoutePlan } from '../types';

interface CrossPlanTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceStop: EditorStop | null;
  sourcePlanId: number;
  sourceTripId: number;
  onTransfer: (payload: CrossPlanTransferPayload) => Promise<void>;
}

export interface CrossPlanTransferPayload {
  targetPlanId: number;
  targetTripId: number | 'new';
  sequence: number;
  items: TransferItem[];
  note?: string;
}

interface TransferItem {
  orderItemId: number;
  moveWeightKg: number;
  moveQuantity: number;
}

interface ItemRow {
  orderItemId: number;
  skuId: string | null;
  skuName: string | null;
  availableWeight: number;
  availableQty: number;
  unitWeight: number | null;
  movePieces: string;
  moveWeight: string;
}

interface TripOption {
  trip_id: number;
  trip_sequence: number;
  daily_trip_number?: number;
  total_stops: number;
  total_weight_kg: number;
}

export function CrossPlanTransferModal({
  isOpen,
  onClose,
  sourceStop,
  sourcePlanId,
  sourceTripId,
  onTransfer,
}: CrossPlanTransferModalProps) {
  const [availablePlans, setAvailablePlans] = useState<RoutePlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<number | 'new' | null>(null);
  const [selectedSequence, setSelectedSequence] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [trips, setTrips] = useState<TripOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  
  // Item-level selection
  const [orderInfo, setOrderInfo] = useState<any | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);

  // โหลดแผนอื่นที่สามารถย้ายไปได้
  useEffect(() => {
    if (isOpen) {
      fetchAvailablePlans();
      setSelectedPlanId(null);
      setSelectedTripId(null);
      setTrips([]);
      setError(null);
      setNote('');
      setOrderInfo(null);
      setItems([]);
    }
  }, [isOpen, sourcePlanId]);

  // โหลดรายละเอียดสินค้าเมื่อเปิด modal
  useEffect(() => {
    if (isOpen && sourceStop) {
      fetchOrderItems();
    }
  }, [isOpen, sourceStop]);

  const fetchOrderItems = async () => {
    if (!sourceStop) return;
    
    setLoadingItems(true);
    try {
      const orderId = sourceStop.order_id;
      const url = orderId
        ? `/api/route-plans/stops/${sourceStop.stop_id}/order?order_id=${orderId}`
        : `/api/route-plans/stops/${sourceStop.stop_id}/order`;
      
      const res = await fetch(url);
      const { data, error: apiError } = await res.json();

      if (apiError) {
        console.error('Error fetching order items:', apiError);
        return;
      }

      const fetchedItems: ItemRow[] = (data?.items || []).map((item: any) => ({
        orderItemId: item.order_item_id,
        skuId: item.sku_id,
        skuName: item.sku_name,
        availableWeight: Number(item.available_weight ?? 0),
        availableQty: Number(item.available_qty ?? 0),
        unitWeight: item.unit_weight ?? null,
        movePieces: '',
        moveWeight: ''
      }));

      setOrderInfo(data);
      setItems(fetchedItems);
    } catch (err) {
      console.error('Error loading order items:', err);
    } finally {
      setLoadingItems(false);
    }
  };

  const fetchAvailablePlans = async () => {
    setLoadingPlans(true);
    try {
      // Fetch all plans without status filter, then filter client-side
      const response = await fetch('/api/route-plans');
      const { data } = await response.json();
      
      // กรองแผนปัจจุบันออก และเอาเฉพาะ draft, published, optimizing, approved
      const validStatuses = ['draft', 'published', 'optimizing', 'approved'];
      const filtered = (data || []).filter((p: RoutePlan) => 
        p.plan_id !== sourcePlanId && validStatuses.includes(p.status)
      );
      setAvailablePlans(filtered);
    } catch (err) {
      console.error('Error fetching plans:', err);
      setError('ไม่สามารถโหลดรายการแผนได้');
    } finally {
      setLoadingPlans(false);
    }
  };

  // โหลด trips เมื่อเลือกแผน
  useEffect(() => {
    if (selectedPlanId) {
      fetchTrips(selectedPlanId);
    } else {
      setTrips([]);
      setSelectedTripId(null);
    }
  }, [selectedPlanId]);

  const fetchTrips = async (planId: number) => {
    setLoadingTrips(true);
    try {
      // ใช้ข้อมูลจาก availablePlans ที่มี trips อยู่แล้ว
      const plan = availablePlans.find(p => p.plan_id === planId);
      if (plan && (plan as any).trips) {
        const planTrips = (plan as any).trips.map((t: any) => ({
          trip_id: t.trip_id,
          trip_sequence: t.trip_sequence,
          daily_trip_number: t.daily_trip_number,
          total_stops: t.stops?.length || 0,
          total_weight_kg: t.total_weight_kg || 0
        }));
        setTrips(planTrips);
        // Auto-select first trip
        if (planTrips.length > 0) {
          setSelectedTripId(planTrips[0].trip_id);
          setSelectedSequence((planTrips[0].total_stops || 0) + 1);
        }
      } else {
        // Fallback: fetch from API
        const response = await fetch(`/api/route-plans/${planId}/editor`);
        const { data } = await response.json();
        const planTrips = (data?.trips || []).map((t: any) => ({
          trip_id: t.trip_id,
          trip_sequence: t.trip_sequence,
          daily_trip_number: t.daily_trip_number || t.trip_number,
          total_stops: t.stops?.length || 0,
          total_weight_kg: t.total_weight_kg || 0
        }));
        setTrips(planTrips);
        if (planTrips.length > 0) {
          setSelectedTripId(planTrips[0].trip_id);
          setSelectedSequence((planTrips[0].total_stops || 0) + 1);
        }
      }
    } catch (err) {
      console.error('Error fetching trips:', err);
      setError('ไม่สามารถโหลดรายการคันได้');
    } finally {
      setLoadingTrips(false);
    }
  };

  // Handle pieces change
  const handlePiecesChange = (orderItemId: number, value: string) => {
    setError(null);
    setItems(prev =>
      prev.map(item => {
        if (item.orderItemId !== orderItemId) return item;
        const numeric = value === '' ? 0 : Math.floor(Number(value));
        const clampedPieces = Math.max(0, Math.min(Math.floor(item.availableQty), Number.isFinite(numeric) ? numeric : 0));
        const unitWeight = item.unitWeight && item.unitWeight > 0 ? item.unitWeight : null;
        const weight = unitWeight ? clampedPieces * unitWeight : 0;
        return {
          ...item,
          movePieces: clampedPieces === 0 && value === '' ? '' : clampedPieces.toString(),
          moveWeight: weight.toFixed(3)
        };
      })
    );
  };

  // Fill all for an item
  const handleFillAll = (orderItemId: number) => {
    setError(null);
    setItems(prev =>
      prev.map(item => {
        if (item.orderItemId !== orderItemId) return item;
        const pieces = Math.floor(item.availableQty);
        const weight = item.availableWeight;
        return {
          ...item,
          movePieces: pieces.toString(),
          moveWeight: weight.toFixed(3)
        };
      })
    );
  };

  // Calculate totals
  const totalSelectedPieces = items.reduce((sum, item) => sum + (item.movePieces ? Number(item.movePieces) : 0), 0);
  const totalSelectedWeight = items.reduce((sum, item) => sum + (item.moveWeight ? Number(item.moveWeight) : 0), 0);
  const totalAvailablePieces = items.reduce((sum, item) => sum + Math.floor(item.availableQty), 0);
  const totalAvailableWeight = items.reduce((sum, item) => sum + item.availableWeight, 0);
  const remainingPieces = totalAvailablePieces - totalSelectedPieces;
  const remainingWeight = totalAvailableWeight - totalSelectedWeight;

  const handleTransfer = async () => {
    if (!selectedPlanId) {
      setError('กรุณาเลือกแผนปลายทาง');
      return;
    }
    if (!selectedTripId) {
      setError('กรุณาเลือกคันปลายทาง');
      return;
    }

    // Validate items
    const selectedItems = items
      .filter(item => item.movePieces && Number(item.movePieces) > 0)
      .map(item => ({
        orderItemId: item.orderItemId,
        moveWeightKg: Number(item.moveWeight),
        moveQuantity: Number(item.movePieces)
      }));

    if (selectedItems.length === 0) {
      setError('กรุณาเลือกสินค้าที่ต้องการย้ายอย่างน้อย 1 รายการ');
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      await onTransfer({
        targetPlanId: selectedPlanId,
        targetTripId: selectedTripId,
        sequence: selectedSequence,
        items: selectedItems,
        note: note.trim() || undefined
      });
      onClose();
    } catch (err: any) {
      console.error('Error transferring:', err);
      setError(err.message || 'เกิดข้อผิดพลาดในการย้ายออเดอร์');
    } finally {
      setLoading(false);
    }
  };

  const selectedPlan = availablePlans.find(p => p.plan_id === selectedPlanId);
  const selectedTrip = trips.find(t => t.trip_id === selectedTripId);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="ย้ายออเดอร์ไปแผนอื่น" size="xl">
      <div className="space-y-4">
        {/* ข้อมูลออเดอร์ที่จะย้าย */}
        {sourceStop && (
          <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
            <h4 className="font-medium text-blue-800 mb-1 flex items-center gap-2">
              <Package className="h-4 w-4" />
              ออเดอร์ที่จะย้าย
            </h4>
            <div className="text-sm text-blue-700 grid grid-cols-3 gap-2">
              <div><span className="text-blue-600">เลขออเดอร์:</span> {sourceStop.order_no || sourceStop.order_id || '-'}</div>
              <div><span className="text-blue-600">ชื่อร้าน:</span> {sourceStop.stop_name}</div>
              <div><span className="text-blue-600">น้ำหนัก:</span> {totalAvailableWeight.toFixed(2)} กก.</div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* รายการสินค้า */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            เลือกจำนวนชิ้นที่ต้องการย้าย ({items.length} รายการ)
          </label>
          {loadingItems ? (
            <div className="flex items-center gap-2 text-gray-500 text-sm py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              กำลังโหลดรายการสินค้า...
            </div>
          ) : (
            <div className="overflow-x-auto border border-gray-200 rounded-lg max-h-48">
              <table className="w-full text-xs">
                <thead className="bg-gray-100 text-gray-600 sticky top-0">
                  <tr>
                    <th className="px-2 py-2 text-left">SKU</th>
                    <th className="px-2 py-2 text-left">ชื่อสินค้า</th>
                    <th className="px-2 py-2 text-right">คงเหลือ</th>
                    <th className="px-2 py-2 text-right">ย้าย (ชิ้น)</th>
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-center text-gray-500">
                        ไม่มีข้อมูลสินค้า
                      </td>
                    </tr>
                  ) : (
                    items.map(item => (
                      <tr key={item.orderItemId}>
                        <td className="px-2 py-1.5 text-gray-700 font-mono text-xs">{item.skuId || '-'}</td>
                        <td className="px-2 py-1.5 text-gray-700 max-w-[180px] truncate" title={item.skuName || '-'}>
                          {item.skuName || '-'}
                        </td>
                        <td className="px-2 py-1.5 text-right text-gray-600">{Math.floor(item.availableQty)}</td>
                        <td className="px-2 py-1.5 text-right">
                          <input
                            type="number"
                            min={0}
                            max={Math.floor(item.availableQty)}
                            step="1"
                            value={item.movePieces}
                            onChange={e => handlePiecesChange(item.orderItemId, e.target.value)}
                            className="w-16 border border-gray-300 rounded px-1.5 py-0.5 text-right text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="0"
                          />
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <button
                            className="text-xs text-blue-600 hover:underline"
                            onClick={() => handleFillAll(item.orderItemId)}
                          >
                            ทั้งหมด
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Summary ของการย้าย */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
            <div className="text-xs text-gray-500 mb-1">คงเหลือในแผนเดิม:</div>
            <div className="font-semibold text-gray-700">
              {remainingPieces} ชิ้น <span className="text-gray-400">|</span> {remainingWeight.toFixed(2)} kg
            </div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-md px-3 py-2">
            <div className="text-xs text-purple-600 mb-1">ย้ายไปแผนใหม่:</div>
            <div className="font-semibold text-purple-700">
              {totalSelectedPieces} ชิ้น <span className="text-purple-300">|</span> {totalSelectedWeight.toFixed(2)} kg
            </div>
          </div>
        </div>

        {/* เลือกแผนปลายทาง */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">เลือกแผนปลายทาง</label>
            {loadingPlans ? (
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                กำลังโหลด...
              </div>
            ) : (
              <select
                value={selectedPlanId || ''}
                onChange={(e) => {
                  setSelectedPlanId(Number(e.target.value) || null);
                  setSelectedTripId(null);
                  setError(null);
                }}
                className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">-- เลือกแผน --</option>
                {availablePlans.map(plan => (
                  <option key={plan.plan_id} value={plan.plan_id}>
                    {plan.plan_code} - {plan.plan_name || 'ไม่มีชื่อ'} ({new Date(plan.plan_date).toLocaleDateString('th-TH')})
                  </option>
                ))}
              </select>
            )}
            {!loadingPlans && availablePlans.length === 0 && (
              <p className="text-xs text-orange-600 mt-1">ไม่พบแผนอื่นที่สามารถย้ายไปได้</p>
            )}
          </div>

          {/* เลือกคันปลายทาง */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">เลือกคัน</label>
            {!selectedPlanId ? (
              <div className="text-gray-400 text-sm p-2">เลือกแผนก่อน</div>
            ) : loadingTrips ? (
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                กำลังโหลด...
              </div>
            ) : (
              <select
                value={selectedTripId === 'new' ? 'new' : (selectedTripId || '')}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'new') {
                    setSelectedTripId('new');
                    setSelectedSequence(1);
                  } else {
                    const tripId = Number(val);
                    setSelectedTripId(tripId || null);
                    const trip = trips.find(t => t.trip_id === tripId);
                    setSelectedSequence((trip?.total_stops || 0) + 1);
                  }
                  setError(null);
                }}
                className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">-- เลือกคัน --</option>
                <option value="new">+ สร้างคันใหม่</option>
                {trips.map(trip => (
                  <option key={trip.trip_id} value={trip.trip_id}>
                    คัน {trip.daily_trip_number || trip.trip_sequence} ({trip.total_stops} จุด, {trip.total_weight_kg?.toFixed(0) || 0} กก.)
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* เลือกลำดับ */}
        {selectedTripId && selectedTripId !== 'new' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ลำดับจุดส่ง</label>
            <input
              type="number"
              min="1"
              value={selectedSequence}
              onChange={(e) => setSelectedSequence(Number(e.target.value))}
              className="w-32 border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              ค่าเริ่มต้น: ต่อท้ายจุดส่งสุดท้าย
            </p>
          </div>
        )}

        {/* หมายเหตุ */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ (ถ้ามี)</label>
          <textarea
            className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="ระบุเหตุผลในการย้าย..."
          />
        </div>

        {/* Summary */}
        {selectedPlan && selectedTripId && totalSelectedPieces > 0 && (
          <div className="bg-gray-50 border border-gray-200 p-3 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="info">สรุป</Badge>
              <span className="text-gray-600">
                ย้าย {totalSelectedPieces} ชิ้น ({totalSelectedWeight.toFixed(2)} กก.) ไป{' '}
                <span className="font-medium">{selectedPlan.plan_code}</span>
                <ArrowRight className="inline h-4 w-4 mx-1" />
                {selectedTripId === 'new' ? (
                  <span className="text-green-600">คันใหม่</span>
                ) : (
                  <>คัน {selectedTrip?.daily_trip_number || selectedTrip?.trip_sequence} (ลำดับที่ {selectedSequence})</>
                )}
              </span>
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            ยกเลิก
          </Button>
          <Button
            variant="primary"
            onClick={handleTransfer}
            disabled={!selectedPlanId || !selectedTripId || totalSelectedPieces <= 0 || loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                กำลังย้าย...
              </>
            ) : (
              'ย้ายออเดอร์'
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default CrossPlanTransferModal;
