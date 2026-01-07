-- Migration: Add actual_stops_count column to receiving_route_trips
-- Purpose: Allow users to override the calculated stop count when multiple customers share the same delivery location

-- Add actual_stops_count column
ALTER TABLE receiving_route_trips
ADD COLUMN IF NOT EXISTS actual_stops_count INTEGER DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN receiving_route_trips.actual_stops_count IS 'จำนวนจุดส่งจริง (กรณีหลายร้านส่งที่เดียวกัน) - ถ้า NULL จะใช้จำนวนลูกค้าที่ไม่ซ้ำกัน';

-- Update the shipping cost calculation trigger to use actual_stops_count if provided
CREATE OR REPLACE FUNCTION calculate_trip_shipping_cost()
RETURNS TRIGGER AS $$
DECLARE
  extra_stops INTEGER;
  other_fees_total NUMERIC := 0;
  extra_delivery_stops_total NUMERIC := 0;
  calculated_shipping_cost NUMERIC;
  effective_stops INTEGER;
BEGIN
  -- Only calculate if pricing_mode is 'formula'
  IF NEW.pricing_mode = 'formula' THEN
    -- Use actual_stops_count if provided, otherwise use total_stops
    effective_stops := COALESCE(NEW.actual_stops_count, NEW.total_stops, 1);
    
    -- Calculate extra stops (first stop is included in base price)
    extra_stops := GREATEST(0, effective_stops - 1);
    
    -- Calculate other fees total
    IF NEW.other_fees IS NOT NULL AND jsonb_typeof(NEW.other_fees) = 'array' THEN
      SELECT COALESCE(SUM((fee->>'amount')::NUMERIC), 0)
      INTO other_fees_total
      FROM jsonb_array_elements(NEW.other_fees) AS fee;
    END IF;
    
    -- Calculate extra delivery stops total
    IF NEW.extra_delivery_stops IS NOT NULL AND jsonb_typeof(NEW.extra_delivery_stops) = 'array' THEN
      SELECT COALESCE(SUM((stop->>'cost')::NUMERIC), 0)
      INTO extra_delivery_stops_total
      FROM jsonb_array_elements(NEW.extra_delivery_stops) AS stop;
    END IF;
    
    -- Calculate shipping cost: base_price + helper_fee + (extra_stops × extra_stop_fee) + porterage_fee + other_fees + extra_delivery_stops
    calculated_shipping_cost := COALESCE(NEW.base_price, 0) 
                              + COALESCE(NEW.helper_fee, 0) 
                              + (extra_stops * COALESCE(NEW.extra_stop_fee, 0))
                              + COALESCE(NEW.porterage_fee, 0)
                              + other_fees_total
                              + extra_delivery_stops_total;
    
    NEW.shipping_cost := calculated_shipping_cost;
    NEW.extra_stops_count := extra_stops;
  ELSIF NEW.pricing_mode = 'flat' THEN
    -- For flat mode, calculate total from base_shipping_cost + porterage_fee + other_fees + extra_delivery_stops
    -- Calculate other fees total
    IF NEW.other_fees IS NOT NULL AND jsonb_typeof(NEW.other_fees) = 'array' THEN
      SELECT COALESCE(SUM((fee->>'amount')::NUMERIC), 0)
      INTO other_fees_total
      FROM jsonb_array_elements(NEW.other_fees) AS fee;
    END IF;
    
    -- Calculate extra delivery stops total
    IF NEW.extra_delivery_stops IS NOT NULL AND jsonb_typeof(NEW.extra_delivery_stops) = 'array' THEN
      SELECT COALESCE(SUM((stop->>'cost')::NUMERIC), 0)
      INTO extra_delivery_stops_total
      FROM jsonb_array_elements(NEW.extra_delivery_stops) AS stop;
    END IF;
    
    calculated_shipping_cost := COALESCE(NEW.base_shipping_cost, 0)
                              + COALESCE(NEW.porterage_fee, 0)
                              + other_fees_total
                              + extra_delivery_stops_total;
    
    NEW.shipping_cost := calculated_shipping_cost;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
