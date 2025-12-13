-- Migration: Add supplier_id to master_vehicle table
-- Purpose: Link vehicles to transport companies (suppliers) for filtering in route planning

-- Add supplier_id column to master_vehicle table
ALTER TABLE public.master_vehicle
ADD COLUMN IF NOT EXISTS supplier_id VARCHAR(50);

-- Add foreign key constraint to master_supplier
ALTER TABLE public.master_vehicle
ADD CONSTRAINT fk_master_vehicle_supplier
FOREIGN KEY (supplier_id)
REFERENCES public.master_supplier(supplier_id)
ON DELETE SET NULL;

-- Add index for performance when filtering by supplier
CREATE INDEX IF NOT EXISTS idx_master_vehicle_supplier_id
ON public.master_vehicle(supplier_id);

-- Add comment
COMMENT ON COLUMN public.master_vehicle.supplier_id IS 'Reference to transport company (supplier) that owns/operates this vehicle';
