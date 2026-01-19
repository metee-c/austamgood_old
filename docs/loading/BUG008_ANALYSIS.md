# BUG #008: Loading Confirmation Fails - Stock Not at Dispatch

## Issue Report
**Date**: 2026-01-18  
**Reporter**: User  
**Severity**: High  
**Status**: Root Cause Identified

## Problem Description
User cannot confirm loading at `http://localhost:3000/mobile/loading/LD-20260116-0005`. The system returns error:
```
❌ Insufficient stock for 1 items
SKU B-BEY-C|MCK|NS|010: need 24, available 0 at Dispatch
```

## Investigation Results

### 1. Loadlist Status
- **Loadlist**: LD-20260116-0005 (ID: 224)
- **Status**: `pending`
- **Created**: 2026-01-15 09:15:01
- **Picklist**: PL-20260115-007 (ID: 295)
- **Picklist Status**: `completed` (already picked)
- **Items**: 46 items in picklist

### 2. Stock Location Analysis
**SKU**: B-BEY-C|MCK|NS|010 (Buzz Beyond แมวโต รสปลาทู | 1 กก. [No Sticker])

**Required**: 24 pieces (from picklist 295)

**Current Stock Locations**:
- **Dispatch**: 0 pieces ❌
- **Delivery-In-Progress**: 1,080 pieces
- **MRTD**: 310 pieces
- **PK001**: 897 pieces (576 + 321)
- **Storage (A06, A09, A10)**: 25,000+ pieces

### 3. Root Cause
**The stock is NOT at Dispatch location** - it's still in:
1. Preparation areas (PK001, MRTD)
2. Storage locations (A06-03-*, A09-04-*, A10-01-*)

The loading confirmation API expects stock to be at **Dispatch** location before loading can proceed.

### 4. Duplicate Picklist Mapping Issue
**Critical Finding**: Picklist 295 is mapped to **TWO loadlists**:
- LD-20260116-0005 (ID: 224) - status: pending
- LD-20260116-0011 (ID: 230) - status: pending

This is a data integrity issue - one picklist should not be assigned to multiple loadlists.

## Workflow Analysis

### Expected Flow
```
1. Pick items → Prep Area (PK001/MRTD)
2. Confirm pick → Move to Dispatch
3. Create loadlist → Map picklist to loadlist
4. Confirm loading → Move from Dispatch to Delivery-In-Progress
```

### Actual Flow (Current Issue)
```
1. Pick items → ✅ Completed (picklist status: completed)
2. Confirm pick → ❌ Stock NOT moved to Dispatch
3. Create loadlist → ✅ Loadlist created
4. Confirm loading → ❌ FAILS - no stock at Dispatch
```

## Questions to Investigate

### Q1: Why is stock not at Dispatch?
**Possible causes**:
- Pick confirmation didn't move stock from prep area to Dispatch
- Stock movement trigger/function failed
- Pick confirmation was done incorrectly
- System bug in pick confirmation flow

### Q2: Why is picklist 295 mapped to two loadlists?
**Possible causes**:
- User created multiple loadlists for same picklist
- System allows duplicate mapping (should be prevented)
- Data corruption

### Q3: Should loading API check prep areas instead of Dispatch?
**Design question**:
- Current: API only checks Dispatch
- Alternative: API could check prep areas (PK001, MRTD) and auto-move to Dispatch
- Trade-off: Flexibility vs. strict workflow enforcement

## Recommended Solutions

### Option 1: Fix Stock Location (Quick Fix)
Manually move stock from prep areas to Dispatch:
```sql
-- Move stock from PK001/MRTD to Dispatch for this SKU
-- This requires careful ledger management
```

### Option 2: Auto-Move from Prep Areas (API Enhancement)
Modify loading API to:
1. Check Dispatch first
2. If not found, check prep areas (PK001, MRTD)
3. Auto-move from prep area to Dispatch
4. Then proceed with loading

### Option 3: Fix Pick Confirmation Flow (Root Cause Fix)
Investigate and fix the pick confirmation process to ensure:
1. Stock moves from prep area to Dispatch when pick is confirmed
2. Add validation to prevent duplicate picklist mapping
3. Add transaction rollback if stock movement fails

## Data Integrity Issues

### Issue 1: Duplicate Picklist Mapping
```
Picklist 295 → LD-20260116-0005 (pending)
Picklist 295 → LD-20260116-0011 (pending)
```
**Impact**: Both loadlists will try to load the same items

**Fix Required**: 
- Remove duplicate mapping
- Add unique constraint: `(picklist_id)` in `wms_loadlist_picklists`
- Or allow but track `loaded_at` to prevent double-loading

### Issue 2: Stock Not at Expected Location
```
Expected: Dispatch
Actual: PK001 (897), MRTD (310), Delivery-In-Progress (1,080)
```
**Impact**: Loading cannot proceed

## Next Steps

1. **Immediate**: Decide on solution approach (Option 1, 2, or 3)
2. **Short-term**: Fix LD-20260116-0005 to allow loading
3. **Long-term**: 
   - Fix pick confirmation flow
   - Add validation for duplicate picklist mapping
   - Add better error messages showing where stock actually is
4. **Testing**: Verify fix doesn't break other loadlists

## Related Files
- `app/api/mobile/loading/complete/route.ts` - Loading confirmation API
- `app/api/mobile/pick/tasks/[id]/route.ts` - Pick confirmation API
- `app/api/picklists/[id]/items/confirm/route.ts` - Picklist item confirmation

## User Impact
- **Severity**: High - Blocks loading operations
- **Workaround**: None currently available
- **Affected Users**: All users trying to load LD-20260116-0005 and similar loadlists
