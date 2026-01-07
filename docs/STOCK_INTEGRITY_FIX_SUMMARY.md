# Stock Integrity Fix Summary
**Date:** 2026-01-06 (Updated: 2026-01-07)

## Migrations Applied

### Migration 181: fix_stock_integrity_comprehensive
- Created `stock_correction_log` table for audit trail
- Cleared 10 orphan reservations (reserved_piece_qty without active reservation records)
- Merged 6 duplicate Dispatch balance records (9 records deleted)
- Recalculated 2,110 balance records from ledger

### Migration 182: fix_balance_by_pallet
- Recalculated 2,035 balance records that have pallet_id to match ledger

### Migration 183: fix_cleanup_inventory_on_receive_delete_v2
- แก้ไข trigger `cleanup_inventory_on_receive_delete` ให้จัดการกรณีที่สินค้าถูกย้ายไปที่อื่นแล้ว
- **ปัญหาเดิม**: เมื่อลบ receive ที่มีการย้ายสินค้าไปแล้ว:
  - Balance ที่ location ปัจจุบันไม่ถูกลด (trigger พยายามลดที่ Receiving แต่สินค้าอยู่ที่อื่นแล้ว)
  - Transfer ledger entries ไม่ถูกลบ
- **วิธีแก้ไข**:
  1. หา location ปัจจุบันของ pallet จาก balance table
  2. ลบ balance ที่ location ปัจจุบัน (ไม่ใช่ที่ Receiving)
  3. ลบ ledger entries ทั้งหมดที่เกี่ยวข้องกับ pallet_id (รวม transfer entries)

### Migration 184: fix_wrong_picklist_ledger_entries
- **ปัญหา**: Ledger entries ถูกสร้างด้วย reference_no (picklist_code) ที่ไม่ตรงกับ order_item_id
- **สาเหตุ**: เมื่อ order ถูกแบ่งออกเป็นหลาย picklists (split order) และหน้า mobile pick ส่ง request แบบ parallel ทำให้เกิด race condition
- **ผลกระทบ**: 
  - PL-20260106-008: 14 wrong entries (4,200 ชิ้น) - ลบแล้ว
  - PL-20260106-009: 11 wrong entries (7,300 ชิ้น) - ลบแล้ว
  - PL-20260106-010: 16 wrong entries (4,290 ชิ้น) - ลบแล้ว
- **วิธีแก้ไข**:
  1. ลบ ledger entries ที่ order_item_id ไม่ตรงกับ picklist_items ของ picklist นั้น
  2. แก้ไข TUN|070 IN entry ให้ตรงกับ OUT (50 -> 34)

## Results

| Issue | Before | After | Status |
|-------|--------|-------|--------|
| Duplicate Dispatch Records | 6 | 0 | ✅ Fixed |
| Orphan Reservations | 45 | 0 | ✅ Fixed |
| Ledger vs Balance Mismatches | 234 | 49 | 🟡 Partially Fixed |
| Negative Balances | 44 | 23 | ⚠️ Allowed by design |
| Wrong Picklist Ledger Entries | 41 | 0 | ✅ Fixed |

## Root Cause Analysis: Wrong Picklist Ledger Entries

### Problem
เมื่อ order ถูกแบ่งออกเป็นหลาย picklists (split order) และหน้า mobile pick ส่ง request แบบ parallel:
1. Order 6458 ถูกแบ่งเป็น 3 picklists: PL-008, PL-009, PL-010
2. แต่ละ picklist มี items บางส่วนของ order
3. เมื่อกดยืนยันหยิบ หน้า mobile pick ส่ง requests แบบ parallel
4. API ใช้ FEFO/FIFO fallback เมื่อไม่มี reservations
5. เกิด race condition ทำให้ ledger entries ถูกสร้างด้วย reference_no ที่ผิด

### Solution Applied
1. ลบ ledger entries ที่ order_item_id ไม่ตรงกับ picklist_items ของ picklist นั้น
2. แก้ไข TUN|070 IN entry ให้ตรงกับ OUT

### Prevention (TODO)
1. แก้ไข API `/api/mobile/pick/scan` ให้ตรวจสอบว่า item.picklist_id ตรงกับ picklist_id ที่ส่งมา
2. หรือแก้ไขหน้า mobile pick ให้ส่ง requests แบบ sequential แทน parallel

## Remaining Issues (49 mismatches)

The remaining mismatches are caused by a design inconsistency:
- **Balance table** tracks inventory by pallet_id
- **Ledger entries** for picking operations don't include pallet_id

This means when picking happens:
1. Ledger records: `location=PK001, sku=X, pallet_id=NULL, direction=out`
2. Balance records: `location=PK001, sku=X, pallet_id=ATG123, qty=576`

The migration can't match these because pallet_id doesn't match.

### Affected Locations
- PK001 (Packaging area) - Most mismatches
- A09-01-xxx (Preparation areas) - Some mismatches
- Receiving - 1 mismatch (ledger exists but no balance)

## Recommendations

1. **Short-term:** Accept the mismatches as known issues, monitor for growth
2. **Medium-term:** Update picking API to include pallet_id in ledger entries
3. **Long-term:** Consider redesigning balance tracking to not require pallet_id for non-pallet locations

## Helper Functions Created

```sql
-- Check stock availability before picking
SELECT * FROM check_stock_availability(balance_id, required_qty);

-- Safely upsert Dispatch balance (prevents duplicates)
SELECT upsert_dispatch_balance(warehouse_id, location_id, sku_id, piece_qty, pack_qty);

-- Safely release reservation
SELECT safe_release_reservation(balance_id, piece_qty, pack_qty);
```

## Audit Trail

All corrections are logged in `stock_correction_log` table:
```sql
SELECT * FROM stock_correction_log ORDER BY correction_date DESC;
```
