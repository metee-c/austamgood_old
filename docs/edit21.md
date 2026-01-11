# ภารกิจ: ปรับปรุงหน้าจัดสาย (Routes) ทั้งหมด

## ⛔ กฎเหล็ก - ห้ามละเมิดเด็ดขาด

1. **ห้าม** แก้ไข Business Logic ที่ทำงานอยู่แล้ว
2. **ห้าม** เปลี่ยน API Response Format
3. **ห้าม** เปลี่ยน Database Schema (ยกเว้นเพิ่ม columns/tables ใหม่)
4. **ห้าม** เปลี่ยนชื่อ function/variable ที่ถูกเรียกใช้จากที่อื่น
5. **ต้อง** Test ทุกครั้งหลังแก้ไข
6. **ต้อง** ทำทีละ Phase ห้ามรวบ
7. **ต้อง** Backup ก่อนแก้ไขทุกไฟล์

---

## 🎯 เป้าหมาย

| # | งาน | ระดับ |
|---|-----|-------|
| 1 | Refactor page.tsx (2,170 บรรทัด) | ⚠️ Medium |
| 2 | เพิ่ม Error Handling | ⚠️ Medium |
| 3 | เพิ่ม Loading States | 🟡 Low |
| 4 | เพิ่ม Confirmation Dialog | 🟡 Low |
| 5 | Feature: ย้าย/แบ่งออเดอร์ข้ามแผน | ✨ New |
| 6 | ปรับ UI ค่าขนส่งเป็นตาราง | 🔧 UI |
| 7 | รวมใบว่าจ้างข้ามแผน | ✨ New |
| 8 | Export Excel ไม่มีราคา | ✨ New |

---

## Phase 1: Refactor page.tsx (ไม่แก้ Logic)

### 1.1 แผนการแยกไฟล์
```
app/receiving/routes/
├── page.tsx                    # หน้าหลัก (ลดเหลือ ~500 บรรทัด)
├── components/
│   ├── RoutesList.tsx          # ตารางรายการแผน
│   ├── CreatePlanModal.tsx     # Modal สร้างแผนใหม่
│   ├── PreviewModal.tsx        # Modal ดูตัวอย่าง
│   ├── EditorPanel.tsx         # Editor Mode Panel
│   ├── SplitStopModal.tsx      # Modal แบ่งออเดอร์
│   ├── VRPSettingsPanel.tsx    # ตั้งค่า VRP
│   ├── TripRow.tsx             # แถวเที่ยวรถ (Expandable)
│   └── MetricCards.tsx         # การ์ดสถิติ
├── hooks/
│   ├── useRoutePlans.ts        # State & API สำหรับ Route Plans
│   ├── useDraftOrders.ts       # State & API สำหรับ Draft Orders
│   ├── useEditor.ts            # State สำหรับ Editor Mode
│   └── useVRPSettings.ts       # State สำหรับ VRP Settings
├── types/
│   └── index.ts                # Type Definitions
└── utils/
    └── index.ts                # Helper Functions
```

### 1.2 วิธี Refactor (ปลอดภัย)

**ขั้นตอน:**
1. สร้างโฟลเดอร์ใหม่
2. Copy code เดิมไปไฟล์ใหม่ (ไม่แก้ไข)
3. Import กลับมาใน page.tsx
4. Test ว่าทำงานเหมือนเดิม
5. ค่อยๆ refactor ทีละส่วน

**Template: แยก Component**
```typescript
// ===== STEP 1: สร้างไฟล์ใหม่ =====
// app/receiving/routes/components/RoutesList.tsx

'use client';

import { ... } from '...';

// ===== STEP 2: Copy interface/types มาก่อน =====
interface RoutePlan {
  // ... copy มาจาก page.tsx เดิม ไม่แก้ไข
}

interface RoutesListProps {
  routePlans: RoutePlan[];
  loading: boolean;
  onPreview: (plan: RoutePlan) => void;
  onEdit: (plan: RoutePlan) => void;
  onPrint: (plan: RoutePlan) => void;
  // ... props อื่นๆ
}

// ===== STEP 3: Copy JSX มาวาง =====
export function RoutesList({
  routePlans,
  loading,
  onPreview,
  onEdit,
  onPrint,
}: RoutesListProps) {
  // ===== BEGIN: ORIGINAL CODE - DO NOT MODIFY =====
  
  // ... copy code เดิมมาวางตรงนี้ทั้งหมด
  // ... ไม่แก้ไข logic อะไรเลย
  
  // ===== END: ORIGINAL CODE =====
}
```

**Template: แยก Hook**
```typescript
// ===== app/receiving/routes/hooks/useRoutePlans.ts =====

'use client';

import { useState, useEffect, useCallback } from 'react';

// Copy types
interface RoutePlan { ... }

export function useRoutePlans() {
  // ===== BEGIN: ORIGINAL CODE - DO NOT MODIFY =====
  
  // Copy state declarations เดิม
  const [routePlans, setRoutePlans] = useState<RoutePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  // ...

  // Copy functions เดิม
  const fetchRoutePlans = useCallback(async () => {
    // ... copy code เดิม ไม่แก้ไข
  }, []);

  // Copy useEffect เดิม
  useEffect(() => {
    fetchRoutePlans();
  }, [fetchRoutePlans]);

  // ===== END: ORIGINAL CODE =====

  return {
    routePlans,
    loading,
    searchTerm,
    setSearchTerm,
    fetchRoutePlans,
    // ... return ทุกอย่างที่ page.tsx ต้องใช้
  };
}
```

### 1.3 Checklist Refactor
```
Phase 1A: สร้างโครงสร้างไฟล์
□ สร้างโฟลเดอร์ components/, hooks/, types/, utils/
□ สร้างไฟล์ types/index.ts - copy types ทั้งหมด
□ Test: page.tsx ยังทำงานปกติ

Phase 1B: แยก Hooks
□ สร้าง hooks/useRoutePlans.ts
□ สร้าง hooks/useDraftOrders.ts
□ สร้าง hooks/useEditor.ts
□ สร้าง hooks/useVRPSettings.ts
□ Import hooks ใน page.tsx
□ Test: ทุก function ยังทำงานปกติ

Phase 1C: แยก Components
□ สร้าง components/RoutesList.tsx
□ สร้าง components/CreatePlanModal.tsx
□ สร้าง components/PreviewModal.tsx
□ สร้าง components/EditorPanel.tsx
□ สร้าง components/SplitStopModal.tsx
□ Import components ใน page.tsx
□ Test: ทุก UI ยังทำงานปกติ

Phase 1D: Final Cleanup
□ ลบ code ที่ย้ายไปแล้วออกจาก page.tsx
□ Test: Full regression test
```

---

## Phase 2: เพิ่ม Error Handling

### 2.1 สร้าง Error Handler Utility
```typescript
// app/receiving/routes/utils/errorHandler.ts

export interface ApiError {
  message: string;
  code?: string;
  details?: any;
}

export function handleApiError(error: any): ApiError {
  console.error('[Routes API Error]', error);
  
  if (error?.response?.data?.error) {
    return {
      message: error.response.data.error,
      code: error.response.data.error_code,
      details: error.response.data.details
    };
  }
  
  if (error?.message) {
    return { message: error.message };
  }
  
  return { message: 'เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่อีกครั้ง' };
}

export function getErrorMessage(error: ApiError): string {
  const errorMessages: Record<string, string> = {
    'UNAUTHORIZED': 'กรุณาเข้าสู่ระบบใหม่',
    'FORBIDDEN': 'คุณไม่มีสิทธิ์ดำเนินการนี้',
    'NOT_FOUND': 'ไม่พบข้อมูลที่ต้องการ',
    'VALIDATION_ERROR': 'ข้อมูลไม่ถูกต้อง',
    'DUPLICATE': 'ข้อมูลซ้ำในระบบ',
    'CONFLICT': 'ข้อมูลถูกแก้ไขโดยผู้อื่น กรุณาโหลดใหม่',
  };
  
  return errorMessages[error.code || ''] || error.message;
}
```

### 2.2 เพิ่ม Error State ใน Hooks
```typescript
// เพิ่มใน hooks/useRoutePlans.ts

const [error, setError] = useState<ApiError | null>(null);

const fetchRoutePlans = useCallback(async () => {
  setLoading(true);
  setError(null); // Clear previous error
  
  try {
    const response = await fetch('/api/route-plans');
    
    if (!response.ok) {
      const errorData = await response.json();
      throw { response: { data: errorData } };
    }
    
    const data = await response.json();
    setRoutePlans(data);
  } catch (err) {
    const apiError = handleApiError(err);
    setError(apiError);
    // แสดง toast หรือ alert
    toast.error(getErrorMessage(apiError));
  } finally {
    setLoading(false);
  }
}, []);

return {
  // ... existing returns
  error,
  clearError: () => setError(null),
};
```

### 2.3 Error UI Component
```typescript
// components/ErrorAlert.tsx

interface ErrorAlertProps {
  error: ApiError | null;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function ErrorAlert({ error, onRetry, onDismiss }: ErrorAlertProps) {
  if (!error) return null;
  
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
      <div className="flex items-start">
        <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-red-800">
            เกิดข้อผิดพลาด
          </h3>
          <p className="text-sm text-red-700 mt-1">
            {getErrorMessage(error)}
          </p>
        </div>
        <div className="flex gap-2">
          {onRetry && (
            <button
              onClick={onRetry}
              className="text-sm text-red-600 hover:text-red-800"
            >
              ลองใหม่
            </button>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## Phase 3: เพิ่ม Loading States

### 3.1 Loading Component
```typescript
// components/LoadingOverlay.tsx

interface LoadingOverlayProps {
  message?: string;
}

export function LoadingOverlay({ message = 'กำลังโหลด...' }: LoadingOverlayProps) {
  return (
    <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-50">
      <div className="flex flex-col items-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="mt-2 text-sm text-gray-600">{message}</p>
      </div>
    </div>
  );
}
```

### 3.2 เพิ่ม Loading States สำหรับทุก Action
```typescript
// hooks/useRoutePlans.ts

// เพิ่ม loading states สำหรับแต่ละ action
const [actionLoading, setActionLoading] = useState<{
  publish: boolean;
  delete: boolean;
  export: boolean;
  reorder: boolean;
  split: boolean;
}>({
  publish: false,
  delete: false,
  export: false,
  reorder: false,
  split: false,
});

// Wrapper สำหรับ async action
const withLoading = async (
  action: keyof typeof actionLoading,
  fn: () => Promise<void>
) => {
  setActionLoading(prev => ({ ...prev, [action]: true }));
  try {
    await fn();
  } finally {
    setActionLoading(prev => ({ ...prev, [action]: false }));
  }
};

// ใช้งาน
const handlePublish = async (planId: number) => {
  await withLoading('publish', async () => {
    // ... logic เดิม
  });
};
```

### 3.3 ปุ่มที่มี Loading State
```typescript
// ปุ่มที่ต้องเพิ่ม loading
<Button
  onClick={handlePublish}
  disabled={actionLoading.publish}
>
  {actionLoading.publish ? (
    <>
      <Loader2 className="h-4 w-4 animate-spin mr-2" />
      กำลังดำเนินการ...
    </>
  ) : (
    'เผยแพร่แผน'
  )}
</Button>
```

---

## Phase 4: เพิ่ม Confirmation Dialog

### 4.1 Confirmation Dialog Component
```typescript
// components/ConfirmDialog.tsx

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'ยืนยัน',
  cancelText = 'ยกเลิก',
  variant = 'danger',
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const variantStyles = {
    danger: 'bg-red-600 hover:bg-red-700',
    warning: 'bg-yellow-600 hover:bg-yellow-700',
    info: 'bg-blue-600 hover:bg-blue-700',
  };

  return (
    <Modal isOpen={isOpen} onClose={onCancel}>
      <div className="p-6">
        <div className="flex items-center mb-4">
          <AlertTriangle className={`h-6 w-6 ${
            variant === 'danger' ? 'text-red-500' : 
            variant === 'warning' ? 'text-yellow-500' : 'text-blue-500'
          }`} />
          <h3 className="ml-3 text-lg font-semibold">{title}</h3>
        </div>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            {cancelText}
          </Button>
          <Button
            className={variantStyles[variant]}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
```

### 4.2 ใช้ Confirmation Dialog
```typescript
// ใน Component หลัก

const [confirmDialog, setConfirmDialog] = useState<{
  isOpen: boolean;
  title: string;
  message: string;
  variant: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
} | null>(null);

// ตัวอย่าง: ยกเลิกจุดส่ง
const handleCancelStop = (stopId: number, orderId: number) => {
  setConfirmDialog({
    isOpen: true,
    title: 'ยืนยันการยกเลิกจุดส่ง',
    message: 'การยกเลิกจุดส่งจะทำให้ออเดอร์กลับไปเป็นสถานะร่าง คุณต้องการดำเนินการต่อหรือไม่?',
    variant: 'warning',
    onConfirm: async () => {
      await performCancelStop(stopId, orderId);
      setConfirmDialog(null);
    },
  });
};

// ตัวอย่าง: ลบแผน
const handleDeletePlan = (planId: number) => {
  setConfirmDialog({
    isOpen: true,
    title: 'ยืนยันการลบแผน',
    message: 'การลบแผนจะทำให้ออเดอร์ทั้งหมดกลับไปเป็นสถานะร่าง และไม่สามารถกู้คืนได้ คุณแน่ใจหรือไม่?',
    variant: 'danger',
    onConfirm: async () => {
      await performDeletePlan(planId);
      setConfirmDialog(null);
    },
  });
};

// Render dialog
{confirmDialog && (
  <ConfirmDialog
    isOpen={confirmDialog.isOpen}
    title={confirmDialog.title}
    message={confirmDialog.message}
    variant={confirmDialog.variant}
    onConfirm={confirmDialog.onConfirm}
    onCancel={() => setConfirmDialog(null)}
    loading={actionLoading.delete}
  />
)}
```

---

## Phase 5: Feature ใหม่ - ย้าย/แบ่งออเดอร์ข้ามแผน

### 5.1 Database Changes
```sql
-- Migration: เพิ่มตารางสำหรับ Cross-Plan Operations
-- ไม่แก้ไขตารางเดิม เพิ่มใหม่เท่านั้น

-- Log การย้ายข้ามแผน
CREATE TABLE IF NOT EXISTS receiving_cross_plan_transfers (
  transfer_id SERIAL PRIMARY KEY,
  source_plan_id INTEGER NOT NULL REFERENCES receiving_route_plans(plan_id),
  source_trip_id INTEGER NOT NULL REFERENCES receiving_route_trips(trip_id),
  source_stop_id INTEGER NOT NULL REFERENCES receiving_route_stops(stop_id),
  target_plan_id INTEGER NOT NULL REFERENCES receiving_route_plans(plan_id),
  target_trip_id INTEGER NOT NULL REFERENCES receiving_route_trips(trip_id),
  order_id BIGINT NOT NULL REFERENCES wms_orders(order_id),
  transferred_weight_kg NUMERIC,
  transferred_items JSONB,
  transfer_type VARCHAR(50) NOT NULL, -- 'full' or 'partial'
  transferred_by INTEGER REFERENCES master_system_user(user_id),
  transferred_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- Index สำหรับ query
CREATE INDEX idx_cross_plan_source ON receiving_cross_plan_transfers(source_plan_id);
CREATE INDEX idx_cross_plan_target ON receiving_cross_plan_transfers(target_plan_id);
CREATE INDEX idx_cross_plan_order ON receiving_cross_plan_transfers(order_id);
```

### 5.2 API ใหม่: Cross-Plan Transfer
```typescript
// app/api/route-plans/cross-plan-transfer/route.ts

import { withAuth } from '@/lib/api/with-auth';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

interface CrossPlanTransferRequest {
  source_plan_id: number;
  source_trip_id: number;
  source_stop_id: number;
  target_plan_id: number;
  target_trip_id: number;
  target_sequence: number;
  order_id: number;
  transfer_type: 'full' | 'partial';
  split_items?: { order_item_id: number; quantity: number; weight_kg: number }[];
  notes?: string;
}

async function handlePost(request: NextRequest, context: any) {
  const supabase = await createClient();
  const userId = context.user.user_id;
  const body: CrossPlanTransferRequest = await request.json();

  // Validation
  if (body.source_plan_id === body.target_plan_id) {
    return NextResponse.json(
      { error: 'ใช้ API ย้ายภายในแผนเดียวกันแทน', error_code: 'SAME_PLAN' },
      { status: 400 }
    );
  }

  // ตรวจสอบว่าทั้งสองแผนเป็น status ที่แก้ไขได้
  const { data: plans, error: plansError } = await supabase
    .from('receiving_route_plans')
    .select('plan_id, status')
    .in('plan_id', [body.source_plan_id, body.target_plan_id]);

  if (plansError) {
    return NextResponse.json({ error: plansError.message }, { status: 500 });
  }

  const invalidPlan = plans?.find(p => !['draft', 'published'].includes(p.status));
  if (invalidPlan) {
    return NextResponse.json(
      { error: 'แผนที่เลือกอยู่ในสถานะที่ไม่สามารถแก้ไขได้', error_code: 'INVALID_STATUS' },
      { status: 400 }
    );
  }

  // ดำเนินการย้าย
  if (body.transfer_type === 'full') {
    // ย้ายทั้งจุดส่ง
    const result = await performFullTransfer(supabase, body, userId);
    return NextResponse.json(result);
  } else {
    // แบ่งบางส่วนไปแผนอื่น
    const result = await performPartialTransfer(supabase, body, userId);
    return NextResponse.json(result);
  }
}

async function performFullTransfer(supabase: any, body: CrossPlanTransferRequest, userId: number) {
  // ===== BEGIN: Transaction-like operations =====
  
  // 1. ดึงข้อมูล stop เดิม
  const { data: sourceStop, error: stopError } = await supabase
    .from('receiving_route_stops')
    .select('*')
    .eq('stop_id', body.source_stop_id)
    .single();

  if (stopError) throw stopError;

  // 2. ลบ stop จากแผนเดิม
  const { error: deleteError } = await supabase
    .from('receiving_route_stops')
    .delete()
    .eq('stop_id', body.source_stop_id);

  if (deleteError) throw deleteError;

  // 3. สร้าง stop ใหม่ในแผนปลายทาง
  const { data: newStop, error: insertError } = await supabase
    .from('receiving_route_stops')
    .insert({
      trip_id: body.target_trip_id,
      plan_id: body.target_plan_id,
      sequence_no: body.target_sequence,
      stop_name: sourceStop.stop_name,
      address: sourceStop.address,
      latitude: sourceStop.latitude,
      longitude: sourceStop.longitude,
      customer_id: sourceStop.customer_id,
      order_id: sourceStop.order_id,
      load_weight_kg: sourceStop.load_weight_kg,
      load_volume_cbm: sourceStop.load_volume_cbm,
      load_units: sourceStop.load_units,
      service_duration_minutes: sourceStop.service_duration_minutes,
      tags: sourceStop.tags,
      notes: body.notes || sourceStop.notes,
    })
    .select()
    .single();

  if (insertError) throw insertError;

  // 4. ย้าย stop_items
  const { error: itemsError } = await supabase
    .from('receiving_route_stop_items')
    .update({
      stop_id: newStop.stop_id,
      trip_id: body.target_trip_id,
    })
    .eq('stop_id', body.source_stop_id);

  if (itemsError) throw itemsError;

  // 5. บันทึก transfer log
  await supabase.from('receiving_cross_plan_transfers').insert({
    source_plan_id: body.source_plan_id,
    source_trip_id: body.source_trip_id,
    source_stop_id: body.source_stop_id,
    target_plan_id: body.target_plan_id,
    target_trip_id: body.target_trip_id,
    order_id: body.order_id,
    transferred_weight_kg: sourceStop.load_weight_kg,
    transfer_type: 'full',
    transferred_by: userId,
  });

  // 6. Resequence stops ในทั้งสองแผน
  await resequenceStops(supabase, body.source_trip_id);
  await resequenceStops(supabase, body.target_trip_id);

  // 7. Update trip metrics
  await updateTripMetrics(supabase, body.source_trip_id);
  await updateTripMetrics(supabase, body.target_trip_id);

  // ===== END: Transaction-like operations =====

  return { success: true, new_stop_id: newStop.stop_id };
}

export const POST = withAuth(handlePost);
```

### 5.3 UI: Cross-Plan Transfer Modal
```typescript
// components/CrossPlanTransferModal.tsx

interface CrossPlanTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceStop: EditorStop;
  sourcePlanId: number;
  sourceTripId: number;
  onTransfer: (targetPlanId: number, targetTripId: number, sequence: number) => Promise<void>;
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
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [selectedSequence, setSelectedSequence] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [trips, setTrips] = useState<any[]>([]);

  // โหลดแผนอื่นที่สามารถย้ายไปได้
  useEffect(() => {
    if (isOpen) {
      fetchAvailablePlans();
    }
  }, [isOpen]);

  const fetchAvailablePlans = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/route-plans?status=draft,published');
      const data = await response.json();
      // กรองแผนปัจจุบันออก
      setAvailablePlans(data.filter((p: RoutePlan) => p.plan_id !== sourcePlanId));
    } catch (error) {
      console.error('Error fetching plans:', error);
    } finally {
      setLoading(false);
    }
  };

  // โหลด trips เมื่อเลือกแผน
  useEffect(() => {
    if (selectedPlanId) {
      fetchTrips(selectedPlanId);
    }
  }, [selectedPlanId]);

  const fetchTrips = async (planId: number) => {
    setLoadingTrips(true);
    try {
      const response = await fetch(`/api/route-plans/${planId}/trips`);
      const data = await response.json();
      setTrips(data);
    } catch (error) {
      console.error('Error fetching trips:', error);
    } finally {
      setLoadingTrips(false);
    }
  };

  const handleTransfer = async () => {
    if (!selectedPlanId || !selectedTripId) return;
    
    setLoading(true);
    try {
      await onTransfer(selectedPlanId, selectedTripId, selectedSequence);
      onClose();
    } catch (error) {
      console.error('Error transferring:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="ย้ายออเดอร์ไปแผนอื่น">
      <div className="p-6 space-y-4">
        {/* ข้อมูลออเดอร์ที่จะย้าย */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-medium text-blue-800">ออเดอร์ที่จะย้าย</h4>
          <p className="text-sm text-blue-600">
            {sourceStop.order_no} - {sourceStop.stop_name}
          </p>
          <p className="text-sm text-blue-600">
            น้ำหนัก: {sourceStop.load_weight_kg?.toFixed(2)} กก.
          </p>
        </div>

        {/* เลือกแผนปลายทาง */}
        <div>
          <label className="block text-sm font-medium mb-1">เลือกแผนปลายทาง</label>
          <select
            value={selectedPlanId || ''}
            onChange={(e) => {
              setSelectedPlanId(Number(e.target.value) || null);
              setSelectedTripId(null);
            }}
            className="w-full border rounded-lg p-2"
          >
            <option value="">-- เลือกแผน --</option>
            {availablePlans.map(plan => (
              <option key={plan.plan_id} value={plan.plan_id}>
                {plan.plan_code} - {plan.plan_name} ({plan.plan_date})
              </option>
            ))}
          </select>
        </div>

        {/* เลือกคันปลายทาง */}
        {selectedPlanId && (
          <div>
            <label className="block text-sm font-medium mb-1">เลือกคัน</label>
            <select
              value={selectedTripId || ''}
              onChange={(e) => setSelectedTripId(Number(e.target.value) || null)}
              className="w-full border rounded-lg p-2"
              disabled={loadingTrips}
            >
              <option value="">-- เลือกคัน --</option>
              {trips.map(trip => (
                <option key={trip.trip_id} value={trip.trip_id}>
                  คัน {trip.daily_trip_number || trip.trip_sequence} 
                  ({trip.total_stops} จุด, {trip.total_weight_kg?.toFixed(0)} กก.)
                </option>
              ))}
            </select>
          </div>
        )}

        {/* เลือกลำดับ */}
        {selectedTripId && (
          <div>
            <label className="block text-sm font-medium mb-1">ลำดับจุดส่ง</label>
            <input
              type="number"
              min="1"
              value={selectedSequence}
              onChange={(e) => setSelectedSequence(Number(e.target.value))}
              className="w-full border rounded-lg p-2"
            />
          </div>
        )}

        {/* Buttons */}
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={!selectedPlanId || !selectedTripId || loading}
          >
            {loading ? 'กำลังย้าย...' : 'ย้ายออเดอร์'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
```

---

## Phase 6: ปรับ UI ค่าขนส่งเป็นตาราง

### 6.1 ShippingCostTable Component
```typescript
// components/ShippingCostTable.tsx

interface ShippingCostRow {
  trip_id: number;
  trip_number: number;
  supplier_name: string;
  total_stops: number;
  total_weight_kg: number;
  base_price: number;
  helper_fee: number;
  extra_stop_fee: number;
  porterage_fee: number;
  other_fees: number;
  total_cost: number;
}

interface ShippingCostTableProps {
  trips: any[];
  onChange: (tripId: number, field: string, value: number) => void;
  readOnly?: boolean;
}

export function ShippingCostTable({ trips, onChange, readOnly = false }: ShippingCostTableProps) {
  const columns = [
    { key: 'trip_number', label: 'คัน', width: '60px', editable: false },
    { key: 'supplier_name', label: 'ขนส่ง', width: '150px', editable: false },
    { key: 'total_stops', label: 'จุดส่ง', width: '70px', editable: false },
    { key: 'total_weight_kg', label: 'น้ำหนัก (กก.)', width: '100px', editable: false },
    { key: 'base_price', label: 'ราคาฐาน', width: '100px', editable: true },
    { key: 'helper_fee', label: 'ค่าคนช่วย', width: '100px', editable: true },
    { key: 'extra_stop_fee', label: 'ค่าจุดเพิ่ม', width: '100px', editable: true },
    { key: 'porterage_fee', label: 'ค่าขนของ', width: '100px', editable: true },
    { key: 'other_fees', label: 'อื่นๆ', width: '100px', editable: true },
    { key: 'total_cost', label: 'รวม', width: '120px', editable: false },
  ];

  const calculateTotal = (trip: any) => {
    return (
      (trip.base_price || 0) +
      (trip.helper_fee || 0) +
      (trip.extra_stop_fee || 0) +
      (trip.porterage_fee || 0) +
      (trip.other_fees || 0)
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            {columns.map(col => (
              <th
                key={col.key}
                className="border px-2 py-2 text-sm font-medium text-left"
                style={{ width: col.width }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {trips.map(trip => (
            <tr key={trip.trip_id} className="hover:bg-gray-50">
              <td className="border px-2 py-1 text-center">
                {trip.daily_trip_number || trip.trip_sequence}
              </td>
              <td className="border px-2 py-1 text-sm">
                {trip.supplier?.supplier_name || '-'}
              </td>
              <td className="border px-2 py-1 text-center">
                {trip.total_stops}
              </td>
              <td className="border px-2 py-1 text-right">
                {trip.total_weight_kg?.toFixed(0)}
              </td>
              {['base_price', 'helper_fee', 'extra_stop_fee', 'porterage_fee', 'other_fees'].map(field => (
                <td key={field} className="border px-1 py-1">
                  {readOnly ? (
                    <span className="text-right block">
                      {(trip[field] || 0).toLocaleString()}
                    </span>
                  ) : (
                    <input
                      type="number"
                      value={trip[field] || 0}
                      onChange={(e) => onChange(trip.trip_id, field, Number(e.target.value))}
                      className="w-full text-right border-0 focus:ring-1 focus:ring-blue-500 rounded p-1"
                    />
                  )}
                </td>
              ))}
              <td className="border px-2 py-1 text-right font-semibold bg-blue-50">
                {calculateTotal(trip).toLocaleString()}
              </td>
            </tr>
          ))}
          {/* Summary Row */}
          <tr className="bg-gray-100 font-semibold">
            <td colSpan={4} className="border px-2 py-2 text-right">รวมทั้งหมด:</td>
            {['base_price', 'helper_fee', 'extra_stop_fee', 'porterage_fee', 'other_fees'].map(field => (
              <td key={field} className="border px-2 py-2 text-right">
                {trips.reduce((sum, t) => sum + (t[field] || 0), 0).toLocaleString()}
              </td>
            ))}
            <td className="border px-2 py-2 text-right bg-blue-100">
              {trips.reduce((sum, t) => sum + calculateTotal(t), 0).toLocaleString()}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
```

---

## Phase 7: รวมใบว่าจ้างข้ามแผน

### 7.1 API: Get Trips by Supplier (ข้ามแผน)
```typescript
// app/api/route-plans/trips-by-supplier/route.ts

import { withAuth } from '@/lib/api/with-auth';

async function handleGet(request: NextRequest, context: any) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const supplierId = searchParams.get('supplier_id');
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');

  // ดึง trips จากหลายแผนที่ใช้ supplier เดียวกัน
  let query = supabase
    .from('receiving_route_trips')
    .select(`
      *,
      plan:receiving_route_plans!inner(
        plan_id,
        plan_code,
        plan_name,
        plan_date,
        status
      ),
      stops:receiving_route_stops(
        stop_id,
        sequence_no,
        stop_name,
        order_id,
        load_weight_kg
      )
    `)
    .eq('supplier_id', supplierId)
    .in('plan.status', ['published', 'pending_approval', 'approved']);

  if (startDate) {
    query = query.gte('plan.plan_date', startDate);
  }
  if (endDate) {
    query = query.lte('plan.plan_date', endDate);
  }

  const { data, error } = await query.order('plan.plan_date');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export const GET = withAuth(handleGet);
```

### 7.2 MultiPlanContractModal Component
```typescript
// components/MultiPlanContractModal.tsx

interface MultiPlanContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (trips: any[]) => void;
}

export function MultiPlanContractModal({
  isOpen,
  onClose,
  onGenerate,
}: MultiPlanContractModalProps) {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [availableTrips, setAvailableTrips] = useState<any[]>([]);
  const [selectedTrips, setSelectedTrips] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  // โหลดรายการขนส่ง
  useEffect(() => {
    if (isOpen) {
      fetchSuppliers();
    }
  }, [isOpen]);

  const fetchSuppliers = async () => {
    const response = await fetch('/api/suppliers?type=transport');
    const data = await response.json();
    setSuppliers(data);
  };

  // โหลด trips เมื่อเลือก supplier + วันที่
  const handleSearch = async () => {
    if (!selectedSupplier) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        supplier_id: selectedSupplier,
        ...(dateRange.start && { start_date: dateRange.start }),
        ...(dateRange.end && { end_date: dateRange.end }),
      });
      
      const response = await fetch(`/api/route-plans/trips-by-supplier?${params}`);
      const data = await response.json();
      setAvailableTrips(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTrip = (tripId: number) => {
    const newSelected = new Set(selectedTrips);
    if (newSelected.has(tripId)) {
      newSelected.delete(tripId);
    } else {
      newSelected.add(tripId);
    }
    setSelectedTrips(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedTrips.size === availableTrips.length) {
      setSelectedTrips(new Set());
    } else {
      setSelectedTrips(new Set(availableTrips.map(t => t.trip_id)));
    }
  };

  const handleGenerate = () => {
    const trips = availableTrips.filter(t => selectedTrips.has(t.trip_id));
    onGenerate(trips);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="รวมใบว่าจ้างข้ามแผน" size="xl">
      <div className="p-6 space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">ขนส่ง</label>
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="w-full border rounded-lg p-2"
            >
              <option value="">-- เลือกขนส่ง --</option>
              {suppliers.map(s => (
                <option key={s.supplier_id} value={s.supplier_id}>
                  {s.supplier_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">จากวันที่</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="w-full border rounded-lg p-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">ถึงวันที่</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="w-full border rounded-lg p-2"
            />
          </div>
          <div className="flex items-end">
            <Button onClick={handleSearch} disabled={!selectedSupplier || loading}>
              {loading ? 'กำลังค้นหา...' : 'ค้นหา'}
            </Button>
          </div>
        </div>

        {/* Trip List */}
        {availableTrips.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left">
                    <input
                      type="checkbox"
                      checked={selectedTrips.size === availableTrips.length}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th className="px-4 py-2 text-left">แผน</th>
                  <th className="px-4 py-2 text-left">วันที่</th>
                  <th className="px-4 py-2 text-center">คัน</th>
                  <th className="px-4 py-2 text-center">จุดส่ง</th>
                  <th className="px-4 py-2 text-right">น้ำหนัก (กก.)</th>
                  <th className="px-4 py-2 text-right">ค่าขนส่ง</th>
                </tr>
              </thead>
              <tbody>
                {availableTrips.map(trip => (
                  <tr
                    key={trip.trip_id}
                    className={`hover:bg-gray-50 ${selectedTrips.has(trip.trip_id) ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={selectedTrips.has(trip.trip_id)}
                        onChange={() => handleToggleTrip(trip.trip_id)}
                      />
                    </td>
                    <td className="px-4 py-2">{trip.plan?.plan_code}</td>
                    <td className="px-4 py-2">{trip.plan?.plan_date}</td>
                    <td className="px-4 py-2 text-center">
                      {trip.daily_trip_number || trip.trip_sequence}
                    </td>
                    <td className="px-4 py-2 text-center">{trip.total_stops}</td>
                    <td className="px-4 py-2 text-right">
                      {trip.total_weight_kg?.toFixed(0)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {trip.shipping_cost?.toLocaleString() || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Summary */}
        {selectedTrips.size > 0 && (
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="font-medium">
              เลือก {selectedTrips.size} คัน | 
              รวมค่าขนส่ง: {availableTrips
                .filter(t => selectedTrips.has(t.trip_id))
                .reduce((sum, t) => sum + (t.shipping_cost || 0), 0)
                .toLocaleString()} บาท
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={selectedTrips.size === 0}
          >
            สร้างใบว่าจ้าง ({selectedTrips.size} คัน)
          </Button>
        </div>
      </div>
    </Modal>
  );
}
```

---

## Phase 8: Export Excel ไม่มีราคา

### 8.1 เพิ่ม Option ใน Export
```typescript
// utils/exportExcel.ts

interface ExportOptions {
  includePrice: boolean;
  format: 'tms' | 'simple';
}

export async function exportRoutePlanToExcel(
  planId: number,
  trips: any[],
  options: ExportOptions = { includePrice: true, format: 'tms' }
) {
  const XLSX = await import('xlsx');
  
  // สร้าง workbook
  const wb = XLSX.utils.book_new();
  
  for (const trip of trips) {
    const sheetData: any[] = [];
    
    // Header row
    const headers = [
      'ลำดับ',
      'เลขออเดอร์',
      'รหัสลูกค้า',
      'ชื่อร้าน',
      'ที่อยู่',
      'จังหวัด',
      'น้ำหนัก (กก.)',
      'จำนวน (ชิ้น)',
    ];
    
    // เพิ่มคอลัมน์ราคาถ้าต้องการ
    if (options.includePrice) {
      headers.push('ค่าขนส่ง');
    }
    
    sheetData.push(headers);
    
    // Data rows
    for (const stop of trip.stops || []) {
      const row = [
        stop.sequence_no,
        stop.order_no || stop.order_id,
        stop.customer_id,
        stop.stop_name,
        stop.address,
        stop.province || '',
        stop.load_weight_kg?.toFixed(2) || '',
        stop.load_units || '',
      ];
      
      if (options.includePrice) {
        row.push(''); // ราคาต่อจุด (ถ้ามี)
      }
      
      sheetData.push(row);
    }
    
    // Summary row
    if (!options.includePrice) {
      sheetData.push([]);
      sheetData.push(['รวม', '', '', '', '', '',
        trip.total_weight_kg?.toFixed(2) || '',
        trip.stops?.reduce((sum: number, s: any) => sum + (s.load_units || 0), 0) || ''
      ]);
    }
    
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(wb, ws, `คัน ${trip.daily_trip_number || trip.trip_sequence}`);
  }
  
  // Download
  const fileName = options.includePrice
    ? `route_plan_${planId}_full.xlsx`
    : `route_plan_${planId}_routes_only.xlsx`;
    
  XLSX.writeFile(wb, fileName);
}
```

### 8.2 Export Options UI
```typescript
// ใน page.tsx หรือ component ที่มีปุ่ม Export

const [showExportOptions, setShowExportOptions] = useState(false);

const handleExport = (includePrice: boolean) => {
  exportRoutePlanToExcel(currentPlanId, currentTrips, {
    includePrice,
    format: 'simple'
  });
  setShowExportOptions(false);
};

// UI
<div className="relative">
  <Button onClick={() => setShowExportOptions(!showExportOptions)}>
    <FileSpreadsheet className="h-4 w-4 mr-2" />
    Export Excel
  </Button>
  
  {showExportOptions && (
    <div className="absolute right-0 mt-2 w-48 bg-white border rounded-lg shadow-lg z-10">
      <button
        onClick={() => handleExport(true)}
        className="w-full text-left px-4 py-2 hover:bg-gray-100"
      >
        📊 Export แบบเต็ม (มีราคา)
      </button>
      <button
        onClick={() => handleExport(false)}
        className="w-full text-left px-4 py-2 hover:bg-gray-100"
      >
        📋 Export เฉพาะสาย (ไม่มีราคา)
      </button>
    </div>
  )}
</div>
```

---

## ✅ Checklist รวม

### Phase 1: Refactor
- [ ] สร้างโครงสร้างโฟลเดอร์ใหม่
- [ ] แยก types/index.ts
- [ ] แยก hooks (4 files)
- [ ] แยก components (8 files)
- [ ] Test: ทุก function ทำงานเหมือนเดิม

### Phase 2: Error Handling
- [ ] สร้าง errorHandler utility
- [ ] เพิ่ม error state ใน hooks
- [ ] สร้าง ErrorAlert component
- [ ] Test: error แสดงถูกต้อง

### Phase 3: Loading States
- [ ] สร้าง LoadingOverlay component
- [ ] เพิ่ม actionLoading states
- [ ] ปรับปุ่มให้แสดง loading
- [ ] Test: loading แสดงถูกต้อง

### Phase 4: Confirmation Dialog
- [ ] สร้าง ConfirmDialog component
- [ ] เพิ่ม confirm ก่อน delete/cancel
- [ ] Test: ยืนยันก่อนทำงาน

### Phase 5: Cross-Plan Transfer
- [ ] สร้าง migration (ตารางใหม่)
- [ ] สร้าง API cross-plan-transfer
- [ ] สร้าง CrossPlanTransferModal
- [ ] เพิ่มปุ่มใน Editor
- [ ] Test: ย้ายข้ามแผนได้

### Phase 6: Shipping Cost Table
- [ ] สร้าง ShippingCostTable component
- [ ] แทนที่ UI เดิมด้วยตาราง
- [ ] Test: แก้ไขค่าขนส่งได้

### Phase 7: Multi-Plan Contract
- [ ] สร้าง API trips-by-supplier
- [ ] สร้าง MultiPlanContractModal
- [ ] เพิ่มปุ่มในหน้าหลัก
- [ ] Test: รวมใบว่าจ้างได้

### Phase 8: Export Options
- [ ] เพิ่ม options ใน exportExcel
- [ ] สร้าง Export Options UI
- [ ] Test: export ได้ทั้ง 2 แบบ

### Final Regression Test
- [ ] สร้างแผนใหม่ได้
- [ ] VRP ทำงานได้
- [ ] Preview ได้
- [ ] Editor Mode ทำงานได้
- [ ] ย้าย/แบ่งออเดอร์ได้
- [ ] พิมพ์ใบว่าจ้างได้
- [ ] Export Excel ได้
- [ ] **Logic เดิมทั้งหมดทำงานได้ 100%**

---

เริ่มทำได้เลยครับ ทำทีละ Phase ตาม Checklist
**ห้ามรวบหลาย Phase พร้อมกัน!**
**Test หลังทำเสร็จทุก Phase!**