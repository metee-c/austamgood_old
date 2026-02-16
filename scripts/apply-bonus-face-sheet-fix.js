const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const newFunctionSQL = `
CREATE OR REPLACE FUNCTION public.reserve_stock_for_bonus_face_sheet_items(
  p_bonus_face_sheet_id bigint,
  p_warehouse_id character varying DEFAULT 'WH001'::character varying,
  p_reserved_by character varying DEFAULT 'System'::character varying
)
RETURNS TABLE(
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
  v_available_qty NUMERIC;
  v_prep_area_zones TEXT[];
  v_prep_area_location_ids TEXT[];
  v_face_sheet_no VARCHAR;
BEGIN
  RAISE NOTICE '📦 Starting stock reservation for bonus face sheet %', p_bonus_face_sheet_id;

  SELECT face_sheet_no INTO v_face_sheet_no
  FROM bonus_face_sheets
  WHERE id = p_bonus_face_sheet_id;

  SELECT ARRAY_AGG(DISTINCT zone) INTO v_prep_area_zones
  FROM preparation_area
  WHERE zone IS NOT NULL;

  RAISE NOTICE '📍 Preparation area zones: %', v_prep_area_zones;

  SELECT ARRAY_AGG(location_id) INTO v_prep_area_location_ids
  FROM master_location
  WHERE warehouse_id = p_warehouse_id
    AND zone = ANY(v_prep_area_zones);

  RAISE NOTICE '📍 Preparation area location count: %', COALESCE(ARRAY_LENGTH(v_prep_area_location_ids, 1), 0);

  IF v_prep_area_location_ids IS NULL OR ARRAY_LENGTH(v_prep_area_location_ids, 1) = 0 THEN
    RAISE WARNING '⚠️ No preparation area locations found!';
    RETURN QUERY SELECT false, 0, 0, 'No preparation area locations found';
    RETURN;
  END IF;

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

    RAISE NOTICE '  📋 Item %: SKU=%, qty=%, location=%', v_item.id, v_item.sku_id, v_remaining_qty, v_item.source_location_id;

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
    LOOP
      v_available_qty := v_balance.available_piece_qty;

      IF v_remaining_qty <= v_available_qty THEN
        v_qty_to_reserve := v_remaining_qty;
      ELSE
        v_qty_to_reserve := v_available_qty;
      END IF;

      v_pack_to_reserve := v_qty_to_reserve / v_qty_per_pack;

      RAISE NOTICE '    ✅ Reserve from balance % (location %): %.3f pieces (%.3f packs)',
        v_balance.balance_id, v_balance.location_id, v_qty_to_reserve, v_pack_to_reserve;

      UPDATE wms_inventory_balances
      SET
        reserved_piece_qty = COALESCE(reserved_piece_qty, 0) + v_qty_to_reserve,
        reserved_pack_qty = COALESCE(reserved_pack_qty, 0) + v_pack_to_reserve,
        updated_at = CURRENT_TIMESTAMP
      WHERE balance_id = v_balance.balance_id;

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

    IF v_remaining_qty > 0 THEN
      RAISE NOTICE '    🔴 INSUFFICIENT STOCK: %.3f pieces short for SKU %', v_remaining_qty, v_item.sku_id;
      RAISE NOTICE '    ❌ Cannot create bonus face sheet - please replenish preparation areas first';

      DELETE FROM bonus_face_sheet_item_reservations
      WHERE bonus_face_sheet_item_id IN (
        SELECT id FROM bonus_face_sheet_items WHERE face_sheet_id = p_bonus_face_sheet_id
      );

      UPDATE wms_inventory_balances
      SET reserved_piece_qty = 0, reserved_pack_qty = 0
      WHERE balance_id IN (
        SELECT balance_id FROM bonus_face_sheet_item_reservations
        WHERE bonus_face_sheet_item_id IN (
          SELECT id FROM bonus_face_sheet_items WHERE face_sheet_id = p_bonus_face_sheet_id
        )
      );

      RETURN QUERY SELECT
        false,
        0,
        v_items_count,
        format('สต็อกในบ้านหยิบไม่เพียงพอสำหรับ SKU: %s (ขาด %.2f ชิ้น) กรุณาเติมสต็อกที่บ้านหยิบก่อน',
               v_item.sku_id, v_remaining_qty);
      RETURN;
    END IF;
  END LOOP;

  IF v_items_count = 0 THEN
    RETURN QUERY SELECT false, 0, 0, 'No items to reserve (check sku_id and quantity_to_pick)';
  ELSE
    RETURN QUERY SELECT true, v_items_reserved, v_items_count,
      format('Reserved %s/%s items successfully (no Virtual Pallet needed)', v_items_reserved, v_items_count);
  END IF;

  RAISE NOTICE '✅ Reservation complete: %/% items (from preparation areas only)', v_items_reserved, v_items_count;
END;
$function$;
`;

async function applyFix() {
  console.log('🔧 Applying Bonus Face Sheet reservation fix...\n');

  try {
    // Execute the SQL to replace the function
    const { error } = await supabase.rpc('query', { query_text: newFunctionSQL });

    if (error) {
      console.error('❌ Failed:', error.message);
      console.log('\n⚠️  Trying alternative method...\n');

      // If RPC doesn't work, we'll just log the SQL for manual execution
      console.log('📝 Please run this in Supabase SQL Editor:\n');
      console.log('=' .repeat(80));
      console.log(newFunctionSQL);
      console.log('=' .repeat(80));
      return;
    }

    console.log('✅ Function updated successfully!\n');
    console.log('📋 Changes applied:');
    console.log('  ✅ Bonus Face Sheet reserves ONLY from preparation areas');
    console.log('  ✅ No Virtual Pallet creation (fails if stock insufficient)');
    console.log('  ✅ MCF locations protected from automatic depletion\n');
    console.log('⚠️  Next steps:');
    console.log('  1. Replenish preparation areas manually before creating face sheets');
    console.log('  2. Virtual Pallet only during manual replenishment workflows');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.log('\n📝 SQL to run manually:\n');
    console.log(newFunctionSQL);
  }
}

applyFix();
