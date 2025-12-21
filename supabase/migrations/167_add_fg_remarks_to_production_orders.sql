-- Migration: Add fg_remarks column to production_orders table
-- Description: เพิ่มคอลัมน์หมายเหตุ FG สำหรับใบสั่งผลิต

ALTER TABLE production_orders
ADD COLUMN IF NOT EXISTS fg_remarks TEXT;

COMMENT ON COLUMN production_orders.fg_remarks IS 'หมายเหตุสำหรับสินค้าสำเร็จรูป (FG) ที่จะผลิต';
