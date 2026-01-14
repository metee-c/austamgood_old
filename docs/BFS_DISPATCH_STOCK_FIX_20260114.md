# BFS-20260107-005 Dispatch Stock Fix - Complete ✅

## Problem
BFS-20260107-005 แสดงในแทบ "จัดสินค้าเสร็จ (PK,FS)" ซึ่งไม่ถูกต้อง เพราะ BFS items ควรอยู่ที่ MRTD/PQTD staging areas ไม่ใช่ Dispatch

## Investigation Results

### 1. ตรวจสอบสต็อกที่ Dispatch
พบ 2 SKUs ของ BFS-20260107-005 อยู่ที่ Dispatch:
- `B-BAP-C|KNP|030`: 29 pieces
- `B-BEY-D|CNL|012`: 48 pieces

### 2. ตรวจสอบสต็อกที่ MRTD/PQTD
**ไม่พบสต็อก** ที่ MRTD/PQTD สำหรับ SKUs เหล่านี้

### 3. ตรวจสอบ Hub ของ BFS-20260107-005
- Hub: Northeast [Lower], South [West] (ต่างจังหวัด = MR)
- **ควรอยู่ที่: MRTD**

## Solution Applied

### Migration 214: Move Stock from Dispatch to MRTD

**Action**: ย้ายสต็อกจาก Dispatch ไป MRTD

**Steps**:
1. สร้าง/อัพเดท balance records ที่ MRTD
2. สร้าง ledger entries (OUT from Dispatch, IN to MRTD)
3. ลบ balance records ที่ Dispatch

**Results**:
```
✅ B-BAP-C|KNP|030: 29 pieces → MRTD
✅ B-BEY-D|CNL|012: 48 pieces → MRTD
✅ Ledger entries created: 4 (2 OUT + 2 IN)
```

## Verification

### Before Fix
```sql
SELECT location_id, sku_id, total_piece_qty
FROM wms_inventory_balances
WHERE sku_id IN ('B-BAP-C|KNP|030', 'B-BEY-D|CNL|012')
  AND location_id IN ('Dispatch', 'MRTD');
```

Result:
- Dispatch: B-BAP-C|KNP|030 (29 pieces) ❌
- Dispatch: B-BEY-D|CNL|012 (48 pieces) ❌

### After Fix
Result:
- MRTD: B-BAP-C|KNP|030 (29 pieces) ✅
- MRTD: B-BEY-D|CNL|012 (48 pieces) ✅
- Dispatch: (no stock) ✅

## Impact

### Before
- ❌ BFS-20260107-005 แสดงในแทบ "จัดสินค้าเสร็จ (PK,FS)" (ไม่ถูกต้อง)
- ❌ ไม่แสดงในแทบ "จัดสินค้าเสร็จ (BFS)"

### After
- ✅ BFS-20260107-005 ไม่แสดงในแทบ "จัดสินค้าเสร็จ (PK,FS)"
- ✅ แสดงในแทบ "จัดสินค้าเสร็จ (BFS)" ที่ถูกต้อง

## Files Modified
- ✅ `supabase/migrations/214_move_bfs_20260107_005_to_mrtd.sql` - Migration script
- ✅ `docs/BFS_DISPATCH_STOCK_FIX_20260114.md` - This documentation

## Technical Details

### Ledger Entries Created
```sql
-- OUT from Dispatch
transaction_type: 'TRANSFER'
direction: 'out'
reference_no: 'MIG-214-BFS-20260107-005'
skip_balance_sync: TRUE

-- IN to MRTD
transaction_type: 'TRANSFER'
direction: 'in'
reference_no: 'MIG-214-BFS-20260107-005'
skip_balance_sync: TRUE
```

### Why skip_balance_sync = TRUE?
เพราะเราจัดการ balance records เองแล้วใน migration ไม่ต้องให้ trigger sync อีก

## Related Issues
- BFS items should NEVER be at Dispatch
- BFS items should be at MRTD/PQTD staging areas
- PQ hubs → PQTD
- MR hubs → MRTD

## Prevention
ในอนาคต ควรมี validation ที่:
1. ตรวจสอบว่า BFS items ไม่ถูกย้ายไป Dispatch
2. ตรวจสอบว่า BFS items อยู่ที่ staging area ที่ถูกต้องตาม hub

## Status: COMPLETE ✅

Migration applied successfully. BFS-20260107-005 stock now correctly located at MRTD staging area.

**Date**: 2026-01-14
**Migration**: 214_move_bfs_20260107_005_to_mrtd.sql
