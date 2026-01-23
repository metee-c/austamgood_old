# คำแนะนำ: ตรวจสอบและแก้ไขปัญหาสินค้าพรีเมี่ยมที่ไม่มีพาเลทไอดี

## ปัญหา
สินค้าพรีเมี่ยมที่นำเข้าผ่านหน้า Stock Import มีพาเลทไอดีในไฟล์ Excel แต่ในระบบไม่มีพาเลทไอดี

## วิธีตรวจสอบ

### 1. รัน SQL Script เพื่อตรวจสอบข้อมูล
```bash
# เปิด Supabase SQL Editor
# ไปที่ https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new
# หรือใช้ psql
psql -h YOUR_HOST -U YOUR_USER -d YOUR_DATABASE -f check_missing_pallet_ids.sql
```

### 2. ตรวจสอบผลลัพธ์

**Query 1: สินค้าพรีเมี่ยมที่ไม่มี pallet_id**
- แสดงรายการสินค้าพรีเมี่ยมทั้งหมดที่ `pallet_id IS NULL`
- ดูว่ามีกี่รายการ และอยู่โลเคชั่นไหน

**Query 2: ประวัติการเคลื่อนไหว**
- ตรวจสอบว่ามีการเคลื่อนไหวสินค้าที่ไม่มี pallet_id หรือไม่
- ดู transaction_type ว่าเป็น move, transfer, adjustment, etc.

**Query 3: ข้อมูลการนำเข้า**
- ตรวจสอบว่าตอนนำเข้ามี `pallet_id_external` หรือไม่
- ดูว่าข้อมูลใน `stock_import_staging` มีพาเลทไอดีหรือไม่

**Query 4: เปรียบเทียบข้อมูล**
- เปรียบเทียบระหว่างข้อมูลที่นำเข้ากับข้อมูลในระบบ
- หาว่าพาเลทไอดีหายไปตอนไหน

**Query 5: การย้ายสินค้า**
- ตรวจสอบว่ามีการย้ายสินค้าหลังจากนำเข้าหรือไม่
- ดูว่าการย้ายทำให้พาเลทไอดีหายไปหรือไม่

**Query 6: สรุปสถิติ**
- สรุปจำนวนสินค้าพรีเมี่ยมที่มีและไม่มีพาเลทไอดี

## สาเหตุที่เป็นไปได้

### 1. ไฟล์ Excel ที่นำเข้าไม่มีคอลัมน์ Pallet_ID
- ตรวจสอบว่าไฟล์ Excel มีคอลัมน์ `Pallet_ID` หรือไม่
- ตรวจสอบว่าคอลัมน์นี้มีค่าหรือเป็นค่าว่าง

### 2. การย้ายสินค้าทำให้พาเลทไอดีหายไป
จากโค้ดใน `lib/database/move.ts` พบว่า:
- เมื่อมีการย้ายสินค้า (move/transfer) ระบบจะสร้าง ledger entry ใหม่
- ถ้าไม่ระบุ `pallet_id` ในการย้าย จะเป็น `null`
- ถ้ามีการย้ายแบบ partial move อาจสร้าง `new_pallet_id` ใหม่

### 3. การ Adjust สต็อกไม่ระบุพาเลทไอดี
- การปรับสต็อก (Stock Adjustment) อาจไม่ได้ระบุ `pallet_id`
- ทำให้สินค้าที่ปรับมี `pallet_id = null`

### 4. การนำเข้าข้อมูลผิดพลาด
- ระบบอ่านคอลัมน์ `Pallet_ID` จากไฟล์ Excel
- แต่ถ้าชื่อคอลัมน์ไม่ตรง (เช่น `pallet_id`, `PALLET_ID`) จะไม่ถูกอ่าน
- ต้องตรวจสอบว่าชื่อคอลัมน์ตรงกับที่โค้ดกำหนดไว้

## วิธีแก้ไข

### วิธีที่ 1: อัปเดตพาเลทไอดีจากข้อมูลการนำเข้า
```sql
-- อัปเดตพาเลทไอดีจากข้อมูลการนำเข้าล่าสุด
UPDATE wms_inventory_balances b
SET pallet_id = sis.pallet_id_external,
    updated_at = NOW()
FROM stock_import_staging sis
JOIN master_sku s ON sis.sku_id = s.sku_id
WHERE b.sku_id = sis.sku_id
  AND b.location_id = sis.location_code
  AND b.pallet_id IS NULL
  AND sis.pallet_id_external IS NOT NULL
  AND s.sku_name LIKE '%พรีเมี่ยม%'
  AND sis.validation_status = 'valid';
```

### วิธีที่ 2: อัปเดตพาเลทไอดีจากประวัติการเคลื่อนไหว
```sql
-- อัปเดตพาเลทไอดีจากประวัติการเคลื่อนไหวล่าสุด
WITH latest_ledger AS (
  SELECT DISTINCT ON (sku_id, location_id)
    sku_id,
    location_id,
    pallet_id
  FROM wms_inventory_ledger
  WHERE pallet_id IS NOT NULL
  ORDER BY sku_id, location_id, created_at DESC
)
UPDATE wms_inventory_balances b
SET pallet_id = ll.pallet_id,
    updated_at = NOW()
FROM latest_ledger ll
JOIN master_sku s ON ll.sku_id = s.sku_id
WHERE b.sku_id = ll.sku_id
  AND b.location_id = ll.location_id
  AND b.pallet_id IS NULL
  AND s.sku_name LIKE '%พรีเมี่ยม%';
```

### วิธีที่ 3: สร้างพาเลทไอดีใหม่
```sql
-- สร้างพาเลทไอดีใหม่สำหรับสินค้าที่ไม่มี
UPDATE wms_inventory_balances b
SET pallet_id = 'ATG' || TO_CHAR(NOW(), 'YYYYMMDD') || LPAD(b.balance_id::TEXT, 9, '0'),
    updated_at = NOW()
FROM master_sku s
WHERE b.sku_id = s.sku_id
  AND b.pallet_id IS NULL
  AND b.total_piece_qty > 0
  AND s.sku_name LIKE '%พรีเมี่ยม%';
```

## ป้องกันปัญหาในอนาคต

### 1. ตรวจสอบไฟล์ Excel ก่อนนำเข้า
- ตรวจสอบว่ามีคอลัมน์ `Pallet_ID` และมีค่า
- ตรวจสอบว่าชื่อคอลัมน์ตรงกับที่ระบบกำหนด

### 2. เพิ่มการตรวจสอบในโค้ด
- เพิ่มการแจ้งเตือนเมื่อนำเข้าสินค้าที่ไม่มีพาเลทไอดี
- เพิ่มการบังคับให้ระบุพาเลทไอดีสำหรับสินค้าบางประเภท

### 3. ตรวจสอบการย้ายสินค้า
- ตรวจสอบว่าการย้ายสินค้ารักษาพาเลทไอดีไว้
- ถ้าเป็น partial move ให้สร้าง `new_pallet_id` ใหม่

## ติดต่อสอบถาม
หากพบปัญหาหรือต้องการความช่วยเหลือ กรุณาติดต่อทีม IT
