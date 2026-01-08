-- Migration: Fix validate_express_orders_for_face_sheet to detect invalid hub values (sales territories)
-- Date: 2026-01-08
-- Description: The validation function now checks for hub values that are sales territories
--              (e.g., "Northeast [Lower]", "Central", "South [West]") instead of actual Hub names
--              (e.g., "พุนพิน", "HUB นครสวรรค์", "เชียงใหม่")

CREATE OR REPLACE FUNCTION public.validate_express_orders_for_face_sheet()
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
    result JSONB;
    missing_customers JSONB;
    missing_hubs JSONB;
BEGIN
    -- Find customers from express orders that are not in master_customer
    SELECT jsonb_agg(T.customer_id)
    INTO missing_customers
    FROM (
        SELECT DISTINCT o.customer_id
        FROM wms_orders o
        JOIN wms_order_items oi ON o.order_id = oi.order_id
        WHERE o.order_type = 'express'
          AND o.customer_id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1
              FROM master_customer mc
              WHERE mc.customer_id = o.customer_id
          )
    ) T;

    -- Find customers from express orders that are in master_customer but have no hub OR have invalid hub (sales territory)
    SELECT jsonb_agg(T.customer_id)
    INTO missing_hubs
    FROM (
        SELECT DISTINCT o.customer_id
        FROM wms_orders o
        JOIN wms_order_items oi ON o.order_id = oi.order_id
        JOIN master_customer mc ON o.customer_id = mc.customer_id
        WHERE o.order_type = 'express'
          AND (
              -- Hub is empty
              mc.hub IS NULL 
              OR TRIM(mc.hub) = ''
              -- OR Hub contains invalid patterns (sales territories with brackets)
              OR mc.hub ~ '\[(Lower|Upper|East|West)\]'
              -- OR Hub is a simple direction name (sales territory)
              OR mc.hub IN ('Central', 'East', 'West', 'North', 'South', 'Northeast', 'Northwest', 'Southeast', 'Southwest')
              -- OR Hub starts with direction (e.g., "North [Upper]", "South [West]")
              OR mc.hub LIKE 'North %'
              OR mc.hub LIKE 'South %'
              OR mc.hub LIKE 'Northeast %'
              OR mc.hub LIKE 'Northwest %'
              OR mc.hub LIKE 'Southeast %'
              OR mc.hub LIKE 'Southwest %'
          )
    ) T;

    -- Combine results
    result := jsonb_build_object(
        'missing_customers', COALESCE(missing_customers, '[]'::jsonb),
        'missing_hubs', COALESCE(missing_hubs, '[]'::jsonb)
    );

    RETURN result;
END;
$function$;

COMMENT ON FUNCTION public.validate_express_orders_for_face_sheet() IS 
'Validates express orders before creating face sheets. 
Returns customers not found in master_customer and customers with missing or invalid hub values.
Invalid hub values include sales territories like "Northeast [Lower]", "Central", "South [West]" etc.
Valid hub values should be actual Hub names like "พุนพิน", "HUB นครสวรรค์", "เชียงใหม่" etc.';
