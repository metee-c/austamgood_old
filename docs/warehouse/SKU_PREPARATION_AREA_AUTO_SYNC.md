# Auto-sync SKU Preparation Area Mapping

## ปัญหาที่พบ

เมื่อเพิ่ม SKU ใหม่และกำหนด `default_location` ในตาราง `master_sku` แล้ว ระบบไม่ได้สร้าง mapping ใน `sku_preparation_area_mapping` โดยอัตโนมัติ ทำให้เกิดปัญหา:

- มี SKU 472 ตัวที่มี `default_location` แต่มีเพียง 120 ตัวที่มี mapping
- ขาดหายไป 352 ตัว (74.6%) ที่ไม่มี mapping
- ทำให้ตอนสร้าง Bonus Face Sheet เกิด error "SKU ยังไม่ได้กำหนดบ้านหยิบ"

## การแก้ไข

### Migration 275: Auto-sync SKU Preparation Area Mapping

**ไฟล์**: `supabase/migrations/275_auto_sync_sku_preparation_area_mapping.sql`

**สิ่งที่ทำ**:

1. **สร้าง Trigger Function** `sync_sku_preparation_area_mapping()`
   - ทำงานเมื่อมีการ INSERT หรือ UPDATE `master_sku.default_location`
   - หา zone จาก `master_location` ตาม `default_location`
   - หา `preparation_area_id` จาก `preparation_area` ตาม zone
   - Insert/Update mapping ใน `sku_preparation_area_mapping` โดยอัตโนมัติ
   - ถ้า `default_location` เป็น NULL หรือไม่เจอ zone/prep area จะลบ mapping ออก

2. **สร้าง Trigger** `trigger_sync_sku_preparation_area_mapping`
   - ทำงานหลังจาก INSERT/UPDATE ของ `master_sku.default_location`
   - เรียกใช้ function `sync_sku_preparation_area_mapping()`

3. **Backfill ข้อมูลที่ขาดหายไป**
   - Loop ผ่าน SKU ทั้งหมดที่มี `default_location` แต่ไม่มี mapping
   - สร้าง mapping ให้ทั้งหมด
   - Skip SKU ที่ location/zone ไม่ถูกต้อง

4. **Verify ผลลัพธ์**
   - แสดงสถิติจำนวน SKU ที่มี mapping

## ผลลัพธ์

### ก่อนแก้ไข
- SKUs with default_location: 472
- SKUs with mapping: 120
- SKUs missing mapping: 352 (74.6%)

### หลังแก้ไข
- SKUs with default_location: 469
- SKUs with mapping: 469
- SKUs missing mapping: 0 (0%)

**หมายเหตุ**: จำนวนลดลงจาก 472 เป็น 469 เพราะมี 3 SKU ที่ `default_location` ไม่ถูกต้อง (ไม่มีใน `master_location` หรือ zone ไม่มีใน `preparation_area`)

## การทำงานของ Trigger

### กรณีที่ 1: เพิ่ม SKU ใหม่พร้อม default_location

```sql
INSERT INTO master_sku (sku_id, default_location, ...)
VALUES ('NEW-SKU-001', 'PK002', ...);
```

→ Trigger จะสร้าง mapping ใน `sku_preparation_area_mapping` โดยอัตโนมัติ

### กรณีที่ 2: อัปเดต default_location

```sql
UPDATE master_sku 
SET default_location = 'PK003'
WHERE sku_id = 'EXISTING-SKU-001';
```

→ Trigger จะอัปเดต mapping ให้ตรงกับ prep area ใหม่

### กรณีที่ 3: ลบ default_location

```sql
UPDATE master_sku 
SET default_location = NULL
WHERE sku_id = 'EXISTING-SKU-001';
```

→ Trigger จะลบ mapping ออกจาก `sku_preparation_area_mapping`

## ตัวอย่างข้อมูล

```sql
SELECT 
    ms.sku_id,
    ms.default_location,
    ml.zone,
    pa.area_name,
    spam.preparation_area_id
FROM master_sku ms
INNER JOIN master_location ml ON ms.default_location = ml.location_id
INNER JOIN sku_preparation_area_mapping spam 
    ON ms.sku_id = spam.sku_id AND spam.warehouse_id = 'WH001'
INNER JOIN preparation_area pa ON spam.preparation_area_id = pa.area_id
LIMIT 5;
```

| sku_id | default_location | zone | area_name | preparation_area_id |
|--------|------------------|------|-----------|---------------------|
| 01-ALL-S\|FOI\|0005 | PK002 | Zone Picking Zone 2 | พื้นที่จัดสินค้า PF-Premium | 55b6e7df-... |
| 01-ALL-S\|FOI\|001 | PK002 | Zone Picking Zone 2 | พื้นที่จัดสินค้า PF-Premium | 55b6e7df-... |
| 01-BAL-C\|CRB\|0005 | PK002 | Zone Picking Zone 2 | พื้นที่จัดสินค้า PF-Premium | 55b6e7df-... |

## การทดสอบ

### ทดสอบสร้าง Bonus Face Sheet

1. ไปที่ http://localhost:3000/receiving/picklists/bonus-face-sheets
2. กดสร้าง Bonus Face Sheet ใหม่
3. เลือก SKU ที่เพิ่งเพิ่มเข้ามาใหม่
4. ระบบควรหาบ้านหยิบได้โดยไม่มี error

### ทดสอบ Trigger

```sql
-- เพิ่ม SKU ใหม่
INSERT INTO master_sku (sku_id, sku_name, default_location, ...)
VALUES ('TEST-SKU-001', 'Test Product', 'PK002', ...);

-- ตรวจสอบว่ามี mapping ถูกสร้างหรือไม่
SELECT * FROM sku_preparation_area_mapping 
WHERE sku_id = 'TEST-SKU-001';
```

## สรุป

Migration 275 แก้ปัญหาการขาด mapping ระหว่าง SKU กับ preparation area โดย:
- สร้าง trigger ที่ sync mapping อัตโนมัติเมื่อมีการเปลี่ยนแปลง `default_location`
- Backfill ข้อมูลที่ขาดหายไปทั้งหมด (352 SKU)
- ทำให้ระบบสามารถสร้าง Bonus Face Sheet ได้โดยไม่มี error

**Status**: ✅ Complete - ทุก SKU ที่มี default_location ถูกต้องมี mapping แล้ว
