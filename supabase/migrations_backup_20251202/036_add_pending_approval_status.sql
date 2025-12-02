-- Migration: Add 'pending_approval' status to receiving_route_plan_status_enum
-- This status represents route plans that are waiting for approval before being published

-- Add 'pending_approval' to the enum
ALTER TYPE receiving_route_plan_status_enum ADD VALUE IF NOT EXISTS 'pending_approval' BEFORE 'published';

-- Update comment to reflect new status
COMMENT ON TYPE receiving_route_plan_status_enum IS 'สถานะของชุดแผนเส้นทางรับสินค้า (draft/optimizing/pending_approval/published/completed/cancelled)';
