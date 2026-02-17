-- Migration: 322_add_transport_contract_trips.sql
-- Description: Junction table เพื่อ track ว่า trip ไหนอยู่ใน contract ไหน
-- ป้องกันการสร้างใบว่าจ้างซ้ำ

-- Junction table เพื่อเชื่อม trips กับใบว่าจ้าง
CREATE TABLE IF NOT EXISTS transport_contract_trips (
  id BIGSERIAL PRIMARY KEY,
  contract_id BIGINT NOT NULL,
  contract_type VARCHAR(20) NOT NULL CHECK (contract_type IN ('single', 'multi')),
  trip_id BIGINT NOT NULL REFERENCES receiving_route_trips(trip_id) ON DELETE CASCADE,
  plan_id BIGINT NOT NULL,
  supplier_id VARCHAR(50) NOT NULL,
  included_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- ⭐ CRITICAL: 1 trip สามารถอยู่ใน 1 contract เท่านั้น
  UNIQUE(trip_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tc_trips_trip_id ON transport_contract_trips(trip_id);
CREATE INDEX IF NOT EXISTS idx_tc_trips_contract_id ON transport_contract_trips(contract_id, contract_type);
CREATE INDEX IF NOT EXISTS idx_tc_trips_supplier ON transport_contract_trips(supplier_id);

-- Comments
COMMENT ON TABLE transport_contract_trips IS 'Junction table เชื่อม trips กับใบว่าจ้าง (ป้องกันการสร้างซ้ำ)';
COMMENT ON COLUMN transport_contract_trips.contract_type IS 'ประเภทใบว่าจ้าง: single (1 plan) หรือ multi (หลาย plans)';
COMMENT ON COLUMN transport_contract_trips.trip_id IS 'FK ไปยัง receiving_route_trips - 1 trip อยู่ได้ 1 contract เท่านั้น (UNIQUE constraint)';
COMMENT ON COLUMN transport_contract_trips.included_at IS 'เวลาที่เพิ่ม trip เข้าใบว่าจ้าง';
