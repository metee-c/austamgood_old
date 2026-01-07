-- Migration: Allow order status transition from loaded to draft for full return receive
-- อัปเดต validate_order_status_transition เพื่อรองรับการถอยสถานะเมื่อรับสินค้าตีกลับครบ

CREATE OR REPLACE FUNCTION public.validate_order_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;
    
    IF NOT (
        (OLD.status = 'draft' AND NEW.status IN ('confirmed', 'cancelled')) OR
        (OLD.status = 'confirmed' AND NEW.status IN ('in_picking', 'cancelled')) OR
        (OLD.status = 'in_picking' AND NEW.status IN ('picked', 'confirmed', 'cancelled')) OR
        (OLD.status = 'picked' AND NEW.status IN ('loaded', 'in_picking', 'cancelled')) OR
        (OLD.status = 'loaded' AND NEW.status IN ('in_transit', 'picked', 'cancelled', 'draft')) OR  -- เพิ่ม draft สำหรับรับตีกลับครบ
        (OLD.status = 'in_transit' AND NEW.status IN ('delivered', 'loaded', 'draft')) OR  -- เพิ่ม draft สำหรับรับตีกลับครบ
        (OLD.status = 'delivered' AND NEW.status IN ('draft')) OR  -- เพิ่ม draft สำหรับรับตีกลับครบ
        (OLD.status = 'cancelled' AND FALSE)
    ) THEN
        RAISE EXCEPTION 'Invalid order status transition from % to % for order %', 
            OLD.status, NEW.status, OLD.order_no;
    END IF;
    
    INSERT INTO process_state_audit_log (
        entity_type, entity_id, entity_code, old_status, new_status, 
        transition_reason, triggered_by
    ) VALUES (
        'order', OLD.order_id, OLD.order_no, OLD.status, NEW.status,
        'Status update via trigger', 'trigger'
    );
    
    RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION validate_order_status_transition() IS 
'Validates order status transitions. Allows transition to draft from loaded/in_transit/delivered for full return receive scenarios.';
