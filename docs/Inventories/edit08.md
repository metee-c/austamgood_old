# 🐛 Bug Fix: check_reservation_not_exceed_positive_balance Constraint Violation

## ❌ Error ที่เกิดขึ้น
```
Error updating source balance 35329: {
  code: '23514',
  message: 'new row for relation "wms_inventory_balances" violates check constraint "check_reservation_not_exceed_positive_balance"'
  details: 'Failing row contains (..., 0.00, 48.00, 0.00, 120.00, ...)'
}
```

## 📊 สถานการณ์จาก Log
```
📊 Current balance for B-BEY-C|TUN|010 (balance_id: 35329): 120 pcs, deducting: 72 pcs
🔄 Updating balance_id 35329: 120 → 48 pcs
✅ Released 11 reservations (488 pieces total) ← แต่ reserved_piece_qty ไม่ได้ลดลง!
```

**Failing row values**: `0.00, 48.00, 0.00, 120.00`
- `total_piece_qty` = 48 (หลังหัก 72)
- `reserved_piece_qty` = 120 (ยังไม่ได้ลด!)

**Constraint ที่ Fail**: `reserved_piece_qty` (120) > `total_piece_qty` (48) ❌

---

## 🔍 Root Cause Analysis

### ปัญหา: ลำดับการทำงานผิด

**ลำดับปัจจุบัน (ผิด):**
1. ✅ Release reservations (แต่ไม่ได้ update reserved_piece_qty ใน balance)
2. ❌ Deduct total_piece_qty → Constraint Fail!

**ลำดับที่ถูกต้อง:**
1. ✅ ลด `reserved_piece_qty` ก่อน (หรือพร้อมกัน)
2. ✅ ลด `total_piece_qty`
3. ✅ เพิ่ม ledger entry

---

## 🔧 ขั้นตอนแก้ไข

### Step 1: ค้นหา Constraint Definition
```sql
-- ดู constraint ที่มีอยู่
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'wms_inventory_balances'::regclass
  AND conname LIKE '%reservation%';
```

**Expected constraint:**
```sql
CHECK (reserved_piece_qty <= total_piece_qty OR total_piece_qty < 0)
-- หรือ
CHECK (reserved_piece_qty <= GREATEST(total_piece_qty, 0))
```

### Step 2: หา Loading Complete Handler

ค้นหาไฟล์ที่จัดการ loading complete:
```
/api/mobile/loading/complete/route.ts
หรือ
/app/api/mobile/loading/complete/route.ts
```

### Step 3: ตรวจสอบ Function ที่ Release Reservation

หา function ที่ทำ release reservation และตรวจสอบว่า:
1. มีการ update `reserved_piece_qty` ใน `wms_inventory_balances` หรือไม่
2. ถ้าไม่มี ต้องเพิ่ม

### Step 4: แก้ไขโค้ด

#### Option A: แก้ที่ Release Reservation Function
```typescript
// ❌ โค้ดเดิม (มีปัญหา)
async function releaseReservations(loadlistId: number) {
  // แค่ลบ/update reservation records
  await supabase
    .from('wms_reservations')
    .update({ status: 'released' })
    .eq('loadlist_id', loadlistId);
  // ไม่ได้ update balance!
}

// ✅ โค้ดที่ถูกต้อง
async function releaseReservations(loadlistId: number) {
  // 1. ดึงข้อมูล reservations ที่จะ release
  const { data: reservations } = await supabase
    .from('wms_reservations')
    .select('*')
    .eq('loadlist_id', loadlistId)
    .eq('status', 'reserved');

  // 2. Update reserved_piece_qty ใน balance table ก่อน
  for (const res of reservations) {
    await supabase.rpc('decrease_reserved_qty', {
      p_balance_id: res.balance_id,
      p_qty: res.reserved_qty
    });
  }

  // 3. จากนั้นค่อย update reservation status
  await supabase
    .from('wms_reservations')
    .update({ status: 'released', released_at: new Date() })
    .eq('loadlist_id', loadlistId);
}
```

#### Option B: แก้ที่ Deduct Balance Function
```typescript
// ❌ โค้ดเดิม (มีปัญหา)
async function deductBalance(balanceId: number, qty: number) {
  await supabase
    .from('wms_inventory_balances')
    .update({ 
      total_piece_qty: currentQty - qty 
    })
    .eq('id', balanceId);
}

// ✅ โค้ดที่ถูกต้อง - ลด reserved และ total พร้อมกัน
async function deductBalance(balanceId: number, qty: number) {
  // ดึงข้อมูลปัจจุบัน
  const { data: balance } = await supabase
    .from('wms_inventory_balances')
    .select('total_piece_qty, reserved_piece_qty')
    .eq('id', balanceId)
    .single();

  const newTotal = balance.total_piece_qty - qty;
  // ลด reserved ให้ไม่เกิน newTotal
  const newReserved = Math.min(balance.reserved_piece_qty, Math.max(newTotal, 0));

  await supabase
    .from('wms_inventory_balances')
    .update({ 
      total_piece_qty: newTotal,
      reserved_piece_qty: newReserved,
      available_piece_qty: newTotal - newReserved,
      updated_at: new Date()
    })
    .eq('id', balanceId);
}
```

#### Option C: สร้าง Database Function (Recommended)
```sql
-- สร้าง function ที่จัดการ loading complete อย่างปลอดภัย
CREATE OR REPLACE FUNCTION process_loading_deduction(
  p_balance_id INTEGER,
  p_deduct_qty NUMERIC,
  p_reference_no TEXT
) RETURNS VOID AS $$
DECLARE
  v_current_total NUMERIC;
  v_current_reserved NUMERIC;
  v_new_total NUMERIC;
  v_new_reserved NUMERIC;
BEGIN
  -- Lock row to prevent race condition
  SELECT total_piece_qty, reserved_piece_qty 
  INTO v_current_total, v_current_reserved
  FROM wms_inventory_balances
  WHERE id = p_balance_id
  FOR UPDATE;

  -- Calculate new values
  v_new_total := v_current_total - p_deduct_qty;
  
  -- Ensure reserved doesn't exceed new total
  v_new_reserved := LEAST(v_current_reserved, GREATEST(v_new_total, 0));
  
  -- If this item was reserved, reduce reserved by deduct amount
  IF v_current_reserved >= p_deduct_qty THEN
    v_new_reserved := v_current_reserved - p_deduct_qty;
  END IF;

  -- Update balance
  UPDATE wms_inventory_balances
  SET 
    total_piece_qty = v_new_total,
    reserved_piece_qty = v_new_reserved,
    available_piece_qty = v_new_total - v_new_reserved,
    updated_at = NOW()
  WHERE id = p_balance_id;

  -- Log to ledger
  INSERT INTO wms_inventory_ledger (
    transaction_type, reference_no, balance_id,
    direction, piece_qty, created_at
  ) VALUES (
    'ship', p_reference_no, p_balance_id,
    'out', p_deduct_qty, NOW()
  );
END;
$$ LANGUAGE plpgsql;
```

### Step 5: อัพเดท API Handler
```typescript
// /api/mobile/loading/complete/route.ts

async function handlePost(request: Request) {
  // ... existing code ...

  // ✅ ใช้ transaction เพื่อความปลอดภัย
  const { error } = await supabase.rpc('process_loading_complete', {
    p_loadlist_id: loadlistId,
    p_items: itemsToProcess
  });

  // หรือถ้าใช้ TypeScript ตรงๆ
  for (const item of itemsToProcess) {
    // ✅ ลด reserved และ total พร้อมกันใน single update
    const { error } = await supabase
      .from('wms_inventory_balances')
      .update({
        total_piece_qty: supabase.raw('total_piece_qty - ?', [item.qty]),
        reserved_piece_qty: supabase.raw('GREATEST(reserved_piece_qty - ?, 0)', [item.qty]),
        available_piece_qty: supabase.raw('total_piece_qty - ? - GREATEST(reserved_piece_qty - ?, 0)', [item.qty, item.qty]),
        updated_at: new Date()
      })
      .eq('id', item.balance_id);

    if (error) throw error;
  }
}
```

---

## ✅ Verification

### Test Case 1: Normal Loading
```
Before: total=120, reserved=120, available=0
Action: Load 72 pieces
After:  total=48, reserved=48, available=0 ✓
```

### Test Case 2: Partial Reserved
```
Before: total=100, reserved=50, available=50
Action: Load 30 pieces (from reserved)
After:  total=70, reserved=20, available=50 ✓
```

### Test Case 3: No Reservation
```
Before: total=100, reserved=0, available=100
Action: Load 30 pieces
After:  total=70, reserved=0, available=70 ✓
```

---

## 🎯 Summary: สิ่งที่ต้องแก้

| ไฟล์ | การแก้ไข |
|------|---------|
| `/api/mobile/loading/complete/route.ts` | ลด `reserved_piece_qty` พร้อมกับ `total_piece_qty` |
| `releaseReservations()` function | ต้อง update `reserved_piece_qty` ใน balance table |
| Database | พิจารณาสร้าง stored procedure เพื่อป้องกัน race condition |

---

## 🔄 Quick Fix (ถ้าต้องการแก้ด่วน)
```sql
-- ปิด constraint ชั่วคราว (ไม่แนะนำสำหรับ production)
ALTER TABLE wms_inventory_balances 
DROP CONSTRAINT check_reservation_not_exceed_positive_balance;

-- หรือแก้ constraint ให้ยืดหยุ่นขึ้น
ALTER TABLE wms_inventory_balances 
DROP CONSTRAINT check_reservation_not_exceed_positive_balance;

ALTER TABLE wms_inventory_balances 
ADD CONSTRAINT check_reservation_not_exceed_positive_balance 
CHECK (reserved_piece_qty <= GREATEST(total_piece_qty, 0) OR total_piece_qty < 0);
```

⚠️ **Warning**: Quick fix ไม่แก้ปัญหาที่ต้นเหตุ ควรแก้โค้ดตาม Step 4 ด้วย


---

## Migration 242: แก้ไข Function Type Mismatch

**วันที่**: 2026-01-19

### ปัญหา
- Function `release_loadlist_reservations()` ใน migration 241 ใช้ `INTEGER` สำหรับ `p_loadlist_id`
- แต่ `loadlists.id` เป็น `BIGINT` → Type mismatch error

### การแก้ไข
```sql
-- Drop function with INTEGER parameter
DROP FUNCTION IF EXISTS release_loadlist_reservations(INTEGER);

-- Recreate with BIGINT parameter
CREATE OR REPLACE FUNCTION release_loadlist_reservations(
  p_loadlist_id BIGINT
)
RETURNS TABLE (
  released_count INTEGER,
  total_reserved_qty NUMERIC
) AS $$
...
```

### ผลลัพธ์
- ✅ Function ใช้ BIGINT แล้ว - ตรงกับ type ของ loadlist.id
- ✅ Function ทำงาน 2 อย่าง:
  1. Decrement `reserved_piece_qty` และ `reserved_pack_qty` ใน balance table
  2. เปลี่ยน reservation status จาก 'picked' → 'loaded'
- ✅ API เรียกใช้ function ก่อนการหักสต็อค (line ~805)
- ⏳ **รอการทดสอบ**: User ควรลองยืนยันการโหลดอีกครั้งกับ loadlist LD-20260120-0001

### Expected Result หลังทดสอบ
```
Balance ID 35329 (B-BEY-C|TUN|010 at Dispatch):
- Before: total=120, reserved=120
- After release: total=120, reserved=48 (120-72)
- After deduct: total=48, reserved=48
- Constraint: 48 <= 48 ✓
```
