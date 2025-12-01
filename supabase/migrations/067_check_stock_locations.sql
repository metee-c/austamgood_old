-- Check where stock is located for face_sheet 38 SKUs

-- 1. Show all SKUs needed
SELECT 
    fsi.id,
    fsi.sku_id,
    fsi.quantity,
    ms.sku_name
FROM face_sheet_items fsi
JOIN master_sku ms ON ms.sku_id = fsi.sku_id
WHERE fsi.face_sheet_id = 38
ORDER BY fsi.id;

-- 2. Show where stock is located for these SKUs
SELECT 
    ib.balance_id,
    ib.sku_id,
    ib.location_id,
    ml.location_code,
    ml.location_type,
    ib.total_piece_qty,
    ib.reserved_piece_qty,
    ib.total_piece_qty - ib.reserved_piece_qty as available_qty
FROM wms_inventory_balances ib
JOIN master_location ml ON ml.location_id = ib.location_id
WHERE ib.sku_id IN (
    SELECT DISTINCT sku_id 
    FROM face_sheet_items 
    WHERE face_sheet_id = 38
)
AND ib.total_piece_qty > ib.reserved_piece_qty
ORDER BY ib.sku_id, ml.location_type, ib.balance_id;

-- 3. Summary by location type
SELECT 
    ml.location_type,
    ml.location_code,
    COUNT(DISTINCT ib.sku_id) as sku_count,
    SUM(ib.total_piece_qty - ib.reserved_piece_qty) as total_available_qty
FROM wms_inventory_balances ib
JOIN master_location ml ON ml.location_id = ib.location_id
WHERE ib.sku_id IN (
    SELECT DISTINCT sku_id 
    FROM face_sheet_items 
    WHERE face_sheet_id = 38
)
AND ib.total_piece_qty > ib.reserved_piece_qty
GROUP BY ml.location_type, ml.location_code
ORDER BY ml.location_type, ml.location_code;
