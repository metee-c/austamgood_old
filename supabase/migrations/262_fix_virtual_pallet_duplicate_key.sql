-- ============================================================================
-- Migration: 262_fix_virtual_pallet_duplicate_key.sql
-- Description: แก้ไขปัญหา duplicate key เมื่อสร้าง Virtual Pallet หลายครั้งสำหรับ SKU เดียวกัน
--              ใช้ ON CONFLICT DO UPDATE แทนการ INSERT ใหม่ทุกครั้ง
-- ============================================================================

CREATE OR REPLACE FUNCTION reserve_stock_for_face_sheet_items(
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
    v_virtual_balance_id BIGINT;
    v_virtual_pallet_id VARCHAR;
BEGIN
    SET LOCAL lock_timeout = '5s';
    
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
        SELECT COALESCE(qty_per_pack, 1) INTO v_qty_per_pack
        FROM master_sku
        WHERE sku_id = v_item.sku_id;
        
        v_qty_needed := v_item.qty_needed;
        v_qty_reserved := 0;
        
        -- ========================================
        -- STEP 1: Reserve from real stock
        -- ========================================
        FOR v_balance IN
            SELECT 
                ib.balance_id,
                ib.location_id,
                ib.pallet_id,
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
            AND ib.pallet_id NOT LIKE 'VIRTUAL-%'
            AND ml.location_type IN ('floor', 'rack', 'bulk')
            AND ml.active_status = 'active'
            ORDER BY 
                ib.expiry_date ASC NULLS LAST,
                ib.production_date ASC NULLS LAST,
                ib.balance_id ASC
            FOR UPDATE OF ib
        LOOP
            EXIT WHEN v_qty_reserved >= v_qty_needed;
            
            DECLARE
                v_qty_to_reserve NUMERIC;
                v_pack_to_reserve NUMERIC;
            BEGIN
                v_qty_to_reserve := LEAST(v_balance.available_qty, v_qty_needed - v_qty_reserved);
                v_pack_to_reserve := v_qty_to_reserve / v_qty_per_pack;
                
                UPDATE wms_inventory_balances
                SET 
                    reserved_piece_qty = reserved_piece_qty + v_qty_to_reserve,
                    reserved_pack_qty = reserved_pack_qty + v_pack_to_reserve,
                    updated_at = CURRENT_TIMESTAMP
                WHERE balance_id = v_balance.balance_id;
                
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
        
        -- ========================================
        -- STEP 2: Create Virtual Pallet if needed
        -- ========================================
        IF v_qty_reserved < v_qty_needed THEN
            DECLARE
                v_qty_short NUMERIC;
                v_pack_short NUMERIC;
                v_prep_area_location VARCHAR;
            BEGIN
                v_qty_short := v_qty_needed - v_qty_reserved;
                v_pack_short := v_qty_short / v_qty_per_pack;
                
                -- Get preparation area for this SKU
                SELECT pa.area_code INTO v_prep_area_location
                FROM sku_preparation_area_mapping spam
                JOIN preparation_area pa ON pa.area_id = spam.preparation_area_id
                WHERE spam.sku_id = v_item.sku_id
                AND spam.warehouse_id = p_warehouse_id
                AND pa.status = 'active'
                ORDER BY spam.priority ASC, spam.is_primary DESC
                LIMIT 1;
                
                IF v_prep_area_location IS NULL THEN
                    v_prep_area_location := 'PK001';
                END IF;
                
                -- Generate Virtual Pallet ID (unique per SKU-location combination)
                v_virtual_pallet_id := 'VIRTUAL-' || v_item.sku_id;
                
                -- ✅ FIX: Use INSERT ... ON CONFLICT DO UPDATE to handle duplicates
                INSERT INTO wms_inventory_balances (
                    warehouse_id,
                    location_id,
                    sku_id,
                    pallet_id,
                    total_piece_qty,
                    reserved_piece_qty,
                    total_pack_qty,
                    reserved_pack_qty,
                    created_at,
                    updated_at
                )
                VALUES (
                    p_warehouse_id,
                    v_prep_area_location,
                    v_item.sku_id,
                    v_virtual_pallet_id,
                    -v_qty_short,
                    0,
                    -v_pack_short,
                    0,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                )
                ON CONFLICT (warehouse_id, sku_id, location_id, COALESCE(pallet_id, ''))
                DO UPDATE SET
                    total_piece_qty = wms_inventory_balances.total_piece_qty - v_qty_short,
                    total_pack_qty = wms_inventory_balances.total_pack_qty - v_pack_short,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING balance_id INTO v_virtual_balance_id;
                
                -- Create reservation for Virtual Pallet
                INSERT INTO face_sheet_item_reservations (
                    face_sheet_item_id,
                    balance_id,
                    reserved_piece_qty,
                    reserved_pack_qty,
                    status,
                    reserved_at
                ) VALUES (
                    v_item.item_id,
                    v_virtual_balance_id,
                    v_qty_short,
                    v_pack_short,
                    'reserved',
                    CURRENT_TIMESTAMP
                );
                
                v_qty_reserved := v_qty_reserved + v_qty_short;
                v_has_insufficient := TRUE;
            END;
        END IF;
        
        -- ========================================
        -- STEP 3: Update item status
        -- ========================================
        IF v_qty_reserved >= v_qty_needed THEN
            v_items_reserved := v_items_reserved + 1;
            
            UPDATE face_sheet_items
            SET status = 'reserved'
            WHERE id = v_item.item_id;
        ELSE
            v_insufficient_items := v_insufficient_items || jsonb_build_object(
                'item_id', v_item.item_id,
                'sku_id', v_item.sku_id,
                'qty_needed', v_qty_needed,
                'qty_reserved', v_qty_reserved,
                'qty_short', v_qty_needed - v_qty_reserved
            );
        END IF;
    END LOOP;
    
    -- ========================================
    -- STEP 4: Return result
    -- ========================================
    IF jsonb_array_length(v_insufficient_items) > 0 THEN
        RETURN QUERY SELECT 
            FALSE,
            v_items_reserved,
            'มีบางรายการที่สต็อคไม่เพียงพอ'::TEXT,
            v_insufficient_items;
    ELSIF v_has_insufficient THEN
        RETURN QUERY SELECT 
            TRUE,
            v_items_reserved,
            format('จองสต็อคสำเร็จ %s รายการ (มี Virtual Pallet)', v_items_reserved)::TEXT,
            '[]'::JSONB;
    ELSE
        RETURN QUERY SELECT 
            TRUE,
            v_items_reserved,
            format('จองสต็อคสำเร็จ %s รายการ', v_items_reserved)::TEXT,
            '[]'::JSONB;
    END IF;
END;
$function$;

COMMENT ON FUNCTION reserve_stock_for_face_sheet_items IS 
'จองสต็อคสำหรับ face sheet items พร้อมสร้าง Virtual Pallet ถ้าสต็อคไม่พอ (แก้ไข duplicate key issue)';

-- Grant permissions
GRANT EXECUTE ON FUNCTION reserve_stock_for_face_sheet_items TO anon, authenticated, service_role;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 262 completed: Fixed Virtual Pallet duplicate key issue';
END $$;
