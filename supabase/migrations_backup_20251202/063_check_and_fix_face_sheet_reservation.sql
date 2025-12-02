-- Check and fix face sheet stock reservation

-- 1. Check if trigger exists
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_name LIKE '%face_sheet%reserve%'
ORDER BY trigger_name;

-- 2. Manually reserve stock for face_sheet_id 37 (the one just created)
DO $$
DECLARE
    v_result RECORD;
BEGIN
    -- Call reservation function for face_sheet 37
    SELECT * INTO v_result
    FROM reserve_stock_for_face_sheet_items(37, 'WH01', 'System');
    
    RAISE NOTICE 'Reservation result for face_sheet 37: success=%, items_reserved=%, message=%',
        v_result.success, v_result.items_reserved, v_result.message;
        
    IF NOT v_result.success THEN
        RAISE WARNING 'Insufficient stock items: %', v_result.insufficient_stock_items;
    END IF;
END $$;

-- 3. Check reservations created
SELECT 
    fir.reservation_id,
    fir.face_sheet_item_id,
    fir.balance_id,
    fir.reserved_piece_qty,
    fir.reserved_pack_qty,
    fir.status,
    fi.sku_id,
    fi.quantity as item_quantity
FROM face_sheet_item_reservations fir
JOIN face_sheet_items fi ON fi.id = fir.face_sheet_item_id
WHERE fi.face_sheet_id = 37
ORDER BY fir.reservation_id;

-- 4. Check inventory balances reserved qty
SELECT 
    ib.balance_id,
    ib.sku_id,
    ib.location_id,
    ib.total_piece_qty,
    ib.reserved_piece_qty,
    ib.total_pack_qty,
    ib.reserved_pack_qty
FROM wms_inventory_balances ib
WHERE ib.reserved_piece_qty > 0
ORDER BY ib.balance_id DESC
LIMIT 20;
