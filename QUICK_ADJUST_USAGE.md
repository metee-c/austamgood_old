# Quick Adjust - Usage Guide

## Overview

The Quick Adjust feature allows you to directly adjust inventory quantities in preparation areas without going through the full Stock Adjustment workflow.

**Status**: ✅ Reservation system removed - no constraints on adjustments

## How to Use

### From the UI

1. Navigate to **Warehouse → Preparation Area Inventory** (`/warehouse/preparation-area-inventory`)
2. Find the SKU you want to adjust
3. Click on the **"ชิ้นรวม" (Total Pieces)** column value
4. A modal will appear showing:
   - Current quantity
   - Input field for new quantity
   - Reason field (optional)
5. Enter the actual quantity you counted
6. Click **"บันทึก" (Save)**
7. The system will automatically:
   - Calculate the difference
   - Update the first pallet's quantity
   - Log the adjustment in the inventory ledger
   - Refresh the display

### Via API

**Endpoint**: `POST /api/inventory/prep-area-balances/adjust`

**Request Body**:
```json
{
  "warehouse_id": "WH001",
  "location_id": "PK001",
  "sku_id": "B-BEY-C|SAL|070",
  "actual_piece_qty": 378,
  "reason": "Physical count adjustment"
}
```

**Response (Success)**:
```json
{
  "success": true,
  "message": "Successfully adjusted inventory by -10 pieces",
  "data": {
    "previous_qty": 388,
    "actual_qty": 378,
    "difference": -10,
    "adjusted_pallet": "ATG2500015252"
  }
}
```

**Response (No Change)**:
```json
{
  "success": true,
  "message": "No adjustment needed - quantity matches",
  "data": {
    "current_qty": 388,
    "actual_qty": 388,
    "difference": 0
  }
}
```

## How It Works

### When Stock Exists

1. System fetches all pallets for the SKU in the location
2. Calculates total current quantity
3. Calculates difference: `actual_qty - current_qty`
4. Updates the first pallet by the difference amount
5. Logs the adjustment in `wms_inventory_ledger`
6. Triggers update to `preparation_area_inventory`

### When No Stock Exists

1. System detects no existing inventory
2. Creates a new balance record with:
   - Pallet ID: `ADJ-{timestamp}`
   - Quantity: The actual quantity you entered
3. Logs the adjustment in `wms_inventory_ledger`
4. Triggers update to `preparation_area_inventory`

## Important Notes

### ✅ What You Can Do

- Adjust quantities up or down freely
- Adjust to zero (will reduce first pallet to 0)
- Adjust SKUs with no existing stock (creates new record)
- Make multiple adjustments in succession

### ⚠️ What to Know

- **No Reservation Checks**: The system no longer validates against reserved quantities
- **First Pallet Adjusted**: When multiple pallets exist, only the first one is adjusted
- **Automatic Logging**: All adjustments are logged in the inventory ledger
- **Real-time Update**: The preparation area inventory view updates immediately

### 🔍 Tracking Adjustments

All adjustments are logged in `wms_inventory_ledger` with:
- Transaction type: `adjustment_increase` or `adjustment_decrease`
- Reference number: `QUICK-ADJ-{timestamp}`
- Remarks: Your reason or "Quick adjustment from prep area inventory page"

You can query adjustments:
```sql
SELECT * FROM wms_inventory_ledger
WHERE transaction_type IN ('adjustment_increase', 'adjustment_decrease')
  AND reference_no LIKE 'QUICK-ADJ-%'
ORDER BY created_at DESC;
```

## Examples

### Example 1: Reduce Quantity

**Scenario**: Physical count shows 378 pieces, system shows 388

**Action**: Enter 378 in the modal

**Result**:
- First pallet reduced by 10 pieces
- Ledger entry: `adjustment_decrease` for 10 pieces
- Display updates to show 378 pieces

### Example 2: Increase Quantity

**Scenario**: Physical count shows 400 pieces, system shows 388

**Action**: Enter 400 in the modal

**Result**:
- First pallet increased by 12 pieces
- Ledger entry: `adjustment_increase` for 12 pieces
- Display updates to show 400 pieces

### Example 3: New Stock

**Scenario**: SKU is mapped to PK001 but has no stock yet

**Action**: Enter 50 in the modal

**Result**:
- New balance record created with pallet ID `ADJ-{timestamp}`
- Quantity set to 50 pieces
- Ledger entry: `adjustment_increase` for 50 pieces
- Display shows 50 pieces

## Troubleshooting

### Error: "Missing required fields"
- Ensure all required fields are provided: `warehouse_id`, `location_id`, `sku_id`, `actual_piece_qty`

### Error: "Failed to fetch current balances"
- Check database connection
- Verify warehouse_id, location_id, and sku_id are valid

### Error: "Failed to update inventory"
- Check database permissions
- Verify the balance record exists and is not locked

### Modal doesn't open
- Ensure you're clicking on the "ชิ้นรวม" (Total Pieces) column
- Check browser console for JavaScript errors

## Related Documentation

- [Preparation Area Inventory System](docs/warehouse/PREP_AREA_INVENTORY_FIX.md)
- [Reservation System Removal](docs/warehouse/RESERVATION_SYSTEM_REMOVAL.md)
- [Quick Adjust Feature](docs/warehouse/QUICK_ADJUST_FEATURE.md)
- [Migration 286 - Latest Pallet Dates](docs/warehouse/MIGRATION_286_VERIFICATION.md)

---

**Last Updated**: January 22, 2026  
**Version**: 2.0 (Post-Reservation Removal)
