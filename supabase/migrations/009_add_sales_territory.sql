-- Add sales_territory column to wms_orders table
-- This field stores the sales territory/region for watermark display on labels

ALTER TABLE public.wms_orders
ADD COLUMN IF NOT EXISTS sales_territory VARCHAR(100);

COMMENT ON COLUMN public.wms_orders.sales_territory IS 'เขตการขาย (สำหรับแสดง watermark บนใบปะหน้า)';

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_wms_orders_sales_territory ON public.wms_orders(sales_territory);

-- Add sales_territory to bonus_face_sheet_packages table as well
ALTER TABLE public.bonus_face_sheet_packages
ADD COLUMN IF NOT EXISTS sales_territory VARCHAR(100);

COMMENT ON COLUMN public.bonus_face_sheet_packages.sales_territory IS 'เขตการขาย (สำหรับแสดง watermark บนใบปะหน้า)';
