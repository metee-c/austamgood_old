# Fix SKU Mapping Duplicate Key Error ✅

## Problem
หลายหน้าเกิด error:
```
duplicate key value violates unique constraint 
"sku_preparation_area_mapping_sku_id_warehouse_id_preparatio_key"
```

## Root Cause
Migration 285 เปลี่ยนจาก `ON CONFLICT ... DO UPDATE` เป็น `DELETE` แล้ว `INSERT` ใหม่ แต่ลืมใส่ `ON CONFLICT` clause กลับมา

ทำให้เกิด race condition:
1. User A และ User B แก้ไข SKU พร้อมกัน
2. ทั้งสอง trigger ทำงานพร้อมกัน
3. ทั้งสองพยายาม INSERT ข้อมูลเดียวกัน
4. เกิด duplicate key error

## Solution - Migration 290

เพิ่ม `ON CONFLICT` clause กลับมาใน function `sync_sku_preparation_area_mapping()`:

```sql
INSERT INTO sku_preparation_area_mapping (...)
VALUES (...)
ON CONFLICT (sku_id, warehouse_id, preparation_area_id) 
DO UPDATE SET
    updated_at = CURRENT_TIMESTAMP;
```

## Changes Made

### Before (Migration 285)
```sql
-- ไม่มี ON CONFLICT - เกิด error ถ้ามีข้อมูลซ้ำ
INSERT INTO sku_preparation_area_mapping (...)
VALUES (...);
```

### After (Migration 290)
```sql
-- มี ON CONFLICT - handle race condition ได้
INSERT INTO sku_preparation_area_mapping (...)
VALUES (...)
ON CONFLICT (sku_id, warehouse_id, preparation_area_id) 
DO UPDATE SET updated_at = CURRENT_TIMESTAMP;
```

## Testing
ลองแก้ไข SKU ที่มี default_location หลายครั้งพร้อมกัน - ควรไม่เกิด error แล้ว

## Files Modified
1. `supabase/migrations/290_fix_sku_mapping_duplicate_key_error.sql` - Migration ใหม่
2. `apply-migration-290.js` - Script สำหรับ apply migration

## Status
✅ **FIXED** - Migration 290 applied successfully

---
**Date**: 2026-01-22  
**Impact**: Critical bug fix - unblocks SKU management operations
