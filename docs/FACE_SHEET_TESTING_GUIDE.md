# 🧪 Face Sheet Stock Reservation - Testing Guide

## ข้อกำหนดเบื้องต้นก่อนทดสอบ

### 1. ข้อมูล Master Data ที่จำเป็น

#### 1.1 Master SKU
ต้องมี `default_location` (preparation area) สำหรับทุก SKU ที่จะใช้ใน face sheet

```sql
-- ตรวจสอบ SKU ที่ไม่มี default_location
SELECT sku_id, sku_name, default_location
FROM master_sku
WHERE default_location IS NULL
  AND sku_id IN (
    SELECT DISTINCT product_code 
    FROM wms_order_items oi
    JOIN wms_orders o ON oi.order_id = o.order_id
    WHERE o.order_type = 'express'
  );

-- อัปเดต default_location สำหรับ SKU
UPDATE master_sku
SET default_location = 'PK001'  -- preparation area code
WHERE sku_id = 'YOUR-SKU-ID';
```

#### 1.2 Preparation Area
ต้องมีข้อมูล preparation area และ zone

```sql
-- ตรวจสอบ preparation areas
SELECT * FROM preparation_area;

-- ถ้าไม่มี ให้เพิ่ม
INSERT INTO preparation_area (area_code, area_name, zone, warehouse_id)
VALUES 
  ('PK001', 'Picking Zone 1', 'Picking Zone A', 'WH01'),
  ('PK002', 'Picking Zone 2', 'Picking Zone B', 'WH01');
```

#### 1.3 Master Location
ต้องมี locations ที่ match กับ zone ใน preparation area

```sql
-- ตรวจสอบ locations ใน zone
SELECT location_id, location_code, zone, warehouse_id
FROM master_location
WHERE zone = 'Picking Zone A'
  AND warehouse_id = 'WH01';

-- ถ้าไม่มี ให้เพิ่ม
INSERT INTO master_location (location_id, location_code, zone, warehouse_id, active_status)
VALUES 
  ('A-01-01-01', 'A-01-01-01', 'Picking Zone A', 'WH01', 'active'),
  ('A-01-01-02', 'A-01-01-02', 'Picking Zone A', 'WH01', 'active'),
  ('A-01-02-01', 'A-01-02-01', 'Picking Zone A', 'WH01', 'active');
```

#### 1.4 Inventory Balances
ต้องมีสต็อคใน preparation area

```sql
-- ตรวจสอบสต็อค
SELECT 
  b.sku_id,
  s.sku_name,
  l.location_code,
  l.zone,
  b.total_piece_qty,
  b.reserved_piece_qty,
  b.total_piece_qty - b.reserved_piece_qty AS available_qty
FROM wms_inventory_balances b
JOIN master_location l ON b.location_id = l.location_id
JOIN master_sku s ON b.sku_id = s.sku_id
WHERE l.zone = 'Picking Zone A'
  AND b.warehouse_id = 'WH01'
  AND b.total_piece_qty > 0
ORDER BY b.sku_id, l.location_code;

-- ถ้าไม่มีสต็อค ให้เพิ่ม (สำหรับทดสอบ)
INSERT INTO wms_inventory_balances (
  warehouse_id,
  location_id,
  sku_id,
  total_pack_qty,
  total_piece_qty,
  reserved_pack_qty,
  reserved_piece_qty,
  production_date,
  expiry_date,
  lot_no
) VALUES (
  'WH01',
  'A-01-01-01',
  'YOUR-SKU-ID',
  10,
  100,
  0,
  0,
  '2024-12-01',
  '2025-12-01',
  'LOT-001'
);
```

#### 1.5 Dispatch Location
ต้องมี Dispatch location

```sql
-- ตรวจสอบ Dispatch location
SELECT * FROM master_location
WHERE location_code = 'Dispatch'
  AND warehouse_id = 'WH01';

-- ถ้าไม่มี ให้เพิ่ม
INSERT INTO master_location (location_id, location_code, zone, warehouse_id, active_status)
VALUES ('Dispatch', 'Dispatch', 'Dispatch', 'WH01', 'active');
```

#### 1.6 Master Employee
ต้องมีข้อมูลพนักงาน

```sql
-- ตรวจสอบพนักงาน
SELECT employee_id, first_name, last_name, nickname
FROM master_employee
WHERE active_status = 'active';

-- ถ้าไม่มี ให้เพิ่ม
INSERT INTO master_employee (employee_id, first_name, last_name, nickname, active_status)
VALUES 
  (1, 'สมชาย', 'ใจดี', 'ชาย', 'active'),
  (2, 'สมหญิง', 'รักงาน', 'หญิง', 'active');
```

---

## 📋 Test Case 1: สร้าง Face Sheet และจองสต็อค

### ขั้นตอนที่ 1: เตรียมข้อมูล

```sql
-- 1. ตรวจสอบ SKU ที่จะใช้ทดสอบ
SELECT 
  sku_id,
  sku_name,
  default_location,
  qty_per_pack
FROM master_sku
WHERE sku_id = 'TEST-SKU-001';

-- 2. ตรวจสอบ preparation area
SELECT * FROM preparation_area
WHERE area_code = (
  SELECT default_location FROM master_sku WHERE sku_id = 'TEST-SKU-001'
);

-- 3. ตรวจสอบสต็อคก่อนสร้าง face sheet
SELECT 
  b.balance_id,
  l.location_code,
  b.total_piece_qty,
  b.reserved_piece_qty,
  b.total_piece_qty - b.reserved_piece_qty AS available_qty,
  b.production_date,
  b.expiry_date,
  b.lot_no
FROM wms_inventory_balances b
JOIN master_location l ON b.location_id = l.location_id
WHERE b.sku_id = 'TEST-SKU-001'
  AND b.warehouse_id = 'WH01'
  AND l.zone = (
    SELECT zone FROM preparation_area 
    WHERE area_code = (
      SELECT default_location FROM master_sku WHERE sku_id = 'TEST-SKU-001'
    )
  )
ORDER BY b.expiry_date ASC NULLS LAST, b.production_date ASC NULLS LAST;
```

### ขั้นตอนที่ 2: สร้าง Face Sheet

```bash
# ผ่าน UI
1. ไปที่หน้า /receiving/picklists/face-sheets
2. คลิก "สร้างใบปะหน้าสินค้า"
3. เลือกวันส่งของ
4. เลือกออเดอร์ที่ต้องการ
5. คลิก "สร้างใบปะหน้าสินค้า"

# หรือผ่าน API
POST /api/face-sheets/generate
{
  "warehouse_id": "WH01",
  "created_by": "System",
  "delivery_date": "2024-12-15",
  "order_ids": [1, 2, 3]
}
```

### ขั้นตอนที่ 3: ตรวจสอบผลลัพธ์

```sql
-- 1. ตรวจสอบว่า face sheet ถูกสร้าง
SELECT * FROM face_sheets
WHERE face_sheet_no = 'FS-20241201-001'
ORDER BY created_at DESC
LIMIT 1;

-- 2. ตรวจสอบ face_sheet_items
SELECT 
  fsi.id,
  fsi.sku_id,
  fsi.product_name,
  fsi.quantity,
  fsi.quantity_to_pick,
  fsi.source_location_id,
  fsi.status
FROM face_sheet_items fsi
WHERE fsi.face_sheet_id = (
  SELECT id FROM face_sheets 
  WHERE face_sheet_no = 'FS-20241201-001'
);

-- 3. ตรวจสอบการจองสต็อค
SELECT 
  r.reservation_id,
  r.face_sheet_item_id,
  r.balance_id,
  r.reserved_piece_qty,
  r.reserved_pack_qty,
  r.status,
  b.location_id,
  l.location_code,
  b.production_date,
  b.expiry_date
FROM face_sheet_item_reservations r
JOIN wms_inventory_balances b ON r.balance_id = b.balance_id
JOIN master_location l ON b.location_id = l.location_id
WHERE r.face_sheet_item_id IN (
  SELECT id FROM face_sheet_items 
  WHERE face_sheet_id = (
    SELECT id FROM face_sheets 
    WHERE face_sheet_no = 'FS-20241201-001'
  )
)
ORDER BY r.reservation_id;

-- 4. ตรวจสอบว่า reserved_piece_qty เพิ่มขึ้น
SELECT 
  b.balance_id,
  l.location_code,
  b.total_piece_qty,
  b.reserved_piece_qty,
  b.total_piece_qty - b.reserved_piece_qty AS available_qty
FROM wms_inventory_balances b
JOIN master_location l ON b.location_id = l.location_id
WHERE b.sku_id = 'TEST-SKU-001'
  AND b.warehouse_id = 'WH01'
ORDER BY b.expiry_date ASC NULLS LAST;
```

### ผลลัพธ์ที่คาดหวัง:
- ✅ Face sheet ถูกสร้างด้วย status = 'generated'
- ✅ Face sheet items มี sku_id, source_location_id, quantity_to_pick
- ✅ มีการสร้าง reservations ใน face_sheet_item_reservations
- ✅ reserved_piece_qty ใน wms_inventory_balances เพิ่มขึ้น
- ✅ การจองใช้ FEFO/FIFO (เรียงตาม expiry_date, production_date)

---

## 📋 Test Case 2: หยิบสินค้า (Mobile Pick)

### ขั้นตอนที่ 1: เข้าหน้า Mobile Pick

```bash
# เปิดหน้า mobile pick
/mobile/face-sheet/[face_sheet_id]

# หรือสแกน QR Code จากใบปะหน้า
```

### ขั้นตอนที่ 2: ตรวจสอบสต็อคก่อนหยิบ

```sql
-- 1. ตรวจสอบสต็อคที่ Preparation Area
SELECT 
  l.location_code,
  b.total_piece_qty,
  b.reserved_piece_qty,
  b.production_date,
  b.expiry_date,
  b.lot_no
FROM wms_inventory_balances b
JOIN master_location l ON b.location_id = l.location_id
WHERE b.sku_id = 'TEST-SKU-001'
  AND l.zone = 'Picking Zone A'
  AND b.warehouse_id = 'WH01';

-- 2. ตรวจสอบสต็อคที่ Dispatch
SELECT 
  total_piece_qty,
  reserved_piece_qty,
  production_date,
  expiry_date,
  lot_no
FROM wms_inventory_balances
WHERE sku_id = 'TEST-SKU-001'
  AND location_id = (
    SELECT location_id FROM master_location 
    WHERE location_code = 'Dispatch' AND warehouse_id = 'WH01'
  );
```

### ขั้นตอนที่ 3: หยิบสินค้า

```bash
# ผ่าน UI
1. คลิก "ยืนยันการหยิบทั้งหมด"
2. เลือกพนักงานเช็คและจัดสินค้า
3. คลิก "ยืนยัน"

# หรือผ่าน API
POST /api/mobile/face-sheet/scan
{
  "face_sheet_id": 123,
  "item_id": 456,
  "quantity_picked": 10,
  "scanned_code": "FS-20241201-001",
  "checker_ids": [1, 2],
  "picker_ids": [3, 4]
}
```

### ขั้นตอนที่ 4: ตรวจสอบผลลัพธ์

```sql
-- 1. ตรวจสอบสถานะ face_sheet_item
SELECT 
  id,
  sku_id,
  quantity_to_pick,
  quantity_picked,
  status,
  picked_at
FROM face_sheet_items
WHERE face_sheet_id = (
  SELECT id FROM face_sheets 
  WHERE face_sheet_no = 'FS-20241201-001'
);

-- 2. ตรวจสอบสถานะ reservation
SELECT 
  reservation_id,
  balance_id,
  reserved_piece_qty,
  status,
  picked_at
FROM face_sheet_item_reservations
WHERE face_sheet_item_id IN (
  SELECT id FROM face_sheet_items 
  WHERE face_sheet_id = (
    SELECT id FROM face_sheets 
    WHERE face_sheet_no = 'FS-20241201-001'
  )
);

-- 3. ตรวจสอบสต็อคที่ Preparation Area (ควรลด)
SELECT 
  l.location_code,
  b.total_piece_qty,
  b.reserved_piece_qty
FROM wms_inventory_balances b
JOIN master_location l ON b.location_id = l.location_id
WHERE b.sku_id = 'TEST-SKU-001'
  AND l.zone = 'Picking Zone A'
  AND b.warehouse_id = 'WH01';

-- 4. ตรวจสอบสต็อคที่ Dispatch (ควรเพิ่ม)
SELECT 
  total_piece_qty,
  reserved_piece_qty,
  production_date,
  expiry_date,
  lot_no
FROM wms_inventory_balances
WHERE sku_id = 'TEST-SKU-001'
  AND location_id = (
    SELECT location_id FROM master_location 
    WHERE location_code = 'Dispatch' AND warehouse_id = 'WH01'
  );

-- 5. ตรวจสอบ Ledger (ควรมี 2 records: OUT + IN)
SELECT 
  ledger_id,
  movement_at,
  transaction_type,
  direction,
  location_id,
  sku_id,
  piece_qty,
  reference_no,
  remarks
FROM wms_inventory_ledger
WHERE reference_no = 'FS-20241201-001'
  AND sku_id = 'TEST-SKU-001'
ORDER BY movement_at DESC, direction;

-- 6. ตรวจสอบข้อมูลพนักงาน
SELECT 
  face_sheet_no,
  status,
  checker_employee_ids,
  picker_employee_ids,
  picking_completed_at
FROM face_sheets
WHERE face_sheet_no = 'FS-20241201-001';
```

### ผลลัพธ์ที่คาดหวัง:
- ✅ face_sheet_item status = 'picked', quantity_picked = quantity_to_pick
- ✅ reservation status = 'picked', picked_at มีค่า
- ✅ สต็อคที่ Preparation Area ลด (total_piece_qty และ reserved_piece_qty)
- ✅ สต็อคที่ Dispatch เพิ่ม (พร้อม production_date, expiry_date, lot_no)
- ✅ Ledger มี 2 records (OUT จาก Preparation Area, IN ไปยัง Dispatch)
- ✅ face_sheet มี checker_employee_ids และ picker_employee_ids
- ✅ face_sheet status = 'completed' (ถ้าหยิบครบทุกรายการ)

---

## 📋 Test Case 3: ตรวจสอบ FEFO/FIFO Logic

### ขั้นตอนที่ 1: เตรียมข้อมูลหลายวันหมดอายุ

```sql
-- เพิ่มสต็อคหลาย lot ที่มีวันหมดอายุต่างกัน
INSERT INTO wms_inventory_balances (
  warehouse_id, location_id, sku_id,
  total_pack_qty, total_piece_qty,
  reserved_pack_qty, reserved_piece_qty,
  production_date, expiry_date, lot_no
) VALUES 
  -- Lot 1: หมดอายุเร็วที่สุด (ควรถูกจองก่อน)
  ('WH01', 'A-01-01-01', 'TEST-SKU-001', 5, 50, 0, 0, '2024-11-01', '2025-01-01', 'LOT-001'),
  -- Lot 2: หมดอายุทีหลัง
  ('WH01', 'A-01-01-02', 'TEST-SKU-001', 10, 100, 0, 0, '2024-11-15', '2025-03-01', 'LOT-002'),
  -- Lot 3: หมดอายุช้าที่สุด
  ('WH01', 'A-01-02-01', 'TEST-SKU-001', 15, 150, 0, 0, '2024-12-01', '2025-06-01', 'LOT-003');
```

### ขั้นตอนที่ 2: สร้าง Face Sheet

```bash
# สร้าง face sheet ที่ต้องการสินค้า 120 ชิ้น
# ระบบควรจอง:
# - 50 ชิ้นจาก LOT-001 (หมดอายุเร็วที่สุด)
# - 70 ชิ้นจาก LOT-002 (หมดอายุทีหลัง)
```

### ขั้นตอนที่ 3: ตรวจสอบการจอง

```sql
-- ตรวจสอบว่าจองตาม FEFO/FIFO
SELECT 
  r.reservation_id,
  r.reserved_piece_qty,
  b.lot_no,
  b.expiry_date,
  b.production_date,
  l.location_code
FROM face_sheet_item_reservations r
JOIN wms_inventory_balances b ON r.balance_id = b.balance_id
JOIN master_location l ON b.location_id = l.location_id
WHERE r.face_sheet_item_id = ?
ORDER BY r.reservation_id;
```

### ผลลัพธ์ที่คาดหวัง:
- ✅ จอง LOT-001 (50 ชิ้น) ก่อน (expiry_date เร็วที่สุด)
- ✅ จอง LOT-002 (70 ชิ้น) ทีหลัง
- ✅ ไม่จอง LOT-003 (เพราะมีสต็อคพอแล้ว)

---

## 🚨 Common Issues & Solutions

### Issue 1: ไม่มีการจองสต็อค
**สาเหตุ:**
- SKU ไม่มี default_location
- Preparation area ไม่มี zone
- ไม่มี location ใน zone

**วิธีแก้:**
```sql
-- ตรวจสอบและแก้ไข
SELECT sku_id, default_location FROM master_sku WHERE sku_id = 'YOUR-SKU';
SELECT * FROM preparation_area WHERE area_code = 'PK001';
SELECT * FROM master_location WHERE zone = 'Picking Zone A';
```

### Issue 2: Insufficient stock error
**สาเหตุ:**
- สต็อคไม่พอ
- สต็อคถูกจองไปแล้ว

**วิธีแก้:**
```sql
-- ตรวจสอบสต็อคที่ใช้ได้
SELECT 
  sku_id,
  SUM(total_piece_qty - reserved_piece_qty) AS available_qty
FROM wms_inventory_balances b
JOIN master_location l ON b.location_id = l.location_id
WHERE sku_id = 'YOUR-SKU'
  AND l.zone = 'Picking Zone A'
GROUP BY sku_id;
```

### Issue 3: ไม่มีข้อมูลพนักงาน
**สาเหตุ:**
- ไม่ได้เลือกพนักงานตอนหยิบ
- Employee IDs ไม่ถูกต้อง

**วิธีแก้:**
```sql
-- ตรวจสอบพนักงาน
SELECT * FROM master_employee WHERE active_status = 'active';
```

---

## ✅ Checklist การทดสอบ

### Pre-Test Setup
- [ ] มี master_sku.default_location สำหรับทุก SKU
- [ ] มี preparation_area และ zone
- [ ] มี master_location ใน zone
- [ ] มีสต็อคใน preparation area
- [ ] มี Dispatch location
- [ ] มี master_employee

### Test Case 1: Stock Reservation
- [ ] สร้าง face sheet สำเร็จ
- [ ] มีการสร้าง face_sheet_item_reservations
- [ ] reserved_piece_qty เพิ่มขึ้น
- [ ] การจองใช้ FEFO/FIFO

### Test Case 2: Stock Movement
- [ ] หยิบสินค้าสำเร็จ
- [ ] สต็อคที่ Preparation Area ลด
- [ ] สต็อคที่ Dispatch เพิ่ม
- [ ] วันผลิต/วันหมดอายุถูก copy
- [ ] Ledger มี OUT + IN records
- [ ] บันทึกข้อมูลพนักงาน

### Test Case 3: UI Display
- [ ] หน้า face sheets list แสดงคอลัมพนักงาน
- [ ] หน้า mobile pick แสดงรายการสินค้า
- [ ] Employee selection modal ทำงาน

---

## 📞 Support

หากพบปัญหาในการทดสอบ:
1. ตรวจสอบ logs ใน browser console
2. ตรวจสอบ Supabase logs
3. ตรวจสอบ database ตาม SQL queries ด้านบน
4. ดูเอกสาร `FACE_SHEET_STOCK_RESERVATION_COMPLETE.md`
