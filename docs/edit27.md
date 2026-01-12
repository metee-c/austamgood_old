# ภารกิจ: เพิ่มปุ่มลบแผนจัดเส้นทาง

## ⛔ กฎเหล็ก

1. **ห้าม** ลบแผนที่มี orders ยังไม่ได้ rollback
2. **ห้าม** ลบแผนที่อยู่ระหว่างการโหลด/ส่ง
3. **ต้อง** ลบ picklists ที่เกี่ยวข้องด้วย
4. **ต้อง** ใช้ Transaction เพื่อความปลอดภัย
5. **ต้อง** มี Confirmation Dialog ก่อนลบ
6. **ต้อง** ตรวจสอบฐานข้อมูลก่อนดำเนินการ

---

## 🎯 เงื่อนไขการลบ

### แผนจัดเส้นทางลบได้เมื่อ:

| กรณี | เงื่อนไข | ลบได้? |
|------|---------|--------|
| 1 | ยังไม่สร้าง Picklist | ✅ ได้ |
| 2 | สร้าง Picklist แล้ว + Orders ทั้งหมด Rollback แล้ว | ✅ ได้ |
| 3 | สร้าง Picklist แล้ว + Orders บางส่วนยังไม่ Rollback | ❌ ไม่ได้ |
| 4 | อยู่ระหว่างโหลด/ส่ง (in_transit, loading) | ❌ ไม่ได้ |
| 5 | เสร็จสิ้นแล้ว (completed) | ❌ ไม่ได้ |

### สิ่งที่ต้องลบเมื่อลบแผน:
```
Route Plan
├── Route Trips → ลบ
│   └── Route Stops → ลบ
│       └── Route Stop Items → ลบ
├── Route Plan Inputs → ลบ
├── Picklists (ที่สร้างจากแผนนี้) → ลบ
│   └── Picklist Items → ลบ
└── Orders → เปลี่ยน status กลับเป็น 'draft'
```

---

## Phase 0: ตรวจสอบฐานข้อมูลด้วย MCP

### 0.1 ดูโครงสร้างตารางที่เกี่ยวข้อง
```sql
-- ตาราง Route Plans
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'receiving_route_plans'
ORDER BY ordinal_position;

-- ตาราง Route Trips
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'receiving_route_trips'
ORDER BY ordinal_position;

-- ตาราง Route Stops
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'receiving_route_stops'
ORDER BY ordinal_position;
```

### 0.2 ดูความสัมพันธ์ระหว่าง Route Plan กับ Picklist
```sql
-- หาว่า picklist เชื่อมกับ route plan อย่างไร
SELECT 
  tc.table_name, 
  kcu.column_name, 
  ccu.table_name AS foreign_table,
  ccu.column_name AS foreign_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND (tc.table_name LIKE '%picklist%' OR ccu.table_name LIKE '%route%');

-- ดูว่า picklists มี column อะไรที่เชื่อมกับ route
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'picklists'
  AND column_name LIKE '%route%' OR column_name LIKE '%trip%' OR column_name LIKE '%plan%';
```

### 0.3 ดูตัวอย่าง Picklist ที่สร้างจาก Route Plan
```sql
-- หา picklists ที่เชื่อมกับ route plans
SELECT 
  p.id as picklist_id,
  p.picklist_code,
  p.status as picklist_status,
  p.route_plan_id,
  p.trip_id,
  rp.plan_code,
  rp.status as plan_status
FROM picklists p
LEFT JOIN receiving_route_plans rp ON rp.plan_id = p.route_plan_id
WHERE p.route_plan_id IS NOT NULL
LIMIT 10;
```

### 0.4 ดูว่า Order Rollback เก็บข้อมูลอย่างไร
```sql
-- ดู orders ที่ถูก rollback
SELECT 
  o.order_id,
  o.order_no,
  o.status,
  o.route_plan_id,
  o.rollback_at,
  o.rollback_reason
FROM wms_orders o
WHERE o.rollback_at IS NOT NULL
LIMIT 10;

-- หรือดูจาก audit logs
SELECT *
FROM audit_logs
WHERE action = 'ORDER_ROLLBACK'
ORDER BY created_at DESC
LIMIT 10;
```

### 0.5 ตรวจสอบ Orders ใน Route Plan ว่า Rollback หมดหรือยัง
```sql
-- Template: ตรวจสอบ orders ใน route plan
SELECT 
  rp.plan_id,
  rp.plan_code,
  rp.status as plan_status,
  COUNT(DISTINCT rs.order_id) as total_orders,
  COUNT(DISTINCT CASE WHEN o.status = 'draft' OR o.rollback_at IS NOT NULL THEN rs.order_id END) as rollback_orders,
  COUNT(DISTINCT CASE WHEN o.status NOT IN ('draft', 'cancelled') AND o.rollback_at IS NULL THEN rs.order_id END) as active_orders
FROM receiving_route_plans rp
JOIN receiving_route_trips rt ON rt.plan_id = rp.plan_id
JOIN receiving_route_stops rs ON rs.trip_id = rt.trip_id
JOIN wms_orders o ON o.order_id = rs.order_id
WHERE rp.plan_id = :plan_id
GROUP BY rp.plan_id, rp.plan_code, rp.status;
```

---

## Phase 1: สร้าง API ลบแผนจัดเส้นทาง

### 1.1 API Endpoint

**ไฟล์:** `app/api/route-plans/[id]/delete/route.ts`
```typescript
// app/api/route-plans/[id]/delete/route.ts

import { withAdminAuth } from '@/lib/api/with-auth';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

interface DeleteRouteParams {
  params: { id: string };
}

async function handleDelete(request: NextRequest, context: DeleteRouteParams & { user: any }) {
  const supabase = await createClient();
  const planId = parseInt(context.params.id);
  const userId = context.user.user_id;

  if (isNaN(planId)) {
    return NextResponse.json(
      { error: 'รหัสแผนไม่ถูกต้อง', error_code: 'INVALID_ID' },
      { status: 400 }
    );
  }

  try {
    // 1. ดึงข้อมูลแผน
    const { data: plan, error: planError } = await supabase
      .from('receiving_route_plans')
      .select('*')
      .eq('plan_id', planId)
      .single();

    if (planError || !plan) {
      return NextResponse.json(
        { error: 'ไม่พบแผนจัดเส้นทาง', error_code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // 2. ตรวจสอบสถานะแผน - ห้ามลบถ้าอยู่ระหว่างดำเนินการ
    const blockedStatuses = ['in_transit', 'loading', 'completed'];
    if (blockedStatuses.includes(plan.status)) {
      return NextResponse.json(
        { 
          error: `ไม่สามารถลบแผนที่มีสถานะ "${plan.status}" ได้`,
          error_code: 'INVALID_STATUS'
        },
        { status: 400 }
      );
    }

    // 3. ตรวจสอบว่ามี picklists ที่สร้างจากแผนนี้หรือไม่
    const { data: picklists, error: picklistError } = await supabase
      .from('picklists')
      .select('id, picklist_code, status')
      .eq('route_plan_id', planId);

    const hasPicklists = picklists && picklists.length > 0;

    // 4. ถ้ามี picklists ต้องตรวจสอบว่า orders ทั้งหมด rollback แล้วหรือยัง
    if (hasPicklists) {
      // ดึง orders ทั้งหมดในแผน
      const { data: stops, error: stopsError } = await supabase
        .from('receiving_route_stops')
        .select(`
          order_id,
          trip:receiving_route_trips!inner(plan_id)
        `)
        .eq('trip.plan_id', planId);

      if (stopsError) {
        throw stopsError;
      }

      const orderIds = [...new Set(stops?.map(s => s.order_id).filter(Boolean))];

      if (orderIds.length > 0) {
        // ตรวจสอบสถานะ orders
        const { data: orders, error: ordersError } = await supabase
          .from('wms_orders')
          .select('order_id, order_no, status, rollback_at')
          .in('order_id', orderIds);

        if (ordersError) {
          throw ordersError;
        }

        // หา orders ที่ยังไม่ได้ rollback (status ไม่ใช่ draft และไม่มี rollback_at)
        const activeOrders = orders?.filter(o => 
          o.status !== 'draft' && 
          o.status !== 'cancelled' && 
          !o.rollback_at
        ) || [];

        if (activeOrders.length > 0) {
          return NextResponse.json(
            { 
              error: `ไม่สามารถลบแผนได้ เนื่องจากยังมี ${activeOrders.length} orders ที่ยังไม่ได้ Rollback`,
              error_code: 'ORDERS_NOT_ROLLBACK',
              active_orders: activeOrders.map(o => o.order_no)
            },
            { status: 400 }
          );
        }
      }
    }

    // 5. เริ่มลบข้อมูล (ตามลำดับ dependency)
    
    // 5.1 ลบ picklist_items
    if (hasPicklists) {
      const picklistIds = picklists.map(p => p.id);
      
      const { error: deleteItemsError } = await supabase
        .from('picklist_items')
        .delete()
        .in('picklist_id', picklistIds);

      if (deleteItemsError) {
        console.error('Error deleting picklist_items:', deleteItemsError);
      }

      // 5.2 ลบ picklists
      const { error: deletePicklistsError } = await supabase
        .from('picklists')
        .delete()
        .in('id', picklistIds);

      if (deletePicklistsError) {
        console.error('Error deleting picklists:', deletePicklistsError);
        throw deletePicklistsError;
      }
    }

    // 5.3 ลบ route_stop_items
    const { data: trips } = await supabase
      .from('receiving_route_trips')
      .select('trip_id')
      .eq('plan_id', planId);

    const tripIds = trips?.map(t => t.trip_id) || [];

    if (tripIds.length > 0) {
      const { error: deleteStopItemsError } = await supabase
        .from('receiving_route_stop_items')
        .delete()
        .in('trip_id', tripIds);

      if (deleteStopItemsError) {
        console.error('Error deleting stop_items:', deleteStopItemsError);
      }
    }

    // 5.4 ลบ route_stops
    const { error: deleteStopsError } = await supabase
      .from('receiving_route_stops')
      .delete()
      .eq('plan_id', planId);

    if (deleteStopsError) {
      console.error('Error deleting stops:', deleteStopsError);
    }

    // 5.5 ลบ route_trips
    const { error: deleteTripsError } = await supabase
      .from('receiving_route_trips')
      .delete()
      .eq('plan_id', planId);

    if (deleteTripsError) {
      console.error('Error deleting trips:', deleteTripsError);
    }

    // 5.6 ลบ route_plan_inputs
    const { error: deleteInputsError } = await supabase
      .from('receiving_route_plan_inputs')
      .delete()
      .eq('plan_id', planId);

    if (deleteInputsError) {
      console.error('Error deleting inputs:', deleteInputsError);
    }

    // 5.7 ลบ route_plan
    const { error: deletePlanError } = await supabase
      .from('receiving_route_plans')
      .delete()
      .eq('plan_id', planId);

    if (deletePlanError) {
      throw deletePlanError;
    }

    // 6. บันทึก Audit Log
    await supabase.from('audit_logs').insert({
      action: 'ROUTE_PLAN_DELETE',
      user_id: userId,
      details: {
        plan_id: planId,
        plan_code: plan.plan_code,
        deleted_picklists: picklists?.length || 0,
        deleted_trips: tripIds.length
      }
    });

    return NextResponse.json({
      success: true,
      message: `ลบแผน ${plan.plan_code} สำเร็จ`,
      deleted: {
        plan_code: plan.plan_code,
        picklists: picklists?.length || 0,
        trips: tripIds.length
      }
    });

  } catch (err: any) {
    console.error('[delete-route-plan] Error:', err);
    return NextResponse.json(
      { error: err.message || 'เกิดข้อผิดพลาดในการลบแผน', error_code: 'DELETE_ERROR' },
      { status: 500 }
    );
  }
}

export const DELETE = withAdminAuth(handleDelete);
```

---

## Phase 2: สร้าง API ตรวจสอบว่าลบได้หรือไม่

### 2.1 API Check Deletable

**ไฟล์:** `app/api/route-plans/[id]/can-delete/route.ts`
```typescript
// app/api/route-plans/[id]/can-delete/route.ts

import { withAuth } from '@/lib/api/with-auth';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

async function handleGet(request: NextRequest, context: any) {
  const supabase = await createClient();
  const planId = parseInt(context.params.id);

  if (isNaN(planId)) {
    return NextResponse.json({ can_delete: false, reason: 'รหัสแผนไม่ถูกต้อง' });
  }

  try {
    // 1. ดึงข้อมูลแผน
    const { data: plan, error: planError } = await supabase
      .from('receiving_route_plans')
      .select('plan_id, plan_code, status')
      .eq('plan_id', planId)
      .single();

    if (planError || !plan) {
      return NextResponse.json({ can_delete: false, reason: 'ไม่พบแผนจัดเส้นทาง' });
    }

    // 2. ตรวจสอบสถานะ
    const blockedStatuses = ['in_transit', 'loading', 'completed'];
    if (blockedStatuses.includes(plan.status)) {
      return NextResponse.json({ 
        can_delete: false, 
        reason: `แผนมีสถานะ "${plan.status}" ไม่สามารถลบได้`
      });
    }

    // 3. ตรวจสอบ picklists
    const { data: picklists } = await supabase
      .from('picklists')
      .select('id, picklist_code, status')
      .eq('route_plan_id', planId);

    const hasPicklists = picklists && picklists.length > 0;

    // 4. ถ้ามี picklists ตรวจสอบ orders
    if (hasPicklists) {
      const { data: stops } = await supabase
        .from('receiving_route_stops')
        .select(`
          order_id,
          trip:receiving_route_trips!inner(plan_id)
        `)
        .eq('trip.plan_id', planId);

      const orderIds = [...new Set(stops?.map(s => s.order_id).filter(Boolean))];

      if (orderIds.length > 0) {
        const { data: orders } = await supabase
          .from('wms_orders')
          .select('order_id, order_no, status, rollback_at')
          .in('order_id', orderIds);

        const activeOrders = orders?.filter(o => 
          o.status !== 'draft' && 
          o.status !== 'cancelled' && 
          !o.rollback_at
        ) || [];

        if (activeOrders.length > 0) {
          return NextResponse.json({ 
            can_delete: false, 
            reason: `ยังมี ${activeOrders.length} orders ที่ยังไม่ได้ Rollback`,
            active_orders: activeOrders.map(o => o.order_no),
            picklists_count: picklists.length
          });
        }
      }
    }

    // 5. ลบได้
    return NextResponse.json({ 
      can_delete: true,
      plan_code: plan.plan_code,
      status: plan.status,
      picklists_count: picklists?.length || 0,
      warning: hasPicklists 
        ? `จะลบ ${picklists?.length} picklist ที่สร้างจากแผนนี้ด้วย`
        : null
    });

  } catch (err: any) {
    console.error('[can-delete] Error:', err);
    return NextResponse.json({ can_delete: false, reason: err.message });
  }
}

export const GET = withAuth(handleGet);
```

---

## Phase 3: เพิ่ม UI ปุ่มลบในหน้า Routes

### 3.1 เพิ่ม State และ Handler
```typescript
// ใน page.tsx

// เพิ่ม state
const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{
  isOpen: boolean;
  planId: number | null;
  planCode: string;
  picklistsCount: number;
  warning: string | null;
} | null>(null);
const [deleting, setDeleting] = useState(false);

// Handler ตรวจสอบว่าลบได้หรือไม่
const handleCheckDelete = async (planId: number) => {
  try {
    const response = await fetch(`/api/route-plans/${planId}/can-delete`);
    const result = await response.json();

    if (!result.can_delete) {
      // แสดง error
      alert(`ไม่สามารถลบได้: ${result.reason}`);
      return;
    }

    // แสดง confirmation dialog
    setDeleteConfirmDialog({
      isOpen: true,
      planId: planId,
      planCode: result.plan_code,
      picklistsCount: result.picklists_count || 0,
      warning: result.warning
    });
  } catch (error) {
    console.error('Error checking delete:', error);
    alert('เกิดข้อผิดพลาดในการตรวจสอบ');
  }
};

// Handler ลบจริง
const handleDeletePlan = async () => {
  if (!deleteConfirmDialog?.planId) return;

  setDeleting(true);
  try {
    const response = await fetch(`/api/route-plans/${deleteConfirmDialog.planId}/delete`, {
      method: 'DELETE'
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'เกิดข้อผิดพลาด');
    }

    // แสดง success
    alert(`ลบแผน ${deleteConfirmDialog.planCode} สำเร็จ`);
    
    // Refresh list
    fetchRoutePlans();
    
    // ปิด dialog
    setDeleteConfirmDialog(null);
  } catch (error: any) {
    console.error('Error deleting:', error);
    alert(`เกิดข้อผิดพลาด: ${error.message}`);
  } finally {
    setDeleting(false);
  }
};
```

### 3.2 เพิ่มปุ่มลบในตาราง
```tsx
// ใน actions ของแต่ละแถว

<button
  onClick={() => handleCheckDelete(plan.plan_id)}
  className="text-red-600 hover:text-red-800 p-1"
  title="ลบแผน"
>
  <Trash2 className="h-4 w-4" />
</button>
```

### 3.3 เพิ่ม Confirmation Dialog
```tsx
// ใน JSX

{deleteConfirmDialog && (
  <ConfirmDialog
    isOpen={deleteConfirmDialog.isOpen}
    title="ยืนยันการลบแผนจัดเส้นทาง"
    message={
      <>
        <p>คุณต้องการลบแผน <strong>{deleteConfirmDialog.planCode}</strong> หรือไม่?</p>
        {deleteConfirmDialog.picklistsCount > 0 && (
          <p className="text-orange-600 mt-2">
            ⚠️ จะลบ {deleteConfirmDialog.picklistsCount} ใบหยิบที่สร้างจากแผนนี้ด้วย
          </p>
        )}
        {deleteConfirmDialog.warning && (
          <p className="text-orange-600 mt-1">{deleteConfirmDialog.warning}</p>
        )}
        <p className="text-red-600 mt-2 font-medium">
          การลบไม่สามารถยกเลิกได้!
        </p>
      </>
    }
    variant="danger"
    confirmText="ลบแผน"
    onConfirm={handleDeletePlan}
    onCancel={() => setDeleteConfirmDialog(null)}
    loading={deleting}
  />
)}
```

---

## Phase 4: ทดสอบ

### Test Cases
```
□ แผนที่ยังไม่สร้าง Picklist:
  - กดลบ → แสดง Confirm Dialog
  - กดยืนยัน → ลบสำเร็จ

□ แผนที่สร้าง Picklist แล้ว + Orders Rollback หมดแล้ว:
  - กดลบ → แสดง Confirm Dialog พร้อม warning
  - กดยืนยัน → ลบสำเร็จ + Picklists ถูกลบด้วย

□ แผนที่สร้าง Picklist แล้ว + Orders ยังไม่ Rollback:
  - กดลบ → แสดง Error "ยังมี X orders ที่ยังไม่ได้ Rollback"
  - ไม่แสดง Confirm Dialog

□ แผนที่มีสถานะ in_transit/loading/completed:
  - กดลบ → แสดง Error "แผนมีสถานะ X ไม่สามารถลบได้"

□ หลังลบแผน:
  - แผนหายจากรายการ
  - Picklists ที่เกี่ยวข้องหายด้วย
  - Orders กลับเป็นสถานะ draft (ถ้า rollback แล้ว)
```

---

## Checklist
```
Phase 0: ตรวจสอบฐานข้อมูล
□ 0.1-0.5 ตรวจสอบโครงสร้างและความสัมพันธ์

Phase 1: สร้าง API Delete
□ สร้าง app/api/route-plans/[id]/delete/route.ts
□ ตรวจสอบเงื่อนไขการลบ
□ ลบข้อมูลตามลำดับ dependency
□ บันทึก Audit Log

Phase 2: สร้าง API Can-Delete
□ สร้าง app/api/route-plans/[id]/can-delete/route.ts
□ Return ข้อมูลสำหรับแสดงใน UI

Phase 3: เพิ่ม UI
□ เพิ่ม State และ Handlers
□ เพิ่มปุ่มลบในตาราง
□ เพิ่ม Confirmation Dialog

Phase 4: ทดสอบ
□ ทดสอบทุก Test Cases
□ Regression Test

Build
□ Build ผ่าน 100%
```

---

เริ่มจาก **Phase 0** ก่อนเสมอ!
รายงานผลทุกขั้นตอน!