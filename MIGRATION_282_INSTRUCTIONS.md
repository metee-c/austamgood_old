# Migration 282: Add Location Validation to Prep Area Inventory

## วิธีรัน Migration

เนื่องจาก Supabase CLI มีปัญหากับ .env.local file และ Supabase JS client ไม่มี function สำหรับรัน raw SQL
ต้องรัน migration ผ่าน **Supabase Dashboard SQL Editor** โดยตรง

### ขั้นตอน:

1. **เปิด Supabase Dashboard**
   - ไปที่: https://supabase.com/dashboard/project/iwlkslewdgenckuejbit
   - เข้าสู่ระบบด้วย account ของคุณ

2. **เปิด SQL Editor**
   - คลิกที่เมนู "SQL Editor" ทางด้านซ้าย
   - คลิก "New query"

3. **Copy SQL ด้านล่างนี้ไปวางใน SQL Editor**

```sql
-- Migration 282: Add location validation to preparation area inventory
-- Purpose: Add columns to indicate if SKU is in correct location vs default_location

-- ============================================================================
-- 1. Drop and recreate view to include location validation
-- ============================================================================
DROP VIEW IF EXISTS vw_preparation_area_inventory;

CREATE VIEW vw_preparation_area_inventory AS
SELECT 
    pai.inventory_id,
    pai.warehouse_id,
    mw.warehouse_name,
    pai.preparation_area_id,
    pai.preparation_area_code,
    pa.area_name as preparation_area_name,
    pa.zone,
    pai.sku_id,
    ms.sku_name,
    ms.uom_base,
    ms.qty_per_pack,
    ms.weight_per_piece_kg,
    ms.default_location,  -- เพิ่ม default_location
    pai.latest_pallet_id,
    pai.latest_pallet_id_external,
    pai.latest_production_date,
    pai.latest_expiry_date,
    pai.latest_lot_no,
    pai.available_pack_qty,
    pai.available_piece_qty,
    pai.reserved_pack_qty,
    pai.reserved_piece_qty,
    pai.total_pack_qty,
    pai.total_piece_qty,
    pai.last_movement_at,
    pai.created_at,
    pai.updated_at,
    -- Calculated fields
    CASE 
        WHEN pai.latest_expiry_date IS NOT NULL THEN 
            (pai.latest_expiry_date - CURRENT_DATE)
        ELSE NULL 
    END as days_until_expiry,
    CASE 
        WHEN pai.latest_expiry_date IS NOT NULL AND pai.latest_expiry_date < CURRENT_DATE THEN true
        ELSE false
    END as is_expired,
    -- Location validation fields
    CASE 
        WHEN ms.default_location IS NULL THEN NULL  -- ไม่มี default_location กำหนด
        WHEN ms.default_location = pai.preparation_area_code THEN true  -- อยู่ถูกที่
        ELSE false  -- อยู่ผิดที่
    END as is_correct_location,
    CASE 
        WHEN ms.default_location IS NOT NULL AND ms.default_location != pai.preparation_area_code 
        THEN ms.default_location
        ELSE NULL
    END as expected_location
FROM preparation_area_inventory pai
INNER JOIN preparation_area pa ON pa.area_id = pai.preparation_area_id
INNER JOIN master_warehouse mw ON mw.warehouse_id = pai.warehouse_id
INNER JOIN master_sku ms ON ms.sku_id = pai.sku_id
WHERE pa.status = 'active';

COMMENT ON VIEW vw_preparation_area_inventory IS 'SKU-level aggregated view of preparation area inventory with location validation';

-- ============================================================================
-- 2. Grant permissions
-- ============================================================================
GRANT SELECT ON vw_preparation_area_inventory TO anon, authenticated;
```

4. **คลิก "Run" หรือกด Ctrl+Enter**

5. **ตรวจสอบผลลัพธ์**
   - ถ้าสำเร็จจะแสดง "Success. No rows returned"
   - ถ้ามี error ให้ copy error message มาแจ้ง

6. **ทดสอบ View**
   - รัน query นี้เพื่อทดสอบ:

```sql
SELECT 
    sku_id,
    preparation_area_code,
    default_location,
    is_correct_location,
    expected_location,
    total_piece_qty
FROM vw_preparation_area_inventory
WHERE is_correct_location = false
LIMIT 10;
```

## ผลลัพธ์ที่คาดหวัง

Migration นี้จะเพิ่ม 3 คอลัมน์ใหม่ใน view:

1. **default_location** - ตำแหน่งที่ถูกต้องของ SKU จาก master_sku
2. **is_correct_location** - `true` ถ้าสินค้าอยู่ถูกที่, `false` ถ้าอยู่ผิดที่, `null` ถ้าไม่มี default_location
3. **expected_location** - แสดงตำแหน่งที่ถูกต้องเมื่อสินค้าอยู่ผิดที่

## Next Steps หลังรัน Migration

1. **อัพเดท API endpoint** - เพิ่มฟิลด์ใหม่ใน transformation (ทำแล้ว)
2. **อัพเดท UI** - เพิ่ม warning indicator สำหรับสินค้าที่อยู่ผิดที่
3. **ทดสอบหน้า UI** ที่ http://localhost:3000/warehouse/preparation-area-inventory

## หมายเหตุ

- Migration นี้ไม่ได้เปลี่ยนแปลงข้อมูลในตาราง เพียงแค่เพิ่มคอลัมน์ใน view
- View จะคำนวณ location validation แบบ real-time จากข้อมูลปัจจุบัน
- ไม่มีผลกระทบต่อ performance เพราะเป็นการคำนวณแบบ simple CASE statement
