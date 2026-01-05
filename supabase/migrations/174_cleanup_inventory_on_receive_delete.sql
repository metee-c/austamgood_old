-- ============================================================================
-- Migration: 174_cleanup_inventory_on_receive_delete.sql
-- Description: สร้าง trigger เพื่อ cleanup inventory_ledger และ inventory_balances
--              เมื่อลบ wms_receives
-- Issue: เมื่อลบ receive ที่หน้า inbound, inventory_ledger และ inventory_balances
--        ไม่ได้ถูกอัพเดตตาม
-- Solution: สร้าง BEFORE DELETE trigger บน wms_receives ที่จะ:
--           1. หา receive_items ที่เกี่ยวข้อง
--           2. สร้าง reverse ledger entries (direction='out') เพื่อลด balance
--           3. ลบ ledger entries เดิม
-- ============================================================================

-- Function: cleanup inventory when receive is deleted
CREATE OR REPLACE FUNCTION public.cleanup_inventory_on_receive_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    v_item RECORD;
    v_ledger RECORD;
BEGIN
    RAISE NOTICE 'Cleaning up inventory for receive_id: %', OLD.receive_id;
    
    -- Loop through all receive items for this receive
    FOR v_item IN 
        SELECT item_id, sku_id, pack_qty, piece_qty, pallet_id
        FROM wms_receive_items
        WHERE receive_id = OLD.receive_id
    LOOP
        RAISE NOTICE 'Processing receive_item: %, sku: %, pack_qty: %, piece_qty: %', 
            v_item.item_id, v_item.sku_id, v_item.pack_qty, v_item.piece_qty;
        
        -- Find all ledger entries for this receive item
        FOR v_ledger IN
            SELECT ledger_id, warehouse_id, location_id, sku_id, pallet_id, pallet_id_external,
                   production_date, expiry_date, pack_qty, piece_qty, direction
            FROM wms_inventory_ledger
            WHERE receive_item_id = v_item.item_id
              AND direction = 'in'  -- Only reverse 'in' entries
        LOOP
            RAISE NOTICE 'Found ledger entry: %, direction: %, pack_qty: %', 
                v_ledger.ledger_id, v_ledger.direction, v_ledger.pack_qty;
            
            -- Update inventory balance directly (reduce quantities)
            UPDATE wms_inventory_balances
            SET 
                total_pack_qty = GREATEST(0, total_pack_qty - v_ledger.pack_qty),
                total_piece_qty = GREATEST(0, total_piece_qty - v_ledger.piece_qty),
                updated_at = CURRENT_TIMESTAMP
            WHERE warehouse_id = v_ledger.warehouse_id
              AND location_id = v_ledger.location_id
              AND sku_id = v_ledger.sku_id
              AND COALESCE(production_date, '1900-01-01'::date) = COALESCE(v_ledger.production_date, '1900-01-01'::date)
              AND COALESCE(expiry_date, '1900-01-01'::date) = COALESCE(v_ledger.expiry_date, '1900-01-01'::date)
              AND COALESCE(pallet_id_external, '') = COALESCE(v_ledger.pallet_id_external, '');
            
            RAISE NOTICE 'Updated balance for sku: % at location: %', v_ledger.sku_id, v_ledger.location_id;
        END LOOP;
        
        -- Delete ledger entries for this receive item
        DELETE FROM wms_inventory_ledger
        WHERE receive_item_id = v_item.item_id;
        
        RAISE NOTICE 'Deleted ledger entries for receive_item: %', v_item.item_id;
    END LOOP;
    
    -- Clean up any balance records that now have zero quantities
    DELETE FROM wms_inventory_balances
    WHERE total_pack_qty <= 0 
      AND total_piece_qty <= 0
      AND reserved_pack_qty <= 0
      AND reserved_piece_qty <= 0;
    
    RAISE NOTICE 'Cleanup completed for receive_id: %', OLD.receive_id;
    
    RETURN OLD;
END;
$function$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trg_cleanup_inventory_on_receive_delete ON wms_receives;

-- Create trigger BEFORE DELETE on wms_receives
CREATE TRIGGER trg_cleanup_inventory_on_receive_delete
    BEFORE DELETE ON wms_receives
    FOR EACH ROW
    EXECUTE FUNCTION cleanup_inventory_on_receive_delete();

-- Add comment
COMMENT ON FUNCTION public.cleanup_inventory_on_receive_delete() IS 
'Trigger function to cleanup inventory_ledger and inventory_balances when a receive is deleted.
Runs BEFORE DELETE on wms_receives to:
1. Find all related receive_items
2. Update inventory_balances to reduce quantities
3. Delete related ledger entries
4. Clean up zero-quantity balance records';

-- ============================================================================
-- Verification query (run manually to test)
-- ============================================================================
-- SELECT 
--     tgname as trigger_name,
--     tgtype,
--     pg_get_triggerdef(oid) as trigger_definition
-- FROM pg_trigger
-- WHERE tgrelid = 'wms_receives'::regclass
--   AND tgname = 'trg_cleanup_inventory_on_receive_delete';
