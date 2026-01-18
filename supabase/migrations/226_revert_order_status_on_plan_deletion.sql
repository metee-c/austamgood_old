-- Migration: Revert order status when route plan is deleted
-- Description: When a route plan is deleted, revert all associated orders
--              from status='confirmed' back to status='draft' if they were
--              auto-confirmed by the route plan creation

-- Function to revert order status when route plan is deleted
CREATE OR REPLACE FUNCTION revert_orders_on_plan_deletion()
RETURNS TRIGGER AS $$
DECLARE
  v_order_id INTEGER;
BEGIN
  -- Only process when a plan is deleted
  IF TG_OP = 'DELETE' THEN
    -- Find all orders that were in this plan and revert their status
    -- We do this by finding all stops in trips that belonged to this plan
    FOR v_order_id IN
      SELECT DISTINCT rs.order_id
      FROM receiving_route_stops rs
      INNER JOIN receiving_route_trips rt ON rs.trip_id = rt.trip_id
      WHERE rt.plan_id = OLD.plan_id
        AND rs.order_id IS NOT NULL
    LOOP
      -- Check if this order is not in any other active plan
      -- If it's not in any other plan, revert to draft
      IF NOT EXISTS (
        SELECT 1
        FROM receiving_route_stops rs2
        INNER JOIN receiving_route_trips rt2 ON rs2.trip_id = rt2.trip_id
        INNER JOIN receiving_route_plans rp2 ON rt2.plan_id = rp2.plan_id
        WHERE rs2.order_id = v_order_id
          AND rp2.plan_id != OLD.plan_id  -- Exclude the plan being deleted
          AND rp2.status NOT IN ('cancelled', 'voided')  -- Only count active plans
      ) THEN
        -- Revert order status to draft
        UPDATE wms_orders
        SET 
          status = 'draft',
          updated_at = NOW()
        WHERE order_id = v_order_id
          AND order_type = 'route_planning'
          AND status = 'confirmed';
        
        IF FOUND THEN
          RAISE NOTICE 'Reverted order % to draft after plan % deletion', v_order_id, OLD.plan_id;
        END IF;
      END IF;
    END LOOP;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on receiving_route_plans table
DROP TRIGGER IF EXISTS trigger_revert_orders_on_plan_deletion ON receiving_route_plans;

CREATE TRIGGER trigger_revert_orders_on_plan_deletion
  BEFORE DELETE ON receiving_route_plans
  FOR EACH ROW
  EXECUTE FUNCTION revert_orders_on_plan_deletion();

-- Add comments
COMMENT ON FUNCTION revert_orders_on_plan_deletion() IS 
  'Automatically reverts route_planning orders from confirmed to draft when a route plan is deleted';

COMMENT ON TRIGGER trigger_revert_orders_on_plan_deletion ON receiving_route_plans IS
  'Triggers order status revert when a route plan is deleted';
