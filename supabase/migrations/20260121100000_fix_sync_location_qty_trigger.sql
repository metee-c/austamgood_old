
-- Fix sync_location_qty_from_balance trigger to include weight calculation
-- and handle potential issues with concurrent updates

CREATE OR REPLACE FUNCTION public.sync_location_qty_from_balance()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_location_id text;
    v_total_qty numeric;
    v_total_weight numeric;
BEGIN
    -- Determine which location to update (OLD or NEW)
    IF TG_OP = 'DELETE' THEN
        v_location_id := OLD.location_id;
    ELSE
        -- For UPDATE, we might need to update both OLD and NEW locations if they differ
        -- But inventory_balances usually doesn't change location_id directly (it's part of PK/Unique usually)
        -- Safe to just use NEW for INSERT/UPDATE
        v_location_id := NEW.location_id;
    END IF;

    -- Skip if no location
    IF v_location_id IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Calculate total quantity AND weight for this location across all SKUs/pallets
    -- Join with master_sku to get weight per piece if needed, or use stored weight?
    -- Currently wms_inventory_balances doesn't seem to store weight directly, 
    -- so we rely on master_sku.weight_kg * total_piece_qty
    
    SELECT 
        COALESCE(SUM(b.total_piece_qty), 0),
        COALESCE(SUM(b.total_piece_qty * COALESCE(s.weight_per_piece_kg, 0)), 0)
    INTO 
        v_total_qty,
        v_total_weight
    FROM wms_inventory_balances b
    LEFT JOIN master_sku s ON b.sku_id = s.sku_id
    WHERE b.location_id = v_location_id;

    -- Update master_location
    UPDATE master_location
    SET 
        current_qty = v_total_qty,
        current_weight_kg = v_total_weight,
        updated_at = CURRENT_TIMESTAMP
    WHERE location_id = v_location_id;
    
    -- If this was an UPDATE that changed location_id (unlikely but possible), 
    -- we should also update the OLD location
    IF TG_OP = 'UPDATE' AND OLD.location_id IS NOT NULL AND OLD.location_id <> NEW.location_id THEN
        SELECT 
            COALESCE(SUM(b.total_piece_qty), 0),
            COALESCE(SUM(b.total_piece_qty * COALESCE(s.weight_per_piece_kg, 0)), 0)
        INTO 
            v_total_qty,
            v_total_weight
        FROM wms_inventory_balances b
        LEFT JOIN master_sku s ON b.sku_id = s.sku_id
        WHERE b.location_id = OLD.location_id;

        UPDATE master_location
        SET 
            current_qty = v_total_qty,
            current_weight_kg = v_total_weight,
            updated_at = CURRENT_TIMESTAMP
        WHERE location_id = OLD.location_id;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$function$;
