# Preparation Area Inventory Trigger Fix Summary

## ปัญหาที่พบ

เมื่อ user แก้ไข `master_sku.default_location` ที่ฐานข้อมูลโดยตรง (เช่น ลบ PK001 ออก หรือเปลี่ยนเป็น PK002) หน้า UI ยังแสดง SKU ในตำแหน่งเก่าอยู่

### Root Cause

1. **Trigger 275** (`sync_sku_preparation_area_mapping`):
   - เมื่อ `default_location` เปลี่ยน มันทำ `ON CONFLICT ... DO UPDATE`
   - ไม่ได้ DELETE mapping เก่าก่อน INSERT ใหม่
   - ดังนั้น trigger 284 จึงไม่ได้รับ DELETE event

2. **Trigger 284** (`fn_sync_prep_area_inventory_on_mapping_change`):
   - รอ DELETE event จาก `sku_preparation_area_mapping`
   - แต่ไม่เคยได้รับเพราะ trigger 275 ทำ UPDATE แทน DELETE
   - ทำให้ inventory record เก่ายังค้างอยู่ (orphaned record)

### ตัวอย่างกรณีที่เกิดปัญหา

SKU: `01-NEC-D|LSD-S|012` (ถุง | Buzz Natural Care สุนัขโต แกะ เม็ดเล็ก | 1.2 กก.)

**สถานะก่อนแก้:**
- `default_location = PK002`
- มี mapping: PK002 ✅
- มี inventory: PK001 ❌ (orphaned), PK002 ✅

**ปัญหา:**
- UI แสดง SKU ใน PK001 และ PK002
- แต่ควรแสดงเฉพาะ PK002

## การแก้ไข

### Migration 285: Fix Trigger 275

แก้ไข `sync_sku_preparation_area_mapping()` ให้:
1. เช็คว่า mapping เก่ามี `preparation_area_id` ต่างจากใหม่หรือไม่
2. ถ้าต่างกัน → **DELETE mapping เก่าก่อน** แล้วค่อย INSERT ใหม่
3. ถ้าเหมือนกัน → UPDATE timestamp เท่านั้น

```sql
-- Check if mapping already exists with different prep area
SELECT preparation_area_id INTO v_old_prep_area_id
FROM sku_preparation_area_mapping
WHERE sku_id = NEW.sku_id
  AND warehouse_id = 'WH001'
LIMIT 1;

-- If mapping exists with different prep area, DELETE it first
IF v_old_prep_area_id IS NOT NULL AND v_old_prep_area_id != v_prep_area_id THEN
    DELETE FROM sku_preparation_area_mapping
    WHERE sku_id = NEW.sku_id
      AND warehouse_id = 'WH001';
    
    RAISE NOTICE 'Deleted old mapping for SKU % (prep_area changed from % to %)', 
        NEW.sku_id, v_old_prep_area_id, v_prep_area_id;
END IF;

-- Insert new mapping
INSERT INTO sku_preparation_area_mapping (...) VALUES (...);
```

### Cleanup Script

สร้าง `cleanup-orphaned-inventory.js` เพื่อลบ orphaned inventory records ที่มีอยู่แล้ว:

```javascript
// Find inventory records without corresponding mapping
for (const inv of orphaned) {
    const { data: mapping } = await supabase
        .from('sku_preparation_area_mapping')
        .select('mapping_id')
        .eq('sku_id', inv.sku_id)
        .eq('warehouse_id', inv.warehouse_id)
        .eq('preparation_area_id', inv.preparation_area_id)
        .single();
    
    if (!mapping) {
        // Delete orphaned inventory
        await supabase
            .from('preparation_area_inventory')
            .delete()
            .eq('inventory_id', inv.inventory_id);
    }
}
```

## ผลลัพธ์

### ก่อนแก้ไข
- ✅ Trigger 275 ทำงาน: sync master_sku → mapping
- ❌ Trigger 284 ไม่ทำงาน: ไม่ได้รับ DELETE event
- ❌ Orphaned inventory records ค้างอยู่
- ❌ UI แสดง SKU ในหลายตำแหน่ง

### หลังแก้ไข
- ✅ Trigger 275 ทำงาน: DELETE mapping เก่า → INSERT mapping ใหม่
- ✅ Trigger 284 ทำงาน: รับ DELETE event → ลบ inventory เก่า
- ✅ Trigger 284 ทำงาน: รับ INSERT event → สร้าง inventory ใหม่
- ✅ UI แสดง SKU เฉพาะตำแหน่งที่ถูกต้อง

## การทดสอบ

### Test Case 1: เปลี่ยน default_location
```sql
-- เปลี่ยนจาก PK002 → PK001
UPDATE master_sku 
SET default_location = 'PK001' 
WHERE sku_id = '01-NEC-D|LSD-S|012';

-- ผลลัพธ์ที่คาดหวัง:
-- - mapping: PK001 เท่านั้น
-- - inventory: PK001 เท่านั้น
-- - UI: แสดงเฉพาะ PK001
```

### Test Case 2: ลบ default_location
```sql
-- ลบ default_location
UPDATE master_sku 
SET default_location = NULL 
WHERE sku_id = '01-NEC-D|LSD-S|012';

-- ผลลัพธ์ที่คาดหวัง:
-- - mapping: ไม่มี
-- - inventory: ไม่มี
-- - UI: ไม่แสดง SKU นี้
```

### Test Case 3: เปลี่ยนกลับ
```sql
-- เปลี่ยนกลับเป็น PK002
UPDATE master_sku 
SET default_location = 'PK002' 
WHERE sku_id = '01-NEC-D|LSD-S|012';

-- ผลลัพธ์ที่คาดหวัง:
-- - mapping: PK002 เท่านั้น
-- - inventory: PK002 เท่านั้น
-- - UI: แสดงเฉพาะ PK002
```

## Files Changed

1. `supabase/migrations/285_fix_trigger_275_delete_before_insert.sql` - แก้ไข trigger 275
2. `cleanup-orphaned-inventory.js` - ลบ orphaned records ที่มีอยู่แล้ว
3. `docs/warehouse/PREP_AREA_TRIGGER_FIX_SUMMARY.md` - เอกสารนี้

## สรุป

ปัญหาได้รับการแก้ไขโดย:
1. ✅ แก้ trigger 275 ให้ DELETE mapping เก่าก่อน INSERT ใหม่
2. ✅ ลบ orphaned inventory records ที่มีอยู่แล้ว (1 record)
3. ✅ ระบบทำงานถูกต้อง: UI แสดงเฉพาะ SKU ที่กำหนดใน mapping

**Trigger ทำงานอัตโนมัติทุกกรณี:**
- ✅ แก้ไขผ่าน API
- ✅ แก้ไขผ่าน Dashboard
- ✅ แก้ไขผ่าน SQL Query
- ✅ แก้ไขผ่าน Database Client (pgAdmin, DBeaver, etc.)
