# Core Database Tables Schema Reference

This document contains the schema information for frequently used database tables in the WMS system. Use this as a quick reference to avoid repeated schema queries.

**Last Updated**: 2026-01-19

---

## Inventory Management Tables

### wms_inventory_balances
**Purpose**: Stores current inventory balance by location and pallet

**Primary Key**: `balance_id` (bigint)

**Columns**:
- `balance_id` - bigint (PK)
- `warehouse_id` - varchar
- `location_id` - varchar
- `sku_id` - varchar
- `pallet_id` - varchar
- `pallet_id_external` - varchar
- `total_piece_qty` - numeric
- `reserved_piece_qty` - numeric
- `production_date` - date
- `expiry_date` - date
- `lot_no` - varchar
- `created_at` - timestamptz
- `updated_at` - timestamptz

**Key Usage**: Stock management, inventory tracking, reservation management

---

### wms_inventory_ledger
**Purpose**: Complete audit trail of all inventory movements

**Primary Key**: `ledger_id` (bigint)

**Columns**:
- `ledger_id` - bigint (PK)
- `movement_at` - timestamptz
- `transaction_type` - varchar
- `direction` - ENUM ('in', 'out')
- `move_item_id` - bigint
- `receive_item_id` - bigint
- `warehouse_id` - varchar
- `location_id` - varchar
- `sku_id` - varchar
- `pallet_id` - varchar
- `pallet_id_external` - varchar
- `production_date` - date
- `expiry_date` - date
- `pack_qty` - numeric
- `piece_qty` - numeric (CHECK: >= 0)
- `reference_no` - varchar
- `remarks` - text
- `created_by` - bigint
- `reference_doc_type` - varchar
- `reference_doc_id` - bigint
- `created_at` - timestamptz
- `updated_at` - timestamptz

**Constraints**:
- `piece_qty` must be >= 0 (use `direction` field to indicate in/out)

**Key Usage**: Transaction history, stock traceability, audit compliance

**Important Note**: There is a trigger that automatically syncs ledger entries to `wms_inventory_balances`

---

## Stock Adjustment Tables

### wms_stock_adjustments
**Purpose**: Header table for stock adjustment documents

**Primary Key**: `adjustment_id` (bigint)

**Columns**:
- `adjustment_id` - bigint (PK)
- `adjustment_no` - varchar
- `warehouse_id` - varchar
- `adjustment_type` - varchar (CHECK: 'increase' OR 'decrease')
- `status` - varchar
- `reason_id` - integer (FK → wms_adjustment_reasons)
- `adjustment_date` - timestamptz
- `reference_no` - varchar
- `remarks` - text
- `created_by` - bigint (FK → master_system_user)
- `approved_by` - bigint (FK → master_system_user)
- `approved_at` - timestamptz
- `rejected_by` - bigint
- `rejected_at` - timestamptz
- `rejection_reason` - text
- `completed_by` - bigint
- `completed_at` - timestamptz
- `cancelled_by` - bigint
- `cancelled_at` - timestamptz
- `cancellation_reason` - text
- `created_at` - timestamptz
- `updated_at` - timestamptz

**Constraints**:
- `adjustment_type` must be 'increase' or 'decrease'
- `reason_id` is required (NOT NULL)

**Key Usage**: Stock corrections, count adjustments, inventory reconciliation

---

### wms_stock_adjustment_items
**Purpose**: Line items for stock adjustments showing before/after quantities

**Primary Key**: `adjustment_item_id` (bigint)

**Columns**:
- `adjustment_item_id` - bigint (PK)
- `adjustment_id` - bigint (FK → wms_stock_adjustments)
- `line_no` - integer
- `sku_id` - varchar
- `location_id` - varchar
- `pallet_id` - varchar
- `pallet_id_external` - varchar
- `lot_no` - varchar
- `production_date` - date
- `expiry_date` - date
- `before_pack_qty` - integer
- `before_piece_qty` - integer
- `adjustment_pack_qty` - integer
- `adjustment_piece_qty` - integer
- `after_pack_qty` - integer
- `after_piece_qty` - integer
- `ledger_id` - bigint
- `remarks` - text
- `created_at` - timestamptz
- `updated_at` - timestamptz

**Key Usage**: Detailed adjustment tracking, audit trail

---

### wms_adjustment_reasons
**Purpose**: Master data for adjustment reason codes

**Primary Key**: `reason_id` (integer)

**Columns**:
- `reason_id` - integer (PK)
- `reason_code` - varchar
- `reason_name_th` - varchar
- `reason_name_en` - varchar
- `reason_type` - varchar ('increase', 'decrease', 'both')
- `requires_approval` - boolean
- `active_status` - varchar
- `display_order` - integer
- `created_at` - timestamptz
- `updated_at` - timestamptz

**Common Reason IDs**:
- 27: DAMAGED - สินค้าเสียหาย (decrease)
- 28: EXPIRED - สินค้าหมดอายุ (decrease)
- 29: LOST - สินค้าสูญหาย (decrease)
- 30: FOUND - พบสินค้าเพิ่ม (increase)
- 31: COUNT_ERROR - ข้อผิดพลาดในการนับ (both)
- 32: SYSTEM_ERROR - ข้อผิดพลาดของระบบ (both)

---

## Master Data Tables

### master_system_user
**Purpose**: User accounts for authentication and audit tracking

**Primary Key**: `user_id` (bigint)

**Key System Users**:
- User ID 1: username='system', full_name='System User'

**Key Usage**: Referenced by created_by, updated_by, approved_by fields in other tables

---

## Table Relationships

```
wms_stock_adjustments
  ├─→ wms_adjustment_reasons (via reason_id)
  ├─→ master_system_user (via created_by)
  ├─→ master_system_user (via approved_by)
  └─→ wms_stock_adjustment_items (one-to-many)
        └─→ wms_inventory_ledger (creates entry)
              └─→ wms_inventory_balances (updates via trigger)
```

---

## Important Notes

1. **Ledger to Balance Sync**: When inserting into `wms_inventory_ledger`, a trigger automatically updates `wms_inventory_balances`. Be careful not to manually update the balance and create a ledger entry, as this will cause double-counting.

2. **Adjustment Workflow**: 
   - Create adjustment header in `wms_stock_adjustments`
   - Create adjustment items in `wms_stock_adjustment_items`
   - Manually update `wms_inventory_balances` OR create ledger entry (not both)
   - If ledger entry is created, the trigger will sync to balance

3. **piece_qty Constraint**: In `wms_inventory_ledger`, `piece_qty` must always be >= 0. Use the `direction` field ('in' or 'out') to indicate the movement direction.

4. **System User**: Always use user_id=1 for system-generated transactions.

---

## Query Examples

### Get inventory balance for a pallet
```sql
SELECT balance_id, location_id, sku_id, pallet_id, 
       total_piece_qty, reserved_piece_qty
FROM wms_inventory_balances
WHERE pallet_id = 'ATG20260105000000003'
  AND sku_id = '00-NET-C|CNT|200';
```

### Create stock adjustment
```sql
-- 1. Create adjustment header
INSERT INTO wms_stock_adjustments (
  adjustment_no, warehouse_id, adjustment_type, status,
  reason_id, adjustment_date, remarks,
  created_by, approved_by, approved_at,
  completed_by, completed_at
) VALUES (
  'ADJ-20260119-001', 'WH001', 'decrease', 'completed',
  31, NOW(), 'Stock correction',
  1, 1, NOW(), 1, NOW()
);

-- 2. Create adjustment item
INSERT INTO wms_stock_adjustment_items (
  adjustment_id, line_no, sku_id, location_id, pallet_id,
  before_piece_qty, adjustment_piece_qty, after_piece_qty
) VALUES (
  (SELECT adjustment_id FROM wms_stock_adjustments WHERE adjustment_no = 'ADJ-20260119-001'),
  1, '00-NET-C|CNT|200', 'AB-BLK-14', 'ATG20260105000000003',
  68, -26, 42
);

-- 3. Update balance
UPDATE wms_inventory_balances
SET total_piece_qty = 42, updated_at = NOW()
WHERE pallet_id = 'ATG20260105000000003';

-- 4. Create ledger entry (optional, will trigger balance update)
INSERT INTO wms_inventory_ledger (
  warehouse_id, location_id, sku_id, pallet_id,
  transaction_type, direction, movement_at, piece_qty,
  reference_doc_type, reference_doc_id, created_by
) VALUES (
  'WH001', 'AB-BLK-14', '00-NET-C|CNT|200', 'ATG20260105000000003',
  'adjustment', 'out', NOW(), 26,
  'stock_adjustment', 
  (SELECT adjustment_id FROM wms_stock_adjustments WHERE adjustment_no = 'ADJ-20260119-001'),
  1
);
```
