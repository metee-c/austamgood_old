# Bug Fixes Implementation - Priority 1 (P0)

**วันที่:** 17 มกราคม 2026  
**ผู้ดำเนินการ:** Kiro AI Assistant  
**อ้างอิง:** EDIT02_VERIFICATION_REPORT.md

---

## 📋 สรุปการแก้ไข

ดำเนินการแก้ไข bugs ตามลำดับความสำคัญ Priority 1 (P0) ทั้งหมด 5 ข้อ:

1. ✅ Bug #1: Race Condition in handleOptimize
2. ✅ Bug #2: Memory Leak in useEffect  
3. ✅ Bug #3: State ไม่ถูก clear เมื่อปิด Modal
4. ✅ Bug #4: VRP Optimization ไม่มี Timeout
5. ✅ Bug #8: Stale Closure ใน handleMoveOrder

---

## Bug #1: Race Condition in handleOptimize

### ปัญหา
- User สามารถกดปุ่ม Optimize หลายครั้งก่อน state จะ update
- มี `optimizeLockRef.current = true` แต่ไม่มี check ก่อนเข้า function
- ใช้ `alert()` แทน toast notification

### การแก้ไข

**ไฟล์:** `app/receiving/routes/page.tsx`

```typescript
// เพิ่ม check lock ที่ต้นฟังก์ชัน
const handleOptimize = async () => {
  // ✅ Check lock first - ป้องกันการเรียกซ้ำ
  if (optimizeLockRef.current) {
    console.warn('Optimization already in progress');
    return;
  }
  
  if (selectedOrders.size === 0) {
    // ✅ ใช้ toast แทน alert
    setStatusMessage('กรุณาเลือกออเดอร์อย่างน้อย 1 รายการ');
    return;
  }
  
  if (!planForm.warehouseId) {
    setStatusMessage('กรุณาเลือกคลังสินค้า');
    return;
  }
  
  try {
    // ✅ Lock ก่อนทำงาน
    optimizeLockRef.current = true;
    setIsOptimizing(true);
    
    // ... rest of code
    
  } catch (error: any) {
    console.error('Error optimizing plan:', error);
    setStatusMessage(`เกิดข้อผิดพลาด: ${error.message}`);
  } finally {
    // ✅ Unlock เสมอ ไม่ว่าจะ success หรือ fail
    optimizeLockRef.current = false;
    setIsOptimizing(false);
  }
};
```

---

## Bug #2: Memory Leak in useEffect

### ปัญหา
- ไม่มี cleanup function ทำให้ setState หลัง unmount
- ไม่มี AbortController สำหรับ cancel fetch

### การแก้ไข

**ไฟล์:** `app/receiving/routes/page.tsx`

เพิ่ม AbortController และ cleanup ใน fetchEditorData:

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

### ปัญหา
- `selectedPreviewTripIndices` ไม่ถูก clear
- Modal state ไม่ถูก reset

### การแก้ไข

**ไฟล์:** `app/receiving/routes/page.tsx`

```typescript
const closePreviewModal = useCallback(() => {
  // ✅ Clear all related state
  setShowPreviewModal(false);
  setPreviewData(null);
  setSelectedPreviewTripIndices(new Set());
  setPreviewMapCenter(null);
  setPreviewZoom(12);
  setSelectedPreviewTripIndex(null);
}, []);
```

---

## Bug #4: VRP Optimization ไม่มี Timeout

### ปัญหา
- Optimization อาจรันไม่มีที่สิ้นสุด
- ไม่มี progress indicator

### การแก้ไข

**ไฟล์:** `app/api/route-plans/optimize/route.ts`

เพิ่ม timeout wrapper:

```typescript
// Timeout configuration
const VRP_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// Helper function for timeout
function withTimeout<T>(
  promise: Promise<T>, 
  ms: number, 
  errorMessage: string
): Promise<T> {
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
    if (!body.planId) {
      return NextResponse.json(
        { error: 'Plan ID is required' },
        { status: 400 }
      );
    }
    
    // ✅ Add timeout wrapper
    const result = await withTimeout(
      runVRPOptimization(body.planId),
      VRP_TIMEOUT_MS,
      'การคำนวณใช้เวลานานเกินไป กรุณาลดจำนวนออเดอร์หรือปรับ settings'
    );
    
    return NextResponse.json({ 
      data: result,
      meta: {
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

---

## Bug #8: Stale Closure ใน handleMoveOrder

### ปัญหา
- Function ใช้ state เก่าเพราะ closure
- ไม่ใช้ functional update

### การแก้ไข

**ไฟล์:** `app/receiving/routes/page.tsx`

```typescript
const handleMoveOrder = useCallback((orderId: number, targetTripId: number) => {
  // ✅ Use functional update to get latest state
  setEditorTrips(prevTrips => {
    // Find the order and its current trip
    let orderData: any | null = null;
    let sourceTripId: number | null = null;
    
    for (const trip of prevTrips) {
      for (const stop of trip.stops) {
        const order = stop.orders?.find((o: any) => o.order_id === orderId);
        if (order) {
          orderData = order;
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
            orders: stop.orders?.filter((o: any) => o.order_id !== orderId)
          })).filter(stop => stop.orders && stop.orders.length > 0)
        };
      }
      
      if (trip.trip_id === targetTripId) {
        // Add order to target trip
        const newStop = {
          stop_id: Date.now(), // temporary ID
          trip_id: targetTripId,
          sequence: trip.stops.length,
          stop_name: orderData.customer_name,
          orders: [orderData],
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

## ✅ Testing Checklist

### Bug #1: Race Condition
- [ ] กดปุ่ม Optimize เร็วๆ หลายครั้ง
- [ ] ตรวจสอบว่าไม่มี duplicate plans
- [ ] ตรวจสอบว่า toast แสดงแทน alert

### Bug #2: Memory Leak
- [ ] เปิด-ปิด editor เร็วๆ หลายครั้ง
- [ ] ดู console ว่าไม่มี warning "Can't perform a React state update on an unmounted component"

### Bug #3: State not cleared
- [ ] เปิด preview > ปิด > เปิดใหม่
- [ ] ตรวจสอบว่า selectedPreviewTripIndices ถูก reset

### Bug #4: VRP Timeout
- [ ] ส่ง 1000+ orders
- [ ] ตรวจสอบว่า timeout ทำงานหลัง 5 นาที
- [ ] ตรวจสอบว่า error message ถูกต้อง

### Bug #8: Stale Closure
- [ ] ลาก order ไป trip อื่นหลายครั้งติดต่อกัน
- [ ] ตรวจสอบว่า order ถูกย้ายไปที่ถูกต้อง

---

**สถานะ:** ✅ พร้อม implement  
**ประมาณเวลา:** 2-3 ชั่วโมง  
**ผลกระทบ:** ไม่มี breaking changes
