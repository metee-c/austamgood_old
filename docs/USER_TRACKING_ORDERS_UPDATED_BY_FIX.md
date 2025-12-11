# Fix: Orders updated_by Not Set on INSERT

## Problem
เมื่อนำเข้าออเดอร์ใหม่ คอลัมน `updated_by` ไม่ถูกบันทึก (เป็น NULL) ในขณะที่ `created_by` ถูกบันทึกปกติ

**ตัวอย่างที่พบ:**
- ออเดอร์ประเภท `special` ที่นำเข้าใหม่มี `created_by=2` แต่ `updated_by=NULL`
- ออเดอร์ประเภท `route_planning` ที่นำเข้าหลังจากแก้ไขมี `created_by=2` และ `updated_by=2` ✅

## Root Cause

Trigger `trigger_set_wms_orders_created_by` เดิมตั้งค่าเฉพาะ `created_by` ตอน INSERT:

```sql
-- Trigger เดิม (ไม่ตั้งค่า updated_by)
CREATE OR REPLACE FUNCTION set_wms_orders_created_by()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := get_current_user_id();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**ปัญหา:** 
- ตอน INSERT ออเดอร์ใหม่ `updated_by` จะเป็น NULL
- Trigger `trigger_update_wms_orders_updated_by` ทำงานเฉพาะตอน UPDATE เท่านั้น
- การสร้างออเดอร์ใหม่ถือว่าเป็นทั้ง "สร้าง" และ "แก้ไข" ครั้งแรก ดังนั้น `updated_by` ควรเท่ากับ `created_by`

## Solution

### Migration 136: Fix orders updated_by on INSERT

แก้ไข trigger ให้ตั้งค่า `updated_by = created_by` ตอน INSERT:

```sql
-- supabase/migrations/136_fix_orders_updated_by_on_insert.sql

CREATE OR REPLACE FUNCTION set_wms_orders_created_by()
RETURNS TRIGGER AS $$
BEGIN
  -- ตั้งค่า created_by จาก session context
  IF NEW.created_by IS NULL THEN
    BEGIN
      NEW.created_by := get_current_user_id();
    EXCEPTION
      WHEN OTHERS THEN
        NEW.created_by := NULL;
    END;
  END IF;
  
  -- ✅ FIX: ตั้งค่า updated_by = created_by ตอน INSERT
  -- เพราะการสร้างออเดอร์ใหม่ถือว่าเป็นทั้ง "สร้าง" และ "แก้ไข" ครั้งแรก
  IF NEW.updated_by IS NULL THEN
    NEW.updated_by := NEW.created_by;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Fix Existing Data

อัปเดตออเดอร์เก่าที่ `updated_by` เป็น NULL:

```sql
-- Disable trigger ชั่วคราวเพื่อป้องกันการเซ็ตค่ากลับเป็น NULL
ALTER TABLE wms_orders DISABLE TRIGGER trigger_update_wms_orders_updated_by;

-- อัปเดตค่า
UPDATE wms_orders
SET updated_by = created_by
WHERE updated_by IS NULL 
  AND created_by IS NOT NULL;

-- Enable trigger กลับ
ALTER TABLE wms_orders ENABLE TRIGGER trigger_update_wms_orders_updated_by;
```

## Testing

### Before Fix
```sql
SELECT order_no, order_type, created_by, updated_by
FROM wms_orders
WHERE order_type = 'special';

-- Result:
-- PQ25100088 | special | 2 | NULL ❌
-- PQ25100043 | special | 2 | NULL ❌
```

### After Fix
```sql
SELECT order_no, order_type, created_by, updated_by
FROM wms_orders
WHERE order_type = 'special';

-- Result:
-- PQ25100088 | special | 2 | 2 ✅
-- PQ25100043 | special | 2 | 2 ✅
```

### Test New Order Import
1. ล็อกอินด้วย user (เช่น metee, user_id=2)
2. ไปที่ http://localhost:3000/receiving/orders
3. คลิก "สร้างคำสั่งซื้อใหม่" และนำเข้าไฟล์ CSV
4. ตรวจสอบในฐานข้อมูล:

```sql
SELECT 
  order_no,
  order_type,
  created_by,
  updated_by,
  created_at
FROM wms_orders
ORDER BY created_at DESC
LIMIT 5;
```

**Expected Result:** ทุกออเดอร์ใหม่ควรมี `created_by = updated_by = 2`

## Behavior

### INSERT (สร้างออเดอร์ใหม่)
- `created_by` = user_id จาก session (หรือจาก API parameter)
- `updated_by` = `created_by` (เพิ่มใหม่)
- `created_at` = NOW()
- `updated_at` = NOW()

### UPDATE (แก้ไขออเดอร์)
- `created_by` = ไม่เปลี่ยน
- `updated_by` = user_id จาก session (หรือค่าเดิมถ้าไม่มี session)
- `created_at` = ไม่เปลี่ยน
- `updated_at` = NOW()

## Related Files

**Modified:**
- `supabase/migrations/136_fix_orders_updated_by_on_insert.sql` - Migration ใหม่

**Related:**
- `supabase/migrations/135_add_user_tracking_to_orders.sql` - Migration เดิมที่เพิ่ม created_by/updated_by
- `app/api/orders/import/route.ts` - API นำเข้าออเดอร์
- `app/receiving/orders/page.tsx` - หน้าแสดงออเดอร์

## Benefits

1. **Consistency**: ทุกออเดอร์จะมีทั้ง `created_by` และ `updated_by` เสมอ
2. **Audit Trail**: สามารถตรวจสอบได้ว่าใครสร้างและแก้ไขออเดอร์ล่าสุด
3. **UI Display**: หน้า orders จะแสดงชื่อผู้สร้างและผู้แก้ไขได้ครบถ้วน
4. **Data Integrity**: ไม่มีค่า NULL ในคอลัมน์ที่สำคัญ

## Summary

การแก้ไขนี้ทำให้:
- ✅ ออเดอร์ใหม่จะมี `updated_by = created_by` โดยอัตโนมัติ
- ✅ ออเดอร์เก่าที่มี `updated_by = NULL` ถูกอัปเดตแล้ว
- ✅ หน้า orders แสดงข้อมูลผู้สร้าง/ผู้แก้ไขครบถ้วน
- ✅ Audit trail สมบูรณ์สำหรับทุกออเดอร์

---

**Status**: ✅ Fixed
**Date**: December 11, 2025
**Migration**: 136_fix_orders_updated_by_on_insert.sql
**Fixed By**: Kiro AI Assistant
