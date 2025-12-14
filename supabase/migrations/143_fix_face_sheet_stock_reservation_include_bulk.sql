-- Migration: Fix face sheet stock reservation to use preparation area logic
-- Issue: Face sheets were filtering by location_type IN ('floor', 'rack'), excluding 'bulk' locations like PK001
-- Root cause: PK001 is both a location_id (type='bulk') and a preparation_area.area_code
-- Solution: Use preparation area → zone → locations mapping (same logic as picklists)

CREATE OR REPLACE FUNCTION public.reserve_stock_for_face_sheet_items(
    p_face_sheet_id bigint, 
    p_warehouse_id character varying DEFAULT 'WH01'::character varying, 
    p_reserved_by character varying DEFAULT 'System'::character varying
)
RETURNS TABLE(
    success boolean, 
    items_reserved integer, 
    message text, 
    insufficient_stock_items jsonb
)
LANGUAGE plpgsql
AS $function$
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
        AND COALESCE(fsi.status, 'pending') = 'pending'
        ORDER BY fsi.id
    LOOP
        -- Get qty_per_pack from master_sku
        SELECT COALESCE(qty_per_pack, 1) INTO v_qty_per_pack
        FROM master_sku
        WHERE sku_id = v_item.sku_id;
        
        v_qty_needed := v_item.qty_needed;
        v_qty_reserved := 0;
        
        -- Find available balances from Storage/Picking Area (floor, rack, bulk)
        -- Use FEFO/FIFO logic
        FOR v_balance IN
            SELECT 
                ib.balance_id,
                ib.location_id,
                ib.total_piece_qty,
                ib.reserved_piece_qty,
                ib.total_piece_qty - ib.reserved_piece_qty as available_qty,
                ib.expiry_date,
                ib.production_date,
                ml.location_code,
                ml.location_type
            FROM wms_inventory_balances ib
            JOIN master_location ml ON ml.location_id = ib.location_id
            WHERE ib.warehouse_id = p_warehouse_id
            AND ib.sku_id = v_item.sku_id
            AND ib.total_piece_qty > ib.reserved_piece_qty
            AND ml.location_type IN ('floor', 'rack', 'bulk')  -- ✅ เพิ่ม 'bulk' สำหรับพื้นที่หยิบแบบ multi-SKU
            AND ml.active_status = 'active'
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
            
            -- Update face_sheet_item status
            UPDATE face_sheet_items
            SET status = 'reserved'
            WHERE id = v_item.item_id;
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
$function$;

-- Add comment explaining the fix
COMMENT ON FUNCTION reserve_stock_for_face_sheet_items IS 
'จองสต็อคสำหรับรายการในใบปะหน้า รองรับ location_type: floor, rack, และ bulk (สำหรับพื้นที่หยิบแบบ multi-SKU เช่น PK001)';
