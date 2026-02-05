'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Plus, Trash2, Save, X, AlertTriangle, ChevronDown, ChevronUp, Scissors, ArrowRight, ExternalLink, Search, Package, Lock } from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { useAuthContext } from '@/contexts/AuthContext';

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
  splitItemsData?: { orderItemId: number; quantity: number; weightKg: number }[];
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
  splitItems: { [orderItemId: number]: number }; // จำนวนชิ้นที่เลือกแต่ละ item
}

interface ExcelStyleRouteEditorProps {
  planId: number;
  planName: string;
  trips: any[];
  onSave: (changes: RouteChanges) => Promise<void>;
  onClose: () => void;
  loading?: boolean;
  onCrossPlanTransfer?: (stop: OrderRow, tripId: number | string) => void;
  draftOrders?: DraftOrder[];
  draftOrdersLoading?: boolean;
  onRefreshDraftOrders?: () => void;
}

interface DraftOrder {
  order_id: number;
  order_no: string;
  customer_id?: string;
  shop_name?: string;
  customer?: {
    customer_id: string;
    customer_name?: string;
    customer_code?: string;
    latitude?: number;
    longitude?: number;
  };
  total_weight?: number;
  total_units?: number;
  province?: string;
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
    splitItems?: { orderItemId: number; quantity: number; weightKg: number }[];
  }>;
  newTrips: Array<{
    tripName?: string;
  }>;
  deletes?: Array<{
    stopId: number | string;
    orderId: number;
    tripId: number | string;
  }>;
}

export default function ExcelStyleRouteEditor({
  planId,
  planName,
  trips,
  onSave,
  onClose,
  loading = false,
  onCrossPlanTransfer,
  draftOrders = [],
  draftOrdersLoading = false,
  onRefreshDraftOrders
}: ExcelStyleRouteEditorProps) {
  // Get current user
  const { user } = useAuthContext();
  const isMetee = user?.email === 'metee.c@buzzpetsfood.com';

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
        // Priority: stop.orders array > stop.tags.order_ids > fallback to single order
        let orders = stop.orders;
        
        if (!orders || orders.length === 0) {
          // Fallback: Try to get order IDs from tags
          const orderIds = stop.tags?.order_ids || (stop.order_id ? [stop.order_id] : []);
          
          if (orderIds.length > 1) {
            // Multiple orders but no orders array - create placeholder orders
            orders = orderIds.map((orderId: number) => ({
              order_id: orderId,
              order_no: `Order ${orderId}`, // Will be fetched from API
              customer_id: stop.tags?.customer_id || '',
              customer_name: stop.stop_name,
              province: null,
              allocated_weight_kg: stop.load_weight_kg / orderIds.length, // Distribute weight evenly
              total_qty: 0,
              items: []
            }));
          } else {
            // Single order fallback
            orders = [{
              order_id: stop.order_id,
              order_no: stop.order_no,
              customer_id: stop.tags?.customer_id || '',
              customer_name: stop.stop_name,
              province: null,
              allocated_weight_kg: stop.load_weight_kg,
              total_qty: 0,
              items: []
            }];
          }
        }
        
        orders.forEach((order: any, orderIndex: number) => {
          if (!order || !order.order_id) return;
          
          // Debug log for first order
          if (rows.length === 0) {
            console.log('📦 First order being added:', {
              order_id: order.order_id,
              order_no: order.order_no,
              items: order.items,
              itemsCount: order.items?.length || 0,
              stop_tags: stop.tags
            });
          }
          
          rows.push({
            rowId: `${trip.trip_id}-${stop.stop_id}-${order.order_id}`,
            stopId: stop.stop_id,
            orderId: order.order_id,
            orderNo: order.order_no || '-',
            customerId: order.customer_id || '',
            customerName: order.shop_name || order.customer_name || stop.stop_name || '-',
            province: order.province || null,
            weightKg: Number(order.allocated_weight_kg || order.total_order_weight_kg || 0),
            totalQty: Number(order.total_qty) || 0,
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
  const [showPicklistWarning, setShowPicklistWarning] = useState(false);

  // ตรวจสอบว่ามี trip ที่มี picklist หรือไม่
  const tripsWithPicklist = useMemo(() => {
    return trips.filter((trip: any) => trip.has_picklist === true);
  }, [trips]);

  const hasAnyPicklist = tripsWithPicklist.length > 0;

  // สร้าง map ของ tripNumber -> has_picklist
  const tripPicklistMap = useMemo(() => {
    const map = new Map<number, boolean>();
    trips.forEach((trip: any, i: number) => {
      const tripNumber = trip.daily_trip_number || trip.trip_sequence || i + 1;
      map.set(tripNumber, trip.has_picklist === true);
    });
    return map;
  }, [trips]);

  // State สำหรับเพิ่มออเดอร์ร่าง
  const [showAddOrderPanel, setShowAddOrderPanel] = useState(false);
  const [addOrderSearch, setAddOrderSearch] = useState('');
  const [selectedDraftOrderId, setSelectedDraftOrderId] = useState<number | null>(null);
  const [selectedTargetTripId, setSelectedTargetTripId] = useState<number | null>(null);
  const [isAddingOrder, setIsAddingOrder] = useState(false);
  const [addOrderError, setAddOrderError] = useState<string | null>(null);

  // Sync rows with initialRows when trips change (but only if no user changes)
  useEffect(() => {
    if (!hasChanges) {
      setRows(initialRows);
    }
  }, [initialRows, hasChanges]);

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

  // Calculate next available trip number (handles empty trips case)
  const getNextTripNumber = useCallback(() => {
    if (tripNumbers.length === 0) return 1;
    return Math.max(...tripNumbers) + 1;
  }, [tripNumbers]);

  // Handle trip number change
  const handleTripChange = useCallback((rowId: string, newTripNumber: number) => {
    // ตรวจสอบว่า trip ต้นทางหรือปลายทางมี picklist หรือไม่ (ยกเว้น metee)
    if (!isMetee) {
      const currentRow = rows.find(r => r.rowId === rowId);
      if (currentRow) {
        const sourceTripHasPicklist = tripPicklistMap.get(currentRow.tripNumber);
        const targetTripHasPicklist = tripPicklistMap.get(newTripNumber);
        
        if (sourceTripHasPicklist || targetTripHasPicklist) {
          setShowPicklistWarning(true);
          return;
        }
      }
    }

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
  }, [rows, tripPicklistMap]);

  // Handle stop sequence change - properly reorder all stops
  const handleSequenceChange = useCallback((rowId: string, newSequence: number) => {
    // ตรวจสอบว่า trip มี picklist หรือไม่ (ยกเว้น metee)
    if (!isMetee) {
      const currentRow = rows.find(r => r.rowId === rowId);
      if (currentRow && tripPicklistMap.get(currentRow.tripNumber)) {
        setShowPicklistWarning(true);
        return;
      }
    }

    setRows(prev => {
      // Find the row being moved
      const movingRow = prev.find(r => r.rowId === rowId);
      if (!movingRow) return prev;

      const oldSequence = movingRow.stopSequence;
      const tripNumber = movingRow.tripNumber;

      // If sequence didn't change, do nothing
      if (oldSequence === newSequence) return prev;

      // Get all rows in the same trip (excluding splits), sorted by sequence
      const tripRows = prev
        .filter(r => r.tripNumber === tripNumber && !r.isSplit)
        .sort((a, b) => a.stopSequence - b.stopSequence);

      // Create reordered array: remove the moving row and insert at new position
      const reordered = tripRows.filter(r => r.rowId !== rowId);
      const insertIndex = Math.max(0, Math.min(newSequence - 1, reordered.length));
      reordered.splice(insertIndex, 0, movingRow);

      // Create a map of rowId -> new sequence
      const newSequenceMap = new Map<string, number>();
      reordered.forEach((row, index) => {
        newSequenceMap.set(row.rowId, index + 1);
      });

      // Update all rows with new sequences
      return prev.map(row => {
        if (row.tripNumber === tripNumber && !row.isSplit) {
          const newSeq = newSequenceMap.get(row.rowId);
          if (newSeq !== undefined) {
            return { ...row, stopSequence: newSeq };
          }
        }
        return row;
      });
    });
    setHasChanges(true);
  }, []);

  // Open split modal
  const handleOpenSplit = useCallback((row: OrderRow) => {
    // ตรวจสอบว่า trip มี picklist หรือไม่ (ยกเว้น metee)
    if (!isMetee && tripPicklistMap.get(row.tripNumber)) {
      setShowPicklistWarning(true);
      return;
    }

    console.log('🔍 Opening split modal for row:', {
      orderId: row.orderId,
      orderNo: row.orderNo,
      items: row.items,
      itemsCount: row.items?.length || 0
    });
    // Initialize splitItems with 0 for each item
    const initialSplitItems: { [orderItemId: number]: number } = {};
    (row.items || []).forEach(item => {
      initialSplitItems[item.order_item_id] = 0;
    });
    setSplitModalData({
      row,
      splitWeight: '',
      targetTripNumber: tripNumbers[0] !== row.tripNumber ? tripNumbers[0] : (tripNumbers[1] || 'new'),
      splitItems: initialSplitItems
    });
    setShowSplitModal(true);
  }, [tripNumbers, tripPicklistMap]);

  // Handle split confirm
  const handleSplitConfirm = useCallback(() => {
    if (!splitModalData) return;
    
    const { row, splitWeight, targetTripNumber, splitItems } = splitModalData;
    const splitWeightNum = parseFloat(splitWeight);
    
    if (isNaN(splitWeightNum) || splitWeightNum <= 0 || splitWeightNum >= row.weightKg) {
      return;
    }

    // Calculate split items with their weights
    const splitItemsArray: { orderItemId: number; quantity: number; weightKg: number }[] = [];
    Object.entries(splitItems).forEach(([orderItemIdStr, qty]) => {
      if (qty > 0) {
        const orderItemId = parseInt(orderItemIdStr);
        const item = row.items.find(i => i.order_item_id === orderItemId);
        if (item) {
          const unitWeight = item.order_qty > 0 ? item.order_weight / item.order_qty : 0;
          splitItemsArray.push({
            orderItemId,
            quantity: qty,
            weightKg: qty * unitWeight
          });
        }
      }
    });
    
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
        actualTargetTrip = tripNumbers.length === 0 ? 1 : Math.max(...tripNumbers) + 1;
      }
      
      // Get max sequence in target trip
      const targetRows = updated.filter(r => r.tripNumber === actualTargetTrip);
      const maxSeq = Math.max(0, ...targetRows.map(r => r.stopSequence));
      
      // Calculate total quantity from split items
      const totalSplitQty = splitItemsArray.reduce((sum, item) => sum + item.quantity, 0);
      
      // Add new split row with splitItems data
      const newRow: OrderRow = {
        rowId: `${row.rowId}-split-${Date.now()}`,
        stopId: `new-${Date.now()}`,
        orderId: row.orderId,
        orderNo: `${row.orderNo}-S`,
        customerId: row.customerId,
        customerName: `${row.customerName} (แบ่ง)`,
        province: row.province,
        weightKg: splitWeightNum,
        totalQty: totalSplitQty,
        tripNumber: actualTargetTrip as number,
        stopSequence: maxSeq + 1,
        note: `แบ่งจาก ${row.orderNo}`,
        items: [], // Split row doesn't have items detail
        isSplit: true,
        splitFromOrderNo: row.orderNo,
        originalWeightKg: row.weightKg + splitWeightNum,
        splitItemsData: splitItemsArray // Store split items for API
      };
      
      return [...updated, newRow];
    });
    
    setShowSplitModal(false);
    setSplitModalData(null);
    setHasChanges(true);
  }, [splitModalData, tripNumbers]);

  // Add new trip
  const handleAddTrip = useCallback(() => {
    const newTripNumber = tripNumbers.length === 0 ? 1 : Math.max(...tripNumbers) + 1;
    // Just expand the new trip section - rows will be added when moving orders
    setExpandedTrips(prev => new Set([...prev, newTripNumber]));
  }, [tripNumbers]);

  // Filter draft orders ที่ยังไม่อยู่ในแผน
  const filteredDraftOrders = useMemo(() => {
    const existingOrderIds = new Set(rows.map(r => r.orderId));
    let filtered = draftOrders.filter(o => !existingOrderIds.has(o.order_id));
    
    if (addOrderSearch) {
      const searchLower = addOrderSearch.toLowerCase();
      filtered = filtered.filter(o => 
        o.order_no.toLowerCase().includes(searchLower) ||
        o.customer?.customer_name?.toLowerCase().includes(searchLower) ||
        o.customer?.customer_code?.toLowerCase().includes(searchLower) ||
        o.shop_name?.toLowerCase().includes(searchLower) ||
        o.province?.toLowerCase().includes(searchLower)
      );
    }
    
    return filtered;
  }, [draftOrders, rows, addOrderSearch]);

  // Handle add draft order to trip
  const handleAddDraftOrder = useCallback(async () => {
    if (!selectedDraftOrderId || !selectedTargetTripId) {
      setAddOrderError('กรุณาเลือกออเดอร์และเที่ยวรถ');
      return;
    }

    setIsAddingOrder(true);
    setAddOrderError(null);

    try {
      const response = await fetch(`/api/route-plans/${planId}/add-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: selectedDraftOrderId,
          tripId: selectedTargetTripId
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'เกิดข้อผิดพลาด');
      }

      // Reset selection
      setSelectedDraftOrderId(null);
      setSelectedTargetTripId(null);
      setAddOrderSearch('');

      // Refresh draft orders list
      if (onRefreshDraftOrders) {
        onRefreshDraftOrders();
      }

      // Trigger parent to refresh editor data
      // We need to call onSave with empty changes to trigger refresh
      await onSave({ moves: [], reorders: [], splits: [], newTrips: [], deletes: [] });

      alert(result.message || 'เพิ่มออเดอร์สำเร็จ');
    } catch (error: any) {
      console.error('Error adding order:', error);
      setAddOrderError(error.message || 'เกิดข้อผิดพลาดในการเพิ่มออเดอร์');
    } finally {
      setIsAddingOrder(false);
    }
  }, [selectedDraftOrderId, selectedTargetTripId, planId, onSave, onRefreshDraftOrders]);

  // Delete row (cancel stop)
  const handleDeleteRow = useCallback((rowId: string) => {
    // ตรวจสอบว่า trip มี picklist หรือไม่ (ยกเว้น metee)
    if (!isMetee) {
      const currentRow = rows.find(r => r.rowId === rowId);
      if (currentRow && tripPicklistMap.get(currentRow.tripNumber)) {
        setShowPicklistWarning(true);
        return;
      }
    }

    setRows(prev => prev.filter(r => r.rowId !== rowId));
    setHasChanges(true);
  }, [rows, tripPicklistMap]);

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
        newTrips: [],
        deletes: []
      };

      console.log('🔍 Detecting changes...', {
        rowsCount: rows.length,
        initialRowsCount: initialRows.length,
        tripNumbers: Array.from(tripNumbers),
        existingTripNumbers: Array.from(existingTripNumbers)
      });

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

      // ✅ Detect deleted rows (rows in initialRows but not in current rows)
      const currentRowIds = new Set(rows.map(r => r.rowId));
      initialRows.forEach(initialRow => {
        if (!currentRowIds.has(initialRow.rowId) && !initialRow.isSplit) {
          // This row was deleted
          const tripId = tripNumberToIdMap.get(initialRow.tripNumber);
          if (tripId && initialRow.stopId) {
            changes.deletes!.push({
              stopId: initialRow.stopId,
              orderId: initialRow.orderId,
              tripId: tripId
            });
          }
        }
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
            splitWeightKg: row.weightKg,
            splitItems: row.splitItemsData || []
          });
        }
      });
      
      // Detect reorders within same trip (only for existing trips)
      tripNumbers.forEach(tripNum => {
        // Skip new trips - they don't have existing stops to reorder
        if (!existingTripNumbers.has(tripNum)) return;
        
        const tripRows = rows.filter(r => r.tripNumber === tripNum && !r.isSplit);
        const initialTripRows = initialRows.filter(r => r.tripNumber === tripNum);
        
        // Sort both by sequence to compare actual order
        const sortedCurrent = [...tripRows].sort((a, b) => a.stopSequence - b.stopSequence);
        const sortedInitial = [...initialTripRows].sort((a, b) => a.stopSequence - b.stopSequence);
        
        // Check if order changed (compare sequence-sorted stop IDs)
        const currentOrder = sortedCurrent.map(r => r.stopId).join(',');
        const initialOrder = sortedInitial.map(r => r.stopId).join(',');
        
        console.log(`🔄 Trip ${tripNum} reorder check:`, {
          currentOrder,
          initialOrder,
          changed: currentOrder !== initialOrder,
          currentRows: sortedCurrent.map(r => ({ stopId: r.stopId, seq: r.stopSequence })),
          initialRows: sortedInitial.map(r => ({ stopId: r.stopId, seq: r.stopSequence }))
        });
        
        if (currentOrder !== initialOrder && tripRows.length > 0) {
          const tripId = tripNumberToIdMap.get(tripNum);
          
          if (tripId) {
            // Get unique stop IDs in new sequence order
            const uniqueStopIds = [...new Set(sortedCurrent.map(r => r.stopId))];
            
            changes.reorders.push({
              tripId: tripId,
              orderedStopIds: uniqueStopIds
            });
          }
        }
      });
      
      console.log('📤 Changes to save:', {
        moves: changes.moves.length,
        reorders: changes.reorders.length,
        splits: changes.splits.length,
        newTrips: changes.newTrips.length,
        deletes: changes.deletes?.length || 0,
        reordersDetail: changes.reorders
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
            disabled={loading || isSaving}
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
          <li>เพิ่มออเดอร์ร่าง: คลิกปุ่ม <Package size={12} className="inline" /> เพิ่มออเดอร์ร่าง แล้วเลือกออเดอร์และคันรถ</li>
        </ul>
      </div>

      {/* Trip Summaries + Add Order Panel */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex flex-wrap items-start gap-3">
          {/* Trip Cards */}
          <div className="flex flex-wrap gap-3 flex-1">
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

          {/* Add Order Toggle Button */}
          <button
            onClick={() => setShowAddOrderPanel(!showAddOrderPanel)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              showAddOrderPanel 
                ? 'bg-green-600 text-white' 
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            }`}
          >
            <Package size={16} />
            {showAddOrderPanel ? 'ซ่อนเพิ่มออเดอร์' : 'เพิ่มออเดอร์ร่าง'}
            {filteredDraftOrders.length > 0 && !showAddOrderPanel && (
              <span className="bg-green-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                {filteredDraftOrders.length}
              </span>
            )}
          </button>
        </div>

        {/* Add Order Panel (Collapsible) */}
        {showAddOrderPanel && (
          <div className="mt-4 bg-white border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                <Package className="w-4 h-4 text-green-600" />
                เพิ่มออเดอร์ร่างเข้าแผน
              </h4>
              {draftOrdersLoading && (
                <span className="text-xs text-gray-500">กำลังโหลด...</span>
              )}
            </div>

            {addOrderError && (
              <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                {addOrderError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Search & Select Order */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600">1. เลือกออเดอร์ร่าง</label>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="ค้นหาเลขออเดอร์, ชื่อร้าน, จังหวัด..."
                    className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    value={addOrderSearch}
                    onChange={(e) => setAddOrderSearch(e.target.value)}
                  />
                </div>
                <div className="max-h-40 overflow-y-auto border rounded-md">
                  {filteredDraftOrders.length === 0 ? (
                    <div className="p-3 text-center text-sm text-gray-500">
                      {draftOrdersLoading ? 'กำลังโหลด...' : 
                       addOrderSearch ? 'ไม่พบออเดอร์ที่ค้นหา' : 'ไม่มีออเดอร์ร่างที่พร้อมเพิ่ม'}
                    </div>
                  ) : (
                    filteredDraftOrders.map(order => (
                      <div
                        key={order.order_id}
                        className={`p-2 cursor-pointer border-b last:border-b-0 transition-colors ${
                          selectedDraftOrderId === order.order_id
                            ? 'bg-green-100 border-green-300'
                            : 'hover:bg-gray-50'
                        }`}
                        onClick={() => setSelectedDraftOrderId(order.order_id)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-green-700 font-mono">
                              {order.order_no}
                            </div>
                            <div className="text-xs text-gray-600 truncate">
                              {order.shop_name || order.customer?.customer_name || order.customer_id || '-'}
                            </div>
                            {order.province && (
                              <div className="text-xs text-blue-600">
                                {order.province}
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 text-right whitespace-nowrap ml-2">
                            {order.total_weight ? `${Number(order.total_weight).toFixed(1)} kg` : '-'}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Select Trip */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600">2. เลือกคันรถ (เพิ่มท้ายสุด)</label>
                <select
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={selectedTargetTripId || ''}
                  onChange={(e) => setSelectedTargetTripId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">-- เลือกคันรถ --</option>
                  {trips.map((trip, idx) => {
                    const tripNum = trip.daily_trip_number || trip.trip_sequence || idx + 1;
                    const summary = tripSummaries.find(s => s.tripNumber === tripNum);
                    return (
                      <option key={trip.trip_id} value={trip.trip_id}>
                        คันที่ {tripNum} ({summary?.totalStops || 0} จุด, {summary?.totalWeight?.toFixed(1) || 0} kg)
                      </option>
                    );
                  })}
                </select>

                {selectedDraftOrderId && selectedTargetTripId && (
                  <div className="p-2 bg-green-50 rounded-md text-xs">
                    <div className="font-medium text-green-800">สรุป:</div>
                    <div className="text-green-700">
                      เพิ่ม <span className="font-mono font-semibold">
                        {filteredDraftOrders.find(o => o.order_id === selectedDraftOrderId)?.order_no}
                      </span> เข้าคันที่ {
                        trips.find(t => t.trip_id === selectedTargetTripId)?.daily_trip_number || 
                        trips.findIndex(t => t.trip_id === selectedTargetTripId) + 1
                      } (จุดท้ายสุด)
                    </div>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600">3. ยืนยัน</label>
                <Button
                  variant="primary"
                  size="sm"
                  icon={Plus}
                  onClick={handleAddDraftOrder}
                  disabled={!selectedDraftOrderId || !selectedTargetTripId || isAddingOrder}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {isAddingOrder ? 'กำลังเพิ่ม...' : 'เพิ่มออเดอร์เข้าแผน'}
                </Button>
                <p className="text-xs text-gray-500">
                  ออเดอร์จะถูกเพิ่มเป็นจุดส่งท้ายสุดของคันที่เลือก และสถานะจะเปลี่ยนเป็น "ยืนยันแล้ว"
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-4">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-gray-100 sticky top-0">
            <tr>
              <th className="border px-2 py-2 text-left w-24">คัน</th>
              <th className="border px-2 py-2 text-left w-20">จุด</th>
              <th className="border px-2 py-2 text-left w-32">เลขออเดอร์</th>
              <th className="border px-2 py-2 text-left w-28">รหัสลูกค้า</th>
              <th className="border px-2 py-2 text-left min-w-[150px]">ชื่อร้าน</th>
              <th className="border px-2 py-2 text-left w-28">จังหวัด</th>
              <th className="border px-2 py-2 text-right w-24">น้ำหนัก (kg)</th>
              <th className="border px-2 py-2 text-right w-20">จำนวน</th>
              <th className="border px-2 py-2 text-left min-w-[100px]">หมายเหตุ</th>
              <th className="border px-2 py-2 text-center w-28">จัดการ</th>
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
                    className={`cursor-pointer hover:bg-blue-200 ${tripPicklistMap.get(tripNum) ? 'bg-yellow-100' : 'bg-blue-100'}`}
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
                          {tripPicklistMap.get(tripNum) && (
                            <span className="text-xs bg-yellow-500 text-white px-2 py-0.5 rounded-full font-medium">
                              🔒 มี PL แล้ว
                            </span>
                          )}
                        </div>
                        <span className="font-semibold">
                          {summary?.totalWeight.toFixed(1) || 0} kg
                        </span>
                      </div>
                    </td>
                  </tr>
                  
                  {/* Trip rows */}
                  {isExpanded && tripRows.map(row => {
                    const rowTripHasPicklist = tripPicklistMap.get(row.tripNumber);
                    return (
                    <tr 
                      key={row.rowId}
                      className={`hover:bg-gray-50 ${row.isSplit ? 'bg-yellow-50' : ''} ${rowTripHasPicklist ? 'bg-yellow-50/50' : ''}`}
                    >
                      <td className="border px-2 py-1">
                        <select
                          value={row.tripNumber}
                          onChange={(e) => handleTripChange(row.rowId, parseInt(e.target.value))}
                          className={`w-full border rounded px-2 py-1 text-sm ${rowTripHasPicklist ? 'bg-gray-100 cursor-not-allowed opacity-60' : ''}`}
                          disabled={rowTripHasPicklist}
                        >
                          {tripNumbers.map(n => (
                            <option key={n} value={n}>คัน {n}</option>
                          ))}
                          <option value={tripNumbers.length === 0 ? 1 : Math.max(...tripNumbers) + 1}>+ คันใหม่</option>
                        </select>
                      </td>
                      <td className="border px-2 py-1">
                        <select
                          value={row.stopSequence}
                          onChange={(e) => handleSequenceChange(row.rowId, parseInt(e.target.value))}
                          className={`w-full border rounded px-2 py-1 text-sm ${rowTripHasPicklist ? 'bg-gray-100 cursor-not-allowed opacity-60' : ''}`}
                          disabled={rowTripHasPicklist}
                        >
                          {getAvailableSequences(row.tripNumber).map(seq => (
                            <option key={seq} value={seq}>{seq}</option>
                          ))}
                        </select>
                      </td>
                      <td className="border px-3 py-1 font-mono text-blue-600">
                        <div className="flex items-center gap-2">
                          <span>{row.orderNo}</span>
                          {row.isSplit && (
                            <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">แบ่ง</span>
                          )}
                          {(() => {
                            // Check if this order is part of a consolidated stop
                            const sameStopOrders = rows.filter(r => 
                              r.stopId === row.stopId && 
                              r.tripNumber === row.tripNumber &&
                              !r.isSplit
                            );
                            if (sameStopOrders.length > 1) {
                              return (
                                <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                                  รวม {sameStopOrders.length}
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>
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
                          {!row.isSplit && onCrossPlanTransfer && (
                            <button
                              onClick={() => onCrossPlanTransfer(row, tripNumberToIdMap.get(row.tripNumber) || row.tripNumber)}
                              className="p-1 text-purple-600 hover:bg-purple-100 rounded"
                              title="ย้ายไปแผนอื่น"
                            >
                              <ExternalLink size={14} />
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
                  );
                  })}
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
                  เลือกจำนวนชิ้นที่ต้องการย้าย ({splitModalData.row.items.length} รายการ)
                </label>
                <div className="max-h-64 overflow-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="px-2 py-1 text-left">SKU</th>
                        <th className="px-2 py-1 text-left">ชื่อสินค้า</th>
                        <th className="px-2 py-1 text-right">คงเหลือ</th>
                        <th className="px-2 py-1 text-right">ย้าย (ชิ้น)</th>
                        <th className="px-2 py-1 text-center"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {splitModalData.row.items.map((item, idx) => {
                        const selectedQty = splitModalData.splitItems[item.order_item_id] || 0;
                        return (
                          <tr key={item.order_item_id || idx} className="border-t hover:bg-gray-50">
                            <td className="px-2 py-1 font-mono text-xs">{item.sku_id}</td>
                            <td className="px-2 py-1 text-xs truncate max-w-[120px]" title={item.sku_name || '-'}>{item.sku_name || '-'}</td>
                            <td className="px-2 py-1 text-right font-mono font-medium">{item.order_qty}</td>
                            <td className="px-2 py-1 text-right">
                              <input
                                type="number"
                                min={0}
                                max={item.order_qty}
                                step={1}
                                value={selectedQty || ''}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 0;
                                  const clamped = Math.max(0, Math.min(item.order_qty, val));
                                  setSplitModalData(prev => {
                                    if (!prev) return null;
                                    const newSplitItems = { ...prev.splitItems, [item.order_item_id]: clamped };
                                    // คำนวณน้ำหนักรวมจากจำนวนชิ้นที่เลือก
                                    let totalWeight = 0;
                                    prev.row.items.forEach(it => {
                                      const qty = newSplitItems[it.order_item_id] || 0;
                                      const unitWeight = it.order_qty > 0 ? it.order_weight / it.order_qty : 0;
                                      totalWeight += qty * unitWeight;
                                    });
                                    return { ...prev, splitItems: newSplitItems, splitWeight: totalWeight.toFixed(2) };
                                  });
                                }}
                                className="w-16 border rounded px-2 py-1 text-right text-sm focus:ring-2 focus:ring-blue-500"
                                placeholder="0"
                              />
                            </td>
                            <td className="px-2 py-1 text-center">
                              <button
                                type="button"
                                className="text-xs text-blue-600 hover:underline"
                                onClick={() => {
                                  setSplitModalData(prev => {
                                    if (!prev) return null;
                                    const newSplitItems = { ...prev.splitItems, [item.order_item_id]: item.order_qty };
                                    // คำนวณน้ำหนักรวมจากจำนวนชิ้นที่เลือก
                                    let totalWeight = 0;
                                    prev.row.items.forEach(it => {
                                      const qty = newSplitItems[it.order_item_id] || 0;
                                      const unitWeight = it.order_qty > 0 ? it.order_weight / it.order_qty : 0;
                                      totalWeight += qty * unitWeight;
                                    });
                                    return { ...prev, splitItems: newSplitItems, splitWeight: totalWeight.toFixed(2) };
                                  });
                                }}
                              >
                                ทั้งหมด
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500 italic">ไม่พบรายการสินค้าในออเดอร์นี้</div>
            )}
            
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
                  {(() => {
                    const totalSelectedQty = Object.values(splitModalData.splitItems).reduce((sum, qty) => sum + qty, 0);
                    const totalQty = splitModalData.row.items.reduce((sum, item) => sum + item.order_qty, 0);
                    return `${totalQty - totalSelectedQty} ชิ้น`;
                  })()}
                </div>
                <div className="text-xs text-gray-500">
                  {(splitModalData.row.weightKg - (parseFloat(splitModalData.splitWeight) || 0)).toFixed(2)} kg
                </div>
              </div>
              <ArrowRight size={20} className="text-gray-400" />
              <div>
                <div className="text-gray-600">ย้ายไปคันใหม่:</div>
                <div className="font-semibold text-blue-600">
                  {Object.values(splitModalData.splitItems).reduce((sum, qty) => sum + qty, 0)} ชิ้น
                </div>
                <div className="text-xs text-gray-500">
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
                disabled={(() => {
                  const totalSelectedQty = Object.values(splitModalData.splitItems).reduce((sum, qty) => sum + qty, 0);
                  const totalQty = splitModalData.row.items.reduce((sum, item) => sum + item.order_qty, 0);
                  return totalSelectedQty <= 0 || totalSelectedQty >= totalQty;
                })()}
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

      {/* Picklist Warning Modal */}
      <Modal
        isOpen={showPicklistWarning}
        onClose={() => setShowPicklistWarning(false)}
        title="ไม่สามารถแก้ไขได้"
        size="md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-yellow-800">
                คันรถนี้มีใบ Picklist แล้ว
              </p>
              <p className="text-sm text-yellow-700 mt-1">
                ไม่สามารถย้ายจุดส่ง, เปลี่ยนลำดับ, แบ่งออเดอร์ หรือลบจุดส่งได้
              </p>
            </div>
          </div>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>ต้องการแก้ไขเส้นทางขนส่ง?</strong>
            </p>
            <p className="text-sm text-blue-700 mt-1">
              หลังสร้างใบ PL แล้ว ต้องแจ้ง<strong>พี่โย</strong>ให้ช่วยแก้ไขนะจ๊ะ 😊
            </p>
          </div>

          {/* แสดงรายการ trips ที่มี picklist */}
          {tripsWithPicklist.length > 0 && (
            <div className="text-sm">
              <p className="font-medium text-gray-700 mb-2">คันรถที่มี Picklist:</p>
              <ul className="space-y-1">
                {tripsWithPicklist.map((trip: any, idx: number) => {
                  const tripNum = trip.daily_trip_number || trip.trip_sequence || idx + 1;
                  return (
                    <li key={trip.trip_id} className="flex items-center gap-2 text-gray-600">
                      <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                      คันที่ {tripNum}
                      {trip.picklist_codes?.length > 0 && (
                        <span className="text-xs text-gray-500">
                          (PL: {trip.picklist_codes.join(', ')})
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="primary" onClick={() => setShowPicklistWarning(false)}>
              เข้าใจแล้ว
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
