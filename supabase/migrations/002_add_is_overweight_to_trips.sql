-- Add is_overweight column to receiving_route_trips table
-- This flag indicates when a trip exceeds vehicle capacity due to enforced vehicle limits

ALTER TABLE "public"."receiving_route_trips"
ADD COLUMN IF NOT EXISTS "is_overweight" boolean DEFAULT false;

COMMENT ON COLUMN "public"."receiving_route_trips"."is_overweight" IS 'แฟล็กบ่งชี้ว่าเที่ยวนี้มีน้ำหนักเกินความจุรถ (เกิดจากการบังคับจำนวนรถสูงสุด)';
