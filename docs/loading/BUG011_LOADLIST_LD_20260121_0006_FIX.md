# BUG011: Loadlist LD-20260121-0006 Loading Failure

## Issue Summary

**Date**: 2026-01-21  
**Loadlist**: LD-20260121-0006  
**Error**: "Insufficient stock for 1 items"  
**Problematic SKU**: B-BEY-D|SAL|NS|012 (needs 48 pieces, 0 available at Dispatch)

## Root Cause

**Duplicate Picklist Assignment**: Picklist 327 (PL-20260120-003) was assigned to TWO loadlists simultaneously:

1. **LD-20260121-0006** (ID: 280)
   - Created: 2026-01-20 09:29:50
   - Status: pending
   - Trip ID: 878

2. **LD-20260116-0023** (ID: 283)
   - Created: 2026-01-20 09:32:29 (3 minutes later)
   - Status: pending  
   - Trip ID: 878
   - Also contains: BFS-20260115-004, BFS-20260120-002

This is a recurrence of **BUG010** (duplicate picklist in loadlists).

## Investigation Findings

### 1. Duplicate Picklist Assignment
- Same picklist (327) mapped to 2 different loadlists
- Both loadlists have same trip_id (878)
- Both loadlists are "pending" status
- Neither has been loaded yet

### 2. Stock Location Issue
- SKU B-BEY-D|SAL|NS|012 shows 0 pieces at Dispatch
- However, 318 pieces exist at Delivery-In-Progress location
- This suggests stock was moved prematurely or by another process

### 3. Picklist Data
- Picklist 327 status: "completed"
- Picklist 327 contains 46 items
- All items show status "picked"
- Trip 878 has no orders assigned (data inconsistency)

## Fix Applied

### Step 1: Remove Duplicate Mapping
Removed picklist 327 from LD-20260116-0023 (the duplicate created later):

```sql
DELETE FROM wms_loadlist_picklists
WHERE loadlist_id = 283  -- LD-20260116-0023
  AND picklist_id = 327;
```

### Step 2: Verification
- Picklist 327 now only assigned to LD-20260121-0006
- LD-20260116-0023 still has 2 bonus face sheets

## Remaining Issues

### Issue 1: Empty Trip
Trip 878 has no orders assigned, but picklist 327 was created from it. This suggests:
- Orders were deleted after picklist creation
- Or picklist was created incorrectly
- Or there's a data integrity issue

### Issue 2: Stock at Wrong Location
Stock for B-BEY-D|SAL|NS|012 is at Delivery-In-Progress instead of Dispatch:
- 318 pieces at Delivery-In-Progress
- 0 pieces at Dispatch
- No ledger entries found for this movement

This suggests the stock was moved by another process or there's a data corruption.

## Prevention Measures

### 1. Add Validation in Loadlist Creation API
The API `/api/loadlists` (POST) should check for duplicate picklist assignments:

```typescript
// Check if picklist is already assigned to another loadlist
const { data: existingMappings } = await supabase
  .from('wms_loadlist_picklists')
  .select('loadlist_id, loadlists!inner(loadlist_code, status)')
  .in('picklist_id', picklist_ids);

if (existingMappings && existingMappings.length > 0) {
  return NextResponse.json({
    error: 'Picklist ถูกแมพกับ loadlist อื่นแล้ว',
    existing_loadlists: existingMappings
  }, { status: 400 });
}
```

### 2. Database Constraint (Optional)
Add a unique constraint to prevent duplicate picklist assignments:

```sql
-- This will prevent the same picklist from being in multiple loadlists
ALTER TABLE wms_loadlist_picklists
ADD CONSTRAINT unique_picklist_per_loadlist 
UNIQUE (picklist_id);
```

⚠️ **Note**: This constraint is strict and may not be suitable if there's a legitimate use case for moving picklists between loadlists.

### 3. Improve Loading API Error Messages
The loading completion API should provide better error messages when stock is at the wrong location:

```typescript
if (availableQty < totalQtyNeeded) {
  // Check if stock exists at other locations
  const { data: otherLocations } = await supabase
    .from('wms_inventory_balances')
    .select('location:master_location!wms_inventory_balances_location_id_fkey(location_code), total_piece_qty')
    .eq('sku_id', skuId)
    .eq('warehouse_id', 'WH001')
    .gt('total_piece_qty', 0);

  insufficientStockItems.push({
    sku_id: skuId,
    required: totalQtyNeeded,
    available: availableQty,
    location: 'Dispatch',
    other_locations: otherLocations // Show where stock actually is
  });
}
```

## Related Issues

- **BUG010**: Duplicate Picklist in Loadlists (migration 235)
- **BUG008**: Stock not moved to staging for pending loadlists

## Files Modified

- Created: `fix-loadlist-ld-20260121-0006.js` - Fix script
- Created: `check-loadlist-ld-20260121-0006.js` - Investigation script
- Created: `analyze-picklist-327-conflict.js` - Analysis script
- Created: `check-picklist-327-details.js` - Picklist details script

## Next Steps

1. ✅ Remove duplicate picklist mapping (DONE)
2. ⏳ Investigate why trip 878 has no orders
3. ⏳ Investigate why stock is at Delivery-In-Progress
4. ⏳ Add validation to loadlist creation API
5. ⏳ Consider adding database constraint
6. ⏳ Improve loading API error messages

## Status

- [x] Identified root cause
- [x] Fixed duplicate picklist assignment
- [ ] Investigated empty trip issue
- [ ] Investigated stock location issue
- [ ] Added prevention measures
- [ ] Tested fix

## Impact

- **Severity**: Medium
- **Affected Users**: Warehouse staff trying to complete loading for LD-20260121-0006
- **Workaround**: Manual stock adjustment or loadlist recreation
- **Fix Status**: Partial (duplicate removed, but underlying issues remain)
