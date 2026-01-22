# Quick Adjust Feature - Preparation Area Inventory

## Overview

The Quick Adjust feature allows warehouse staff to quickly adjust inventory quantities in the Preparation Area Inventory page without going through the full Stock Adjustment workflow. This is designed for fast corrections when physical counts don't match system records.

## User Story

**As a** warehouse manager  
**I want to** quickly adjust inventory quantities directly from the Preparation Area Inventory page  
**So that** I can correct discrepancies immediately without creating formal stock adjustment documents

## Implementation

### 1. API Endpoint

**File:** `app/api/inventory/prep-area-balances/adjust/route.ts`

**Endpoint:** `POST /api/inventory/prep-area-balances/adjust`

**Request Body:**
```json
{
  "warehouse_id": "WH001",
  "location_id": "PK001",
  "sku_id": "SKU-001",
  "actual_piece_qty": 150,
  "reason": "Physical count correction"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully adjusted inventory by +10 pieces",
  "data": {
    "previous_qty": 140,
    "actual_qty": 150,
    "difference": 10,
    "adjusted_pallet": "PLT-001"
  }
}
```

**Logic:**
1. Fetches all pallets for the SKU in the specified location
2. Calculates the difference between actual and current quantity
3. Validates that adjustment won't make available quantity negative
4. Updates the first pallet's quantity by the difference
5. Logs the adjustment in `wms_inventory_ledger` as `adjustment_increase` or `adjustment_decrease`

**Validations:**
- ✅ Actual quantity must not be less than reserved quantity
- ✅ Adjustment must not make any pallet's available quantity negative
- ✅ All required fields must be provided

### 2. UI Component

**File:** `components/warehouse/QuickAdjustModal.tsx`

**Features:**
- Shows current status (total, reserved, available)
- Input field for actual quantity
- Real-time calculation of difference and new available quantity
- Warning if new available quantity would be negative
- Optional reason field
- Validation before submission

**Visual Feedback:**
- Green highlight for increases
- Red highlight for decreases
- Gray for no change
- Warning icon for invalid adjustments

### 3. Page Integration

**File:** `app/warehouse/preparation-area-inventory/page.tsx`

**Changes:**
1. Added import for `QuickAdjustModal`
2. Added state for modal and selected balance
3. Added `handleQuickAdjust` function to open modal
4. Added `handleAdjustSuccess` function to refresh data after adjustment
5. Made "ชิ้นรวม" (total pieces) column clickable with hover effects
6. Added modal component at the bottom of the page

**User Flow:**
1. User clicks on the "ชิ้นรวม" value in the table
2. Modal opens showing current inventory status
3. User enters actual quantity
4. System shows difference and new available quantity
5. User optionally adds a reason
6. User clicks "ยืนยันปรับสต็อก" (Confirm Adjust)
7. System validates and updates inventory
8. Modal closes and table refreshes automatically

## Usage

### For Warehouse Staff

1. Navigate to **สินค้าบ้านหยิบ** (Preparation Area Inventory) page
2. Find the SKU you want to adjust
3. Click on the **ชิ้นรวม** (Total Pieces) number in the green column
4. Enter the actual quantity you counted
5. (Optional) Add a reason for the adjustment
6. Click **ยืนยันปรับสต็อก** (Confirm Adjust)

### Important Notes

- ⚠️ You cannot adjust if it would make available quantity negative
- ⚠️ Actual quantity must be at least equal to reserved quantity
- ℹ️ The adjustment is applied to the first pallet of the SKU in that location
- ℹ️ All adjustments are logged in the inventory ledger for audit purposes

## Database Impact

### Tables Modified

1. **wms_inventory_balances**
   - Updates `total_piece_qty` for the adjusted pallet
   - Updates `updated_at` timestamp

2. **wms_inventory_ledger**
   - Inserts new record with transaction type:
     - `adjustment_increase` if quantity increased
     - `adjustment_decrease` if quantity decreased
   - Records the difference amount
   - Stores the reason (if provided)

### Triggers Affected

- ✅ Standard inventory sync triggers will fire
- ✅ Preparation area inventory view will auto-update

## Testing

### Test Script

Run `node test-quick-adjust-api.js` to test the API logic without making actual changes.

### Manual Testing Checklist

- [ ] Click on "ชิ้นรวม" opens modal
- [ ] Modal shows correct current quantities
- [ ] Entering actual quantity shows correct difference
- [ ] Cannot submit if new available would be negative
- [ ] Cannot submit if actual < reserved
- [ ] Success message appears after adjustment
- [ ] Table refreshes automatically after adjustment
- [ ] Adjustment appears in inventory ledger
- [ ] Preparation area inventory view updates correctly

## Security

- ✅ Requires authentication (uses `createClient` from server)
- ✅ Should be protected by permission guard on the page
- ✅ Validates all inputs server-side
- ✅ Logs all adjustments for audit trail

## Future Enhancements

1. **Bulk Adjust**: Allow adjusting multiple SKUs at once
2. **Photo Upload**: Allow attaching photos of physical count
3. **Approval Workflow**: Require manager approval for large adjustments
4. **History View**: Show adjustment history for each SKU
5. **Barcode Scan**: Scan barcode to select SKU for adjustment

## Related Files

- `app/api/inventory/prep-area-balances/adjust/route.ts` - API endpoint
- `components/warehouse/QuickAdjustModal.tsx` - Modal component
- `app/warehouse/preparation-area-inventory/page.tsx` - Page integration
- `test-quick-adjust-api.js` - Test script
- `supabase/migrations/283_fix_prep_area_inventory_use_mapping.sql` - Preparation area inventory view

## Changelog

### 2026-01-22
- ✅ Created API endpoint for quick adjust
- ✅ Created QuickAdjustModal component
- ✅ Integrated modal into Preparation Area Inventory page
- ✅ Made "ชิ้นรวม" column clickable
- ✅ Added auto-refresh after successful adjustment
- ✅ Created test script and documentation
