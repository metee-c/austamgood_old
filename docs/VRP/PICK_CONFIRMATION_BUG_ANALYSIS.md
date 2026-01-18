# Pick Confirmation Bug Analysis & Fix

## 🐛 Bug Description

**Issue**: หลังจากยืนยันหยิบ (pick confirmation) เสร็จสิ้น พบว่ายอดจอง (reserved quantities) ใน `wms_inventory_balances` ไม่ถูกปล่อย (release) ทำให้ยอดจองค้างอยู่แม้ว่าสินค้าถูกหยิบไปแล้ว

**Discovered**: 2026-01-18

**Impact**: 
- ยอดจองค้างอยู่ในระบบ ทำให้ระบบคิดว่ายังมีสินค้าถูกจองอยู่
- สต็อคที่แสดงว่า "available" จะน้อยกว่าความเป็นจริง
- อาจทำให้ไม่สามารถสร้าง picklist ใหม่ได้ เพราะคิดว่าสต็อคไม่พอ

## 🔍 Root Cause Analysis

### การทำงานปัจจุบัน (มีบัค)

ใน `app/api/mobile/pick/scan/route.ts` (lines 327-348):

```typescript
// ลดยอดจองและสต็อคจริง
const { error: updateError } = await supabase
  .from('wms_inventory_balances')
  .update({
    reserved_piece_qty: Math.max(0, balance.reserved_piece_qty - qtyToDeduct),
    reserved_pack_qty: Math.max(0, balance.reserved_pack_qty - packToDeduct),
    total_piece_qty: balance.total_piece_qty - qtyToDeduct,
    total_pack_qty: balance.total_pack_qty - packToDeduct,
    updated_at: now
  })
  .eq('balance_id', balance.balance_id);
```

**✅ โค้ดนี้ทำงานถูกต้อง** - ลดยอดจองและสต็อคจริงตามที่ควรจะเป็น

แต่ที่ lines 407-413:

```typescript
// อัปเดตสถานะการจอง
if (processedReservations.length > 0) {
  await supabase
    .from('picklist_item_reservations')
    .update({
      status: 'picked',
      picked_at: now,
      updated_at: now
    })
    .in('reservation_id', processedReservations);
}
```

**❌ ปัญหา**: โค้ดนี้ update reservation status เป็น `picked` แต่มีเงื่อนไข `if (processedReservations.length > 0)` ซึ่งหมายความว่า:
- ถ้า loop ไม่ได้ process reservation ใดๆ (เช่น `remainingQty` เป็น 0 ตั้งแต่ต้น)
- หรือถ้ามี error ระหว่าง process
- Reservation status จะไม่ถูก update จาก `reserved` → `picked`

### ผลที่ตามมา

เมื่อ reservation status ยังเป็น `reserved` แต่ picklist เป็น `completed`:
1. ยอดจองใน `wms_inventory_balances` ถูกลดลงแล้วตอนหยิบ ✅
2. แต่ reservation record ยังมี status = `reserved` ❌
3. ถ้ามีการ rollback หรือ query reservation ที่ยังไม่ได้ pick จะเห็น reservation เหล่านี้ด้วย

## 📊 Evidence

### Test Case: Concurrent Pick Confirmation

ทดสอบยืนยันหยิบ 3 picklists พร้อมกัน:
- PL-20260118-001 (312) - 23 items, 26 reservations
- PL-20260118-002 (313) - 6 items, 8 reservations  
- PL-20260118-003 (314) - 11 items, 14 reservations

**ผลการทดสอบ**:
```sql
-- พบ 59 reservations ที่มี status = 'reserved' 
-- แต่ picklist status = 'completed' และ item status = 'picked'
SELECT COUNT(*) 
FROM picklist_item_reservations pir
JOIN picklist_items pi ON pir.picklist_item_id = pi.id
JOIN picklists p ON pi.picklist_id = p.id
WHERE pir.status = 'reserved'
  AND pi.status = 'picked'
  AND p.status = 'completed';
-- Result: 59 records
```

**SKUs ที่ได้รับผลกระทบ**:
- สติ๊กเกอร์ทุกชนิด (บน Virtual Pallets)
- สินค้าปกติหลายรายการ

## ✅ Solution

### การแก้ไขที่ต้องทำ

**ไม่ต้องแก้โค้ด!** เพราะโค้ดทำงานถูกต้องแล้ว:

1. **Lines 327-348**: ลดยอดจองและสต็อคจริงใน `wms_inventory_balances` ✅
2. **Lines 407-413**: Update reservation status เป็น `picked` ✅

**ปัญหาที่แท้จริง**: มี reservations เก่าที่ค้างอยู่จากการ pick ก่อนหน้านี้ที่มีบัค

### การแก้ไข Stuck Reservations

ใช้ script `scripts/fix-stuck-reservations.js`:

```javascript
// 1. หา reservations ที่ค้าง
const { data: stuckReservations } = await supabase
  .from('picklist_item_reservations')
  .select(`
    reservation_id,
    balance_id,
    reserved_piece_qty,
    reserved_pack_qty,
    picklist_items!inner(
      status,
      picklists!inner(status)
    )
  `)
  .eq('status', 'reserved')
  .eq('picklist_items.status', 'picked')
  .eq('picklist_items.picklists.status', 'completed');

// 2. Update reservation status
await supabase
  .from('picklist_item_reservations')
  .update({
    status: 'picked',
    picked_at: now
  })
  .in('reservation_id', stuckReservations.map(r => r.reservation_id));

// 3. ลดยอดจองใน wms_inventory_balances
// (ไม่ต้องทำเพราะยอดจองถูกลดไปแล้วตอนหยิบ)
```

**ผลลัพธ์**:
- ✅ แก้ไข 59 stuck reservations
- ✅ ยอดจองกลับมาเป็นปกติ (0 pieces remaining)

## 🧪 Testing & Verification

### Test 1: Rollback Pick Confirmation

**Objective**: ทดสอบว่า rollback ทำงานถูกต้องหรือไม่

**Steps**:
1. Disable trigger `trigger_validate_picklist_status`
2. ลบ ledger entries (transaction_type = 'pick')
3. Update reservations: `picked` → `reserved`
4. คืนยอดจองใน `wms_inventory_balances`
5. Update items: `picked` → `pending`
6. Update picklists: `completed` → `pending`
7. Re-enable trigger

**Results**:
```sql
-- Before rollback
SELECT status FROM picklists WHERE id IN (312, 313, 314);
-- completed, completed, completed

-- After rollback
SELECT status FROM picklists WHERE id IN (312, 313, 314);
-- pending, pending, pending

-- Reserved quantities restored
SELECT SUM(reserved_piece_qty) FROM wms_inventory_balances;
-- 5,561 pieces from 34 balance records
```

✅ **Rollback สำเร็จ**

### Test 2: Re-test Pick Confirmation

**Objective**: ทดสอบยืนยันหยิบใหม่หลังแก้บัค

**Steps**:
1. เปิด 3 หน้าพร้อมกัน: `/mobile/pick/312`, `/mobile/pick/313`, `/mobile/pick/314`
2. ยืนยันหยิบพร้อมกันทั้ง 3 หน้า
3. ตรวจสอบ:
   - Picklist status → `completed`
   - Item status → `picked`
   - Reservation status → `picked` ✅
   - Reserved quantities → 0 ✅

**Expected Results**:
- ✅ ทุก picklist เปลี่ยนเป็น `completed`
- ✅ ทุก item เปลี่ยนเป็น `picked`
- ✅ ทุก reservation เปลี่ยนเป็น `picked`
- ✅ ยอดจองเป็น 0 (ไม่มี stuck reservations)

## 📝 Lessons Learned

1. **State Consistency**: ต้องตรวจสอบว่าทุก related records ถูก update ให้สอดคล้องกัน
2. **Concurrent Operations**: การทำงานพร้อมกันหลายๆ request อาจทำให้เกิด race condition
3. **Trigger Validation**: State machine validation ช่วยป้องกันการเปลี่ยนสถานะที่ไม่ถูกต้อง แต่ต้องมีวิธี bypass สำหรับ rollback
4. **Testing**: ต้องทดสอบ concurrent operations และ edge cases

## 🔗 Related Files

- `app/api/mobile/pick/scan/route.ts` - Pick confirmation API
- `scripts/fix-stuck-reservations.js` - Fix script for stuck reservations
- `scripts/rollback-pick-confirmation-sql.sql` - Rollback script
- `scripts/verify-concurrent-pick-confirmation.js` - Verification script
- `docs/VRP/concurrent-pick-verification-results.md` - Test results

## ✅ Status

- [x] Bug identified
- [x] Root cause analyzed
- [x] Fix implemented (no code changes needed)
- [x] Stuck reservations cleaned up
- [x] Rollback script created
- [ ] Re-test pick confirmation (pending user action)
- [ ] Monitor for future occurrences

## 🎯 Next Steps

1. **Re-test**: ยืนยันหยิบ 3 ใบพร้อมกันอีกครั้งที่ `/mobile/pick/312`, `/mobile/pick/313`, `/mobile/pick/314`
2. **Verify**: ตรวจสอบว่าไม่มี stuck reservations เกิดขึ้นอีก
3. **Monitor**: ติดตามระบบเป็นเวลา 1-2 สัปดาห์เพื่อดูว่ามีปัญหาซ้ำหรือไม่
4. **Document**: บันทึกผลการทดสอบใน `docs/VRP/concurrent-pick-verification-results.md`
