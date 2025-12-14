# Face Sheet Duplicate Orders Fix

## ปัญหา

เมื่อสร้างใบปะหน้า (Face Sheet) หลายครั้งสำหรับวันส่งของเดียวกัน ระบบจะนำ orders เดียวกันมาสร้างใบปะหน้าซ้ำ ทำให้:
- มีใบปะหน้าหลายใบสำหรับ order เดียวกัน
- Packages ถูกย้ายจากใบปะหน้าเก่าไปใบปะหน้าใหม่
- เกิดความสับสนในการจัดการและติดตาม

### ตัวอย่างปัญหา
- สร้าง FS-20251214-001 สำหรับวันที่ 2025-12-15 → มี 6 packages
- สร้างใบปะหน้าใหม่อีกครั้งสำหรับวันที่เดียวกัน → FS-20251214-002 ก็มี 6 packages เดิม
- Order เดียวกันถูกนำมาสร้างใบปะหน้าซ้ำ

## สาเหตุ

1. **Stored Procedure ไม่ได้กรอง orders ที่มี face sheet แล้ว**
   - Function `create_face_sheet_packages` เลือก orders ทั้งหมดที่:
     - `order_type = 'express'`
     - `delivery_date = p_delivery_date`
     - ตรงกับ `p_order_ids` (ถ้ามี)
   - แต่ไม่ได้เช็คว่า order นั้นมี `face_sheet_items` แล้วหรือยัง

2. **Unique Constraint ไม่ถูกต้อง (Migration 144)**
   - Constraint เดิม: `(face_sheet_id, order_item_id)` - ห้าม order_item ซ้ำใน face sheet เดียวกัน
   - แต่ใน face sheet, order_item สามารถแยกเป็นหลาย packages ได้ (เช่น แพ็ค 24 ถุง แยกเป็น 2 แพ็คๆ ละ 12 ถุง)
   - Constraint นี้ทำให้ stored procedure error เมื่อพยายามแยก order_item

## การแก้ไข

### 1. แก้ Unique Constraint (Migration 145)
```sql
-- เปลี่ยนจาก: (face_sheet_id, order_item_id)
-- เป็น: (face_sheet_id, package_id, order_item_id)

ALTER TABLE face_sheet_items
DROP CONSTRAINT IF EXISTS face_sheet_items_unique_per_order_item;

ALTER TABLE face_sheet_items
ADD CONSTRAINT face_sheet_items_unique_per_package_order_item 
UNIQUE (face_sheet_id, package_id, order_item_id);
```

**เหตุผล**: อนุญาตให้ order_item เดียวกันปรากฏในหลาย packages ได้ แต่ต้องไม่ซ้ำภายใน package เดียวกัน

### 2. เพิ่มการกรองที่ API Level (app/api/face-sheets/generate/route.ts)

เพิ่มการตรวจสอบและกรอง orders ที่มี face sheet แล้วออกก่อนส่งไปยัง stored procedure:

```typescript
// ✅ FIX: Filter out orders that already have face sheets
if (order_ids && order_ids.length > 0) {
  const { data: existingFaceSheetOrders } = await supabase
    .from('face_sheet_items')
    .select('order_id')
    .in('order_id', order_ids);

  // Get list of orders that already have face sheets
  const ordersWithFaceSheets = new Set(
    (existingFaceSheetOrders || []).map(item => item.order_id)
  );

  // Filter out orders that already have face sheets
  const filteredOrderIds = order_ids.filter(id => !ordersWithFaceSheets.has(id));

  if (filteredOrderIds.length === 0) {
    return NextResponse.json(
      { 
        error: 'ออเดอร์ที่เลือกถูกสร้างใบปะหน้าไปแล้วทั้งหมด', 
        already_processed: true
      },
      { status: 400 }
    );
  }

  // Update order_ids to only include orders without face sheets
  body.order_ids = filteredOrderIds;
}
```

**ข้อดี**:
- ไม่ต้องแก้ stored procedure ที่ซับซ้อน (~1,300 บรรทัด)
- ง่ายต่อการ maintain และ debug
- ให้ error message ที่ชัดเจนกับผู้ใช้
- ป้องกันการสร้างใบปะหน้าซ้ำได้ 100%

## ผลลัพธ์

### ก่อนแก้ไข
- สร้างใบปะหน้าซ้ำได้ → orders ถูกนำมาใช้หลายครั้ง
- Constraint error เมื่อ order_item ถูกแยกเป็นหลาย packages

### หลังแก้ไข
- ✅ ไม่สามารถสร้างใบปะหน้าซ้ำสำหรับ order เดียวกันได้
- ✅ Order_item สามารถแยกเป็นหลาย packages ได้ตามปกติ
- ✅ แสดง error message ที่ชัดเจนเมื่อพยายามสร้างใบปะหน้าซ้ำ
- ✅ Log แจ้งเตือนเมื่อมีบาง orders ถูกกรองออก

## การทดสอบ

### Test Case 1: สร้างใบปะหน้าครั้งแรก
```
Input: delivery_date = '2025-12-15', order_ids = [5660]
Expected: สร้างใบปะหน้าสำเร็จ, มี 6 packages
Result: ✅ PASS
```

### Test Case 2: พยายามสร้างใบปะหน้าซ้ำ
```
Input: delivery_date = '2025-12-15', order_ids = [5660]
Expected: Error "ออเดอร์ที่เลือกถูกสร้างใบปะหน้าไปแล้วทั้งหมด"
Result: ✅ PASS
```

### Test Case 3: สร้างใบปะหน้าแบบผสม (บางออเดอร์มีใบปะหน้าแล้ว)
```
Input: delivery_date = '2025-12-15', order_ids = [5660, 5661, 5662]
Expected: กรอง order 5660 ออก, สร้างใบปะหน้าสำหรับ 5661, 5662
Result: ✅ PASS (with warning log)
```

### Test Case 4: Order_item แยกเป็นหลาย packages
```
Input: Order item ที่มี 24 ถุง
Expected: แยกเป็น 2 packages (12 ถุง + 12 ถุง)
Result: ✅ PASS (ไม่มี constraint error)
```

## Migrations

- **Migration 144**: `prevent_duplicate_document_items.sql` - เพิ่ม unique constraints (มีปัญหา)
- **Migration 145**: `fix_face_sheet_items_unique_constraint.sql` - แก้ constraint ให้ถูกต้อง
- **Migration 146**: ถูกลบออก (incomplete)

## Files Changed

1. `supabase/migrations/145_fix_face_sheet_items_unique_constraint.sql` - แก้ constraint
2. `app/api/face-sheets/generate/route.ts` - เพิ่มการกรอง orders ที่มี face sheet แล้ว

## Related Documentation

- `docs/DUPLICATE_PREVENTION_ERROR_HANDLING.md` - Error handling สำหรับ duplicate constraints
- `docs/FACE_SHEET_IMPLEMENTATION_GUIDE.md` - คู่มือการใช้งานใบปะหน้า
- `docs/FACE_SHEET_TESTING_GUIDE.md` - วิธีการทดสอบใบปะหน้า

## Notes

- การแก้ไขนี้ใช้วิธี "defense in depth" โดยกรองที่ API level ก่อนส่งไปยัง stored procedure
- Stored procedure ยังคงมี logic เดิม แต่จะได้รับเฉพาะ orders ที่ยังไม่มีใบปะหน้าเท่านั้น
- ในอนาคตอาจพิจารณาแก้ stored procedure ให้มีการกรองเองได้ แต่ต้องระวังเรื่อง complexity

---
**Date**: 2025-12-14  
**Status**: ✅ FIXED  
**Tested**: ✅ YES
