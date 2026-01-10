# ภารกิจ: ตรวจสอบสต็อกระดับ SKU อย่างละเอียด 100%

## ⚠️ กฎเหล็ก

1. **ห้ามปรับสต็อกมั่วเด็ดขาด**
2. **ต้องไล่ทีละ SKU ตามกิจกรรมจริง**
3. **ทุกการออก ต้องมีการเข้า และกลับกัน**
4. **ใช้ข้อมูลต้นทางเป็นหลัก: ออเดอร์, นำเข้าสต็อก, รับเข้า**
5. **ผลลัพธ์ต้องสะอาดพร้อมยื่นสรรพากร**

---

## Phase 1: ทำความเข้าใจ Schema และ Flow

### 1.1 อ่าน Database Schema ทั้งหมด
```sql
-- ตารางต้นทาง (Source of Truth)
\d master_products           -- สินค้าทั้งหมด
\d wms_orders               -- ออเดอร์
\d wms_order_items          -- รายการสินค้าในออเดอร์
\d inbound_receipts         -- ใบรับสินค้า
\d inbound_receipt_items    -- รายการสินค้าที่รับ
\d stock_imports            -- นำเข้าสต็อกเริ่มต้น (หรือตารางที่ใช้)

-- ตารางการเคลื่อนไหว
\d inventory_ledger         -- บันทึกการเคลื่อนไหวทั้งหมด
\d inventory_balance        -- ยอดคงเหลือ

-- ตารางกิจกรรม
\d picklists                -- ใบหยิบ
\d picklist_items           -- รายการหยิบ
\d loadlists                -- ใบโหลด
\d wms_loadlist_picklists   -- ใบหยิบในใบโหลด
\d bonus_face_sheets        -- ใบปะหน้าของแถม
\d bonus_face_sheet_packages -- แพ็คของแถม
\d bonus_face_sheet_items   -- รายการของแถม
\d wms_loadlist_bonus_face_sheets -- BFS ในใบโหลด

-- ตาราง Master
\d master_locations         -- โลเคชั่น
```

### 1.2 ระบุ Location ทั้งหมดในระบบ
```sql
SELECT 
  id,
  location_code,
  location_name,
  location_type,
  is_prep_area
FROM master_locations
ORDER BY location_code;
```

### 1.3 ระบุ Stock Flow Path ทั้งหมด
```
[นำเข้าสต็อก] → บ้านหยิบ (PK001, PK002, etc.)
[รับเข้า] → บ้านหยิบ (PK001, PK002, etc.)

[หยิบ - ปกติ] → บ้านหยิบ → Dispatch
[หยิบ - พิเศษ] → บ้านหยิบ → PQ01-PQ10 / MR01-MR10

[BFS จัดสรร] → PQ/MR → PQTD/MRTD (ย้ายไปจุดพัก)

[โหลด - ปกติ] → Dispatch → Delivery-In-Progress
[โหลด - BFS] → PQTD/MRTD → Delivery-In-Progress

[ย้ายภายใน] → Location A → Location B
```

---

## Phase 2: ดึงข้อมูลต้นทาง (Source of Truth)

### 2.1 รายการ SKU ทั้งหมด
```sql
SELECT 
  id,
  product_code,
  product_name,
  unit,
  conversion_factor,
  default_location -- บ้านหยิบ
FROM master_products
WHERE is_active = true
ORDER BY product_code;
```

### 2.2 นำเข้าสต็อกเริ่มต้น (แยกตาม SKU)
```sql
-- หาตารางที่ใช้นำเข้าสต็อกเริ่มต้น
-- อาจเป็น stock_imports, initial_inventory, หรือ ledger ที่ transaction_type = 'initial'

SELECT 
  product_id,
  p.product_code,
  location_id,
  l.location_code,
  SUM(quantity) as imported_qty,
  MIN(created_at) as first_import,
  MAX(created_at) as last_import
FROM inventory_ledger il
JOIN master_products p ON p.id = il.product_id
JOIN master_locations l ON l.id = il.to_location
WHERE il.transaction_type IN ('initial', 'import', 'stock_import')
GROUP BY product_id, p.product_code, location_id, l.location_code
ORDER BY p.product_code, l.location_code;
```

### 2.3 รับสินค้าเข้า (Inbound) - แยกตาม SKU
```sql
SELECT 
  ir.id as receipt_id,
  ir.receipt_number,
  ir.receipt_date,
  ir.status,
  iri.product_id,
  p.product_code,
  iri.quantity,
  iri.location_id,
  l.location_code
FROM inbound_receipts ir
JOIN inbound_receipt_items iri ON iri.receipt_id = ir.id
JOIN master_products p ON p.id = iri.product_id
LEFT JOIN master_locations l ON l.id = iri.location_id
WHERE ir.status = 'completed'
ORDER BY p.product_code, ir.receipt_date;

-- สรุปยอดรับเข้าตาม SKU
SELECT 
  iri.product_id,
  p.product_code,
  SUM(iri.quantity) as total_received
FROM inbound_receipts ir
JOIN inbound_receipt_items iri ON iri.receipt_id = ir.id
JOIN master_products p ON p.id = iri.product_id
WHERE ir.status = 'completed'
GROUP BY iri.product_id, p.product_code
ORDER BY p.product_code;
```

### 2.4 ออเดอร์ทั้งหมด - แยกตาม SKU
```sql
-- รายละเอียดออเดอร์ทุกใบ
SELECT 
  o.id as order_id,
  o.order_no,
  o.order_type,
  o.status as order_status,
  o.customer_id,
  o.customer_name,
  oi.product_id,
  p.product_code,
  oi.quantity as ordered_qty,
  oi.picked_quantity,
  oi.status as item_status
FROM wms_orders o
JOIN wms_order_items oi ON oi.order_id = o.id
JOIN master_products p ON p.id = oi.product_id
WHERE o.status NOT IN ('cancelled', 'deleted')
ORDER BY p.product_code, o.order_no;

-- สรุปยอดออเดอร์ตาม SKU
SELECT 
  oi.product_id,
  p.product_code,
  SUM(oi.quantity) as total_ordered,
  SUM(oi.picked_quantity) as total_picked,
  SUM(oi.quantity) - SUM(COALESCE(oi.picked_quantity, 0)) as pending_qty
FROM wms_orders o
JOIN wms_order_items oi ON oi.order_id = o.id
JOIN master_products p ON p.id = oi.product_id
WHERE o.status NOT IN ('cancelled', 'deleted')
GROUP BY oi.product_id, p.product_code
ORDER BY p.product_code;
```

---

## Phase 3: ไล่กิจกรรมทีละ SKU

### 3.1 สร้าง Template สำหรับแต่ละ SKU

สำหรับแต่ละ SKU ต้องสร้างรายงาน:
```
====================================
SKU: [PRODUCT_CODE] - [PRODUCT_NAME]
====================================

1. ยอดเริ่มต้น (Initial Balance)
   - นำเข้าสต็อก: [X] ชิ้น → [LOCATION]
   - รับเข้า (Inbound): [X] ชิ้น → [LOCATION]
   - รวมยอดเข้า: [X] ชิ้น

2. ออเดอร์ที่ต้องจ่าย
   - ออเดอร์ทั้งหมด: [X] ชิ้น
   - ออเดอร์ประเภท: 
     * จัดเส้นทาง: [X] ชิ้น
     * ส่งรายชิ้น: [X] ชิ้น
     * พิเศษ: [X] ชิ้น

3. กิจกรรมหยิบ (Pick)
   | วันที่ | Picklist | Order | จำนวน | จาก | ไป |
   |--------|----------|-------|-------|-----|-----|
   | ...    | ...      | ...   | ...   | ... | ... |

4. กิจกรรมโหลด (Load)
   | วันที่ | Loadlist | จำนวน | จาก | ไป |
   |--------|----------|-------|-----|-----|
   | ...    | ...      | ...   | ... | ... |

5. กิจกรรมย้าย (Transfer)
   | วันที่ | Reference | จำนวน | จาก | ไป |
   |--------|-----------|-------|-----|-----|
   | ...    | ...       | ...   | ... | ... |

6. สรุปการเคลื่อนไหวตาม Location
   | Location | ยอดเข้า | ยอดออก | คงเหลือ |
   |----------|--------|--------|---------|
   | PK001    | ...    | ...    | ...     |
   | Dispatch | ...    | ...    | ...     |
   | ...      | ...    | ...    | ...     |

7. ตรวจสอบความถูกต้อง
   - ยอดเข้าทั้งหมด: [X] ชิ้น
   - ยอดออกทั้งหมด: [X] ชิ้น
   - ยอดคงเหลือ (คำนวณ): [X] ชิ้น
   - ยอดคงเหลือ (ระบบ): [X] ชิ้น
   - ผลต่าง: [X] ชิ้น
   - สถานะ: ✅ ตรง / ❌ ไม่ตรง
```

### 3.2 Query สำหรับไล่แต่ละ SKU
```sql
-- ตัวอย่าง: ไล่ SKU เดียว (เปลี่ยน product_code ตามต้องการ)
-- Replace 'XXX-XXX' with actual product_code

-- 3.2.1 ยอดเริ่มต้น
WITH sku_info AS (
  SELECT id, product_code, product_name, default_location
  FROM master_products
  WHERE product_code = 'XXX-XXX'
)
SELECT 
  'นำเข้าสต็อก' as source,
  il.created_at,
  il.quantity,
  l.location_code as to_location,
  il.reference_type,
  il.reference_id
FROM inventory_ledger il
JOIN sku_info s ON il.product_id = s.id
JOIN master_locations l ON l.id = il.to_location
WHERE il.transaction_type IN ('initial', 'import', 'stock_import')
ORDER BY il.created_at;

-- 3.2.2 รับเข้า (Inbound)
SELECT 
  'รับเข้า' as source,
  ir.receipt_number,
  ir.receipt_date,
  iri.quantity,
  l.location_code as to_location
FROM inbound_receipts ir
JOIN inbound_receipt_items iri ON iri.receipt_id = ir.id
JOIN master_products p ON p.id = iri.product_id
LEFT JOIN master_locations l ON l.id = iri.location_id
WHERE p.product_code = 'XXX-XXX'
  AND ir.status = 'completed'
ORDER BY ir.receipt_date;

-- 3.2.3 ออเดอร์ทั้งหมด
SELECT 
  o.order_no,
  o.order_type,
  o.status as order_status,
  o.customer_name,
  oi.quantity as ordered_qty,
  oi.picked_quantity,
  oi.status as item_status
FROM wms_orders o
JOIN wms_order_items oi ON oi.order_id = o.id
JOIN master_products p ON p.id = oi.product_id
WHERE p.product_code = 'XXX-XXX'
  AND o.status NOT IN ('cancelled', 'deleted')
ORDER BY o.created_at;

-- 3.2.4 กิจกรรมหยิบ (Pick)
SELECT 
  pl.picklist_code,
  pl.created_at,
  pi.order_id,
  o.order_no,
  pi.quantity,
  pi.picked_quantity,
  pi.status
FROM picklists pl
JOIN picklist_items pi ON pi.picklist_id = pl.id
JOIN master_products p ON p.id = pi.product_id
LEFT JOIN wms_orders o ON o.id = pi.order_id
WHERE p.product_code = 'XXX-XXX'
ORDER BY pl.created_at;

-- 3.2.5 Ledger ทั้งหมดของ SKU นี้
SELECT 
  il.id,
  il.created_at,
  il.transaction_type,
  il.reference_type,
  il.reference_id,
  il.quantity,
  fl.location_code as from_location,
  tl.location_code as to_location,
  il.notes
FROM inventory_ledger il
JOIN master_products p ON p.id = il.product_id
LEFT JOIN master_locations fl ON fl.id = il.from_location
LEFT JOIN master_locations tl ON tl.id = il.to_location
WHERE p.product_code = 'XXX-XXX'
ORDER BY il.created_at;

-- 3.2.6 Balance ปัจจุบันของ SKU นี้
SELECT 
  l.location_code,
  ib.quantity,
  ib.updated_at
FROM inventory_balance ib
JOIN master_products p ON p.id = ib.product_id
JOIN master_locations l ON l.id = ib.location_id
WHERE p.product_code = 'XXX-XXX'
ORDER BY l.location_code;

-- 3.2.7 คำนวณ Balance จาก Ledger
SELECT 
  COALESCE(tl.location_code, fl.location_code) as location_code,
  SUM(CASE 
    WHEN il.to_location IS NOT NULL THEN il.quantity 
    WHEN il.from_location IS NOT NULL THEN -il.quantity
    ELSE 0 
  END) as calculated_balance
FROM inventory_ledger il
JOIN master_products p ON p.id = il.product_id
LEFT JOIN master_locations fl ON fl.id = il.from_location
LEFT JOIN master_locations tl ON tl.id = il.to_location
WHERE p.product_code = 'XXX-XXX'
GROUP BY COALESCE(tl.location_code, fl.location_code)
ORDER BY location_code;
```

---

## Phase 4: ตรวจสอบความถูกต้องของทุก SKU

### 4.1 สร้าง Full Reconciliation Report
```sql
-- Reconciliation Report สำหรับทุก SKU
WITH 
-- 1. ยอดนำเข้า/รับเข้า
stock_in AS (
  SELECT 
    product_id,
    SUM(quantity) as total_in
  FROM inventory_ledger
  WHERE transaction_type IN ('initial', 'import', 'stock_import', 'inbound', 'receive')
    AND quantity > 0
  GROUP BY product_id
),
-- 2. ยอดออกจากระบบ (โหลดขึ้นรถ)
stock_out AS (
  SELECT 
    product_id,
    SUM(ABS(quantity)) as total_out
  FROM inventory_ledger
  WHERE to_location = (SELECT id FROM master_locations WHERE location_code = 'Delivery-In-Progress')
  GROUP BY product_id
),
-- 3. ยอดคงเหลือจาก Balance
current_balance AS (
  SELECT 
    product_id,
    SUM(quantity) as total_balance
  FROM inventory_balance
  GROUP BY product_id
),
-- 4. ยอดคงเหลือจาก Ledger
ledger_balance AS (
  SELECT 
    product_id,
    SUM(quantity) as ledger_total
  FROM inventory_ledger
  GROUP BY product_id
),
-- 5. ยอดออเดอร์ที่ต้องจ่าย
order_demand AS (
  SELECT 
    oi.product_id,
    SUM(oi.quantity) as total_ordered,
    SUM(COALESCE(oi.picked_quantity, 0)) as total_picked
  FROM wms_orders o
  JOIN wms_order_items oi ON oi.order_id = o.id
  WHERE o.status NOT IN ('cancelled', 'deleted')
  GROUP BY oi.product_id
)
-- Final Report
SELECT 
  p.product_code,
  p.product_name,
  COALESCE(si.total_in, 0) as ยอดเข้า,
  COALESCE(so.total_out, 0) as ยอดออก_โหลด,
  COALESCE(si.total_in, 0) - COALESCE(so.total_out, 0) as ยอดควรเหลือ,
  COALESCE(cb.total_balance, 0) as ยอด_Balance,
  COALESCE(lb.ledger_total, 0) as ยอด_Ledger,
  COALESCE(od.total_ordered, 0) as ยอดออเดอร์,
  COALESCE(od.total_picked, 0) as ยอดหยิบแล้ว,
  COALESCE(od.total_ordered, 0) - COALESCE(od.total_picked, 0) as รอหยิบ,
  -- ตรวจสอบความถูกต้อง
  CASE 
    WHEN COALESCE(cb.total_balance, 0) = COALESCE(lb.ledger_total, 0) THEN '✅'
    ELSE '❌'
  END as balance_vs_ledger,
  COALESCE(cb.total_balance, 0) - COALESCE(lb.ledger_total, 0) as diff_balance_ledger,
  -- ตรวจสอบว่าสต็อกพอจ่ายออเดอร์ไหม
  CASE 
    WHEN COALESCE(cb.total_balance, 0) >= (COALESCE(od.total_ordered, 0) - COALESCE(od.total_picked, 0)) THEN '✅'
    ELSE '⚠️ ไม่พอ'
  END as stock_sufficient
FROM master_products p
LEFT JOIN stock_in si ON si.product_id = p.id
LEFT JOIN stock_out so ON so.product_id = p.id
LEFT JOIN current_balance cb ON cb.product_id = p.id
LEFT JOIN ledger_balance lb ON lb.product_id = p.id
LEFT JOIN order_demand od ON od.product_id = p.id
WHERE p.is_active = true
  AND (COALESCE(si.total_in, 0) > 0 OR COALESCE(od.total_ordered, 0) > 0)
ORDER BY 
  CASE WHEN COALESCE(cb.total_balance, 0) != COALESCE(lb.ledger_total, 0) THEN 0 ELSE 1 END,
  p.product_code;
```

### 4.2 ตรวจสอบ Flow ถูกต้อง (ออก = เข้า)
```sql
-- ตรวจสอบว่าทุกการย้าย มีทั้งออกและเข้า
-- หา orphan ledger entries (มีแค่ฝั่งเดียว)

-- หาการย้ายที่มี from_location แต่ไม่มี to_location
SELECT * FROM inventory_ledger
WHERE from_location IS NOT NULL AND to_location IS NULL
  AND transaction_type NOT IN ('outbound', 'sold', 'disposed');

-- หาการย้ายที่มี to_location แต่ไม่มี from_location
SELECT * FROM inventory_ledger
WHERE to_location IS NOT NULL AND from_location IS NULL
  AND transaction_type NOT IN ('initial', 'import', 'inbound');
```

### 4.3 ตรวจสอบ Location Balance
```sql
-- สำหรับแต่ละ Location ต้อง: ยอดเข้า - ยอดออก = ยอดคงเหลือ
WITH location_movements AS (
  SELECT 
    l.id as location_id,
    l.location_code,
    -- ยอดเข้า
    SUM(CASE WHEN il.to_location = l.id THEN il.quantity ELSE 0 END) as total_in,
    -- ยอดออก
    SUM(CASE WHEN il.from_location = l.id THEN ABS(il.quantity) ELSE 0 END) as total_out
  FROM master_locations l
  LEFT JOIN inventory_ledger il ON il.to_location = l.id OR il.from_location = l.id
  GROUP BY l.id, l.location_code
),
location_balance AS (
  SELECT 
    location_id,
    SUM(quantity) as current_balance
  FROM inventory_balance
  GROUP BY location_id
)
SELECT 
  lm.location_code,
  lm.total_in,
  lm.total_out,
  lm.total_in - lm.total_out as calculated_balance,
  COALESCE(lb.current_balance, 0) as system_balance,
  (lm.total_in - lm.total_out) - COALESCE(lb.current_balance, 0) as difference,
  CASE 
    WHEN (lm.total_in - lm.total_out) = COALESCE(lb.current_balance, 0) THEN '✅'
    ELSE '❌'
  END as status
FROM location_movements lm
LEFT JOIN location_balance lb ON lb.location_id = lm.location_id
WHERE lm.total_in > 0 OR lm.total_out > 0
ORDER BY ABS((lm.total_in - lm.total_out) - COALESCE(lb.current_balance, 0)) DESC;
```

---

## Phase 5: หาและแก้ไขข้อผิดพลาด

### 5.1 หา Ledger ที่ผิดปกติ
```sql
-- 1. หา ledger ที่ reference ไม่มีอยู่จริง
-- Inbound ที่ถูกลบ
SELECT il.* FROM inventory_ledger il
WHERE il.reference_type = 'inbound'
  AND il.reference_id NOT IN (SELECT id FROM inbound_receipts);

-- Picklist ที่ถูกลบ
SELECT il.* FROM inventory_ledger il
WHERE il.reference_type = 'picklist'
  AND il.reference_id NOT IN (SELECT id FROM picklists);

-- Order ที่ถูกลบ
SELECT il.* FROM inventory_ledger il
WHERE il.reference_type = 'order'
  AND il.reference_id NOT IN (SELECT id FROM wms_orders);

-- 2. หา ledger ซ้ำ
SELECT 
  reference_type,
  reference_id,
  product_id,
  from_location,
  to_location,
  quantity,
  COUNT(*) as duplicate_count
FROM inventory_ledger
GROUP BY reference_type, reference_id, product_id, from_location, to_location, quantity
HAVING COUNT(*) > 1;

-- 3. หา manual adjustments
SELECT * FROM inventory_ledger
WHERE transaction_type IN ('adjustment', 'manual', 'correction', 'sync_adjustment')
ORDER BY created_at DESC;
```

### 5.2 สร้าง Cleanup Script (ทำหลังจากตรวจสอบแล้ว)
```sql
-- ⚠️ สำรองข้อมูลก่อนทำทุกครั้ง!
CREATE TABLE inventory_ledger_backup_YYYYMMDD AS SELECT * FROM inventory_ledger;
CREATE TABLE inventory_balance_backup_YYYYMMDD AS SELECT * FROM inventory_balance;

-- 1. ลบ ledger ที่ reference ไม่มีอยู่
DELETE FROM inventory_ledger
WHERE reference_type = 'inbound'
  AND reference_id NOT IN (SELECT id FROM inbound_receipts);

-- 2. ลบ ledger ซ้ำ (เก็บ id น้อยสุด)
DELETE FROM inventory_ledger a
USING inventory_ledger b
WHERE a.id > b.id
  AND a.reference_type = b.reference_type
  AND a.reference_id = b.reference_id
  AND a.product_id = b.product_id
  AND a.from_location IS NOT DISTINCT FROM b.from_location
  AND a.to_location IS NOT DISTINCT FROM b.to_location
  AND a.quantity = b.quantity;

-- 3. ลบ manual adjustments ที่ไม่ถูกต้อง (ตรวจสอบก่อน!)
-- DELETE FROM inventory_ledger WHERE transaction_type IN ('adjustment', 'manual');

-- 4. คำนวณ Balance ใหม่จาก Ledger ที่สะอาด
TRUNCATE inventory_balance;

INSERT INTO inventory_balance (product_id, location_id, quantity, updated_at)
SELECT 
  product_id,
  location_id,
  SUM(qty) as quantity,
  NOW() as updated_at
FROM (
  -- ยอดเข้า
  SELECT product_id, to_location as location_id, quantity as qty
  FROM inventory_ledger
  WHERE to_location IS NOT NULL
  
  UNION ALL
  
  -- ยอดออก (ติดลบ)
  SELECT product_id, from_location as location_id, -quantity as qty
  FROM inventory_ledger
  WHERE from_location IS NOT NULL
) movements
GROUP BY product_id, location_id
HAVING SUM(qty) != 0;
```

---

## Phase 6: สร้าง Final Report

### 6.1 Template Final Report
```
=====================================================
รายงานการตรวจสอบสต็อก (Stock Audit Report)
วันที่ตรวจสอบ: [DATE]
=====================================================

1. สรุปภาพรวม
   - จำนวน SKU ทั้งหมด: [X]
   - จำนวน SKU ที่มีการเคลื่อนไหว: [X]
   - จำนวน SKU ที่ตรง: [X] ✅
   - จำนวน SKU ที่ไม่ตรง: [X] ❌

2. สรุปตาม Location
   | Location | ยอดเข้า | ยอดออก | คงเหลือ | สถานะ |
   |----------|--------|--------|---------|-------|
   | ...      | ...    | ...    | ...     | ...   |

3. รายการ SKU ที่ไม่ตรง (ถ้ามี)
   [รายละเอียดแต่ละ SKU]

4. รายการ Ledger ที่ผิดปกติ (ถ้ามี)
   [รายละเอียด]

5. การแก้ไขที่ทำ
   [รายการที่ลบ/แก้ไข]

6. สรุปผลหลังแก้ไข
   - Discrepancies: 0
   - Balance = Ledger: ✅ ทุก SKU
   - สถานะ: พร้อมยื่นสรรพากร ✅

=====================================================
ผู้ตรวจสอบ: [NAME]
วันที่: [DATE]
=====================================================
```

---

## Checklist

### Phase 1: ทำความเข้าใจ
- [ ] อ่าน schema ทุกตาราง
- [ ] ระบุ locations ทั้งหมด
- [ ] เข้าใจ flow ทั้งหมด

### Phase 2: ดึงข้อมูลต้นทาง
- [ ] รายการ SKU ทั้งหมด
- [ ] นำเข้าสต็อกเริ่มต้น
- [ ] รับสินค้าเข้า (Inbound)
- [ ] ออเดอร์ทั้งหมด

### Phase 3: ไล่ทีละ SKU
- [ ] สร้าง report แต่ละ SKU
- [ ] ตรวจสอบ flow ถูกต้อง

### Phase 4: Reconciliation
- [ ] Full reconciliation report
- [ ] ตรวจสอบ Location balance
- [ ] ตรวจสอบ ออก = เข้า

### Phase 5: แก้ไข
- [ ] หา ledger ที่ผิดปกติ
- [ ] สำรองข้อมูล
- [ ] ลบ ledger ที่ผิด
- [ ] คำนวณ balance ใหม่

### Phase 6: Final Report
- [ ] สร้าง report
- [ ] ยืนยันความถูกต้อง

---

เริ่มทำงานได้เลย รายงานผลทุกขั้นตอนอย่างละเอียดที่สุด