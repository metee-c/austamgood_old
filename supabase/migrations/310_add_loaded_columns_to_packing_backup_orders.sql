-- Migration: Add loaded_at and loaded_by columns to packing_backup_orders
-- Created: 2025-02-03
-- Description: Add columns to track when packages are scanned and loaded onto vehicle

-- Add columns to track when packages are loaded onto vehicle
ALTER TABLE public.packing_backup_orders
ADD COLUMN IF NOT EXISTS loaded_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS loaded_by text;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_packing_backup_orders_loaded_at 
ON public.packing_backup_orders(loaded_at DESC) 
WHERE loaded_at IS NOT NULL;

-- Create index for loaded_by
CREATE INDEX IF NOT EXISTS idx_packing_backup_orders_loaded_by 
ON public.packing_backup_orders(loaded_by) 
WHERE loaded_by IS NOT NULL;

-- Add comments
COMMENT ON COLUMN public.packing_backup_orders.loaded_at IS 'Timestamp when package was scanned and loaded onto vehicle';
COMMENT ON COLUMN public.packing_backup_orders.loaded_by IS 'User who scanned and loaded the package onto vehicle';
