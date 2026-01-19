# การแก้ไข Loading Complete API - ปล่อย Reservations ก่อนหักสต็อค

**วันที่**: 2026-01-19  
**ปัญหา**: เมื่อยืนยันการโหลดสินค้า API หักสต็อคโดยไม่ปล่อย reservations ก่อน ทำให้เกิด constraint violation

## 🔴 ปัญหาที่พบ

### Error Message
```
check_reservation_not_exceed_positive_balance
Failed to update source balance 35329: new row for relation "wms_inventory_balances" 
violates check constraint "check_reservation_not_exceed_positive_balance"
```

### สาเหตุ
1. **สถานะปัจจุบัน**: `total_piece_qty=120`, `reserved_piece_qty=120`
2. **API หักสต็อค 72 ชิ้น**: `total_piece_qty=48`
3. **แต่ `reserved_piece_qty` ยังคงเป็น 120** (ไม่ได้ปล่อย!)
4. **Constraint ล้มเหลว**: `reserved_piece_qty` (120) > `total_piece_qty` (48) ❌

### Root Cause
API `/api/mobile/loading/complete` มีขั้นตอนดังนี้:
1. ✅ ตรวจสอบสต็อค
2. ✅ อัปเดตสถานะ loadlist เป็น 'loaded'
3. ❌ **ไม่มีการปล่อย reservations** (ข้ามขั้นตอนนี้!)
4. ❌ หักสต็อคจาก balance → เกิด constraint violation

## ✅ วิธีแก้ไข

### 1. สร้าง Database Function (Migration 241)

สร้างฟังก์ชันสำหรับปล่อย reservations:

```sql
-- Helper function: ปล่อย reservation ทีละรายการ
CREATE FUNCTION release_single_reservation(
  p_balance_id BIGINT,
  p_reserved_piece_qty NUMERIC,
  p_reserved_pack_qty NUMERIC
)
```

```sql
-- Main function: ปล่อย reservations ทั้งหมดของ loadlist
CREATE FUNCTION release_loadlist_reservations(
  p_loadlist_id INTEGER
)
RETURNS TABLE (
  released_count INTEGER,
  total_reserved_qty NUMERIC
)
```

**การทำงาน**:
1. หา reservations ทั้งหมดที่ `status='picked'` และ `staging_location_id='Dispatch'`
2. ลด `reserved_piece_qty` ใน `wms_inventory_balances`
3. เปลี่ยน `status` จาก `'picked'` เป็น `'loaded'`

### 2. อัปเดต Loading Complete API

เพิ่มการเรียกฟังก์ชัน **ก่อน** หักสต็อค:

```typescript
// ✅ FIX: Release reservations BEFORE deducting stock
console.log(`🔓 Releasing reservations for loadlist ${loadlist.id}...`);
const { data: releaseResult, error: releaseError } = await supabase
  .rpc('release_loadlist_reservations', { p_loadlist_id: loadlist.id });

if (releaseError) {
  return NextResponse.json(
    { error: 'ไม่สามารถปลดล็อคการจองสินค้าได้', details: releaseError.message },
    { status: 500 }
  );
}

const releasedCount = releaseResult?.[0]?.released_count || 0;
const totalReservedQty = releaseResult?.[0]?.total_reserved_qty || 0;
console.log(`✅ Released ${releasedCount} reservations (${totalReservedQty} pieces total)`);

// จากนั้นค่อยหักสต็อค...
```

## 📊 ผลการทดสอบ

### Test Case: Loadlist LD-20260120-0001 (ID: 255)

**ก่อนแก้ไข**:
```
Picklist: PL-20260118-003
Reservations: 11 รายการ, status='picked', staging_location_id='Dispatch'
Balance 25442 (B-BEY-C|TUN|010): reserved_piece_qty=72
```

**หลังเรียกฟังก์ชัน**:
```sql
SELECT * FROM release_loadlist_reservations(255);
-- Result: released_count=11, total_reserved_qty=488
```

**ตรวจสอบ Balance**:
```
Balance 25442: reserved_piece_qty=0 ✅ (ลดลงจาก 72)
Reservations: status='loaded' ✅ (เปลี่ยนจาก 'picked')
```

## 🔄 ขั้นตอนการทำงานใหม่

### เดิม (มีปัญหา):
1. ตรวจสอบสต็อค
2. อัปเดตสถานะ loadlist
3. ❌ หักสต็อค → Constraint violation!

### ใหม่ (แก้ไขแล้ว):
1. ตรวจสอบสต็อค
2. **🔓 ปล่อย reservations** (ลด `reserved_piece_qty`)
3. อัปเดตสถานะ loadlist
4. ✅ หักสต็อค → สำเร็จ!

## 📁 ไฟล์ที่เกี่ยวข้อง

- `supabase/migrations/241_add_release_reservations_on_loading.sql` - Database function
- `app/api/mobile/loading/complete/route.ts` - API ที่แก้ไข (บรรทัด ~792-820)

## 🎯 สรุป

**ปัญหา**: API หักสต็อคโดยไม่ปล่อย reservations ก่อน ทำให้ `reserved_piece_qty` > `total_piece_qty`

**วิธีแก้**: เพิ่มขั้นตอนปล่อย reservations (เปลี่ยน status เป็น 'loaded' และลด reserved_piece_qty) **ก่อน** หักสต็อค

**ผลลัพธ์**: การยืนยันโหลดสินค้าทำงานได้ปกติ ไม่เกิด constraint violation อีกต่อไป ✅
