# ภารกิจ: ตรวจสอบและแก้ไข Flow สต็อกทั้งระบบอย่างละเอียด

## ⚠️ คำเตือนสำคัญ

**ห้ามปรับสต็อกมัวเด็ดขาด!** ต้องหาสาเหตุที่แท้จริงและแก้ไขที่ต้นเหตุเท่านั้น

---

## 1. ภาพรวมระบบ (System Overview)

### 1.1 Flow หลักของสต็อก
```
[นำเข้าสต็อก]                    [นำเข้าออเดอร์]
     │                                │
     ▼                                ▼
┌─────────────┐               ┌─────────────┐
│ Inbound     │               │ Orders      │
│ /warehouse/ │               │ /receiving/ │
│ inbound     │               │ orders      │
└──────┬──────┘               └──────┬──────┘
       │                             │
       ▼                             ▼
┌─────────────────────────────────────────────┐
│             Preparation Area                 │
│  (บ้านหยิบ: PK001, PK002, etc.)             │
└──────────────────────┬──────────────────────┘
                       │
       ┌───────────────┼───────────────┐
       │               │               │
       ▼               ▼               ▼
┌───────────┐   ┌───────────┐   ┌───────────┐
│ ออเดอร์    │   │ ออเดอร์    │   │ ออเดอร์    │
│ จัดเส้นทาง │   │ ส่งรายชิ้น │   │ พิเศษ     │
└─────┬─────┘   └─────┬─────┘   └─────┬─────┘
      │               │               │
      ▼               ▼               ▼
┌─────────────────────────────────────────────┐
│           Mobile Pick (/mobile/pick)         │
│     ยืนยันหยิบสินค้า → ย้ายสต็อก            │
└──────────────────────┬──────────────────────┘
                       │
       ┌───────────────┴───────────────┐
       │                               │
       ▼                               ▼
┌─────────────┐               ┌─────────────────┐
│ Dispatch    │               │ PQ01-PQ10       │
│ (ปกติ)      │               │ MR01-MR10       │
│             │               │ (พิเศษ/ของแถม)  │
└──────┬──────┘               └────────┬────────┘
       │                               │
       │                               ▼
       │                 ┌─────────────────────────┐
       │                 │ Bonus Face Sheet        │
       │                 │ → สร้าง, จัดสรรโลเคชั่น │
       │                 └────────────┬────────────┘
       │                              │
       │                              ▼
       │                 ┌─────────────────────────┐
       │                 │ Loadlist (BFS แมพ)      │
       │                 │ → แมพ Picklist/FS       │
       │                 └────────────┬────────────┘
       │                              │
       │                              ▼
       │                 ┌─────────────────────────┐
       │                 │ ย้ายไป PQTD/MRTD        │
       │                 │ (จุดพักรอโหลด)          │
       │                 └────────────┬────────────┘
       │                              │
       └──────────────┬───────────────┘
                      │
                      ▼
       ┌─────────────────────────────────────┐
       │ Mobile Loading (/mobile/loading)     │
       │ ยืนยันโหลด → ย้ายไป Delivery-In-Progress │
       └─────────────────────────────────────┘
```

### 1.2 หน้าที่ต้องตรวจสอบ

| # | หน้า | หน้าที่ | ผลกระทบสต็อก |
|---|------|--------|--------------|
| 1 | /stock-management/import | นำเข้าสต็อกเริ่มต้น | เพิ่มสต็อก |
| 2 | /warehouse/inbound | รับสินค้าเข้า | เพิ่มสต็อก |
| 3 | /receiving/orders | นำเข้าออเดอร์ | ไม่กระทบสต็อก |
| 4 | /mobile/pick | หยิบสินค้า | ย้ายสต็อก |
| 5 | /mobile/transfer | ย้ายสินค้า | ย้ายสต็อก |
| 6 | /receiving/picklists/bonus-face-sheets | สร้าง BFS | ไม่กระทบสต็อก (แค่จอง) |
| 7 | /receiving/loadlists | สร้างใบโหลด, ย้ายไป staging | ย้ายสต็อก |
| 8 | /mobile/loading | ยืนยันโหลด | ย้ายสต็อก |
| 9 | /warehouse/inventory-ledger | บันทึกการเคลื่อนไหว | แสดงประวัติ |
| 10 | /warehouse/inventory-balances | สต็อกคงเหลือ | แสดงยอด |

---

## 2. ขั้นตอนการตรวจสอบ (Audit Steps)

### Phase 1: อ่าน Code และทำความเข้าใจ Flow

#### 1.1 อ่าน Database Schema
```sql
-- ตารางหลักที่เกี่ยวข้องกับสต็อก
\d inventory_ledger
\d inventory_balance
\d wms_orders
\d wms_order_items
\d picklists
\d picklist_items
\d bonus_face_sheets
\d bonus_face_sheet_packages
\d bonus_face_sheet_items
\d loadlists
\d wms_loadlist_picklists
\d wms_loadlist_bonus_face_sheets
\d inbound_receipts
\d inbound_receipt_items
\d master_locations
\d master_products
```

#### 1.2 อ่าน API ทั้งหมดที่กระทบสต็อก
```bash
# ค้นหาไฟล์ API ที่เกี่ยวกับ inventory
find ./app/api -name "*.ts" | xargs grep -l "inventory_ledger\|inventory_balance"

# ค้นหา function ที่ย้ายสต็อก
grep -r "moveStock\|transferStock\|updateInventory" --include="*.ts" ./app
```

---

### Phase 2: ตรวจสอบข้อมูลต้นทาง (Source of Truth)

#### 2.1 ออเดอร์จริง (Orders)
```sql
-- นับออเดอร์ทั้งหมด
SELECT 
  order_type,
  status,
  COUNT(*) as count
FROM wms_orders
GROUP BY order_type, status
ORDER BY order_type, status;

-- ดูรายการสินค้าในออเดอร์ทั้งหมด (ไม่ซ้ำ)
SELECT 
  oi.product_id,
  p.product_code,
  p.product_name,
  SUM(oi.quantity) as total_ordered_qty
FROM wms_order_items oi
JOIN master_products p ON p.id = oi.product_id
JOIN wms_orders o ON o.id = oi.order_id
WHERE o.status NOT IN ('cancelled')
GROUP BY oi.product_id, p.product_code, p.product_name
ORDER BY p.product_code;
```

#### 2.2 สต็อกนำเข้าเริ่มต้น (Initial Stock Import)
```sql
-- ดูรายการนำเข้าสต็อกเริ่มต้น
SELECT 
  product_id,
  product_code,
  SUM(quantity) as imported_qty,
  import_date
FROM stock_imports -- หรือตารางที่ใช้นำเข้า
GROUP BY product_id, product_code, import_date
ORDER BY import_date;
```

#### 2.3 การรับสินค้าเข้า (Inbound)
```sql
-- รายการรับเข้าที่ถูกต้อง (ไม่นับที่ถูกลบ)
SELECT 
  ir.id,
  ir.receipt_number,
  ir.receipt_date,
  ir.status,
  iri.product_id,
  p.product_code,
  iri.quantity
FROM inbound_receipts ir
JOIN inbound_receipt_items iri ON iri.receipt_id = ir.id
JOIN master_products p ON p.id = iri.product_id
WHERE ir.status = 'completed' -- เฉพาะที่สำเร็จ
ORDER BY ir.receipt_date;

-- สรุปยอดรับเข้าตามสินค้า
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

---

### Phase 3: ตรวจสอบการเคลื่อนไหวสต็อก

#### 3.1 Inventory Ledger (บันทึกการเคลื่อนไหว)
```sql
-- ดูประเภทการเคลื่อนไหวทั้งหมด
SELECT 
  transaction_type,
  reference_type,
  COUNT(*) as count,
  SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END) as total_in,
  SUM(CASE WHEN quantity < 0 THEN ABS(quantity) ELSE 0 END) as total_out
FROM inventory_ledger
GROUP BY transaction_type, reference_type
ORDER BY transaction_type;

-- หาการเคลื่อนไหวที่ผิดปกติ
-- 1. การปรับสต็อก manual
SELECT * FROM inventory_ledger
WHERE transaction_type IN ('adjustment', 'manual', 'correction')
ORDER BY created_at DESC;

-- 2. การเคลื่อนไหวซ้ำ
SELECT 
  reference_type,
  reference_id,
  product_id,
  from_location,
  to_location,
  COUNT(*) as duplicate_count
FROM inventory_ledger
GROUP BY reference_type, reference_id, product_id, from_location, to_location
HAVING COUNT(*) > 1;
```

#### 3.2 ตรวจสอบ Balance vs Ledger
```sql
-- เปรียบเทียบ balance กับผลรวมจาก ledger
WITH ledger_sum AS (
  SELECT 
    product_id,
    location_id,
    SUM(quantity) as ledger_total
  FROM inventory_ledger
  GROUP BY product_id, location_id
)
SELECT 
  b.product_id,
  p.product_code,
  b.location_id,
  l.location_code,
  b.quantity as balance_qty,
  ls.ledger_total,
  b.quantity - COALESCE(ls.ledger_total, 0) as difference
FROM inventory_balance b
JOIN master_products p ON p.id = b.product_id
JOIN master_locations l ON l.id = b.location_id
LEFT JOIN ledger_sum ls ON ls.product_id = b.product_id AND ls.location_id = b.location_id
WHERE b.quantity != COALESCE(ls.ledger_total, 0)
ORDER BY ABS(b.quantity - COALESCE(ls.ledger_total, 0)) DESC;
```

---

### Phase 4: ตรวจสอบแต่ละ Flow

#### 4.1 Flow: Mobile Pick
```sql
-- ดู picklist ที่หยิบแล้ว
SELECT 
  p.id,
  p.picklist_code,
  p.status,
  pi.product_id,
  pi.quantity,
  pi.picked_quantity,
  pi.status as item_status
FROM picklists p
JOIN picklist_items pi ON pi.picklist_id = p.id
WHERE p.status = 'completed';

-- ตรวจสอบว่า ledger บันทึกถูกต้องไหม
SELECT 
  il.*
FROM inventory_ledger il
WHERE il.reference_type = 'picklist'
ORDER BY il.created_at DESC
LIMIT 100;
```

#### 4.2 Flow: Mobile Transfer
```sql
-- ดูการย้ายสินค้าทั้งหมด
SELECT 
  il.*
FROM inventory_ledger il
WHERE il.transaction_type = 'transfer'
ORDER BY il.created_at DESC;

-- หาการย้ายซ้ำ (duplicate transfer)
SELECT 
  product_id,
  from_location,
  to_location,
  quantity,
  COUNT(*) as transfer_count
FROM inventory_ledger
WHERE transaction_type = 'transfer'
GROUP BY product_id, from_location, to_location, quantity, DATE(created_at)
HAVING COUNT(*) > 1;
```

#### 4.3 Flow: Inbound (รับสินค้าเข้า)
```sql
-- ตรวจสอบ ledger ที่เกี่ยวกับ inbound
SELECT 
  il.*,
  ir.receipt_number,
  ir.status as receipt_status
FROM inventory_ledger il
LEFT JOIN inbound_receipts ir ON ir.id = il.reference_id AND il.reference_type = 'inbound'
WHERE il.reference_type = 'inbound'
ORDER BY il.created_at DESC;

-- หา ledger ที่ receipt ถูกลบไปแล้ว
SELECT 
  il.*
FROM inventory_ledger il
WHERE il.reference_type = 'inbound'
  AND il.reference_id NOT IN (SELECT id FROM inbound_receipts);
```

#### 4.4 Flow: BFS และ Loadlist
```sql
-- ดู BFS packages และสถานะ
SELECT 
  bfs.face_sheet_no,
  bfsp.id as package_id,
  bfsp.storage_location,
  bfsp.trip_number
FROM bonus_face_sheets bfs
JOIN bonus_face_sheet_packages bfsp ON bfsp.bonus_face_sheet_id = bfs.id
ORDER BY bfs.id, bfsp.id;

-- ดู ledger ที่เกี่ยวกับ BFS
SELECT 
  il.*
FROM inventory_ledger il
WHERE il.reference_type IN ('bonus_face_sheet', 'loadlist_bfs', 'staging')
ORDER BY il.created_at DESC;
```

#### 4.5 Flow: Mobile Loading
```sql
-- ดู loadlist ที่โหลดแล้ว
SELECT 
  l.id,
  l.loadlist_code,
  l.status,
  l.loaded_at
FROM loadlists l
WHERE l.status = 'loaded'
ORDER BY l.loaded_at DESC;

-- ดู ledger ที่เกี่ยวกับ loading
SELECT 
  il.*
FROM inventory_ledger il
WHERE il.reference_type = 'loading'
   OR il.to_location = (SELECT id FROM master_locations WHERE location_code = 'Delivery-In-Progress')
ORDER BY il.created_at DESC;
```

---

### Phase 5: สร้าง Reconciliation Report

#### 5.1 คำนวณสต็อกที่ควรจะเป็น
```sql
-- สต็อกที่ควรจะเป็น = นำเข้า + รับเข้า - หยิบออก
WITH 
-- 1. สต็อกนำเข้าเริ่มต้น
initial_stock AS (
  SELECT product_id, SUM(quantity) as qty
  FROM stock_imports
  GROUP BY product_id
),
-- 2. รับเข้า (inbound ที่ยังอยู่)
inbound_stock AS (
  SELECT iri.product_id, SUM(iri.quantity) as qty
  FROM inbound_receipts ir
  JOIN inbound_receipt_items iri ON iri.receipt_id = ir.id
  WHERE ir.status = 'completed'
  GROUP BY iri.product_id
),
-- 3. หยิบออก (จากออเดอร์ที่หยิบแล้ว)
picked_stock AS (
  SELECT pi.product_id, SUM(pi.picked_quantity) as qty
  FROM picklists p
  JOIN picklist_items pi ON pi.picklist_id = p.id
  WHERE p.status IN ('completed', 'loaded')
  GROUP BY pi.product_id
),
-- 4. คำนวณที่ควรเหลือ
expected_stock AS (
  SELECT 
    p.id as product_id,
    p.product_code,
    COALESCE(i.qty, 0) as initial,
    COALESCE(ib.qty, 0) as inbound,
    COALESCE(pk.qty, 0) as picked,
    COALESCE(i.qty, 0) + COALESCE(ib.qty, 0) - COALESCE(pk.qty, 0) as expected_balance
  FROM master_products p
  LEFT JOIN initial_stock i ON i.product_id = p.id
  LEFT JOIN inbound_stock ib ON ib.product_id = p.id
  LEFT JOIN picked_stock pk ON pk.product_id = p.id
),
-- 5. สต็อกปัจจุบัน
current_stock AS (
  SELECT product_id, SUM(quantity) as current_balance
  FROM inventory_balance
  GROUP BY product_id
)
-- 6. เปรียบเทียบ
SELECT 
  e.product_code,
  e.initial,
  e.inbound,
  e.picked,
  e.expected_balance,
  COALESCE(c.current_balance, 0) as actual_balance,
  COALESCE(c.current_balance, 0) - e.expected_balance as difference
FROM expected_stock e
LEFT JOIN current_stock c ON c.product_id = e.product_id
WHERE e.expected_balance != COALESCE(c.current_balance, 0)
ORDER BY ABS(COALESCE(c.current_balance, 0) - e.expected_balance) DESC;
```

---

## 3. ปัญหาที่ต้องหาและแก้ไข

### 3.1 ปัญหาที่ทราบแล้ว

| # | ปัญหา | หน้าที่เกี่ยวข้อง | ผลกระทบ |
|---|-------|------------------|---------|
| 1 | ลบเลขงานรับ แต่ ledger/balance ไม่ลบ | /warehouse/inbound | สต็อกเกิน |
| 2 | ย้ายสินค้าซ้ำได้ (เบิ้ล) | /mobile/transfer | สต็อกเกิน |
| 3 | ปรับสต็อก manual ผ่าน MCP | - | มั่วทั้งระบบ |
| 4 | หยิบไม่สำเร็จ แต่ย้ายบ้าง | /mobile/pick | สต็อกไม่ตรง |
| 5 | BFS/Loadlist flow ไม่สมบูรณ์ | /receiving/loadlists | สต็อกค้าง |

### 3.2 สิ่งที่ต้องตรวจสอบเพิ่ม

- [ ] API ทุกตัวที่กระทบ inventory_ledger
- [ ] API ทุกตัวที่กระทบ inventory_balance
- [ ] Validation ป้องกันการย้ายซ้ำ
- [ ] Validation ป้องกันการลบที่มี ledger อ้างอิง
- [ ] Transaction handling (rollback เมื่อ error)

---

## 4. วิธีแก้ไขที่ถูกต้อง (ห้ามปรับสต็อกมัว)

### 4.1 ขั้นตอนการแก้ไข
```
1. FREEZE ระบบ - หยุดการทำงานทั้งหมดชั่วคราว

2. AUDIT - ตรวจสอบตาม Phase 1-5 ข้างบน

3. IDENTIFY - ระบุรายการที่ผิดพลาดทั้งหมด
   - Ledger ที่ไม่ควรมี (เช่น inbound ที่ถูกลบ)
   - Ledger ที่ซ้ำ (duplicate transfer)
   - Ledger ที่ขาด (หยิบแล้วแต่ไม่มี ledger)

4. CLEANUP - ลบรายการที่ไม่ถูกต้อง
   - ลบ ledger ที่ reference ถูกลบ
   - ลบ ledger ที่ซ้ำ (เก็บแค่อันแรก)

5. RECALCULATE - คำนวณ balance ใหม่จาก ledger
   - TRUNCATE inventory_balance
   - INSERT จาก SUM(ledger)

6. FIX CODE - แก้ไข API ให้ถูกต้อง
   - เพิ่ม validation ป้องกันซ้ำ
   - เพิ่ม cascade delete
   - เพิ่ม transaction

7. VERIFY - ตรวจสอบอีกครั้ง

8. UNFREEZE - เปิดระบบ
```

### 4.2 Script ลบ Ledger ที่ไม่ถูกต้อง
```sql
-- ลบ ledger ที่ reference inbound ถูกลบแล้ว
DELETE FROM inventory_ledger
WHERE reference_type = 'inbound'
  AND reference_id NOT IN (SELECT id FROM inbound_receipts);

-- ลบ ledger ซ้ำ (เก็บ id ที่น้อยที่สุด)
DELETE FROM inventory_ledger
WHERE id NOT IN (
  SELECT MIN(id)
  FROM inventory_ledger
  GROUP BY reference_type, reference_id, product_id, from_location, to_location, quantity
);
```

### 4.3 Script คำนวณ Balance ใหม่
```sql
-- สำรองข้อมูลก่อน
CREATE TABLE inventory_balance_backup AS SELECT * FROM inventory_balance;

-- ลบ balance เก่า
TRUNCATE inventory_balance;

-- คำนวณใหม่จาก ledger
INSERT INTO inventory_balance (product_id, location_id, quantity, updated_at)
SELECT 
  product_id,
  COALESCE(to_location, from_location) as location_id,
  SUM(quantity) as quantity,
  NOW() as updated_at
FROM inventory_ledger
GROUP BY product_id, COALESCE(to_location, from_location)
HAVING SUM(quantity) != 0;
```

---

## 5. Checklist

### Phase 1: อ่าน Code
- [ ] อ่าน schema ทุกตาราง
- [ ] อ่าน API ทุกตัวที่กระทบสต็อก
- [ ] ทำความเข้าใจ flow ทั้งหมด

### Phase 2: ตรวจสอบข้อมูลต้นทาง
- [ ] นับออเดอร์จริง
- [ ] นับสต็อกนำเข้า
- [ ] นับการรับเข้า

### Phase 3: ตรวจสอบ Ledger
- [ ] หา ledger ที่ผิดปกติ
- [ ] หา ledger ซ้ำ
- [ ] เปรียบเทียบ balance vs ledger

### Phase 4: ตรวจสอบแต่ละ Flow
- [ ] Mobile Pick
- [ ] Mobile Transfer
- [ ] Inbound
- [ ] BFS/Loadlist
- [ ] Mobile Loading

### Phase 5: Reconciliation
- [ ] คำนวณสต็อกที่ควรจะเป็น
- [ ] เปรียบเทียบกับสต็อกจริง
- [ ] ระบุส่วนต่าง

### Phase 6: แก้ไข
- [ ] ลบ ledger ที่ไม่ถูกต้อง
- [ ] คำนวณ balance ใหม่
- [ ] แก้ไข API

---

เริ่มทำงานได้เลย โดยเริ่มจาก Phase 1 อ่าน code ทำความเข้าใจก่อน
รายงานผลทุกขั้นตอนอย่างละเอียด