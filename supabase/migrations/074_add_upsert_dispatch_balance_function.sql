-- Add unique index to wms_inventory_balances if not exists
-- Using expression index to handle NULL values
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'wms_inventory_balances_unique_idx'
  ) THEN
    CREATE UNIQUE INDEX wms_inventory_balances_unique_idx 
    ON wms_inventory_balances (
      warehouse_id, 
      location_id, 
      sku_id, 
      COALESCE(production_date, '1900-01-01'::DATE), 
      COALESCE(expiry_date, '1900-01-01'::DATE), 
      COALESCE(lot_no, '')
    );
  END IF;
END $$;

-- Create function to upsert dispatch balance (avoid race condition)
CREATE OR REPLACE FUNCTION upsert_dispatch_balance(
  p_warehouse_id TEXT,
  p_location_id TEXT,
  p_sku_id TEXT,
  p_production_date DATE,
  p_expiry_date DATE,
  p_lot_no TEXT,
  p_pack_qty NUMERIC,
  p_piece_qty NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- Use INSERT ... ON CONFLICT to handle concurrent inserts
  INSERT INTO wms_inventory_balances (
    warehouse_id,
    location_id,
    sku_id,
    production_date,
    expiry_date,
    lot_no,
    total_pack_qty,
    total_piece_qty,
    reserved_pack_qty,
    reserved_piece_qty,
    last_movement_at,
    created_at,
    updated_at
  )
  VALUES (
    p_warehouse_id,
    p_location_id,
    p_sku_id,
    p_production_date,
    p_expiry_date,
    p_lot_no,
    p_pack_qty,
    p_piece_qty,
    0,
    0,
    NOW(),
    NOW(),
    NOW()
  )
  ON CONFLICT (warehouse_id, location_id, sku_id, 
                COALESCE(production_date, '1900-01-01'::DATE), 
                COALESCE(expiry_date, '1900-01-01'::DATE), 
                COALESCE(lot_no, ''))
  DO UPDATE SET
    total_pack_qty = wms_inventory_balances.total_pack_qty + p_pack_qty,
    total_piece_qty = wms_inventory_balances.total_piece_qty + p_piece_qty,
    last_movement_at = NOW(),
    updated_at = NOW();
END;
$$;
