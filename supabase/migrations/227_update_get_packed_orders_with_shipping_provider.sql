-- Update RPC function to include shipping_provider
-- This fixes the shipping provider stats in dashboard
-- Date: 2026-02-02

-- Drop old function (2 columns: tracking_number, platform)
DROP FUNCTION IF EXISTS get_packed_orders_count_by_date(timestamptz, timestamptz);

-- Create new function with shipping_provider (3 columns)
CREATE OR REPLACE FUNCTION get_packed_orders_count_by_date(
  p_start_date timestamptz,
  p_end_date timestamptz
)
RETURNS TABLE (
  tracking_number text,
  platform text,
  shipping_provider text
)
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT ON (tracking_number)
    tracking_number,
    platform,
    shipping_provider
  FROM packing_backup_orders
  WHERE packed_at >= p_start_date
    AND packed_at <= p_end_date
    AND packed_at IS NOT NULL
    AND tracking_number IS NOT NULL
  ORDER BY tracking_number, packed_at DESC;
$$;
