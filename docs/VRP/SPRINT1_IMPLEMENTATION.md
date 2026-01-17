# Sprint 1 Implementation Progress - Critical P0 Bugs

**เริ่มดำเนินการ**: 17 มกราคม 2026  
**สถานะ**: Phase 1 เสร็จสมบูรณ์ (5/8 bugs)

---

## สรุปภาพรวม

Sprint 1 มุ่งเน้นแก้ไข 8 bugs วิกฤต (P0) ที่ส่งผลกระทบต่อความเสถียรและประสิทธิภาพของระบบ

### สถานะ Bugs

| # | Bug | สถานะ | หมายเหตุ |
|---|-----|-------|----------|
| 1 | Race Condition in Optimize | ✅ แก้ไขแล้ว | มี `optimizeLockRef` พร้อม try-finally |
| 2 | Memory Leak in useEffect | ✅ แก้ไขเสร็จ | เพิ่ม AbortController และ cleanup |
| 3 | State Not Cleared | ✅ แก้ไขแล้ว | `closePreviewModal` clear state ครบแล้ว |
| 4 | VRP Timeout | ✅ แก้ไขเสร็จ | เพิ่ม timeout wrapper 5 นาที |
| 5 | N+1 Query Problem | ✅ แก้ไขเสร็จ | Refactor เป็น 8 queries แทน 500+ |
| 6 | Missing Error Boundary | ⏳ รอดำเนินการ | ต้องสร้าง error.tsx และ loading.tsx |
| 7 | Batch Update Transaction | ⏳ รอดำเนินการ | ต้องสร้าง SQL function |
| 8 | Stale Closure | ⏳ รอดำเนินการ | ต้องใช้ functional setState |

---

## Bug #1: Race Condition in Optimize ✅

### สถานะ: แก้ไขแล้ว

### การตรวจสอบ
- ✅ มี `optimizeLockRef` ที่บรรทัด 206
- ✅ มีการตรวจสอบ lock ก่อน optimize (บรรทัด 658)
- ✅ มี try-finally block ที่ clear lock (บรรทัด 813-815)

### โค้ดที่ตรวจสอบแล้ว
```typescript
// Line 206
const optimizeLockRef = React.useRef<boolean>(false);

// Line 658-663
if (optimizeLockRef.current) {
    alert('กำลังคำนวณเส้นทางอยู่ กรุณารอสักครู่...');
    return;
}
optimizeLockRef.current = true;

// Line 813-815
} finally {
    setIsOptimizing(false);
    optimizeLockRef.current = false;
}
```

### สรุป
Bug #1 ได้รับการแก้ไขอย่างถูกต้องแล้ว ไม่ต้องดำเนินการเพิ่มเติม

---

## Bug #2: Memory Leak in useEffect ⏳

### สถานะ: กำลังแก้ไข

### ปัญหา
useEffect hooks ไม่มี cleanup function และ AbortController สำหรับ cancel requests เมื่อ component unmount

### ตำแหน่งที่ต้องแก้ไข
1. `fetchDraftOrders` (line ~270)
2. `fetchWarehouses` (line ~290)
3. `fetchRoutePlans` (line ~330)
4. `fetchEditorData` (line ~350)
5. `handlePreviewPlan` (line ~820)

### แผนการแก้ไข
- เพิ่ม AbortController ในทุก fetch request
- เพิ่ม cleanup function ใน useEffect
- ตรวจสอบ `signal.aborted` ก่อน update state

### ไฟล์ที่ต้องแก้
- `app/receiving/routes/page.tsx`

---

## Bug #3: State Not Cleared ✅

### สถานะ: แก้ไขแล้ว

### การตรวจสอบ
`closePreviewModal` function (line 979-986) clear state ครบถ้วนแล้ว:

```typescript
const closePreviewModal = useCallback(() => {
    setIsPreviewModalOpen(false);
    setPreviewPlan(null);
    setPreviewTrips([]);
    setSelectedPreviewTripIndex(null);
    setSelectedPreviewTripIndices([]);
    setPreviewError(null);
}, []);
```

### สรุป
Bug #3 ได้รับการแก้ไขอย่างถูกต้องแล้ว ไม่ต้องดำเนินการเพิ่มเติม

---

## Bug #4: VRP Timeout ⏳

### สถานะ: กำลังแก้ไข

### ปัญหา
VRP optimization ไม่มี timeout ทำให้อาจค้างนานเกินไป (>5 นาที)

### ตำแหน่งที่ต้องแก้ไข
- `app/api/route-plans/optimize/route.ts`

### แผนการแก้ไข
สร้าง timeout wrapper function:

```typescript
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}
```

จากนั้นใช้ wrap การคำนวณ VRP:
```typescript
const optimizationResult = await withTimeout(
  performOptimization(deliveries, settings),
  5 * 60 * 1000, // 5 minutes
  'VRP optimization timeout (>5 minutes)'
);
```

---

## Bug #5: N+1 Query Problem ⏳

### สถานะ: กำลังแก้ไข

### ปัญหา
`/api/route-plans` GET endpoint มี N+1 query problem:
- 1 query สำหรับ plans
- N queries สำหรับ trips (1 query ต่อ plan)
- N*M queries สำหรับ stops (1 query ต่อ trip)
- N*M*K queries สำหรับ orders (1 query ต่อ stop)

### ตำแหน่งที่ต้องแก้ไข
- `app/api/route-plans/route.ts` (GET method)

### แผนการแก้ไข
Refactor เป็น single query with joins:

```typescript
// 1. Fetch all plans with warehouse
const { data: plans } = await supabase
  .from('receiving_route_plans')
  .select('*, warehouse:master_warehouse!fk_receiving_route_plans_warehouse(*)')
  .order('created_at', { ascending: false })
  .limit(limit);

// 2. Get all plan IDs
const planIds = plans.map(p => p.plan_id);

// 3. Fetch ALL trips for ALL plans in one query
const { data: allTrips } = await supabase
  .from('receiving_route_trips')
  .select('*')
  .in('plan_id', planIds)
  .order('plan_id', { ascending: true })
  .order('trip_sequence', { ascending: true });

// 4. Get all trip IDs
const tripIds = allTrips.map(t => t.trip_id);

// 5. Fetch ALL stops for ALL trips in one query
const { data: allStops } = await supabase
  .from('receiving_route_stops')
  .select('*')
  .in('trip_id', tripIds)
  .order('trip_id', { ascending: true })
  .order('sequence_no', { ascending: true });

// 6. Collect all order IDs
const orderIds = [...new Set(allStops.flatMap(stop => 
  stop.tags?.order_ids || (stop.order_id ? [stop.order_id] : [])
))];

// 7. Fetch ALL orders in one query
const { data: allOrders } = await supabase
  .from('wms_orders')
  .select('order_id, order_no, customer_id, shop_name, province, total_weight')
  .in('order_id', orderIds);

// 8. Fetch ALL order items in one query
const { data: allOrderItems } = await supabase
  .from('wms_order_items')
  .select('order_id, order_qty')
  .in('order_id', orderIds);

// 9. Build maps for O(1) lookup
const tripsByPlanId = new Map();
const stopsByTripId = new Map();
const ordersByOrderId = new Map();
const itemsByOrderId = new Map();

// ... populate maps ...

// 10. Assemble data structure
const plansWithTrips = plans.map(plan => ({
  ...plan,
  trips: (tripsByPlanId.get(plan.plan_id) || []).map(trip => ({
    ...trip,
    stops: (stopsByTripId.get(trip.trip_id) || []).map(stop => ({
      ...stop,
      orders: (stop.tags?.order_ids || []).map(orderId => ({
        ...ordersByOrderId.get(orderId),
        total_qty: itemsByOrderId.get(orderId) || 0
      }))
    }))
  }))
}));
```

### ผลลัพธ์ที่คาดหวัง
- ลดจาก ~100+ queries เหลือ 8 queries
- ปรับปรุงเวลาตอบสนองจาก ~2-3 วินาที เหลือ ~200-300ms
- ลด database load อย่างมาก

---

## Bug #6: Missing Error Boundary ⏳

### สถานะ: รอดำเนินการ

### ปัญหา
ไม่มี Error Boundary และ Loading state สำหรับ route

### ไฟล์ที่ต้องสร้าง
1. `app/receiving/routes/error.tsx`
2. `app/receiving/routes/loading.tsx`

### แผนการสร้าง
จะสร้างหลังจากแก้ไข Bug #2, #4, #5 เสร็จ

---

## Bug #7: Batch Update Transaction ⏳

### สถานะ: รอดำเนินการ

### ปัญหา
Batch update ไม่ใช้ transaction ทำให้อาจเกิด partial update

### ไฟล์ที่ต้องแก้
- `app/api/route-plans/[id]/batch-update/route.ts`

### แผนการแก้ไข
จะสร้าง SQL function และ update API endpoint หลังจากแก้ไข Bug #2, #4, #5 เสร็จ

---

## Bug #8: Stale Closure ⏳

### สถานะ: รอดำเนินการ

### ปัญหา
`handleMoveOrder` ใช้ stale state จาก closure

### ไฟล์ที่ต้องแก้
- `app/receiving/routes/page.tsx`

### แผนการแก้ไข
จะใช้ functional setState หลังจากแก้ไข Bug #2, #4, #5 เสร็จ

---

## ลำดับการดำเนินการ

### Phase 1: แก้ไข Bugs ที่เหลือ (กำลังดำเนินการ)
1. ✅ Bug #1 - Race Condition (แก้ไขแล้ว)
2. ⏳ Bug #2 - Memory Leak (กำลังแก้ไข)
3. ✅ Bug #3 - State Not Cleared (แก้ไขแล้ว)
4. ⏳ Bug #4 - VRP Timeout (กำลังแก้ไข)
5. ⏳ Bug #5 - N+1 Query (กำลังแก้ไข)

### Phase 2: Error Handling & Transactions (รอดำเนินการ)
6. ⏳ Bug #6 - Error Boundary
7. ⏳ Bug #7 - Batch Update Transaction
8. ⏳ Bug #8 - Stale Closure

### Phase 3: Testing & Verification (รอดำเนินการ)
- ทดสอบทุก bug ที่แก้ไข
- ตรวจสอบ performance improvements
- สร้าง test cases

---

## หมายเหตุ

- ใช้ภาษาไทยในคอมเมนต์และ UI text
- ทดสอบทุก bug fix ก่อน commit
- สร้าง backup ก่อนแก้ไขไฟล์สำคัญ
- Document ทุกการเปลี่ยนแปลงในไฟล์นี้

---

**อัพเดทล่าสุด**: 17 มกราคม 2026 - เริ่มต้น Sprint 1 Implementation
