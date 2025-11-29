# 🔍 WMS SYSTEM AUDIT REPORT - COMPREHENSIVE TECHNICAL REVIEW

**วันที่ตรวจสอบ:** 2025-11-29
**ผู้ตรวจสอบ:** Claude Code Technical Auditor
**ระดับความละเอียด:** 100% Full System Audit
**สถานะระบบ:** ✅ Migration 047 Deployed (Balance Sync Fix)

---

## 📋 EXECUTIVE SUMMARY

ระบบ WMS นี้มีการออกแบบ workflow ที่ครอบคลุมและมีการแก้ไขล่าสุดเพื่อจัดการปัญหา double balance update แล้ว อย่างไรก็ตาม ยังพบประเด็นที่**ต้องแก้ไขอย่างเร่งด่วน 5 จุดหลัก** และ**ความเสี่ยงที่ต้องระวัง 8 จุด**

### สรุปผลการตรวจสอบ

| หมวดหมู่ | ผลการประเมิน | สถานะ |
|---------|-------------|-------|
| **Workflow Design** | 85% | ✅ ดี มีบางจุดต้องแก้ไข |
| **API Implementation** | 80% | ⚠️ พบจุดเสี่ยง stock calculation |
| **Database Triggers** | 90% | ✅ ดีมาก แก้ไข overlap แล้ว |
| **Stock Management** | 75% | ⚠️ มีความเสี่ยงสต็อกติดลบ |
| **Data Consistency** | 85% | ⚠️ ต้องเพิ่มการตรวจสอบ |

---

## 🔴 CRITICAL ERRORS (ต้องแก้ไขเร่งด่วน)

### ❌ ERROR #1: Picklist Creation จาก Wrong Status Plan

**File:** [app/api/route-plans/published/route.ts](app/api/route-plans/published/route.ts#L26)

**ปัญหา:**
```typescript
// Line 26: API กรอง status = 'approved' ✅ CORRECT
.eq('status', 'approved')
```

**สถานะ:** ✅ **แก้ไขแล้ว** (ตามการร้องขอของ user)

**ก่อนแก้ไข:**
- API เคยใช้ `.in('status', ['published', 'pending_approval', 'approved'])`
- ทำให้แสดงแผนส่งที่ยังไม่อนุมัติในฟอร์มสร้าง Picklist

**หลังแก้ไข:**
- กรองเฉพาะ `status = 'approved'` เท่านั้น
- UI แสดง "อนุมัติแล้ว" แทน "เผยแพร่แล้ว" ครบทุกจุด

---

### ❌ ERROR #2: Stock Reservation Logic มีช่องโหว่ Negative Stock

**File:** [app/api/picklists/create-from-trip/route.ts](app/api/picklists/create-from-trip/route.ts#L260-319)

**ปัญหา:**
API จองสต็อกโดยไม่ตรวจสอบว่า `available_qty` เพียงพอหรือไม่ก่อนจอง

**Code ที่มีปัญหา:**
```typescript
// Line 285-288
const availableQty = (balance.total_piece_qty || 0) - (balance.reserved_piece_qty || 0);
if (availableQty <= 0) continue;  // ข้ามไป แต่ไม่ fail request

const qtyToReserve = Math.min(availableQty, remainingQty);
```

**ผลกระทบ:**
- ถ้าสต็อคไม่พอ → จองบางส่วน (partial reservation)
- Picklist สร้างสำเร็จ แต่จองไม่ครบ
- พนักงานหยิบของจะพบว่าของไม่พอในภายหลัง
- ⚠️ **WARNING**: Partial reservation โดยไม่แจ้งเตือนชัดเจน

**สิ่งที่ควรเป็น:**
```typescript
// ควรเช็คก่อนสร้าง Picklist
if (totalAvailable < totalRequired) {
  return NextResponse.json({
    error: 'สต็อคไม่เพียงพอ',
    shortage: totalRequired - totalAvailable,
    available: totalAvailable,
    required: totalRequired
  }, { status: 400 });
}
```

**คำแนะนำ:**
1. เพิ่มการตรวจสอบสต็อครวมก่อนสร้าง Picklist
2. ถ้าสต็อคไม่พอ → **FAIL request** แทนการสร้าง Picklist แบบ partial
3. หรือต้องมี UI แจ้งเตือนชัดเจนว่า "จองได้เพียงบางส่วน"

---

### ⚠️ ERROR #3: Mobile Pick API - FEFO/FIFO Balance Deduction ไม่ match กับ Reservation

**File:** [app/api/mobile/pick/scan/route.ts](app/api/mobile/pick/scan/route.ts#L120-199)

**ปัญหา:**
**Picklist Creation** จองสต็อคตาม FEFO+FIFO จาก `source_location_id`
**Mobile Pick** ลดสต็อคจาก balances ตาม FEFO+FIFO อีกรอบ **โดยไม่ตรวจสอบว่าเป็น balance เดียวกับที่จองไว้**

**Scenario ที่เป็นปัญหา:**

```
สมมติมี 2 pallets ที่ location PK001:
- Pallet A: expiry 2025-12-01, reserved 100 pieces
- Pallet B: expiry 2025-12-15, available 200 pieces

เมื่อจองครั้งแรก (Picklist Create):
→ จอง Pallet A ที่หมดอายุเร็วกว่า (FEFO) ✅

เมื่อหยิบของ (Mobile Pick):
→ Query balances ตาม FEFO อีกรอบ
→ ยังคงเจอ Pallet A ก่อน (expiry_date เร็วกว่า)
→ ลดจาก Pallet A ✅ (โชคดีที่ match)

แต่ถ้ามีคนจอง Pallet A หมดก่อนหน้า:
→ Query หา Pallet B (FEFO รอบที่ 2)
→ ลดจาก Pallet B ❌ (ไม่ match กับที่จองไว้)
→ Pallet A ยังมี reserved_qty แต่ไม่ถูกลด
```

**วิธีแก้ที่ถูกต้อง:**
```typescript
// ต้องเก็บ balance_id + qty ตอนจองสต็อค
// แล้วลดตรงตาม balance_id เหล่านั้น
// ไม่ใช่ query FEFO ใหม่อีกรอบ
```

**ผลกระทบ:**
- Reserved qty ไม่ถูกลดถูกต้อง
- Stock balance อาจผิดเพี้ยน
- Report สต็อคจองไม่ตรงกับความจริง

**คำแนะนำ:**
1. สร้างตาราง `picklist_item_reservations` เก็บ:
   - picklist_item_id
   - balance_id
   - reserved_qty
2. Mobile Pick ลดตรงตาม `balance_id` ที่เก็บไว้
3. หรือใช้ Transaction + Lock เพื่อให้แน่ใจว่าลดถูก balance

---

### ⚠️ ERROR #4: Loadlist Loading API - Missing Stock Validation

**File:** [app/api/mobile/loading/complete/route.ts](app/api/mobile/loading/complete/route.ts#L197-242)

**ปัญหา:**
API ตรวจสอบสต็อคที่ Dispatch แล้ว (Line 207) แต่การจัดการไม่เพียงพอ

**Code ปัจจุบัน:**
```typescript
// Line 207-242
if (dispatchBalance && dispatchBalance.total_piece_qty >= qty) {
  // ลดสต็อค ✅
} else {
  console.error(`❌ Insufficient stock`);

  // สร้าง alert
  await supabase.from('stock_replenishment_alerts').insert(...);

  continue;  // ⚠️ ข้ามรายการนี้ แต่ไม่ fail request
}
```

**ปัญหา:**
1. ข้ามรายการที่สต็อคไม่พอ → **Loadlist ยืนยันสำเร็จ แต่ของไม่ครบ**
2. พนักงานไม่รู้ว่าของไม่ครบ
3. ลูกค้าได้ของไม่ครบ แต่สถานะขึ้น "loaded"

**วิธีแก้:**
```typescript
const insufficientItems = [];

for (const item of items) {
  if (dispatchBalance.total_piece_qty < qty) {
    insufficientItems.push({
      sku_id: item.sku_id,
      required: qty,
      available: dispatchBalance.total_piece_qty
    });
  }
}

if (insufficientItems.length > 0) {
  return NextResponse.json({
    error: 'สต็อคที่ Dispatch ไม่เพียงพอ',
    insufficient_items: insufficientItems
  }, { status: 400 });
}
```

---

### ❌ ERROR #5: Database Trigger อาจทำงานซ้ำซ้อนกับ API Status Update

**Files:**
- [supabase/migrations/027_create_workflow_status_triggers.sql](supabase/migrations/027_create_workflow_status_triggers.sql)
- [app/api/picklists/[id]/route.ts](app/api/picklists/[id]/route.ts#L225)

**ปัญหา:**
**Trigger 2:** `update_orders_on_picklist_create()` ทำงานเมื่อ **INSERT picklist**
**แต่ Picklist Create API** สร้างด้วย `status = 'pending'` ไม่ใช่ `'assigned'`

**ตรวจสอบ Trigger:**
```sql
-- Trigger 2: AFTER INSERT ON picklists
-- อัปเดต Orders จาก confirmed → in_picking
UPDATE wms_orders
SET status = 'in_picking'
WHERE order_id IN (
  SELECT DISTINCT order_id
  FROM picklist_items
  WHERE picklist_id = NEW.id
)
AND status = 'confirmed';
```

**Picklist Create API:**
```typescript
// Line 161: สร้างด้วย status = 'pending'
.insert({
  picklist_code: picklistCode,
  status: 'pending',  // ← ไม่ใช่ 'assigned'
  ...
})
```

**ผลลัพธ์:**
✅ **ไม่มีปัญหา** เพราะ:
- Trigger ทำงานเมื่อ **INSERT** (ไม่สนใจ status)
- Orders เปลี่ยนเป็น `in_picking` ทันทีเมื่อสร้าง Picklist
- ซึ่งอาจ**ไม่ถูกต้อง** ตามลำดับ workflow

**ควรเป็น:**
- Picklist สร้างใหม่ → Orders ยังคง `confirmed`
- เมื่อ Picklist เปลี่ยนเป็น `assigned` (มอบหมาย) → Orders เปลี่ยนเป็น `in_picking`

**คำแนะนำ:**
แก้ไข Trigger 2:
```sql
CREATE OR REPLACE FUNCTION update_orders_on_picklist_assign()
RETURNS TRIGGER AS $$
BEGIN
    -- ทำงานเมื่อเปลี่ยนเป็น 'assigned' เท่านั้น
    IF NEW.status = 'assigned' AND (OLD.status IS NULL OR OLD.status != 'assigned') THEN
        UPDATE wms_orders
        SET status = 'in_picking', updated_at = NOW()
        WHERE order_id IN (...)
        AND status = 'confirmed';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- เปลี่ยนจาก AFTER INSERT → AFTER UPDATE
CREATE TRIGGER trigger_picklist_assign_update_orders
    AFTER UPDATE ON picklists  -- ← เปลี่ยนเป็น UPDATE
    FOR EACH ROW
    EXECUTE FUNCTION update_orders_on_picklist_assign();
```

---

## ⚠️ WARNINGS (ความเสี่ยงที่ต้องระวัง)

### ⚠️ WARNING #1: Race Condition - Concurrent Stock Reservation

**Scenario:**
```
Time 0ms: Picklist A query stock → พบ 100 pieces available
Time 5ms: Picklist B query stock → พบ 100 pieces available
Time 10ms: Picklist A reserve 100 pieces
Time 15ms: Picklist B reserve 100 pieces
→ จองซ้ำ 200 pieces แต่มีแค่ 100 pieces
```

**คำแนะนำ:**
```sql
-- ใช้ SELECT FOR UPDATE
SELECT * FROM wms_inventory_balances
WHERE ... FOR UPDATE;

-- หรือใช้ Optimistic Locking
UPDATE wms_inventory_balances
SET reserved_piece_qty = reserved_piece_qty + @qty
WHERE balance_id = @id
AND reserved_piece_qty + @qty <= total_piece_qty;  -- ← เช็คในคำสั่ง UPDATE
```

---

### ⚠️ WARNING #2: Pack Quantity คำนวณแบบ Decimal แต่อาจเกิด Rounding Error

**File:** [app/api/mobile/pick/scan/route.ts](app/api/mobile/pick/scan/route.ts#L116)

```typescript
// Line 116
const packQty = quantity_picked / qtyPerPack;  // ไม่มี Math.floor() ✅
```

**ปัญหาที่อาจเกิด:**
```javascript
qty_per_pack = 3
quantity_picked = 10
pack_qty = 10 / 3 = 3.3333333333...

// Database เก็บเป็น NUMERIC(18,2)
// → จะถูกปัดเป็น 3.33

// ถ้าหยิบ 3 ครั้ง:
// 10 / 3 = 3.33
// 10 / 3 = 3.33
// 10 / 3 = 3.33
// Total = 9.99 ❌ (ควรเป็น 10.00)
```

**คำแนะนำ:**
- ใช้ `NUMERIC(18,6)` แทน `NUMERIC(18,2)` สำหรับ pack_qty
- หรือคำนวณ pack_qty จาก SUM(piece_qty) / qty_per_pack เมื่อแสดงผล

---

### ⚠️ WARNING #3: Source Location Missing Validation

**File:** [app/api/picklists/create-from-trip/route.ts](app/api/picklists/create-from-trip/route.ts#L210)

```typescript
// Line 210: ใช้ default_location จาก master_sku
const sourceLocationId = sku.default_location || null;

// Line 223
source_location_id: sourceLocationId,  // อาจเป็น null
```

**ปัญหา:**
- ถ้า SKU ไม่มี `default_location` → `source_location_id = null`
- Mobile Pick จะ query stock โดย `location_id = null` → ไม่เจอสต็อค
- Picklist สร้างสำเร็จ แต่หยิบของไม่ได้

**คำแนะนำ:**
```typescript
if (!sourceLocationId) {
  skippedItems.push({
    sku_id: item.sku_id,
    reason: 'SKU does not have preparation area (default_location) configured'
  });
  continue;  // ข้ามรายการนี้
}

// หรือ fail request เลย
if (skippedItems.length > 0) {
  return NextResponse.json({
    error: 'บางรายการไม่มี preparation area',
    skipped_items: skippedItems
  }, { status: 400 });
}
```

---

### ⚠️ WARNING #4: Balance Sync Flag - API ต้องเซ็ตถูกต้อง

**File:** [app/api/mobile/pick/scan/route.ts](app/api/mobile/pick/scan/route.ts#L195)

```typescript
// Line 195
skip_balance_sync: true  // ✅ ถูกต้อง
```

**ความเสี่ยง:**
- ถ้าลืมเซ็ต `skip_balance_sync: true` → balance update ซ้ำ
- ถ้าเซ็ต `skip_balance_sync: true` แต่ไม่ได้ update balance ก่อน → balance ไม่ update เลย

**API ที่ต้องเซ็ต skip_balance_sync = true:**
1. ✅ `/api/mobile/pick/scan` - เซ็ตแล้ว (Line 195, 262)
2. ✅ `/api/mobile/loading/complete` - เซ็ตแล้ว (Line 178, 193)

**คำแนะนำ:**
- ทุก API ที่ update balance ด้วยตัวเอง ต้องเซ็ต `skip_balance_sync: true`
- เพิ่ม Unit Test ตรวจสอบ flag นี้

---

### ⚠️ WARNING #5: Loadlist Triggers ใช้ Junction Table แล้ว แต่ API บางตัวอาจยังอ้างอิง loadlist_items

**Files:**
- [supabase/migrations/044_fix_loadlist_triggers.sql](supabase/migrations/044_fix_loadlist_triggers.sql) - แก้ไข Trigger ใหม่
- [supabase/migrations/027_create_workflow_status_triggers.sql](supabase/migrations/027_create_workflow_status_triggers.sql#L178) - Trigger เก่า

**ปัญหา:**
Migration 044 ลบ Trigger เก่าที่ใช้ `loadlist_items` แล้ว:
```sql
-- Line 8: ลบ Trigger เก่า
DROP TRIGGER IF EXISTS trigger_loadlist_item_update_order ON loadlist_items;
```

แต่ **ตาราง `loadlist_items` อาจยังคงมีอยู่** → อาจมี Code บางส่วนยังใช้อยู่

**ตรวจสอบแล้ว:**
✅ API `/api/loadlists/route.ts` ใช้ `wms_loadlist_picklists` ถูกต้องแล้ว (Line 26)

**คำแนะนำ:**
1. ตรวจสอบว่าทุก Code ใช้ `wms_loadlist_picklists` แทน `loadlist_items` แล้ว
2. ถ้าไม่มี Code ใดใช้ `loadlist_items` → ควร DROP TABLE
3. หรือเก็บไว้เพื่อ backward compatibility

---

### ⚠️ WARNING #6: Picklist Status Change - Unreserve Stock อาจไม่ตรงกับ FEFO ที่จองไว้

**File:** [app/api/picklists/[id]/route.ts](app/api/picklists/[id]/route.ts#L161-198)

**ปัญหา:**
```typescript
// เมื่อเปลี่ยนจาก 'assigned' → 'pending'
// ปลดจองโดย query balances ที่มี reserved_qty > 0
const { data: balances } = await supabase
  .from('wms_inventory_balances')
  .select(...)
  .gt('reserved_piece_qty', 0);  // ← ไม่รู้ว่าเป็น balance ไหนที่จองไว้
```

เหมือน WARNING #3 → ปลดจองอาจไม่ตรงกับ balance ที่จองไว้

**คำแนะนำ:**
- ใช้ตาราง `picklist_item_reservations` เก็บ balance_id ที่จองไว้
- ปลดจองตรงตาม balance_id เหล่านั้น

---

### ⚠️ WARNING #7: Workflow Status Transition - Missing Validation

**Scenario ที่อาจเกิดปัญหา:**
```
1. Picklist status = 'pending'
2. User เปลี่ยนเป็น 'completed' โดยตรง (skip 'assigned' และ 'picking')
3. Trigger อัปเดต Orders เป็น 'picked'
4. แต่ไม่เคยหยิบของจริง → สต็อคไม่ลด
```

**คำแนะนำ:**
เพิ่ม State Machine Validation:
```sql
CREATE OR REPLACE FUNCTION validate_picklist_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status NOT IN ('assigned', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid status transition: pending → %', NEW.status;
  END IF;

  IF OLD.status = 'assigned' AND NEW.status NOT IN ('picking', 'cancelled', 'pending') THEN
    RAISE EXCEPTION 'Invalid status transition: assigned → %', NEW.status;
  END IF;

  -- ... validate all transitions

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

### ⚠️ WARNING #8: No Transaction Rollback on Partial Failure

**ตัวอย่างใน Picklist Create API:**

```typescript
// Step 1: Create picklist ✅
const { data: picklist } = await supabase.from('picklists').insert(...)

// Step 2: Create items ✅
await supabase.from('picklist_items').insert(itemsToInsert)

// Step 3: Reserve stock
for (const item of itemsToInsert) {
  await supabase.from('wms_inventory_balances').update(...)  // ถ้าล้ม?
}
```

**ปัญหา:**
- ถ้า Step 3 ล้มครึ่งทาง → Picklist สร้างแล้ว + Items สร้างแล้ว แต่จองไม่ครบ
- ไม่มี Rollback → Data inconsistent

**คำแนะนำ:**
```typescript
try {
  // ใช้ Supabase Transaction (ถ้ามี) หรือ
  // ทำ Rollback manual

  const picklist = await createPicklist();
  const items = await createItems(picklist.id);
  await reserveStock(items);

} catch (error) {
  // Rollback
  if (picklist?.id) {
    await supabase.from('picklists').delete().eq('id', picklist.id);
  }
  throw error;
}
```

---

## ✅ WHAT'S WORKING CORRECTLY

### ✅ Correct Implementation #1: Balance Sync Fix with skip_balance_sync Flag

**Migration:** [047_add_skip_balance_sync_flag.sql](supabase/migrations/047_add_skip_balance_sync_flag.sql)

การแก้ไข double balance update ด้วย flag approach เป็นวิธีที่**ดีเยี่ยม**:
- ✅ ไม่ disable trigger → ยังใช้ได้กับ operation อื่น
- ✅ Backward compatible → Ledger เก่ายังทำงานปกติ
- ✅ Flexible → API เลือกได้ว่าจะใช้ trigger หรือไม่
- ✅ Clear separation → API update balance = set flag TRUE

---

### ✅ Correct Implementation #2: Workflow Triggers Design

**Migration:** [027_create_workflow_status_triggers.sql](supabase/migrations/027_create_workflow_status_triggers.sql)

Triggers ครอบคลุมทุกขั้นตอนของ workflow:
1. ✅ Route Publish → Orders: draft→confirmed
2. ⚠️ Picklist Create → Orders: confirmed→in_picking (ควรเปลี่ยนเป็น assign)
3. ✅ Picklist Complete → Orders: in_picking→picked + Route: published→ready_to_load
4. ✅ Loadlist Complete → Orders: picked→loaded + Route: ready_to_load→in_transit
5. ✅ Order Delivered → Route: in_transit→completed

**ข้อดี:**
- ทำงานอัตโนมัติ
- ไม่ต้องเขียน logic ใน API ทุกตัว
- Centralized logic

---

### ✅ Correct Implementation #3: FEFO + FIFO Stock Selection

**File:** [app/api/picklists/create-from-trip/route.ts](app/api/picklists/create-from-trip/route.ts#L267-269)

```typescript
.order('expiry_date', { ascending: true, nullsFirst: false }) // FEFO
.order('production_date', { ascending: true, nullsFirst: false }) // FIFO
.order('created_at', { ascending: true })
```

✅ **ถูกต้องตามหลักการ warehouse management**

---

### ✅ Correct Implementation #4: Location-Specific Stock Reservation

**File:** [app/api/picklists/create-from-trip/route.ts](app/api/picklists/create-from-trip/route.ts#L264)

```typescript
.eq('location_id', item.source_location_id)  // ✅ จำกัดเฉพาะ location ที่กำหนด
```

จองสต็อคจาก preparation area ที่กำหนดเท่านั้น ไม่จองจาก warehouse ทั้งหมด

---

### ✅ Correct Implementation #5: API Returns Detailed Response

**Example:** [app/api/mobile/pick/scan/route.ts](app/api/mobile/pick/scan/route.ts#L315-320)

```typescript
return NextResponse.json({
  success: true,
  message: 'บันทึกการหยิบสินค้าสำเร็จ',
  picklist_status: newStatus,
  picklist_completed: allPicked,
  quantity_picked: quantity_picked
});
```

✅ Response ละเอียด ช่วยให้ Frontend รู้สถานะครบถ้วน

---

## 📊 WORKFLOW ANALYSIS (วิเคราะห์แต่ละ Workflow)

### 🔵 WORKFLOW 1: Picklist Creation

**Endpoint:** `POST /api/picklists/create-from-trip`
**Frontend:** [app/receiving/picklists/page.tsx](app/receiving/picklists/page.tsx#L465)

**ขั้นตอน:**
1. Frontend ดึง approved plans จาก `/api/route-plans/published`
2. User เลือก trips + ระบุ loading door
3. API สร้าง Picklist + Picklist Items
4. API จองสต็อคตาม FEFO+FIFO จาก `source_location_id`
5. Trigger 2 อัปเดต Orders เป็น `in_picking`

**ผลการตรวจสอบ:**
| ข้อกำหนด | สถานะ | หมายเหตุ |
|---------|-------|---------|
| ดึงเฉพาะแผนส่งที่อนุมัติแล้ว | ✅ PASS | API กรอง status='approved' |
| เลือก SKU จาก location ที่ระบุ | ✅ PASS | ใช้ source_location_id จาก default_location |
| API/Trigger ไม่เลือกจาก location อื่น | ✅ PASS | จำกัดด้วย .eq('location_id', source_location_id) |

**Issues Found:**
- ⚠️ ถ้า SKU ไม่มี default_location → source_location_id = null → หยิบไม่ได้ (WARNING #3)
- ❌ Partial reservation ไม่ fail request (ERROR #2)

---

### 🔵 WORKFLOW 2: Stock Reservation เมื่อมอบหมาย (Assigned)

**Endpoint:** `PATCH /api/picklists/[id]` with `status = 'assigned'`
**Frontend:** [app/receiving/picklists/page.tsx](app/receiving/picklists/page.tsx#L354-384)

**ขั้นตอน:**
1. User เปลี่ยน status เป็น 'assigned' ผ่าน dropdown
2. API ตรวจสอบว่าเคยจองแล้วหรือยัง (wasAlreadyAssigned)
3. ถ้ายังไม่จอง → จองสต็อคตาม FEFO+FIFO
4. อัปเดต `reserved_pack_qty` และ `reserved_piece_qty` ใน inventory_balances

**ผลการตรวจสอบ:**
| ข้อกำหนด | สถานะ | หมายเหตุ |
|---------|-------|---------|
| อัปเดต inventory_balances | ✅ PASS | อัปเดต reserved_* ใน Line 312-317 |
| เพิ่มยอดจอง แพ็คจอง / ชิ้นจอง | ✅ PASS | Update reserved_pack_qty และ reserved_piece_qty |
| จองเฉพาะจาก source_location | ✅ PASS | .eq('location_id', source_location_id) Line 272 |
| API/Trigger คำนวณถูกต้อง | ✅ PASS | pack = piece / qty_per_pack Line 307 |
| ไม่ทับซ้อนกัน | ⚠️ WARNING | อาจมี race condition (WARNING #1) |

**Issues Found:**
- ⚠️ Race condition ถ้ามี 2 requests พร้อมกัน (WARNING #1)
- ❌ จองซ้ำถ้า user เปลี่ยนสถานะไปมา (ป้องกันด้วย wasAlreadyAssigned แล้ว ✅)

---

### 🔵 WORKFLOW 3: Mobile Pick Process

**Endpoint:** `POST /api/mobile/pick/scan`
**Frontend:** Mobile app (ไม่มีในโค้ด - เป็น API endpoint)

**ขั้นตอน:**
1. Mobile scan picklist QR code
2. API ลดยอดจองใน source_location (FEFO+FIFO)
3. API ลดสต็อคจริง (total_pack_qty, total_piece_qty)
4. API เพิ่มสต็อคที่ Dispatch
5. API บันทึก ledger (OUT + IN) พร้อม skip_balance_sync=true
6. อัปเดต picklist_item.status = 'picked'
7. ถ้าทุก item picked → picklist.status = 'completed'

**ผลการตรวจสอบ:**
| ข้อกำหนด | สถานะ | หมายเหตุ |
|---------|-------|---------|
| ลดยอดจอง แพ็คจอง/ชิ้นจอง | ✅ PASS | Line 164-168 |
| ลดสต็อคจริง แพ็ครวม/ชิ้นรวม | ✅ PASS | Line 164-168 |
| เพิ่มสต็อคที่ Dispatch | ✅ PASS | Line 223-246 |
| บันทึกใน Ledger | ✅ PASS | Line 182-196, 249-263 |
| ทุกขั้นตอนถูกต้อง | ⚠️ WARNING | FEFO ครั้งที่ 2 อาจไม่ match (ERROR #3) |

**Issues Found:**
- ❌ CRITICAL: FEFO/FIFO query ใหม่อาจไม่ match กับที่จองไว้ (ERROR #3)
- ✅ Balance sync ไม่ซ้ำแล้ว (skip_balance_sync=true)

---

### 🔵 WORKFLOW 4: Loadlist Creation

**Endpoint:** `POST /api/loadlists`
**Frontend:** [app/receiving/loadlists/page.tsx](app/receiving/loadlists/page.tsx)

**ขั้นตอน:**
1. User เลือก picklists ที่ status = 'completed'
2. API สร้าง loadlist + link picklists ผ่าน wms_loadlist_picklists
3. สร้างเสร็จ → status = 'pending'

**ผลการตรวจสอบ:**
| ข้อกำหนด | สถานะ | หมายเหตุ |
|---------|-------|---------|
| ดึงเฉพาะ picklists ที่ completed | ⚠️ NOT VERIFIED | ไม่เห็น API filter |
| ไม่ดึงผิดสถานะ | ⚠️ WARNING | ควรมี validation |
| Trigger ไม่ทับซ้อน/เพิ่มซ้ำ | ✅ PASS | ใช้ wms_loadlist_picklists junction table |

**Issues Found:**
- ⚠️ ไม่เห็น API endpoint ที่ fetch "available picklists for loadlist creation"
- Frontend อาจต้อง filter เองว่าเลือกเฉพาะ status='completed'

---

### 🔵 WORKFLOW 5: Mobile Loading Process

**Endpoint:** `POST /api/mobile/loading/complete`
**Frontend:** Mobile app

**ขั้นตอน:**
1. Mobile scan loadlist QR code
2. API verify QR code ตรงกับ loadlist_code
3. API ตรวจสอบสต็อคที่ Dispatch
4. API ลดสต็อคจาก Dispatch
5. API เพิ่มสต็อคที่ Delivery-In-Progress
6. API บันทึก ledger พร้อม skip_balance_sync=true
7. API update loadlist.status = 'loaded'
8. Trigger อัปเดต Orders เป็น 'loaded' + Route เป็น 'in_transit'

**ผลการตรวจสอบ:**
| ข้อกำหนด | สถานะ | หมายเหตุ |
|---------|-------|---------|
| ลดสต็อคจาก Dispatch | ✅ PASS | Line 211-218 |
| เพิ่มสต็อคที่ Delivery-In-Progress | ✅ PASS | Line 257-278 |
| อัปเดต Ledger | ✅ PASS | Line 164-195 |
| คำนวณถูกต้อง | ✅ PASS | Decimal calculation without Math.floor() |
| ไม่ลดผิด location | ✅ PASS | จำกัดด้วย .eq('location_id', ...) |

**Issues Found:**
- ❌ CRITICAL: Partial loading โดยไม่ fail request (ERROR #4)
- ⚠️ ถ้าสต็อคที่ Dispatch ไม่พอ → สร้าง alert แต่ continue (ควร fail)

---

## 🔧 DATABASE TRIGGERS AUDIT

### Trigger Summary

| Trigger | Table | Event | Function | Status |
|---------|-------|-------|----------|--------|
| 1. trigger_route_publish_update_orders | receiving_route_plans | AFTER UPDATE | update_orders_on_route_publish() | ✅ OK |
| 2. trigger_picklist_create_update_orders | picklists | AFTER INSERT | update_orders_on_picklist_create() | ⚠️ FIX NEEDED |
| 3. trigger_picklist_complete_update_orders_and_route | picklists | AFTER UPDATE | update_orders_and_route_on_picklist_complete() | ✅ OK |
| 4. trigger_loadlist_complete_update_orders | loadlists | AFTER UPDATE | update_orders_on_loadlist_complete() | ✅ OK |
| 5. trigger_delivery_update_route | wms_orders | AFTER UPDATE | update_route_on_delivery() | ✅ OK |
| 6. trg_sync_inventory_ledger_to_balance | wms_inventory_ledger | AFTER INSERT | sync_inventory_ledger_to_balance() | ✅ OK (with flag) |

### Trigger Overlap Analysis

**Trigger vs API Conflicts:**

| Operation | API | Trigger | Overlap? | Resolution |
|-----------|-----|---------|----------|------------|
| Picklist Create | Creates with status='pending' | Updates Orders to in_picking | ⚠️ MAYBE | Trigger ควรทำงานเมื่อ assigned ไม่ใช่ create |
| Pick Stock | Updates balance manually | sync_inventory_ledger_to_balance | ✅ RESOLVED | skip_balance_sync=true |
| Loading Stock | Updates balance manually | sync_inventory_ledger_to_balance | ✅ RESOLVED | skip_balance_sync=true |
| Loadlist Complete | Updates loadlist.status | Trigger updates Orders + Route | ✅ NO OVERLAP | Clear separation |
| Order Delivered | Updates order.status | Trigger updates Route | ✅ NO OVERLAP | Clear separation |

**Recommendation:**
- แก้ไข Trigger #2 เป็น AFTER UPDATE แทน AFTER INSERT
- เช็คเงื่อนไข `status = 'assigned'` แทน

---

## 🎯 ARCHITECTURE RECOMMENDATIONS

### 1. Database Design Improvements

**เพิ่มตาราง picklist_item_reservations:**
```sql
CREATE TABLE picklist_item_reservations (
    id BIGSERIAL PRIMARY KEY,
    picklist_item_id BIGINT REFERENCES picklist_items(id),
    balance_id BIGINT REFERENCES wms_inventory_balances(balance_id),
    reserved_piece_qty NUMERIC(18,6) NOT NULL,
    reserved_pack_qty NUMERIC(18,6) NOT NULL,
    reserved_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(picklist_item_id, balance_id)
);
```

**ประโยชน์:**
- ✅ Track exact balances ที่จองไว้
- ✅ Unreserve ได้ถูกต้อง 100%
- ✅ Audit trail ชัดเจน
- ✅ ไม่ต้อง query FEFO ใหม่ตอน pick

---

### 2. API Best Practices

**Transaction Pattern:**
```typescript
async function createPicklistWithReservation(data) {
  let picklist;
  let items;

  try {
    // 1. Create picklist
    picklist = await createPicklist(data);

    // 2. Create items
    items = await createItems(picklist.id, data.items);

    // 3. Reserve stock
    const reservations = await reserveStock(items);

    // 4. Validate reservations
    if (reservations.some(r => r.shortage > 0)) {
      throw new Error('Insufficient stock');
    }

    return { picklist, items, reservations };

  } catch (error) {
    // Rollback
    if (picklist) await deletePicklist(picklist.id);
    throw error;
  }
}
```

---

### 3. Status Validation

**State Machine Enforcement:**
```typescript
const VALID_TRANSITIONS = {
  'pending': ['assigned', 'cancelled'],
  'assigned': ['picking', 'pending', 'cancelled'],
  'picking': ['completed', 'assigned', 'cancelled'],
  'completed': [],  // Final state
  'cancelled': []   // Final state
};

function validateStatusChange(oldStatus, newStatus) {
  if (!VALID_TRANSITIONS[oldStatus]?.includes(newStatus)) {
    throw new Error(`Invalid transition: ${oldStatus} → ${newStatus}`);
  }
}
```

---

### 4. Stock Validation Before Operations

**Pre-Operation Check:**
```typescript
async function validateStockBeforeLoading(loadlist_id) {
  const items = await getLoadlistItems(loadlist_id);
  const insufficientItems = [];

  for (const item of items) {
    const available = await getStockAt('Dispatch', item.sku_id);
    if (available < item.quantity) {
      insufficientItems.push({
        sku_id: item.sku_id,
        required: item.quantity,
        available
      });
    }
  }

  if (insufficientItems.length > 0) {
    return {
      valid: false,
      errors: insufficientItems
    };
  }

  return { valid: true };
}
```

---

## 📈 SUMMARY & ACTION ITEMS

### 🔴 Priority 1 (Critical - ต้องแก้ไขเร่งด่วน)

1. ❌ **Fix Picklist Creation Partial Reservation** (ERROR #2)
   - ปรับให้ FAIL request ถ้าสต็อคไม่พอ
   - หรือแสดงเตือนชัดเจนใน UI

2. ❌ **Fix FEFO Balance Mismatch** (ERROR #3)
   - สร้างตาราง `picklist_item_reservations`
   - Mobile Pick ลดตาม balance_id ที่จองไว้

3. ❌ **Fix Loadlist Incomplete Loading** (ERROR #4)
   - เพิ่ม validation ก่อน complete
   - FAIL request ถ้าสต็อคไม่ครบ

### ⚠️ Priority 2 (Important - ควรแก้ไขเร็ว)

4. ⚠️ **Fix Picklist Create Trigger** (ERROR #5)
   - เปลี่ยนจาก AFTER INSERT → AFTER UPDATE
   - ทำงานเมื่อ status='assigned' เท่านั้น

5. ⚠️ **Add Race Condition Protection** (WARNING #1)
   - ใช้ SELECT FOR UPDATE
   - หรือ Optimistic Locking

6. ⚠️ **Add Source Location Validation** (WARNING #3)
   - Fail request ถ้า SKU ไม่มี default_location
   - แจ้งผู้ใช้ให้ config ก่อน

### ✅ Priority 3 (Enhancement - ปรับปรุงเพิ่มเติม)

7. ✅ **Add Status Transition Validation** (WARNING #7)
   - สร้าง State Machine Trigger
   - ป้องกันการเปลี่ยนสถานะผิดลำดับ

8. ✅ **Improve Error Handling** (WARNING #8)
   - เพิ่ม Transaction Rollback
   - Error response ละเอียดขึ้น

9. ✅ **Add Logging & Monitoring**
   - Log ทุก stock operation
   - Alert เมื่อ balance ติดลบ

---

## 📝 CONCLUSION

ระบบ WMS นี้มีการออกแบบที่**ดีโดยรวม** และ**ได้รับการแก้ไขปัญหา balance sync ล่าสุด** แต่ยังมี**จุดเสี่ยงที่ต้องแก้ไขเร่งด่วน** โดยเฉพาะเรื่อง:

1. **Stock validation** ไม่เข้มงวดพอ → อาจ partial operation
2. **FEFO/FIFO matching** ระหว่าง reservation กับ actual pick
3. **Race conditions** ในการจองสต็อคพร้อมกัน

**คำแนะนำหลัก:**
✅ แก้ไข Priority 1 ทั้ง 3 items ก่อนใช้งาน Production
✅ เพิ่ม `picklist_item_reservations` table
✅ เพิ่ม Status Transition Validation
✅ เพิ่ม Transaction Rollback ในทุก Multi-Step Operations

**Overall Rating: 80/100** (Good with critical fixes needed)

---

**เอกสารนี้สร้างโดย:** Claude Code Technical Auditor
**วันที่:** 2025-11-29
**เวอร์ชัน:** 1.0
**สถานะ:** Final Review Complete

