# Pallet ATG202601150000000670 Restoration - Complete

## Summary
Successfully restored pallet ATG202601150000000670 to location PK001 with correct quantity.

## Issue Background
- Pallet existed in ledger but NOT in balance table
- All ledger entries had NULL quantities (data corruption)
- No source documents found (orphan record)
- Initial attempt to delete was a mistake - user wanted to RESTORE and move to PK001

## Restoration Details

### Pallet Information
- **Pallet ID**: ATG202601150000000670
- **SKU**: B-NET-C|SAL|010 (Buzz Netura แมวโตและลูก แซลมอน | 1 กก.)
- **Quantity**: 576 pieces
- **Pack Qty**: 24 packs (24 pieces per pack)
- **Production Date**: 2025-10-22
- **Expiry Date**: 2027-04-21
- **Location**: PK001 (พื้นที่เก็บสินค้าปกติ)

### Technical Solution

#### Problem Encountered
Initial restoration script inserted into BOTH `wms_inventory_balances` AND `wms_inventory_ledger`, causing quantity to double (1152 pieces instead of 576) because:
- There's a trigger `trg_sync_inventory_ledger_to_balance` that automatically syncs ledger to balance
- Manual insert into balance + trigger sync = double quantity

#### Correct Approach
Only insert into `wms_inventory_ledger` with:
- `transaction_type`: 'adjustment'
- `direction`: 'in'
- `piece_qty`: 576
- `pack_qty`: 24
- `reference_no`: 'MANUAL-RESTORE-670'
- `remarks`: 'Restored pallet after accidental deletion - moved to PK001'

The trigger automatically creates the balance record with correct quantity.

### Schema Corrections Made
Fixed restoration script to use correct column names:
- ❌ `piece_qty_change`, `pack_qty_change` (don't exist)
- ✅ `piece_qty`, `pack_qty` (correct)
- ❌ `balance_after_piece_qty`, `balance_after_pack_qty` (don't exist)
- ✅ Removed (not needed - trigger handles balance)
- ❌ `source_document`, `notes` (wrong column names)
- ✅ `reference_no`, `remarks` (correct)

## Verification Results

### Database State
```
Balance Record:
- Location: PK001
- Quantity: 576 pieces ✅
- Pack Qty: 24 packs ✅
- Production Date: 2025-10-22 ✅
- Expiry Date: 2027-04-21 ✅

Ledger Entry:
- Transaction Type: adjustment
- Direction: in
- Quantity: 576 pieces ✅
- Reference: MANUAL-RESTORE-670
```

### Mobile Transfer API Test
✅ Pallet can be found by scanning/searching in mobile transfer page
✅ All details display correctly
✅ Ready to be moved to other locations

## Files Created
1. `restore-pallet-670-to-pk001.js` - Fixed restoration script (for reference)
2. `delete-pallet-670-and-restore-properly.js` - Complete cleanup and restoration
3. `check-pallet-670-current-state.js` - Verification script
4. `test-mobile-transfer-api.js` - API test script
5. `PALLET_670_RESTORATION_COMPLETE.md` - This summary

## Status
✅ **COMPLETE** - Pallet ATG202601150000000670 is now available at location PK001 and can be found/moved using the mobile transfer interface.

## Lessons Learned
1. Always check for database triggers before manual data insertion
2. The `trg_sync_inventory_ledger_to_balance` trigger automatically maintains balance from ledger
3. Only insert into ledger table - never manually insert into balance table
4. Use correct column names from schema (check migrations for actual structure)
5. When restoring data, understand the full data flow including triggers

## Next Steps
User can now:
1. Open mobile transfer page: http://localhost:3000/mobile/transfer
2. Scan or search for pallet: ATG202601150000000670
3. Move pallet to desired location
4. System will automatically update ledger and balance
