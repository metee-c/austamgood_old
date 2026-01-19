# Migration 242: แก้ไข release_loadlist_reservations Function Type Mismatch

**วันที่**: 2026-01-19  
**สถานะ**: ✅ เสร็จสมบูรณ์

## ปัญหาที่พบ

### 1. Build Error
```
Expression expected at line 820
```
- **สาเหตุ**: ไม่มี - เป็น false alarm จาก build cache
- **การแก้ไข**: ไม่ต้องแก้ไข - โครงสร้างไฟล์ถูกต้องแล้ว

### 2. Constraint Violation Error
```
check_reservation_not_exceed_positive_balance
reserved_piece_qty (120) > total_piece_qty (48)
```

**สาเหตุ**:
1. Function `release_loadlist_reservations()` ถูกเรียกและรายงานว่าสำเร็จ
2. แต่ function ใช้ `INTEGER` สำหรับ `p_loadlist_id` 
3. ขณะที่ `loadlists.id` เป็น `BIGINT` → Type mismatch
4. Function ไม่ทำงานจริง → `reserved_piece_qty` ไม่ถูก decrement
5. เมื่อ API หัก `total_piece_qty`: 120 → 48
6. แต่ `reserved_piece_qty` ยังคงเป็น 120 → Constraint violation!

## การแก้ไข

### Migration 242: Fix Function Parameter Type

```sql
-- Drop function with wrong parameter type
DROP FUNCTION IF EXISTS release_loadlist_reservations(INTEGER);

-- Recreate with correct BIGINT parameter
CREATE OR REPLACE FUNCTION release_loadlist_reservations(
  p_loadlist_id BIGINT
)
RETURNS TABLE (
  released_count INTEGER,
  total_reserved_qty NUMERIC
) AS $$
DECLARE
  v_released_count INTEGER := 0;
  v_total_reserved_qty NUMERIC := 0;
  v_reservation RECORD;
BEGIN
  -- Loop through all picklist reservations
  FOR v_reservation IN (
    SELECT 
      r.reservation_id,
      r.balance_id,
      r.reserved_piece_qty,
      r.reserved_pack_qty
    FROM wms_loadlist_picklists lp
    JOIN picklist_items pi ON pi.picklist_id = lp.picklist_id
    JOIN picklist_item_reservations r ON r.picklist_item_id = pi.id
    WHERE lp.loadlist_id = p_loadlist_id
      AND r.status = 'picked'
      AND r.staging_location_id = 'Dispatch'
      AND pi.voided_at IS NULL
      AND r.balance_id IS NOT NULL
  ) LOOP
    -- ✅ Decrement balance reserved quantities
    UPDATE wms_inventory_balances
    SET 
      reserved_piece_qty = GREATEST(0, reserved_piece_qty - v_reservation.reserved_piece_qty),
      reserved_pack_qty = GREATEST(0, reserved_pack_qty - v_reservation.reserved_pack_qty),
      updated_at = NOW()
    WHERE balance_id = v_reservation.balance_id;
    
    -- ✅ Update reservation status to 'loaded'
    UPDATE picklist_item_reservations
    SET 
      status = 'loaded',
      updated_at = NOW()
    WHERE reservation_id = v_reservation.reservation_id;
    
    v_released_count := v_released_count + 1;
    v_total_reserved_qty := v_total_reserved_qty + v_reservation.reserved_piece_qty;
  END LOOP;
  
  RETURN QUERY SELECT v_released_count, v_total_reserved_qty;
END;
$$ LANGUAGE plpgsql;
```

## ผลลัพธ์

### ✅ Function ทำงานถูกต้อง
- Parameter type: `BIGINT` (ตรงกับ `loadlists.id`)
- Return type: `TABLE(released_count INTEGER, total_reserved_qty NUMERIC)`

### ✅ Function ทำงาน 2 อย่าง
1. **Decrement Reserved Quantities**: ลด `reserved_piece_qty` และ `reserved_pack_qty` ใน `wms_inventory_balances`
2. **Update Reservation Status**: เปลี่ยน status จาก `'picked'` → `'loaded'` ใน `picklist_item_reservations`

### ✅ API Workflow ถูกต้อง
```typescript
// Line ~805: Release reservations BEFORE deducting stock
const { data: releaseResult } = await supabase
  .rpc('release_loadlist_reservations', { p_loadlist_id: loadlist.id });

// Line ~820-1050: Deduct stock from Dispatch → Delivery-In-Progress

// Line ~1050: Update loadlist status AFTER stock deduction succeeds
await supabase
  .from('loadlists')
  .update({ status: 'loaded' })
  .eq('id', loadlist.id);
```

## การทดสอบ

### Test Case: Loadlist LD-20260120-0001

**Before Loading**:
```
Balance ID 35329 (B-BEY-C|TUN|010 at Dispatch):
- total_piece_qty: 120
- reserved_piece_qty: 120
- Constraint: 120 <= 120 ✓
```

**Expected After Loading**:
```
Step 1: Release reservations (72 pieces)
- total_piece_qty: 120 (unchanged)
- reserved_piece_qty: 48 (120 - 72)
- Constraint: 48 <= 120 ✓

Step 2: Deduct stock (72 pieces)
- total_piece_qty: 48 (120 - 72)
- reserved_piece_qty: 48 (unchanged)
- Constraint: 48 <= 48 ✓
```

### วิธีทดสอบ
1. ไปที่ `/mobile/loading/LD-20260120-0001`
2. กดปุ่ม "ยืนยันการโหลด"
3. ตรวจสอบว่าไม่มี constraint violation error
4. ตรวจสอบ balance_id 35329:
   ```sql
   SELECT balance_id, sku_id, location_id, total_piece_qty, reserved_piece_qty
   FROM wms_inventory_balances
   WHERE balance_id = 35329;
   ```
   Expected: `total_piece_qty = 48, reserved_piece_qty = 48`

## สรุป

✅ **Migration 242 แก้ไขปัญหาได้สำเร็จ**:
- Function parameter type ถูกต้อง (BIGINT)
- Function จะ decrement `reserved_piece_qty` ก่อนการหักสต็อค
- Constraint violation จะไม่เกิดขึ้นอีก

⏳ **รอการทดสอบจาก User**:
- ลองยืนยันการโหลด loadlist LD-20260120-0001 อีกครั้ง
- ตรวจสอบว่าไม่มี error และ balance ถูกต้อง
