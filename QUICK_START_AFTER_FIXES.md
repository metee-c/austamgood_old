# Quick Start Guide - After System Fixes

**Last Updated**: 2025-11-29
**Status**: Production Ready

---

## 🚀 What Changed?

The system now includes **8 major improvements** to prevent stock inconsistencies and workflow errors:

1. ✅ **Stock Reservation Tracking** - Exact balance IDs tracked from reservation to pick
2. ✅ **Pre-Validation** - All-or-nothing operations (no partial failures)
3. ✅ **Automatic Alerts** - Stock shortages create alerts automatically
4. ✅ **State Machine** - Invalid status transitions prevented
5. ✅ **Fixed Triggers** - Correct timing for workflow automation
6. ✅ **Monitoring Views** - Real-time visibility into data quality
7. ✅ **Performance Indexes** - Faster queries on workflow tables
8. ✅ **Enhanced Tracking** - Who picked what, when

---

## 📋 For Developers

### New Tables You Need to Know

#### 1. `picklist_item_reservations`
**Purpose**: Track exact inventory balance used for each picklist item

```sql
-- Check reservations for a picklist
SELECT
    pir.picklist_item_id,
    pir.balance_id,
    pir.reserved_piece_qty,
    pir.status,
    pir.picked_at,
    ib.location_id,
    ib.expiry_date
FROM picklist_item_reservations pir
JOIN wms_inventory_balances ib ON ib.balance_id = pir.balance_id
WHERE pir.picklist_item_id IN (
    SELECT id FROM picklist_items WHERE picklist_id = 123
);
```

**Statuses**:
- `reserved` - Created during picklist creation
- `picked` - Marked during mobile pick scan
- `cancelled` - If picklist cancelled

---

#### 2. `stock_replenishment_alerts`
**Purpose**: Track stock shortage incidents for investigation

```sql
-- Check pending alerts
SELECT
    alert_id,
    location_id,
    sku_id,
    required_qty,
    current_qty,
    shortage_qty,
    priority,
    reference_no,
    created_at
FROM stock_replenishment_alerts
WHERE status = 'pending'
ORDER BY priority DESC, created_at DESC;
```

**Priorities**:
- `urgent` - Created during loading (blocks operation)
- `high` - Significant shortage
- `medium` - Minor shortage
- `low` - Warning only

**Statuses**:
- `pending` - Needs investigation
- `acknowledged` - Team aware, working on it
- `resolved` - Stock replenished

---

### New Monitoring Views

#### 1. `v_reservation_accuracy`
**Purpose**: Find discrepancies between reserved and actual quantities

```sql
-- Find problematic picklists
SELECT *
FROM v_reservation_accuracy
WHERE accuracy_status = 'mismatch'
ORDER BY ABS(reservation_variance) DESC;
```

---

#### 2. `v_workflow_status_overview`
**Purpose**: Complete workflow status by route plan

```sql
-- Check today's routes
SELECT *
FROM v_workflow_status_overview
WHERE route_status IN ('published', 'ready_to_load', 'in_transit')
ORDER BY route_plan_id DESC;
```

---

#### 3. `v_stock_alert_summary`
**Purpose**: Aggregate stock shortage alerts by location/SKU

```sql
-- Find locations with most issues
SELECT *
FROM v_stock_alert_summary
WHERE urgent_count > 0
ORDER BY total_shortage DESC;
```

---

### API Changes

#### 1. `POST /api/picklists/create-from-trip`

**New behavior**:
- ✅ Validates source location exists
- ✅ Validates stock availability BEFORE creating picklist
- ✅ Creates `picklist_item_reservations` with exact balance IDs
- ✅ Rolls back entire picklist if any item fails

**Error responses**:
```typescript
// Source location not found
{ error: "Source location PK001 not found" }  // 400

// Insufficient stock
{
  error: "Insufficient stock for items",
  insufficient_items: [
    {
      sku_id: "B-BEY-C|MNB|010",
      required: 100,
      available: 50,
      shortage: 50
    }
  ]
}  // 400
```

---

#### 2. `POST /api/mobile/pick/scan`

**New behavior**:
- ✅ Uses `picklist_item_reservations` to get exact balance IDs
- ✅ Doesn't re-query FEFO/FIFO (uses reserved balances)
- ✅ Updates reservation status to `picked`
- ✅ Tracks `picked_at` timestamp

**What this fixes**:
- No more "picked from wrong balance" issues
- Guaranteed consistency between reservation and pick
- Audit trail of who picked what when

---

#### 3. `POST /api/mobile/loading/complete`

**New behavior**:
- ✅ Pre-validates ALL items before processing ANY
- ✅ Fails entire request if ANY item has insufficient stock
- ✅ Creates `stock_replenishment_alerts` automatically
- ✅ Provides detailed error response

**Error responses**:
```typescript
{
  error: "ไม่สามารถโหลดสินค้าได้: สต็อคที่ Dispatch ไม่เพียงพอ",
  insufficient_items: [
    {
      sku_id: "B-BEY-C|MNB|010",
      required: 100,
      available: 50,
      shortage: 50
    }
  ],
  alerts_created: 1
}  // 400
```

**What this fixes**:
- No more partial loading operations
- Alerts created automatically for investigation
- Clear error messages to warehouse workers

---

## 📊 For Product Managers / Operations

### New Workflow Rules

#### Order Status Transitions
```
draft → confirmed → in_picking → picked → loaded → in_transit → delivered
```

**Enforced by database** - Cannot skip statuses or go backwards

---

#### Picklist Status Transitions
```
pending → assigned → picking → completed
```

**Enforced by database** - Worker must be assigned before picking starts

---

#### Loadlist Status Transitions
```
pending → loaded → completed
```

**Enforced by database** - Must scan all items before marking loaded

---

#### Route Plan Status Transitions
```
draft → published → ready_to_load → in_transit → completed
```

**Enforced by database** - Each status requires specific conditions:
- `published` - Route optimization complete
- `ready_to_load` - All picklists completed
- `in_transit` - All loadlists loaded
- `completed` - All orders delivered

---

### Stock Alert Management

#### When Alerts Are Created
- **Automatically during loading** if stock insufficient at Dispatch
- **Priority**: Always `urgent` for loading operations
- **Reference**: Includes loadlist code for traceability

#### How to Handle Alerts

1. **View pending alerts**:
```sql
SELECT * FROM stock_replenishment_alerts
WHERE status = 'pending'
ORDER BY priority DESC, created_at DESC;
```

2. **Acknowledge alert** (you're working on it):
```sql
UPDATE stock_replenishment_alerts
SET status = 'acknowledged'
WHERE alert_id = 123;
```

3. **Resolve alert** (stock replenished):
```sql
UPDATE stock_replenishment_alerts
SET
    status = 'resolved',
    resolved_at = NOW(),
    resolved_by = 'user-uuid',
    resolution_notes = 'Transferred from warehouse B'
WHERE alert_id = 123;
```

---

## 🧪 Testing After Deployment

### Test 1: Create Picklist with Stock Validation
```bash
# Should succeed (sufficient stock)
curl -X POST http://localhost:3000/api/picklists/create-from-trip \
  -H "Content-Type: application/json" \
  -d '{
    "trip_id": 123,
    "source_location_id": "PK001"
  }'

# Expected: Picklist created + reservations created
```

### Test 2: Pick with Reservation Tracking
```bash
# Scan item to pick
curl -X POST http://localhost:3000/api/mobile/pick/scan \
  -H "Content-Type: application/json" \
  -d '{
    "picklist_id": 123,
    "item_id": 456,
    "scanned_sku_id": "B-BEY-C|MNB|010",
    "employee_id": 1
  }'

# Expected: Stock moved + reservation marked 'picked'
```

### Test 3: Loading with Pre-Validation
```bash
# Test with insufficient stock at Dispatch
curl -X POST http://localhost:3000/api/mobile/loading/complete \
  -H "Content-Type: application/json" \
  -d '{
    "loadlist_code": "LD-20251129-0001",
    "warehouse_id": "WH001"
  }'

# Expected: 400 error + alerts created if insufficient
# Expected: 200 success + all items loaded if sufficient
```

### Test 4: Invalid Status Transition
```sql
-- Try to skip statuses (should fail)
UPDATE wms_orders
SET status = 'delivered'
WHERE order_id = 'ORD-001' AND status = 'draft';

-- Expected: ERROR with message about invalid transition
```

---

## 🐛 Troubleshooting

### Issue: "Stock shortage but no alert created"
**Check**:
```sql
SELECT * FROM stock_replenishment_alerts
WHERE reference_no = 'LD-20251129-0001';
```

**Fix**: Alert should be created automatically. If not, check API logs.

---

### Issue: "Picked wrong balance (FEFO mismatch)"
**Check**:
```sql
SELECT
    pi.picklist_id,
    pi.id AS picklist_item_id,
    pi.sku_id,
    pir.balance_id AS reserved_balance,
    pir.status
FROM picklist_items pi
LEFT JOIN picklist_item_reservations pir ON pir.picklist_item_id = pi.id
WHERE pi.picklist_id = 123;
```

**Fix**: Reservations should be created during picklist creation. If missing, check picklist creation API.

---

### Issue: "Invalid status transition error"
**Check**:
```sql
SELECT status FROM wms_orders WHERE order_id = 'ORD-001';
```

**Fix**: Update status in correct sequence:
```sql
-- Correct sequence
UPDATE wms_orders SET status = 'confirmed' WHERE order_id = 'ORD-001' AND status = 'draft';
UPDATE wms_orders SET status = 'in_picking' WHERE order_id = 'ORD-001' AND status = 'confirmed';
-- etc.
```

---

### Issue: "Reservation shows 'reserved' but item already picked"
**Check**:
```sql
SELECT
    pir.reservation_id,
    pir.status,
    pir.picked_at,
    pi.status AS item_status
FROM picklist_item_reservations pir
JOIN picklist_items pi ON pi.id = pir.picklist_item_id
WHERE pi.picklist_id = 123;
```

**Fix**: Reservation status should update to 'picked' automatically. If not, check mobile pick API.

---

## 📖 Documentation References

- **Complete Implementation**: `FIXES_IMPLEMENTATION_SUMMARY.md`
- **System Audit Report**: `SYSTEM_AUDIT_REPORT_2025-11-29.md`
- **Workflow Design**: `docs-archive/workflow/WORKFLOW_IMPLEMENTATION_SUMMARY.md`
- **Database Schema**: `supabase/DATABASE_DOCUMENTATION.md` (if available)

---

## 🎯 Key Takeaways

1. **Stock is now tracked end-to-end** - From reservation to pick to loading
2. **Operations are all-or-nothing** - No more partial failures
3. **Alerts are automatic** - System tells you when stock is insufficient
4. **Workflow is enforced** - Database prevents invalid status transitions
5. **Monitoring is built-in** - Views show data quality in real-time

---

**Questions?** Check the full implementation summary or contact the development team.
