# Inventory Balance Sync - คู่มือการแก้ปัญหา

## ปัญหาที่พบ

ข้อมูลแสดงใน `wms_inventory_ledger` (บันทึกธุรกรรม) แต่ไม่แสดงใน `wms_inventory_balances` (ยอดคงเหลือ)

## สาเหตุ

ระบบไม่มี trigger ที่ทำหน้าที่ sync ข้อมูลจาก ledger ไปยัง balances อัตโนมัติ

## วิธีแก้ไข

### วิธีที่ 1: ใช้ Supabase CLI (แนะนำ)

```bash
# 1. Apply trigger migration
supabase db push

# หรือรัน migration แยก
supabase migration up
```

### วิธีที่ 2: รันผ่าน SQL Editor ใน Supabase Dashboard

1. เปิด Supabase Dashboard
2. ไปที่ SQL Editor
3. รัน migration file ตามลำดับ:

#### ขั้นตอนที่ 1: สร้าง Trigger (004_add_inventory_balance_sync_trigger.sql)

```sql
-- Copy และ paste เนื้อหาจากไฟล์ 
-- supabase/migrations/004_add_inventory_balance_sync_trigger.sql
```

#### ขั้นตอนที่ 2: Sync ข้อมูลย้อนหลัง (005_sync_existing_ledger_to_balance.sql)

```sql
-- Copy และ paste เนื้อหาจากไฟล์
-- supabase/migrations/005_sync_existing_ledger_to_balance.sql
```

### วิธีที่ 3: ใช้ TypeScript Script

```bash
# ตั้งค่า environment variables
export NEXT_PUBLIC_SUPABASE_URL="your-supabase-url"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# รัน script
npx tsx scripts/sync-inventory-balances.ts
```

## การทำงานของ Trigger

หลังจากติดตั้ง trigger แล้ว:

1. **เมื่อมีการ INSERT ข้อมูลใหม่ใน `wms_inventory_ledger`**
   - Trigger จะทำงานอัตโนมัติ
   - ตรวจสอบว่ามี balance record อยู่แล้วหรือไม่
   - ถ้ามี: อัพเดทยอดคงเหลือ
   - ถ้าไม่มี: สร้าง balance record ใหม่

2. **การคำนวณยอดคงเหลือ**
   - `direction = 'in'`: เพิ่มยอด (+)
   - `direction = 'out'`: ลดยอด (-)

3. **Unique Key สำหรับ Balance**
   - warehouse_id
   - location_id
   - sku_id
   - pallet_id
   - pallet_id_external
   - production_date
   - expiry_date

## การตรวจสอบผลลัพธ์

### ตรวจสอบจำนวนข้อมูล

```sql
-- นับจำนวน ledger entries
SELECT COUNT(*) as ledger_count FROM wms_inventory_ledger;

-- นับจำนวน balance records
SELECT COUNT(*) as balance_count FROM wms_inventory_balances;

-- ดูยอดคงเหลือตาม location
SELECT 
    warehouse_id,
    location_id,
    sku_id,
    total_pack_qty,
    total_piece_qty,
    last_movement_at
FROM wms_inventory_balances
WHERE location_id = 'WH001-02639'
ORDER BY last_movement_at DESC;
```

### ตรวจสอบความถูกต้องของยอด

```sql
-- เปรียบเทียบยอดจาก ledger กับ balance
WITH ledger_summary AS (
    SELECT 
        warehouse_id,
        location_id,
        sku_id,
        pallet_id_external,
        SUM(CASE WHEN direction = 'in' THEN pack_qty ELSE -pack_qty END) as calc_pack_qty,
        SUM(CASE WHEN direction = 'in' THEN piece_qty ELSE -piece_qty END) as calc_piece_qty
    FROM wms_inventory_ledger
    GROUP BY warehouse_id, location_id, sku_id, pallet_id_external
)
SELECT 
    l.warehouse_id,
    l.location_id,
    l.sku_id,
    l.calc_pack_qty as ledger_pack_qty,
    b.total_pack_qty as balance_pack_qty,
    l.calc_piece_qty as ledger_piece_qty,
    b.total_piece_qty as balance_piece_qty,
    CASE 
        WHEN l.calc_pack_qty = b.total_pack_qty 
         AND l.calc_piece_qty = b.total_piece_qty 
        THEN '✅ ตรงกัน'
        ELSE '❌ ไม่ตรงกัน'
    END as status
FROM ledger_summary l
LEFT JOIN wms_inventory_balances b 
    ON l.warehouse_id = b.warehouse_id
    AND COALESCE(l.location_id, '') = COALESCE(b.location_id, '')
    AND l.sku_id = b.sku_id
    AND COALESCE(l.pallet_id_external, '') = COALESCE(b.pallet_id_external, '')
ORDER BY l.warehouse_id, l.location_id, l.sku_id;
```

## Troubleshooting

### ปัญหา: Balance ยังไม่อัพเดท

1. ตรวจสอบว่า trigger ถูกสร้างแล้ว:
```sql
SELECT * FROM pg_trigger WHERE tgname = 'trg_sync_inventory_ledger_to_balance';
```

2. ตรวจสอบ function:
```sql
SELECT proname FROM pg_proc WHERE proname = 'sync_inventory_ledger_to_balance';
```

### ปัญหา: ยอดไม่ตรงกัน

รัน sync script อีกครั้ง หรือ rebuild balances:

```sql
-- Clear และ rebuild
TRUNCATE TABLE wms_inventory_balances RESTART IDENTITY CASCADE;

-- จากนั้นรัน migration 005 อีกครั้ง
```

## หมายเหตุสำคัญ

⚠️ **ข้อควรระวัง:**
- Migration 005 จะ sync ข้อมูลย้อนหลังทั้งหมด
- ถ้ามีข้อมูลใน balances อยู่แล้ว อาจต้อง clear ก่อน
- Trigger จะทำงานเฉพาะกับข้อมูลใหม่ที่เพิ่มหลังจากติดตั้ง trigger

✅ **ข้อดี:**
- อัตโนมัติ: ไม่ต้องอัพเดท balance ด้วยตัวเอง
- Real-time: Balance อัพเดททันทีที่มี transaction ใหม่
- Consistent: ยอดคงเหลือตรงกับ ledger เสมอ
