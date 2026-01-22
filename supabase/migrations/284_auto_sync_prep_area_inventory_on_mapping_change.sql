-- Migration 284: Auto sync preparation_area_inventory when mapping changes
-- Purpose: Update prep area inventory when SKU mapping is added/removed/changed

-- ============================================================================
-- 1. Create trigger function to sync when mapping changes
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_sync_prep_area_inventory_on_mapping_change()
RETURNS TRIGGER AS $$
DECLARE
    v_prep_area_code VARCHAR(50);
    v_qty_per_pack NUMERIC(15,2);
BEGIN
    -- Handle INSERT: Add new SKU to prep area inventory
    IF TG_OP = 'INSERT' THEN
        -- Get prep area code
        SELECT area_code INTO v_prep_area_code
        FROM preparation_area
        WHERE area_id = NEW.preparation_area_id;
        
        -- Get qty_per_pack
        SELECT qty_per_pack INTO v_qty_per_pack
        FROM master_sku
        WHERE sku_id = NEW.sku_id;
        
        v_qty_per_pack := COALESCE(v_qty_per_pack, 1);
        
        -- Insert new row with current stock (if any)
        INSERT INTO preparation_area_inventory (
            warehouse_id,
            preparation_area_id,
            preparation_area_code,
            sku_id,
            latest_pallet_id,
            latest_pallet_id_external,
            latest_production_date,
            latest_expiry_date,
            latest_lot_no,
            available_pack_qty,
            available_piece_qty,
            reserved_pack_qty,
            reserved_piece_qty,
            total_pack_qty,
            total_piece_qty,
            last_movement_at,
            updated_at
        )
        SELECT
            NEW.warehouse_id,
            NEW.preparation_area_id,
            v_prep_area_code,
            NEW.sku_id,
            -- Latest pallet info
            (SELECT pallet_id FROM wms_inventory_balances 
             WHERE sku_id = NEW.sku_id AND location_id = v_prep_area_code
             ORDER BY last_movement_at DESC NULLS LAST LIMIT 1),
            (SELECT pallet_id_external FROM wms_inventory_balances 
             WHERE sku_id = NEW.sku_id AND location_id = v_prep_area_code
             ORDER BY last_movement_at DESC NULLS LAST LIMIT 1),
            (SELECT production_date FROM wms_inventory_balances 
             WHERE sku_id = NEW.sku_id AND location_id = v_prep_area_code
             ORDER BY last_movement_at DESC NULLS LAST LIMIT 1),
            (SELECT expiry_date FROM wms_inventory_balances 
             WHERE sku_id = NEW.sku_id AND location_id = v_prep_area_code
             ORDER BY last_movement_at DESC NULLS LAST LIMIT 1),
            (SELECT lot_no FROM wms_inventory_balances 
             WHERE sku_id = NEW.sku_id AND location_id = v_prep_area_code
             ORDER BY last_movement_at DESC NULLS LAST LIMIT 1),
            -- Aggregated quantities
            COALESCE((SELECT SUM(total_piece_qty - reserved_piece_qty) / v_qty_per_pack
                      FROM wms_inventory_balances
                      WHERE sku_id = NEW.sku_id AND location_id = v_prep_area_code), 0),
            COALESCE((SELECT SUM(total_piece_qty - reserved_piece_qty)
                      FROM wms_inventory_balances
                      WHERE sku_id = NEW.sku_id AND location_id = v_prep_area_code), 0),
            COALESCE((SELECT SUM(reserved_piece_qty) / v_qty_per_pack
                      FROM wms_inventory_balances
                      WHERE sku_id = NEW.sku_id AND location_id = v_prep_area_code), 0),
            COALESCE((SELECT SUM(reserved_piece_qty)
                      FROM wms_inventory_balances
                      WHERE sku_id = NEW.sku_id AND location_id = v_prep_area_code), 0),
            COALESCE((SELECT SUM(total_piece_qty) / v_qty_per_pack
                      FROM wms_inventory_balances
                      WHERE sku_id = NEW.sku_id AND location_id = v_prep_area_code), 0),
            COALESCE((SELECT SUM(total_piece_qty)
                      FROM wms_inventory_balances
                      WHERE sku_id = NEW.sku_id AND location_id = v_prep_area_code), 0),
            (SELECT MAX(last_movement_at) FROM wms_inventory_balances 
             WHERE sku_id = NEW.sku_id AND location_id = v_prep_area_code),
            NOW()
        ON CONFLICT (warehouse_id, preparation_area_code, sku_id) DO NOTHING;
        
        RETURN NEW;
    END IF;
    
    -- Handle DELETE: Remove SKU from prep area inventory
    IF TG_OP = 'DELETE' THEN
        -- Get prep area code
        SELECT area_code INTO v_prep_area_code
        FROM preparation_area
        WHERE area_id = OLD.preparation_area_id;
        
        -- Delete the row
        DELETE FROM preparation_area_inventory
        WHERE warehouse_id = OLD.warehouse_id
          AND preparation_area_code = v_prep_area_code
          AND sku_id = OLD.sku_id;
        
        RETURN OLD;
    END IF;
    
    -- Handle UPDATE: Update prep area if changed
    IF TG_OP = 'UPDATE' THEN
        -- If preparation_area_id changed, treat as DELETE + INSERT
        IF OLD.preparation_area_id != NEW.preparation_area_id THEN
            -- Delete from old prep area
            SELECT area_code INTO v_prep_area_code
            FROM preparation_area
            WHERE area_id = OLD.preparation_area_id;
            
            DELETE FROM preparation_area_inventory
            WHERE warehouse_id = OLD.warehouse_id
              AND preparation_area_code = v_prep_area_code
              AND sku_id = OLD.sku_id;
            
            -- Insert to new prep area (same logic as INSERT)
            SELECT area_code INTO v_prep_area_code
            FROM preparation_area
            WHERE area_id = NEW.preparation_area_id;
            
            SELECT qty_per_pack INTO v_qty_per_pack
            FROM master_sku
            WHERE sku_id = NEW.sku_id;
            
            v_qty_per_pack := COALESCE(v_qty_per_pack, 1);
            
            INSERT INTO preparation_area_inventory (
                warehouse_id,
                preparation_area_id,
                preparation_area_code,
                sku_id,
                latest_pallet_id,
                latest_pallet_id_external,
                latest_production_date,
                latest_expiry_date,
                latest_lot_no,
                available_pack_qty,
                available_piece_qty,
                reserved_pack_qty,
                reserved_piece_qty,
                total_pack_qty,
                total_piece_qty,
                last_movement_at,
                updated_at
            )
            SELECT
                NEW.warehouse_id,
                NEW.preparation_area_id,
                v_prep_area_code,
                NEW.sku_id,
                (SELECT pallet_id FROM wms_inventory_balances 
                 WHERE sku_id = NEW.sku_id AND location_id = v_prep_area_code
                 ORDER BY last_movement_at DESC NULLS LAST LIMIT 1),
                (SELECT pallet_id_external FROM wms_inventory_balances 
                 WHERE sku_id = NEW.sku_id AND location_id = v_prep_area_code
                 ORDER BY last_movement_at DESC NULLS LAST LIMIT 1),
                (SELECT production_date FROM wms_inventory_balances 
                 WHERE sku_id = NEW.sku_id AND location_id = v_prep_area_code
                 ORDER BY last_movement_at DESC NULLS LAST LIMIT 1),
                (SELECT expiry_date FROM wms_inventory_balances 
                 WHERE sku_id = NEW.sku_id AND location_id = v_prep_area_code
                 ORDER BY last_movement_at DESC NULLS LAST LIMIT 1),
                (SELECT lot_no FROM wms_inventory_balances 
                 WHERE sku_id = NEW.sku_id AND location_id = v_prep_area_code
                 ORDER BY last_movement_at DESC NULLS LAST LIMIT 1),
                COALESCE((SELECT SUM(total_piece_qty - reserved_piece_qty) / v_qty_per_pack
                          FROM wms_inventory_balances
                          WHERE sku_id = NEW.sku_id AND location_id = v_prep_area_code), 0),
                COALESCE((SELECT SUM(total_piece_qty - reserved_piece_qty)
                          FROM wms_inventory_balances
                          WHERE sku_id = NEW.sku_id AND location_id = v_prep_area_code), 0),
                COALESCE((SELECT SUM(reserved_piece_qty) / v_qty_per_pack
                          FROM wms_inventory_balances
                          WHERE sku_id = NEW.sku_id AND location_id = v_prep_area_code), 0),
                COALESCE((SELECT SUM(reserved_piece_qty)
                          FROM wms_inventory_balances
                          WHERE sku_id = NEW.sku_id AND location_id = v_prep_area_code), 0),
                COALESCE((SELECT SUM(total_piece_qty) / v_qty_per_pack
                          FROM wms_inventory_balances
                          WHERE sku_id = NEW.sku_id AND location_id = v_prep_area_code), 0),
                COALESCE((SELECT SUM(total_piece_qty)
                          FROM wms_inventory_balances
                          WHERE sku_id = NEW.sku_id AND location_id = v_prep_area_code), 0),
                (SELECT MAX(last_movement_at) FROM wms_inventory_balances 
                 WHERE sku_id = NEW.sku_id AND location_id = v_prep_area_code),
                NOW()
            ON CONFLICT (warehouse_id, preparation_area_code, sku_id) DO NOTHING;
        END IF;
        
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. Create trigger on sku_preparation_area_mapping
-- ============================================================================
DROP TRIGGER IF EXISTS trg_sync_prep_area_inventory_on_mapping ON sku_preparation_area_mapping;

CREATE TRIGGER trg_sync_prep_area_inventory_on_mapping
    AFTER INSERT OR UPDATE OR DELETE ON sku_preparation_area_mapping
    FOR EACH ROW
    EXECUTE FUNCTION fn_sync_prep_area_inventory_on_mapping_change();

-- ============================================================================
-- 3. Add comment
-- ============================================================================
COMMENT ON FUNCTION fn_sync_prep_area_inventory_on_mapping_change() IS 'Auto sync preparation_area_inventory when sku_preparation_area_mapping changes (add/remove/update SKU mapping)';
