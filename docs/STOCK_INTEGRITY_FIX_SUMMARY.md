# Stock Integrity Fix Summary
**Date:** 2026-01-06

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

## Results

| Issue | Before | After | Status |
|-------|--------|-------|--------|
| Duplicate Dispatch Records | 6 | 0 | ✅ Fixed |
| Orphan Reservations | 45 | 0 | ✅ Fixed |
| Ledger vs Balance Mismatches | 234 | 49 | 🟡 Partially Fixed |
| Negative Balances | 44 | 23 | ⚠️ Allowed by design |

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
