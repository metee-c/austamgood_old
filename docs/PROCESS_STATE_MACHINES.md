# 🔄 WMS Process State Machines
**Date:** 2026-01-06  
**Author:** Principal WMS Architect  
**Status:** MANDATORY IMPLEMENTATION

---

## 📊 EXECUTIVE SUMMARY

This document defines the canonical state machines for all WMS entities. These state machines MUST be enforced at the database level via triggers and constraints, and at the API level via validation.

### Current Issues Found

| Issue | Count | Severity |
|-------|-------|----------|
| Orders stuck in `in_picking` with no picklist items | **6** | 🔴 CRITICAL |
| Orders `picked` but not in any loadlist | **77** | 🟠 HIGH |
| Bonus face sheet stuck in `picking` | **1** | 🟠 HIGH |
| Loadlists `pending` not progressing | **10** | 🟡 MEDIUM |

---

## 1. ORDER STATE MACHINE

### 1.1 Valid States
```
draft → confirmed → in_picking → picked → loaded → in_transit → delivered
                                                              ↘ cancelled
```

### 1.2 State Definitions

| State | Description | Entry Condition | Exit Condition |
|-------|-------------|-----------------|----------------|
| `draft` | Order created, not yet confirmed | Order created | User confirms |
| `confirmed` | Order confirmed, ready for route planning | User action | Added to route plan |
| `in_picking` | Order is being picked | Picklist created with order items | All picklist items picked |
| `picked` | All items picked, ready for loading | All picklist items status='picked' | Added to loadlist |
| `loaded` | Loaded onto vehicle | Loadlist status='loaded' | Vehicle departs |
| `in_transit` | Vehicle en route | Loadlist status='in_transit' | Delivery confirmed |
| `delivered` | Delivered to customer | Driver confirms delivery | Terminal state |
| `cancelled` | Order cancelled | User action | Terminal state |

### 1.3 Allowed Transitions

```sql
-- Valid transitions for wms_orders.status
CASE current_status
  WHEN 'draft' THEN new_status IN ('confirmed', 'cancelled')
  WHEN 'confirmed' THEN new_status IN ('in_picking', 'cancelled')
  WHEN 'in_picking' THEN new_status IN ('picked', 'confirmed', 'cancelled')  -- Allow rollback to confirmed
  WHEN 'picked' THEN new_status IN ('loaded', 'in_picking', 'cancelled')     -- Allow rollback to in_picking
  WHEN 'loaded' THEN new_status IN ('in_transit', 'picked', 'cancelled')     -- Allow rollback to picked
  WHEN 'in_transit' THEN new_status IN ('delivered', 'loaded')               -- Allow rollback to loaded
  WHEN 'delivered' THEN FALSE  -- Terminal state
  WHEN 'cancelled' THEN FALSE  -- Terminal state
END
```

### 1.4 Automatic Transitions (Triggers)

| Trigger Event | From State | To State | Condition |
|---------------|------------|----------|-----------|
| Picklist created | `confirmed` | `in_picking` | Order added to picklist_items |
| All items picked | `in_picking` | `picked` | All picklist_items.status = 'picked' |
| Loadlist loaded | `picked` | `loaded` | Loadlist.status = 'loaded' |
| Loadlist in_transit | `loaded` | `in_transit` | Loadlist.status = 'in_transit' |

---

## 2. PICKLIST STATE MACHINE

### 2.1 Valid States
```
pending → assigned → picking → completed
                            ↘ cancelled
                            ↘ voided
```

### 2.2 State Definitions

| State | Description | Entry Condition | Exit Condition |
|-------|-------------|-----------------|----------------|
| `pending` | Picklist created, not assigned | Picklist created | Employee assigned |
| `assigned` | Assigned to picker | Employee assigned | First item scanned |
| `picking` | Picking in progress | First item scanned | All items picked |
| `completed` | All items picked | All items status='picked' | Terminal state |
| `cancelled` | Picklist cancelled | User action | Terminal state |
| `voided` | Picklist voided (stock returned) | User action with reversal | Terminal state |

### 2.3 Allowed Transitions

```sql
CASE current_status
  WHEN 'pending' THEN new_status IN ('assigned', 'cancelled')
  WHEN 'assigned' THEN new_status IN ('picking', 'pending', 'cancelled')
  WHEN 'picking' THEN new_status IN ('completed', 'assigned', 'cancelled')
  WHEN 'completed' THEN new_status IN ('voided')  -- Only void, not cancel
  WHEN 'cancelled' THEN FALSE
  WHEN 'voided' THEN FALSE
END
```

### 2.4 Automatic Transitions

| Trigger Event | From State | To State | Condition |
|---------------|------------|----------|-----------|
| First scan | `assigned` | `picking` | First picklist_item scanned |
| All items picked | `picking` | `completed` | All picklist_items.status = 'picked' |

---

## 3. LOADLIST STATE MACHINE

### 3.1 Valid States
```
pending → loaded → in_transit → completed
                             ↘ cancelled
                             ↘ voided
```

### 3.2 State Definitions

| State | Description | Entry Condition | Exit Condition |
|-------|-------------|-----------------|----------------|
| `pending` | Loadlist created | Loadlist created | All items loaded |
| `loaded` | All items loaded onto vehicle | Loading complete | Vehicle departs |
| `in_transit` | Vehicle en route | Vehicle departs | All deliveries complete |
| `completed` | All deliveries complete | All stops delivered | Terminal state |
| `cancelled` | Loadlist cancelled | User action | Terminal state |
| `voided` | Loadlist voided | User action with reversal | Terminal state |

### 3.3 Allowed Transitions

```sql
CASE current_status
  WHEN 'pending' THEN new_status IN ('loaded', 'cancelled')
  WHEN 'loaded' THEN new_status IN ('in_transit', 'pending', 'cancelled')
  WHEN 'in_transit' THEN new_status IN ('completed', 'loaded')
  WHEN 'completed' THEN new_status IN ('voided')
  WHEN 'cancelled' THEN FALSE
  WHEN 'voided' THEN FALSE
END
```

---

## 4. ROUTE PLAN STATE MACHINE

### 4.1 Valid States
```
draft → optimizing → published → pending_approval → approved → completed
                                                            ↘ cancelled
```

### 4.2 State Definitions

| State | Description | Entry Condition | Exit Condition |
|-------|-------------|-----------------|----------------|
| `draft` | Plan created | Plan created | Optimization started |
| `optimizing` | Route optimization running | Optimization started | Optimization complete |
| `published` | Routes optimized, ready for review | Optimization complete | Submitted for approval |
| `pending_approval` | Awaiting approval | Submitted | Approved/Rejected |
| `approved` | Plan approved, ready for execution | Approved | All trips completed |
| `completed` | All trips completed | All trips delivered | Terminal state |
| `cancelled` | Plan cancelled | User action | Terminal state |

---

## 5. FACE SHEET STATE MACHINE

### 5.1 Valid States
```
draft → generated → picking → completed
                           ↘ cancelled
```

### 5.2 State Definitions

| State | Description | Entry Condition | Exit Condition |
|-------|-------------|-----------------|----------------|
| `draft` | Face sheet created | Face sheet created | Items generated |
| `generated` | Items generated, ready for picking | Items generated | First item picked |
| `picking` | Picking in progress | First item picked | All items picked |
| `completed` | All items picked | All items picked | Terminal state |
| `cancelled` | Face sheet cancelled | User action | Terminal state |

---

## 6. BONUS FACE SHEET STATE MACHINE

Same as Face Sheet (Section 5).

---

## 7. RECEIVE STATE MACHINE

### 7.1 Valid States (Thai)
```
รอรับเข้า → รับเข้าแล้ว → สำเร็จ
                       ↘ ยกเลิก
```

### 7.2 State Definitions

| State | Description | Entry Condition | Exit Condition |
|-------|-------------|-----------------|----------------|
| `รอรับเข้า` | Receive created, awaiting goods | Receive created | Goods received |
| `รับเข้าแล้ว` | Goods received, awaiting transfer | Goods scanned | All items transferred |
| `สำเร็จ` | All items transferred to storage | All items transferred | Terminal state |
| `ยกเลิก` | Receive cancelled | User action | Terminal state |

---

## 8. CRITICAL FIXES REQUIRED

### 8.1 Fix Orders Stuck in `in_picking`

**Issue:** 6 orders are in `in_picking` status but have no picklist items.

**Root Cause:** Order status was updated to `in_picking` but picklist creation failed or was rolled back.

**Fix:**
```sql
-- Reset orders stuck in in_picking with no picklist items
UPDATE wms_orders o
SET status = 'confirmed'
WHERE o.status = 'in_picking'
AND NOT EXISTS (
    SELECT 1 FROM picklist_items pi WHERE pi.order_id = o.order_id
);
```

### 8.2 Fix Orders `picked` Not in Loadlist

**Issue:** 77 orders are `picked` but not in any loadlist.

**Analysis:** This is expected behavior - orders are picked and waiting to be added to loadlists. However, orders from 2026-01-05 should be investigated.

**Action:** No immediate fix needed, but add monitoring.

### 8.3 Fix Bonus Face Sheet Stuck in `picking`

**Issue:** BFS-20260106-004 is stuck in `picking` status.

**Fix:** Check if all items are picked and update status:
```sql
-- Check and fix bonus face sheet status
UPDATE bonus_face_sheets bfs
SET status = 'completed',
    picking_completed_at = CURRENT_TIMESTAMP
WHERE bfs.id = 28
AND NOT EXISTS (
    SELECT 1 FROM bonus_face_sheet_items bfsi 
    WHERE bfsi.face_sheet_id = bfs.id 
    AND bfsi.status != 'picked'
);
```

---

## 9. DATABASE CONSTRAINTS TO ADD

### 9.1 Order Status Transition Constraint

```sql
CREATE OR REPLACE FUNCTION validate_order_status_transition()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;
    
    IF NOT (
        (OLD.status = 'draft' AND NEW.status IN ('confirmed', 'cancelled')) OR
        (OLD.status = 'confirmed' AND NEW.status IN ('in_picking', 'cancelled')) OR
        (OLD.status = 'in_picking' AND NEW.status IN ('picked', 'confirmed', 'cancelled')) OR
        (OLD.status = 'picked' AND NEW.status IN ('loaded', 'in_picking', 'cancelled')) OR
        (OLD.status = 'loaded' AND NEW.status IN ('in_transit', 'picked', 'cancelled')) OR
        (OLD.status = 'in_transit' AND NEW.status IN ('delivered', 'loaded')) OR
        (OLD.status = 'delivered' AND FALSE) OR
        (OLD.status = 'cancelled' AND FALSE)
    ) THEN
        RAISE EXCEPTION 'Invalid order status transition from % to %', OLD.status, NEW.status;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 9.2 Picklist Status Transition Constraint

```sql
CREATE OR REPLACE FUNCTION validate_picklist_status_transition()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;
    
    IF NOT (
        (OLD.status = 'pending' AND NEW.status IN ('assigned', 'cancelled')) OR
        (OLD.status = 'assigned' AND NEW.status IN ('picking', 'pending', 'cancelled')) OR
        (OLD.status = 'picking' AND NEW.status IN ('completed', 'assigned', 'cancelled')) OR
        (OLD.status = 'completed' AND NEW.status IN ('voided')) OR
        (OLD.status = 'cancelled' AND FALSE) OR
        (OLD.status = 'voided' AND FALSE)
    ) THEN
        RAISE EXCEPTION 'Invalid picklist status transition from % to %', OLD.status, NEW.status;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## 10. API ENFORCEMENT

All APIs that update entity status MUST:

1. **Validate current state** before allowing transition
2. **Log state transitions** to audit table
3. **Update related entities** atomically
4. **Rollback on failure** - no partial state changes

### Example API Pattern

```typescript
// Before updating status
const currentStatus = entity.status;
const newStatus = body.status;

if (!isValidTransition(currentStatus, newStatus)) {
    return NextResponse.json({
        error: `Invalid status transition from ${currentStatus} to ${newStatus}`,
        allowed_transitions: getAllowedTransitions(currentStatus)
    }, { status: 400 });
}

// Update with transaction
const { error } = await supabase.rpc('update_entity_status', {
    entity_id: id,
    new_status: newStatus,
    updated_by: userId
});
```

---

## 11. MONITORING QUERIES

### 11.1 Stuck Orders Detection

```sql
-- Orders stuck in in_picking for more than 24 hours
SELECT order_id, order_no, status, updated_at
FROM wms_orders
WHERE status = 'in_picking'
AND updated_at < NOW() - INTERVAL '24 hours';
```

### 11.2 Orphan Picklist Items

```sql
-- Picklist items without parent picklist
SELECT COUNT(*) FROM picklist_items pi
WHERE NOT EXISTS (SELECT 1 FROM picklists p WHERE p.id = pi.picklist_id);
```

### 11.3 Status Distribution

```sql
-- Daily status distribution
SELECT 
    DATE(created_at) as date,
    status,
    COUNT(*) as count
FROM wms_orders
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at), status
ORDER BY date DESC, count DESC;
```

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-06
