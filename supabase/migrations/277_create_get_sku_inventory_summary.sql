
-- Function to get inventory summary for specific SKUs
-- Returns total and reserved quantity grouped by SKU
create or replace function get_sku_inventory_summary(p_sku_ids text[])
returns table (
  sku_id text,
  total_qty numeric,
  reserved_qty numeric
)
language plpgsql
security definer
as $$
begin
  return query
  select 
    wib.sku_id,
    sum(coalesce(wib.total_piece_qty, 0))::numeric as total_qty,
    sum(coalesce(wib.reserved_piece_qty, 0))::numeric as reserved_qty
  from wms_inventory_balances wib
  where wib.sku_id = any(p_sku_ids)
  group by wib.sku_id;
end;
$$;
