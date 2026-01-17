-- ============================================================================
-- Migration: Add Row-Level Locking to Stock Reservation Functions
-- File: 220_add_row_locking_to_reservations.sql
-- Priority: P0 - CRITICAL
-- Date: 2026-01-17
-- Author: Kiro AI
-- 
-- Purpose: ป้องกัน Race Condition ในการจองสต็อค
-- Changes:
--   1. Add FOR UPDATE to reserve_stock_for_face_sheet_items
--   2. Add FOR UPDATE to reserve_stock_for_bonus_face_sheet_items
--   3. Add lock timeout for safety
-- 
-- Bug Fixed: BUG-001 - Race Condition causing overselling
-- Evidence: Multiple concurrent requests can read same available stock
-- Solution: Add FOR UPDATE clause to lock rows during reservation
-- ============================================================================

-- ============================================================================
-- PART 1: Update reserve_stock_for_face_sheet_items
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
                
                -- สร้าง reservation บน Virtual Pallet
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
                    'virtual',  -- Mark as virtual reservation
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

-- Add comment
COMMENT ON FUNCTION public.reserve_stock_for_face_sheet_items IS 
  'จองสต็อคสำหรับใบปะหน้า (FEFO+FIFO) - WITH ROW LOCKING v2.0 - Fixed race condition';

-- ============================================================================
-- PART 2: Update reserve_stock_for_bonus_face_sheet_items
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reserve_stock_for_bonus_face_sheet_items(
    p_bonus_face_sheet_id bigint,
    p_warehouse_id character varying DEFAULT 'WH01'::character varying,
    p_reserved_by character varying DEFAULT 'System'::character varying
)
RETURNS TABLE (
    success boolean,
    items_reserved integer,
    items_total integer,
    message text
)
LANGUAGE plpgsql
AS $function$
DECLARE
    v_item RECORD;
    v_balance RECORD;
    v_items_count INTEGER := 0;
    v_items_reserved INTEGER := 0;
    v_remaining_qty NUMERIC;
    v_qty_to_reserve NUMERIC;
    v_pack_to_reserve NUMERIC;
    v_qty_per_pack NUMERIC;
    v_prep_area_zones TEXT[];
    v_prep_area_location_ids TEXT[];
BEGIN
    -- ✅ FIX: Set lock timeout
    SET LOCAL lock_timeout = '5s';
    
    -- Get preparation area zones
    SELECT ARRAY_AGG(DISTINCT zone) INTO v_prep_area_zones
    FROM preparation_area
    WHERE zone IS NOT NULL;

    -- Get location IDs in prep areas
    SELECT ARRAY_AGG(location_id) INTO v_prep_area_location_ids
    FROM master_location
    WHERE warehouse_id = p_warehouse_id
      AND zone = ANY(v_prep_area_zones);

    IF v_prep_area_location_ids IS NULL OR ARRAY_LENGTH(v_prep_area_location_ids, 1) = 0 THEN
        RETURN QUERY SELECT false, 0, 0, 'No preparation area locations found';
        RETURN;
    END IF;

    -- Loop through items
    FOR v_item IN
        SELECT
            bfsi.id,
            bfsi.sku_id,
            bfsi.source_location_id,
            bfsi.quantity_to_pick,
            COALESCE(ms.qty_per_pack, 1) as qty_per_pack
        FROM bonus_face_sheet_items bfsi
        LEFT JOIN master_sku ms ON bfsi.sku_id = ms.sku_id
        WHERE bfsi.face_sheet_id = p_bonus_face_sheet_id
          AND bfsi.quantity_to_pick > 0
          AND bfsi.sku_id IS NOT NULL
        ORDER BY bfsi.id
    LOOP
        v_items_count := v_items_count + 1;
        v_remaining_qty := v_item.quantity_to_pick;
        v_qty_per_pack := v_item.qty_per_pack;

        -- ✅ FIX: Add FOR UPDATE to lock rows
        FOR v_balance IN
            SELECT
                balance_id,
                location_id,
                total_piece_qty,
                reserved_piece_qty,
                total_pack_qty,
                reserved_pack_qty,
                production_date,
                expiry_date,
                lot_no,
                (total_piece_qty - COALESCE(reserved_piece_qty, 0)) as available_piece_qty
            FROM wms_inventory_balances
            WHERE warehouse_id = p_warehouse_id
              AND sku_id = v_item.sku_id
              AND (total_piece_qty - COALESCE(reserved_piece_qty, 0)) > 0
              AND location_id = ANY(v_prep_area_location_ids)
              AND (v_item.source_location_id IS NULL OR location_id = v_item.source_location_id)
            ORDER BY
                CASE WHEN expiry_date IS NULL THEN 1 ELSE 0 END,
                expiry_date ASC NULLS LAST,
                production_date ASC NULLS LAST,
                lot_no ASC NULLS LAST,
                balance_id ASC
            FOR UPDATE  -- ✅ CRITICAL: Lock rows to prevent race condition
        LOOP
            IF v_remaining_qty <= v_balance.available_piece_qty THEN
                v_qty_to_reserve := v_remaining_qty;
            ELSE
                v_qty_to_reserve := v_balance.available_piece_qty;
            END IF;

            v_pack_to_reserve := v_qty_to_reserve / v_qty_per_pack;

            -- Update balance
            UPDATE wms_inventory_balances
            SET
                reserved_piece_qty = COALESCE(reserved_piece_qty, 0) + v_qty_to_reserve,
                reserved_pack_qty = COALESCE(reserved_pack_qty, 0) + v_pack_to_reserve,
                updated_at = CURRENT_TIMESTAMP
            WHERE balance_id = v_balance.balance_id;

            -- Insert reservation
            INSERT INTO bonus_face_sheet_item_reservations (
                bonus_face_sheet_item_id,
                balance_id,
                reserved_piece_qty,
                reserved_pack_qty,
                reserved_by,
                status
            ) VALUES (
                v_item.id,
                v_balance.balance_id,
                v_qty_to_reserve,
                v_pack_to_reserve,
                p_reserved_by,
                'reserved'
            );

            v_remaining_qty := v_remaining_qty - v_qty_to_reserve;

            IF v_remaining_qty <= 0 THEN
                v_items_reserved := v_items_reserved + 1;
                EXIT;
            END IF;
        END LOOP;
    END LOOP;

    -- Return result
    IF v_items_count = 0 THEN
        RETURN QUERY SELECT false, 0, 0, 'No items to reserve';
    ELSIF v_items_reserved = v_items_count THEN
        RETURN QUERY SELECT true, v_items_reserved, v_items_count,
            format('Reserved %s/%s items successfully', v_items_reserved, v_items_count);
    ELSE
        RETURN QUERY SELECT false, v_items_reserved, v_items_count,
            format('Partial reservation: %s/%s items', v_items_reserved, v_items_count);
    END IF;
END;
$function$;

-- Add comment
COMMENT ON FUNCTION public.reserve_stock_for_bonus_face_sheet_items IS
  'จองสต็อคสำหรับใบปะหน้าของแถม (FEFO+FIFO) - WITH ROW LOCKING v2.0 - Fixed race condition';

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Verify functions updated
SELECT 
  proname as function_name,
  obj_description(oid) as description
FROM pg_proc 
WHERE proname IN (
  'reserve_stock_for_face_sheet_items',
  'reserve_stock_for_bonus_face_sheet_items'
);

-- Check for any overselling
SELECT 
  COUNT(*) as oversold_count,
  SUM(reserved_piece_qty - total_piece_qty) as total_oversold
FROM wms_inventory_balances
WHERE reserved_piece_qty > total_piece_qty;
-- Expected: 0, 0

-- ============================================================================
-- Migration Complete
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 220 completed successfully';
  RAISE NOTICE '   Fixed: BUG-001 - Race Condition in stock reservation';
  RAISE NOTICE '   Added: FOR UPDATE clause to prevent concurrent access';
  RAISE NOTICE '   Added: lock_timeout = 5s for safety';
  RAISE NOTICE '   Functions updated: 2';
  RAISE NOTICE '   - reserve_stock_for_face_sheet_items';
  RAISE NOTICE '   - reserve_stock_for_bonus_face_sheet_items';
END $$;
