-- Add foreign key constraints to wms_orders table
-- Note: We skip foreign key constraints because existing data may not have complete master data
-- This allows the system to work with incomplete reference data and display "ไม่ระบุ" when data is missing

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_wms_orders_customer_id ON public.wms_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_wms_orders_warehouse_id ON public.wms_orders(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_wms_orders_delivery_date ON public.wms_orders(delivery_date);
CREATE INDEX IF NOT EXISTS idx_wms_orders_order_type ON public.wms_orders(order_type);
CREATE INDEX IF NOT EXISTS idx_wms_orders_status ON public.wms_orders(status);
CREATE INDEX IF NOT EXISTS idx_wms_orders_matched_trip_id ON public.wms_orders(matched_trip_id);
