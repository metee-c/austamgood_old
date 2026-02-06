# Mobile Transfer Multiple Location Bug Fix

**Date:** February 6, 2026
**Issue:** Pallet ATG20260129061 exists in 2 locations simultaneously (B06-01-007 and A06-02-005)
**Severity:** CRITICAL - Data integrity violation

---

## 🐛 Problem Analysis

### Root Cause
The mobile transfer page (`/mobile/transfer`) was using `palletDetails[0]?.location_id` to determine the source location for moves. When a pallet exists in multiple locations (due to previous bugs or incomplete moves), this approach selected an **arbitrary location** based on API ordering, not the correct source location.

### How the Bug Occurred

**Step 1: API Returns ALL Balances**
```typescript
// /api/inventory/balances?pallet_id=ATG20260129061
// Returns ALL balances where total_piece_qty > 0
[
  { location_id: 'B06-01-007', sku_id: 'ABC123', total_piece_qty: 60 },
  { location_id: 'Receiving', sku_id: 'XYZ789', total_piece_qty: 60 }, // Orphaned balance
]
```

**Step 2: Code Takes First Item**
```typescript
// OLD CODE (BUGGY)
const sourceLocationId = palletDetails[0]?.location_id || null;
// Could be 'B06-01-007' OR 'Receiving' depending on API order!
```

**Step 3: Wrong Move Created**
- User scans pallet at location B06-01-007
- API returns balances from both B06-01-007 and orphaned "Receiving" location
- Code uses `palletDetails[0]` which happens to be "Receiving"
- Move created: FROM "Receiving" TO "A06-02-005"
- Result: Pallet now has balances in BOTH B06-01-007 and A06-02-005 ❌

### Cascading Effect
1. **Original issue:** Incomplete move left orphaned balance at "Receiving"
2. **Secondary issue:** Next move uses wrong source location
3. **Result:** Pallet duplicates across multiple locations
4. **Impact:** Inventory balances incorrect, stock visibility broken

---

## ✅ Solution Implemented

### 1. Multiple Location Detection
```typescript
// Detect if pallet exists in multiple locations
const uniqueLocationIds = [...new Set(filteredData.map((item: any) => item.location_id as string))];
const hasMultipleLocations = uniqueLocationIds.length > 1;

if (hasMultipleLocations) {
  setMultipleLocationsDetected(true);
  setSelectedSourceLocationId(null); // Force user to select
} else {
  setMultipleLocationsDetected(false);
  setSelectedSourceLocationId(uniqueLocationIds[0] || null);
}
```

### 2. Warning UI
Added orange warning banner when multiple locations detected:
- Shows ⚠️ alert icon
- Displays message: "พบพาเลทอยู่หลาย Location! กรุณาเลือก Location ต้นทางที่ต้องการย้าย"
- Forces user to make explicit choice

### 3. Location Selector
Radio button interface showing:
- Each location with code and name
- Total quantity at each location
- Visual selection (orange background when selected)

### 4. Validation Before Move
```typescript
// Prevent move if source location not selected
if (multipleLocationsDetected && !selectedSourceLocationId) {
  setQuickMoveError('⚠️ พาเลทนี้อยู่หลาย Location กรุณาเลือก Location ต้นทางที่ต้องการย้าย');
  return;
}
```

### 5. Filtered Pallet Details
Pallet details now show only items from selected source location:
```typescript
const itemsToShow = multipleLocationsDetected
  ? palletDetails.filter((item: any) => item.location_id === selectedSourceLocationId)
  : palletDetails;
```

---

## 🔍 Example Scenario

### Before Fix (Buggy):
1. User scans pallet at B06-01-007
2. API returns balances from B06-01-007 AND orphaned "Receiving"
3. Code automatically uses `palletDetails[0]` (could be any location)
4. Move created from wrong source → duplicate balances

### After Fix (Correct):
1. User scans pallet at B06-01-007
2. System detects multiple locations
3. **UI shows warning** with location selector:
   - 📍 B06-01-007 (60 ชิ้น)
   - 📍 Receiving (60 ชิ้น)
4. User **explicitly selects** B06-01-007
5. Move created from correct source → no duplication

---

## 📁 Files Modified

### `app/mobile/transfer/page.tsx`
- **Line 177-183:** Added state variables for multiple location handling
- **Line 304-323:** Detection logic in `handleScanPallet`
- **Line 600-608:** Validation in `handleConfirmQuickMove`
- **Line 1647-1687:** Warning UI and location selector
- **Line 1689-1773:** Filtered pallet details display
- **Line 253-261:** Reset state in `handleCloseQuickMove`

---

## ⚠️ Remaining Issues

### Existing Duplicate Balances
The fix **prevents future bugs** but does NOT fix existing duplicate balances.

**Example:** Pallet ATG20260129061 currently has:
- 60 pieces at B06-01-007
- 60 pieces at A06-02-005

**Total shown:** 120 pieces (should be 60)

### Recommended Cleanup

**Option 1: Manual Cleanup (Immediate)**
Use inventory adjustment to correct the duplicate balances:
1. Identify which location is correct (check physical inventory)
2. Use stock adjustment to zero out the incorrect balance
3. Verify ledger entries are correct

**Option 2: Cleanup Script (Comprehensive)**
Create a script to:
1. Find all pallets with balances in multiple locations
2. Check ledger to determine correct location
3. Generate adjustment transactions to fix duplicates
4. Generate report of corrections made

**Option 3: Prevent at Source**
Ensure all move operations:
1. Properly deduct from source location
2. Properly add to destination location
3. Use dual-entry ledger pattern
4. Validate balances after move

---

## 🧪 Testing Checklist

- [x] TypeScript compilation passes
- [ ] Test with pallet in single location (normal case)
- [ ] Test with pallet in multiple locations (edge case)
- [ ] Verify warning UI displays correctly
- [ ] Verify location selector works
- [ ] Verify move validation blocks if no selection
- [ ] Verify partial move works with selected location
- [ ] Verify offline mode still works
- [ ] Test actual move creates correct ledger entries

---

## 📊 Impact Assessment

### Affected Users
- Warehouse staff using `/mobile/transfer` for stock movements
- Inventory managers viewing balance reports
- Anyone relying on accurate stock levels

### Data Integrity
- **High risk** of continued data corruption without this fix
- Existing duplicate balances require cleanup
- Future moves now safe from this bug

### Business Impact
- Inventory accuracy improved
- Prevents stock discrepancies
- Reduces manual reconciliation work

---

## 💡 Prevention Measures

1. **Always validate source location** before creating moves
2. **Show explicit warnings** when data anomalies detected
3. **Force user confirmation** for operations that could corrupt data
4. **Add database constraints** to prevent duplicate pallet-location pairs
5. **Implement integrity checks** in move API to detect orphaned balances

---

## 📝 Next Steps

1. ✅ Fix mobile transfer code (COMPLETED)
2. ⏳ Test the fix thoroughly
3. ⏳ Deploy to production
4. ⏳ Create cleanup script for existing duplicates
5. ⏳ Add database constraint to prevent future duplicates
6. ⏳ Review all move operations for similar issues
7. ⏳ Add automated tests for multi-location scenarios

---

## 🔗 Related Documentation

- `docs/FACE_SHEET_STOCK_RESERVATION_COMPLETE.md` - Stock reservation patterns
- `docs/fixes/WORKFLOW_FIX_SUMMARY.md` - Move workflow documentation
- `supabase/migrations/015_add_move_to_ledger_trigger.sql` - Move ledger trigger

---

**Status:** ✅ Fix implemented, awaiting testing and deployment
