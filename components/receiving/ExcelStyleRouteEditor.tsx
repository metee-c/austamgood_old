'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Plus, Trash2, Save, X, AlertTriangle, ChevronDown, ChevronUp, Scissors, ArrowRight } from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';

// Types
interface OrderItem {
  order_item_id: number;
  sku_id: string;
  sku_name: string;
  order_qty: number;
  order_weight: number;
}

interface OrderRow {
  rowId: string; // unique identifier for this row
  stopId: number | string;
  orderId: number;
  orderNo: string;
  customerId: string;
  customerName: string;
  province: string | null;
  weightKg: number;
  totalQty: number;
  tripNumber: number; // เลขคัน
  stopSequence: number; // ลำดับจุดส่ง
  note: string | null;
  items: OrderItem[]; // รายการสินค้าในออเดอร์
  // For split tracking
  isSplit: boolean;
  splitFromOrderNo?: string;
  originalWeightKg?: number;
}

interface TripSummary {
  tripNumber: number;
  tripId: number | string;
  totalWeight: number;
  totalStops: number;
  uniqueCustomers: number;
}

interface SplitModalData {
  row: OrderRow;
  splitWeight: string;
  targetTripNumber: number | 'new';
}

interface ExcelStyleRouteEditorProps {
  planId: number;
  planName: string;
  trips: any[];
  onSave: (changes: RouteChanges) => Promise<void>;
  onClose: () => void;
  loading?: boolean;
}

interface RouteChanges {
  moves: Array<{
    orderId: number;
    fromTripId: number | string;
    toTripId: number | string;
    newSequence: number;
  }>;
  reorders: Array<{
    tripId: number | string;
    orderedStopIds: (number | string)[];
  }>;
  splits: Array<{
    orderId: number;
    sourceStopId: number | string;
    targetTripId: number | string | 'new';
    splitWeightKg: number;
  }>;
  newTrips: Array<{
    tripName?: string;
  }>;
}

export default function ExcelStyleRouteEditor({
  planId,
  planName,
  trips,
  onSave,
  onClose,
  loading = false
}: ExcelStyleRouteEditorProps) {
  // Convert trips data to flat rows
  const initialRows = useMemo(() => {
    const rows: OrderRow[] = [];
    
    console.log('🔄 Converting trips to rows:', {
      tripsCount: trips.length,
      firstTrip: trips[0] ? {
        trip_id: trips[0].trip_id,
        stopsCount: trips[0].stops?.length,
        firstStop: trips[0].stops?.[0] ? {
          stop_id: trips[0].stops[0].stop_id,
          orders: trips[0].stops[0].orders,
          ordersCount: trips[0].stops[0].orders?.length
        } : null
      } : null
    });
    
    trips.forEach((trip, tripIndex) => {
      const tripNumber = trip.daily_trip_number || trip.trip_sequence || tripIndex + 1;
      
      (trip.stops || []).forEach((stop: any, stopIndex: number) => {
        // Handle consolidated stops with multiple orders
        const orders = stop.orders || [{
          order_id: stop.order_id,
          order_no: stop.order_no,
          customer_id: stop.tags?.customer_id || '',
          customer_name: stop.stop_name,
          province: null,
          allocated_weight_kg: stop.load_weight_kg,
          total_qty: 0,
          items: [] // fallback has no items
        }];
        
        orders.forEach((order: any, orderIndex: number) => {
          if (!order || !order.order_id) return;
          
          // Debug log for first order
          if (rows.length === 0) {
            console.log('📦 First order being added:', {
              order_id: order.order_id,
              order_no: order.order_no,
              items: order.items,
              itemsCount: order.items?.length || 0
            });
          }
          
          rows.push({
            rowId: `${trip.trip_id}-${stop.stop_id}-${order.order_id}`,
            stopId: stop.stop_id,
            orderId: order.order_id,
            orderNo: order.order_no || '-',
            customerId: order.customer_id || '',
            customerName: order.customer_name || order.shop_name || stop.stop_name || '-',
            province: order.province || null,
            weightKg: Number(order.allocated_weight_kg || order.total_order_weight_kg || 0),
            totalQty: order.total_qty || 0,
            tripNumber,
            stopSequence: stop.sequence_no || stopIndex + 1,
            note: order.note || stop.notes || null,
            items: order.items || [],
            isSplit: false
          });
        });
      });
    });
    
    return rows;
  }, [trips]);

  const [rows, setRows] = useState<OrderRow[]>(initialRows);
  const [hasChanges, setHasChanges] = useState(false);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [splitModalData, setSplitModalData] = useState<SplitModalData | null>(null);
  const [expandedTrips, setExpandedTrips] = useState<Set<number>>(new Set(trips.map((_, i) => i + 1)));
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Get unique trip numbers
  const tripNumbers = useMemo(() => {
    const numbers = new Set(rows.map(r => r.tripNumber));
    return Array.from(numbers).sort((a, b) => a - b);
  }, [rows]);

  // Create mapping from tripNumber to trip_id
  const tripNumberToIdMap = useMemo(() => {
    const map = new Map<number, number | string>();
    trips.forEach((trip, i) => {
      const tripNumber = trip.daily_trip_number || trip.trip_sequence || i + 1;
      map.set(tripNumber, trip.trip_id);
    });
    return map;
  }, [trips]);

  // Get existing trip numbers from database
  const existingTripNumbers = useMemo(() => {
    return new Set(trips.map((t, i) => t.daily_trip_number || t.trip_sequence || i + 1));
  }, [trips]);

  // Calculate trip summaries
  const tripSummaries = useMemo((): TripSummary[] => {
    const summaries: Map<number, TripSummary> = new Map();
    
    rows.forEach(row => {
      if (!summaries.has(row.tripNumber)) {
        const trip = trips.find((t, i) => 
          (t.daily_trip_number || t.trip_sequence || i + 1) === row.tripNumber
        );
        summaries.set(row.tripNumber, {
          tripNumber: row.tripNumber,
          tripId: trip?.trip_id || row.tripNumber,
          totalWeight: 0,
          totalStops: 0,
          uniqueCustomers: 0
        });
      }
      
      const summary = summaries.get(row.tripNumber)!;
      summary.totalWeight += row.weightKg;
    });
    
    // Calculate unique customers and stops per trip
    summaries.forEach((summary, tripNum) => {
      const tripRows = rows.filter(r => r.tripNumber === tripNum);
      const uniqueCustomers = new Set(tripRows.map(r => r.customerId));
      const uniqueStops = new Set(tripRows.map(r => r.stopSequence));
      summary.uniqueCustomers = uniqueCustomers.size;
      summary.totalStops = uniqueStops.size;
    });
    
    return Array.from(summaries.values()).sort((a, b) => a.tripNumber - b.tripNumber);
  }, [rows, trips]);

  // Handle trip number change
  const handleTripChange = useCallback((rowId: string, newTripNumber: number) => {
    setRows(prev => {
      const updated = prev.map(row => {
        if (row.rowId === rowId) {
          // Get max sequence in target trip
          const targetTripRows = prev.filter(r => r.tripNumber === newTripNumber);
          const maxSeq = Math.max(0, ...targetTripRows.map(r => r.stopSequence));
          return { ...row, tripNumber: newTripNumber, stopSequence: maxSeq + 1 };
        }
        return row;
      });
      return updated;
    });
    setHasChanges(true);
  }, []);

  // Handle stop sequence change
  const handleSequenceChange = useCallback((rowId: string, newSequence: number) => {
    setRows(prev => prev.map(row => 
      row.rowId === rowId ? { ...row, stopSequence: newSequence } : row
    ));
    setHasChanges(true);
  }, []);

  // Open split modal
  const handleOpenSplit = useCallback((row: OrderRow) => {
    console.log('🔍 Opening split modal for row:', {
      orderId: row.orderId,
      orderNo: row.orderNo,
      items: row.items,
      itemsCount: row.items?.length || 0
    });
    setSplitModalData({
      row,
      splitWeight: '',
      targetTripNumber: tripNumbers[0] !== row.tripNumber ? tripNumbers[0] : (tripNumbers[1] || 'new')
    });
    setShowSplitModal(true);
  }, [tripNumbers]);

  // Handle split confirm
  const handleSplitConfirm = useCallback(() => {
    if (!splitModalData) return;
    
    const { row, splitWeight, targetTripNumber } = splitModalData;
    const splitWeightNum = parseFloat(splitWeight);
    
    if (isNaN(splitWeightNum) || splitWeightNum <= 0 || splitWeightNum >= row.weightKg) {
      return;
    }
    
    setRows(prev => {
      // Update original row weight
      const updated = prev.map(r => {
        if (r.rowId === row.rowId) {
          return { ...r, weightKg: r.weightKg - splitWeightNum };
        }
        return r;
      });
      
      // Determine target trip number
      let actualTargetTrip = targetTripNumber;
      if (targetTripNumber === 'new') {
        actualTargetTrip = Math.max(...tripNumbers) + 1;
      }
      
      // Get max sequence in target trip
      const targetRows = updated.filter(r => r.tripNumber === actualTargetTrip);
      const maxSeq = Math.max(0, ...targetRows.map(r => r.stopSequence));
      
      // Add new split row
      const newRow: OrderRow = {
        rowId: `${row.rowId}-split-${Date.now()}`,
        stopId: `new-${Date.now()}`,
        orderId: row.orderId,
        orderNo: `${row.orderNo}-S`,
        customerId: row.customerId,
        customerName: `${row.customerName} (แบ่ง)`,
        province: row.province,
        weightKg: splitWeightNum,
        totalQty: 0,
        tripNumber: actualTargetTrip as number,
        stopSequence: maxSeq + 1,
        note: `แบ่งจาก ${row.orderNo}`,
        items: [], // Split row doesn't have items detail
        isSplit: true,
        splitFromOrderNo: row.orderNo,
        originalWeightKg: row.weightKg + splitWeightNum
      };
      
      return [...updated, newRow];
    });
    
    setShowSplitModal(false);
    setSplitModalData(null);
    setHasChanges(true);
  }, [splitModalData, tripNumbers]);

  // Add new trip
  const handleAddTrip = useCallback(() => {
    const newTripNumber = Math.max(...tripNumbers, 0) + 1;
    // Just expand the new trip section - rows will be added when moving orders
    setExpandedTrips(prev => new Set([...prev, newTripNumber]));
  }, [tripNumbers]);

  // Delete row (cancel stop)
  const handleDeleteRow = useCallback((rowId: string) => {
    setRows(prev => prev.filter(r => r.rowId !== rowId));
    setHasChanges(true);
  }, []);

  // Toggle trip expansion
  const toggleTripExpand = useCallback((tripNumber: number) => {
    setExpandedTrips(prev => {
      const next = new Set(prev);
      if (next.has(tripNumber)) {
        next.delete(tripNumber);
      } else {
        next.add(tripNumber);
      }
      return next;
    });
  }, []);

  // Build changes object and save
  const handleSave = useCallback(async () => {
    setSaveError(null);
    setIsSaving(true);
    
    try {
      // Compare with initial rows to find changes
      const changes: RouteChanges = {
        moves: [],
        reorders: [],
        splits: [],
        newTrips: []
      };

      // First, identify new trips that need to be created
      const newTripNumbers = tripNumbers.filter(n => !existingTripNumbers.has(n));
      newTripNumbers.forEach(n => {
        changes.newTrips.push({ tripName: `คันที่ ${n}` });
      });

      // Create a mapping for new trip numbers to their index in newTrips array
      const newTripIndexMap = new Map<number, number>();
      newTripNumbers.forEach((n, idx) => {
        newTripIndexMap.set(n, idx);
      });
      
      // Detect moves (trip changes)
      rows.forEach(row => {
        const initial = initialRows.find(r => r.rowId === row.rowId);
        if (initial && initial.tripNumber !== row.tripNumber) {
          // Get from trip_id (should always exist in database)
          const fromTripId = tripNumberToIdMap.get(initial.tripNumber);
          
          // Get to trip_id - could be existing or new
          let toTripId: number | string;
          if (existingTripNumbers.has(row.tripNumber)) {
            toTripId = tripNumberToIdMap.get(row.tripNumber) || row.tripNumber;
          } else {
            // This is a new trip - use marker format "new-{index}"
            const newTripIndex = newTripIndexMap.get(row.tripNumber);
            toTripId = `new-${newTripIndex}`;
          }
          
          changes.moves.push({
            orderId: row.orderId,
            fromTripId: fromTripId || initial.tripNumber,
            toTripId: toTripId,
            newSequence: row.stopSequence
          });
        }
      });
      
      // Detect splits (new rows with isSplit = true)
      rows.filter(r => r.isSplit).forEach(row => {
        const originalRow = initialRows.find(r => r.orderId === row.orderId && !r.isSplit);
        if (originalRow) {
          // Get target trip_id
          let targetTripId: number | string | 'new';
          if (existingTripNumbers.has(row.tripNumber)) {
            targetTripId = tripNumberToIdMap.get(row.tripNumber) || row.tripNumber;
          } else {
            // This is a new trip
            const newTripIndex = newTripIndexMap.get(row.tripNumber);
            targetTripId = newTripIndex !== undefined ? `new-${newTripIndex}` : 'new';
          }
          
          changes.splits.push({
            orderId: row.orderId,
            sourceStopId: originalRow.stopId,
            targetTripId: targetTripId,
            splitWeightKg: row.weightKg
          });
        }
      });
      
      // Detect reorders within same trip (only for existing trips)
      tripNumbers.forEach(tripNum => {
        // Skip new trips - they don't have existing stops to reorder
        if (!existingTripNumbers.has(tripNum)) return;
        
        const tripRows = rows.filter(r => r.tripNumber === tripNum);
        const initialTripRows = initialRows.filter(r => r.tripNumber === tripNum);
        
        // Check if order changed
        const currentOrder = tripRows.map(r => r.stopId).join(',');
        const initialOrder = initialTripRows.map(r => r.stopId).join(',');
        
        if (currentOrder !== initialOrder && tripRows.length > 0) {
          const tripId = tripNumberToIdMap.get(tripNum);
          
          if (tripId) {
            // Sort by sequence and get stop IDs
            const sortedRows = [...tripRows].sort((a, b) => a.stopSequence - b.stopSequence);
            const uniqueStopIds = [...new Set(sortedRows.map(r => r.stopId))];
            
            changes.reorders.push({
              tripId: tripId,
              orderedStopIds: uniqueStopIds
            });
          }
        }
      });
      
      await onSave(changes);
      setHasChanges(false);
    } catch (error: any) {
      setSaveError(error.message || 'เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setIsSaving(false);
    }
  }, [rows, initialRows, trips, tripNumbers, onSave]);

  // Get available sequences for a trip
  const getAvailableSequences = useCallback((tripNumber: number) => {
    const tripRows = rows.filter(r => r.tripNumber === tripNumber);
    const maxSeq = Math.max(0, ...tripRows.map(r => r.stopSequence));
    return Array.from({ length: maxSeq + 1 }, (_, i) => i + 1);
  }, [rows]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">จัดการเส้นทาง</h2>
          <p className="text-sm text-gray-600">{planName}</p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <span className="text-sm text-orange-600 flex items-center gap-1">
              <AlertTriangle size={14} />
              มีการเปลี่ยนแปลงที่ยังไม่บันทึก
            </span>
          )}
          <Button variant="outline" onClick={onClose} disabled={loading}>
            <X size={16} className="mr-1" />
            ปิด
          </Button>
          <Button 
            variant="primary" 
            onClick={handleSave} 
            disabled={!hasChanges || loading || isSaving}
          >
            <Save size={16} className="mr-1" />
            {isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </div>
      </div>

      {/* Error message */}
      {saveError && (
        <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {saveError}
        </div>
      )}

      {/* Instructions */}
      <div className="p-4 bg-blue-50 border-b text-sm text-blue-800">
        <strong>วิธีใช้:</strong>
        <ul className="mt-1 ml-4 list-disc space-y-1">
          <li>เปลี่ยนเลขคัน: คลิก dropdown ที่คอลัมน์ "คัน" แล้วเลือกคันใหม่</li>
          <li>เปลี่ยนลำดับจุด: คลิก dropdown ที่คอลัมน์ "จุด" แล้วเลือกลำดับใหม่</li>
          <li>แบ่งออเดอร์: คลิกปุ่ม <Scissors size={12} className="inline" /> แล้วกรอกน้ำหนักที่ต้องการแบ่ง</li>
        </ul>
      </div>

      {/* Trip Summaries */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex flex-wrap gap-3">
          {tripSummaries.map(summary => (
            <div 
              key={summary.tripNumber}
              className="bg-white border rounded-lg px-3 py-2 text-sm"
            >
              <div className="font-semibold text-gray-800">คันที่ {summary.tripNumber}</div>
              <div className="text-gray-600">
                {summary.totalWeight.toFixed(1)} kg • {summary.uniqueCustomers} ร้าน • {summary.totalStops} จุด
              </div>
            </div>
          ))}
          <button
            onClick={handleAddTrip}
            className="flex items-center gap-1 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
          >
            <Plus size={14} />
            เพิ่มคัน
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-4">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-gray-100 sticky top-0">
            <tr>
              <th className="border px-3 py-2 text-left w-20">คัน</th>
              <th className="border px-3 py-2 text-left w-20">จุด</th>
              <th className="border px-3 py-2 text-left w-32">เลขออเดอร์</th>
              <th className="border px-3 py-2 text-left w-24">รหัสลูกค้า</th>
              <th className="border px-3 py-2 text-left">ชื่อร้าน</th>
              <th className="border px-3 py-2 text-left w-24">จังหวัด</th>
              <th className="border px-3 py-2 text-right w-24">น้ำหนัก (kg)</th>
              <th className="border px-3 py-2 text-right w-20">จำนวน</th>
              <th className="border px-3 py-2 text-left">หมายเหตุ</th>
              <th className="border px-3 py-2 text-center w-24">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {tripNumbers.map(tripNum => {
              const tripRows = rows
                .filter(r => r.tripNumber === tripNum)
                .sort((a, b) => a.stopSequence - b.stopSequence);
              const isExpanded = expandedTrips.has(tripNum);
              const summary = tripSummaries.find(s => s.tripNumber === tripNum);
              
              return (
                <React.Fragment key={tripNum}>
                  {/* Trip header row */}
                  <tr 
                    className="bg-blue-100 cursor-pointer hover:bg-blue-200"
                    onClick={() => toggleTripExpand(tripNum)}
                  >
                    <td colSpan={10} className="border px-3 py-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          <span className="font-semibold">คันที่ {tripNum}</span>
                          <span className="text-gray-600">
                            ({summary?.uniqueCustomers || 0} ร้าน / {summary?.totalStops || 0} จุด)
                          </span>
                        </div>
                        <span className="font-semibold">
                          {summary?.totalWeight.toFixed(1) || 0} kg
                        </span>
                      </div>
                    </td>
                  </tr>
                  
                  {/* Trip rows */}
                  {isExpanded && tripRows.map(row => (
                    <tr 
                      key={row.rowId}
                      className={`hover:bg-gray-50 ${row.isSplit ? 'bg-yellow-50' : ''}`}
                    >
                      <td className="border px-2 py-1">
                        <select
                          value={row.tripNumber}
                          onChange={(e) => handleTripChange(row.rowId, parseInt(e.target.value))}
                          className="w-full border rounded px-2 py-1 text-sm"
                        >
                          {tripNumbers.map(n => (
                            <option key={n} value={n}>คัน {n}</option>
                          ))}
                          <option value={Math.max(...tripNumbers) + 1}>+ คันใหม่</option>
                        </select>
                      </td>
                      <td className="border px-2 py-1">
                        <select
                          value={row.stopSequence}
                          onChange={(e) => handleSequenceChange(row.rowId, parseInt(e.target.value))}
                          className="w-full border rounded px-2 py-1 text-sm"
                        >
                          {getAvailableSequences(row.tripNumber).map(seq => (
                            <option key={seq} value={seq}>{seq}</option>
                          ))}
                        </select>
                      </td>
                      <td className="border px-3 py-1 font-mono text-blue-600">
                        {row.orderNo}
                        {row.isSplit && (
                          <span className="ml-1 text-xs text-orange-600">(แบ่ง)</span>
                        )}
                      </td>
                      <td className="border px-3 py-1 font-mono text-gray-600">
                        {row.customerId || '-'}
                      </td>
                      <td className="border px-3 py-1">{row.customerName}</td>
                      <td className="border px-3 py-1 text-gray-600">{row.province || '-'}</td>
                      <td className="border px-3 py-1 text-right font-mono">
                        {row.weightKg.toFixed(1)}
                      </td>
                      <td className="border px-3 py-1 text-right font-mono">
                        {row.totalQty || '-'}
                      </td>
                      <td className="border px-3 py-1 text-gray-500 text-xs truncate max-w-[150px]">
                        {row.note || '-'}
                      </td>
                      <td className="border px-2 py-1">
                        <div className="flex items-center justify-center gap-1">
                          {!row.isSplit && (
                            <button
                              onClick={() => handleOpenSplit(row)}
                              className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                              title="แบ่งออเดอร์"
                            >
                              <Scissors size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteRow(row.rowId)}
                            className="p-1 text-red-600 hover:bg-red-100 rounded"
                            title="ยกเลิกจุดส่ง"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Split Modal */}
      <Modal
        isOpen={showSplitModal}
        onClose={() => setShowSplitModal(false)}
        title="แบ่งออเดอร์"
        size="md"
      >
        {splitModalData && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="font-semibold">{splitModalData.row.orderNo}</div>
              <div className="text-sm text-gray-600">{splitModalData.row.customerName}</div>
              <div className="text-sm">น้ำหนักปัจจุบัน: {splitModalData.row.weightKg.toFixed(2)} kg</div>
            </div>

            {/* รายการสินค้าในออเดอร์ */}
            {splitModalData.row.items && splitModalData.row.items.length > 0 ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  รายการสินค้าในออเดอร์ ({splitModalData.row.items.length} รายการ)
                </label>
                <div className="max-h-48 overflow-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="px-2 py-1 text-left">SKU</th>
                        <th className="px-2 py-1 text-left">ชื่อสินค้า</th>
                        <th className="px-2 py-1 text-right">จำนวน</th>
                        <th className="px-2 py-1 text-right">น้ำหนัก (kg)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {splitModalData.row.items.map((item, idx) => (
                        <tr key={item.order_item_id || idx} className="border-t hover:bg-gray-50">
                          <td className="px-2 py-1 font-mono text-xs">{item.sku_id}</td>
                          <td className="px-2 py-1 text-xs truncate max-w-[150px]">{item.sku_name || '-'}</td>
                          <td className="px-2 py-1 text-right font-mono">{item.order_qty}</td>
                          <td className="px-2 py-1 text-right font-mono">{(item.order_weight || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500 italic">ไม่พบรายการสินค้าในออเดอร์นี้</div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                น้ำหนักที่ต้องการแบ่ง (kg)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={splitModalData.row.weightKg - 0.01}
                value={splitModalData.splitWeight}
                onChange={(e) => setSplitModalData(prev => prev ? { ...prev, splitWeight: e.target.value } : null)}
                className="w-full border rounded-lg px-3 py-2"
                placeholder="กรอกน้ำหนัก..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ย้ายไปคันที่
              </label>
              <select
                value={splitModalData.targetTripNumber}
                onChange={(e) => setSplitModalData(prev => prev ? { 
                  ...prev, 
                  targetTripNumber: e.target.value === 'new' ? 'new' : parseInt(e.target.value) 
                } : null)}
                className="w-full border rounded-lg px-3 py-2"
              >
                {tripNumbers.filter(n => n !== splitModalData.row.tripNumber).map(n => (
                  <option key={n} value={n}>คันที่ {n}</option>
                ))}
                <option value="new">+ สร้างคันใหม่</option>
              </select>
            </div>
            
            <div className="flex items-center justify-between text-sm bg-blue-50 rounded-lg p-3">
              <div>
                <div className="text-gray-600">คงเหลือในคันเดิม:</div>
                <div className="font-semibold">
                  {(splitModalData.row.weightKg - (parseFloat(splitModalData.splitWeight) || 0)).toFixed(2)} kg
                </div>
              </div>
              <ArrowRight size={20} className="text-gray-400" />
              <div>
                <div className="text-gray-600">ย้ายไปคันใหม่:</div>
                <div className="font-semibold text-blue-600">
                  {parseFloat(splitModalData.splitWeight) || 0} kg
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowSplitModal(false)}>
                ยกเลิก
              </Button>
              <Button 
                variant="primary" 
                onClick={handleSplitConfirm}
                disabled={
                  !splitModalData.splitWeight || 
                  parseFloat(splitModalData.splitWeight) <= 0 ||
                  parseFloat(splitModalData.splitWeight) >= splitModalData.row.weightKg
                }
              >
                แบ่งออเดอร์
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Loading Overlay */}
      {isSaving && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-xl flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-900">กำลังบันทึก...</p>
              <p className="text-sm text-gray-600">กรุณารอสักครู่</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
