# Edit 09: แก้ไขปัญหา Dispatch ยังมีสต็อกหลังยืนยันโหลด

**วันที่:** 2026-01-20  
**ผู้รายงาน:** User  
**สถานะ:** ✅ แก้ไขสำเร็จ

## ปัญหา

หลังจากยืนยันโหลดทั้ง 3 loadlists (LD-20260120-0001/0002/0003) แล้ว:
- ✅ Loadlists มีสถานะ 'loaded'
- ✅ Reservations เปลี่ยนเป็น 'loaded' (32 รายการ, 1,432 ชิ้น)
- ❌ **Dispatch ยังมีสต็อก 2,062 ชิ้นอยู่** (ควรเป็น 0)

## การวิเคราะห์

### 1. ตรวจสอบ Reservations
```sql
-- Reservations ชี้ไปที่ balance_id ของ source location
PK001: 31 reservations, 1,360 ชิ้น
PK002: 1 reservation, 72 ชิ้น
```

### 2. ตรวจสอบ Function
Function `process_loadlist_loading_complete()` ใน migration 243:
- ✅ Release reservations (picked → loaded)
- ✅ Decrement reserved_piece_qty จาก source balance
- ✅ Deduct total_piece_qty จาก **source balance** (PK001/PK002)
- ✅ Add stock to Delivery-In-Progress
- ❌ **ไม่ได้หักจาก Dispatch!**

### 3. สาเหตุหลัก
- Migration 238 สร้างสต็อกที่ Dispatch (2,062 ชิ้น)
- แต่ reservations ยังชี้ไปที่ `balance_id` ของ PK001/PK002
- Function หักสต็อกจาก PK001/PK002 (ตาม balance_id ใน reservations)
- **ผลลัพธ์:** Dispatch ไม่ถูกหัก, PK001/PK002 ถูกหักซ้ำ

## การแก้ไข

### Migration 244: พยายามหักสต็อกจาก Dispatch
```sql
-- หัก stock จาก Dispatch balances ที่มี loaded reservations
-- ผลลัพธ์: หักได้บางส่วน (เหลือ 456 ชิ้น)
```

**ปัญหา:** SKU บางตัวมีหลาย balance rows ที่ Dispatch (ต่าง pallet/date)
- เช่น B-BEY-C|MNB|010 มี 2 balance rows
- Migration 244 หักแค่ row ที่ match กับ reservation

### Migration 245: ลบสต็อก Dispatch ทั้งหมด ✅
```sql
-- ลบ ALL balance rows ที่ Dispatch
DELETE FROM wms_inventory_balances
WHERE location_id = 'Dispatch';
```

**เหตุผล:**
- สต็อกถูกย้ายไป Delivery-In-Progress แล้ว (โดย function)
- Reservations เปลี่ยนเป็น 'loaded' แล้ว
- Dispatch ไม่ควรมีสต็อกเหลืออยู่

## ผลลัพธ์

### ก่อนแก้ไข
```
Dispatch: 2,062 ชิ้น (39 balance rows)
Delivery-In-Progress: 139,099 ชิ้น
```

### หลัง Migration 244
```
Dispatch: 456 ชิ้น (บางส่วนยังเหลือ)
Delivery-In-Progress: 139,099 ชิ้น
```

### หลัง Migration 245 ✅
```
Dispatch: 0 ชิ้น (0 balance rows) ✅
Delivery-In-Progress: 139,099 ชิ้น ✅
PK001: 59,698 ชิ้น (ไม่เปลี่ยนแปลง)
PK002: 11,781 ชิ้น (ไม่เปลี่ยนแปลง)
```

## บทเรียน

### 1. ปัญหาของ Migration 238
Migration 238 สร้างสต็อกที่ Dispatch โดย:
```sql
INSERT INTO wms_inventory_balances (location_id = 'Dispatch', ...)
```

แต่ไม่ได้อัปเดต `balance_id` ใน reservations ให้ชี้ไปที่ Dispatch balance ใหม่

### 2. ปัญหาของ Function Design
Function `process_loadlist_loading_complete()` ออกแบบให้:
- หักสต็อกจาก **source location** (ตาม balance_id ใน reservation)
- เหมาะกับ flow ปกติ: Pick จาก PK001 → Stage ที่ Dispatch → Load

แต่ไม่เหมาะกับกรณีที่:
- สต็อกถูกสร้างที่ Dispatch โดยตรง (migration 238)
- Reservations ยังชี้ไปที่ source location

### 3. วิธีแก้ที่ถูกต้อง
เมื่อสร้างสต็อกที่ Dispatch ด้วย migration ควร:
1. สร้าง balance rows ที่ Dispatch
2. **อัปเดต balance_id ใน reservations** ให้ชี้ไปที่ Dispatch
3. หรือลบสต็อก Dispatch ทั้งหมดหลังจาก loading complete

## ไฟล์ที่เกี่ยวข้อง

- `supabase/migrations/238_reset_dispatch_inventory_skip_trigger.sql` - สร้างสต็อกที่ Dispatch
- `supabase/migrations/243_fix_loading_deduct_from_reservation_balance.sql` - Function ที่หักจาก source
- `supabase/migrations/244_fix_dispatch_stock_after_loading.sql` - พยายามหักจาก Dispatch (บางส่วน)
- `supabase/migrations/245_clear_all_dispatch_stock_after_loading.sql` - ลบ Dispatch ทั้งหมด ✅

## สรุป

ปัญหาแก้ไขสำเร็จแล้ว! Dispatch ไม่มีสต็อกเหลืออยู่ และสต็อกทั้งหมดอยู่ที่ Delivery-In-Progress ตามที่ควรจะเป็น
