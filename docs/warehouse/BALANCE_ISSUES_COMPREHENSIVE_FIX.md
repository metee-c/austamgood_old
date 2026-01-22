# Balance Issues - Comprehensive Fix (January 22, 2026)

## Summary

Fixed all balance issues for 56 pallets received on January 22, 2026. The issues occurred because pallets were received before Migration 288-289 were fully deployed, causing the balance sync triggers to malfunction.

## Issues Found and Fixed

### 1. Missing Balance Records (19 pallets) ✅

**Pallets affected**: ATG20260122000000038 through ATG20260122000000056

**Problem**: 
- Ledger entries existed (receive transactions)
- But no balance records were created
- Users saw "ไม่พบข้อมูล Location ที่เลือก" error when trying to move

**Root Cause**: 
- Trigger `sync_inventory_ledger_to_balance()` failed to create balance records
- This happened before Migration 289 was deployed

**Fix Applied**:
```sql
INSERT INTO wms_inventory_balances (...)
SELECT ... FROM wms_inventory_ledger
WHERE transaction_type = 'receive'
  AND pallet_id IN ('ATG20260122000000038', ...)
  AND NOT EXISTS (SELECT 1 FROM wms_inventory_balances WHERE ...);
```

**Result**: Created 19 missing balance records

---

### 2. Wrong Balance Amount (1 pallet) ✅

**Pallet**: ATG20260122000000037

**Problem**:
- Received: 84 pieces
- Balance showed: 1680 pieces (20x multiplier!)
- UI displayed wrong quantity

**Root Cause**:
- Balance was updated multiple times by faulty trigger
- Each update added instead of replacing

**Fix Applied**:
```sql
UPDATE wms_inventory_balances
SET total_piece_qty = 84.00, total_pack_qty = 84.00
WHERE pallet_id = 'ATG20260122000000037';
```

**Result**: Balance corrected to 84 pieces

---

### 3. Duplicate Balance Records (2 pallets) ✅

**Pallets**: ATG20260122000000025, ATG20260122000000026

**Problem**:
- Each pallet had 2 balance records:
  - One at Receiving (old location)
  - One at destination (A04-01-023, A04-01-024)
- Total balance: 168 pieces (should be 84)

**Root Cause**:
- When moved, trigger created new balance at destination
- But failed to delete old balance at Receiving

**Fix Applied**:
```sql
DELETE FROM wms_inventory_balances
WHERE pallet_id IN ('ATG20260122000000025', 'ATG20260122000000026')
  AND location_id = 'Receiving'
  AND EXISTS (SELECT 1 FROM wms_inventory_balances WHERE location_id != 'Receiving');
```

**Result**: Removed 2 duplicate balance records

---

### 4. Duplicate Balance from Old Bug (1 pallet) ✅

**Pallet**: ATG20260122000000033

**Problem**:
- Had balance at both Receiving and B10-04-007
- Already moved but old balance remained

**Fix Applied**: Deleted old Receiving balance manually

**Result**: Balance now shows only at B10-04-007

---

## Final Verification

```
Total pallets received today: 56
✅ OK pallets: 56
❌ Problem pallets: 0
```

All 56 pallets are now working correctly!

## Prevention

Migration 288 and 289 have been deployed to prevent these issues:

1. **Migration 288**: Prevents duplicate ledger entries
2. **Migration 289**: Automatically deletes balance records when quantity reaches 0

For any future issues, run:
```bash
node fix-all-today-balance-issues.js
```

## Related Issues

- ATG20260122000000035: Fixed by `fix-all-doubled-balances.js`
- ATG20260122000000034: User confirmed correct
- All other pallets: Fixed by this comprehensive fix

## Technical Details

### Issue Timeline

1. **07:00-07:20**: Pallets received (before Migration 289 deployed)
2. **07:20-07:30**: Users tried to move pallets, encountered errors
3. **07:30**: Migration 288-289 deployed
4. **07:35**: Manual fixes applied for all affected pallets

### Why These Issues Occurred

The balance sync trigger had three bugs:

1. **No duplicate check**: Could create multiple ledger entries for same move
2. **No zero-balance cleanup**: Didn't delete balance when qty = 0
3. **Additive updates**: Added to balance instead of replacing

All three bugs are now fixed by Migrations 288-289.

## Files Created

- `fix-all-today-balance-issues.js` - Automated fix script for future use
- `docs/warehouse/BALANCE_ISSUES_COMPREHENSIVE_FIX.md` - This document
- `docs/warehouse/FINAL_BALANCE_FIXES_20260122.md` - Previous fixes summary

## Conclusion

All balance issues for January 22, 2026 have been resolved. The system is now stable and new pallets will not experience these issues thanks to the deployed migrations.
