-- ============================================================================
-- Migration: 291_fix_sync_trigger_support_pallet_id.sql
-- Description: แก้ไข trigger sync_inventory_ledger_to_balance ให้รองรับทั้ง pallet_id และ pallet_id_external
-- 
-- ปัญหา:
-- 1. Trigger ใช้เฉพาะ pallet_id_external ในการ lookup แต่บาง record ใช้ pallet_id
-- 2. Trigger hardcode lot_no = '' แทนที่จะใช้ COALESCE(NEW.lot_no, '')
-- 3. ทำให้พาเลทที่รับเข้ามาใหม่ไม่ถูกสร้าง balance record
--
-- แก้ไข:
-- 1. ใช้ COALESCE(pallet_id, pallet_id_external) เพื่อรองรับทั้งสองแบบ
-- 2. แก้ไข lot_no ให้ใช้ COALESCE(NEW.lot_no, '') แทน hardcode
-- 3. เพิ่ม logging เพื่อ debug ง่ายขึ้น
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_inventory_ledger_to_balance()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    v_balance_id bigint;
    v_current_pack_qty numeric(18,2);
    v_current_piece_qty numeric(18,2);
    v_lookup_pallet_id text;
BEGIN
    -- ✅ เช็ค flag skip_balance_sync ก่อนทำงาน
    IF NEW.skip_balance_sync = TRUE THEN
        RAISE NOTICE '[SYNC TRIGGER] Skipping balance sync for ledger % (skip_balance_sync = TRUE)', NEW.ledger_id;
        RETURN NEW;
    END IF;

    -- ✅ ใช้ pallet_id หรือ pallet_id_external (อันไหนมีก่อนใช้อันนั้น)
    v_lookup_pallet_id := COALESCE(NEW.pallet_id, NEW.pallet_id_external, '');

    RAISE NOTICE '[SYNC TRIGGER] Processing ledger %: SKU=%, Location=%, Pallet=%, Direction=%', 
        NEW.ledger_id, NEW.sku_id, NEW.location_id, v_lookup_pallet_id, NEW.direction;

    -- Calculate the signed quantity based on direction
    IF NEW.direction = 'in' THEN
        v_current_pack_qty := NEW.pack_qty;
        v_current_piece_qty := NEW.piece_qty;
    ELSE -- direction = 'out'
        v_current_pack_qty := -NEW.pack_qty;
        v_current_piece_qty := -NEW.piece_qty;
    END IF;

    -- Check if balance record exists
    -- ✅ ใช้ COALESCE logic ที่รองรับทั้ง pallet_id และ pallet_id_external
    SELECT balance_id INTO v_balance_id
    FROM wms_inventory_balances
    WHERE warehouse_id = NEW.warehouse_id
      AND location_id = NEW.location_id
      AND sku_id = NEW.sku_id
      AND COALESCE(production_date, '1900-01-01'::date) = COALESCE(NEW.production_date, '1900-01-01'::date)
      AND COALESCE(expiry_date, '1900-01-01'::date) = COALESCE(NEW.expiry_date, '1900-01-01'::date)
      AND COALESCE(lot_no, '') = COALESCE(NEW.lot_no, '')  -- ✅ แก้ไขจาก hardcode ''
      AND COALESCE(pallet_id, '') = v_lookup_pallet_id;     -- ✅ ใช้ pallet_id แทน pallet_id_external

    IF v_balance_id IS NOT NULL THEN
        -- Update existing balance
        UPDATE wms_inventory_balances
        SET
            total_pack_qty = GREATEST(0, total_pack_qty + v_current_pack_qty),
            total_piece_qty = GREATEST(0, total_piece_qty + v_current_piece_qty),
            last_movement_at = NEW.movement_at,
            updated_at = CURRENT_TIMESTAMP
        WHERE balance_id = v_balance_id;

        RAISE NOTICE '[SYNC TRIGGER] Updated balance % for SKU % at location % pallet %', 
            v_balance_id, NEW.sku_id, NEW.location_id, v_lookup_pallet_id;
    ELSE
        -- Insert new balance record (only if direction is 'in')
        IF NEW.direction = 'in' THEN
            INSERT INTO wms_inventory_balances (
                warehouse_id,
                location_id,
                sku_id,
                pallet_id,
                pallet_id_external,
                production_date,
                expiry_date,
                total_pack_qty,
                total_piece_qty,
                reserved_pack_qty,
                reserved_piece_qty,
                last_movement_at,
                created_at,
                updated_at,
                lot_no
            ) VALUES (
                NEW.warehouse_id,
                NEW.location_id,
                NEW.sku_id,
                NEW.pallet_id,                    -- ✅ เก็บทั้งสองค่า
                NEW.pallet_id_external,           -- ✅ เก็บทั้งสองค่า
                NEW.production_date,
                NEW.expiry_date,
                NEW.pack_qty,
                NEW.piece_qty,
                0,
                0,
                NEW.movement_at,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP,
                NEW.lot_no                        -- ✅ ใช้ค่าจริงจาก ledger
            );

            RAISE NOTICE '[SYNC TRIGGER] Created new balance for SKU % at location % pallet %', 
                NEW.sku_id, NEW.location_id, v_lookup_pallet_id;
        ELSE
            RAISE WARNING '[SYNC TRIGGER] Cannot create balance for OUT transaction without existing balance. Ledger: %, SKU: %, Location: %',
                NEW.ledger_id, NEW.sku_id, NEW.location_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;

-- Update comment
COMMENT ON FUNCTION public.sync_inventory_ledger_to_balance() IS 
'Trigger function to sync inventory ledger entries to balance table.
Migration 291 fixes:
1. Support both pallet_id and pallet_id_external (uses whichever is available)
2. Fix lot_no lookup to use COALESCE(NEW.lot_no, '''') instead of hardcoded ''''
3. Add detailed logging for debugging
4. Store both pallet_id and pallet_id_external in balance table';

-- ============================================================================
-- Verification Query
-- ============================================================================
-- SELECT 
--   'Trigger function updated' as status,
--   pg_get_functiondef('public.sync_inventory_ledger_to_balance()'::regprocedure) as definition;
