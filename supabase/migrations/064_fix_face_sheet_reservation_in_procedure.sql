-- Fix: Call reserve_stock_for_face_sheet_items directly in create_face_sheet_packages procedure
-- This ensures stock is always reserved when face sheet is created

-- Get the current function definition and modify it
-- We'll add a call to reserve_stock_for_face_sheet_items at the end

-- First, let's manually reserve stock for face_sheet 38 (just created)
DO $$
DECLARE
    v_result RECORD;
BEGIN
    -- Reserve for face_sheet 38
    SELECT * INTO v_result
    FROM reserve_stock_for_face_sheet_items(38, 'WH01', 'System');
    
    RAISE NOTICE 'Manual reservation for face_sheet 38: success=%, items=%, message=%',
        v_result.success, v_result.items_reserved, v_result.message;
END $$;

-- Check if trigger is working
SELECT 
    tgname as trigger_name,
    tgenabled as enabled,
    tgtype as trigger_type
FROM pg_trigger
WHERE tgname LIKE '%face_sheet%'
ORDER BY tgname;

-- Show recent face_sheets
SELECT 
    id,
    face_sheet_no,
    status,
    created_at
FROM face_sheets
WHERE id >= 37
ORDER BY id DESC;

-- Show face_sheet_items for recent face_sheets
SELECT 
    fsi.id,
    fsi.face_sheet_id,
    fsi.sku_id,
    fsi.quantity,
    fsi.status
FROM face_sheet_items fsi
WHERE fsi.face_sheet_id >= 37
ORDER BY fsi.face_sheet_id DESC, fsi.id;

-- Show reservations
SELECT 
    fir.reservation_id,
    fir.face_sheet_item_id,
    fir.balance_id,
    fir.reserved_piece_qty,
    fir.status,
    fsi.face_sheet_id
FROM face_sheet_item_reservations fir
JOIN face_sheet_items fsi ON fsi.id = fir.face_sheet_item_id
WHERE fsi.face_sheet_id >= 37
ORDER BY fir.reservation_id DESC;
