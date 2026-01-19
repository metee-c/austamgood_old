-- ============================================================================
-- Migration: 260_fix_face_sheet_reservation_virtual_status.sql
-- Description: แก้ไข reserve_stock_for_face_sheet_items ให้ใช้ 'reserved' แทน 'virtual'
--              เพราะ CHECK constraint ไม่อนุญาตให้ใช้ 'virtual' status
-- 
-- Issue: Function ใช้ status = 'virtual' สำหรับ Virtual Pallet reservations
--        แต่ CHECK constraint อนุญาตเฉพาะ: 'reserved', 'picked', 'cancelled', 'loaded'
-- 
-- Fix: เปลี่ยนจาก 'virtual' เป็น 'reserved' เพราะ:
--      1. Virtual Pallet reservations ก็คือการจองสต็อคเหมือนกัน
--      2. สามารถแยกแยะได้จาก balance_id ที่ชี้ไปยัง Virtual Pallet
--      3. ไม่ต้องเพิ่ม 'virtual' เข้าไปใน CHECK constraint
-- ============================================================================

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
    v_virtual_balance_id BIGINT;
    v_virtual_pallet_id VARCHAR;
BEGIN
    -- ✅ FIX: Set lock timeout to prevent indefinite waiting
    SET LOCAL lock_timeout = '5s';
    
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
        
        -- ========================================
        -- STEP 1: จองจากพาเลทจริงก่อน (FEFO/FIFO)
        -- ========================================
        -- ✅ FIX: Add FOR UPDATE to lock rows during reservation
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
            AND ib.pallet_id NOT LIKE 'VIRTUAL-%'  -- ✅ ไม่รวม Virtual Pallet
            AND ml.location_type IN ('floor', 'rack', 'bulk')
            AND ml.active_status = 'active'
            ORDER BY 
                ib.expiry_date ASC NULLS LAST,
                ib.production_date ASC NULLS LAST,
                ib.balance_id ASC
            FOR UPDATE OF ib  -- ✅ CRITICAL: Lock rows to prevent race condition
        LOOP
            EXIT WHEN v_qty_reserved >= v_qty_needed;
            
            DECLARE
                v_qty_to_reserve NUMERIC;
                v_pack_to_reserve NUMERIC;
            BEGIN
                v_qty_to_reserve := LEAST(v_balance.available_qty, v_qty_needed - v_qty_reserved);
                v_pack_to_reserve := v_qty_to_reserve / v_qty_per_pack;
                
                -- Update inventory balance
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
        
        -- ========================================
        -- STEP 2: ถ้ายังไม่พอ → สร้าง reservation บน Virtual Pallet
        -- ========================================
        IF v_qty_reserved < v_qty_needed THEN
            DECLARE
                v_qty_short NUMERIC;
                v_pack_short NUMERIC;
                v_prep_area_location VARCHAR;
            BEGIN
                v_qty_short := v_qty_needed - v_qty_reserved;
                v_pack_short := v_qty_short / v_qty_per_pack;
                
                -- หา Prep Area location สำหรับ SKU นี้
                SELECT pa.area_code INTO v_prep_area_location
                FROM sku_preparation_area_mapping spam
                JOIN preparation_area pa ON pa.area_id = spam.preparation_area_id
                WHERE spam.sku_id = v_item.sku_id
                AND spam.warehouse_id = p_warehouse_id
                AND pa.status = 'active'
                ORDER BY spam.priority ASC, spam.is_primary DESC
                LIMIT 1;
                
                -- ถ้าไม่เจอ mapping ให้ใช้ PK001 เป็น default
                IF v_prep_area_location IS NULL THEN
                    v_prep_area_location := 'PK001';
                END IF;
                
                -- สร้าง Virtual Pallet ID
                v_virtual_pallet_id := 'VIRTUAL-' || v_item.sku_id || '-' || TO_CHAR(CURRENT_TIMESTAMP, 'YYYYMMDDHH24MISS');
                
                -- สร้าง Virtual Balance (negative stock)
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
                    -v_qty_short,  -- Negative = deficit
                    0,
                    -v_pack_short,
                    0,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                )
                RETURNING balance_id INTO v_virtual_balance_id;
                
                -- ✅ FIX: ใช้ 'reserved' แทน 'virtual' เพราะ CHECK constraint ไม่อนุญาต 'virtual'
                -- สามารถแยกแยะ Virtual Pallet ได้จาก pallet_id ที่ขึ้นต้นด้วย 'VIRTUAL-'
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
                    'reserved',  -- ✅ เปลี่ยนจาก 'virtual' เป็น 'reserved'
                    CURRENT_TIMESTAMP
                );
                
                v_qty_reserved := v_qty_reserved + v_qty_short;
                v_has_insufficient := TRUE;
            END;
        END IF;
        
        -- Check if we reserved enough
        IF v_qty_reserved >= v_qty_needed THEN
            v_items_reserved := v_items_reserved + 1;
            
            UPDATE face_sheet_items
            SET status = 'reserved'
            WHERE id = v_item.item_id;
        ELSE
            -- Record insufficient stock (shouldn't happen with Virtual Pallet)
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
'จองสต็อคสำหรับ Face Sheet Items รองรับ Virtual Pallet เมื่อสต็อกไม่พอ (Fixed: ใช้ status=reserved แทน virtual)';

-- Grant permissions
GRANT EXECUTE ON FUNCTION reserve_stock_for_face_sheet_items TO anon, authenticated, service_role;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 260 completed: Fixed reserve_stock_for_face_sheet_items to use status=reserved instead of virtual';
END $$;
