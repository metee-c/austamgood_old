# ภารกิจ: Phase 7 - รวมใบว่าจ้างข้ามแผน + ทดสอบ Features

## ⛔ กฎเหล็ก - ห้ามละเมิดเด็ดขาด

1. **ห้าม** แก้ไข Business Logic ที่ทำงานอยู่แล้ว
2. **ห้าม** เปลี่ยน API Response Format ที่มีอยู่
3. **ห้าม** เปลี่ยน Database Schema ที่มีอยู่ (เพิ่มใหม่ได้)
4. **ต้อง** Test ทุกครั้งหลังแก้ไข
5. **ต้อง** ทำทีละ Task ห้ามรวบ

---

## 🎯 เป้าหมาย

### Part A: Phase 7 - รวมใบว่าจ้างข้ามแผน
1. สร้าง API `GET /api/route-plans/trips-by-supplier`
2. สร้าง `MultiPlanContractModal` component
3. ทดสอบการรวมใบว่าจ้าง

### Part B: ทดสอบ Features ที่เสร็จแล้ว
1. ทดสอบย้ายออเดอร์ข้ามแผน
2. ทดสอบตารางค่าขนส่ง
3. ทดสอบ Export Excel
4. ทดสอบ Error Handling
5. ทดสอบ Confirmation Dialog

---

## Part A: Phase 7 - รวมใบว่าจ้างข้ามแผน

### Task A1: สร้าง API trips-by-supplier

**ไฟล์:** `app/api/route-plans/trips-by-supplier/route.ts`
```typescript
// app/api/route-plans/trips-by-supplier/route.ts

import { withAuth } from '@/lib/api/with-auth';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

async function handleGet(request: NextRequest, context: any) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  
  const supplierId = searchParams.get('supplier_id');
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');
  const status = searchParams.get('status'); // optional: filter by plan status

  // Validation
  if (!supplierId) {
    return NextResponse.json(
      { error: 'กรุณาระบุ supplier_id', error_code: 'MISSING_SUPPLIER' },
      { status: 400 }
    );
  }

  try {
    // Build query
    let query = supabase
      .from('receiving_route_trips')
      .select(`
        trip_id,
        trip_sequence,
        daily_trip_number,
        trip_code,
        trip_status,
        supplier_id,
        total_stops,
        total_weight_kg,
        total_distance_km,
        shipping_cost,
        base_price,
        helper_fee,
        extra_stop_fee,
        porterage_fee,
        other_fees,
        plan:receiving_route_plans!inner (
          plan_id,
          plan_code,
          plan_name,
          plan_date,
          status,
          warehouse_id
        ),
        supplier:master_supplier (
          supplier_id,
          supplier_name
        ),
        stops:receiving_route_stops (
          stop_id,
          sequence_no,
          stop_name,
          address,
          order_id,
          load_weight_kg,
          load_units,
          customer_id
        )
      `)
      .eq('supplier_id', supplierId);

    // Filter by date range
    if (startDate) {
      query = query.gte('plan.plan_date', startDate);
    }
    if (endDate) {
      query = query.lte('plan.plan_date', endDate);
    }

    // Filter by plan status (default: published, pending_approval, approved)
    if (status) {
      const statuses = status.split(',');
      query = query.in('plan.status', statuses);
    } else {
      query = query.in('plan.status', ['published', 'pending_approval', 'approved']);
    }

    // Order by date
    query = query.order('plan.plan_date', { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error('[trips-by-supplier] Query error:', error);
      return NextResponse.json(
        { error: 'ไม่สามารถดึงข้อมูลได้', error_code: 'QUERY_ERROR' },
        { status: 500 }
      );
    }

    // Group by plan for easier frontend processing
    const groupedByPlan = data?.reduce((acc: any, trip: any) => {
      const planId = trip.plan?.plan_id;
      if (!planId) return acc;
      
      if (!acc[planId]) {
        acc[planId] = {
          plan: trip.plan,
          trips: []
        };
      }
      acc[planId].trips.push({
        ...trip,
        plan: undefined // Remove nested plan to avoid duplication
      });
      return acc;
    }, {});

    // Calculate summary
    const summary = {
      total_trips: data?.length || 0,
      total_stops: data?.reduce((sum: number, t: any) => sum + (t.total_stops || 0), 0) || 0,
      total_weight_kg: data?.reduce((sum: number, t: any) => sum + (t.total_weight_kg || 0), 0) || 0,
      total_shipping_cost: data?.reduce((sum: number, t: any) => sum + (t.shipping_cost || 0), 0) || 0,
      plans_count: Object.keys(groupedByPlan || {}).length
    };

    return NextResponse.json({
      success: true,
      data: data || [],
      grouped: groupedByPlan || {},
      summary
    });

  } catch (err) {
    console.error('[trips-by-supplier] Error:', err);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ', error_code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(handleGet);
```

---

### Task A2: สร้าง MultiPlanContractModal Component

**ไฟล์:** `app/receiving/routes/components/MultiPlanContractModal.tsx`
```typescript
// app/receiving/routes/components/MultiPlanContractModal.tsx

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, Search, Printer, FileSpreadsheet, Loader2, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDateThai, formatWeight, formatCurrency } from '../utils';
import { handleApiError, getErrorMessage, ApiError } from '../utils/errorHandler';

interface Trip {
  trip_id: number;
  trip_sequence: number;
  daily_trip_number?: number;
  trip_code?: string;
  trip_status: string;
  supplier_id: string;
  total_stops: number;
  total_weight_kg: number;
  total_distance_km?: number;
  shipping_cost?: number;
  base_price?: number;
  helper_fee?: number;
  extra_stop_fee?: number;
  porterage_fee?: number;
  other_fees?: any;
  plan?: {
    plan_id: number;
    plan_code: string;
    plan_name?: string;
    plan_date: string;
    status: string;
  };
  supplier?: {
    supplier_id: string;
    supplier_name: string;
  };
  stops?: any[];
}

interface Supplier {
  supplier_id: string;
  supplier_name: string;
  supplier_type?: string;
}

interface Summary {
  total_trips: number;
  total_stops: number;
  total_weight_kg: number;
  total_shipping_cost: number;
  plans_count: number;
}

interface MultiPlanContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerateContract: (selectedTrips: Trip[]) => void;
  onExportExcel?: (selectedTrips: Trip[], includePrice: boolean) => void;
}

export function MultiPlanContractModal({
  isOpen,
  onClose,
  onGenerateContract,
  onExportExcel
}: MultiPlanContractModalProps) {
  // State
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTripIds, setSelectedTripIds] = useState<Set<number>>(new Set());
  const [summary, setSummary] = useState<Summary | null>(null);
  
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  // Set default date range (last 7 days to today)
  useEffect(() => {
    if (isOpen) {
      const today = new Date();
      const lastWeek = new Date(today);
      lastWeek.setDate(lastWeek.getDate() - 7);
      
      setEndDate(today.toISOString().split('T')[0]);
      setStartDate(lastWeek.toISOString().split('T')[0]);
      
      fetchSuppliers();
    }
  }, [isOpen]);

  // Fetch suppliers (transport type)
  const fetchSuppliers = async () => {
    setLoadingSuppliers(true);
    setError(null);
    
    try {
      const response = await fetch('/api/suppliers?type=transport');
      
      if (!response.ok) {
        throw { response: { data: await response.json() } };
      }
      
      const data = await response.json();
      setSuppliers(Array.isArray(data) ? data : data.data || []);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoadingSuppliers(false);
    }
  };

  // Fetch trips by supplier
  const fetchTrips = useCallback(async () => {
    if (!selectedSupplierId) return;
    
    setLoadingTrips(true);
    setError(null);
    setTrips([]);
    setSelectedTripIds(new Set());
    
    try {
      const params = new URLSearchParams({
        supplier_id: selectedSupplierId,
      });
      
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      
      const response = await fetch(`/api/route-plans/trips-by-supplier?${params}`);
      
      if (!response.ok) {
        throw { response: { data: await response.json() } };
      }
      
      const result = await response.json();
      setTrips(result.data || []);
      setSummary(result.summary || null);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoadingTrips(false);
    }
  }, [selectedSupplierId, startDate, endDate]);

  // Handle search
  const handleSearch = () => {
    if (!selectedSupplierId) {
      setError({ message: 'กรุณาเลือกขนส่งก่อน', code: 'VALIDATION' });
      return;
    }
    fetchTrips();
  };

  // Toggle trip selection
  const handleToggleTrip = (tripId: number) => {
    setSelectedTripIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tripId)) {
        newSet.delete(tripId);
      } else {
        newSet.add(tripId);
      }
      return newSet;
    });
  };

  // Select all / Deselect all
  const handleSelectAll = () => {
    if (selectedTripIds.size === trips.length) {
      setSelectedTripIds(new Set());
    } else {
      setSelectedTripIds(new Set(trips.map(t => t.trip_id)));
    }
  };

  // Get selected trips
  const getSelectedTrips = (): Trip[] => {
    return trips.filter(t => selectedTripIds.has(t.trip_id));
  };

  // Calculate selected summary
  const getSelectedSummary = () => {
    const selected = getSelectedTrips();
    return {
      count: selected.length,
      stops: selected.reduce((sum, t) => sum + (t.total_stops || 0), 0),
      weight: selected.reduce((sum, t) => sum + (t.total_weight_kg || 0), 0),
      cost: selected.reduce((sum, t) => sum + (t.shipping_cost || 0), 0),
    };
  };

  // Handle generate contract
  const handleGenerateContract = () => {
    const selectedTrips = getSelectedTrips();
    if (selectedTrips.length === 0) {
      setError({ message: 'กรุณาเลือกอย่างน้อย 1 คัน', code: 'VALIDATION' });
      return;
    }
    onGenerateContract(selectedTrips);
  };

  // Handle export
  const handleExport = (includePrice: boolean) => {
    const selectedTrips = getSelectedTrips();
    if (selectedTrips.length === 0) {
      setError({ message: 'กรุณาเลือกอย่างน้อย 1 คัน', code: 'VALIDATION' });
      return;
    }
    onExportExcel?.(selectedTrips, includePrice);
  };

  // Reset state when closing
  const handleClose = () => {
    setSelectedSupplierId('');
    setTrips([]);
    setSelectedTripIds(new Set());
    setSummary(null);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  const selectedSummary = getSelectedSummary();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">รวมใบว่าจ้างข้ามแผน</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Error Alert */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
              <div className="ml-3 flex-1">
                <p className="text-sm text-red-700">{getErrorMessage(error)}</p>
              </div>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Filters */}
          <div className="grid grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg">
            {/* Supplier Select */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ขนส่ง <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={loadingSuppliers}
              >
                <option value="">-- เลือกขนส่ง --</option>
                {suppliers.map(s => (
                  <option key={s.supplier_id} value={s.supplier_id}>
                    {s.supplier_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                จากวันที่
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ถึงวันที่
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Search Button */}
            <div className="flex items-end">
              <Button
                onClick={handleSearch}
                disabled={!selectedSupplierId || loadingTrips}
                className="w-full"
              >
                {loadingTrips ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    กำลังค้นหา...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    ค้นหา
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Summary */}
          {summary && trips.length > 0 && (
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-blue-50 p-3 rounded-lg text-center">
                <p className="text-2xl font-bold text-blue-600">{summary.total_trips}</p>
                <p className="text-sm text-blue-600">คันทั้งหมด</p>
              </div>
              <div className="bg-green-50 p-3 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-600">{summary.total_stops}</p>
                <p className="text-sm text-green-600">จุดส่งทั้งหมด</p>
              </div>
              <div className="bg-orange-50 p-3 rounded-lg text-center">
                <p className="text-2xl font-bold text-orange-600">{formatWeight(summary.total_weight_kg)}</p>
                <p className="text-sm text-orange-600">น้ำหนักรวม</p>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg text-center">
                <p className="text-2xl font-bold text-purple-600">{formatCurrency(summary.total_shipping_cost)}</p>
                <p className="text-sm text-purple-600">ค่าขนส่งรวม</p>
              </div>
            </div>
          )}

          {/* Trip List */}
          {trips.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedTripIds.size === trips.length && trips.length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">แผน</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">วันที่</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">คัน</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">จุดส่ง</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">น้ำหนัก (กก.)</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">ค่าขนส่ง</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {trips.map(trip => (
                    <tr
                      key={trip.trip_id}
                      className={`hover:bg-gray-50 cursor-pointer ${
                        selectedTripIds.has(trip.trip_id) ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => handleToggleTrip(trip.trip_id)}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedTripIds.has(trip.trip_id)}
                          onChange={() => handleToggleTrip(trip.trip_id)}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm">{trip.plan?.plan_code}</td>
                      <td className="px-4 py-3 text-sm">
                        {trip.plan?.plan_date ? formatDateThai(trip.plan.plan_date) : '-'}
                      </td>
                      <td className="px-4 py-3 text-center text-sm font-medium">
                        {trip.daily_trip_number || trip.trip_sequence}
                      </td>
                      <td className="px-4 py-3 text-center text-sm">{trip.total_stops}</td>
                      <td className="px-4 py-3 text-right text-sm">
                        {trip.total_weight_kg?.toFixed(0) || '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-sm">
                        {trip.shipping_cost ? formatCurrency(trip.shipping_cost) : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                          trip.plan?.status === 'published' ? 'bg-green-100 text-green-700' :
                          trip.plan?.status === 'pending_approval' ? 'bg-yellow-100 text-yellow-700' :
                          trip.plan?.status === 'approved' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {trip.plan?.status || '-'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Empty State */}
          {!loadingTrips && trips.length === 0 && selectedSupplierId && (
            <div className="text-center py-8 text-gray-500">
              <Search className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>ไม่พบข้อมูลเที่ยวรถที่ตรงเงื่อนไข</p>
              <p className="text-sm">กรุณาเลือกขนส่งหรือเปลี่ยนช่วงวันที่แล้วกดค้นหา</p>
            </div>
          )}

          {/* Initial State */}
          {!selectedSupplierId && trips.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Printer className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>เลือกขนส่งและกดค้นหาเพื่อดูรายการเที่ยวรถ</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4">
          {/* Selected Summary */}
          {selectedTripIds.size > 0 && (
            <div className="bg-blue-50 p-3 rounded-lg mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Check className="h-5 w-5 text-blue-600 mr-2" />
                  <span className="font-medium text-blue-800">
                    เลือก {selectedSummary.count} คัน
                  </span>
                </div>
                <div className="flex gap-4 text-sm text-blue-600">
                  <span>{selectedSummary.stops} จุดส่ง</span>
                  <span>{formatWeight(selectedSummary.weight)}</span>
                  <span className="font-medium">{formatCurrency(selectedSummary.cost)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between">
            <div className="flex gap-2">
              {onExportExcel && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => handleExport(true)}
                    disabled={selectedTripIds.size === 0}
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Export (มีราคา)
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleExport(false)}
                    disabled={selectedTripIds.size === 0}
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Export (ไม่มีราคา)
                  </Button>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose}>
                ยกเลิก
              </Button>
              <Button
                onClick={handleGenerateContract}
                disabled={selectedTripIds.size === 0}
              >
                <Printer className="h-4 w-4 mr-2" />
                สร้างใบว่าจ้าง ({selectedTripIds.size} คัน)
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

### Task A3: อัพเดท components/index.ts
```typescript
// app/receiving/routes/components/index.ts

export { MetricCard } from './MetricCard';
export { SplitStopModal } from './SplitStopModal';
export { ErrorAlert } from './ErrorAlert';
export { LoadingOverlay } from './LoadingOverlay';
export { ConfirmDialog } from './ConfirmDialog';
export { CrossPlanTransferModal } from './CrossPlanTransferModal';
export { ShippingCostTable } from './ShippingCostTable';
export { MultiPlanContractModal } from './MultiPlanContractModal'; // เพิ่มใหม่
```

---

### Task A4: เพิ่มปุ่มใน page.tsx

เพิ่มปุ่ม "รวมใบว่าจ้างข้ามแผน" ในหน้าหลัก:
```typescript
// ใน page.tsx - เพิ่ม state
const [showMultiPlanContractModal, setShowMultiPlanContractModal] = useState(false);

// เพิ่ม handler
const handleGenerateMultiPlanContract = (selectedTrips: Trip[]) => {
  // TODO: เปิด TransportContractModal พร้อมข้อมูล trips ที่เลือก
  console.log('Generate contract for trips:', selectedTrips);
  setShowMultiPlanContractModal(false);
  // หรือเปิด Print Modal
};

const handleMultiPlanExport = async (selectedTrips: Trip[], includePrice: boolean) => {
  // Export Excel
  await exportRoutePlanSummary(
    0, // multi-plan
    'MULTI-PLAN',
    selectedTrips,
    { includePrice, format: 'simple' }
  );
};

// เพิ่มปุ่มใน UI (ใกล้ๆ ปุ่ม "สร้างแผนใหม่")
<Button
  variant="outline"
  onClick={() => setShowMultiPlanContractModal(true)}
>
  <FileText className="h-4 w-4 mr-2" />
  รวมใบว่าจ้างข้ามแผน
</Button>

// เพิ่ม Modal
<MultiPlanContractModal
  isOpen={showMultiPlanContractModal}
  onClose={() => setShowMultiPlanContractModal(false)}
  onGenerateContract={handleGenerateMultiPlanContract}
  onExportExcel={handleMultiPlanExport}
/>
```

---

## Part B: ทดสอบ Features

### Test Checklist

#### B1: ทดสอบย้ายออเดอร์ข้ามแผน
```
□ เปิด Editor Mode ของแผนที่ publish แล้ว
□ เลือกจุดส่งที่ต้องการย้าย
□ กดปุ่ม "ย้ายไปแผนอื่น"
□ เลือกแผนปลายทาง
□ เลือกคันปลายทาง
□ กำหนดลำดับจุดส่ง
□ กดยืนยัน
□ ตรวจสอบว่าจุดส่งหายจากแผนเดิม
□ ตรวจสอบว่าจุดส่งเพิ่มในแผนใหม่
□ ตรวจสอบ log ใน receiving_cross_plan_transfers
```

#### B2: ทดสอบตารางค่าขนส่ง
```
□ เปิดหน้าแก้ไขค่าขนส่ง
□ ตรวจสอบว่าแสดงเป็นตาราง
□ แก้ไขราคาฐาน → ตรวจสอบรวมเปลี่ยน
□ แก้ไขค่าคนช่วย → ตรวจสอบรวมเปลี่ยน
□ แก้ไขค่าจุดเพิ่ม → ตรวจสอบรวมเปลี่ยน
□ แก้ไขค่าขนของ → ตรวจสอบรวมเปลี่ยน
□ แก้ไขอื่นๆ → ตรวจสอบรวมเปลี่ยน
□ ตรวจสอบ Summary Row ถูกต้อง
□ บันทึก → ตรวจสอบค่าบันทึกถูกต้อง
```

#### B3: ทดสอบ Export Excel
```
□ เลือกแผนที่มีข้อมูล
□ กด Export Excel (มีราคา)
□ ตรวจสอบไฟล์ที่ได้:
  - มีคอลัมน์ราคา
  - ข้อมูลถูกต้อง
□ กด Export Excel (ไม่มีราคา)
□ ตรวจสอบไฟล์ที่ได้:
  - ไม่มีคอลัมน์ราคา
  - ข้อมูลถูกต้อง
□ ตรวจสอบแต่ละ sheet (แยกตามคัน)
```

#### B4: ทดสอบ Error Handling
```
□ ปิด Network → เรียก API → ตรวจสอบแสดง Error
□ กดปุ่ม "ลองใหม่" → ตรวจสอบเรียก API ใหม่
□ กดปุ่ม "ปิด" → Error หายไป
□ ทดสอบ Error ต่างๆ:
  - 401 Unauthorized
  - 403 Forbidden
  - 404 Not Found
  - 500 Server Error
```

#### B5: ทดสอบ Confirmation Dialog
```
□ กด "ยกเลิกจุดส่ง" → แสดง Confirm Dialog
□ กด "ยกเลิก" → Dialog ปิด, ไม่ทำอะไร
□ กด "ยืนยัน" → ทำงานตามที่ควร
□ ตรวจสอบ Loading State ขณะดำเนินการ
□ ตรวจสอบ Dialog ปิดหลังเสร็จ
```

#### B6: ทดสอบรวมใบว่าจ้างข้ามแผน (Phase 7)
```
□ กดปุ่ม "รวมใบว่าจ้างข้ามแผน"
□ เลือกขนส่ง
□ เลือกช่วงวันที่
□ กดค้นหา
□ ตรวจสอบรายการที่แสดง
□ เลือก/ยกเลิกเลือก trips
□ เลือกทั้งหมด/ยกเลิกทั้งหมด
□ ตรวจสอบ Summary ที่เลือก
□ กด Export (มีราคา) → ตรวจสอบไฟล์
□ กด Export (ไม่มีราคา) → ตรวจสอบไฟล์
□ กดสร้างใบว่าจ้าง → (ถ้ามี handler)
```

---

## Checklist รวม

### Part A: สร้าง Features
```
□ A1: สร้าง API trips-by-supplier
□ A2: สร้าง MultiPlanContractModal
□ A3: อัพเดท components/index.ts
□ A4: เพิ่มปุ่มใน page.tsx
□ Build ผ่าน
```

### Part B: ทดสอบ
```
□ B1: ทดสอบย้ายออเดอร์ข้ามแผน
□ B2: ทดสอบตารางค่าขนส่ง
□ B3: ทดสอบ Export Excel
□ B4: ทดสอบ Error Handling
□ B5: ทดสอบ Confirmation Dialog
□ B6: ทดสอบรวมใบว่าจ้างข้ามแผน
```

### Final Check
```
□ Logic เดิมทั้งหมดยังทำงานได้
□ สร้างแผนใหม่ได้
□ VRP ทำงานได้
□ Preview ได้
□ Editor Mode ทำงานได้
□ พิมพ์ใบว่าจ้างได้ (แบบเดิม)
□ **ไม่มี Regression**
```

---

เริ่มทำได้เลยครับ ทำทีละ Task
**รายงานผลทุกขั้นตอน!**