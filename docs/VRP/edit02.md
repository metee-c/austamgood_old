# 🔧 Receiving Routes - Bug Fix Guide & Sprint Plan

> **โปรเจค:** WMS - หน้า `/receiving/routes`  
> **วันที่:** 17 มกราคม 2026  
> **สถานะ:** Critical - Production มี bugs เยอะ

---

## 📋 Table of Contents

1. [Sprint Plan & Priority](#-sprint-plan--priority)
2. [Bug Fix Code - Critical Issues](#-bug-fix-code---critical-issues-p0)
3. [Bug Fix Code - High Priority Issues](#-bug-fix-code---high-priority-issues-p1)
4. [Refactor Plan](#-refactor-plan)
5. [Developer Checklist](#-developer-checklist)

---

# 🎯 Sprint Plan & Priority

## Sprint Overview

| Sprint | Duration | Focus | Issues |
|--------|----------|-------|--------|
| Sprint 1 | 1 สัปดาห์ | Critical Bugs (P0) | #1-#8 |
| Sprint 2 | 1 สัปดาห์ | High Priority (P1) | #9-#15 |
| Sprint 3 | 2 สัปดาห์ | Refactoring | Split page.tsx |
| Sprint 4 | 1 สัปดาห์ | Testing & Polish | Tests + Medium fixes |

---

## 📅 Sprint 1: Critical Bugs (P0) - สัปดาห์ที่ 1

**เป้าหมาย:** แก้ bugs ที่ทำให้ระบบ crash หรือสร้างข้อมูลผิดพลาด

| Day | Task | Assignee | Hours |
|-----|------|----------|-------|
| Mon | Fix #1: Race Condition in handleOptimize | Dev 1 | 2h |
| Mon | Fix #4: Add Timeout for VRP | Dev 1 | 3h |
| Tue | Fix #5: N+1 Query Problem | Dev 2 | 4h |
| Tue | Fix #7: Add Transaction to batch-update | Dev 2 | 3h |
| Wed | Fix #2: Memory Leak in useEffect | Dev 1 | 3h |
| Wed | Fix #3: Clear state on modal close | Dev 1 | 1h |
| Thu | Fix #6: Add Error Boundary | Dev 2 | 2h |
| Thu | Fix #8: Stale Closure in handleMoveOrder | Dev 2 | 2h |
| Fri | Testing + QA | All | 8h |

**Definition of Done:**
- [ ] ทุก bug ได้รับการแก้ไข
- [ ] Unit tests ครอบคลุม
- [ ] QA ผ่าน
- [ ] Deploy to staging
- [ ] No regression bugs

---

## 📅 Sprint 2: High Priority (P1) - สัปดาห์ที่ 2

**เป้าหมาย:** ปรับปรุง maintainability และ performance

| Day | Task | Assignee | Hours |
|-----|------|----------|-------|
| Mon | Fix #9: Refactor to useReducer (Part 1) | Dev 1 | 4h |
| Tue | Fix #9: Refactor to useReducer (Part 2) | Dev 1 | 4h |
| Tue | Fix #10: Add Zod Validation | Dev 2 | 3h |
| Wed | Fix #12: Add Debounce to Search | Dev 2 | 2h |
| Wed | Fix #15: Add Pagination | Dev 2 | 4h |
| Thu | Fix #11: Optimize Editor Query | Dev 1 | 4h |
| Thu | Fix #13: Replace Prop Drilling with Context | Dev 2 | 4h |
| Fri | Testing + QA | All | 8h |

---

## 📅 Sprint 3: Refactoring - สัปดาห์ที่ 3-4

**เป้าหมาย:** แยก page.tsx (3,323 บรรทัด) ออกเป็น components ที่จัดการได้

| Week | Task | Files Created | Hours |
|------|------|---------------|-------|
| W3-D1-2 | Extract RoutesPlanTable component | `components/RoutesPlanTable.tsx` | 8h |
| W3-D3-4 | Extract CreatePlanModal component | `components/CreatePlanModal.tsx` | 8h |
| W3-D5 | Extract ExcelEditor component | `components/ExcelEditor/index.tsx` | 4h |
| W4-D1-2 | Extract hooks | `hooks/*.ts` | 8h |
| W4-D3-4 | Extract API layer | `api/*.ts` | 8h |
| W4-D5 | Final integration + Testing | - | 4h |

---

## 📅 Sprint 4: Testing & Polish - สัปดาห์ที่ 5

**เป้าหมาย:** เพิ่ม test coverage และแก้ Medium priority bugs

| Day | Task | Assignee | Hours |
|-----|------|----------|-------|
| Mon | Write unit tests for hooks | Dev 1 | 4h |
| Tue | Write integration tests | Dev 2 | 4h |
| Wed | Fix Medium bugs (#16-#20) | Both | 4h |
| Thu | Performance testing | Dev 1 | 4h |
| Fri | Documentation + Deploy | All | 4h |

---

# 🐛 Bug Fix Code - Critical Issues (P0)

## Bug #1: Race Condition in handleOptimize

**ปัญหา:** User สามารถกดปุ่ม Optimize หลายครั้งก่อน state จะ update

**ไฟล์:** `app/receiving/routes/page.tsx`

### Before (มี bug):
```typescript
const handleOptimize = async () => {
  if (selectedOrders.size === 0) {
    alert('กรุณาเลือกออเดอร์อย่างน้อย 1 รายการ');
    return;
  }
  
  setIsOptimizing(true); // ⚠️ State update is async!
  
  // ... optimization logic ...
}
```

### After (แก้แล้ว):
```typescript
// เพิ่ม ref เพื่อ lock การเรียกซ้ำ
const optimizeLockRef = useRef<boolean>(false);

const handleOptimize = async () => {
  // ✅ Check lock first - ป้องกันการเรียกซ้ำ
  if (optimizeLockRef.current) {
    console.warn('Optimization already in progress');
    return;
  }
  
  if (selectedOrders.size === 0) {
    toast.error('กรุณาเลือกออเดอร์อย่างน้อย 1 รายการ');
    return;
  }
  
  try {
    // ✅ Lock ก่อนทำงาน
    optimizeLockRef.current = true;
    setIsOptimizing(true);
    
    // สร้าง plan
    const planResponse = await fetch('/api/route-plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        warehouse_id: selectedWarehouse,
        plan_date: planDate,
        // ... other data
      }),
    });
    
    if (!planResponse.ok) {
      throw new Error('Failed to create plan');
    }
    
    const { data: plan } = await planResponse.json();
    
    // Optimize
    const optimizeResponse = await fetch(`/api/route-plans/${plan.plan_id}/optimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orders: Array.from(selectedOrders),
        settings: vrpSettings,
      }),
    });
    
    if (!optimizeResponse.ok) {
      throw new Error('Optimization failed');
    }
    
    const result = await optimizeResponse.json();
    
    // Success - show preview
    setPreviewData(result.data);
    setShowPreviewModal(true);
    toast.success('สร้างแผนเส้นทางสำเร็จ');
    
  } catch (error) {
    console.error('Optimization error:', error);
    toast.error(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่');
  } finally {
    // ✅ Unlock เสมอ ไม่ว่าจะ success หรือ fail
    optimizeLockRef.current = false;
    setIsOptimizing(false);
  }
};
```

### ปุ่มใน JSX:
```tsx
<Button
  onClick={handleOptimize}
  disabled={isOptimizing || selectedOrders.size === 0}
  className="min-w-[120px]"
>
  {isOptimizing ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      กำลังคำนวณ...
    </>
  ) : (
    <>
      <Sparkles className="mr-2 h-4 w-4" />
      Optimize
    </>
  )}
</Button>
```

---

## Bug #2: Memory Leak in useEffect

**ปัญหา:** ไม่มี cleanup function ทำให้ setState หลัง unmount

**ไฟล์:** `app/receiving/routes/page.tsx`

### Before (มี bug):
```typescript
useEffect(() => {
  if (isEditorOpen && editorPlanId) {
    fetchEditorData(editorPlanId);
  }
  // ❌ No cleanup function
}, [isEditorOpen, editorPlanId]);
```

### After (แก้แล้ว):
```typescript
useEffect(() => {
  // ✅ ใช้ AbortController สำหรับ cancel fetch
  const abortController = new AbortController();
  let isMounted = true;
  
  const loadEditorData = async () => {
    if (!isEditorOpen || !editorPlanId) return;
    
    try {
      setEditorLoading(true);
      setEditorError(null);
      
      const response = await fetch(
        `/api/route-plans/${editorPlanId}/editor`,
        { signal: abortController.signal }
      );
      
      if (!response.ok) {
        throw new Error('Failed to load editor data');
      }
      
      const { data } = await response.json();
      
      // ✅ Check if still mounted before updating state
      if (isMounted) {
        setEditorData(data);
        setEditorTrips(data.trips || []);
        setOriginalEditorData(structuredClone(data));
      }
      
    } catch (error) {
      // ✅ Ignore abort errors
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Fetch aborted');
        return;
      }
      
      if (isMounted) {
        console.error('Editor data error:', error);
        setEditorError(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด');
      }
    } finally {
      if (isMounted) {
        setEditorLoading(false);
      }
    }
  };
  
  loadEditorData();
  
  // ✅ Cleanup function
  return () => {
    isMounted = false;
    abortController.abort();
  };
}, [isEditorOpen, editorPlanId]);
```

---

## Bug #3: State ไม่ถูก clear เมื่อปิด Modal

**ปัญหา:** `selectedPreviewTripIndices` ไม่ถูก clear ทำให้ trips ผิดถูก highlight

**ไฟล์:** `app/receiving/routes/page.tsx`

### Before (มี bug):
```typescript
const closePreviewModal = () => {
  setShowPreviewModal(false);
  // ❌ ไม่ได้ clear selectedPreviewTripIndices
};
```

### After (แก้แล้ว):
```typescript
const closePreviewModal = useCallback(() => {
  // ✅ Clear all related state
  setShowPreviewModal(false);
  setPreviewData(null);
  setSelectedPreviewTripIndices(new Set());
  setPreviewMapCenter(null);
  setPreviewZoom(12);
}, []);

// ใช้กับ Modal
<Dialog open={showPreviewModal} onOpenChange={(open) => {
  if (!open) closePreviewModal();
}}>
  {/* Modal content */}
</Dialog>
```

---

## Bug #4: VRP Optimization ไม่มี Timeout

**ปัญหา:** Optimization อาจรันไม่มีที่สิ้นสุด ทำให้ server hang

**ไฟล์:** `app/api/route-plans/optimize/route.ts`

### Before (มี bug):
```typescript
export async function POST(request: Request) {
  const body = await request.json();
  
  // ❌ No timeout - can run forever
  const result = await runVRPOptimization(body.orders, body.settings);
  
  return NextResponse.json({ data: result });
}
```

### After (แก้แล้ว):
```typescript
import { NextResponse } from 'next/server';

// Timeout configuration
const VRP_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// Helper function for timeout
function withTimeout<T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(errorMessage));
    }, ms);
    
    promise
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validate input
    if (!body.orders || !Array.isArray(body.orders) || body.orders.length === 0) {
      return NextResponse.json(
        { error: 'Orders are required' },
        { status: 400 }
      );
    }
    
    // ✅ Add timeout wrapper
    const result = await withTimeout(
      runVRPOptimization(body.orders, body.settings),
      VRP_TIMEOUT_MS,
      'การคำนวณใช้เวลานานเกินไป กรุณาลดจำนวนออเดอร์หรือปรับ settings'
    );
    
    return NextResponse.json({ 
      data: result,
      meta: {
        ordersCount: body.orders.length,
        tripsCount: result.trips.length,
        processingTime: result.processingTime,
      }
    });
    
  } catch (error) {
    console.error('VRP Optimization error:', error);
    
    // ✅ Handle timeout error specifically
    if (error instanceof Error && error.message.includes('ใช้เวลานานเกินไป')) {
      return NextResponse.json(
        { error: error.message },
        { status: 408 } // Request Timeout
      );
    }
    
    return NextResponse.json(
      { error: 'การคำนวณล้มเหลว กรุณาลองใหม่อีกครั้ง' },
      { status: 500 }
    );
  }
}
```

### Frontend: แสดง Progress
```typescript
// ใน page.tsx - เพิ่ม progress indicator
const [optimizeProgress, setOptimizeProgress] = useState(0);

const handleOptimize = async () => {
  // ... validation ...
  
  try {
    optimizeLockRef.current = true;
    setIsOptimizing(true);
    setOptimizeProgress(0);
    
    // Fake progress while waiting
    const progressInterval = setInterval(() => {
      setOptimizeProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 10;
      });
    }, 500);
    
    const result = await fetch('/api/route-plans/optimize', {
      // ... options
    });
    
    clearInterval(progressInterval);
    setOptimizeProgress(100);
    
    // ... handle result
    
  } finally {
    setOptimizeProgress(0);
    // ... cleanup
  }
};

// JSX
{isOptimizing && (
  <div className="w-full max-w-xs">
    <Progress value={optimizeProgress} className="h-2" />
    <p className="text-sm text-muted-foreground mt-1">
      กำลังคำนวณเส้นทาง... {Math.round(optimizeProgress)}%
    </p>
  </div>
)}
```

---

## Bug #5: N+1 Query Problem

**ปัญหา:** 61 queries แทนที่จะเป็น 1 query

**ไฟล์:** `app/api/route-plans/route.ts`

### Before (มี bug):
```typescript
export async function GET(request: Request) {
  const supabase = createClient();
  
  // ❌ Query 1: Get plans
  const { data: plans } = await supabase
    .from('receiving_route_plans')
    .select('*')
    .order('created_at', { ascending: false });
  
  // ❌ N queries: Loop through each plan
  const plansWithTrips = await Promise.all(
    (plans || []).map(async (plan) => {
      // Query for trips
      const { data: trips } = await supabase
        .from('receiving_route_trips')
        .select('*')
        .eq('plan_id', plan.plan_id)
        .order('trip_index');
      
      // N more queries: Loop through each trip
      const tripsWithStops = await Promise.all(
        (trips || []).map(async (trip) => {
          const { data: stops } = await supabase
            .from('receiving_route_stops')
            .select('*')
            .eq('trip_id', trip.trip_id)
            .order('sequence');
          
          return { ...trip, stops: stops || [] };
        })
      );
      
      return { ...plan, trips: tripsWithStops };
    })
  );
  
  return NextResponse.json({ data: plansWithTrips });
}
```

### After (แก้แล้ว):
```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    
    // Pagination params
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const offset = (page - 1) * pageSize;
    
    // Filter params
    const warehouseId = searchParams.get('warehouseId');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');
    
    // ✅ Single query with joins - ลด 61 queries เหลือ 1 query
    let query = supabase
      .from('receiving_route_plans')
      .select(`
        *,
        trips:receiving_route_trips(
          *,
          stops:receiving_route_stops(
            *,
            items:receiving_route_stop_items(*)
          )
        ),
        metrics:receiving_route_plan_metrics(*),
        inputs:receiving_route_plan_inputs(count)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);
    
    // Apply filters
    if (warehouseId) {
      query = query.eq('warehouse_id', warehouseId);
    }
    
    if (status) {
      query = query.eq('status', status);
    }
    
    if (startDate) {
      query = query.gte('plan_date', startDate);
    }
    
    if (endDate) {
      query = query.lte('plan_date', endDate);
    }
    
    if (search) {
      query = query.or(`plan_code.ilike.%${search}%,daily_trip_number.ilike.%${search}%`);
    }
    
    const { data: plans, count, error } = await query;
    
    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch route plans' },
        { status: 500 }
      );
    }
    
    // ✅ Sort trips and stops in JavaScript (Supabase doesn't support nested ordering well)
    const sortedPlans = (plans || []).map(plan => ({
      ...plan,
      trips: (plan.trips || [])
        .sort((a: any, b: any) => a.trip_index - b.trip_index)
        .map((trip: any) => ({
          ...trip,
          stops: (trip.stops || [])
            .sort((a: any, b: any) => a.sequence - b.sequence)
        }))
    }));
    
    return NextResponse.json({
      data: sortedPlans,
      meta: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      }
    });
    
  } catch (error) {
    console.error('Route plans API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

## Bug #6: ไม่มี Error Boundary

**ปัญหา:** เมื่อเกิด error หน้าจะแสดงจอขาว

**ไฟล์ใหม่:** `app/receiving/routes/error.tsx`

```typescript
'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to monitoring service (e.g., Sentry)
    console.error('Route Plans Error:', error);
    
    // TODO: Send to error tracking service
    // Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
      <div className="bg-red-50 border border-red-200 rounded-lg p-8 max-w-md w-full text-center">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        
        <h2 className="text-xl font-bold text-red-700 mb-2">
          เกิดข้อผิดพลาด
        </h2>
        
        <p className="text-gray-600 mb-4">
          ไม่สามารถโหลดหน้าแผนเส้นทางได้ กรุณาลองใหม่อีกครั้ง
        </p>
        
        {process.env.NODE_ENV === 'development' && (
          <details className="mb-4 text-left">
            <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
              รายละเอียดข้อผิดพลาด (Development Only)
            </summary>
            <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-auto max-h-40">
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </details>
        )}
        
        <div className="flex gap-3 justify-center">
          <Button
            onClick={reset}
            variant="default"
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            ลองใหม่
          </Button>
          
          <Button
            asChild
            variant="outline"
            className="gap-2"
          >
            <Link href="/receiving">
              <Home className="h-4 w-4" />
              กลับหน้าหลัก
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
```

### เพิ่ม Loading State

**ไฟล์ใหม่:** `app/receiving/routes/loading.tsx`

```typescript
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header Skeleton */}
      <div className="flex justify-between items-center">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      
      {/* Filters Skeleton */}
      <div className="flex gap-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-64" />
      </div>
      
      {/* Table Skeleton */}
      <div className="border rounded-lg">
        {/* Table Header */}
        <div className="border-b bg-muted/50 p-4">
          <div className="flex gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-4 w-24" />
            ))}
          </div>
        </div>
        
        {/* Table Rows */}
        {[1, 2, 3, 4, 5, 6, 7, 8].map((row) => (
          <div key={row} className="border-b p-4">
            <div className="flex gap-4 items-center">
              <Skeleton className="h-4 w-4" />
              {[1, 2, 3, 4, 5, 6].map((col) => (
                <Skeleton key={col} className="h-4 w-24" />
              ))}
            </div>
          </div>
        ))}
      </div>
      
      {/* Pagination Skeleton */}
      <div className="flex justify-between items-center">
        <Skeleton className="h-4 w-48" />
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-8 w-8" />
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

## Bug #7: Batch Update ไม่ใช้ Transaction

**ปัญหา:** ถ้า update ล้มเหลวกลางทาง ข้อมูลจะ inconsistent

**ไฟล์:** `app/api/route-plans/[id]/batch-update/route.ts`

### Before (มี bug):
```typescript
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  const supabase = createClient();
  
  // ❌ No transaction - can fail partially
  for (const trip of body.trips) {
    await supabase
      .from('receiving_route_trips')
      .update({ vehicle_id: trip.vehicle_id, driver_id: trip.driver_id })
      .eq('trip_id', trip.trip_id);
  }
  
  for (const stop of body.stops) {
    await supabase
      .from('receiving_route_stops')
      .update({ sequence: stop.sequence })
      .eq('stop_id', stop.stop_id);
  }
  
  return NextResponse.json({ success: true });
}
```

### After (แก้แล้ว):
```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// Validation schema
const BatchUpdateSchema = z.object({
  trips: z.array(z.object({
    trip_id: z.string().uuid(),
    vehicle_id: z.string().uuid().nullable().optional(),
    driver_id: z.string().uuid().nullable().optional(),
    trip_index: z.number().int().min(0).optional(),
  })).optional(),
  stops: z.array(z.object({
    stop_id: z.string().uuid(),
    trip_id: z.string().uuid(),
    sequence: z.number().int().min(0),
  })).optional(),
  deletedStopIds: z.array(z.string().uuid()).optional(),
  deletedTripIds: z.array(z.string().uuid()).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    
    // ✅ Validate input
    const validationResult = BatchUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.errors },
        { status: 400 }
      );
    }
    
    const { trips, stops, deletedStopIds, deletedTripIds } = validationResult.data;
    const planId = params.id;
    
    const supabase = createClient();
    
    // ✅ Use Supabase RPC for transaction
    const { data, error } = await supabase.rpc('batch_update_route_plan', {
      p_plan_id: planId,
      p_trips: trips || [],
      p_stops: stops || [],
      p_deleted_stop_ids: deletedStopIds || [],
      p_deleted_trip_ids: deletedTripIds || [],
      p_updated_by: 'system', // TODO: Get from auth
    });
    
    if (error) {
      console.error('Batch update error:', error);
      return NextResponse.json(
        { error: 'Failed to update route plan' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data,
      message: 'บันทึกการเปลี่ยนแปลงสำเร็จ',
    });
    
  } catch (error) {
    console.error('Batch update API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### SQL Function (สร้างใน Supabase):
```sql
-- Migration: Create batch_update_route_plan function
CREATE OR REPLACE FUNCTION batch_update_route_plan(
  p_plan_id UUID,
  p_trips JSONB DEFAULT '[]'::JSONB,
  p_stops JSONB DEFAULT '[]'::JSONB,
  p_deleted_stop_ids UUID[] DEFAULT '{}',
  p_deleted_trip_ids UUID[] DEFAULT '{}',
  p_updated_by TEXT DEFAULT 'system'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trip JSONB;
  v_stop JSONB;
  v_result JSONB;
BEGIN
  -- ✅ Start transaction (implicit in function)
  
  -- Delete stops first (foreign key constraint)
  IF array_length(p_deleted_stop_ids, 1) > 0 THEN
    DELETE FROM receiving_route_stops
    WHERE stop_id = ANY(p_deleted_stop_ids);
  END IF;
  
  -- Delete trips
  IF array_length(p_deleted_trip_ids, 1) > 0 THEN
    DELETE FROM receiving_route_trips
    WHERE trip_id = ANY(p_deleted_trip_ids);
  END IF;
  
  -- Update trips
  FOR v_trip IN SELECT * FROM jsonb_array_elements(p_trips)
  LOOP
    UPDATE receiving_route_trips
    SET
      vehicle_id = COALESCE((v_trip->>'vehicle_id')::UUID, vehicle_id),
      driver_id = COALESCE((v_trip->>'driver_id')::UUID, driver_id),
      trip_index = COALESCE((v_trip->>'trip_index')::INT, trip_index),
      updated_at = NOW(),
      updated_by = p_updated_by
    WHERE trip_id = (v_trip->>'trip_id')::UUID
      AND plan_id = p_plan_id;
  END LOOP;
  
  -- Update stops
  FOR v_stop IN SELECT * FROM jsonb_array_elements(p_stops)
  LOOP
    UPDATE receiving_route_stops
    SET
      trip_id = COALESCE((v_stop->>'trip_id')::UUID, trip_id),
      sequence = COALESCE((v_stop->>'sequence')::INT, sequence),
      updated_at = NOW()
    WHERE stop_id = (v_stop->>'stop_id')::UUID;
  END LOOP;
  
  -- Update plan timestamp
  UPDATE receiving_route_plans
  SET updated_at = NOW(), updated_by = p_updated_by
  WHERE plan_id = p_plan_id;
  
  -- Return success
  v_result := jsonb_build_object(
    'success', true,
    'trips_updated', jsonb_array_length(p_trips),
    'stops_updated', jsonb_array_length(p_stops),
    'stops_deleted', array_length(p_deleted_stop_ids, 1),
    'trips_deleted', array_length(p_deleted_trip_ids, 1)
  );
  
  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  -- ✅ Transaction will be rolled back automatically
  RAISE EXCEPTION 'Batch update failed: %', SQLERRM;
END;
$$;
```

---

## Bug #8: Stale Closure ใน handleMoveOrder

**ปัญหา:** Function ใช้ state เก่าเพราะ closure

**ไฟล์:** `app/receiving/routes/page.tsx`

### Before (มี bug):
```typescript
const handleMoveOrder = (orderId: string, targetTripId: string) => {
  // ❌ Uses stale editorTrips from closure
  const updatedTrips = editorTrips.map(trip => {
    // Remove from all trips
    const filteredStops = trip.stops.filter(stop => 
      !stop.items.some(item => item.order_id === orderId)
    );
    
    // Add to target trip
    if (trip.trip_id === targetTripId) {
      // ... add logic
    }
    
    return { ...trip, stops: filteredStops };
  });
  
  setEditorTrips(updatedTrips);
};
```

### After (แก้แล้ว):
```typescript
const handleMoveOrder = useCallback((orderId: string, targetTripId: string) => {
  // ✅ Use functional update to get latest state
  setEditorTrips(prevTrips => {
    // Find the order and its current trip
    let orderData: OrderItem | null = null;
    let sourceTripId: string | null = null;
    
    for (const trip of prevTrips) {
      for (const stop of trip.stops) {
        const item = stop.items.find(i => i.order_id === orderId);
        if (item) {
          orderData = item;
          sourceTripId = trip.trip_id;
          break;
        }
      }
      if (orderData) break;
    }
    
    if (!orderData || !sourceTripId || sourceTripId === targetTripId) {
      return prevTrips;
    }
    
    return prevTrips.map(trip => {
      if (trip.trip_id === sourceTripId) {
        // Remove order from source trip
        return {
          ...trip,
          stops: trip.stops.map(stop => ({
            ...stop,
            items: stop.items.filter(item => item.order_id !== orderId)
          })).filter(stop => stop.items.length > 0) // Remove empty stops
        };
      }
      
      if (trip.trip_id === targetTripId) {
        // Add order to target trip
        const newStop: Stop = {
          stop_id: crypto.randomUUID(),
          trip_id: targetTripId,
          sequence: trip.stops.length,
          customer_id: orderData!.customer_id,
          customer_name: orderData!.customer_name,
          latitude: orderData!.latitude,
          longitude: orderData!.longitude,
          items: [orderData!],
          created_at: new Date().toISOString(),
        };
        
        return {
          ...trip,
          stops: [...trip.stops, newStop]
        };
      }
      
      return trip;
    });
  });
  
  // Mark as modified
  setHasUnsavedChanges(true);
  
}, []); // ✅ No dependencies needed with functional update
```

---

# 🔧 Bug Fix Code - High Priority Issues (P1)

## Bug #9: Too Many useState (50+)

**ปัญหา:** State 50+ ตัวทำให้ยากต่อการ maintain

### สร้าง useReducer แทน

**ไฟล์ใหม่:** `app/receiving/routes/hooks/useRoutePlanState.ts`

```typescript
import { useReducer, useCallback, Dispatch } from 'react';

// ============ Types ============
export interface RoutePlan {
  plan_id: string;
  plan_code: string;
  plan_date: string;
  status: string;
  warehouse_id: string;
  trips: Trip[];
}

export interface Trip {
  trip_id: string;
  trip_index: number;
  vehicle_id: string | null;
  driver_id: string | null;
  stops: Stop[];
}

export interface Stop {
  stop_id: string;
  trip_id: string;
  sequence: number;
  customer_id: string;
  customer_name: string;
  latitude: number;
  longitude: number;
  items: OrderItem[];
}

export interface OrderItem {
  item_id: string;
  order_id: string;
  customer_id: string;
  customer_name: string;
  latitude: number;
  longitude: number;
  quantity: number;
}

// ============ State Interface ============
export interface RoutePlanState {
  // List view
  plans: RoutePlan[];
  isLoading: boolean;
  error: string | null;
  
  // Filters
  filters: {
    warehouseId: string | null;
    status: string | null;
    startDate: string | null;
    endDate: string | null;
    search: string;
  };
  
  // Pagination
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
  
  // Selected items
  selectedPlanIds: Set<string>;
  expandedPlanIds: Set<string>;
  
  // Create modal
  createModal: {
    isOpen: boolean;
    step: 'select' | 'configure' | 'preview';
    selectedOrders: Set<string>;
    vrpSettings: VRPSettings;
    isOptimizing: boolean;
    previewData: any | null;
  };
  
  // Editor
  editor: {
    isOpen: boolean;
    planId: string | null;
    data: RoutePlan | null;
    originalData: RoutePlan | null;
    isLoading: boolean;
    hasUnsavedChanges: boolean;
    isSaving: boolean;
  };
  
  // Other modals
  modals: {
    splitStop: { isOpen: boolean; stopId: string | null };
    crossPlanTransfer: { isOpen: boolean; orderId: string | null };
    confirmDelete: { isOpen: boolean; planId: string | null };
  };
}

export interface VRPSettings {
  maxStopsPerTrip: number;
  maxWeightPerTrip: number;
  maxVolumePerTrip: number;
  startTime: string;
  endTime: string;
  algorithm: 'greedy' | 'genetic' | 'simulated_annealing';
}

// ============ Actions ============
type Action =
  // List actions
  | { type: 'SET_PLANS'; payload: RoutePlan[] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_PAGINATION'; payload: Partial<RoutePlanState['pagination']> }
  
  // Filter actions
  | { type: 'SET_FILTER'; payload: { key: keyof RoutePlanState['filters']; value: any } }
  | { type: 'RESET_FILTERS' }
  
  // Selection actions
  | { type: 'TOGGLE_PLAN_SELECTION'; payload: string }
  | { type: 'SELECT_ALL_PLANS'; payload: string[] }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'TOGGLE_PLAN_EXPAND'; payload: string }
  
  // Create modal actions
  | { type: 'OPEN_CREATE_MODAL' }
  | { type: 'CLOSE_CREATE_MODAL' }
  | { type: 'SET_CREATE_STEP'; payload: 'select' | 'configure' | 'preview' }
  | { type: 'TOGGLE_ORDER_SELECTION'; payload: string }
  | { type: 'SELECT_ALL_ORDERS'; payload: string[] }
  | { type: 'CLEAR_ORDER_SELECTION' }
  | { type: 'SET_VRP_SETTINGS'; payload: Partial<VRPSettings> }
  | { type: 'SET_OPTIMIZING'; payload: boolean }
  | { type: 'SET_PREVIEW_DATA'; payload: any }
  
  // Editor actions
  | { type: 'OPEN_EDITOR'; payload: string }
  | { type: 'CLOSE_EDITOR' }
  | { type: 'SET_EDITOR_DATA'; payload: RoutePlan }
  | { type: 'SET_EDITOR_LOADING'; payload: boolean }
  | { type: 'SET_EDITOR_SAVING'; payload: boolean }
  | { type: 'UPDATE_EDITOR_TRIPS'; payload: Trip[] }
  | { type: 'MARK_EDITOR_DIRTY' }
  | { type: 'MARK_EDITOR_CLEAN' }
  
  // Modal actions
  | { type: 'OPEN_SPLIT_MODAL'; payload: string }
  | { type: 'CLOSE_SPLIT_MODAL' }
  | { type: 'OPEN_TRANSFER_MODAL'; payload: string }
  | { type: 'CLOSE_TRANSFER_MODAL' }
  | { type: 'OPEN_DELETE_MODAL'; payload: string }
  | { type: 'CLOSE_DELETE_MODAL' };

// ============ Initial State ============
const initialState: RoutePlanState = {
  plans: [],
  isLoading: false,
  error: null,
  
  filters: {
    warehouseId: null,
    status: null,
    startDate: null,
    endDate: null,
    search: '',
  },
  
  pagination: {
    page: 1,
    pageSize: 20,
    total: 0,
  },
  
  selectedPlanIds: new Set(),
  expandedPlanIds: new Set(),
  
  createModal: {
    isOpen: false,
    step: 'select',
    selectedOrders: new Set(),
    vrpSettings: {
      maxStopsPerTrip: 10,
      maxWeightPerTrip: 1000,
      maxVolumePerTrip: 10,
      startTime: '08:00',
      endTime: '18:00',
      algorithm: 'genetic',
    },
    isOptimizing: false,
    previewData: null,
  },
  
  editor: {
    isOpen: false,
    planId: null,
    data: null,
    originalData: null,
    isLoading: false,
    hasUnsavedChanges: false,
    isSaving: false,
  },
  
  modals: {
    splitStop: { isOpen: false, stopId: null },
    crossPlanTransfer: { isOpen: false, orderId: null },
    confirmDelete: { isOpen: false, planId: null },
  },
};

// ============ Reducer ============
function routePlanReducer(state: RoutePlanState, action: Action): RoutePlanState {
  switch (action.type) {
    // List actions
    case 'SET_PLANS':
      return { ...state, plans: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_PAGINATION':
      return { ...state, pagination: { ...state.pagination, ...action.payload } };
    
    // Filter actions
    case 'SET_FILTER':
      return {
        ...state,
        filters: { ...state.filters, [action.payload.key]: action.payload.value },
        pagination: { ...state.pagination, page: 1 }, // Reset to page 1 on filter change
      };
    case 'RESET_FILTERS':
      return { ...state, filters: initialState.filters, pagination: { ...state.pagination, page: 1 } };
    
    // Selection actions
    case 'TOGGLE_PLAN_SELECTION': {
      const newSelected = new Set(state.selectedPlanIds);
      if (newSelected.has(action.payload)) {
        newSelected.delete(action.payload);
      } else {
        newSelected.add(action.payload);
      }
      return { ...state, selectedPlanIds: newSelected };
    }
    case 'SELECT_ALL_PLANS':
      return { ...state, selectedPlanIds: new Set(action.payload) };
    case 'CLEAR_SELECTION':
      return { ...state, selectedPlanIds: new Set() };
    case 'TOGGLE_PLAN_EXPAND': {
      const newExpanded = new Set(state.expandedPlanIds);
      if (newExpanded.has(action.payload)) {
        newExpanded.delete(action.payload);
      } else {
        newExpanded.add(action.payload);
      }
      return { ...state, expandedPlanIds: newExpanded };
    }
    
    // Create modal actions
    case 'OPEN_CREATE_MODAL':
      return { ...state, createModal: { ...initialState.createModal, isOpen: true } };
    case 'CLOSE_CREATE_MODAL':
      return { ...state, createModal: initialState.createModal };
    case 'SET_CREATE_STEP':
      return { ...state, createModal: { ...state.createModal, step: action.payload } };
    case 'TOGGLE_ORDER_SELECTION': {
      const newSelected = new Set(state.createModal.selectedOrders);
      if (newSelected.has(action.payload)) {
        newSelected.delete(action.payload);
      } else {
        newSelected.add(action.payload);
      }
      return { ...state, createModal: { ...state.createModal, selectedOrders: newSelected } };
    }
    case 'SELECT_ALL_ORDERS':
      return { ...state, createModal: { ...state.createModal, selectedOrders: new Set(action.payload) } };
    case 'CLEAR_ORDER_SELECTION':
      return { ...state, createModal: { ...state.createModal, selectedOrders: new Set() } };
    case 'SET_VRP_SETTINGS':
      return { ...state, createModal: { ...state.createModal, vrpSettings: { ...state.createModal.vrpSettings, ...action.payload } } };
    case 'SET_OPTIMIZING':
      return { ...state, createModal: { ...state.createModal, isOptimizing: action.payload } };
    case 'SET_PREVIEW_DATA':
      return { ...state, createModal: { ...state.createModal, previewData: action.payload, step: 'preview' } };
    
    // Editor actions
    case 'OPEN_EDITOR':
      return { ...state, editor: { ...state.editor, isOpen: true, planId: action.payload, isLoading: true } };
    case 'CLOSE_EDITOR':
      return { ...state, editor: initialState.editor };
    case 'SET_EDITOR_DATA':
      return {
        ...state,
        editor: {
          ...state.editor,
          data: action.payload,
          originalData: structuredClone(action.payload),
          isLoading: false,
        },
      };
    case 'SET_EDITOR_LOADING':
      return { ...state, editor: { ...state.editor, isLoading: action.payload } };
    case 'SET_EDITOR_SAVING':
      return { ...state, editor: { ...state.editor, isSaving: action.payload } };
    case 'UPDATE_EDITOR_TRIPS':
      return {
        ...state,
        editor: {
          ...state.editor,
          data: state.editor.data ? { ...state.editor.data, trips: action.payload } : null,
          hasUnsavedChanges: true,
        },
      };
    case 'MARK_EDITOR_DIRTY':
      return { ...state, editor: { ...state.editor, hasUnsavedChanges: true } };
    case 'MARK_EDITOR_CLEAN':
      return { ...state, editor: { ...state.editor, hasUnsavedChanges: false } };
    
    // Other modal actions
    case 'OPEN_SPLIT_MODAL':
      return { ...state, modals: { ...state.modals, splitStop: { isOpen: true, stopId: action.payload } } };
    case 'CLOSE_SPLIT_MODAL':
      return { ...state, modals: { ...state.modals, splitStop: { isOpen: false, stopId: null } } };
    case 'OPEN_TRANSFER_MODAL':
      return { ...state, modals: { ...state.modals, crossPlanTransfer: { isOpen: true, orderId: action.payload } } };
    case 'CLOSE_TRANSFER_MODAL':
      return { ...state, modals: { ...state.modals, crossPlanTransfer: { isOpen: false, orderId: null } } };
    case 'OPEN_DELETE_MODAL':
      return { ...state, modals: { ...state.modals, confirmDelete: { isOpen: true, planId: action.payload } } };
    case 'CLOSE_DELETE_MODAL':
      return { ...state, modals: { ...state.modals, confirmDelete: { isOpen: false, planId: null } } };
    
    default:
      return state;
  }
}

// ============ Hook ============
export function useRoutePlanState() {
  const [state, dispatch] = useReducer(routePlanReducer, initialState);
  
  // Memoized action creators
  const actions = {
    // List
    setPlans: useCallback((plans: RoutePlan[]) => dispatch({ type: 'SET_PLANS', payload: plans }), []),
    setLoading: useCallback((loading: boolean) => dispatch({ type: 'SET_LOADING', payload: loading }), []),
    setError: useCallback((error: string | null) => dispatch({ type: 'SET_ERROR', payload: error }), []),
    setPagination: useCallback((pagination: Partial<RoutePlanState['pagination']>) => dispatch({ type: 'SET_PAGINATION', payload: pagination }), []),
    
    // Filters
    setFilter: useCallback((key: keyof RoutePlanState['filters'], value: any) => dispatch({ type: 'SET_FILTER', payload: { key, value } }), []),
    resetFilters: useCallback(() => dispatch({ type: 'RESET_FILTERS' }), []),
    
    // Selection
    togglePlanSelection: useCallback((planId: string) => dispatch({ type: 'TOGGLE_PLAN_SELECTION', payload: planId }), []),
    selectAllPlans: useCallback((planIds: string[]) => dispatch({ type: 'SELECT_ALL_PLANS', payload: planIds }), []),
    clearSelection: useCallback(() => dispatch({ type: 'CLEAR_SELECTION' }), []),
    togglePlanExpand: useCallback((planId: string) => dispatch({ type: 'TOGGLE_PLAN_EXPAND', payload: planId }), []),
    
    // Create modal
    openCreateModal: useCallback(() => dispatch({ type: 'OPEN_CREATE_MODAL' }), []),
    closeCreateModal: useCallback(() => dispatch({ type: 'CLOSE_CREATE_MODAL' }), []),
    setCreateStep: useCallback((step: 'select' | 'configure' | 'preview') => dispatch({ type: 'SET_CREATE_STEP', payload: step }), []),
    toggleOrderSelection: useCallback((orderId: string) => dispatch({ type: 'TOGGLE_ORDER_SELECTION', payload: orderId }), []),
    selectAllOrders: useCallback((orderIds: string[]) => dispatch({ type: 'SELECT_ALL_ORDERS', payload: orderIds }), []),
    clearOrderSelection: useCallback(() => dispatch({ type: 'CLEAR_ORDER_SELECTION' }), []),
    setVrpSettings: useCallback((settings: Partial<VRPSettings>) => dispatch({ type: 'SET_VRP_SETTINGS', payload: settings }), []),
    setOptimizing: useCallback((optimizing: boolean) => dispatch({ type: 'SET_OPTIMIZING', payload: optimizing }), []),
    setPreviewData: useCallback((data: any) => dispatch({ type: 'SET_PREVIEW_DATA', payload: data }), []),
    
    // Editor
    openEditor: useCallback((planId: string) => dispatch({ type: 'OPEN_EDITOR', payload: planId }), []),
    closeEditor: useCallback(() => dispatch({ type: 'CLOSE_EDITOR' }), []),
    setEditorData: useCallback((data: RoutePlan) => dispatch({ type: 'SET_EDITOR_DATA', payload: data }), []),
    setEditorLoading: useCallback((loading: boolean) => dispatch({ type: 'SET_EDITOR_LOADING', payload: loading }), []),
    setEditorSaving: useCallback((saving: boolean) => dispatch({ type: 'SET_EDITOR_SAVING', payload: saving }), []),
    updateEditorTrips: useCallback((trips: Trip[]) => dispatch({ type: 'UPDATE_EDITOR_TRIPS', payload: trips }), []),
    markEditorDirty: useCallback(() => dispatch({ type: 'MARK_EDITOR_DIRTY' }), []),
    markEditorClean: useCallback(() => dispatch({ type: 'MARK_EDITOR_CLEAN' }), []),
    
    // Other modals
    openSplitModal: useCallback((stopId: string) => dispatch({ type: 'OPEN_SPLIT_MODAL', payload: stopId }), []),
    closeSplitModal: useCallback(() => dispatch({ type: 'CLOSE_SPLIT_MODAL' }), []),
    openTransferModal: useCallback((orderId: string) => dispatch({ type: 'OPEN_TRANSFER_MODAL', payload: orderId }), []),
    closeTransferModal: useCallback(() => dispatch({ type: 'CLOSE_TRANSFER_MODAL' }), []),
    openDeleteModal: useCallback((planId: string) => dispatch({ type: 'OPEN_DELETE_MODAL', payload: planId }), []),
    closeDeleteModal: useCallback(() => dispatch({ type: 'CLOSE_DELETE_MODAL' }), []),
  };
  
  return { state, actions, dispatch };
}

export type RoutePlanActions = ReturnType<typeof useRoutePlanState>['actions'];
```

### วิธีใช้ใน page.tsx:

```typescript
// app/receiving/routes/page.tsx
'use client';

import { useRoutePlanState } from './hooks/useRoutePlanState';

export default function RoutesPage() {
  const { state, actions } = useRoutePlanState();
  
  // ✅ ใช้ state แบบนี้
  const { plans, isLoading, filters, pagination, createModal, editor } = state;
  
  // ✅ ใช้ actions แบบนี้
  const handleSearch = (term: string) => {
    actions.setFilter('search', term);
  };
  
  const handleCreatePlan = () => {
    actions.openCreateModal();
  };
  
  const handleEditPlan = (planId: string) => {
    actions.openEditor(planId);
  };
  
  // ... rest of component
}
```

---

## Bug #12: Search ไม่มี Debounce

**ปัญหา:** API ถูกเรียกทุกครั้งที่พิมพ์ตัวอักษร

**ไฟล์ใหม่:** `app/receiving/routes/hooks/useDebouncedSearch.ts`

```typescript
import { useState, useEffect, useRef, useCallback } from 'react';

interface UseDebouncedSearchOptions {
  delay?: number;
  minLength?: number;
}

export function useDebouncedSearch(
  searchFn: (term: string) => void | Promise<void>,
  options: UseDebouncedSearchOptions = {}
) {
  const { delay = 300, minLength = 0 } = options;
  
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Debounce effect
  useEffect(() => {
    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Don't search if below minimum length
    if (searchTerm.length > 0 && searchTerm.length < minLength) {
      return;
    }
    
    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      setDebouncedTerm(searchTerm);
    }, delay);
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [searchTerm, delay, minLength]);
  
  // Execute search when debounced term changes
  useEffect(() => {
    const executeSearch = async () => {
      // Cancel previous search
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      // Create new abort controller
      abortControllerRef.current = new AbortController();
      
      try {
        setIsSearching(true);
        await searchFn(debouncedTerm);
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('Search error:', error);
        }
      } finally {
        setIsSearching(false);
      }
    };
    
    executeSearch();
  }, [debouncedTerm, searchFn]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);
  
  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setDebouncedTerm('');
  }, []);
  
  return {
    searchTerm,
    setSearchTerm,
    debouncedTerm,
    isSearching,
    clearSearch,
  };
}
```

### วิธีใช้:

```typescript
// ใน page.tsx
const { searchTerm, setSearchTerm, isSearching } = useDebouncedSearch(
  async (term) => {
    actions.setFilter('search', term);
    await fetchPlans();
  },
  { delay: 300, minLength: 2 }
);

// ใน JSX
<div className="relative">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
  <Input
    value={searchTerm}
    onChange={(e) => setSearchTerm(e.target.value)}
    placeholder="ค้นหาแผน..."
    className="pl-9 pr-9"
  />
  {isSearching && (
    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />
  )}
  {searchTerm && !isSearching && (
    <button
      onClick={() => setSearchTerm('')}
      className="absolute right-3 top-1/2 -translate-y-1/2"
    >
      <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
    </button>
  )}
</div>
```

---

## Bug #15: ไม่มี Pagination

**ไฟล์ใหม่:** `app/receiving/routes/components/Pagination.tsx`

```typescript
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

export function Pagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
}: PaginationProps) {
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);
  
  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible + 2) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      if (currentPage > 3) {
        pages.push('ellipsis');
      }
      
      // Show pages around current
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (currentPage < totalPages - 2) {
        pages.push('ellipsis');
      }
      
      // Always show last page
      pages.push(totalPages);
    }
    
    return pages;
  };
  
  return (
    <div className="flex items-center justify-between px-2 py-4">
      {/* Items info */}
      <div className="text-sm text-muted-foreground">
        แสดง {startItem}-{endItem} จาก {totalItems} รายการ
      </div>
      
      {/* Page size selector */}
      {onPageSizeChange && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">แสดง</span>
          <Select
            value={pageSize.toString()}
            onValueChange={(value) => onPageSizeChange(parseInt(value))}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={size.toString()}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">รายการ</span>
        </div>
      )}
      
      {/* Page navigation */}
      <div className="flex items-center gap-1">
        {/* First page */}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        
        {/* Previous page */}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        {/* Page numbers */}
        {getPageNumbers().map((page, index) => (
          page === 'ellipsis' ? (
            <span key={`ellipsis-${index}`} className="px-2 text-muted-foreground">
              ...
            </span>
          ) : (
            <Button
              key={page}
              variant={currentPage === page ? 'default' : 'outline'}
              size="icon"
              className="h-8 w-8"
              onClick={() => onPageChange(page)}
            >
              {page}
            </Button>
          )
        ))}
        
        {/* Next page */}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        
        {/* Last page */}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
```

---

# 📁 Refactor Plan

## เป้าหมาย
แยก `page.tsx` (3,323 บรรทัด) ออกเป็น components ที่จัดการได้

## โครงสร้างใหม่

```
app/receiving/routes/
├── page.tsx                          # Main page (~200 lines)
├── error.tsx                         # Error boundary
├── loading.tsx                       # Loading skeleton
├── layout.tsx                        # Optional layout
│
├── components/
│   ├── index.ts                      # Export all components
│   │
│   ├── RoutesPlanTable/
│   │   ├── index.tsx                 # Table component (~300 lines)
│   │   ├── TableRow.tsx              # Single row
│   │   ├── ExpandedTrips.tsx         # Expanded trips section
│   │   └── TableActions.tsx          # Action buttons
│   │
│   ├── CreatePlanModal/
│   │   ├── index.tsx                 # Modal wrapper (~100 lines)
│   │   ├── OrderSelection.tsx        # Step 1: Select orders
│   │   ├── VRPConfiguration.tsx      # Step 2: Configure VRP
│   │   └── PreviewResults.tsx        # Step 3: Preview
│   │
│   ├── ExcelEditor/
│   │   ├── index.tsx                 # Editor wrapper (~200 lines)
│   │   ├── TripRow.tsx               # Trip row
│   │   ├── StopRow.tsx               # Stop row (draggable)
│   │   ├── EditorToolbar.tsx         # Save, undo, etc.
│   │   └── DragContext.tsx           # DnD context
│   │
│   ├── Modals/
│   │   ├── SplitStopModal.tsx        # Split stop
│   │   ├── CrossPlanTransferModal.tsx
│   │   ├── MultiPlanContractModal.tsx
│   │   ├── ConfirmDeleteModal.tsx
│   │   └── index.ts
│   │
│   ├── Filters/
│   │   ├── FilterBar.tsx             # All filters
│   │   ├── DateRangePicker.tsx
│   │   ├── WarehouseSelect.tsx
│   │   └── StatusFilter.tsx
│   │
│   └── shared/
│       ├── Pagination.tsx
│       ├── EmptyState.tsx
│       ├── ErrorAlert.tsx
│       └── MetricCard.tsx
│
├── hooks/
│   ├── index.ts
│   ├── useRoutePlanState.ts          # Main state reducer
│   ├── useRoutePlans.ts              # Fetch plans
│   ├── useEditorData.ts              # Fetch/save editor
│   ├── useDebouncedSearch.ts         # Search with debounce
│   ├── useOptimization.ts            # VRP optimization
│   └── useConfirmDialog.ts           # Confirmation logic
│
├── api/
│   ├── index.ts
│   ├── routePlans.ts                 # API functions
│   ├── optimization.ts               # VRP API
│   └── types.ts                      # API types
│
├── types/
│   └── index.ts                      # All types
│
├── utils/
│   ├── index.ts
│   ├── formatters.ts                 # Date, number formatters
│   ├── validators.ts                 # Zod schemas
│   └── calculations.ts               # Distance, weight calc
│
└── constants/
    └── index.ts                      # VRP defaults, statuses
```

## Refactored page.tsx (~200 lines)

```typescript
'use client';

import { useEffect } from 'react';
import { useRoutePlanState } from './hooks/useRoutePlanState';
import { useRoutePlans } from './hooks/useRoutePlans';

// Components
import { RoutesPlanTable } from './components/RoutesPlanTable';
import { FilterBar } from './components/Filters/FilterBar';
import { CreatePlanModal } from './components/CreatePlanModal';
import { ExcelEditor } from './components/ExcelEditor';
import { Pagination } from './components/shared/Pagination';
import { EmptyState } from './components/shared/EmptyState';
import {
  SplitStopModal,
  CrossPlanTransferModal,
  ConfirmDeleteModal,
} from './components/Modals';

// UI Components
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function RoutesPage() {
  // ✅ Single state hook instead of 50+ useState
  const { state, actions } = useRoutePlanState();
  
  // ✅ Data fetching hook
  const { fetchPlans, isLoading, error } = useRoutePlans(state.filters, state.pagination);
  
  // Fetch on mount and filter change
  useEffect(() => {
    fetchPlans();
  }, [state.filters, state.pagination.page, state.pagination.pageSize]);
  
  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">แผนเส้นทาง</h1>
        <Button onClick={actions.openCreateModal}>
          <Plus className="mr-2 h-4 w-4" />
          สร้างแผนใหม่
        </Button>
      </div>
      
      {/* Filters */}
      <FilterBar
        filters={state.filters}
        onFilterChange={actions.setFilter}
        onReset={actions.resetFilters}
      />
      
      {/* Table */}
      {state.plans.length === 0 && !isLoading ? (
        <EmptyState
          title="ไม่พบแผนเส้นทาง"
          description="เริ่มต้นสร้างแผนใหม่โดยคลิกปุ่มด้านบน"
          action={
            <Button onClick={actions.openCreateModal}>
              <Plus className="mr-2 h-4 w-4" />
              สร้างแผนใหม่
            </Button>
          }
        />
      ) : (
        <>
          <RoutesPlanTable
            plans={state.plans}
            isLoading={isLoading}
            selectedIds={state.selectedPlanIds}
            expandedIds={state.expandedPlanIds}
            onToggleSelect={actions.togglePlanSelection}
            onToggleExpand={actions.togglePlanExpand}
            onEdit={actions.openEditor}
            onDelete={actions.openDeleteModal}
          />
          
          <Pagination
            currentPage={state.pagination.page}
            totalPages={Math.ceil(state.pagination.total / state.pagination.pageSize)}
            pageSize={state.pagination.pageSize}
            totalItems={state.pagination.total}
            onPageChange={(page) => actions.setPagination({ page })}
            onPageSizeChange={(pageSize) => actions.setPagination({ pageSize, page: 1 })}
          />
        </>
      )}
      
      {/* Modals */}
      <CreatePlanModal
        isOpen={state.createModal.isOpen}
        onClose={actions.closeCreateModal}
        state={state.createModal}
        actions={actions}
      />
      
      <ExcelEditor
        isOpen={state.editor.isOpen}
        onClose={actions.closeEditor}
        planId={state.editor.planId}
        onSaveSuccess={fetchPlans}
      />
      
      <SplitStopModal
        isOpen={state.modals.splitStop.isOpen}
        stopId={state.modals.splitStop.stopId}
        onClose={actions.closeSplitModal}
        onSuccess={fetchPlans}
      />
      
      <CrossPlanTransferModal
        isOpen={state.modals.crossPlanTransfer.isOpen}
        orderId={state.modals.crossPlanTransfer.orderId}
        onClose={actions.closeTransferModal}
        onSuccess={fetchPlans}
      />
      
      <ConfirmDeleteModal
        isOpen={state.modals.confirmDelete.isOpen}
        planId={state.modals.confirmDelete.planId}
        onClose={actions.closeDeleteModal}
        onSuccess={fetchPlans}
      />
    </div>
  );
}
```

---

# ✅ Developer Checklist

## Sprint 1: Critical Bugs (P0)

### Day 1-2: Race Condition & Timeout
- [ ] **Bug #1: Race Condition**
  - [ ] เพิ่ม `optimizeLockRef` ใน page.tsx
  - [ ] แก้ไข `handleOptimize` ให้ check lock ก่อน
  - [ ] เพิ่ม try-finally เพื่อ unlock เสมอ
  - [ ] Test: กดปุ่ม Optimize เร็วๆ หลายครั้ง
  - [ ] Test: ตรวจสอบว่าไม่มี duplicate plans

- [ ] **Bug #4: VRP Timeout**
  - [ ] เพิ่ม `withTimeout` helper function
  - [ ] แก้ไข `/api/route-plans/optimize/route.ts`
  - [ ] Set timeout 5 นาที
  - [ ] เพิ่ม proper error response (408)
  - [ ] Test: ส่ง 1000+ orders และดูว่า timeout ทำงาน

### Day 3: N+1 Query
- [ ] **Bug #5: N+1 Query**
  - [ ] แก้ไข `/api/route-plans/route.ts`
  - [ ] ใช้ single query with joins
  - [ ] เพิ่ม filters (warehouse, status, date)
  - [ ] เพิ่ม pagination
  - [ ] Test: ตรวจสอบ query count ใน Supabase logs
  - [ ] Test: ตรวจสอบ response time < 500ms

### Day 4: Transaction & Error Boundary
- [ ] **Bug #7: Batch Update Transaction**
  - [ ] สร้าง SQL function `batch_update_route_plan`
  - [ ] Deploy migration to Supabase
  - [ ] แก้ไข `/api/route-plans/[id]/batch-update/route.ts`
  - [ ] เพิ่ม Zod validation
  - [ ] Test: ทำให้ update ล้มเหลวกลางทาง และดูว่า rollback

- [ ] **Bug #6: Error Boundary**
  - [ ] สร้าง `app/receiving/routes/error.tsx`
  - [ ] สร้าง `app/receiving/routes/loading.tsx`
  - [ ] Test: throw error และดูว่า error page แสดง
  - [ ] Test: slow network และดูว่า loading skeleton แสดง

### Day 5: Memory Leaks & Stale Closure
- [ ] **Bug #2: Memory Leak**
  - [ ] หา useEffect ทั้งหมดที่มี fetch
  - [ ] เพิ่ม AbortController
  - [ ] เพิ่ม cleanup function
  - [ ] เพิ่ม `isMounted` check
  - [ ] Test: เปิด-ปิด editor เร็วๆ และดู console

- [ ] **Bug #3: State not cleared**
  - [ ] แก้ไข `closePreviewModal`
  - [ ] Clear ทุก related state
  - [ ] Test: เปิด preview > ปิด > เปิดใหม่ > ตรวจสอบ state

- [ ] **Bug #8: Stale Closure**
  - [ ] แก้ไข `handleMoveOrder` ใช้ functional update
  - [ ] ลบ dependencies ที่ไม่จำเป็น
  - [ ] Test: ลาก order ไป trip อื่นหลายครั้งติดต่อกัน

---

## Sprint 2: High Priority (P1)

### Day 1-2: useReducer Refactor
- [ ] **Bug #9: Too Many States**
  - [ ] สร้าง `hooks/useRoutePlanState.ts`
  - [ ] Define RoutePlanState interface
  - [ ] Define all Actions
  - [ ] Implement reducer
  - [ ] Implement action creators
  - [ ] แทนที่ useState ใน page.tsx
  - [ ] Test: ทุก feature ยังทำงานได้

### Day 3: Validation & Debounce
- [ ] **Bug #10: Missing Validation**
  - [ ] เพิ่ม Zod schemas ใน `utils/validators.ts`
  - [ ] Validate ก่อน API calls
  - [ ] แสดง validation errors
  - [ ] Test: ส่ง invalid data และดู error

- [ ] **Bug #12: No Debounce**
  - [ ] สร้าง `hooks/useDebouncedSearch.ts`
  - [ ] ใช้ในหน้า routes
  - [ ] Test: พิมพ์เร็วๆ และดูว่า API ไม่ถูกเรียกทุกตัวอักษร

### Day 4: Pagination & Context
- [ ] **Bug #15: No Pagination**
  - [ ] สร้าง `components/shared/Pagination.tsx`
  - [ ] แก้ไข API ให้รองรับ pagination
  - [ ] ใช้ pagination ใน page
  - [ ] Test: หน้าที่มี 100+ plans

- [ ] **Bug #13: Prop Drilling**
  - [ ] สร้าง RoutePlanContext
  - [ ] Wrap page ด้วย Provider
  - [ ] ใช้ useContext ใน components
  - [ ] Test: ตรวจสอบว่า props ไม่ถูกส่งผ่าน 5 levels

### Day 5: Testing & QA
- [ ] Run all manual tests
- [ ] Fix any regression bugs
- [ ] Performance testing
- [ ] Deploy to staging

---

## Sprint 3: Refactoring

### Week 1
- [ ] Extract `RoutesPlanTable` component
- [ ] Extract `CreatePlanModal` component
- [ ] Extract `ExcelEditor` component
- [ ] Create shared components (Pagination, EmptyState, etc.)

### Week 2
- [ ] Extract all hooks
- [ ] Create API layer
- [ ] Create types module
- [ ] Create constants module
- [ ] Refactor page.tsx to use new components
- [ ] Test all features

---

## Sprint 4: Testing & Polish

- [ ] Write unit tests for hooks
- [ ] Write unit tests for utils
- [ ] Write integration tests
- [ ] Fix Medium priority bugs (#16-#20)
- [ ] Add Sentry error tracking
- [ ] Performance optimization
- [ ] Documentation
- [ ] Deploy to production

---

## Definition of Done

แต่ละ bug ต้อง:
- [ ] Code reviewed
- [ ] Unit tests ผ่าน
- [ ] Manual testing ผ่าน
- [ ] No regression
- [ ] Merged to main
- [ ] Deployed to staging

---

## Quick Commands

```bash
# Run tests
npm test

# Run specific test file
npm test -- --testPathPattern="routes"

# Check TypeScript
npm run type-check

# Lint
npm run lint

# Build
npm run build

# Deploy to staging
git push origin main

# Check Supabase logs
supabase logs
```

---

**สร้างโดย:** Claude AI  
**วันที่:** 17 มกราคม 2026  
**Version:** 1.0