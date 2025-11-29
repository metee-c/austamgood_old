-- ============================================================
-- Migration 047: Add skip_balance_sync Flag to Prevent Double Balance Updates
-- วันที่: 2025-11-29
-- เหตุผล: API บาง API (pick/scan, loading/complete) อัปเดต balance ด้วยตัวเอง
--         ต้องการ flag เพื่อบอกให้ทริกเกอร์ข้ามการอัปเดต balance
-- ============================================================

-- ============================================================
-- 1. เพิ่มคอลัมน์ skip_balance_sync ในตาราง wms_inventory_ledger
-- ============================================================

ALTER TABLE wms_inventory_ledger
ADD COLUMN IF NOT EXISTS skip_balance_sync BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN wms_inventory_ledger.skip_balance_sync IS
'Flag to skip automatic balance sync by trigger. Set to TRUE when API already updated balance manually. (เพิ่มเมื่อ 2025-11-29)';


-- ============================================================
-- 2. แก้ไขทริกเกอร์ sync_inventory_ledger_to_balance
-- ============================================================

CREATE OR REPLACE FUNCTION sync_inventory_ledger_to_balance()
RETURNS TRIGGER AS $$
DECLARE
    v_balance_id bigint;
    v_current_pack_qty numeric(18,2);
    v_current_piece_qty numeric(18,2);
BEGIN
    -- ✅ เช็ค flag skip_balance_sync ก่อนทำงาน
    IF NEW.skip_balance_sync = TRUE THEN
        RAISE NOTICE 'Skipping balance sync for ledger entry % (skip_balance_sync = TRUE)', NEW.ledger_id;
        RETURN NEW;
    END IF;

    -- Calculate the signed quantity based on direction
    IF NEW.direction = 'in' THEN
        v_current_pack_qty := NEW.pack_qty;
        v_current_piece_qty := NEW.piece_qty;
    ELSE -- direction = 'out'
        v_current_pack_qty := -NEW.pack_qty;
        v_current_piece_qty := -NEW.piece_qty;
    END IF;

    -- Check if balance record exists
    SELECT balance_id INTO v_balance_id
    FROM wms_inventory_balances
    WHERE warehouse_id = NEW.warehouse_id
      AND COALESCE(location_id, '') = COALESCE(NEW.location_id, '')
      AND sku_id = NEW.sku_id
      AND COALESCE(pallet_id, '') = COALESCE(NEW.pallet_id, '')
      AND COALESCE(pallet_id_external, '') = COALESCE(NEW.pallet_id_external, '')
      AND COALESCE(production_date::text, '') = COALESCE(NEW.production_date::text, '')
      AND COALESCE(expiry_date::text, '') = COALESCE(NEW.expiry_date::text, '');

    IF v_balance_id IS NOT NULL THEN
        -- Update existing balance
        UPDATE wms_inventory_balances
        SET
            total_pack_qty = GREATEST(0, total_pack_qty + v_current_pack_qty),
            total_piece_qty = GREATEST(0, total_piece_qty + v_current_piece_qty),
            last_movement_at = NEW.movement_at,
            updated_at = CURRENT_TIMESTAMP
        WHERE balance_id = v_balance_id;

        RAISE NOTICE 'Updated balance % for SKU % at location %', v_balance_id, NEW.sku_id, NEW.location_id;
    ELSE
        -- Insert new balance record (only if direction is 'in')
        IF NEW.direction = 'in' THEN
            INSERT INTO wms_inventory_balances (
                balance_id,
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
                nextval('wms_inventory_balances_balance_id_seq'),
                NEW.warehouse_id,
                NEW.location_id,
                NEW.sku_id,
                NEW.pallet_id,
                NEW.pallet_id_external,
                NEW.production_date,
                NEW.expiry_date,
                NEW.pack_qty,
                NEW.piece_qty,
                0,
                0,
                NEW.movement_at,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP,
                NULL -- lot_no can be added if available
            );

            RAISE NOTICE 'Created new balance for SKU % at location %', NEW.sku_id, NEW.location_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION sync_inventory_ledger_to_balance() IS
'Automatically sync inventory ledger entries to balance table. Skips sync if skip_balance_sync flag is TRUE. (Updated 2025-11-29)';


-- ============================================================
-- 3. Verify trigger exists
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_sync_inventory_ledger_to_balance'
    ) THEN
        -- Recreate trigger if it doesn't exist
        CREATE TRIGGER trg_sync_inventory_ledger_to_balance
            AFTER INSERT ON wms_inventory_ledger
            FOR EACH ROW
            EXECUTE FUNCTION sync_inventory_ledger_to_balance();

        RAISE NOTICE 'Created trigger trg_sync_inventory_ledger_to_balance';
    ELSE
        RAISE NOTICE 'Trigger trg_sync_inventory_ledger_to_balance already exists';
    END IF;
END $$;


-- ============================================================
-- 4. สรุปการเปลี่ยนแปลง
-- ============================================================

/*
Migration Summary:
✅ Added column skip_balance_sync to wms_inventory_ledger
✅ Updated function sync_inventory_ledger_to_balance() to check flag
✅ Verified trigger exists

Usage in API:
```typescript
// เมื่อ API อัปเดต balance ด้วยตัวเอง
await supabase.from('wms_inventory_ledger').insert(
  ledgerEntries.map(entry => ({
    ...entry,
    skip_balance_sync: true  // ← บอกให้ทริกเกอร์ข้าม
  }))
);
```

APIs that should set skip_balance_sync = true:
1. POST /api/mobile/pick/scan - อัปเดต balance ด้วยตัวเอง
2. POST /api/mobile/loading/complete - อัปเดต balance ด้วยตัวเอง

APIs that should use trigger (skip_balance_sync = false or omit):
1. POST /api/receives/[id]/complete - ถ้าสร้างในอนาคต
2. POST /api/moves/[id]/complete - ถ้าสร้างในอนาคต
3. Any other ledger creation - ให้ทริกเกอร์อัปเดต balance อัตโนมัติ
*/

-- Verify column was added
DO $$
DECLARE
    v_column_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'wms_inventory_ledger'
        AND column_name = 'skip_balance_sync'
    ) INTO v_column_exists;

    IF v_column_exists THEN
        RAISE NOTICE '✅ Column skip_balance_sync added successfully to wms_inventory_ledger';
    ELSE
        RAISE WARNING '❌ Failed to add column skip_balance_sync';
    END IF;
END $$;
