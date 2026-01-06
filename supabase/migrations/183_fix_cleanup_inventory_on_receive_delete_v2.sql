-- ============================================================================
-- Migration: 183_fix_cleanup_inventory_on_receive_delete_v2.sql
-- Description: แก้ไข trigger cleanup_inventory_on_receive_delete ให้จัดการ
--              กรณีที่สินค้าถูกย้ายไปที่อื่นแล้ว
-- Issue: เมื่อลบ receive ที่มีการย้ายสินค้าไปแล้ว:
--        1. Balance ที่ location ปัจจุบันไม่ถูกลด
--        2. Transfer ledger entries ไม่ถูกลบ
-- Solution: 
--        1. หา location ปัจจุบันของ pallet จาก balance table
--        2. ลบ balance ที่ location ปัจจุบัน
--        3. ลบ ledger entries ทั้งหมดที่เกี่ยวข้องกับ pallet_id
-- ============================================================================

-- Function: cleanup inventory when receive is deleted (V2 - handles transferred items)
CREATE OR REPLACE FUNCTION public.cleanup_inventory_on_receive_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    v_item RECORD;
    v_ledger RECORD;
    v_balance RECORD;
    v_balance_ids bigint[];
    v_deleted_count integer;
BEGIN
    RAISE NOTICE 'Cleaning up inventory for receive_id: %', OLD.receive_id;
    
    -- Loop through all receive items for this receive
    FOR v_item IN 
        SELECT item_id, sku_id, pack_quantity, piece_quantity, pallet_id
        FROM wms_receive_items
        WHERE receive_id = OLD.receive_id
    LOOP
        RAISE NOTICE 'Processing receive_item: %, sku: %, pallet_id: %', 
            v_item.item_id, v_item.sku_id, v_item.pallet_id;
        
        -- ============================================================
        -- STEP 1: Handle balance at CURRENT location (not original)
        -- ============================================================
        IF v_item.pallet_id IS NOT NULL THEN
            -- Find current balance for this pallet (may have been transferred)
            FOR v_balance IN
                SELECT balance_id, warehouse_id, location_id, sku_id, 
                       total_pack_qty, total_piece_qty, pallet_id
                FROM wms_inventory_balances
                WHERE pallet_id = v_item.pallet_id
            LOOP
                RAISE NOTICE 'Found balance at current location: % (balance_id: %, qty: %)', 
                    v_balance.location_id, v_balance.balance_id, v_balance.total_piece_qty;
                
                -- Delete the balance record entirely (since the receive is being deleted)
                DELETE FROM wms_inventory_balances
                WHERE balance_id = v_balance.balance_id;
                
                RAISE NOTICE 'Deleted balance_id: % for pallet: %', v_balance.balance_id, v_item.pallet_id;
            END LOOP;
            
            -- ============================================================
            -- STEP 2: Delete ALL ledger entries for this pallet_id
            -- (includes receive, transfer_in, transfer_out, transfer)
            -- ============================================================
            DELETE FROM wms_inventory_ledger
            WHERE pallet_id = v_item.pallet_id;
            
            GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
            RAISE NOTICE 'Deleted % ledger entries for pallet_id: %', v_deleted_count, v_item.pallet_id;
        END IF;
        
        -- ============================================================
        -- STEP 3: Delete ledger entries by receive_item_id (fallback)
        -- This handles cases where pallet_id is NULL
        -- ============================================================
        DELETE FROM wms_inventory_ledger
        WHERE receive_item_id = v_item.item_id;
        
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        IF v_deleted_count > 0 THEN
            RAISE NOTICE 'Deleted % ledger entries by receive_item_id: %', v_deleted_count, v_item.item_id;
        END IF;
    END LOOP;
    
    -- ============================================================
    -- STEP 4: Cleanup reservations for zero-quantity balances
    -- ============================================================
    SELECT ARRAY_AGG(balance_id) INTO v_balance_ids
    FROM wms_inventory_balances
    WHERE total_pack_qty <= 0 
      AND total_piece_qty <= 0
      AND reserved_pack_qty <= 0
      AND reserved_piece_qty <= 0;
    
    IF v_balance_ids IS NOT NULL AND array_length(v_balance_ids, 1) > 0 THEN
        -- Delete face_sheet_item_reservations
        DELETE FROM face_sheet_item_reservations
        WHERE balance_id = ANY(v_balance_ids);
        
        -- Delete bonus_face_sheet_item_reservations
        DELETE FROM bonus_face_sheet_item_reservations
        WHERE balance_id = ANY(v_balance_ids);
        
        -- Delete picklist_item_reservations
        DELETE FROM picklist_item_reservations
        WHERE balance_id = ANY(v_balance_ids);
        
        RAISE NOTICE 'Cleaned up reservations for % zero-quantity balance(s)', array_length(v_balance_ids, 1);
    END IF;
    
    -- ============================================================
    -- STEP 5: Clean up any remaining zero-quantity balance records
    -- ============================================================
    DELETE FROM wms_inventory_balances
    WHERE total_pack_qty <= 0 
      AND total_piece_qty <= 0
      AND reserved_pack_qty <= 0
      AND reserved_piece_qty <= 0;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    IF v_deleted_count > 0 THEN
        RAISE NOTICE 'Cleaned up % zero-quantity balance records', v_deleted_count;
    END IF;
    
    RAISE NOTICE 'Cleanup completed for receive_id: %', OLD.receive_id;
    
    RETURN OLD;
END;
$function$;

-- Add comment
COMMENT ON FUNCTION public.cleanup_inventory_on_receive_delete() IS 
'Trigger function to cleanup inventory when a receive is deleted (V2).
Handles cases where items have been transferred to other locations:
1. Finds current location of each pallet from balance table
2. Deletes balance records for the pallet
3. Deletes ALL ledger entries for the pallet (receive, transfer, etc.)
4. Cleans up reservations and zero-quantity balances';
