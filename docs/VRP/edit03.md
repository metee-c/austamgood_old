# 🐛 BUG-006: Pick Confirmation ไม่ Release Reservation

## 📋 Summary

| Item | Value |
|------|-------|
| **Bug ID** | BUG-006 |
| **Priority** | P0 - CRITICAL |
| **Status** | Ready for Implementation |
| **Impact** | ยอดจองค้าง → สร้าง Picklist ใหม่ไม่ได้ |
| **Evidence** | 59 reservations ค้าง, 300+ pieces |

---

## 🐛 Problem

เมื่อ Worker หยิบสินค้าเสร็จ (Pick Complete):
- ✅ `picklist_items.status` = `"picked"` 
- ❌ `picklist_item_reservations.status` = ยังเป็น `"reserved"` (BUG!)
- ❌ `wms_inventory_balances.reserved_piece_qty` = ไม่ลด (BUG!)

**Result:** สต็อคว่างแต่ระบบบอกว่าจองอยู่ → สร้าง Picklist/Face Sheet ใหม่ไม่ได้

---

## 📁 Files Created

### 1. Prompt for AI
```
/home/claude/prompts/05_FIX_PICK_CONFIRMATION_BUG_PROMPT.md
```
- วิธี analyze pick confirmation code
- วิธี implement fix
- Test cases

### 2. Analysis Document
```
/home/claude/analysis/BUG_006_PICK_CONFIRMATION_FLOW_ANALYSIS.md
```
- Data flow diagram
- Tables involved
- Root cause analysis
- Evidence

### 3. Migration 225
```
/home/claude/migrations/225_fix_pick_confirmation_reservation_release.sql
```
- `confirm_pick_item_with_reservation_release()` - Atomic function
- `complete_picklist_with_reservation_release()` - Batch function
- `fix_stuck_picklist_reservations()` - Fix existing data
- `trg_auto_release_reservation_on_pick` - Safety trigger
- `v_stuck_picklist_reservations` - Monitoring view

---

## 🚀 How to Use

### Step 1: Copy Prompt to AI

```bash
cat /home/claude/prompts/05_FIX_PICK_CONFIRMATION_BUG_PROMPT.md
```

ส่ง prompt นี้ให้ AI อีกตัว (Kiro/Cursor/etc.) เพื่อ:
1. วิเคราะห์ code จริงในโปรเจค
2. หาจุดที่ทำให้เกิด bug
3. แก้ไข API route

### Step 2: Apply Migration

```bash
# Copy migration to project
cp /home/claude/migrations/225_fix_pick_confirmation_reservation_release.sql \
   supabase/migrations/225_fix_pick_confirmation_reservation_release.sql

# Apply migration
psql -h <host> -d <database> < supabase/migrations/225_fix_pick_confirmation_reservation_release.sql
```

### Step 3: Fix Existing Data

```sql
-- Fix stuck reservations
SELECT * FROM fix_stuck_picklist_reservations();

-- Verify (should return 0 rows)
SELECT COUNT(*) FROM v_stuck_picklist_reservations;
```

### Step 4: Update API

Update pick confirmation API to use new function:

```typescript
// app/api/mobile/pick/scan/route.ts

const { data, error } = await supabase.rpc('confirm_pick_item_with_reservation_release', {
  p_picklist_item_id: itemId,
  p_picked_qty: quantity,
  p_picked_by: userId
});
```

---

## 📊 Migration Contents

### Functions Created

| Function | Purpose |
|----------|---------|
| `confirm_pick_item_with_reservation_release()` | ยืนยันหยิบ 1 รายการ + release reservation |
| `complete_picklist_with_reservation_release()` | ยืนยันหยิบทั้งใบ + release all |
| `fix_stuck_picklist_reservations()` | แก้ไข reservations ที่ค้างอยู่ |

### Trigger Created

| Trigger | Purpose |
|---------|---------|
| `trg_auto_release_reservation_on_pick` | Safety net - auto release ถ้า function ไม่ทำงาน |

### View Created

| View | Purpose |
|------|---------|
| `v_stuck_picklist_reservations` | Monitor reservations ที่ค้าง (ควรเป็น 0) |

---

## ✅ Verification

หลังจาก apply migration:

```sql
-- 1. Verify functions created
SELECT proname FROM pg_proc 
WHERE proname IN (
  'confirm_pick_item_with_reservation_release',
  'complete_picklist_with_reservation_release',
  'fix_stuck_picklist_reservations'
);
-- Should return 3 rows

-- 2. Verify trigger created
SELECT tgname FROM pg_trigger 
WHERE tgname = 'trg_auto_release_reservation_on_pick';
-- Should return 1 row

-- 3. Verify view created
SELECT viewname FROM pg_views 
WHERE viewname = 'v_stuck_picklist_reservations';
-- Should return 1 row

-- 4. Fix existing stuck reservations
SELECT * FROM fix_stuck_picklist_reservations();

-- 5. Verify no stuck reservations
SELECT COUNT(*) FROM v_stuck_picklist_reservations;
-- Should return 0
```

---

## 🧪 Test Cases

### Test 1: Single Pick
```sql
-- Pick 1 item
SELECT * FROM confirm_pick_item_with_reservation_release(
  p_picklist_item_id := 123,
  p_picked_qty := 10,
  p_picked_by := 'test_user'
);

-- Verify reservation released
SELECT status FROM picklist_item_reservations 
WHERE picklist_item_id = 123;
-- Should be 'picked'
```

### Test 2: Complete Picklist
```sql
-- Complete entire picklist
SELECT * FROM complete_picklist_with_reservation_release(
  p_picklist_id := 456,
  p_completed_by := 'test_user'
);

-- Verify all reservations released
SELECT COUNT(*) FROM picklist_item_reservations pir
JOIN picklist_items pi ON pi.id = pir.picklist_item_id
WHERE pi.picklist_id = 456 AND pir.status = 'reserved';
-- Should be 0
```

### Test 3: Monitor Stuck Reservations
```sql
-- Should always be empty after fix
SELECT COUNT(*) FROM v_stuck_picklist_reservations;
-- Should be 0
```

---

## 📈 Expected Results

| Metric | Before | After |
|--------|--------|-------|
| Stuck reservations | 59 | **0** |
| Stuck qty | 300+ pieces | **0** |
| New bugs | - | **None** |

---

## 🔗 Related Documents

- `BUG_FIX_IMPLEMENTATION_GUIDE.md` - Overall bug fix guide
- `IMPLEMENTATION_PROGRESS.md` - Progress tracking
- `COMPLETE_SUCCESS.md` - Previous fixes summary

---

## 📞 Next Steps for AI (Kiro)

1. **Read Prompt:** `/home/claude/prompts/05_FIX_PICK_CONFIRMATION_BUG_PROMPT.md`
2. **Analyze Code:** Find pick confirmation API in project
3. **Apply Migration:** Copy and run migration 225
4. **Update API:** Use new atomic functions
5. **Test:** Verify reservations are released correctly

---

**Status:** ✅ Ready for Implementation
**Created:** 2026-01-18
**Author:** Claude AI Bug Fix Kit


# 🔧 Prompt #5: Fix Pick Confirmation Reservation Status Bug

## 📋 Bug Overview

**Bug ID:** BUG-006  
**Priority:** P0 - CRITICAL  
**Impact:** ยอดจองไม่ถูกปล่อยเมื่อหยิบเสร็จ → สต็อคค้าง → สร้าง Picklist ใหม่ไม่ได้

---

## 🐛 Problem Description

### สิ่งที่เกิดขึ้น
เมื่อยืนยันหยิบสินค้าเสร็จ (Pick Confirmation):
- ✅ `picklists.status` → `"completed"` (ถูกต้อง)
- ✅ `picklist_items.status` → `"picked"` (ถูกต้อง)
- ❌ `picklist_item_reservations.status` → ยังเป็น `"reserved"` (BUG!)
- ❌ `wms_inventory_balances.reserved_piece_qty` → ไม่ถูกลด (BUG!)

### ผลกระทบ
1. ยอดจองไม่ถูกปล่อย
2. สต็อคว่างแต่ระบบบอกว่าจองอยู่
3. สร้าง Picklist/Face Sheet ใหม่ไม่ได้ → "สต็อคไม่พอ"
4. พบ 59 reservations ค้างจาก picklists วันที่ 14-18 มกราคม

---

## 🎯 Instructions for AI

### Step 1: Locate Pick Confirmation Code

ค้นหาไฟล์ที่เกี่ยวข้องกับการยืนยันหยิบ:

```bash
# Find pick-related API routes
find app/api -name "*.ts" | xargs grep -l "pick\|confirm\|complete"

# Search for reservation status updates
grep -rn "reservation" app/api/mobile/ --include="*.ts"
grep -rn "reserved_piece_qty" app/api/mobile/ --include="*.ts"

# Find database functions related to pick
grep -rn "pick" supabase/migrations/ --include="*.sql" | grep -i "function\|procedure"
```

**Files to analyze:**
```
app/api/mobile/pick/scan/route.ts          ← Scan และยืนยันหยิบรายการ
app/api/mobile/pick/complete/route.ts      ← ยืนยันหยิบเสร็จทั้งใบ
app/api/mobile/pick/[id]/route.ts          ← Get picklist details
app/api/mobile/pick/confirm/route.ts       ← Confirm pick (ถ้ามี)
supabase/migrations/*pick*.sql             ← Database functions
```

### Step 2: Understand Current Flow

**Expected Flow:**
```
1. Worker scans item → API: POST /api/mobile/pick/scan
   ├─ Validate item exists in picklist
   ├─ Check reservation exists
   ├─ Update picklist_items.status = 'picked'
   ├─ Update picklist_item_reservations.status = 'picked'  ← ❌ MISSING!
   └─ Release reservation from wms_inventory_balances      ← ❌ MISSING!

2. Worker completes picklist → API: POST /api/mobile/pick/complete
   ├─ Validate all items picked
   ├─ Update picklists.status = 'completed'
   ├─ Verify all reservations released                     ← ❌ MISSING!
   └─ Create inventory ledger entries
```

### Step 3: Identify the Bug

**Look for missing code:**

```typescript
// ❌ CURRENT (BUG) - Only updates picklist_items
await supabase
  .from('picklist_items')
  .update({ status: 'picked', picked_at: new Date() })
  .eq('id', item.id);

// ✅ SHOULD ALSO DO:
// 1. Update reservation status
await supabase
  .from('picklist_item_reservations')
  .update({ status: 'picked' })
  .eq('picklist_item_id', item.id);

// 2. Release reservation from inventory balance
await supabase
  .from('wms_inventory_balances')
  .update({ 
    reserved_piece_qty: reserved_piece_qty - item.quantity,
    reserved_pack_qty: reserved_pack_qty - item.pack_qty
  })
  .eq('balance_id', reservation.balance_id);
```

### Step 4: Implement Fix

**Option A: Fix in API Route**

```typescript
// File: app/api/mobile/pick/scan/route.ts

export async function POST(request: NextRequest) {
  const { picklist_item_id, quantity_picked } = await request.json();
  
  // ... validation code ...
  
  // 1. Get reservations for this item
  const { data: reservations } = await supabase
    .from('picklist_item_reservations')
    .select('*')
    .eq('picklist_item_id', picklist_item_id)
    .eq('status', 'reserved');
  
  // 2. Update picklist item
  await supabase
    .from('picklist_items')
    .update({ 
      status: 'picked', 
      picked_quantity: quantity_picked,
      picked_at: new Date().toISOString()
    })
    .eq('id', picklist_item_id);
  
  // 3. ✅ FIX: Update reservation status
  for (const reservation of reservations || []) {
    await supabase
      .from('picklist_item_reservations')
      .update({ status: 'picked' })
      .eq('reservation_id', reservation.reservation_id);
    
    // 4. ✅ FIX: Release reservation from inventory balance
    await supabase
      .from('wms_inventory_balances')
      .update({ 
        reserved_piece_qty: supabase.raw('reserved_piece_qty - ?', [reservation.reserved_piece_qty]),
        reserved_pack_qty: supabase.raw('reserved_pack_qty - ?', [reservation.reserved_pack_qty])
      })
      .eq('balance_id', reservation.balance_id);
  }
  
  return NextResponse.json({ success: true });
}
```

**Option B: Fix with Database Function (Recommended)**

สร้าง database function ที่ handle ทั้งหมดใน transaction เดียว:

```sql
-- File: supabase/migrations/225_fix_pick_confirmation_reservation_release.sql

CREATE OR REPLACE FUNCTION confirm_pick_item(
  p_picklist_item_id BIGINT,
  p_quantity_picked NUMERIC,
  p_picked_by VARCHAR DEFAULT 'System'
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  reservations_released INTEGER
) LANGUAGE plpgsql AS $func$
DECLARE
  v_reservation RECORD;
  v_released_count INTEGER := 0;
BEGIN
  -- 1. Update picklist item
  UPDATE picklist_items
  SET 
    status = 'picked',
    picked_quantity = p_quantity_picked,
    picked_at = CURRENT_TIMESTAMP,
    picked_by = p_picked_by
  WHERE id = p_picklist_item_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Picklist item not found'::TEXT, 0;
    RETURN;
  END IF;
  
  -- 2. Release all reservations for this item
  FOR v_reservation IN
    SELECT 
      pir.reservation_id,
      pir.balance_id,
      pir.reserved_piece_qty,
      pir.reserved_pack_qty
    FROM picklist_item_reservations pir
    WHERE pir.picklist_item_id = p_picklist_item_id
    AND pir.status = 'reserved'
    FOR UPDATE OF pir  -- Lock to prevent race condition
  LOOP
    -- Update reservation status
    UPDATE picklist_item_reservations
    SET status = 'picked'
    WHERE reservation_id = v_reservation.reservation_id;
    
    -- Release from inventory balance
    UPDATE wms_inventory_balances
    SET 
      reserved_piece_qty = GREATEST(0, reserved_piece_qty - v_reservation.reserved_piece_qty),
      reserved_pack_qty = GREATEST(0, reserved_pack_qty - v_reservation.reserved_pack_qty),
      updated_at = CURRENT_TIMESTAMP
    WHERE balance_id = v_reservation.balance_id;
    
    v_released_count := v_released_count + 1;
  END LOOP;
  
  RETURN QUERY SELECT TRUE, format('Released %s reservations', v_released_count)::TEXT, v_released_count;
END;
$func$;

COMMENT ON FUNCTION confirm_pick_item IS 
  'ยืนยันหยิบสินค้าพร้อมปล่อย reservation - Atomic transaction v1.0';
```

### Step 5: Update API to Use New Function

```typescript
// File: app/api/mobile/pick/scan/route.ts

export async function POST(request: NextRequest) {
  const { picklist_item_id, quantity_picked, picked_by } = await request.json();
  
  // Use atomic function
  const { data, error } = await supabase.rpc('confirm_pick_item', {
    p_picklist_item_id: picklist_item_id,
    p_quantity_picked: quantity_picked,
    p_picked_by: picked_by || 'System'
  });
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  const result = data?.[0];
  
  if (!result?.success) {
    return NextResponse.json({ error: result?.message }, { status: 400 });
  }
  
  return NextResponse.json({
    success: true,
    message: result.message,
    reservations_released: result.reservations_released
  });
}
```

### Step 6: Add Safety Trigger (Optional)

```sql
-- Trigger: Auto-release reservation when picklist_items.status changes to 'picked'

CREATE OR REPLACE FUNCTION trigger_release_reservation_on_pick()
RETURNS TRIGGER AS $trigger$
BEGIN
  -- Only trigger when status changes to 'picked'
  IF NEW.status = 'picked' AND (OLD.status IS NULL OR OLD.status != 'picked') THEN
    -- Release reservations
    UPDATE picklist_item_reservations
    SET status = 'picked'
    WHERE picklist_item_id = NEW.id
    AND status = 'reserved';
    
    -- Release from inventory balance
    UPDATE wms_inventory_balances ib
    SET 
      reserved_piece_qty = GREATEST(0, ib.reserved_piece_qty - pir.reserved_piece_qty),
      reserved_pack_qty = GREATEST(0, ib.reserved_pack_qty - pir.reserved_pack_qty)
    FROM picklist_item_reservations pir
    WHERE pir.picklist_item_id = NEW.id
    AND pir.balance_id = ib.balance_id;
  END IF;
  
  RETURN NEW;
END;
$trigger$ LANGUAGE plpgsql;

CREATE TRIGGER trg_release_reservation_on_pick
  AFTER UPDATE ON picklist_items
  FOR EACH ROW
  EXECUTE FUNCTION trigger_release_reservation_on_pick();
```

---

## 📝 Checklist Before Commit

- [ ] ค้นหา code ที่ทำ pick confirmation
- [ ] ระบุจุดที่ขาด reservation release
- [ ] เลือก fix option (API หรือ Database Function)
- [ ] สร้าง migration file
- [ ] Update API route
- [ ] Test กับ single pick confirmation
- [ ] Test กับ concurrent pick confirmations
- [ ] Verify ยอดจองถูกปล่อยถูกต้อง
- [ ] Code review

---

## ⚠️ Important Notes

1. **ต้องแก้ทั้ง Picklist และ Face Sheet** - ตรวจสอบว่า Face Sheet pick มีปัญหาเหมือนกันไหม
2. **Backward Compatibility** - Function ใหม่ต้องไม่ทำให้ code เก่าพัง
3. **Transaction Safety** - ทุก operation ต้องอยู่ใน transaction เดียว
4. **Race Condition** - ใช้ FOR UPDATE เพื่อป้องกัน concurrent issues

---

## 🧪 Test Cases

1. **Single Pick:**
   - Pick 1 item → reservation ถูกปล่อย → ยอดจองลด

2. **Complete Picklist:**
   - Pick ทุก item → ทุก reservation ถูกปล่อย → ยอดจองเป็น 0

3. **Concurrent Pick:**
   - 2 คน pick พร้อมกัน → ไม่มี double release

4. **Partial Pick:**
   - Pick บางส่วน → reservation ถูกปล่อยตามส่วน

---

## 🔗 Related Files

- `app/api/mobile/pick/scan/route.ts`
- `app/api/mobile/pick/complete/route.ts`
- `supabase/migrations/225_fix_pick_confirmation_reservation_release.sql`
- `docs/picklists/BUG_FIX_IMPLEMENTATION_GUIDE.md`


# 🔍 Analysis: Pick Confirmation Flow - BUG-006

## 📋 Overview

วิเคราะห์ flow การยืนยันหยิบสินค้า (Pick Confirmation) เพื่อหาจุดที่ทำให้ reservation ไม่ถูก release

---

## 📊 Current Data Flow

### Expected Flow (ที่ควรจะเป็น)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PICK CONFIRMATION FLOW                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. Worker scans barcode on mobile                                  │
│         ↓                                                           │
│  2. POST /api/mobile/pick/scan                                      │
│         ↓                                                           │
│  3. Validate item & reservation                                     │
│         ↓                                                           │
│  4. UPDATE picklist_items SET status = 'picked'                    │
│         ↓                                                           │
│  5. UPDATE picklist_item_reservations SET status = 'picked' ❌      │
│         ↓                                                           │
│  6. UPDATE wms_inventory_balances (reduce reserved_qty) ❌          │
│         ↓                                                           │
│  7. INSERT wms_inventory_ledger (stock movement) ❓                 │
│         ↓                                                           │
│  8. Complete → POST /api/mobile/pick/complete                       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

❌ = Missing/Not happening (BUG)
❓ = Unknown/Need to verify
```

### Actual Flow (ที่เกิดขึ้นจริง)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ACTUAL FLOW (BUG)                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. Worker scans barcode                                            │
│         ↓                                                           │
│  2. POST /api/mobile/pick/scan                                      │
│         ↓                                                           │
│  3. Validate item                                                   │
│         ↓                                                           │
│  4. UPDATE picklist_items SET status = 'picked' ✅                 │
│         ↓                                                           │
│  5. [MISSING] reservation status ไม่ถูก update ❌                  │
│         ↓                                                           │
│  6. [MISSING] inventory balance ไม่ถูก update ❌                   │
│         ↓                                                           │
│  7. Complete (but reservation still 'reserved')                     │
│                                                                      │
│  Result:                                                            │
│  - picklist_items.status = 'picked' ✅                             │
│  - picklist_item_reservations.status = 'reserved' ❌ (STUCK!)      │
│  - wms_inventory_balances.reserved_qty = unchanged ❌              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔍 Tables Involved

### 1. picklists
```sql
CREATE TABLE picklists (
  id SERIAL PRIMARY KEY,
  picklist_no VARCHAR(50),      -- e.g., 'PL-20260118-001'
  status VARCHAR(20),           -- 'pending' → 'in_progress' → 'completed'
  warehouse_id VARCHAR(10),
  created_at TIMESTAMP,
  completed_at TIMESTAMP
);
```

### 2. picklist_items
```sql
CREATE TABLE picklist_items (
  id SERIAL PRIMARY KEY,
  picklist_id INTEGER REFERENCES picklists(id),
  sku_id VARCHAR(50),
  required_qty NUMERIC,
  picked_qty NUMERIC,
  status VARCHAR(20),           -- 'pending' → 'picked'
  picked_at TIMESTAMP
);
```

### 3. picklist_item_reservations
```sql
CREATE TABLE picklist_item_reservations (
  reservation_id SERIAL PRIMARY KEY,
  picklist_item_id INTEGER REFERENCES picklist_items(id),
  balance_id INTEGER REFERENCES wms_inventory_balances(balance_id),
  reserved_piece_qty NUMERIC,
  reserved_pack_qty NUMERIC,
  status VARCHAR(20),           -- 'reserved' → 'picked' → 'released'
  -- ❌ BUG: status ไม่ถูก update เป็น 'picked'!
);
```

### 4. wms_inventory_balances
```sql
CREATE TABLE wms_inventory_balances (
  balance_id SERIAL PRIMARY KEY,
  sku_id VARCHAR(50),
  warehouse_id VARCHAR(10),
  location_id VARCHAR(50),
  pallet_id VARCHAR(50),
  total_piece_qty NUMERIC,
  reserved_piece_qty NUMERIC,   -- ❌ BUG: ไม่ถูกลดเมื่อ pick!
  total_pack_qty NUMERIC,
  reserved_pack_qty NUMERIC     -- ❌ BUG: ไม่ถูกลดเมื่อ pick!
);
```

---

## 🐛 Bug Evidence

### Evidence 1: Stuck Reservations
```sql
-- Query ที่พบ reservations ค้าง
SELECT 
  pir.reservation_id,
  p.picklist_no,
  p.status as picklist_status,
  pi.status as item_status,
  pir.status as reservation_status,  -- ❌ 'reserved' (ควรเป็น 'picked')
  pir.reserved_piece_qty
FROM picklist_item_reservations pir
JOIN picklist_items pi ON pi.id = pir.picklist_item_id
JOIN picklists p ON p.id = pi.picklist_id
WHERE p.status = 'completed'         -- Picklist เสร็จแล้ว
AND pi.status = 'picked'             -- Item หยิบแล้ว
AND pir.status = 'reserved';         -- แต่ reservation ยังค้าง!

-- Result: 59 rows (ควรเป็น 0)
```

### Evidence 2: Balance Not Released
```sql
-- Query ที่พบยอดจองค้าง
SELECT 
  sku_id,
  SUM(reserved_piece_qty) as stuck_reserved
FROM wms_inventory_balances
WHERE reserved_piece_qty > 0
GROUP BY sku_id;

-- Result: 300 pieces ค้างอยู่ (ควรเป็น 0 หลัง pick complete)
```

---

## 📁 Files to Investigate

### API Routes (Priority Order)

```
1. app/api/mobile/pick/scan/route.ts
   - หน้าที่: ยืนยันหยิบรายการ
   - ควรมี: Update reservation status + Release balance
   - Status: ❓ ต้องตรวจสอบ

2. app/api/mobile/pick/complete/route.ts
   - หน้าที่: ยืนยันหยิบเสร็จทั้งใบ
   - ควรมี: Verify all reservations released
   - Status: ❓ ต้องตรวจสอบ

3. app/api/mobile/pick/[id]/route.ts
   - หน้าที่: Get picklist details, Update item status
   - Status: ❓ ต้องตรวจสอบ

4. app/api/picklists/create-from-trip/route.ts
   - หน้าที่: สร้าง Picklist + Reserve stock
   - Status: ✅ ตรวจสอบแล้ว (Reservation สร้างถูกต้อง)
```

### Database Functions/Triggers

```
1. supabase/migrations/*pick*.sql
   - ค้นหา function ที่เกี่ยวกับ pick

2. supabase/migrations/*reservation*.sql
   - ค้นหา function ที่ release reservation

3. supabase/migrations/209_create_virtual_pallet_system.sql
   - มี reserve_stock_for_face_sheet_items
   - ตรวจสอบว่ามี release function คู่กันไหม
```

---

## 🔎 Root Cause Analysis

### Hypothesis 1: Missing Code in API
```
สมมติฐาน: API route ไม่ได้เรียก code ที่ update reservation

ตรวจสอบโดย:
1. อ่าน app/api/mobile/pick/scan/route.ts
2. หา code ที่ update picklist_item_reservations
3. ถ้าไม่มี → นี่คือ bug location
```

### Hypothesis 2: Incomplete Database Function
```
สมมติฐาน: มี database function แต่ไม่ครบ

ตรวจสอบโดย:
1. ค้นหา function ที่ทำ pick confirmation
2. ตรวจสอบว่า function update reservation status หรือไม่
3. ถ้าไม่ → นี่คือ bug location
```

### Hypothesis 3: Transaction Boundary Issue
```
สมมติฐาน: Update picklist_items กับ update reservation อยู่คนละ transaction

ตรวจสอบโดย:
1. ดู code ว่ามี transaction wrapper หรือไม่
2. ตรวจสอบว่า error handling ถูกต้องหรือไม่
```

---

## 🎯 Most Likely Cause

จากหลักฐานที่พบ **สาเหตุที่น่าจะเป็นไปได้มากที่สุด:**

```
API Route (app/api/mobile/pick/scan/route.ts) 
ทำแค่ update picklist_items.status = 'picked'
แต่ไม่ได้:
1. Update picklist_item_reservations.status
2. Reduce wms_inventory_balances.reserved_piece_qty
```

---

## 🛠️ Recommended Fix

### Option 1: Quick Fix (API Level)
```typescript
// เพิ่ม code ใน pick confirmation API
// After updating picklist_items.status = 'picked':

// 1. Update reservation status
await supabase
  .from('picklist_item_reservations')
  .update({ status: 'picked' })
  .eq('picklist_item_id', itemId);

// 2. Release from balance
const { data: reservations } = await supabase
  .from('picklist_item_reservations')
  .select('balance_id, reserved_piece_qty, reserved_pack_qty')
  .eq('picklist_item_id', itemId);

for (const res of reservations) {
  await supabase.rpc('release_picklist_reservation', {
    p_balance_id: res.balance_id,
    p_piece_qty: res.reserved_piece_qty,
    p_pack_qty: res.reserved_pack_qty
  });
}
```

### Option 2: Robust Fix (Database Function)
```sql
-- สร้าง atomic function ที่ handle ทุกอย่าง
CREATE FUNCTION confirm_pick_item(p_picklist_item_id BIGINT)
RETURNS BOOLEAN AS $$
BEGIN
  -- All updates in single transaction
  UPDATE picklist_items SET status = 'picked' WHERE id = p_picklist_item_id;
  UPDATE picklist_item_reservations SET status = 'picked' WHERE picklist_item_id = p_picklist_item_id;
  UPDATE wms_inventory_balances SET reserved_piece_qty = ... WHERE ...;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
```

### Option 3: Safety Net (Trigger)
```sql
-- Trigger ที่ auto-release reservation เมื่อ item status = 'picked'
CREATE TRIGGER trg_auto_release_reservation
AFTER UPDATE ON picklist_items
FOR EACH ROW
WHEN (NEW.status = 'picked')
EXECUTE FUNCTION auto_release_reservation();
```

---

## 📋 Action Items

1. **[ ] Investigate API Code** - อ่าน pick confirmation API
2. **[ ] Find Missing Code** - หาว่า reservation update อยู่ตรงไหน
3. **[ ] Create Migration** - สร้าง fix migration 225
4. **[ ] Update API** - แก้ไข API route
5. **[ ] Test** - ทดสอบว่า fix ทำงานถูกต้อง
6. **[ ] Document** - Update documentation

---

## 📊 Summary

| Component | Status | Problem |
|-----------|--------|---------|
| picklist_items update | ✅ Working | - |
| reservation status update | ❌ **MISSING** | ไม่ถูก update เป็น 'picked' |
| balance reserved_qty update | ❌ **MISSING** | ไม่ถูกลด |

**Conclusion:** มี gap ใน pick confirmation flow ที่ไม่ได้ release reservation และ balance


-- ============================================================================
-- Migration 225: Fix Pick Confirmation - Auto Release Reservations
-- ============================================================================
-- Author: AI Bug Fix Kit
-- Date: 2026-01-18
-- Bug: BUG-006 - Pick Confirmation ไม่ release reservation
-- Priority: P0 - CRITICAL
-- ============================================================================

-- ============================================================================
-- PART 1: Create Atomic Function for Pick Item Confirmation
-- ============================================================================

CREATE OR REPLACE FUNCTION confirm_pick_item_with_reservation_release(
  p_picklist_item_id BIGINT,
  p_picked_qty NUMERIC,
  p_picked_by VARCHAR DEFAULT 'System'
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  reservations_released INTEGER,
  total_qty_released NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $func$
DECLARE
  v_reservation RECORD;
  v_released_count INTEGER := 0;
  v_total_qty_released NUMERIC := 0;
  v_picklist_item RECORD;
BEGIN
  -- Set lock timeout for safety
  SET LOCAL lock_timeout = '5s';
  
  -- 1. Validate and get picklist item
  SELECT pi.*, p.picklist_no, p.status as picklist_status
  INTO v_picklist_item
  FROM picklist_items pi
  JOIN picklists p ON p.id = pi.picklist_id
  WHERE pi.id = p_picklist_item_id
  FOR UPDATE OF pi;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      FALSE, 
      'ไม่พบรายการในใบหยิบ (Picklist item not found)'::TEXT, 
      0, 
      0::NUMERIC;
    RETURN;
  END IF;
  
  -- 2. Check if already picked
  IF v_picklist_item.status = 'picked' THEN
    RETURN QUERY SELECT 
      FALSE, 
      'รายการนี้ถูกหยิบไปแล้ว (Item already picked)'::TEXT, 
      0, 
      0::NUMERIC;
    RETURN;
  END IF;
  
  -- 3. Update picklist item status
  UPDATE picklist_items
  SET 
    status = 'picked',
    picked_quantity = COALESCE(p_picked_qty, required_qty),
    picked_at = CURRENT_TIMESTAMP,
    picked_by = p_picked_by,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = p_picklist_item_id;
  
  -- 4. Release all reservations for this item
  FOR v_reservation IN
    SELECT 
      pir.reservation_id,
      pir.balance_id,
      pir.reserved_piece_qty,
      pir.reserved_pack_qty,
      ib.sku_id,
      ib.pallet_id
    FROM picklist_item_reservations pir
    JOIN wms_inventory_balances ib ON ib.balance_id = pir.balance_id
    WHERE pir.picklist_item_id = p_picklist_item_id
    AND pir.status IN ('reserved', 'active')  -- Handle both statuses
    FOR UPDATE OF pir, ib  -- Lock both tables to prevent race condition
  LOOP
    -- 4a. Update reservation status
    UPDATE picklist_item_reservations
    SET 
      status = 'picked',
      picked_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE reservation_id = v_reservation.reservation_id;
    
    -- 4b. Release from inventory balance
    UPDATE wms_inventory_balances
    SET 
      reserved_piece_qty = GREATEST(0, COALESCE(reserved_piece_qty, 0) - COALESCE(v_reservation.reserved_piece_qty, 0)),
      reserved_pack_qty = GREATEST(0, COALESCE(reserved_pack_qty, 0) - COALESCE(v_reservation.reserved_pack_qty, 0)),
      updated_at = CURRENT_TIMESTAMP
    WHERE balance_id = v_reservation.balance_id;
    
    -- 4c. Log the release (optional - insert into ledger)
    -- INSERT INTO wms_inventory_ledger (...) VALUES (...);
    
    v_released_count := v_released_count + 1;
    v_total_qty_released := v_total_qty_released + COALESCE(v_reservation.reserved_piece_qty, 0);
  END LOOP;
  
  -- 5. Return success
  RETURN QUERY SELECT 
    TRUE, 
    format('ยืนยันหยิบสำเร็จ ปล่อยการจอง %s รายการ (%s ชิ้น)', v_released_count, v_total_qty_released)::TEXT, 
    v_released_count, 
    v_total_qty_released;
  
EXCEPTION
  WHEN lock_not_available THEN
    RETURN QUERY SELECT 
      FALSE, 
      'ระบบกำลังประมวลผล กรุณาลองใหม่อีกครั้ง (Lock timeout)'::TEXT, 
      0, 
      0::NUMERIC;
  WHEN OTHERS THEN
    RETURN QUERY SELECT 
      FALSE, 
      format('เกิดข้อผิดพลาด: %s', SQLERRM)::TEXT, 
      0, 
      0::NUMERIC;
END;
$func$;

COMMENT ON FUNCTION confirm_pick_item_with_reservation_release IS 
  'ยืนยันหยิบสินค้าพร้อมปล่อย reservation อัตโนมัติ - v1.0 - BUG-006 fix';

-- ============================================================================
-- PART 2: Create Function for Batch Pick Confirmation (Complete Picklist)
-- ============================================================================

CREATE OR REPLACE FUNCTION complete_picklist_with_reservation_release(
  p_picklist_id BIGINT,
  p_completed_by VARCHAR DEFAULT 'System'
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  items_confirmed INTEGER,
  reservations_released INTEGER,
  total_qty_released NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $func$
DECLARE
  v_item RECORD;
  v_result RECORD;
  v_items_count INTEGER := 0;
  v_total_reservations INTEGER := 0;
  v_total_qty NUMERIC := 0;
  v_picklist RECORD;
BEGIN
  -- Set lock timeout for safety
  SET LOCAL lock_timeout = '10s';
  
  -- 1. Get and lock picklist
  SELECT * INTO v_picklist
  FROM picklists
  WHERE id = p_picklist_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      FALSE, 
      'ไม่พบใบหยิบ (Picklist not found)'::TEXT, 
      0, 0, 0::NUMERIC;
    RETURN;
  END IF;
  
  IF v_picklist.status = 'completed' THEN
    RETURN QUERY SELECT 
      FALSE, 
      'ใบหยิบนี้เสร็จสิ้นแล้ว (Picklist already completed)'::TEXT, 
      0, 0, 0::NUMERIC;
    RETURN;
  END IF;
  
  -- 2. Process each pending item
  FOR v_item IN
    SELECT id, sku_id, required_qty
    FROM picklist_items
    WHERE picklist_id = p_picklist_id
    AND status != 'picked'
    FOR UPDATE
  LOOP
    -- Confirm each item
    SELECT * INTO v_result
    FROM confirm_pick_item_with_reservation_release(
      v_item.id, 
      v_item.required_qty, 
      p_completed_by
    );
    
    IF v_result.success THEN
      v_items_count := v_items_count + 1;
      v_total_reservations := v_total_reservations + v_result.reservations_released;
      v_total_qty := v_total_qty + v_result.total_qty_released;
    END IF;
  END LOOP;
  
  -- 3. Update picklist status
  UPDATE picklists
  SET 
    status = 'completed',
    completed_at = CURRENT_TIMESTAMP,
    completed_by = p_completed_by,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = p_picklist_id;
  
  -- 4. Return success
  RETURN QUERY SELECT 
    TRUE, 
    format('ยืนยันใบหยิบเสร็จสิ้น: %s รายการ, ปล่อยการจอง %s รายการ (%s ชิ้น)', 
           v_items_count, v_total_reservations, v_total_qty)::TEXT, 
    v_items_count,
    v_total_reservations, 
    v_total_qty;
  
EXCEPTION
  WHEN lock_not_available THEN
    RETURN QUERY SELECT 
      FALSE, 
      'ระบบกำลังประมวลผล กรุณาลองใหม่อีกครั้ง'::TEXT, 
      0, 0, 0::NUMERIC;
  WHEN OTHERS THEN
    RETURN QUERY SELECT 
      FALSE, 
      format('เกิดข้อผิดพลาด: %s', SQLERRM)::TEXT, 
      0, 0, 0::NUMERIC;
END;
$func$;

COMMENT ON FUNCTION complete_picklist_with_reservation_release IS 
  'ยืนยันใบหยิบทั้งใบพร้อมปล่อย reservation อัตโนมัติ - v1.0 - BUG-006 fix';

-- ============================================================================
-- PART 3: Create Safety Trigger (Backup mechanism)
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_auto_release_reservation_on_pick()
RETURNS TRIGGER AS $trigger$
DECLARE
  v_reservation RECORD;
BEGIN
  -- Only trigger when status changes to 'picked'
  IF NEW.status = 'picked' AND (OLD.status IS NULL OR OLD.status != 'picked') THEN
    
    -- Check if reservations were already released (by the function)
    IF EXISTS (
      SELECT 1 FROM picklist_item_reservations 
      WHERE picklist_item_id = NEW.id 
      AND status IN ('reserved', 'active')
    ) THEN
      -- Release reservations that were missed
      FOR v_reservation IN
        SELECT 
          pir.reservation_id,
          pir.balance_id,
          pir.reserved_piece_qty,
          pir.reserved_pack_qty
        FROM picklist_item_reservations pir
        WHERE pir.picklist_item_id = NEW.id
        AND pir.status IN ('reserved', 'active')
      LOOP
        -- Update reservation status
        UPDATE picklist_item_reservations
        SET status = 'picked', updated_at = CURRENT_TIMESTAMP
        WHERE reservation_id = v_reservation.reservation_id;
        
        -- Release from inventory balance
        UPDATE wms_inventory_balances
        SET 
          reserved_piece_qty = GREATEST(0, COALESCE(reserved_piece_qty, 0) - COALESCE(v_reservation.reserved_piece_qty, 0)),
          reserved_pack_qty = GREATEST(0, COALESCE(reserved_pack_qty, 0) - COALESCE(v_reservation.reserved_pack_qty, 0)),
          updated_at = CURRENT_TIMESTAMP
        WHERE balance_id = v_reservation.balance_id;
        
        -- Log for debugging
        RAISE NOTICE 'Auto-released reservation % (% pieces) via trigger', 
                     v_reservation.reservation_id, v_reservation.reserved_piece_qty;
      END LOOP;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$trigger$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trg_auto_release_reservation_on_pick ON picklist_items;

-- Create trigger
CREATE TRIGGER trg_auto_release_reservation_on_pick
  AFTER UPDATE ON picklist_items
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_release_reservation_on_pick();

COMMENT ON TRIGGER trg_auto_release_reservation_on_pick ON picklist_items IS 
  'Safety net: Auto-release reservation if not released by function - BUG-006 fix';

-- ============================================================================
-- PART 4: Create Utility Function to Fix Existing Stuck Reservations
-- ============================================================================

CREATE OR REPLACE FUNCTION fix_stuck_picklist_reservations()
RETURNS TABLE(
  fixed_count INTEGER,
  total_qty_released NUMERIC,
  affected_picklists TEXT[]
) LANGUAGE plpgsql AS $func$
DECLARE
  v_reservation RECORD;
  v_fixed_count INTEGER := 0;
  v_total_qty NUMERIC := 0;
  v_affected_picklists TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Find and fix stuck reservations
  FOR v_reservation IN
    SELECT 
      pir.reservation_id,
      pir.balance_id,
      pir.reserved_piece_qty,
      pir.reserved_pack_qty,
      p.picklist_no
    FROM picklist_item_reservations pir
    JOIN picklist_items pi ON pi.id = pir.picklist_item_id
    JOIN picklists p ON p.id = pi.picklist_id
    WHERE pi.status = 'picked'           -- Item is picked
    AND pir.status IN ('reserved', 'active')  -- But reservation still active
    FOR UPDATE OF pir
  LOOP
    -- Update reservation status
    UPDATE picklist_item_reservations
    SET status = 'picked', updated_at = CURRENT_TIMESTAMP
    WHERE reservation_id = v_reservation.reservation_id;
    
    -- Release from inventory balance
    UPDATE wms_inventory_balances
    SET 
      reserved_piece_qty = GREATEST(0, COALESCE(reserved_piece_qty, 0) - COALESCE(v_reservation.reserved_piece_qty, 0)),
      reserved_pack_qty = GREATEST(0, COALESCE(reserved_pack_qty, 0) - COALESCE(v_reservation.reserved_pack_qty, 0)),
      updated_at = CURRENT_TIMESTAMP
    WHERE balance_id = v_reservation.balance_id;
    
    v_fixed_count := v_fixed_count + 1;
    v_total_qty := v_total_qty + COALESCE(v_reservation.reserved_piece_qty, 0);
    
    IF NOT v_reservation.picklist_no = ANY(v_affected_picklists) THEN
      v_affected_picklists := array_append(v_affected_picklists, v_reservation.picklist_no);
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT v_fixed_count, v_total_qty, v_affected_picklists;
END;
$func$;

COMMENT ON FUNCTION fix_stuck_picklist_reservations IS 
  'Utility function to fix existing stuck reservations - Run once after migration';

-- ============================================================================
-- PART 5: Create Monitoring View
-- ============================================================================

CREATE OR REPLACE VIEW v_stuck_picklist_reservations AS
SELECT 
  p.picklist_no,
  p.status as picklist_status,
  pi.sku_id,
  pi.status as item_status,
  pir.reservation_id,
  pir.status as reservation_status,
  pir.reserved_piece_qty,
  pir.reserved_pack_qty,
  p.created_at as picklist_created,
  p.completed_at as picklist_completed
FROM picklist_item_reservations pir
JOIN picklist_items pi ON pi.id = pir.picklist_item_id
JOIN picklists p ON p.id = pi.picklist_id
WHERE pi.status = 'picked'
AND pir.status IN ('reserved', 'active')
ORDER BY p.created_at DESC;

COMMENT ON VIEW v_stuck_picklist_reservations IS 
  'View to monitor stuck reservations - Should always be empty';

-- ============================================================================
-- PART 6: Grant Permissions
-- ============================================================================

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION confirm_pick_item_with_reservation_release TO service_role;
GRANT EXECUTE ON FUNCTION complete_picklist_with_reservation_release TO service_role;
GRANT EXECUTE ON FUNCTION fix_stuck_picklist_reservations TO service_role;

-- Grant select on monitoring view
GRANT SELECT ON v_stuck_picklist_reservations TO authenticated;
GRANT SELECT ON v_stuck_picklist_reservations TO service_role;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  -- Verify functions created
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'confirm_pick_item_with_reservation_release') THEN
    RAISE NOTICE '✅ Function confirm_pick_item_with_reservation_release created';
  ELSE
    RAISE EXCEPTION '❌ Function confirm_pick_item_with_reservation_release NOT created';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'complete_picklist_with_reservation_release') THEN
    RAISE NOTICE '✅ Function complete_picklist_with_reservation_release created';
  ELSE
    RAISE EXCEPTION '❌ Function complete_picklist_with_reservation_release NOT created';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fix_stuck_picklist_reservations') THEN
    RAISE NOTICE '✅ Function fix_stuck_picklist_reservations created';
  ELSE
    RAISE EXCEPTION '❌ Function fix_stuck_picklist_reservations NOT created';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_auto_release_reservation_on_pick') THEN
    RAISE NOTICE '✅ Trigger trg_auto_release_reservation_on_pick created';
  ELSE
    RAISE EXCEPTION '❌ Trigger trg_auto_release_reservation_on_pick NOT created';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'v_stuck_picklist_reservations') THEN
    RAISE NOTICE '✅ View v_stuck_picklist_reservations created';
  ELSE
    RAISE EXCEPTION '❌ View v_stuck_picklist_reservations NOT created';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '✅ Migration 225 completed successfully!';
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Run: SELECT * FROM fix_stuck_picklist_reservations();';
  RAISE NOTICE '2. Verify: SELECT COUNT(*) FROM v_stuck_picklist_reservations;';
  RAISE NOTICE '3. Update API to use confirm_pick_item_with_reservation_release()';
  RAISE NOTICE '';
END $$;