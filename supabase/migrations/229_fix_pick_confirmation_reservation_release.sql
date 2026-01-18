-- ============================================================================
-- Migration 229: Fix Pick Confirmation - Auto Release Reservations
-- ============================================================================
-- Author: AI Bug Fix Kit
-- Date: 2026-01-18
-- Bug: BUG-006 - Pick Confirmation ไม่ release reservation
-- Priority: P0 - CRITICAL
-- ============================================================================

-- ============================================================================
-- PART 1: Create Atomic Function for Pick Item Confirmation
-- ============================================================================

CREATE OR REPLACE FUNCTION confirm_pick_item_with_reservation_release(
  p_picklist_item_id BIGINT,
  p_picked_qty NUMERIC,
  p_picked_by VARCHAR DEFAULT 'System'
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  reservations_released INTEGER,
  total_qty_released NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $func$
DECLARE
  v_reservation RECORD;
  v_released_count INTEGER := 0;
  v_total_qty_released NUMERIC := 0;
  v_picklist_item RECORD;
BEGIN
  -- Set lock timeout for safety
  SET LOCAL lock_timeout = '5s';
  
  -- 1. Validate and get picklist item
  SELECT pi.*, p.picklist_code, p.status as picklist_status
  INTO v_picklist_item
  FROM picklist_items pi
  JOIN picklists p ON p.id = pi.picklist_id
  WHERE pi.id = p_picklist_item_id
  FOR UPDATE OF pi;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      FALSE, 
      'ไม่พบรายการในใบหยิบ (Picklist item not found)'::TEXT, 
      0, 
      0::NUMERIC;
    RETURN;
  END IF;
  
  -- 2. Check if already picked
  IF v_picklist_item.status = 'picked' THEN
    RETURN QUERY SELECT 
      FALSE, 
      'รายการนี้ถูกหยิบไปแล้ว (Item already picked)'::TEXT, 
      0, 
      0::NUMERIC;
    RETURN;
  END IF;
  
  -- 3. Update picklist item status
  UPDATE picklist_items
  SET 
    status = 'picked',
    quantity_picked = COALESCE(p_picked_qty, quantity_to_pick),
    picked_at = CURRENT_TIMESTAMP,
    picked_by_employee_id = p_picked_by,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = p_picklist_item_id;
  
  -- 4. Release all reservations for this item
  FOR v_reservation IN
    SELECT 
      pir.reservation_id,
      pir.balance_id,
      pir.reserved_piece_qty,
      pir.reserved_pack_qty,
      ib.sku_id,
      ib.pallet_id
    FROM picklist_item_reservations pir
    JOIN wms_inventory_balances ib ON ib.balance_id = pir.balance_id
    WHERE pir.picklist_item_id = p_picklist_item_id
    AND pir.status IN ('reserved', 'active')  -- Handle both statuses
    FOR UPDATE OF pir, ib  -- Lock both tables to prevent race condition
  LOOP
    -- 4a. Update reservation status
    UPDATE picklist_item_reservations
    SET 
      status = 'picked',
      picked_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE reservation_id = v_reservation.reservation_id;
    
    -- 4b. Release from inventory balance
    UPDATE wms_inventory_balances
    SET 
      reserved_piece_qty = GREATEST(0, COALESCE(reserved_piece_qty, 0) - COALESCE(v_reservation.reserved_piece_qty, 0)),
      reserved_pack_qty = GREATEST(0, COALESCE(reserved_pack_qty, 0) - COALESCE(v_reservation.reserved_pack_qty, 0)),
      updated_at = CURRENT_TIMESTAMP
    WHERE balance_id = v_reservation.balance_id;
    
    v_released_count := v_released_count + 1;
    v_total_qty_released := v_total_qty_released + COALESCE(v_reservation.reserved_piece_qty, 0);
  END LOOP;
  
  -- 5. Return success
  RETURN QUERY SELECT 
    TRUE, 
    format('ยืนยันหยิบสำเร็จ ปล่อยการจอง %s รายการ (%s ชิ้น)', v_released_count, v_total_qty_released)::TEXT, 
    v_released_count, 
    v_total_qty_released;
  
EXCEPTION
  WHEN lock_not_available THEN
    RETURN QUERY SELECT 
      FALSE, 
      'ระบบกำลังประมวลผล กรุณาลองใหม่อีกครั้ง (Lock timeout)'::TEXT, 
      0, 
      0::NUMERIC;
  WHEN OTHERS THEN
    RETURN QUERY SELECT 
      FALSE, 
      format('เกิดข้อผิดพลาด: %s', SQLERRM)::TEXT, 
      0, 
      0::NUMERIC;
END;
$func$;

COMMENT ON FUNCTION confirm_pick_item_with_reservation_release IS 
  'ยืนยันหยิบสินค้าพร้อมปล่อย reservation อัตโนมัติ - v1.0 - BUG-006 fix';

-- ============================================================================
-- PART 2: Create Function for Batch Pick Confirmation (Complete Picklist)
-- ============================================================================

CREATE OR REPLACE FUNCTION complete_picklist_with_reservation_release(
  p_picklist_id BIGINT,
  p_completed_by VARCHAR DEFAULT 'System'
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  items_confirmed INTEGER,
  reservations_released INTEGER,
  total_qty_released NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $func$
DECLARE
  v_item RECORD;
  v_result RECORD;
  v_items_count INTEGER := 0;
  v_total_reservations INTEGER := 0;
  v_total_qty NUMERIC := 0;
  v_picklist RECORD;
BEGIN
  -- Set lock timeout for safety
  SET LOCAL lock_timeout = '10s';
  
  -- 1. Get and lock picklist
  SELECT * INTO v_picklist
  FROM picklists
  WHERE id = p_picklist_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      FALSE, 
      'ไม่พบใบหยิบ (Picklist not found)'::TEXT, 
      0, 0, 0::NUMERIC;
    RETURN;
  END IF;
  
  IF v_picklist.status = 'completed' THEN
    RETURN QUERY SELECT 
      FALSE, 
      'ใบหยิบนี้เสร็จสิ้นแล้ว (Picklist already completed)'::TEXT, 
      0, 0, 0::NUMERIC;
    RETURN;
  END IF;
  
  -- 2. Process each pending item
  FOR v_item IN
    SELECT id, sku_id, quantity_to_pick
    FROM picklist_items
    WHERE picklist_id = p_picklist_id
    AND status != 'picked'
    FOR UPDATE
  LOOP
    -- Confirm each item
    SELECT * INTO v_result
    FROM confirm_pick_item_with_reservation_release(
      v_item.id, 
      v_item.quantity_to_pick, 
      p_completed_by
    );
    
    IF v_result.success THEN
      v_items_count := v_items_count + 1;
      v_total_reservations := v_total_reservations + v_result.reservations_released;
      v_total_qty := v_total_qty + v_result.total_qty_released;
    END IF;
  END LOOP;
  
  -- 3. Update picklist status
  UPDATE picklists
  SET 
    status = 'completed',
    picking_completed_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = p_picklist_id;
  
  -- 4. Return success
  RETURN QUERY SELECT 
    TRUE, 
    format('ยืนยันใบหยิบเสร็จสิ้น: %s รายการ, ปล่อยการจอง %s รายการ (%s ชิ้น)', 
           v_items_count, v_total_reservations, v_total_qty)::TEXT, 
    v_items_count,
    v_total_reservations, 
    v_total_qty;
  
EXCEPTION
  WHEN lock_not_available THEN
    RETURN QUERY SELECT 
      FALSE, 
      'ระบบกำลังประมวลผล กรุณาลองใหม่อีกครั้ง'::TEXT, 
      0, 0, 0::NUMERIC;
  WHEN OTHERS THEN
    RETURN QUERY SELECT 
      FALSE, 
      format('เกิดข้อผิดพลาด: %s', SQLERRM)::TEXT, 
      0, 0, 0::NUMERIC;
END;
$func$;

COMMENT ON FUNCTION complete_picklist_with_reservation_release IS 
  'ยืนยันใบหยิบทั้งใบพร้อมปล่อย reservation อัตโนมัติ - v1.0 - BUG-006 fix';

-- ============================================================================
-- PART 3: Create Safety Trigger (Backup mechanism)
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_auto_release_reservation_on_pick()
RETURNS TRIGGER AS $trigger$
DECLARE
  v_reservation RECORD;
BEGIN
  -- Only trigger when status changes to 'picked'
  IF NEW.status = 'picked' AND (OLD.status IS NULL OR OLD.status != 'picked') THEN
    
    -- Check if reservations were already released (by the function)
    IF EXISTS (
      SELECT 1 FROM picklist_item_reservations 
      WHERE picklist_item_id = NEW.id 
      AND status IN ('reserved', 'active')
    ) THEN
      -- Release reservations that were missed
      FOR v_reservation IN
        SELECT 
          pir.reservation_id,
          pir.balance_id,
          pir.reserved_piece_qty,
          pir.reserved_pack_qty
        FROM picklist_item_reservations pir
        WHERE pir.picklist_item_id = NEW.id
        AND pir.status IN ('reserved', 'active')
      LOOP
        -- Update reservation status
        UPDATE picklist_item_reservations
        SET status = 'picked', updated_at = CURRENT_TIMESTAMP
        WHERE reservation_id = v_reservation.reservation_id;
        
        -- Release from inventory balance
        UPDATE wms_inventory_balances
        SET 
          reserved_piece_qty = GREATEST(0, COALESCE(reserved_piece_qty, 0) - COALESCE(v_reservation.reserved_piece_qty, 0)),
          reserved_pack_qty = GREATEST(0, COALESCE(reserved_pack_qty, 0) - COALESCE(v_reservation.reserved_pack_qty, 0)),
          updated_at = CURRENT_TIMESTAMP
        WHERE balance_id = v_reservation.balance_id;
        
        -- Log for debugging
        RAISE NOTICE 'Auto-released reservation % (% pieces) via trigger', 
                     v_reservation.reservation_id, v_reservation.reserved_piece_qty;
      END LOOP;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$trigger$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trg_auto_release_reservation_on_pick ON picklist_items;

-- Create trigger
CREATE TRIGGER trg_auto_release_reservation_on_pick
  AFTER UPDATE ON picklist_items
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_release_reservation_on_pick();

COMMENT ON TRIGGER trg_auto_release_reservation_on_pick ON picklist_items IS 
  'Safety net: Auto-release reservation if not released by function - BUG-006 fix';

-- ============================================================================
-- PART 4: Create Utility Function to Fix Existing Stuck Reservations
-- ============================================================================

CREATE OR REPLACE FUNCTION fix_stuck_picklist_reservations()
RETURNS TABLE(
  fixed_count INTEGER,
  total_qty_released NUMERIC,
  affected_picklists TEXT[]
) LANGUAGE plpgsql AS $func$
DECLARE
  v_reservation RECORD;
  v_fixed_count INTEGER := 0;
  v_total_qty NUMERIC := 0;
  v_affected_picklists TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Find and fix stuck reservations
  FOR v_reservation IN
    SELECT 
      pir.reservation_id,
      pir.balance_id,
      pir.reserved_piece_qty,
      pir.reserved_pack_qty,
      p.picklist_code
    FROM picklist_item_reservations pir
    JOIN picklist_items pi ON pi.id = pir.picklist_item_id
    JOIN picklists p ON p.id = pi.picklist_id
    WHERE pi.status = 'picked'           -- Item is picked
    AND pir.status IN ('reserved', 'active')  -- But reservation still active
    FOR UPDATE OF pir
  LOOP
    -- Update reservation status
    UPDATE picklist_item_reservations
    SET status = 'picked', updated_at = CURRENT_TIMESTAMP
    WHERE reservation_id = v_reservation.reservation_id;
    
    -- Release from inventory balance
    UPDATE wms_inventory_balances
    SET 
      reserved_piece_qty = GREATEST(0, COALESCE(reserved_piece_qty, 0) - COALESCE(v_reservation.reserved_piece_qty, 0)),
      reserved_pack_qty = GREATEST(0, COALESCE(reserved_pack_qty, 0) - COALESCE(v_reservation.reserved_pack_qty, 0)),
      updated_at = CURRENT_TIMESTAMP
    WHERE balance_id = v_reservation.balance_id;
    
    v_fixed_count := v_fixed_count + 1;
    v_total_qty := v_total_qty + COALESCE(v_reservation.reserved_piece_qty, 0);
    
    IF NOT v_reservation.picklist_code = ANY(v_affected_picklists) THEN
      v_affected_picklists := array_append(v_affected_picklists, v_reservation.picklist_code);
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT v_fixed_count, v_total_qty, v_affected_picklists;
END;
$func$;

COMMENT ON FUNCTION fix_stuck_picklist_reservations IS 
  'Utility function to fix existing stuck reservations - Run once after migration';

-- ============================================================================
-- PART 5: Create Monitoring View
-- ============================================================================

CREATE OR REPLACE VIEW v_stuck_picklist_reservations AS
SELECT 
  p.picklist_code,
  p.status as picklist_status,
  pi.sku_id,
  pi.status as item_status,
  pir.reservation_id,
  pir.status as reservation_status,
  pir.reserved_piece_qty,
  pir.reserved_pack_qty,
  p.created_at as picklist_created,
  p.picking_completed_at as picklist_completed
FROM picklist_item_reservations pir
JOIN picklist_items pi ON pi.id = pir.picklist_item_id
JOIN picklists p ON p.id = pi.picklist_id
WHERE pi.status = 'picked'
AND pir.status IN ('reserved', 'active')
ORDER BY p.created_at DESC;

COMMENT ON VIEW v_stuck_picklist_reservations IS 
  'View to monitor stuck reservations - Should always be empty';

-- ============================================================================
-- PART 6: Grant Permissions
-- ============================================================================

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION confirm_pick_item_with_reservation_release TO service_role;
GRANT EXECUTE ON FUNCTION complete_picklist_with_reservation_release TO service_role;
GRANT EXECUTE ON FUNCTION fix_stuck_picklist_reservations TO service_role;

-- Grant select on monitoring view
GRANT SELECT ON v_stuck_picklist_reservations TO authenticated;
GRANT SELECT ON v_stuck_picklist_reservations TO service_role;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  -- Verify functions created
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'confirm_pick_item_with_reservation_release') THEN
    RAISE NOTICE '✅ Function confirm_pick_item_with_reservation_release created';
  ELSE
    RAISE EXCEPTION '❌ Function confirm_pick_item_with_reservation_release NOT created';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'complete_picklist_with_reservation_release') THEN
    RAISE NOTICE '✅ Function complete_picklist_with_reservation_release created';
  ELSE
    RAISE EXCEPTION '❌ Function complete_picklist_with_reservation_release NOT created';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fix_stuck_picklist_reservations') THEN
    RAISE NOTICE '✅ Function fix_stuck_picklist_reservations created';
  ELSE
    RAISE EXCEPTION '❌ Function fix_stuck_picklist_reservations NOT created';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_auto_release_reservation_on_pick') THEN
    RAISE NOTICE '✅ Trigger trg_auto_release_reservation_on_pick created';
  ELSE
    RAISE EXCEPTION '❌ Trigger trg_auto_release_reservation_on_pick NOT created';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'v_stuck_picklist_reservations') THEN
    RAISE NOTICE '✅ View v_stuck_picklist_reservations created';
  ELSE
    RAISE EXCEPTION '❌ View v_stuck_picklist_reservations NOT created';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '✅ Migration 229 completed successfully!';
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Run: SELECT * FROM fix_stuck_picklist_reservations();';
  RAISE NOTICE '2. Verify: SELECT COUNT(*) FROM v_stuck_picklist_reservations;';
  RAISE NOTICE '3. Update API to use confirm_pick_item_with_reservation_release()';
  RAISE NOTICE '';
END $$;
