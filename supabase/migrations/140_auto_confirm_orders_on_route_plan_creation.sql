-- Migration: Auto-confirm route_planning orders when route stops are created
-- Description: When route stops are added to a route plan, automatically update
--              all associated orders from status='draft' to status='confirmed'

-- Function to update order status when route stop is created
CREATE OR REPLACE FUNCTION update_order_on_route_stop_creation()
RETURNS TRIGGER AS $$
DECLARE
  v_plan_status TEXT;
BEGIN
  -- Only process when a new stop is created with an order_id
  IF TG_OP = 'INSERT' AND NEW.order_id IS NOT NULL THEN
    -- Check if the route plan is in draft status
    SELECT rp.status INTO v_plan_status
    FROM receiving_route_trips rt
    INNER JOIN receiving_route_plans rp ON rt.plan_id = rp.plan_id
    WHERE rt.trip_id = NEW.trip_id;
    
    -- Only update if plan is in draft status
    IF v_plan_status = 'draft' THEN
      -- Update the order from 'draft' to 'confirmed' for route_planning type orders
      UPDATE wms_orders
      SET 
        status = 'confirmed',
        updated_at = NOW()
      WHERE order_id = NEW.order_id
        AND order_type = 'route_planning'
        AND status = 'draft';
      
      -- Log the update if order was updated
      IF FOUND THEN
        RAISE NOTICE 'Updated order % to confirmed for route stop %', NEW.order_id, NEW.stop_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop old trigger if exists
DROP TRIGGER IF EXISTS trigger_update_orders_on_route_plan_creation ON receiving_route_plans;
DROP FUNCTION IF EXISTS update_orders_on_route_plan_creation();

-- Create trigger on receiving_route_stops table
DROP TRIGGER IF EXISTS trigger_update_order_on_route_stop_creation ON receiving_route_stops;

CREATE TRIGGER trigger_update_order_on_route_stop_creation
  AFTER INSERT ON receiving_route_stops
  FOR EACH ROW
  EXECUTE FUNCTION update_order_on_route_stop_creation();

-- Add comment
COMMENT ON FUNCTION update_order_on_route_stop_creation() IS 
  'Automatically updates route_planning orders from draft to confirmed when a route stop is created';

COMMENT ON TRIGGER trigger_update_order_on_route_stop_creation ON receiving_route_stops IS
  'Triggers order status update when a new route stop is created with an order';
