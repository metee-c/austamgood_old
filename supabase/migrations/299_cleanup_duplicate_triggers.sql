-- ============================================================================
-- Migration 299: Cleanup Duplicate Triggers
-- Description: Remove duplicate triggers that cause multiple executions
-- Date: 2026-01-22
-- 
-- Problem: After multiple migrations, we have duplicate triggers:
-- - wms_move_items: 4 triggers for sync_move_item_to_ledger
-- - wms_inventory_ledger: 2 triggers for sync_inventory_ledger_to_balance  
-- - master_sku: 3 triggers for sync_sku_preparation_area_mapping
-- - wms_inventory_balances: 5 triggers for prep area sync
--
-- This causes:
-- - Duplicate ledger entries
-- - Duplicate balance records
-- - Performance issues
-- - Data inconsistency
-- ============================================================================

-- ============================================================================
-- PART 1: Clean up wms_move_items triggers (keep only one set)
-- ============================================================================

-- Drop old/duplicate triggers
DROP TRIGGER IF EXISTS trigger_sync_move_item_to_ledger_insert ON wms_move_items;
DROP TRIGGER IF EXISTS trigger_sync_move_item_to_ledger_update ON wms_move_items;
DROP TRIGGER IF EXISTS validate_created_by_user_trigger ON wms_move_items;

-- ⚠️ CRITICAL: trigger_validate_created_by_move_items has 2 identical triggers!
-- Drop and recreate to ensure only one exists
DROP TRIGGER IF EXISTS trigger_validate_created_by_move_items ON wms_move_items;

-- Recreate the validation trigger (only once)
CREATE TRIGGER trigger_validate_created_by_move_items
    BEFORE INSERT OR UPDATE ON wms_move_items
    FOR EACH ROW
    EXECUTE FUNCTION validate_created_by_user();

-- Keep only these triggers:
-- - trg_sync_move_item_to_ledger_insert (from migration 278)
-- - trg_sync_move_item_to_ledger_update (from migration 278)
-- - trigger_validate_created_by_move_items (from migration 288/289)
-- - trg_wms_move_items_updated_at (standard updated_at trigger)

COMMENT ON TRIGGER trg_sync_move_item_to_ledger_insert ON wms_move_items IS 
  'Primary trigger to sync move items to ledger (migration 278)';
COMMENT ON TRIGGER trg_sync_move_item_to_ledger_update ON wms_move_items IS 
  'Primary trigger to sync move item updates to ledger (migration 278)';
COMMENT ON TRIGGER trigger_validate_created_by_move_items ON wms_move_items IS
  'Validate created_by user exists (migration 288/289)';

-- ============================================================================
-- PART 2: Clean up wms_inventory_ledger triggers (keep only one)
-- ============================================================================

-- Drop duplicate trigger
DROP TRIGGER IF EXISTS trigger_sync_inventory_ledger_to_balance ON wms_inventory_ledger;

-- Keep only:
-- - trg_sync_inventory_ledger_to_balance (primary sync trigger)
-- - trg_check_receive_status_on_transfer (receive status update)
-- - trg_z_settle_virtual_on_replenishment (virtual pallet settlement)
-- - trg_update_wms_inventory_ledger_updated_at (standard updated_at trigger)

COMMENT ON TRIGGER trg_sync_inventory_ledger_to_balance ON wms_inventory_ledger IS 
  'Primary trigger to sync ledger to balance (migration 149-151)';

-- ============================================================================
-- PART 3: Clean up master_sku triggers (keep only one)
-- ============================================================================

-- Drop duplicate trigger
DROP TRIGGER IF EXISTS trg_sync_sku_preparation_area_mapping ON master_sku;

-- ⚠️ CRITICAL: master_sku has 2 identical triggers with same name!
-- We need to drop and recreate to ensure only one exists
DROP TRIGGER IF EXISTS trigger_sync_sku_preparation_area_mapping ON master_sku;

-- Recreate the trigger (only once)
CREATE TRIGGER trigger_sync_sku_preparation_area_mapping
    AFTER INSERT OR UPDATE OF default_location ON master_sku
    FOR EACH ROW
    EXECUTE FUNCTION sync_sku_preparation_area_mapping();

-- Keep only:
-- - trigger_sync_sku_preparation_area_mapping (from migration 275)
-- - update_master_sku_updated_at (standard updated_at trigger)

COMMENT ON TRIGGER trigger_sync_sku_preparation_area_mapping ON master_sku IS 
  'Primary trigger to sync SKU default_location to prep area mapping (migration 275)';

-- ============================================================================
-- PART 4: Clean up wms_inventory_balances triggers (keep only necessary ones)
-- ============================================================================

-- Drop duplicate/old triggers (มี 2 triggers ชื่อเดียวกัน!)
DROP TRIGGER IF EXISTS trigger_sync_balance_to_prep_area_inventory ON wms_inventory_balances;

-- ⚠️ CRITICAL: trg_sync_prep_area_inventory has 3 identical triggers!
-- Drop and recreate to ensure only one exists
DROP TRIGGER IF EXISTS trg_sync_prep_area_inventory ON wms_inventory_balances;

-- Recreate the trigger (only once)
CREATE TRIGGER trg_sync_prep_area_inventory
    AFTER INSERT OR UPDATE OR DELETE ON wms_inventory_balances
    FOR EACH ROW
    EXECUTE FUNCTION fn_sync_prep_area_inventory();

-- Keep only:
-- - trg_sync_prep_area_inventory (from migration 280/283)
-- - trg_sync_location_qty_from_balance (location qty sync)
-- - trg_update_location_qty_* (location qty updates)
-- - trg_wms_inventory_balances_updated_at (standard updated_at trigger)

COMMENT ON TRIGGER trg_sync_prep_area_inventory ON wms_inventory_balances IS 
  'Primary trigger to sync balance to prep area inventory (migration 280/283)';

-- ============================================================================
-- PART 5: Verify cleanup
-- ============================================================================

DO $$
DECLARE
    v_move_items_triggers INTEGER;
    v_ledger_triggers INTEGER;
    v_sku_triggers INTEGER;
    v_balance_triggers INTEGER;
BEGIN
    -- Count remaining triggers
    SELECT COUNT(*) INTO v_move_items_triggers
    FROM information_schema.triggers
    WHERE event_object_table = 'wms_move_items'
      AND trigger_name LIKE '%sync_move_item_to_ledger%';
    
    SELECT COUNT(*) INTO v_ledger_triggers
    FROM information_schema.triggers
    WHERE event_object_table = 'wms_inventory_ledger'
      AND trigger_name LIKE '%sync_inventory_ledger_to_balance%';
    
    SELECT COUNT(*) INTO v_sku_triggers
    FROM information_schema.triggers
    WHERE event_object_table = 'master_sku'
      AND trigger_name LIKE '%sync_sku_preparation_area%';
    
    SELECT COUNT(*) INTO v_balance_triggers
    FROM information_schema.triggers
    WHERE event_object_table = 'wms_inventory_balances'
      AND trigger_name LIKE '%sync%prep_area%';
    
    RAISE NOTICE '✅ Trigger cleanup complete:';
    RAISE NOTICE '  - wms_move_items sync triggers: % (should be 2)', v_move_items_triggers;
    RAISE NOTICE '  - wms_inventory_ledger sync triggers: % (should be 1)', v_ledger_triggers;
    RAISE NOTICE '  - master_sku sync triggers: % (should be 1)', v_sku_triggers;
    RAISE NOTICE '  - wms_inventory_balances prep area triggers: % (should be 1)', v_balance_triggers;
    
    IF v_move_items_triggers != 2 OR v_ledger_triggers != 1 OR 
       v_sku_triggers != 1 OR v_balance_triggers != 1 THEN
        RAISE WARNING '⚠️ Unexpected trigger counts - please verify manually';
    END IF;
END $$;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
