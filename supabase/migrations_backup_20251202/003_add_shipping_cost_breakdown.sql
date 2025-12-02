-- Migration: Add shipping cost breakdown columns to receiving_route_trips
-- Created: 2024-11-13
-- Description: Add columns to support two pricing modes (flat rate and formula-based)

-- Add new columns for shipping cost breakdown
ALTER TABLE receiving_route_trips
ADD COLUMN IF NOT EXISTS pricing_mode VARCHAR(20) DEFAULT 'flat' CHECK (pricing_mode IN ('flat', 'formula')),
ADD COLUMN IF NOT EXISTS base_price NUMERIC(12,2) DEFAULT 0 CHECK (base_price >= 0),
ADD COLUMN IF NOT EXISTS helper_fee NUMERIC(12,2) DEFAULT 0 CHECK (helper_fee >= 0),
ADD COLUMN IF NOT EXISTS extra_stop_fee NUMERIC(12,2) DEFAULT 0 CHECK (extra_stop_fee >= 0),
ADD COLUMN IF NOT EXISTS extra_stops_count INTEGER DEFAULT 0 CHECK (extra_stops_count >= 0);

-- Add comments for documentation
COMMENT ON COLUMN receiving_route_trips.pricing_mode IS 'Pricing calculation mode: flat (lump sum) or formula (base + helper + extra stops)';
COMMENT ON COLUMN receiving_route_trips.base_price IS 'Base price by province/region (used in formula mode)';
COMMENT ON COLUMN receiving_route_trips.helper_fee IS 'Helper/assistant fee (used in formula mode)';
COMMENT ON COLUMN receiving_route_trips.extra_stop_fee IS 'Fee per extra stop beyond first stop (used in formula mode)';
COMMENT ON COLUMN receiving_route_trips.extra_stops_count IS 'Number of extra stops (total_stops - 1) for calculation reference';

-- Update existing records to have default pricing_mode
UPDATE receiving_route_trips 
SET pricing_mode = 'flat' 
WHERE pricing_mode IS NULL;

-- Create index for faster queries by pricing_mode
CREATE INDEX IF NOT EXISTS idx_receiving_route_trips_pricing_mode 
ON receiving_route_trips(pricing_mode);

-- Add trigger to auto-calculate extra_stops_count when total_stops changes
CREATE OR REPLACE FUNCTION update_extra_stops_count()
RETURNS TRIGGER AS $$
BEGIN
    NEW.extra_stops_count := GREATEST(0, COALESCE(NEW.total_stops, 0) - 1);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_extra_stops_count
    BEFORE INSERT OR UPDATE OF total_stops
    ON receiving_route_trips
    FOR EACH ROW
    EXECUTE FUNCTION update_extra_stops_count();

-- Add trigger to auto-calculate shipping_cost in formula mode
CREATE OR REPLACE FUNCTION calculate_shipping_cost_formula()
RETURNS TRIGGER AS $$
BEGIN
    -- Only auto-calculate if pricing_mode is 'formula'
    IF NEW.pricing_mode = 'formula' THEN
        NEW.shipping_cost := COALESCE(NEW.base_price, 0) 
                           + COALESCE(NEW.helper_fee, 0) 
                           + (COALESCE(NEW.extra_stops_count, 0) * COALESCE(NEW.extra_stop_fee, 0));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_shipping_cost_formula
    BEFORE INSERT OR UPDATE OF pricing_mode, base_price, helper_fee, extra_stop_fee, extra_stops_count
    ON receiving_route_trips
    FOR EACH ROW
    EXECUTE FUNCTION calculate_shipping_cost_formula();

-- Example usage:
-- 
-- Flat rate pricing:
-- UPDATE receiving_route_trips 
-- SET pricing_mode = 'flat', shipping_cost = 8500 
-- WHERE trip_id = 1;
--
-- Formula-based pricing (Bangkok, 5 stops):
-- UPDATE receiving_route_trips 
-- SET pricing_mode = 'formula', 
--     base_price = 1700,
--     helper_fee = 500,
--     extra_stop_fee = 100,
--     total_stops = 5
-- WHERE trip_id = 2;
-- Result: shipping_cost = 1700 + 500 + (4 * 100) = 2600
