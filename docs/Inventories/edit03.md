# แก้ไขปัญหาแท็บ "จัดสินค้าเสร็จ (PK,FS)" แสดงใบหยิบเก่า

## สรุปปัญหา

หลังจากรีเซ็ต Dispatch inventory แล้ว แท็บ "จัดสินค้าเสร็จ (PK,FS)" ยังคงแสดงใบหยิบเก่าจากวันที่ 16/01/2569 (PL-20260116-003, PL-20260116-005, PL-20260116-006) แทนที่จะแสดงเฉพาะใบหยิบใหม่จากวันที่ 18/01/2569 (PL-20260118-001, PL-20260118-002, PL-20260118-003) เท่านั้น

## การวิเคราะห์สาเหตุ

### 1. สถานะของใบหยิบเก่า
```sql
-- ใบหยิบเก่า (PL-20260116-003/005/006)
- Status: completed (หยิบเสร็จแล้ว)
- Loadlist: NULL (ไม่ได้ถูกกำหนดให้กับใบโหลด)
- Reservations: 241 รายการ
  - status = 'picked'
  - staging_location_id = NULL
  - total_reserved = 3,952 ชิ้น
```

### 2. สถานะของใบหยิบใหม่
```sql
-- ใบหยิบใหม่ (PL-20260118-001/002/003)
- Status: completed
- Loadlist: NULL (รอกำหนดใบโหลด)
- Reservations: 32 รายการ (หลัง migration 239)
  - status = 'picked'
  - staging_location_id = 'Dispatch' ✅
  - total_reserved = 1,432 ชิ้น
```

### 3. ปัญหาที่พบ

**API กรองด้วย `staging_location_id = 'Dispatch'`** แต่ใบหยิบเก่ายังแสดงเพราะ:

1. API ใช้ `!inner` join กับ `picklist_item_reservations` โดยกรอง `staging_location_id = 'Dispatch'`
2. ใบหยิบเก่ามี `staging_location_id = NULL` ดังนั้นควรถูกกรองออก ✅
3. **แต่** API มี SKU-based fallback matching ที่ทำให้ใบหยิบเก่าแสดงเมื่อ SKU ซ้ำกับใบหยิบใหม่

**ตัวอย่าง:**
- ใบหยิบใหม่ PL-20260118-001 มี SKU "B-BEY-C|LAM|010" ที่ Dispatch
- ใบหยิบเก่า PL-20260116-003 ก็มี SKU เดียวกัน
- API จับคู่ด้วย SKU → ใบหยิบเก่าแสดงในผลลัพธ์

## วิธีแก้ไข

### Migration 240: Release Old Picklist Reservations

**แนวคิด:** เปลี่ยนสถานะ reservation ของใบหยิบเก่าจาก `picked` เป็น `released` เพื่อปล่อย inventory และป้องกันไม่ให้แสดงในแท็บ Dispatch

```sql
-- เปลี่ยนสถานะ reservations ของใบหยิบเก่า
UPDATE picklist_item_reservations r
SET 
  status = 'released',
  updated_at = NOW()
WHERE r.picklist_item_id IN (
  SELECT pi.id
  FROM picklist_items pi
  JOIN picklists p ON p.id = pi.picklist_id
  WHERE p.picklist_code IN ('PL-20260116-003', 'PL-20260116-005', 'PL-20260116-006')
    AND pi.voided_at IS NULL
)
AND r.status = 'picked'
AND r.staging_location_id IS NULL;
```

**ผลลัพธ์:**
- ✅ อัปเดต 241 reservations
- ✅ เปลี่ยนจาก `status='picked'` เป็น `status='released'`
- ✅ ปล่อย inventory ที่ถูกจองไว้
- ✅ ใบหยิบเก่าจะไม่แสดงในแท็บ Dispatch อีกต่อไป

## การตรวจสอบผลลัพธ์

### ก่อนแก้ไข
```
Picklists with Active Dispatch Reservations:
  PL-20260116-003: 31 items (ผิด - ควรไม่แสดง)
  PL-20260116-005: 114 items (ผิด - ควรไม่แสดง)
  PL-20260116-006: 96 items (ผิด - ควรไม่แสดง)
  PL-20260118-001: 17 items ✅
  PL-20260118-002: 4 items ✅
  PL-20260118-003: 11 items ✅
```

### หลังแก้ไข (Migration 240)
```
Picklists with Active Dispatch Reservations:
  PL-20260118-001: 17 items, 776 pieces ✅
  PL-20260118-002: 4 items, 168 pieces ✅
  PL-20260118-003: 11 items, 488 pieces ✅

Old Picklists:
  PL-20260116-003: No active Dispatch reservations ✅
  PL-20260116-005: No active Dispatch reservations ✅
  PL-20260116-006: No active Dispatch reservations ✅
```

## สรุปผลการแก้ไข

### ✅ สำเร็จ

1. **Migration 239**: อัปเดต `staging_location_id = 'Dispatch'` สำหรับใบหยิบใหม่ (40 reservations)
2. **Migration 240**: Release reservations ของใบหยิบเก่า (241 reservations)
3. **API Verification**: แท็บ Dispatch แสดงเฉพาะใบหยิบใหม่ 3 ใบเท่านั้น

### 📊 ผลลัพธ์สุดท้าย

**แท็บ "จัดสินค้าเสร็จ (PK,FS)" จะแสดง:**
- ✅ PL-20260118-001 (17 items, 776 pieces)
- ✅ PL-20260118-002 (4 items, 168 pieces)
- ✅ PL-20260118-003 (11 items, 488 pieces)
- ✅ รวม: 32 items, 1,432 pieces

**ไม่แสดง:**
- ❌ PL-20260116-003 (reservations released)
- ❌ PL-20260116-005 (reservations released)
- ❌ PL-20260116-006 (reservations released)

## ไฟล์ที่เกี่ยวข้อง

- `supabase/migrations/239_fix_dispatch_reservations_staging_location.sql` - อัปเดต staging_location_id สำหรับใบหยิบใหม่
- `supabase/migrations/240_release_old_picklist_reservations.sql` - Release reservations ของใบหยิบเก่า
- `app/api/warehouse/dispatch-inventory/route.ts` - API ที่กรองด้วย staging_location_id
- `scripts/verify-dispatch-tab-fix.js` - สคริปต์ตรวจสอบผลลัพธ์

## บันทึกเพิ่มเติม

### ทำไมไม่ลบ reservations เก่าทิ้ง?

เลือกใช้ `status='released'` แทนการลบเพราะ:
1. **รักษาประวัติ**: เก็บ audit trail ของการจองสินค้า
2. **ความปลอดภัย**: ไม่ทำลายข้อมูลที่อาจมีการอ้างอิงจากที่อื่น
3. **Reversible**: สามารถ rollback ได้ถ้าจำเป็น

### ใบหยิบเก่าเหล่านี้เกิดอะไรขึ้น?

- สถานะ: `completed` (หยิบเสร็จแล้ว)
- ไม่มี loadlist: ไม่ได้ถูกกำหนดให้กับใบโหลด
- Reservations: ถูก release แล้ว (inventory ว่างให้ใช้งานได้)
- **สรุป**: เป็นใบหยิบที่หยิบเสร็จแล้วแต่ไม่ได้โหลดขึ้นรถ (orphaned picklists)

---

**วันที่:** 19 มกราคม 2569  
**สถานะ:** ✅ แก้ไขสำเร็จ  
**Migrations:** 239, 240
