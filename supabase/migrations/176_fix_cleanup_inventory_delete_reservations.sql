-- ============================================================================
-- Migration: 176_fix_cleanup_inventory_delete_reservations.sql
-- Description: แก้ไข cleanup_inventory_on_receive_delete ให้ลบ reservations ก่อน
--              เพื่อแก้ปัญหา foreign key constraint violation
-- Issue: ลบ receive ไม่สำเร็จเพราะ face_sheet_item_reservations ยังอ้างอิง balance_id
-- ============================================================================

-- Function: cleanup inventory when receive is deleted (fixed version)
CREATE OR REPLACE FUNCTION public.cleanup_inventory_on_receive_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    v_item RECORD;
    v_ledger RECORD;
    v_balance_id uuid;
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
            
            -- Find the balance_id that will be affected
            SELECT balance_id INTO v_balance_id
            FROM wms_inventory_balances
            WHERE warehouse_id = v_ledger.warehouse_id
              AND location_id = v_ledger.location_id
              AND sku_id = v_ledger.sku_id
              AND COALESCE(production_date, '1900-01-01'::date) = COALESCE(v_ledger.production_date, '1900-01-01'::date)
              AND COALESCE(expiry_date, '1900-01-01'::date) = COALESCE(v_ledger.expiry_date, '1900-01-01'::date)
              AND COALESCE(pallet_id_external, '') = COALESCE(v_ledger.pallet_id_external, '');
            
            -- Update inventory balance directly (reduce quantities)
            UPDATE wms_inventory_balances
            SET 
                total_pack_qty = GREATEST(0, total_pack_qty - v_ledger.pack_qty),
                total_piece_qty = GREATEST(0, total_piece_qty - v_ledger.piece_qty),
                updated_at = CURRENT_TIMESTAMP
            WHERE balance_id = v_balance_id;
            
            RAISE NOTICE 'Updated balance for sku: % at location: %, balance_id: %', 
                v_ledger.sku_id, v_ledger.location_id, v_balance_id;
        END LOOP;
        
        -- Delete ledger entries for this receive item
        DELETE FROM wms_inventory_ledger
        WHERE receive_item_id = v_item.item_id;
        
        RAISE NOTICE 'Deleted ledger entries for receive_item: %', v_item.item_id;
    END LOOP;
    
    -- First, delete reservations that reference balance records that will be deleted
    -- This fixes the foreign key constraint violation
    DELETE FROM face_sheet_item_reservations
    WHERE balance_id IN (
        SELECT balance_id FROM wms_inventory_balances
        WHERE total_pack_qty <= 0 
          AND total_piece_qty <= 0
          AND reserved_pack_qty <= 0
          AND reserved_piece_qty <= 0
    );
    
    RAISE NOTICE 'Deleted orphan face_sheet_item_reservations';
    
    -- Also delete bonus_face_sheet_item_reservations if exists
    DELETE FROM bonus_face_sheet_item_reservations
    WHERE balance_id IN (
        SELECT balance_id FROM wms_inventory_balances
        WHERE total_pack_qty <= 0 
          AND total_piece_qty <= 0
          AND reserved_pack_qty <= 0
          AND reserved_piece_qty <= 0
    );
    
    RAISE NOTICE 'Deleted orphan bonus_face_sheet_item_reservations';
    
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

-- Add comment
COMMENT ON FUNCTION public.cleanup_inventory_on_receive_delete() IS 
'Trigger function to cleanup inventory_ledger and inventory_balances when a receive is deleted.
Runs BEFORE DELETE on wms_receives to:
1. Find all related receive_items
2. Update inventory_balances to reduce quantities
3. Delete related ledger entries
4. Delete orphan reservations (face_sheet_item_reservations, bonus_face_sheet_item_reservations)
5. Clean up zero-quantity balance records';
