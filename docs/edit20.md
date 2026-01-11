# ภารกิจ: ตรวจสอบ Stock ระดับ SKU อย่างละเอียด 100%

## ⚠️ กฎสำคัญ

1. **ใช้ MCP** ในการ query ฐานข้อมูล
2. **ไล่ทีละ SKU** ไม่ใช่ดูรวม
3. **ห้ามปรับสต็อกมัว** - หาสาเหตุจริงก่อน
4. **รายงานละเอียด** ทุก SKU ที่มีปัญหา

---

## 🎯 เป้าหมาย

1. หาสาเหตุ 502 Balance vs Ledger Discrepancies
2. หาสาเหตุ 78 Negative Balances
3. ระบุว่าปัญหาเกิดจากอะไร:
   - ลืมสแกนเติม (Replenishment)
   - Bug ในระบบ
   - Manual adjustment ผิด
   - อื่นๆ

---

## Phase 1: ดึงรายการ SKU ที่มีปัญหา

### 1.1 รายการ Negative Balances (78 records)
```sql
-- ดึง SKU ที่ติดลบทั้งหมด พร้อมรายละเอียด
SELECT 
  b.balance_id,
  p.product_code,
  p.product_name,
  l.location_code,
  l.location_name,
  b.total_pack_qty,
  b.total_piece_qty,
  b.reserved_pack_qty,
  b.reserved_piece_qty,
  l.is_prep_area,
  l.location_type
FROM wms_inventory_balances b
JOIN master_products p ON p.product_id = b.product_id
JOIN master_locations l ON l.location_id = b.location_id
WHERE b.total_pack_qty < 0 OR b.total_piece_qty < 0
ORDER BY b.total_piece_qty ASC;
```

### 1.2 รายการ Balance vs Ledger Discrepancies (502 records)
```sql
-- เปรียบเทียบ Balance กับผลรวมจาก Ledger ทีละ SKU-Location
WITH ledger_sum AS (
  SELECT 
    product_id,
    location_id,
    SUM(CASE WHEN transaction_type IN ('import', 'receive', 'transfer_in', 'adjust_in', 'pick_in') THEN quantity ELSE 0 END) as total_in,
    SUM(CASE WHEN transaction_type IN ('pick', 'transfer_out', 'adjust_out', 'ship') THEN ABS(quantity) ELSE 0 END) as total_out,
    SUM(quantity) as net_ledger
  FROM wms_inventory_ledger
  GROUP BY product_id, location_id
)
SELECT 
  p.product_code,
  p.product_name,
  l.location_code,
  COALESCE(b.total_pack_qty, 0) as balance_qty,
  COALESCE(ls.net_ledger, 0) as ledger_qty,
  COALESCE(b.total_pack_qty, 0) - COALESCE(ls.net_ledger, 0) as difference,
  ls.total_in,
  ls.total_out
FROM wms_inventory_balances b
FULL OUTER JOIN ledger_sum ls ON ls.product_id = b.product_id AND ls.location_id = b.location_id
JOIN master_products p ON p.product_id = COALESCE(b.product_id, ls.product_id)
JOIN master_locations l ON l.location_id = COALESCE(b.location_id, ls.location_id)
WHERE COALESCE(b.total_pack_qty, 0) != COALESCE(ls.net_ledger, 0)
ORDER BY ABS(COALESCE(b.total_pack_qty, 0) - COALESCE(ls.net_ledger, 0)) DESC
LIMIT 50;
```

---

## Phase 2: ไล่ทีละ SKU ที่มีปัญหา (Top 20)

### สำหรับแต่ละ SKU ที่มีปัญหา ต้องทำ:
```sql
-- ===== TEMPLATE: ตรวจสอบ SKU เดียว =====
-- เปลี่ยน 'PRODUCT_CODE' และ 'LOCATION_CODE' ตามที่ต้องการ

-- 1. ข้อมูลพื้นฐานของ SKU
SELECT 
  product_id,
  product_code,
  product_name,
  unit,
  conversion_factor,
  default_location
FROM master_products
WHERE product_code = 'PRODUCT_CODE';

-- 2. Balance ปัจจุบันของ SKU นี้ทุก Location
SELECT 
  b.balance_id,
  l.location_code,
  b.total_pack_qty,
  b.total_piece_qty,
  b.reserved_pack_qty,
  b.reserved_piece_qty,
  b.updated_at
FROM wms_inventory_balances b
JOIN master_locations l ON l.location_id = b.location_id
JOIN master_products p ON p.product_id = b.product_id
WHERE p.product_code = 'PRODUCT_CODE'
ORDER BY l.location_code;

-- 3. Ledger ทั้งหมดของ SKU นี้ (เรียงตามเวลา)
SELECT 
  il.ledger_id,
  il.created_at,
  il.transaction_type,
  il.reference_type,
  il.reference_id,
  fl.location_code as from_location,
  tl.location_code as to_location,
  il.quantity,
  il.pack_qty,
  il.piece_qty,
  il.notes,
  il.created_by
FROM wms_inventory_ledger il
JOIN master_products p ON p.product_id = il.product_id
LEFT JOIN master_locations fl ON fl.location_id = il.from_location_id
LEFT JOIN master_locations tl ON tl.location_id = il.to_location_id
WHERE p.product_code = 'PRODUCT_CODE'
ORDER BY il.created_at DESC
LIMIT 100;

-- 4. สรุป Ledger ตาม Transaction Type
SELECT 
  il.transaction_type,
  l.location_code,
  COUNT(*) as count,
  SUM(il.quantity) as total_qty
FROM wms_inventory_ledger il
JOIN master_products p ON p.product_id = il.product_id
LEFT JOIN master_locations l ON l.location_id = COALESCE(il.to_location_id, il.from_location_id)
WHERE p.product_code = 'PRODUCT_CODE'
GROUP BY il.transaction_type, l.location_code
ORDER BY l.location_code, il.transaction_type;

-- 5. Stock Import เริ่มต้น
SELECT 
  si.*
FROM wms_stock_imports si
JOIN master_products p ON p.product_id = si.product_id
WHERE p.product_code = 'PRODUCT_CODE'
ORDER BY si.created_at;

-- 6. Inbound/Receive ของ SKU นี้
SELECT 
  r.receive_no,
  r.receive_date,
  ri.quantity,
  ri.pack_qty,
  ri.piece_qty,
  l.location_code as to_location
FROM wms_receives r
JOIN wms_receive_items ri ON ri.receive_id = r.receive_id
JOIN master_products p ON p.product_id = ri.product_id
LEFT JOIN master_locations l ON l.location_id = ri.location_id
WHERE p.product_code = 'PRODUCT_CODE'
ORDER BY r.receive_date DESC;

-- 7. Orders ที่มี SKU นี้
SELECT 
  o.order_no,
  o.order_type,
  o.status as order_status,
  oi.quantity as ordered_qty,
  oi.picked_quantity,
  oi.status as item_status
FROM wms_orders o
JOIN wms_order_items oi ON oi.order_id = o.order_id
JOIN master_products p ON p.product_id = oi.product_id
WHERE p.product_code = 'PRODUCT_CODE'
  AND o.status NOT IN ('cancelled', 'deleted')
ORDER BY o.created_at DESC
LIMIT 50;

-- 8. Picklist Items ของ SKU นี้
SELECT 
  pl.picklist_code,
  pl.status as picklist_status,
  pi.quantity,
  pi.picked_quantity,
  pi.status as item_status,
  fl.location_code as from_location,
  tl.location_code as to_location
FROM picklists pl
JOIN picklist_items pi ON pi.picklist_id = pl.id
JOIN master_products p ON p.product_id = pi.product_id
LEFT JOIN master_locations fl ON fl.location_id = pi.source_location_id
LEFT JOIN master_locations tl ON tl.location_id = pi.target_location_id
WHERE p.product_code = 'PRODUCT_CODE'
ORDER BY pl.created_at DESC
LIMIT 50;

-- 9. คำนวณ Balance ที่ควรจะเป็น (จาก Ledger)
SELECT 
  l.location_code,
  SUM(il.quantity) as calculated_balance
FROM wms_inventory_ledger il
JOIN master_products p ON p.product_id = il.product_id
LEFT JOIN master_locations l ON l.location_id = COALESCE(il.to_location_id, il.from_location_id)
WHERE p.product_code = 'PRODUCT_CODE'
GROUP BY l.location_code
ORDER BY l.location_code;

-- 10. เปรียบเทียบ Balance จริง vs คำนวณ
WITH calculated AS (
  SELECT 
    COALESCE(il.to_location_id, il.from_location_id) as location_id,
    SUM(il.quantity) as calc_balance
  FROM wms_inventory_ledger il
  JOIN master_products p ON p.product_id = il.product_id
  WHERE p.product_code = 'PRODUCT_CODE'
  GROUP BY COALESCE(il.to_location_id, il.from_location_id)
)
SELECT 
  l.location_code,
  COALESCE(b.total_pack_qty, 0) as actual_balance,
  COALESCE(c.calc_balance, 0) as calculated_balance,
  COALESCE(b.total_pack_qty, 0) - COALESCE(c.calc_balance, 0) as difference
FROM master_locations l
LEFT JOIN wms_inventory_balances b ON b.location_id = l.location_id 
  AND b.product_id = (SELECT product_id FROM master_products WHERE product_code = 'PRODUCT_CODE')
LEFT JOIN calculated c ON c.location_id = l.location_id
WHERE b.balance_id IS NOT NULL OR c.calc_balance IS NOT NULL
ORDER BY l.location_code;
```

---

## Phase 3: วิเคราะห์สาเหตุ

### สำหรับแต่ละ SKU ที่มีปัญหา ให้วิเคราะห์:
```
====================================
SKU: [PRODUCT_CODE] - [PRODUCT_NAME]
Location: [LOCATION_CODE]
====================================

1. สถานะปัจจุบัน
   - Balance: [X] packs / [X] pieces
   - Calculated from Ledger: [X] packs
   - Difference: [X] packs

2. ประวัติการเคลื่อนไหว
   - Stock Import: [X] packs
   - Inbound/Receive: [X] packs
   - Pick Out: [X] packs
   - Transfer In: [X] packs
   - Transfer Out: [X] packs
   - Adjustments: [X] packs

3. สาเหตุที่เป็นไปได้
   □ ลืมสแกนเติม (Replenishment) - ไม่มี ledger entry
   □ Pick ซ้ำ - มี duplicate ledger entries
   □ Transfer ไม่ครบ - มี out แต่ไม่มี in
   □ Manual adjustment ผิด
   □ Bug ในระบบ
   □ อื่นๆ: [ระบุ]

4. หลักฐาน
   - [รายละเอียด ledger entries ที่น่าสงสัย]

5. ข้อเสนอแนะ
   - [วิธีแก้ไข]
```

---

## Phase 4: สรุปผล

### 4.1 จัดกลุ่มปัญหา
```
| สาเหตุ | จำนวน SKU | Total Diff |
|--------|-----------|------------|
| ลืมสแกนเติม | X | X packs |
| Pick ซ้ำ | X | X packs |
| Transfer ไม่ครบ | X | X packs |
| Manual adjustment ผิด | X | X packs |
| Bug ในระบบ | X | X packs |
| อื่นๆ | X | X packs |
```

### 4.2 ข้อเสนอแนะการแก้ไข

สำหรับแต่ละสาเหตุ ให้ระบุ:
1. วิธีแก้ไขข้อมูล (ถ้าจำเป็น)
2. วิธีป้องกันในอนาคต
3. ต้องแก้ code หรือไม่

---

## Execution Steps

### Step 1: เริ่มจาก Top 10 Negative Balances
```sql
-- ดึง Top 10 SKU ที่ติดลบมากที่สุด
SELECT 
  p.product_code,
  p.product_name,
  l.location_code,
  b.total_pack_qty,
  b.total_piece_qty
FROM wms_inventory_balances b
JOIN master_products p ON p.product_id = b.product_id
JOIN master_locations l ON l.location_id = b.location_id
WHERE b.total_pack_qty < 0 OR b.total_piece_qty < 0
ORDER BY b.total_piece_qty ASC
LIMIT 10;
```

**สำหรับแต่ละ SKU:**
1. รัน Template Query ข้างบน
2. วิเคราะห์ตาม Phase 3
3. บันทึกผล

### Step 2: ตรวจสอบ Top 10 Discrepancies
```sql
-- ดึง Top 10 SKU ที่มี diff มากที่สุด
WITH ledger_sum AS (
  SELECT 
    product_id,
    location_id,
    SUM(quantity) as net_ledger
  FROM wms_inventory_ledger
  GROUP BY product_id, location_id
)
SELECT 
  p.product_code,
  p.product_name,
  l.location_code,
  b.total_pack_qty as balance_qty,
  ls.net_ledger as ledger_qty,
  b.total_pack_qty - ls.net_ledger as difference
FROM wms_inventory_balances b
JOIN ledger_sum ls ON ls.product_id = b.product_id AND ls.location_id = b.location_id
JOIN master_products p ON p.product_id = b.product_id
JOIN master_locations l ON l.location_id = b.location_id
WHERE b.total_pack_qty != ls.net_ledger
ORDER BY ABS(b.total_pack_qty - ls.net_ledger) DESC
LIMIT 10;
```

### Step 3: ตรวจสอบ Location ที่มีปัญหามาก
```sql
-- สรุปปัญหาตาม Location
SELECT 
  l.location_code,
  l.location_name,
  l.is_prep_area,
  COUNT(*) as problem_count,
  SUM(b.total_pack_qty) as total_negative
FROM wms_inventory_balances b
JOIN master_locations l ON l.location_id = b.location_id
WHERE b.total_pack_qty < 0
GROUP BY l.location_id, l.location_code, l.location_name, l.is_prep_area
ORDER BY problem_count DESC;
```

---

## Special Focus: Packaging และ Prep Areas

จาก Audit Report พบว่า:
- **Packaging**: -9,150 packs (2 SKUs)
- **PK001**: -573 packs (21 SKUs)
- **PK002**: -457 packs (6 SKUs)

### ตรวจสอบ Packaging Location
```sql
-- ดู SKUs ที่ติดลบใน Packaging
SELECT 
  p.product_code,
  p.product_name,
  b.total_pack_qty,
  b.total_piece_qty
FROM wms_inventory_balances b
JOIN master_products p ON p.product_id = b.product_id
JOIN master_locations l ON l.location_id = b.location_id
WHERE l.location_code = 'Packaging'
  AND (b.total_pack_qty < 0 OR b.total_piece_qty < 0);

-- ดู Ledger ของ Packaging
SELECT 
  p.product_code,
  il.transaction_type,
  il.created_at,
  il.quantity,
  il.reference_type,
  il.reference_id
FROM wms_inventory_ledger il
JOIN master_products p ON p.product_id = il.product_id
JOIN master_locations l ON l.location_id = COALESCE(il.to_location_id, il.from_location_id)
WHERE l.location_code = 'Packaging'
ORDER BY il.created_at DESC
LIMIT 50;
```

### ตรวจสอบ PK001 (บ้านหยิบหลัก)
```sql
-- ดู SKUs ที่ติดลบใน PK001
SELECT 
  p.product_code,
  p.product_name,
  b.total_pack_qty,
  b.total_piece_qty
FROM wms_inventory_balances b
JOIN master_products p ON p.product_id = b.product_id
JOIN master_locations l ON l.location_id = b.location_id
WHERE l.location_code = 'PK001'
  AND (b.total_pack_qty < 0 OR b.total_piece_qty < 0)
ORDER BY b.total_piece_qty ASC;
```

---

## Output: รายงานแต่ละ SKU

### Format รายงาน
```
====================================
SKU AUDIT: [PRODUCT_CODE]
====================================

## ข้อมูลพื้นฐาน
- ชื่อสินค้า: [NAME]
- หน่วย: [UNIT]
- บ้านหยิบ: [DEFAULT_LOCATION]

## Balance ปัจจุบัน
| Location | Pack Qty | Piece Qty | Status |
|----------|----------|-----------|--------|
| PK001 | X | X | ❌ ติดลบ |
| Dispatch | X | X | ✅ ปกติ |

## ประวัติการเคลื่อนไหว (ล่าสุด 20 รายการ)
| วันที่ | Type | Qty | From | To | Ref |
|--------|------|-----|------|-----|-----|
| ... | ... | ... | ... | ... | ... |

## การวิเคราะห์
- Balance จริง: [X] packs
- Balance คำนวณ: [X] packs
- ส่วนต่าง: [X] packs

## สาเหตุที่พบ
[ระบุสาเหตุ]

## หลักฐาน
[รายการ ledger ที่น่าสงสัย]

## ข้อเสนอแนะ
[วิธีแก้ไข]

====================================
```

---

เริ่ม Audit ได้เลย
**รายงานทีละ SKU ตามลำดับความรุนแรง**