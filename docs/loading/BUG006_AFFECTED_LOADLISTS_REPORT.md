# BUG-006 Affected Loadlists - Analysis Report

**Date**: 2026-01-18  
**Bug Fix Migration**: 229/230 (applied 2026-01-18)  
**Analysis Script**: `scripts/analyze-bug006-affected-loadlists.js`

## Executive Summary

Out of 28 pending loadlists, **20 have stock shortages** preventing loading completion, while **8 can be completed** without issues.

The shortages are caused by BUG-006: documents picked before Migration 229/230 did not properly move stock to Dispatch/MRTD/PQTD locations.

## Key Findings

### ✅ Loadlists Ready for Loading (8)
These loadlists have sufficient stock at Dispatch and can be completed:

1. **LD-20260116-0014** (ID: 233)
2. **LD-20260116-0017** (ID: 236)
3. **LD-20260119-0002** (ID: 238)
4. **LD-20260119-0005** (ID: 242)
5. **LD-20260117-0001** (ID: 243)
6. **LD-20260119-0006** (ID: 244)
7. **LD-20260119-0008** (ID: 246)
8. **LD-20260116-0022** (ID: 252)

### ❌ Loadlists with Stock Shortages (20)

#### Critical Shortages (Bonus Face Sheets - Tester SKUs)
Many loadlists share the same BFS (BFS-20260115-004) with massive tester shortages:

- **TT-NET-C|SAL|0005**: Need 5,545 pieces total
- **TT-NET-C|FNC|0005**: Need 7,370 pieces total
- **TT-NET-C|CNT|0005**: Need 3,775 pieces total
- **PRE-BAG|SPB|MARKET**: Need 7,780 pieces total
- **TT-NET-C|FHC|0005**: Need 3,135 pieces total

**Affected Loadlists**: LD-20260116-0009, 0010, 0011, 0012, 0016, 0018, 0019, 0020, 0021, LD-20260109-0020, 0021, LD-20260119-0004, 0009

#### Face Sheet Shortages
- **LD-20260115-0023** (ID: 220) - Original BUG-007 case
  - B-BEY-C|MCK|NS|010: shortage 12
  - B-BEY-D|MNB|NS|010: shortage 24

#### Picklist Shortages
- **LD-20260116-0005**: B-BEY-C|MCK|NS|010 shortage 12
- **LD-20260116-0006**: B-BEY-C|LAM|NS|010 shortage 12
- **LD-20260116-0007**: B-BEY-C|TUN|NS|010 shortage 12
- **LD-20260119-0001**: Sticker SKUs shortage (62-7 pieces)
- **LD-20260119-0003**: 02-STICKER-C|SAL|990 shortage 47
- **LD-20260119-0007**: B-BEY-C|SAL|NS|010 shortage 36

## Stock Movement Requirements

### Total Stock to Move to Dispatch

#### Bulk SKUs (from Face Sheets/Picklists)
```
B-BEY-C|MCK|NS|010:    42 pieces
B-BEY-D|MNB|NS|010:    30 pieces
B-BEY-C|LAM|NS|010:    24 pieces
B-BEY-C|TUN|NS|010:    12 pieces
B-BEY-C|SAL|NS|010:    73 pieces
B-BEY-D|SAL|NS|012:     1 piece
B-BEY-C|TUN|010:       74 pieces
B-BEY-D|BEF|012:        2 pieces
B-BEY-C|LAM|070:        2 pieces
B-BEY-D|CNL|100:        2 pieces
B-BEY-C|MNB|NS|010:     6 pieces
B-BEY-D|LAM|NS|012:     6 pieces
B-NET-C|FNC|010:      620 pieces
B-NET-C|SAL|010:       78 pieces
B-NET-C|FNC|040:       20 pieces
B-NET-C|FHC|010:        6 pieces
B-NET-C|CNT|010:        6 pieces
B-NET-C|FHC|040:       24 pieces
B-NET-D|SAL-L|025:      3 pieces
B-NET-D|SAL-S|025:      3 pieces
```

#### Sticker SKUs (from Picklists)
```
02-STICKER-C|FNC|249:  124 pieces
02-STICKER-C|SAL|279:    4 pieces
02-STICKER-C|FNC|890:   14 pieces
02-STICKER-C|SAL|990:   61 pieces
```

### Total Stock to Move to MRTD/PQTD (Bonus Face Sheets)

#### Tester SKUs
```
TT-NET-C|SAL|0005:    5,545 pieces
TT-NET-C|FNC|0005:    7,370 pieces
TT-NET-C|CNT|0005:    3,775 pieces
TT-NET-C|FHC|0005:    3,135 pieces
TT-BEY-C|MCK|0005:      455 pieces
TT-BEY-D|BEF|0005:      220 pieces
TT-BEY-C|SAL|0005:        5 pieces
TT-BEY-D|SAL|0005:        5 pieces
TT-BEY-D|CNL|0005:       25 pieces
TT-BEY-C|MNB|0005:       35 pieces
TT-BAP-C|WEP|0005:       35 pieces
TT-NET-D|CHI-L|0005:     30 pieces
TT-NET-D|CHI-S|0005:    490 pieces
```

#### Premium SKUs
```
PRE-BAG|SPB|MARKET:   7,780 pieces
PRE-CHO|GRE:             45 pieces
PRE-BOW|TILT|CAT:       581 pieces
PRE-BIB-BLUE-M:          10 pieces
PRE-BIB-BLUE-L:          10 pieces
PRE-PWD|L:               20 pieces
PRE-BAG|CAV-PROTEINX:    20 pieces
```

## Root Cause Analysis

### Why Stock is Missing from Dispatch/MRTD/PQTD

**Before Migration 229/230** (BUG-006):
- Pick confirmation did NOT release reservations
- Stock remained in storage locations with active reservations
- Stock was NOT moved to Dispatch (for FS/PL) or prep areas (for BFS)

**After Migration 229/230** (Fixed):
- Pick confirmation properly releases reservations
- Stock correctly moves to Dispatch/prep areas
- New documents work correctly

**Legacy Documents** (picked before fix):
- Still have stock in storage locations
- Reservations may still be active
- Stock never moved to Dispatch/MRTD/PQTD
- Loading completion fails due to insufficient stock at Dispatch

## Recommended Actions

### Option 1: Manual Stock Movement (Immediate Fix)
For each affected loadlist:
1. Identify where stock is currently located (storage locations, prep areas)
2. Use stock movement function to move stock to:
   - **Dispatch** for Face Sheet/Picklist items
   - **MRTD/PQTD** for Bonus Face Sheet items
3. Complete loading

### Option 2: Automated Fix Script (Batch Fix)
Create a script to:
1. Query current stock locations for each shortage SKU
2. Automatically create stock movements to Dispatch/MRTD/PQTD
3. Update inventory balances
4. Log all movements for audit trail

### Option 3: Re-pick Documents (Clean Slate)
For severely affected loadlists:
1. Delete existing Face Sheets/Picklists/Bonus Face Sheets
2. Recreate documents (will use new Migration 229/230 logic)
3. Re-pick items (stock will correctly move to Dispatch/MRTD/PQTD)
4. Complete loading

## Priority Recommendations

### High Priority (Complete First)
The 8 loadlists with no shortages should be completed immediately:
- LD-20260116-0014, 0017, 0022
- LD-20260119-0002, 0005, 0006, 0008
- LD-20260117-0001

### Medium Priority (Fix Bulk SKUs)
Face Sheet and Picklist shortages are smaller and easier to fix:
- LD-20260115-0023 (12-24 pieces)
- LD-20260116-0005, 0006, 0007 (12 pieces each)
- LD-20260119-0001, 0003, 0007 (stickers + bulk)

### Low Priority (Complex BFS Issues)
Bonus Face Sheet shortages are massive and may require:
- Checking if testers are actually available in warehouse
- Possible re-picking or order adjustments
- Coordination with warehouse team

**Affected**: LD-20260116-0009, 0010, 0011, 0012, 0016, 0018, 0019, 0020, 0021, LD-20260109-0020, 0021, LD-20260119-0004, 0009

## Next Steps

1. ✅ **Complete**: Run analysis script
2. ⏳ **Pending**: Review stock locations for shortage SKUs
3. ⏳ **Pending**: Decide on fix approach (manual vs automated)
4. ⏳ **Pending**: Execute stock movements
5. ⏳ **Pending**: Verify loading completion works
6. ⏳ **Pending**: Document final resolution

## Related Documents

- `docs/loading/BUG007_ANALYSIS.md` - Initial bug investigation
- `docs/loading/BUG007_RESOLUTION.md` - Root cause explanation
- `docs/loading/edit02.md` - User instructions and context
- `scripts/analyze-bug006-affected-loadlists.js` - Analysis script
- `supabase/migrations/229_fix_pick_confirmation_reservation_release.sql` - Bug fix migration

---

**Report Generated**: 2026-01-18  
**Status**: Analysis Complete, Awaiting Fix Implementation
