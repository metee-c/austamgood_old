# ✅ BUG-007 Resolution: Not a Bug - Actual Stock Shortage

## 📋 Summary

**Status:** RESOLVED - Not a Bug  
**Date:** 2026-01-19  
**Loadlist:** LD-20260115-0023 (ID: 220)

## 🔍 Investigation Results

### Initial Report
User reported "Insufficient stock" error when trying to complete loading for loadlist LD-20260115-0023.

### Log Analysis
```
📦 Matched package IDs from loadlist mapping: []
📋 Document IDs: { picklistIds: [], faceSheetIds: [ 84, 83 ], bonusFaceSheetIds: [] }
📊 SKU B-BEY-C|MCK|NS|010: need 24, available 12 at Dispatch
📊 SKU B-BEY-D|MNB|NS|010: need 36, available 12 at Dispatch
❌ Insufficient stock for 2 items
```

### Database Verification

**Loadlist Composition:**
- Face Sheets: 2 (FS-20260115-000, FS-20260115-001)
- Bonus Face Sheets: 0
- Picklists: 0

**Face Sheet Requirements:**
| SKU | Items | Qty per Item | Total Needed |
|-----|-------|--------------|--------------|
| B-BEY-C\|MCK\|NS\|010 | 2 | 12 | 24 |
| B-BEY-D\|MNB\|NS\|010 | 3 | 12 | 36 |

**Actual Stock at Dispatch:**
| SKU | Total | Reserved | Available |
|-----|-------|----------|-----------|
| B-BEY-C\|MCK\|NS\|010 | 12 | 0 | 12 |
| B-BEY-D\|MNB\|NS\|010 | 12 | 0 | 12 |

## ✅ Conclusion

**This is NOT a bug** - The system is working correctly!

The API correctly identified that:
- Face Sheet items require 24 and 36 pieces
- Dispatch location only has 12 pieces available for each SKU
- Stock is genuinely insufficient

## 🔧 Root Cause

Face Sheet items were confirmed as picked, which should have moved stock to Dispatch. However, the stock at Dispatch is insufficient. Possible reasons:

1. **Stock was used by another loadlist** - Another loadlist may have already consumed the stock
2. **Incomplete stock transfer** - Stock movement from prep areas to Dispatch may not have completed
3. **Multiple Face Sheets sharing same stock** - Other Face Sheets may have reserved/used the same stock

## 📊 Recommended Actions

### 1. Check Stock Movement History
```sql
-- Check ledger entries for these SKUs
SELECT 
  created_at,
  reference_doc_type,
  reference_doc_no,
  from_location_id,
  to_location_id,
  piece_qty_change,
  running_balance_piece_qty
FROM wms_inventory_ledger
WHERE sku_id IN ('B-BEY-C|MCK|NS|010', 'B-BEY-D|MNB|NS|010')
AND (from_location_id = 'Dispatch' OR to_location_id = 'Dispatch')
ORDER BY created_at DESC
LIMIT 20;
```

### 2. Check Other Face Sheets Using Same Stock
```sql
-- Find other Face Sheets with these SKUs
SELECT 
  fs.face_sheet_no,
  fs.status,
  fsi.sku_id,
  SUM(fsi.quantity_picked) as total_picked
FROM face_sheets fs
JOIN face_sheet_items fsi ON fs.id = fsi.face_sheet_id
WHERE fsi.sku_id IN ('B-BEY-C|MCK|NS|010', 'B-BEY-D|MNB|NS|010')
AND fs.status IN ('pending', 'in_progress', 'completed')
GROUP BY fs.face_sheet_no, fs.status, fsi.sku_id
ORDER BY fs.face_sheet_no;
```

### 3. Check Storage Locations for Available Stock
```sql
-- Find stock in storage locations
SELECT 
  location_id,
  sku_id,
  SUM(total_piece_qty) as total_qty,
  SUM(reserved_piece_qty) as reserved_qty,
  SUM(total_piece_qty - reserved_piece_qty) as available_qty
FROM wms_inventory_balances
WHERE warehouse_id = 'WH001'
AND sku_id IN ('B-BEY-C|MCK|NS|010', 'B-BEY-D|MNB|NS|010')
AND total_piece_qty > 0
GROUP BY location_id, sku_id
ORDER BY location_id;
```

### 4. Replenish Stock if Needed
If stock is available in storage locations but not at Dispatch:
1. Create replenishment tasks to move stock from storage to Dispatch
2. Or manually transfer stock using stock movement function

## 📝 Lessons Learned

1. **API is working correctly** - Stock validation logic properly detects insufficient stock
2. **Face Sheet stock flow** - Need to ensure stock is properly moved to Dispatch after pick confirmation
3. **Stock visibility** - Consider adding alerts when Dispatch stock is low for pending loadlists

## 🔗 Related Documents

- `docs/loading/edit01.md` - Original bug report
- `docs/loading/BUG007_ANALYSIS.md` - Detailed analysis
- `scripts/debug-loading-stock-check.js` - Debug script
- `scripts/debug-bfs-stock-check-detailed.js` - BFS-specific debug script

## ✅ Status: CLOSED

**Resolution:** Not a bug - Actual stock shortage at Dispatch location  
**Action Required:** User needs to replenish stock or investigate why stock wasn't moved to Dispatch after Face Sheet pick confirmation
