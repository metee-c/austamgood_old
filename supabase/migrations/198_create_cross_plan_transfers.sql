-- Migration: สร้างตารางสำหรับ Cross-Plan Operations
-- Phase 5: Feature ใหม่ - ย้าย/แบ่งออเดอร์ข้ามแผน ตาม edit21.md
-- ไม่แก้ไขตารางเดิม เพิ่มใหม่เท่านั้น

-- Log การย้ายข้ามแผน
CREATE TABLE IF NOT EXISTS receiving_cross_plan_transfers (
  transfer_id SERIAL PRIMARY KEY,
  source_plan_id INTEGER NOT NULL REFERENCES receiving_route_plans(plan_id),
  source_trip_id INTEGER NOT NULL REFERENCES receiving_route_trips(trip_id),
  source_stop_id INTEGER NOT NULL REFERENCES receiving_route_stops(stop_id),
  target_plan_id INTEGER NOT NULL REFERENCES receiving_route_plans(plan_id),
  target_trip_id INTEGER NOT NULL REFERENCES receiving_route_trips(trip_id),
  order_id BIGINT NOT NULL REFERENCES wms_orders(order_id),
  transferred_weight_kg NUMERIC,
  transferred_items JSONB,
  transfer_type VARCHAR(50) NOT NULL, -- 'full' or 'partial'
  transferred_by INTEGER REFERENCES master_system_user(user_id),
  transferred_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index สำหรับ query
CREATE INDEX IF NOT EXISTS idx_cross_plan_source ON receiving_cross_plan_transfers(source_plan_id);
CREATE INDEX IF NOT EXISTS idx_cross_plan_target ON receiving_cross_plan_transfers(target_plan_id);
CREATE INDEX IF NOT EXISTS idx_cross_plan_order ON receiving_cross_plan_transfers(order_id);
CREATE INDEX IF NOT EXISTS idx_cross_plan_transferred_at ON receiving_cross_plan_transfers(transferred_at);

-- Comment
COMMENT ON TABLE receiving_cross_plan_transfers IS 'Log การย้ายออเดอร์ข้ามแผนเส้นทาง';
COMMENT ON COLUMN receiving_cross_plan_transfers.transfer_type IS 'ประเภทการย้าย: full = ย้ายทั้งหมด, partial = ย้ายบางส่วน';
