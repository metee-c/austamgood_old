'use client';

// ===== SplitStopModal Component =====
// แยกออกมาจาก page.tsx
// ห้ามแก้ไข Logic - Copy มาจากเดิมทั้งหมด

import React, { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import type { EditorStop, EditorTrip, SplitFormPayload, SplitModalItem } from '../types';

interface SplitStopModalProps {
    isOpen: boolean;
    stop: EditorStop | null;
    orderId?: number | null;
    trips: EditorTrip[];
    currentTripId: number | null;
    onClose: () => void;
    onSubmit: (payload: SplitFormPayload) => void;
}

export function SplitStopModal({ isOpen, stop, orderId, trips, currentTripId, onClose, onSubmit }: SplitStopModalProps) {
    const [loading, setLoading] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [orderInfo, setOrderInfo] = useState<any | null>(null);
    const [items, setItems] = useState<SplitModalItem[]>([]);
    const [targetTripId, setTargetTripId] = useState<number | '' | 'new'>('');
    const [serviceMinutes, setServiceMinutes] = useState('');
    const [note, setNote] = useState('');
    const [formError, setFormError] = useState<string | null>(null);
    const [newTripName, setNewTripName] = useState('');

    useEffect(() => {
        if (!isOpen) {
            setOrderInfo(null);
            setItems([]);
            setFetchError(null);
            setFormError(null);
            setServiceMinutes('');
            setNote('');
            setNewTripName('');
            return;
        }

        if (stop) {
            const load = async () => {
                try {
                    setLoading(true);
                    setFetchError(null);
                    const url = orderId
                        ? `/api/route-plans/stops/${stop.stop_id}/order?order_id=${orderId}`
                        : `/api/route-plans/stops/${stop.stop_id}/order`;
                    const res = await fetch(url);
                    const { data, error } = await res.json();

                    console.log('🔍 Split Modal - API Response:', {
                        url,
                        hasData: !!data,
                        hasItems: !!data?.items,
                        itemsLength: data?.items?.length,
                        orderNo: data?.order_no,
                        error
                    });

                    if (error) {
                        setFetchError(error);
                        setOrderInfo(null);
                        setItems([]);
                        return;
                    }

                    const fetchedItems: SplitModalItem[] = (data?.items || []).map((item: any) => ({
                        orderItemId: item.order_item_id,
                        skuId: item.sku_id,
                        skuName: item.sku_name,
                        availableWeight: Number(item.available_weight ?? 0),
                        availableQty: Number(item.available_qty ?? 0),
                        unitWeight: item.unit_weight ?? null,
                        moveWeight: '',
                        moveQty: '',
                        movePieces: ''
                    }));

                    setOrderInfo(data);
                    setItems(fetchedItems);
                    setServiceMinutes(stop.service_duration_minutes != null ? String(stop.service_duration_minutes) : '');
                    setFormError(null);
                } catch (error) {
                    console.error('Error loading order details:', error);
                    setFetchError('ไม่สามารถโหลดรายละเอียดสินค้าได้');
                    setOrderInfo(null);
                    setItems([]);
                } finally {
                    setLoading(false);
                }
            };

            load();
        }
    }, [isOpen, stop, orderId]);

    useEffect(() => {
        if (isOpen) {
            const alternativeTrip = trips.find(trip => trip.trip_id !== currentTripId);
            setTargetTripId(alternativeTrip ? alternativeTrip.trip_id : 'new');
        }
    }, [isOpen, trips, currentTripId]);

    const handleWeightChange = (orderItemId: number, value: string) => {
        setFormError(null);
        setItems(prev =>
            prev.map(item => {
                if (item.orderItemId !== orderItemId) return item;
                const numeric = value === '' ? 0 : Number(value);
                const clamped = Math.max(0, Math.min(item.availableWeight, Number.isFinite(numeric) ? numeric : 0));
                const unitWeight = item.unitWeight && item.unitWeight > 0 ? item.unitWeight : null;
                const computedQty = unitWeight ? clamped / unitWeight : undefined;
                return {
                    ...item,
                    moveWeight: clamped === 0 && value === '' ? '' : clamped.toString(),
                    moveQty: unitWeight && computedQty !== undefined ? computedQty.toFixed(3) : item.moveQty
                };
            })
        );
    };

    const handleQtyChange = (orderItemId: number, value: string) => {
        setFormError(null);
        setItems(prev =>
            prev.map(item => {
                if (item.orderItemId !== orderItemId) return item;
                const numeric = value === '' ? 0 : Number(value);
                const clampedQty = Math.max(0, Number.isFinite(numeric) ? numeric : 0);
                const unitWeight = item.unitWeight && item.unitWeight > 0 ? item.unitWeight : null;
                let weight = unitWeight ? clampedQty * unitWeight : Number(item.moveWeight || 0);
                if (weight > item.availableWeight) {
                    weight = item.availableWeight;
                }
                const adjustedQty = unitWeight ? weight / unitWeight : clampedQty;
                return {
                    ...item,
                    moveQty: adjustedQty === 0 && value === '' ? '' : adjustedQty.toFixed(3),
                    moveWeight: weight.toFixed(3)
                };
            })
        );
    };

    const handlePiecesChange = (orderItemId: number, value: string) => {
        setFormError(null);
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
                    moveQty: clampedPieces.toString(),
                    moveWeight: weight.toFixed(3)
                };
            })
        );
    };

    const handleFillAll = (orderItemId: number) => {
        setFormError(null);
        setItems(prev =>
            prev.map(item => {
                if (item.orderItemId !== orderItemId) return item;
                const weight = Number(item.availableWeight.toFixed(3));
                const pieces = Math.floor(item.availableQty);
                const qtyString =
                    item.unitWeight && item.unitWeight > 0
                        ? (weight / item.unitWeight).toFixed(3)
                        : item.availableQty.toFixed(3);
                return {
                    ...item,
                    moveWeight: weight.toString(),
                    moveQty: qtyString,
                    movePieces: pieces.toString()
                };
            })
        );
    };

    const totalSelectedWeight = items.reduce((sum, item) => sum + (item.moveWeight ? Number(item.moveWeight) : 0), 0);
    const totalSelectedPieces = items.reduce((sum, item) => sum + (item.movePieces ? Number(item.movePieces) : 0), 0);
    
    const totalAvailablePieces = items.reduce((sum, item) => sum + Math.floor(item.availableQty), 0);
    const totalAvailableWeight = items.reduce((sum, item) => sum + item.availableWeight, 0);
    const remainingPieces = totalAvailablePieces - totalSelectedPieces;
    const remainingWeight = totalAvailableWeight - totalSelectedWeight;

    const handleSubmit = () => {
        if (!stop) return;
        if (!targetTripId) {
            setFormError('กรุณาเลือกเที่ยวปลายทางที่ต้องการย้าย');
            return;
        }

        const selectedItems = items
            .filter(item => (item.movePieces && Number(item.movePieces) > 0) || (item.moveWeight && Number(item.moveWeight) > 0))
            .map(item => ({
                orderItemId: item.orderItemId,
                moveWeightKg: Number(item.moveWeight),
                moveQuantity: item.movePieces ? Number(item.movePieces) : (item.moveQty ? Number(item.moveQty) : null)
            }));

        if (selectedItems.length === 0) {
            setFormError('กรุณาเลือกสินค้าที่ต้องการย้ายอย่างน้อย 1 รายการ');
            return;
        }

        if (targetTripId !== 'new' && targetTripId === currentTripId) {
            setFormError('กรุณาเลือกเที่ยวปลายทางที่แตกต่างจากเที่ยวปัจจุบัน');
            return;
        }

        const totalAvailablePiecesCheck = items.reduce((sum, item) => sum + Math.floor(item.availableQty), 0);
        if (totalSelectedPieces >= totalAvailablePiecesCheck) {
            setFormError('จำนวนชิ้นที่ย้ายต้องน้อยกว่าจำนวนทั้งหมดของออเดอร์');
            return;
        }

        const isNewTrip = targetTripId === 'new';

        onSubmit({
            stopId: stop.stop_id,
            targetTripId: isNewTrip ? undefined : Number(targetTripId),
            newTrip: isNewTrip
                ? {
                    trip_name: newTripName.trim() || null
                }
                : undefined,
            items: selectedItems,
            serviceMinutes: serviceMinutes.trim() === '' ? null : Number(serviceMinutes),
            note: note.trim() || null
        });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="แบ่งออเดอร์ไปยังคันอื่น" size="lg">
            {!stop ? (
                <div className="py-6 text-center text-gray-500">กรุณาเลือกจุดที่ต้องการแบ่ง</div>
            ) : loading ? (
                <div className="py-10 text-center text-gray-500">กำลังโหลดรายละเอียดสินค้า...</div>
            ) : fetchError ? (
                <div className="py-6 text-center text-red-500">{fetchError}</div>
            ) : (
                <div className="space-y-4">
                    <div className="bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700">
                        <div className="font-semibold text-gray-800">
                            {stop.stop_name}
                            {orderInfo && (
                                <span className="ml-2 text-xs font-normal text-gray-600">
                                    (เลขที่: {orderInfo.order_no || orderInfo.order_id})
                                </span>
                            )}
                        </div>
                        <div className="text-xs text-gray-500">
                            น้ำหนักปัจจุบัน: {items.reduce((sum, item) => sum + item.availableWeight, 0).toFixed(2)} kg
                        </div>
                    </div>

                    {formError && (
                        <div className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                            {formError}
                        </div>
                    )}

                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                        <table className="w-full text-xs">
                            <thead className="bg-gray-100 text-gray-600">
                                <tr>
                                    <th className="px-3 py-2 text-left">SKU</th>
                                    <th className="px-3 py-2 text-left">รายการ</th>
                                    <th className="px-3 py-2 text-right">คงเหลือ (ชิ้น)</th>
                                    <th className="px-3 py-2 text-right">คงเหลือ (kg)</th>
                                    <th className="px-3 py-2 text-right">ย้าย (ชิ้น)</th>
                                    <th className="px-3 py-2 text-right">น้ำหนัก (kg)</th>
                                    <th className="px-3 py-2"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {items.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-3 py-4 text-center text-gray-500">
                                            ไม่มีข้อมูลสินค้าในออเดอร์นี้
                                        </td>
                                    </tr>
                                ) : (
                                    items.map(item => (
                                        <tr key={item.orderItemId}>
                                            <td className="px-3 py-2 text-gray-700">{item.skuId || '-'}</td>
                                            <td className="px-3 py-2 text-gray-700 max-w-[150px] truncate" title={item.skuName || '-'}>{item.skuName || '-'}</td>
                                            <td className="px-3 py-2 text-right text-gray-700 font-medium">{Math.floor(item.availableQty)}</td>
                                            <td className="px-3 py-2 text-right text-gray-500">{item.availableWeight.toFixed(2)}</td>
                                            <td className="px-3 py-2 text-right">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={Math.floor(item.availableQty)}
                                                    step="1"
                                                    value={item.movePieces}
                                                    onChange={event => handlePiecesChange(item.orderItemId, event.target.value)}
                                                    className="w-20 border border-gray-300 rounded-md px-2 py-1 text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                    placeholder="0"
                                                />
                                            </td>
                                            <td className="px-3 py-2 text-right text-gray-500">
                                                {item.moveWeight ? Number(item.moveWeight).toFixed(2) : '-'}
                                            </td>
                                            <td className="px-3 py-2 text-right">
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

                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
                            <div className="text-xs text-gray-500 mb-1">คงเหลือในคันเดิม:</div>
                            <div className="font-semibold text-gray-700">
                                {remainingPieces} ชิ้น <span className="text-gray-400">|</span> {remainingWeight.toFixed(2)} kg
                            </div>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
                            <div className="text-xs text-blue-600 mb-1">ย้ายไปคันใหม่:</div>
                            <div className="font-semibold text-blue-700">
                                {totalSelectedPieces} ชิ้น <span className="text-blue-300">|</span> {totalSelectedWeight.toFixed(2)} kg
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <label className="flex flex-col gap-1">
                            <span className="text-xs text-gray-600">ย้ายไปเที่ยว</span>
                            <select
                                className="border border-gray-300 rounded-md px-2 py-1"
                                value={targetTripId}
                                onChange={event => {
                                    setFormError(null);
                                    const value = event.target.value;
                                    if (value === 'new') {
                                        setTargetTripId('new');
                                    } else if (value === '') {
                                        setTargetTripId('');
                                    } else {
                                        setTargetTripId(Number(value));
                                    }
                                }}
                            >
                                <option value="">เลือกเที่ยว</option>
                                <option value="new">สร้างเที่ยวใหม่</option>
                                {trips.map(trip => (
                                    <option key={trip.trip_id} value={trip.trip_id} disabled={trip.trip_id === currentTripId}>
                                        เที่ยวที่ {trip.trip_number}
                                    </option>
                                ))}
                            </select>
                        </label>
                        {targetTripId === 'new' && (
                            <label className="flex flex-col gap-1">
                                <span className="text-xs text-gray-600">ชื่อเที่ยวใหม่ (ไม่บังคับ)</span>
                                <input
                                    type="text"
                                    value={newTripName}
                                    onChange={event => setNewTripName(event.target.value)}
                                    className="border border-gray-300 rounded-md px-2 py-1"
                                    placeholder="ระบุชื่อเที่ยว..."
                                />
                            </label>
                        )}
                        <label className="flex flex-col gap-1">
                            <span className="text-xs text-gray-600">เวลาบริการ (นาที)</span>
                            <input
                                type="number"
                                min={0}
                                step="1"
                                value={serviceMinutes}
                                onChange={event => setServiceMinutes(event.target.value)}
                                className="border border-gray-300 rounded-md px-2 py-1"
                            />
                        </label>
                    </div>

                    <label className="flex flex-col gap-1 text-sm">
                        <span className="text-xs text-gray-600">หมายเหตุ (ถ้ามี)</span>
                        <textarea
                            className="border border-gray-300 rounded-md px-2 py-1"
                            rows={2}
                            value={note}
                            onChange={event => setNote(event.target.value)}
                        />
                    </label>

                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={onClose}>
                            ยกเลิก
                        </Button>
                        <Button variant="primary" onClick={handleSubmit} disabled={totalSelectedPieces <= 0}>
                            แยกออเดอร์
                        </Button>
                    </div>
                </div>
            )}
        </Modal>
    );
}

export default SplitStopModal;
