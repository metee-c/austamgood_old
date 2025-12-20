# ⚡ WMS AUDIT - QUICK FIX GUIDE
**Developer Reference: Copy-Paste Solutions for Critical Issues**

---

## 🎯 FIX #1: Add Database Transaction Wrapper
**Issue:** No transaction isolation for receive/move/adjustment
**Files:** `lib/database/receive.ts`, `move.ts`, `stock-adjustment.ts`
**Time:** 3-5 days

### Step 1: Create RPC Function (Supabase Migration)
```sql
-- File: supabase/migrations/999_add_transaction_wrappers.sql

-- ============================================
-- CREATE RECEIVE WITH TRANSACTION
-- ============================================
CREATE OR REPLACE FUNCTION create_receive_atomic(
  p_header JSONB,
  p_items JSONB[]
) RETURNS JSONB AS $$
DECLARE
  v_receive_id BIGINT;
  v_result JSONB;
BEGIN
  -- Insert header
  INSERT INTO wms_receives (
    receive_no, supplier_id, warehouse_id, receive_date,
    receiver_employee_id, status, note, created_by
  )
  SELECT
    (p_header->>'receive_no')::TEXT,
    (p_header->>'supplier_id')::TEXT,
    (p_header->>'warehouse_id')::TEXT,
    (p_header->>'receive_date')::TIMESTAMP,
    (p_header->>'receiver_employee_id')::TEXT,
    (p_header->>'status')::TEXT,
    p_header->>'note',
    (p_header->>'created_by')::TEXT
  RETURNING receive_id INTO v_receive_id;

  -- Insert items
  INSERT INTO wms_receive_items (
    receive_id, sku_id, location_id, pallet_id,
    pack_quantity, piece_quantity, production_date, expiry_date, lot_no
  )
  SELECT
    v_receive_id,
    (item->>'sku_id')::TEXT,
    (item->>'location_id')::TEXT,
    (item->>'pallet_id')::TEXT,
    (item->>'pack_quantity')::NUMERIC,
    (item->>'piece_quantity')::NUMERIC,
    (item->>'production_date')::DATE,
    (item->>'expiry_date')::DATE,
    item->>'lot_no'
  FROM jsonb_array_elements(p_items) AS item;

  -- Return result
  v_result := jsonb_build_object(
    'receive_id', v_receive_id,
    'success', true
  );

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  -- Automatic rollback on any error
  RAISE EXCEPTION 'Transaction failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- CREATE MOVE WITH TRANSACTION
-- ============================================
CREATE OR REPLACE FUNCTION create_move_atomic(
  p_header JSONB,
  p_items JSONB[]
) RETURNS JSONB AS $$
DECLARE
  v_move_id BIGINT;
  v_result JSONB;
BEGIN
  -- Insert header
  INSERT INTO wms_moves (
    move_no, move_type, warehouse_id, move_date,
    mover_employee_id, status, note, created_by
  )
  SELECT
    (p_header->>'move_no')::TEXT,
    (p_header->>'move_type')::TEXT,
    (p_header->>'warehouse_id')::TEXT,
    (p_header->>'move_date')::TIMESTAMP,
    (p_header->>'mover_employee_id')::TEXT,
    (p_header->>'status')::TEXT,
    p_header->>'note',
    (p_header->>'created_by')::TEXT
  RETURNING move_id INTO v_move_id;

  -- Insert items
  INSERT INTO wms_move_items (
    move_id, sku_id, pallet_id, from_location_id, to_location_id,
    planned_pack_qty, planned_piece_qty
  )
  SELECT
    v_move_id,
    (item->>'sku_id')::TEXT,
    (item->>'pallet_id')::TEXT,
    (item->>'from_location_id')::TEXT,
    (item->>'to_location_id')::TEXT,
    (item->>'planned_pack_qty')::NUMERIC,
    (item->>'planned_piece_qty')::NUMERIC
  FROM jsonb_array_elements(p_items) AS item;

  v_result := jsonb_build_object('move_id', v_move_id, 'success', true);
  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Transaction failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;
```

### Step 2: Update TypeScript Service
```typescript
// File: lib/database/receive.ts

async createReceive(payload: any): Promise<{ data: any; error: string | null }> {
  try {
    // ✅ NEW: Use atomic RPC function
    const { data, error } = await this.supabase.rpc('create_receive_atomic', {
      p_header: {
        receive_no: payload.receive_no,
        supplier_id: payload.supplier_id,
        warehouse_id: payload.warehouse_id,
        receive_date: payload.receive_date,
        receiver_employee_id: payload.receiver_employee_id,
        status: payload.status,
        note: payload.note,
        created_by: payload.created_by
      },
      p_items: payload.items
    });

    if (error) {
      console.error('Failed to create receive:', error);
      return { data: null, error: error.message };
    }

    return { data, error: null };

  } catch (error: any) {
    console.error('Unexpected error:', error);
    return { data: null, error: error.message };
  }
}
```

---

## 🎯 FIX #2: Fix Pallet ID Race Condition
**Issue:** Duplicate pallet IDs with concurrent receives
**Files:** `lib/database/receive.ts:186-226`
**Time:** 1 day

### Step 1: Create Sequence (Migration)
```sql
-- File: supabase/migrations/998_add_pallet_id_sequence.sql

-- Create sequence for pallet IDs
CREATE SEQUENCE IF NOT EXISTS pallet_id_seq START WITH 1;

-- Function to generate unique pallet ID
CREATE OR REPLACE FUNCTION generate_pallet_id()
RETURNS TEXT AS $$
DECLARE
  v_date_prefix TEXT;
  v_running_no TEXT;
  v_pallet_id TEXT;
BEGIN
  -- Format: ATG + YYYYMMDD + 9-digit sequence
  v_date_prefix := 'ATG' || to_char(CURRENT_DATE, 'YYYYMMDD');

  -- Get next sequence number and pad to 9 digits
  v_running_no := lpad(nextval('pallet_id_seq')::TEXT, 9, '0');

  -- Combine
  v_pallet_id := v_date_prefix || v_running_no;

  RETURN v_pallet_id;
END;
$$ LANGUAGE plpgsql;

-- Optional: Reset sequence daily (pg_cron job)
-- SELECT setval('pallet_id_seq', 1, false);
```

### Step 2: Update TypeScript Service
```typescript
// File: lib/database/receive.ts

async generateMultiplePalletIds(count: number): Promise<string[]> {
  try {
    const palletIds: string[] = [];

    // ✅ NEW: Call database function (atomic, no race condition)
    for (let i = 0; i < count; i++) {
      const { data, error } = await this.supabase.rpc('generate_pallet_id');

      if (error) throw error;
      palletIds.push(data);
    }

    return palletIds;

  } catch (error: any) {
    console.error('Failed to generate pallet IDs:', error);
    throw error;
  }
}

// ❌ DELETE OLD CODE: Lines 186-226 (manual ID calculation)
```

---

## 🎯 FIX #3: Add Row Locking for Picking
**Issue:** Concurrent picking causes negative stock
**Files:** `app/api/mobile/pick/scan/route.ts:164`
**Time:** 2 days

### Step 1: Create Locked Query Function (Migration)
```sql
-- File: supabase/migrations/997_add_row_locking.sql

-- Function to deduct stock with row lock
CREATE OR REPLACE FUNCTION deduct_stock_with_lock(
  p_balance_id BIGINT,
  p_piece_qty NUMERIC,
  p_pack_qty NUMERIC DEFAULT 0
) RETURNS JSONB AS $$
DECLARE
  v_balance RECORD;
  v_new_total_piece NUMERIC;
  v_new_total_pack NUMERIC;
  v_result JSONB;
BEGIN
  -- Lock row before reading (prevents concurrent access)
  SELECT * INTO v_balance
  FROM wms_inventory_balances
  WHERE balance_id = p_balance_id
  FOR UPDATE NOWAIT;  -- ✅ Fail fast if locked by another transaction

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Balance not found: %', p_balance_id;
  END IF;

  -- Calculate new quantities
  v_new_total_piece := v_balance.total_piece_qty - p_piece_qty;
  v_new_total_pack := v_balance.total_pack_qty - p_pack_qty;

  -- Validate (no negative stock)
  IF v_new_total_piece < 0 OR v_new_total_pack < 0 THEN
    RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %',
      v_balance.total_piece_qty, p_piece_qty;
  END IF;

  -- Update balance
  UPDATE wms_inventory_balances
  SET
    total_piece_qty = v_new_total_piece,
    total_pack_qty = v_new_total_pack,
    last_movement_at = NOW()
  WHERE balance_id = p_balance_id;

  -- Return result
  v_result := jsonb_build_object(
    'success', true,
    'new_total_piece_qty', v_new_total_piece,
    'new_total_pack_qty', v_new_total_pack
  );

  RETURN v_result;

EXCEPTION
  WHEN lock_not_available THEN
    RAISE EXCEPTION 'Stock is being modified by another user. Please retry.';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to deduct stock: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;
```

### Step 2: Update API Route
```typescript
// File: app/api/mobile/pick/scan/route.ts

// Replace lines 164-200 with:
for (const reservation of reservations) {
  // ✅ NEW: Use locked deduction
  const { data: result, error: deductError } = await supabase
    .rpc('deduct_stock_with_lock', {
      p_balance_id: reservation.balance_id,
      p_piece_qty: qtyToDeduct,
      p_pack_qty: 0
    });

  if (deductError) {
    return NextResponse.json(
      { error: `Stock lock failed: ${deductError.message}` },
      { status: 409 } // 409 Conflict
    );
  }

  // Continue with ledger creation...
}
```

---

## 🎯 FIX #4: Add Idempotency for Adjustments
**Issue:** Double-click executes adjustment twice
**Files:** `lib/database/stock-adjustment.ts:460-513`
**Time:** 1 day

### Step 1: Update Database Function
```sql
-- File: supabase/migrations/996_add_adjustment_idempotency.sql

-- Add completed_at column if not exists
ALTER TABLE wms_stock_adjustments
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

-- Create idempotent completion function
CREATE OR REPLACE FUNCTION complete_adjustment_idempotent(
  p_adjustment_id BIGINT,
  p_user_id TEXT
) RETURNS JSONB AS $$
DECLARE
  v_affected_rows INT;
  v_adjustment RECORD;
  v_result JSONB;
BEGIN
  -- Update with idempotency check
  UPDATE wms_stock_adjustments
  SET
    status = 'completed',
    completed_at = NOW(),
    completed_by = p_user_id
  WHERE adjustment_id = p_adjustment_id
    AND status = 'approved'  -- ✅ Only if still approved
    AND completed_at IS NULL  -- ✅ Only if not already completed
  RETURNING * INTO v_adjustment;

  GET DIAGNOSTICS v_affected_rows = ROW_COUNT;

  -- Check if update happened
  IF v_affected_rows = 0 THEN
    -- Check why
    SELECT * INTO v_adjustment
    FROM wms_stock_adjustments
    WHERE adjustment_id = p_adjustment_id;

    IF v_adjustment.completed_at IS NOT NULL THEN
      -- Already completed (idempotency - return success)
      v_result := jsonb_build_object(
        'success', true,
        'message', 'Already completed',
        'adjustment_id', p_adjustment_id
      );
      RETURN v_result;
    ELSE
      -- Status changed or not found
      RAISE EXCEPTION 'Cannot complete: status is % (expected approved)', v_adjustment.status;
    END IF;
  END IF;

  -- Record to ledger (only if update succeeded)
  -- ... (existing ledger logic)

  v_result := jsonb_build_object(
    'success', true,
    'adjustment_id', p_adjustment_id
  );

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Failed to complete adjustment: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;
```

### Step 2: Update TypeScript Service
```typescript
// File: lib/database/stock-adjustment.ts

async completeAdjustment(
  id: number,
  userId: string
): Promise<{ data: any; error: string | null }> {
  try {
    // ✅ NEW: Use idempotent RPC function
    const { data, error } = await this.supabase.rpc(
      'complete_adjustment_idempotent',
      {
        p_adjustment_id: id,
        p_user_id: userId
      }
    );

    if (error) {
      return { data: null, error: error.message };
    }

    return { data, error: null };

  } catch (error: any) {
    return { data: null, error: error.message };
  }
}
```

---

## 🎯 FIX #5: Fix Mobile Loading N+1 Queries
**Issue:** 30-50 queries per page load
**Files:** `app/api/mobile/loading/loadlist-detail/route.ts:93-278`
**Time:** 2 days

### Solution: Batch All Queries
```typescript
// File: app/api/mobile/loading/loadlist-detail/route.ts

// ❌ DELETE: Lines 93-278 (loop queries)

// ✅ NEW: Batch queries
async function getLoadlistDetail(code: string) {
  // Step 1: Get loadlist
  const { data: loadlist } = await supabase
    .from('loadlists')
    .select('*')
    .eq('loadlist_code', code)
    .single();

  // Step 2: Get ALL picklist IDs
  const { data: picklistLinks } = await supabase
    .from('wms_loadlist_picklists')
    .select('picklist_id')
    .eq('loadlist_id', loadlist.id);

  const picklistIds = picklistLinks.map(p => p.picklist_id);

  // Step 3: Get ALL picklists with items (SINGLE QUERY with JOIN)
  const { data: picklists } = await supabase
    .from('wms_picklists')
    .select(`
      *,
      picklist_items (
        *,
        master_sku (*)
      )
    `)
    .in('id', picklistIds);

  // Step 4: Get ALL face sheet IDs
  const { data: faceSheetLinks } = await supabase
    .from('wms_loadlist_face_sheets')
    .select('face_sheet_id')
    .eq('loadlist_id', loadlist.id);

  const faceSheetIds = faceSheetLinks.map(f => f.face_sheet_id);

  // Step 5: Get ALL face sheets with items (SINGLE QUERY)
  const { data: faceSheets } = await supabase
    .from('face_sheets')
    .select(`
      *,
      face_sheet_items (
        *,
        master_sku (*)
      )
    `)
    .in('id', faceSheetIds);

  // Step 6: Similar for bonus face sheets...

  // Total queries: 6-8 instead of 30-50!
  // 10x performance improvement

  return {
    loadlist,
    picklists,
    faceSheets,
    bonusFaceSheets
  };
}
```

---

## 🎯 FIX #6: Add Pre-Delete Validation
**Issue:** Can delete SKU/Location with inventory
**Files:** `lib/database/master-sku.ts:137-154`
**Time:** 1 day

### Solution: Check Dependencies Before Delete
```typescript
// File: lib/database/master-sku.ts

async deleteMasterSku(skuId: string): Promise<{ error: string | null }> {
  try {
    // ✅ NEW: Check inventory balances
    const { data: balances, error: balanceError } = await this.supabase
      .from('wms_inventory_balances')
      .select('location_id, total_piece_qty, warehouse_id')
      .eq('sku_id', skuId)
      .gt('total_piece_qty', 0);

    if (balanceError) {
      return { error: balanceError.message };
    }

    if (balances && balances.length > 0) {
      const totalQty = balances.reduce((sum, b) => sum + b.total_piece_qty, 0);
      const locationList = balances.map(b => b.location_id).join(', ');

      return {
        error: `Cannot delete SKU: ${totalQty} pieces in stock at ${balances.length} locations (${locationList})`
      };
    }

    // ✅ Check pending orders
    const { data: orderItems } = await this.supabase
      .from('wms_order_items')
      .select('order_id')
      .eq('sku_id', skuId)
      .limit(1);

    if (orderItems && orderItems.length > 0) {
      return {
        error: 'Cannot delete SKU: Used in pending orders'
      };
    }

    // ✅ Check active picklists
    const { data: picklistItems } = await this.supabase
      .from('picklist_items')
      .select('picklist_id')
      .eq('sku_id', skuId)
      .limit(1);

    if (picklistItems && picklistItems.length > 0) {
      return {
        error: 'Cannot delete SKU: Used in active picklists'
      };
    }

    // All checks passed - safe to delete
    const { error } = await this.supabase
      .from('master_sku')
      .delete()
      .eq('sku_id', skuId);

    if (error) {
      return { error: error.message };
    }

    return { error: null };

  } catch (error: any) {
    return { error: error.message };
  }
}
```

---

## 📋 TESTING CHECKLIST

After implementing each fix, run these tests:

### Test 1: Transaction Rollback
```typescript
// Create receive with invalid data after items
// Expected: ALL data rolled back
// Verify: No orphan records in database
```

### Test 2: Concurrent Receives
```bash
# Terminal 1 & 2 simultaneously
curl -X POST /api/receives -d '{...}'
# Expected: Unique pallet IDs
# Verify: No duplicates in database
```

### Test 3: Parallel Picking
```bash
# Two workers scan same picklist
# Expected: One succeeds, one gets "locked" error
# Verify: Stock deducted only once
```

### Test 4: Double-Click Adjustment
```bash
# Click "Complete" twice rapidly
# Expected: Only execute once
# Verify: Stock changed by correct amount
```

### Test 5: Loading Performance
```bash
# Measure page load time
# Expected: <2 seconds (vs 5-10 seconds before)
```

### Test 6: Delete SKU with Stock
```bash
# Try to delete SKU with inventory
# Expected: Clear error message with stock details
# Verify: SKU not deleted
```

---

## 🚀 DEPLOYMENT CHECKLIST

- [ ] All migrations run successfully
- [ ] All tests pass
- [ ] No TypeScript errors
- [ ] Database backup created
- [ ] Rollback plan documented
- [ ] Team notified of changes
- [ ] Monitoring enabled
- [ ] Staging environment tested

---

## 📞 SUPPORT

**Issues during implementation?**
- Check full audit report: `AUDIT_REPORT_COMPLETE.md`
- Review test scenarios in audit report
- Contact: Senior WMS System Auditor

**Critical errors after deployment?**
- Rollback migration immediately
- Check Supabase logs
- Review error messages
- Contact database admin

---

**Last Updated:** 2025-12-20
**Version:** 1.0
**Status:** Ready for implementation
