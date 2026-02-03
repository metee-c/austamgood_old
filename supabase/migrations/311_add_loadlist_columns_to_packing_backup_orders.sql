-- Migration: Add loadlist tracking columns to packing_backup_orders
-- Created: 2025-02-03
-- Description: Add columns to track when orders are added to loadlists

-- Add columns to track loadlist creation
ALTER TABLE public.packing_backup_orders
ADD COLUMN IF NOT EXISTS loadlist_created_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS loadlist_id bigint REFERENCES public.loadlists(id) ON DELETE SET NULL;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_packing_backup_orders_loadlist_created_at
ON public.packing_backup_orders(loadlist_created_at)
WHERE loadlist_created_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_packing_backup_orders_loadlist_id
ON public.packing_backup_orders(loadlist_id)
WHERE loadlist_id IS NOT NULL;

-- Create index for finding orders ready for loadlist creation
CREATE INDEX IF NOT EXISTS idx_packing_backup_orders_loaded_not_in_loadlist
ON public.packing_backup_orders(platform, loaded_at)
WHERE loaded_at IS NOT NULL 
  AND loadlist_created_at IS NULL;

-- Add comments
COMMENT ON COLUMN public.packing_backup_orders.loadlist_created_at IS 'Timestamp when order was added to a loadlist';
COMMENT ON COLUMN public.packing_backup_orders.loadlist_id IS 'Reference to the loadlist this order was added to';
