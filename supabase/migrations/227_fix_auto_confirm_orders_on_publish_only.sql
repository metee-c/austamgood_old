-- Migration: Fix auto-confirm orders to trigger only on plan publish
-- Description: Orders should only be confirmed when the plan is published,
--              not when stops are created during draft/optimizing phase

-- Drop the old trigger that confirms on stop creation
DROP TRIGGER IF EXISTS trigger_update_order_on_route_stop_creation ON receiving_route_stops;
DROP FUNCTION IF EXISTS update_order_on_route_stop_creation();

-- Create new function to confirm orders when plan is published
CREATE OR REPLACE FUNCTION confirm_orders_on_plan_publish()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process when plan status changes to 'published'
  IF TG_OP = 'UPDATE' AND OLD.status != 'published' AND NEW.status = 'published' THEN
    -- Update all orders in this plan from 'draft' to 'confirmed'
    UPDATE wms_orders
    SET 
      status = 'confirmed',
      updated_at = NOW()
    WHERE order_id IN (
      SELECT DISTINCT order_id
      FROM receiving_route_stops
      WHERE plan_id = NEW.plan_id
        AND order_id IS NOT NULL
    )
    AND order_type = 'route_planning'
    AND status = 'draft';
    
    -- Log the update
    IF FOUND THEN
      RAISE NOTICE 'Confirmed orders for published plan %', NEW.plan_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on receiving_route_plans table
CREATE TRIGGER trigger_confirm_orders_on_plan_publish
  AFTER UPDATE ON receiving_route_plans
  FOR EACH ROW
  EXECUTE FUNCTION confirm_orders_on_plan_publish();

-- Add comments
COMMENT ON FUNCTION confirm_orders_on_plan_publish() IS 
  'Automatically confirms route_planning orders when a route plan is published';

COMMENT ON TRIGGER trigger_confirm_orders_on_plan_publish ON receiving_route_plans IS
  'Triggers order confirmation when a route plan status changes to published';

-- Revert any orders that were incorrectly confirmed during draft/optimizing phase
-- (Orders should only be confirmed when plan is published)
UPDATE wms_orders o
SET 
  status = 'draft',
  updated_at = NOW()
WHERE order_type = 'route_planning'
  AND status = 'confirmed'
  AND EXISTS (
    SELECT 1
    FROM receiving_route_plan_inputs rpi
    INNER JOIN receiving_route_plans rp ON rpi.plan_id = rp.plan_id
    WHERE rpi.order_id = o.order_id
      AND rp.status IN ('draft', 'optimizing')
  )
  -- Don't revert if order has picklists or face sheets already created
  AND NOT EXISTS (
    SELECT 1 FROM picklist_items pi WHERE pi.order_id = o.order_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM face_sheet_packages fsp WHERE fsp.order_id = o.order_id
  );
