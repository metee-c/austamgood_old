-- Migration: Add FG production_date and expiry_date to production_orders
-- วันผลิตและวันหมดอายุของสินค้าสำเร็จรูป (FG) ที่จะผลิต

-- Add production_date column (วันผลิตของ FG)
ALTER TABLE production_orders
ADD COLUMN IF NOT EXISTS production_date DATE;

COMMENT ON COLUMN production_orders.production_date IS 'วันผลิตของสินค้าสำเร็จรูป (FG) ที่จะผลิตในรอบนี้';

-- Add expiry_date column (วันหมดอายุของ FG)
ALTER TABLE production_orders
ADD COLUMN IF NOT EXISTS expiry_date DATE;

COMMENT ON COLUMN production_orders.expiry_date IS 'วันหมดอายุของสินค้าสำเร็จรูป (FG) ที่จะผลิตในรอบนี้';
