-- Migration: Allow order status transition from confirmed back to draft
-- This is needed when deleting face sheets and reverting orders

CREATE OR REPLACE FUNCTION public.validate_order_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    -- ถ้าสถานะไม่เปลี่ยน → อนุญาต
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    -- Validate transitions
    CASE OLD.status
        WHEN 'draft' THEN
            IF NEW.status NOT IN ('confirmed', 'cancelled') THEN
                RAISE EXCEPTION 'Invalid order status transition: draft → %. Allowed: confirmed, cancelled', NEW.status;
            END IF;

        WHEN 'confirmed' THEN
            -- ✅ เพิ่ม 'draft' เพื่อให้สามารถถอยกลับได้
            IF NEW.status NOT IN ('draft', 'in_picking', 'cancelled') THEN
                RAISE EXCEPTION 'Invalid order status transition: confirmed → %. Allowed: draft, in_picking, cancelled', NEW.status;
            END IF;

        WHEN 'in_picking' THEN
            IF NEW.status NOT IN ('picked', 'confirmed', 'cancelled') THEN
                RAISE EXCEPTION 'Invalid order status transition: in_picking → %. Allowed: picked, confirmed, cancelled', NEW.status;
            END IF;

        WHEN 'picked' THEN
            IF NEW.status NOT IN ('loaded', 'in_picking', 'cancelled') THEN
                RAISE EXCEPTION 'Invalid order status transition: picked → %. Allowed: loaded, in_picking, cancelled', NEW.status;
            END IF;

        WHEN 'loaded' THEN
            IF NEW.status NOT IN ('in_transit', 'picked', 'cancelled') THEN
                RAISE EXCEPTION 'Invalid order status transition: loaded → %. Allowed: in_transit, picked, cancelled', NEW.status;
            END IF;

        WHEN 'in_transit' THEN
            IF NEW.status NOT IN ('delivered', 'failed', 'cancelled') THEN
                RAISE EXCEPTION 'Invalid order status transition: in_transit → %. Allowed: delivered, failed, cancelled', NEW.status;
            END IF;

        WHEN 'delivered' THEN
            -- Final state - cannot change
            IF NEW.status != 'delivered' THEN
                RAISE EXCEPTION 'Invalid order status transition: delivered is a final state. Cannot change to %', NEW.status;
            END IF;

        WHEN 'failed' THEN
            -- Can retry
            IF NEW.status NOT IN ('in_transit', 'cancelled', 'failed') THEN
                RAISE EXCEPTION 'Invalid order status transition: failed → %. Allowed: in_transit (retry), cancelled', NEW.status;
            END IF;

        WHEN 'cancelled' THEN
            IF NEW.status != 'cancelled' THEN
                RAISE EXCEPTION 'Invalid order status transition: cancelled is a final state. Cannot change to %', NEW.status;
            END IF;

        ELSE
            RAISE EXCEPTION 'Unknown order status: %', OLD.status;
    END CASE;

    RAISE NOTICE 'Order % status changed: % → %', NEW.order_id, OLD.status, NEW.status;
    RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION validate_order_status_transition() IS 
'Validates order status transitions. Updated to allow confirmed → draft for face sheet deletion scenarios.';
