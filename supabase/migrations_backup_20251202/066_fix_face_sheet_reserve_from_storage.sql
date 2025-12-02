-- Fix: Make face_sheet reserve stock from Storage/Picking Area (like picklist)
-- Instead of Preparation Area

-- Drop existing function first
DROP FUNCTION IF EXISTS reserve_stock_for_face_sheet_items(bigint, character varying, character varying);

CREATE OR REPLACE FUNCTION reserve_stock_for_face_sheet_items(
    p_face_sheet_id BIGINT,
    p_warehouse_id VARCHAR DEFAULT 'WH01',
    p_reserved_by VARCHAR DEFAULT 'System'
)
RETURNS TABLE (
    success BOOLEAN,
    items_reserved INTEGER,
    message TEXT,
    insufficient_stock_items JSONB
) AS $$
DECLARE
    v_item RECORD;
    v_balance RECORD;
    v_items_reserved INTEGER := 0;
    v_insufficient_items JSONB := '[]'::JSONB;
    v_qty_needed NUMERIC;
    v_qty_reserved NUMERIC;
    v_pack_qty NUMERIC;
    v_qty_per_pack INTEGER;
    v_has_insufficient BOOLEAN := FALSE;
BEGIN
    -- Loop through each face_sheet_item
    FOR v_item IN
        SELECT 
            fsi.id as item_id,
            fsi.sku_id,
            fsi.quantity as qty_needed,
            fsi.uom
        FROM face_sheet_items fsi
        WHERE fsi.face_sheet_id = p_face_sheet_id
        AND fsi.status = 'pending'
        ORDER BY fsi.id
    LOOP
        -- Get qty_per_pack from master_sku
        SELECT COALESCE(qty_per_pack, 1) INTO v_qty_per_pack
        FROM master_sku
        WHERE sku_id = v_item.sku_id;
        
        v_qty_needed := v_item.qty_needed;
        v_qty_reserved := 0;
        
        -- Get default_location (area_code) from master_sku
        DECLARE
            v_area_code VARCHAR;
            v_zone_name VARCHAR;
            v_location_ids TEXT[];
        BEGIN
            SELECT default_location INTO v_area_code
            FROM master_sku
            WHERE sku_id = v_item.sku_id;
            
            IF v_area_code IS NULL THEN
                RAISE NOTICE 'SKU % has no default_location', v_item.sku_id;
                CONTINUE;
            END IF;
            
            -- Map area_code → zone name
            SELECT zone INTO v_zone_name
            FROM preparation_area
            WHERE area_code = v_area_code;
            
            IF v_zone_name IS NOT NULL THEN
                -- Get all location_ids in this zone
                SELECT ARRAY_AGG(location_id) INTO v_location_ids
                FROM master_location
                WHERE zone = v_zone_name
                AND active_status = 'active';
            ELSE
                -- Fallback: use area_code as location_id
                v_location_ids := ARRAY[v_area_code];
            END IF;
            
            IF v_location_ids IS NULL OR array_length(v_location_ids, 1) = 0 THEN
                RAISE NOTICE 'No locations found for SKU % (area: %, zone: %)', 
                    v_item.sku_id, v_area_code, v_zone_name;
                CONTINUE;
            END IF;
        END;
        
        -- Find available balances from locations in zone
        -- Use FEFO/FIFO logic
        FOR v_balance IN
            SELECT 
                ib.balance_id,
                ib.location_id,
                ib.total_piece_qty,
                ib.reserved_piece_qty,
                ib.total_pack_qty,
                ib.reserved_pack_qty,
                ib.total_piece_qty - ib.reserved_piece_qty as available_qty,
                ib.expiry_date,
                ib.production_date
            FROM wms_inventory_balances ib
            WHERE ib.warehouse_id = p_warehouse_id
            AND ib.sku_id = v_item.sku_id
            AND ib.location_id = ANY(v_location_ids)
            AND ib.total_piece_qty > ib.reserved_piece_qty
            ORDER BY 
                ib.expiry_date ASC NULLS LAST,  -- FEFO
                ib.production_date ASC NULLS LAST,  -- FIFO
                ib.balance_id ASC
        LOOP
            EXIT WHEN v_qty_reserved >= v_qty_needed;
            
            DECLARE
                v_qty_to_reserve NUMERIC;
                v_pack_to_reserve NUMERIC;
            BEGIN
                -- Calculate how much to reserve from this balance
                v_qty_to_reserve := LEAST(v_balance.available_qty, v_qty_needed - v_qty_reserved);
                v_pack_to_reserve := v_qty_to_reserve / v_qty_per_pack;
                
                -- Update inventory balance (increase reserved_qty)
                UPDATE wms_inventory_balances
                SET 
                    reserved_piece_qty = reserved_piece_qty + v_qty_to_reserve,
                    reserved_pack_qty = reserved_pack_qty + v_pack_to_reserve,
                    updated_at = CURRENT_TIMESTAMP
                WHERE balance_id = v_balance.balance_id;
                
                -- Insert reservation record
                INSERT INTO face_sheet_item_reservations (
                    face_sheet_item_id,
                    balance_id,
                    reserved_piece_qty,
                    reserved_pack_qty,
                    status,
                    reserved_at
                ) VALUES (
                    v_item.item_id,
                    v_balance.balance_id,
                    v_qty_to_reserve,
                    v_pack_to_reserve,
                    'reserved',
                    CURRENT_TIMESTAMP
                );
                
                v_qty_reserved := v_qty_reserved + v_qty_to_reserve;
            END;
        END LOOP;
        
        -- Check if we reserved enough
        IF v_qty_reserved >= v_qty_needed THEN
            v_items_reserved := v_items_reserved + 1;
        ELSE
            v_has_insufficient := TRUE;
            v_insufficient_items := v_insufficient_items || jsonb_build_object(
                'item_id', v_item.item_id,
                'sku_id', v_item.sku_id,
                'qty_needed', v_qty_needed,
                'qty_reserved', v_qty_reserved,
                'qty_short', v_qty_needed - v_qty_reserved
            );
        END IF;
    END LOOP;
    
    -- Return result
    IF v_has_insufficient THEN
        RETURN QUERY SELECT 
            FALSE,
            v_items_reserved,
            'มีบางรายการที่สต็อคไม่เพียงพอ'::TEXT,
            v_insufficient_items;
    ELSE
        RETURN QUERY SELECT 
            TRUE,
            v_items_reserved,
            format('จองสต็อคสำเร็จ %s รายการ', v_items_reserved)::TEXT,
            '[]'::JSONB;
    END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION reserve_stock_for_face_sheet_items IS
'จองสต็อคสำหรับ face_sheet_items จาก Storage/Picking Area (เหมือน picklist) ใช้ FEFO/FIFO logic';

-- Now reserve stock for face_sheet 38
SELECT * FROM reserve_stock_for_face_sheet_items(38, 'WH01', 'System');

-- Check results
SELECT 
    fir.reservation_id,
    fir.face_sheet_item_id,
    fir.balance_id,
    fir.reserved_piece_qty,
    fir.status,
    fsi.sku_id,
    ml.location_code
FROM face_sheet_item_reservations fir
JOIN face_sheet_items fsi ON fsi.id = fir.face_sheet_item_id
JOIN wms_inventory_balances ib ON ib.balance_id = fir.balance_id
JOIN master_location ml ON ml.location_id = ib.location_id
WHERE fsi.face_sheet_id = 38
ORDER BY fir.reservation_id;
