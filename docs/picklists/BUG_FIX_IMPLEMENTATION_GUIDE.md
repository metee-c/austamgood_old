# 🔧 Bug Fix Implementation Guide

**Date:** January 17, 2026  
**Target:** Stock Management Race Conditions  
**Priority:** P0 - CRITICAL

---

## 📋 Overview

This guide provides step-by-step instructions for implementing fixes to the critical stock management bugs identified in the Picklist, Face Sheet, and Loadlist system.

---

## 🎯 Fix #1: Add Row-Level Locking (P0 - CRITICAL)

### Problem
Concurrent requests can read the same stock availability and both reserve it, causing overselling.

### Solution
Add `FOR UPDATE` clause to lock rows during transaction.

### Implementation

#### Step 1: Update Picklist Reservation Function

**File:** Create new migration `supabase/migrations/220_add_row_locking_to_reservations.sql`

```sql
-- Migration: Add row-level locking to all reservation functions
-- Priority: P0 - CRITICAL
-- Date: 2026-01-17

-- ============================================================================
-- PART 1: Update reserve_stock_for_face_sheet_items
-- ============================================================================

CREATE OR REPLACE FUNCTION reserve_stock_for_face_sheet_items(
  p_face_sheet_id BIGINT,
  p_warehouse_id VARCHAR DEFAULT 'WH001',
  p_reserved_by VARCHAR DEFAULT 'System'
)
RETURNS TABLE(
  success BOOLEAN,
  items_reserved INTEGER,
  message TEXT,
  insufficient_stock_items JSONB
) LANGUAGE plpgsql AS $func$
DECLARE
  v_item RECORD;
  v_balance RECORD;
  v_items_reserved INTEGER := 0;
  v_insufficient_items JSONB := '[]'::JSONB;
  v_qty_needed NUMERIC;
  v_qty_reserved NUMERIC;
  v_qty_per_pack INTEGER;
BEGIN
  -- Loop through each face_sheet_item
  FOR v_item IN
    SELECT 
      fsi.id as item_id,
      fsi.sku_id,
      fsi.quantity as qty_needed,
      fsi.uom
    FROM face_sheet_items fsi
    WHERE fsi.face_sheet_id = p_face_sheet_id
    AND COALESCE(fsi.status, 'pending') = 'pending'
    ORDER BY fsi.id
  LOOP
    -- Get qty_per_pack
    SELECT COALESCE(qty_per_pack, 1) INTO v_qty_per_pack
    FROM master_sku
    WHERE sku_id = v_item.sku_id;
    
    v_qty_needed := v_item.qty_needed;
    v_qty_reserved := 0;
    
    -- ✅ FIX: Add FOR UPDATE to lock rows
    FOR v_balance IN
      SELECT 
        ib.balance_id,
        ib.location_id,
        ib.total_piece_qty,
        ib.reserved_piece_qty,
        ib.total_piece_qty - ib.reserved_piece_qty as available_qty,
        ib.expiry_date,
        ib.production_date
      FROM wms_inventory_balances ib
      JOIN master_location ml ON ml.location_id = ib.location_id
      WHERE ib.warehouse_id = p_warehouse_id
      AND ib.sku_id = v_item.sku_id
      AND ib.total_piece_qty > ib.reserved_piece_qty
      AND ml.location_type IN ('floor', 'rack', 'bulk')
      AND ml.active_status = 'active'
      ORDER BY 
        ib.expiry_date ASC NULLS LAST,
        ib.production_date ASC NULLS LAST,
        ib.balance_id ASC
      FOR UPDATE OF ib  -- ✅ CRITICAL: Lock rows
    LOOP
      EXIT WHEN v_qty_reserved >= v_qty_needed;
      
      DECLARE
        v_qty_to_reserve NUMERIC;
        v_pack_to_reserve NUMERIC;
      BEGIN
        v_qty_to_reserve := LEAST(v_balance.available_qty, v_qty_needed - v_qty_reserved);
        v_pack_to_reserve := v_qty_to_reserve / v_qty_per_pack;
        
        -- Update inventory balance
        UPDATE wms_inventory_balances
        SET 
          reserved_piece_qty = reserved_piece_qty + v_qty_to_reserve,
          reserved_pack_qty = reserved_pack_qty + v_pack_to_reserve,
          updated_at = CURRENT_TIMESTAMP
        WHERE balance_id = v_balance.balance_id;
        
        -- Insert reservation record
        INSERT INTO face_sheet_item_reservations (
          face_sheet_item_id,
          balance_id,
          reserved_piece_qty,
          reserved_pack_qty,
          status,
          reserved_at
        ) VALUES (
          v_item.item_id,
          v_balance.balance_id,
          v_qty_to_reserve,
          v_pack_to_reserve,
          'reserved',
          CURRENT_TIMESTAMP
        );
        
        v_qty_reserved := v_qty_reserved + v_qty_to_reserve;
      END;
    END LOOP;
    
    -- Check if we reserved enough
    IF v_qty_reserved >= v_qty_needed THEN
      v_items_reserved := v_items_reserved + 1;
      
      UPDATE face_sheet_items
      SET status = 'reserved'
      WHERE id = v_item.item_id;
    ELSE
      v_insufficient_items := v_insufficient_items || jsonb_build_object(
        'item_id', v_item.item_id,
        'sku_id', v_item.sku_id,
        'qty_needed', v_qty_needed,
        'qty_reserved', v_qty_reserved,
        'qty_short', v_qty_needed - v_qty_reserved
      );
    END IF;
  END LOOP;
  
  -- Return result
  IF jsonb_array_length(v_insufficient_items) > 0 THEN
    RETURN QUERY SELECT 
      FALSE,
      v_items_reserved,
      'มีบางรายการที่สต็อคไม่เพียงพอ'::TEXT,
      v_insufficient_items;
  ELSE
    RETURN QUERY SELECT 
      TRUE,
      v_items_reserved,
      format('จองสต็อคสำเร็จ %s รายการ', v_items_reserved)::TEXT,
      '[]'::JSONB;
  END IF;
END;
$func$;

-- ============================================================================
-- PART 2: Update reserve_stock_for_bonus_face_sheet_items
-- ============================================================================

CREATE OR REPLACE FUNCTION reserve_stock_for_bonus_face_sheet_items(
  p_bonus_face_sheet_id BIGINT,
  p_warehouse_id VARCHAR DEFAULT 'WH001',
  p_reserved_by VARCHAR DEFAULT 'System'
)
RETURNS TABLE (
  success BOOLEAN,
  items_reserved INTEGER,
  items_total INTEGER,
  message TEXT
) LANGUAGE plpgsql AS $func$
DECLARE
  v_item RECORD;
  v_balance RECORD;
  v_items_count INTEGER := 0;
  v_items_reserved INTEGER := 0;
  v_remaining_qty NUMERIC;
  v_qty_to_reserve NUMERIC;
  v_pack_to_reserve NUMERIC;
  v_qty_per_pack NUMERIC;
  v_prep_area_zones TEXT[];
  v_prep_area_location_ids TEXT[];
BEGIN
  -- Get preparation area zones
  SELECT ARRAY_AGG(DISTINCT zone) INTO v_prep_area_zones
  FROM preparation_area
  WHERE zone IS NOT NULL;

  -- Get location IDs in prep areas
  SELECT ARRAY_AGG(location_id) INTO v_prep_area_location_ids
  FROM master_location
  WHERE warehouse_id = p_warehouse_id
    AND zone = ANY(v_prep_area_zones);

  IF v_prep_area_location_ids IS NULL OR ARRAY_LENGTH(v_prep_area_location_ids, 1) = 0 THEN
    RETURN QUERY SELECT false, 0, 0, 'No preparation area locations found';
    RETURN;
  END IF;

  -- Loop through items
  FOR v_item IN
    SELECT
      bfsi.id,
      bfsi.sku_id,
      bfsi.source_location_id,
      bfsi.quantity_to_pick,
      COALESCE(ms.qty_per_pack, 1) as qty_per_pack
    FROM bonus_face_sheet_items bfsi
    LEFT JOIN master_sku ms ON bfsi.sku_id = ms.sku_id
    WHERE bfsi.face_sheet_id = p_bonus_face_sheet_id
      AND bfsi.quantity_to_pick > 0
      AND bfsi.sku_id IS NOT NULL
    ORDER BY bfsi.id
  LOOP
    v_items_count := v_items_count + 1;
    v_remaining_qty := v_item.quantity_to_pick;
    v_qty_per_pack := v_item.qty_per_pack;

    -- ✅ FIX: Add FOR UPDATE to lock rows
    FOR v_balance IN
      SELECT
        balance_id,
        location_id,
        total_piece_qty,
        reserved_piece_qty,
        total_pack_qty,
        reserved_pack_qty,
        production_date,
        expiry_date,
        lot_no,
        (total_piece_qty - COALESCE(reserved_piece_qty, 0)) as available_piece_qty
      FROM wms_inventory_balances
      WHERE warehouse_id = p_warehouse_id
        AND sku_id = v_item.sku_id
        AND (total_piece_qty - COALESCE(reserved_piece_qty, 0)) > 0
        AND location_id = ANY(v_prep_area_location_ids)
        AND (v_item.source_location_id IS NULL OR location_id = v_item.source_location_id)
      ORDER BY
        CASE WHEN expiry_date IS NULL THEN 1 ELSE 0 END,
        expiry_date ASC NULLS LAST,
        production_date ASC NULLS LAST,
        lot_no ASC NULLS LAST,
        balance_id ASC
      FOR UPDATE  -- ✅ CRITICAL: Lock rows
    LOOP
      IF v_remaining_qty <= v_balance.available_piece_qty THEN
        v_qty_to_reserve := v_remaining_qty;
      ELSE
        v_qty_to_reserve := v_balance.available_piece_qty;
      END IF;

      v_pack_to_reserve := v_qty_to_reserve / v_qty_per_pack;

      -- Update balance
      UPDATE wms_inventory_balances
      SET
        reserved_piece_qty = COALESCE(reserved_piece_qty, 0) + v_qty_to_reserve,
        reserved_pack_qty = COALESCE(reserved_pack_qty, 0) + v_pack_to_reserve,
        updated_at = CURRENT_TIMESTAMP
      WHERE balance_id = v_balance.balance_id;

      -- Insert reservation
      INSERT INTO bonus_face_sheet_item_reservations (
        bonus_face_sheet_item_id,
        balance_id,
        reserved_piece_qty,
        reserved_pack_qty,
        reserved_by,
        status
      ) VALUES (
        v_item.id,
        v_balance.balance_id,
        v_qty_to_reserve,
        v_pack_to_reserve,
        p_reserved_by,
        'reserved'
      );

      v_remaining_qty := v_remaining_qty - v_qty_to_reserve;

      IF v_remaining_qty <= 0 THEN
        v_items_reserved := v_items_reserved + 1;
        EXIT;
      END IF;
    END LOOP;
  END LOOP;

  -- Return result
  IF v_items_count = 0 THEN
    RETURN QUERY SELECT false, 0, 0, 'No items to reserve';
  ELSIF v_items_reserved = v_items_count THEN
    RETURN QUERY SELECT true, v_items_reserved, v_items_count,
      format('Reserved %s/%s items successfully', v_items_reserved, v_items_count);
  ELSE
    RETURN QUERY SELECT false, v_items_reserved, v_items_count,
      format('Partial reservation: %s/%s items', v_items_reserved, v_items_count);
  END IF;
END;
$func$;

-- Add comments
COMMENT ON FUNCTION reserve_stock_for_face_sheet_items IS 
  'จองสต็อคสำหรับใบปะหน้า (FEFO+FIFO) - ✅ WITH ROW LOCKING';

COMMENT ON FUNCTION reserve_stock_for_bonus_face_sheet_items IS
  'จองสต็อคสำหรับใบปะหน้าของแถม (FEFO+FIFO) - ✅ WITH ROW LOCKING';
```

#### Step 2: Apply Migration

```bash
# Connect to database
psql -h localhost -U postgres -d austamgood_wms

# Run migration
\i supabase/migrations/220_add_row_locking_to_reservations.sql

# Verify functions updated
\df reserve_stock_for_face_sheet_items
\df reserve_stock_for_bonus_face_sheet_items
```

#### Step 3: Test

```typescript
// Test concurrent reservations
describe('Row Locking Test', () => {
  it('should prevent overselling with concurrent requests', async () => {
    // Create balance with 100 pieces
    await createBalance({ sku_id: 'TEST-001', total_piece_qty: 100 });
    
    // 3 concurrent requests each trying to reserve 80
    const promises = [
      createFaceSheet({ items: [{ sku_id: 'TEST-001', qty: 80 }] }),
      createFaceSheet({ items: [{ sku_id: 'TEST-001', qty: 80 }] }),
      createFaceSheet({ items: [{ sku_id: 'TEST-001', qty: 80 }] })
    ];
    
    const results = await Promise.allSettled(promises);
    
    // Only 1 should succeed
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    expect(succeeded).toBe(1);
    
    // Verify no overselling
    const balance = await getBalance('TEST-001');
    expect(balance.reserved_piece_qty).toBeLessThanOrEqual(100);
  });
});
```

---

## 🎯 Fix #2: Wrap Operations in Single Transaction (P0 - CRITICAL)

### Problem
Face sheet creation and stock reservation are separate RPC calls. If reservation fails, face sheet already exists.

### Solution
Create single database function that does both operations atomically.

### Implementation

#### Step 1: Create Combined Function

**File:** Create new migration `supabase/migrations/221_create_atomic_face_sheet_creation.sql`

```sql
-- Migration: Create atomic face sheet creation with reservation
-- Priority: P0 - CRITICAL
-- Date: 2026-01-17

CREATE OR REPLACE FUNCTION create_face_sheet_with_reservation(
  p_warehouse_id VARCHAR,
  p_delivery_date DATE,
  p_order_ids BIGINT[],
  p_created_by VARCHAR DEFAULT 'System'
)
RETURNS TABLE(
  success BOOLEAN,
  face_sheet_id BIGINT,
  face_sheet_no VARCHAR,
  items_reserved INTEGER,
  message TEXT,
  insufficient_stock_items JSONB
) LANGUAGE plpgsql AS $func$
DECLARE
  v_face_sheet_id BIGINT;
  v_face_sheet_no VARCHAR;
  v_reserve_result RECORD;
BEGIN
  -- STEP 1: Generate face sheet number
  SELECT 'FS-' || TO_CHAR(p_delivery_date, 'YYYYMMDD') || '-' || 
         LPAD(COALESCE(MAX(SUBSTRING(face_sheet_no FROM 'FS-[0-9]{8}-([0-9]{4})')::INTEGER), 0) + 1, 4, '0')
  INTO v_face_sheet_no
  FROM face_sheets
  WHERE face_sheet_no LIKE 'FS-' || TO_CHAR(p_delivery_date, 'YYYYMMDD') || '-%';
  
  -- STEP 2: Create face sheet header
  INSERT INTO face_sheets (
    face_sheet_no,
    warehouse_id,
    delivery_date,
    status,
    created_by,
    created_at
  ) VALUES (
    v_face_sheet_no,
    p_warehouse_id,
    p_delivery_date,
    'pending',
    p_created_by,
    CURRENT_TIMESTAMP
  ) RETURNING id INTO v_face_sheet_id;
  
  -- STEP 3: Create face sheet items from orders
  INSERT INTO face_sheet_items (
    face_sheet_id,
    order_id,
    order_item_id,
    sku_id,
    sku_name,
    quantity,
    uom,
    status
  )
  SELECT
    v_face_sheet_id,
    oi.order_id,
    oi.id,
    oi.sku_id,
    ms.sku_name,
    oi.quantity,
    oi.uom,
    'pending'
  FROM wms_order_items oi
  JOIN master_sku ms ON ms.sku_id = oi.sku_id
  WHERE oi.order_id = ANY(p_order_ids);
  
  -- STEP 4: Reserve stock (all in same transaction)
  SELECT * INTO v_reserve_result
  FROM reserve_stock_for_face_sheet_items(
    p_face_sheet_id := v_face_sheet_id,
    p_warehouse_id := p_warehouse_id,
    p_reserved_by := p_created_by
  );
  
  -- STEP 5: Check reservation result
  IF NOT v_reserve_result.success THEN
    -- ✅ CRITICAL: Rollback entire transaction
    RAISE EXCEPTION 'Stock reservation failed: %', v_reserve_result.message
      USING DETAIL = v_reserve_result.insufficient_stock_items::TEXT;
  END IF;
  
  -- STEP 6: Update orders status
  UPDATE wms_orders
  SET status = 'confirmed'
  WHERE order_id = ANY(p_order_ids);
  
  -- Return success
  RETURN QUERY SELECT
    TRUE,
    v_face_sheet_id,
    v_face_sheet_no,
    v_reserve_result.items_reserved,
    'Face sheet created and stock reserved successfully'::TEXT,
    '[]'::JSONB;
    
EXCEPTION
  WHEN OTHERS THEN
    -- Automatic rollback on any error
    RETURN QUERY SELECT
      FALSE,
      NULL::BIGINT,
      NULL::VARCHAR,
      0,
      SQLERRM::TEXT,
      COALESCE(v_reserve_result.insufficient_stock_items, '[]'::JSONB);
END;
$func$;

COMMENT ON FUNCTION create_face_sheet_with_reservation IS
  'สร้างใบปะหน้าพร้อมจองสต็อคแบบ atomic - ถ้าจองไม่สำเร็จจะ rollback ทั้งหมด';
```

#### Step 2: Update API Endpoint

**File:** `app/api/face-sheets/generate/route.ts`

```typescript
// BEFORE (2 separate RPC calls):
const { data: result } = await supabase.rpc('create_face_sheet_packages', {
  p_warehouse_id: warehouse_id,
  p_delivery_date: delivery_date,
  p_order_ids: order_ids
});

const { data: reserveResult } = await supabase.rpc('reserve_stock_for_face_sheet_items', {
  p_face_sheet_id: result.face_sheet_id,
  p_warehouse_id: warehouse_id,
  p_reserved_by: created_by
});

// AFTER (1 atomic RPC call):
const { data: result, error } = await supabase.rpc('create_face_sheet_with_reservation', {
  p_warehouse_id: warehouse_id,
  p_delivery_date: delivery_date,
  p_order_ids: order_ids,
  p_created_by: created_by
});

if (error || !result[0].success) {
  return NextResponse.json({
    error: result[0].message || 'Failed to create face sheet',
    insufficient_stock_items: result[0].insufficient_stock_items
  }, { status: 400 });
}

return NextResponse.json({
  success: true,
  face_sheet_id: result[0].face_sheet_id,
  face_sheet_no: result[0].face_sheet_no,
  items_reserved: result[0].items_reserved
});
```

---

## 🎯 Fix #3: Remove Artificial Delays (P0 - HIGH)

### Problem
500ms delay between item creation and reservation creates race condition window.

### Solution
Remove the delay and call reservation immediately.

### Implementation

**File:** `app/api/bonus-face-sheets/route.ts`

```typescript
// BEFORE:
for (let i = 0; i < packages.length; i++) {
  await supabase.from('bonus_face_sheet_packages').insert({ ... });
  await supabase.from('bonus_face_sheet_items').insert(items);
}

// ❌ Remove this delay!
await new Promise(resolve => setTimeout(resolve, 500));

const { data: reservationResult } = await supabase.rpc('reserve_stock_for_bonus_face_sheet_items', {
  p_bonus_face_sheet_id: faceSheet.id
});

// AFTER:
for (let i = 0; i < packages.length; i++) {
  await supabase.from('bonus_face_sheet_packages').insert({ ... });
  await supabase.from('bonus_face_sheet_items').insert(items);
}

// ✅ Call immediately (no delay)
const { data: reservationResult } = await supabase.rpc('reserve_stock_for_bonus_face_sheet_items', {
  p_bonus_face_sheet_id: faceSheet.id,
  p_warehouse_id: warehouse_id,
  p_reserved_by: created_by
});
```

---

## 🧪 Testing Checklist

### Unit Tests
- [ ] Test row locking prevents concurrent overselling
- [ ] Test transaction rollback on reservation failure
- [ ] Test Virtual Pallet creation when stock insufficient
- [ ] Test FEFO/FIFO ordering

### Integration Tests
- [ ] Test complete flow: Order → Face Sheet → Pick → Load
- [ ] Test concurrent face sheet creation (10+ simultaneous)
- [ ] Test error recovery and rollback
- [ ] Test Virtual Pallet settlement

### Load Tests
- [ ] 100 concurrent picklist creations
- [ ] 100 concurrent face sheet creations
- [ ] 100 concurrent bonus face sheet creations
- [ ] Peak hour simulation (1000 requests/minute)

### Regression Tests
- [ ] Existing picklists still work
- [ ] Existing face sheets still work
- [ ] Mobile pick still works
- [ ] Mobile loading still works

---

## 📊 Deployment Plan

### Pre-Deployment
1. [ ] Backup production database
2. [ ] Test all fixes in staging environment
3. [ ] Run load tests
4. [ ] Prepare rollback plan

### Deployment Steps
1. [ ] Deploy during off-peak hours (2-4 AM)
2. [ ] Apply database migrations
3. [ ] Deploy API changes
4. [ ] Verify functions updated
5. [ ] Run smoke tests

### Post-Deployment
1. [ ] Monitor error rates for 24 hours
2. [ ] Check for overselling incidents
3. [ ] Verify Virtual Pallet settlements
4. [ ] Review performance metrics

### Rollback Plan
If issues detected:
1. Revert API changes
2. Restore previous database functions
3. Verify system stability
4. Investigate root cause

---

## 📈 Success Criteria

### Metrics
- ✅ Zero overselling incidents
- ✅ < 0.1% API error rate
- ✅ < 100ms average response time increase
- ✅ Zero orphaned reservations

### Validation
- [ ] Run concurrent reservation test (100 requests)
- [ ] Verify no `reserved_piece_qty > total_piece_qty`
- [ ] Check Virtual Pallet settlement within 1 minute
- [ ] Confirm automatic rollback on failures

---

## 📞 Support

### During Implementation
- **Developer:** [Your Name]
- **DBA:** [DBA Name]
- **QA:** [QA Name]

### Post-Deployment
- **On-Call:** [On-Call Engineer]
- **Escalation:** [Manager Name]
- **Incident Channel:** #wms-incidents

---

**Document Version:** 1.0  
**Last Updated:** January 17, 2026  
**Next Review:** January 24, 2026
