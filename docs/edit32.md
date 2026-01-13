# ภารกิจ: ตรวจสอบและแก้ไขปัญหา Quick-Move อ่านค่า Balance ผิด

## ปัญหาที่พบ

| รายการ | ค่าที่ถูกต้อง | ค่าที่ผิด |
|--------|-------------|----------|
| Receive (ledger 34052) | 48 packs, 576 pieces | ✅ ถูกต้อง |
| Move Item (ID 472) | ควรเป็น 48 packs | 76.92 packs, 923 pieces ❌ |
| Transfer Out (ledger 37955) | ควรเป็น 48 packs | 76.92 packs, 923 pieces ❌ |
| Transfer In (ledger 37956) | ควรเป็น 48 packs | 76.92 packs, 923 pieces ❌ |

**สาเหตุ:** Quick-move API อ่านค่าผิดจาก `wms_inventory_balances`

---

## Phase 0: ค้นหาทุก Pallet ที่มีปัญหาเดียวกัน

### 0.1 หา Move Items ที่มี pack_qty เป็นทศนิยม (ผิดปกติ)
```sql
-- หา move items ที่มี pack_qty เป็นทศนิยม (ไม่ควรเป็นทศนิยม)
SELECT 
  mi.id as move_item_id,
  mi.move_id,
  mi.pallet_id,
  mi.product_id,
  p.product_code,
  mi.requested_pack_qty,
  mi.requested_piece_qty,
  mi.confirmed_pack_qty,
  mi.confirmed_piece_qty,
  mi.created_at
FROM wms_move_items mi
JOIN master_products p ON p.product_id = mi.product_id
WHERE mi.requested_pack_qty != FLOOR(mi.requested_pack_qty)
   OR mi.confirmed_pack_qty != FLOOR(mi.confirmed_pack_qty)
ORDER BY mi.created_at DESC;
```

### 0.2 หา Ledger Entries ที่มี pack_qty เป็นทศนิยม
```sql
-- หา ledger entries ที่มี pack_qty เป็นทศนิยม
SELECT 
  il.ledger_id,
  il.created_at,
  il.transaction_type,
  il.reference_type,
  il.reference_id,
  il.pallet_id,
  p.product_code,
  il.pack_qty,
  il.piece_qty,
  fl.location_code as from_loc,
  tl.location_code as to_loc
FROM wms_inventory_ledger il
JOIN master_products p ON p.product_id = il.product_id
LEFT JOIN master_locations fl ON fl.location_id = il.from_location_id
LEFT JOIN master_locations tl ON tl.location_id = il.to_location_id
WHERE il.pack_qty != FLOOR(il.pack_qty)
   OR il.pack_qty < 0
ORDER BY il.created_at DESC;
```

### 0.3 หา Pallet IDs ที่เกี่ยวข้องกับปัญหา
```sql
-- รวม pallet_id ที่มีปัญหา
WITH problem_pallets AS (
  -- จาก move items
  SELECT DISTINCT pallet_id
  FROM wms_move_items
  WHERE requested_pack_qty != FLOOR(requested_pack_qty)
     OR confirmed_pack_qty != FLOOR(confirmed_pack_qty)
  
  UNION
  
  -- จาก ledger
  SELECT DISTINCT pallet_id
  FROM wms_inventory_ledger
  WHERE pack_qty != FLOOR(pack_qty)
    AND pallet_id IS NOT NULL
)
SELECT 
  pp.pallet_id,
  pal.pallet_code,
  p.product_code,
  p.product_name,
  pal.status as pallet_status,
  pal.created_at
FROM problem_pallets pp
JOIN wms_pallets pal ON pal.pallet_id = pp.pallet_id
JOIN master_products p ON p.product_id = pal.product_id
ORDER BY pal.created_at DESC;
```

### 0.4 สรุปจำนวน Pallets ที่มีปัญหา
```sql
-- นับจำนวนปัญหา
SELECT 
  'Move Items with decimal pack_qty' as issue_type,
  COUNT(*) as count
FROM wms_move_items
WHERE requested_pack_qty != FLOOR(requested_pack_qty)
   OR confirmed_pack_qty != FLOOR(confirmed_pack_qty)

UNION ALL

SELECT 
  'Ledger Entries with decimal pack_qty' as issue_type,
  COUNT(*) as count
FROM wms_inventory_ledger
WHERE pack_qty != FLOOR(pack_qty)

UNION ALL

SELECT 
  'Unique Pallets affected' as issue_type,
  COUNT(DISTINCT pallet_id) as count
FROM (
  SELECT pallet_id FROM wms_move_items
  WHERE requested_pack_qty != FLOOR(requested_pack_qty)
  UNION
  SELECT pallet_id FROM wms_inventory_ledger
  WHERE pack_qty != FLOOR(pack_qty) AND pallet_id IS NOT NULL
) t;
```

---

## Phase 1: วิเคราะห์แต่ละ Pallet ที่มีปัญหา

### 1.1 ดูประวัติ Ledger ของแต่ละ Pallet ที่มีปัญหา
```sql
-- ดูประวัติ ledger ของ pallets ที่มีปัญหา
WITH problem_pallets AS (
  SELECT DISTINCT pallet_id
  FROM wms_move_items
  WHERE requested_pack_qty != FLOOR(requested_pack_qty)
  UNION
  SELECT DISTINCT pallet_id
  FROM wms_inventory_ledger
  WHERE pack_qty != FLOOR(pack_qty) AND pallet_id IS NOT NULL
)
SELECT 
  pal.pallet_code,
  il.ledger_id,
  il.created_at,
  il.transaction_type,
  il.reference_type,
  il.reference_id,
  p.product_code,
  il.pack_qty,
  il.piece_qty,
  fl.location_code as from_loc,
  tl.location_code as to_loc,
  CASE 
    WHEN il.pack_qty != FLOOR(il.pack_qty) THEN '❌ ทศนิยม'
    ELSE '✅'
  END as issue
FROM wms_inventory_ledger il
JOIN problem_pallets pp ON pp.pallet_id = il.pallet_id
JOIN wms_pallets pal ON pal.pallet_id = il.pallet_id
JOIN master_products p ON p.product_id = il.product_id
LEFT JOIN master_locations fl ON fl.location_id = il.from_location_id
LEFT JOIN master_locations tl ON tl.location_id = il.to_location_id
ORDER BY pal.pallet_code, il.created_at;
```

### 1.2 เปรียบเทียบ Receive vs Move ของแต่ละ Pallet
```sql
-- เปรียบเทียบ receive vs move
WITH problem_pallets AS (
  SELECT DISTINCT pallet_id
  FROM wms_move_items
  WHERE requested_pack_qty != FLOOR(requested_pack_qty)
  UNION
  SELECT DISTINCT pallet_id
  FROM wms_inventory_ledger
  WHERE pack_qty != FLOOR(pack_qty) AND pallet_id IS NOT NULL
),
receive_data AS (
  SELECT 
    il.pallet_id,
    il.pack_qty as receive_pack,
    il.piece_qty as receive_piece,
    il.ledger_id as receive_ledger_id,
    il.created_at as receive_at
  FROM wms_inventory_ledger il
  WHERE il.transaction_type = 'receive'
    AND il.pallet_id IN (SELECT pallet_id FROM problem_pallets)
),
move_data AS (
  SELECT 
    il.pallet_id,
    il.pack_qty as move_pack,
    il.piece_qty as move_piece,
    il.ledger_id as move_ledger_id,
    il.created_at as move_at,
    il.transaction_type
  FROM wms_inventory_ledger il
  WHERE il.transaction_type IN ('transfer_out', 'transfer_in', 'quick_move')
    AND il.pallet_id IN (SELECT pallet_id FROM problem_pallets)
    AND il.pack_qty != FLOOR(il.pack_qty)
)
SELECT 
  pal.pallet_code,
  p.product_code,
  r.receive_pack,
  r.receive_piece,
  m.move_pack,
  m.move_piece,
  m.transaction_type,
  CASE 
    WHEN r.receive_pack = m.move_pack THEN '✅ ตรงกัน'
    ELSE '❌ ไม่ตรง (ต่าง ' || (m.move_pack - r.receive_pack)::text || ' packs)'
  END as comparison,
  r.receive_ledger_id,
  m.move_ledger_id
FROM receive_data r
JOIN move_data m ON m.pallet_id = r.pallet_id
JOIN wms_pallets pal ON pal.pallet_id = r.pallet_id
JOIN master_products p ON p.product_id = pal.product_id
ORDER BY pal.pallet_code;
```

### 1.3 ตรวจสอบ Balance ปัจจุบัน vs Ledger Sum
```sql
-- ตรวจสอบ balance vs ledger sum ของ pallets ที่มีปัญหา
WITH problem_pallets AS (
  SELECT DISTINCT pallet_id
  FROM wms_move_items
  WHERE requested_pack_qty != FLOOR(requested_pack_qty)
  UNION
  SELECT DISTINCT pallet_id
  FROM wms_inventory_ledger
  WHERE pack_qty != FLOOR(pack_qty) AND pallet_id IS NOT NULL
),
ledger_sum AS (
  SELECT 
    pallet_id,
    product_id,
    location_id,
    SUM(pack_qty) as ledger_pack_sum,
    SUM(piece_qty) as ledger_piece_sum
  FROM wms_inventory_ledger
  WHERE pallet_id IN (SELECT pallet_id FROM problem_pallets)
  GROUP BY pallet_id, product_id, location_id
)
SELECT 
  pal.pallet_code,
  p.product_code,
  loc.location_code,
  b.total_pack_qty as balance_pack,
  b.total_piece_qty as balance_piece,
  ls.ledger_pack_sum,
  ls.ledger_piece_sum,
  b.total_pack_qty - ls.ledger_pack_sum as pack_diff,
  b.total_piece_qty - ls.ledger_piece_sum as piece_diff,
  CASE 
    WHEN ABS(b.total_pack_qty - ls.ledger_pack_sum) < 0.01 
     AND ABS(b.total_piece_qty - ls.ledger_piece_sum) < 0.01 THEN '✅ ตรง'
    ELSE '❌ ไม่ตรง'
  END as status
FROM ledger_sum ls
JOIN wms_inventory_balances b ON b.product_id = ls.product_id 
  AND b.location_id = ls.location_id
  AND b.pallet_id = ls.pallet_id
JOIN wms_pallets pal ON pal.pallet_id = ls.pallet_id
JOIN master_products p ON p.product_id = ls.product_id
JOIN master_locations loc ON loc.location_id = ls.location_id
WHERE ABS(b.total_pack_qty - ls.ledger_pack_sum) > 0.01
   OR ABS(b.total_piece_qty - ls.ledger_piece_sum) > 0.01
ORDER BY pal.pallet_code;
```

---

## Phase 2: หาสาเหตุใน Quick-Move API

### 2.1 ตรวจสอบ Move Records ที่มีปัญหา
```sql
-- ดู move records ที่มีปัญหา
SELECT 
  m.id as move_id,
  m.move_code,
  m.status,
  m.created_at,
  m.created_by,
  mi.id as move_item_id,
  mi.pallet_id,
  pal.pallet_code,
  p.product_code,
  mi.requested_pack_qty,
  mi.requested_piece_qty,
  mi.confirmed_pack_qty,
  mi.confirmed_piece_qty,
  fl.location_code as from_loc,
  tl.location_code as to_loc
FROM wms_moves m
JOIN wms_move_items mi ON mi.move_id = m.id
JOIN wms_pallets pal ON pal.pallet_id = mi.pallet_id
JOIN master_products p ON p.product_id = mi.product_id
LEFT JOIN master_locations fl ON fl.location_id = mi.from_location_id
LEFT JOIN master_locations tl ON tl.location_id = mi.to_location_id
WHERE mi.requested_pack_qty != FLOOR(mi.requested_pack_qty)
   OR mi.confirmed_pack_qty != FLOOR(mi.confirmed_pack_qty)
ORDER BY m.created_at DESC;
```

### 2.2 ตรวจสอบ API Code
```bash
# หา quick-move API
find . -path "*api*" -name "*.ts" | xargs grep -l "quick-move\|quickMove\|move.*pallet" 2>/dev/null

# ดู logic ที่อ่าน balance
grep -r "wms_inventory_balances\|total_pack_qty\|total_piece_qty" --include="*.ts" app/api/
```

---

## Phase 3: แก้ไขข้อมูลที่ผิด

### 3.1 สร้าง Correction Ledger Entries
```sql
-- หาข้อมูลที่ต้องแก้ไข
WITH corrections_needed AS (
  SELECT 
    il.ledger_id,
    il.pallet_id,
    il.product_id,
    il.from_location_id,
    il.to_location_id,
    il.pack_qty as wrong_pack,
    il.piece_qty as wrong_piece,
    -- หาค่าที่ถูกต้องจาก receive
    (
      SELECT il2.pack_qty 
      FROM wms_inventory_ledger il2 
      WHERE il2.pallet_id = il.pallet_id 
        AND il2.transaction_type = 'receive'
      LIMIT 1
    ) as correct_pack,
    (
      SELECT il2.piece_qty 
      FROM wms_inventory_ledger il2 
      WHERE il2.pallet_id = il.pallet_id 
        AND il2.transaction_type = 'receive'
      LIMIT 1
    ) as correct_piece,
    il.transaction_type
  FROM wms_inventory_ledger il
  WHERE il.pack_qty != FLOOR(il.pack_qty)
    AND il.transaction_type IN ('transfer_out', 'transfer_in', 'quick_move')
)
SELECT 
  ledger_id,
  pallet_id,
  transaction_type,
  wrong_pack,
  wrong_piece,
  correct_pack,
  correct_piece,
  wrong_pack - correct_pack as pack_diff,
  wrong_piece - correct_piece as piece_diff
FROM corrections_needed
WHERE wrong_pack != correct_pack OR wrong_piece != correct_piece;
```

### 3.2 แก้ไข Ledger Entries (ระวัง!)
```sql
-- ⚠️ BACKUP ก่อนแก้ไข
CREATE TABLE IF NOT EXISTS _backup_ledger_decimal_fix_20260113 AS
SELECT * FROM wms_inventory_ledger
WHERE pack_qty != FLOOR(pack_qty);

-- แก้ไข ledger entries ที่ผิด
-- ต้องดำเนินการทีละ pallet และตรวจสอบให้ดี!

-- ตัวอย่าง: แก้ไข pallet ที่ receive 48 packs แต่ move 76.92 packs
/*
UPDATE wms_inventory_ledger
SET 
  pack_qty = 48,  -- ค่าที่ถูกต้อง
  piece_qty = 576, -- ค่าที่ถูกต้อง
  notes = COALESCE(notes, '') || ' [Fixed: was ' || pack_qty || ' packs, ' || piece_qty || ' pieces]',
  updated_at = NOW()
WHERE ledger_id IN (37955, 37956)  -- ledger IDs ที่ต้องแก้
RETURNING *;
*/
```

### 3.3 แก้ไข Inventory Balances
```sql
-- หลังแก้ ledger แล้ว ต้องคำนวณ balance ใหม่
-- ⚠️ ใช้ function recalculate หรือ trigger ที่มีอยู่

-- หรือคำนวณ manual:
WITH correct_balance AS (
  SELECT 
    pallet_id,
    product_id,
    location_id,
    SUM(pack_qty) as correct_pack,
    SUM(piece_qty) as correct_piece
  FROM wms_inventory_ledger
  WHERE pallet_id IN (
    SELECT DISTINCT pallet_id FROM _backup_ledger_decimal_fix_20260113
  )
  GROUP BY pallet_id, product_id, location_id
)
UPDATE wms_inventory_balances b
SET 
  total_pack_qty = cb.correct_pack,
  total_piece_qty = cb.correct_piece,
  updated_at = NOW()
FROM correct_balance cb
WHERE b.pallet_id = cb.pallet_id
  AND b.product_id = cb.product_id
  AND b.location_id = cb.location_id
RETURNING b.*;
```

---

## Phase 4: แก้ไข Quick-Move API

### 4.1 หาจุดที่อ่านค่าผิด
```typescript
// ปัญหาอาจเกิดจาก:
// 1. อ่าน balance รวมของ product แทน pallet
// 2. ไม่ได้ filter by pallet_id
// 3. อ่านจาก location ผิด

// ตรวจสอบ query ที่ใช้:
const { data: balance } = await supabase
  .from('wms_inventory_balances')
  .select('total_pack_qty, total_piece_qty')
  .eq('product_id', productId)
  .eq('location_id', fromLocationId)
  .eq('pallet_id', palletId)  // ⚠️ ต้องมี filter นี้!
  .single();
```

### 4.2 แก้ไข API ให้ถูกต้อง
```typescript
// ต้อง filter by pallet_id เสมอ
const { data: balance } = await supabase
  .from('wms_inventory_balances')
  .select('total_pack_qty, total_piece_qty')
  .eq('product_id', productId)
  .eq('location_id', fromLocationId)
  .eq('pallet_id', palletId)  // ✅ สำคัญ!
  .single();

// Validate ก่อนใช้
if (!balance) {
  throw new Error('ไม่พบ balance สำหรับ pallet นี้');
}

// ใช้ค่าจาก balance ที่ถูกต้อง
const packQty = balance.total_pack_qty;
const pieceQty = balance.total_piece_qty;
```

---

## Output ที่ต้องการ

### รายงานสรุป
```
=== Quick-Move Decimal Pack Issue Report ===
วันที่ตรวจสอบ: ___

1. สรุปปัญหา:
| Issue Type | Count |
|------------|-------|
| Move Items with decimal pack_qty | ___ |
| Ledger Entries with decimal pack_qty | ___ |
| Unique Pallets affected | ___ |

2. รายการ Pallets ที่มีปัญหา:
| Pallet Code | Product | Receive | Move (Wrong) | Diff |
|-------------|---------|---------|--------------|------|
| ___ | ___ | ___ packs | ___ packs | ___ |

3. Balance vs Ledger Discrepancy:
| Pallet | Balance | Ledger Sum | Diff |
|--------|---------|------------|------|
| ___ | ___ | ___ | ___ |

4. การแก้ไข:
| Ledger ID | Before | After | Status |
|-----------|--------|-------|--------|
| ___ | ___ | ___ | ✅/❌ |

5. API Fix:
- ไฟล์ที่แก้: ___
- สาเหตุ: ___
- วิธีแก้: ___
```

---

## Checklist
```
Phase 0: ค้นหา Pallets ที่มีปัญหา
□ 0.1 หา move items ที่มีทศนิยม
□ 0.2 หา ledger entries ที่มีทศนิยม
□ 0.3 รวม pallet IDs ที่มีปัญหา
□ 0.4 นับจำนวนปัญหา

Phase 1: วิเคราะห์แต่ละ Pallet
□ 1.1 ดูประวัติ ledger
□ 1.2 เปรียบเทียบ receive vs move
□ 1.3 ตรวจสอบ balance vs ledger sum

Phase 2: หาสาเหตุใน API
□ 2.1 ตรวจสอบ move records
□ 2.2 ตรวจสอบ API code

Phase 3: แก้ไขข้อมูล
□ 3.1 Backup ข้อมูลเดิม
□ 3.2 แก้ไข ledger entries
□ 3.3 แก้ไข inventory balances

Phase 4: แก้ไข API
□ 4.1 หาจุดที่อ่านค่าผิด
□ 4.2 แก้ไข API

Phase 5: ทดสอบ
□ ทดสอบ quick-move ใหม่
□ ตรวจสอบไม่มีทศนิยมอีก
```

---

เริ่มจาก **Phase 0** ก่อน!
รายงานผลทุกขั้นตอน!