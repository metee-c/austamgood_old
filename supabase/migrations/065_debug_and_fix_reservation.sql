-- Debug and fix reservation issue

-- 1. Check if face_sheet_items exist
SELECT 
    id,
    face_sheet_id,
    sku_id,
    quantity,
    status
FROM face_sheet_items
WHERE face_sheet_id = 38
ORDER BY id;

-- 2. Check if there's stock available in Preparation Area
SELECT 
    ib.balance_id,
    ib.sku_id,
    ib.location_id,
    ib.total_piece_qty,
    ib.reserved_piece_qty,
    ib.total_piece_qty - ib.reserved_piece_qty as available_qty,
    ml.location_code
FROM wms_inventory_balances ib
JOIN master_location ml ON ml.location_id = ib.location_id
WHERE ib.sku_id IN (
    SELECT DISTINCT sku_id 
    FROM face_sheet_items 
    WHERE face_sheet_id = 38
)
AND ml.location_code LIKE 'Prep%'
AND ib.total_piece_qty > ib.reserved_piece_qty
ORDER BY ib.sku_id, ib.balance_id;

-- 3. Manually call reserve function with detailed output
DO $$
DECLARE
    v_result RECORD;
    v_item RECORD;
BEGIN
    RAISE NOTICE '=== Starting manual reservation for face_sheet 38 ===';
    
    -- Check each item
    FOR v_item IN 
        SELECT id, sku_id, quantity 
        FROM face_sheet_items 
        WHERE face_sheet_id = 38
        ORDER BY id
    LOOP
        RAISE NOTICE 'Item %: SKU=%, Qty=%', v_item.id, v_item.sku_id, v_item.quantity;
    END LOOP;
    
    -- Call reservation function
    SELECT * INTO v_result
    FROM reserve_stock_for_face_sheet_items(38, 'WH01', 'System');
    
    RAISE NOTICE '=== Reservation Result ===';
    RAISE NOTICE 'Success: %', v_result.success;
    RAISE NOTICE 'Items Reserved: %', v_result.items_reserved;
    RAISE NOTICE 'Message: %', v_result.message;
    
    IF NOT v_result.success THEN
        RAISE NOTICE 'Insufficient Stock Items: %', v_result.insufficient_stock_items;
    END IF;
END $$;

-- 4. Check reservations after manual call
SELECT 
    fir.reservation_id,
    fir.face_sheet_item_id,
    fir.balance_id,
    fir.reserved_piece_qty,
    fir.reserved_pack_qty,
    fir.status,
    fsi.sku_id,
    fsi.quantity
FROM face_sheet_item_reservations fir
JOIN face_sheet_items fsi ON fsi.id = fir.face_sheet_item_id
WHERE fsi.face_sheet_id = 38
ORDER BY fir.reservation_id;

-- 5. Check updated inventory balances
SELECT 
    ib.balance_id,
    ib.sku_id,
    ib.location_id,
    ib.total_piece_qty,
    ib.reserved_piece_qty,
    ml.location_code
FROM wms_inventory_balances ib
JOIN master_location ml ON ml.location_id = ib.location_id
WHERE ib.reserved_piece_qty > 0
AND ml.location_code LIKE 'Prep%'
ORDER BY ib.updated_at DESC
LIMIT 20;
