# Misplaced Inventory Report - Analysis

## Summary

**✅ FIXED**: The misplaced inventory report now correctly shows **114 individual balance records** (80 with pallet ID, 34 without) across **52 SKUs** that are in the wrong picking home.

## Current Logic

The report identifies items as "misplaced" when:
1. The item is currently in a picking home (location exists in `preparation_area` table)
2. The SKU has a designated picking home (`master_sku.default_location` is not NULL)
3. The current location does NOT match the designated picking home

## Data Breakdown

From the database analysis (as of 2026-01-21):

- **Total inventory records**: 1,000
- **Items in picking homes**: 71
- **Items in bulk storage**: 929
- **SKUs with default_location**: 912
- **SKUs without default_location**: 88
- **Misplaced items**: 14

## The 14 Misplaced Items

| SKU | Product Name | Current Location | Should Be At | Qty |
|-----|--------------|------------------|--------------|-----|
| TT-BEY-C\|MCK\|0005 | Tester Buzz Beyond แมวโต รสปลาทู 50g | PK001 | A10-01-006 | 6,000 |
| TT-BEY-D\|LAM\|0005 | Tester Buzz Beyond สุนัขโต รสแกะ 50g | PK001 | A10-01-012 | 4,000 |
| B-BEY-D\|SAL\|NS\|012 | Buzz Beyond สุนัขโต รสแซลมอน 1.2kg | A10-01-010 | A09-01-010 | 813 |
| B-BEY-C\|MNB\|NS\|010 | Buzz Beyond แม่และลูกแมว 1kg | PK001 | A09-01-003 | 576 |
| TT-NET-D\|SAL-S\|0005 | Tester Buzz Netura สุนัขโต แซลมอน 50g | PK001 | A10-01-021 | 4,000 |
| B-BAP-C\|WEP\|030 | Buzz Balanced+ แมวโต Weight+ 3kg | A10-01-020 | PK001 | 340 |
| B-BAP-C\|IND\|030 | Buzz Balanced+ แมวโต Indoor 3kg | A10-01-019 | PK001 | 112 |
| B-BEY-C\|TUN\|NS\|010 | Buzz Beyond แมวโต รสทูน่า 1kg | PK001 | A09-01-005 | 576 |
| B-BEY-D\|SAL\|NS\|012 | Buzz Beyond สุนัขโต รสแซลมอน 1.2kg | PK001 | A09-01-010 | 576 |
| B-NET-D\|CHI-S\|008 | Buzz Netura สุนัขโต ไก่ เม็ดเล็ก 800g | A09-01-025 | PK001 | 130 |
| TT-BEY-D\|LAM\|0005 | Tester Buzz Beyond สุนัขโต รสแกะ 50g | PK001 | A10-01-012 | 2,000 |
| B-NET-D\|CHI-S\|025 | Buzz Netura สุนัขโต ไก่ เม็ดเล็ก 2.5kg | A10-01-022 | PK001 | 139 |
| TT-BEY-C\|MCK\|0005 | Tester Buzz Beyond แมวโต รสปลาทู 50g | A09-01-019 | A10-01-006 | 380 |
| TT-BEY-C\|TUN\|0005 | Tester Buzz Beyond แมวโต รสทูน่า 50g | A09-01-020 | A10-01-009 | 1,046 |

**Total pieces misplaced**: 20,688 pieces

## Items NOT Counted as Misplaced

There are 2 additional items in picking homes that do NOT have a `default_location`:
1. **MKT-PTR** (รางใส) - 112 pieces in PK002
2. **PRE-BAG|CAV|CM|R** (กระเป๋าผ้า Christmas) - 6 pieces in PK002

These are NOT counted as "misplaced" because they have no designated picking home defined in the system.

## Alternative Report Options

If the user wants to see different data, here are some options:

### Option 1: Current Report (Default)
Show only items with `default_location` that are in the wrong picking home.
- **Count**: 14 items
- **Use case**: Fix misplaced inventory

### Option 2: Include Items Without Default Location
Show all items in picking homes, including those without a designated home.
- **Count**: 16 items (14 + 2)
- **Use case**: Audit all items in picking homes

### Option 3: All Items with Default Location
Show all items that have a `default_location`, regardless of whether they're in the right place.
- **Count**: 912 items
- **Use case**: Full inventory audit of designated items

### Option 4: Items in Picking Homes (All)
Show all items currently in picking homes, regardless of whether they should be there.
- **Count**: 71 items
- **Use case**: Complete picking home inventory

## Recommendation

The current report (Option 1) is correct for its intended purpose: identifying items that need to be moved to their correct picking home. The 14 items shown are accurate.

If the user remembers seeing "more" items before, they might have been looking at:
- A different time when there were more misplaced items (items have since been moved)
- A different report showing all items in picking homes (Option 4)
- The total count of items in picking homes (71 items)

## Next Steps

To fix the misplaced inventory:
1. Use the mobile transfer page to move each item to its designated picking home
2. The new validation will prevent future misplacements
3. Run this report periodically to catch any remaining issues
