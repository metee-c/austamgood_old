-- ============================================================================
-- Migration: 320_create_shadow_command_center.sql
-- Description: Shadow Command Center - Non-invasive observability layer
-- 
-- 🔒 GOLDEN RULE: Shadow system ห้ามทำให้ business operation fail
-- 
-- ZERO IMPACT:
-- ❌ ไม่แตะ wms_inventory_balances
-- ❌ ไม่แตะ wms_inventory_ledger  
-- ❌ ไม่แก้ triggers เดิม
-- ✅ สร้างตารางใหม่ 100% แยกจากเดิม
-- ============================================================================

-- ============================================================================
-- 1. Transaction Registry (ศูนย์กลาง correlation)
-- ============================================================================
CREATE TABLE IF NOT EXISTS wms_transactions (
    transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Context
    operation_type VARCHAR(100) NOT NULL,
    operation_subtype VARCHAR(100),
    
    -- User
    user_id INTEGER REFERENCES master_system_user(user_id),
    session_id UUID,
    ip_address INET,
    user_agent TEXT,
    
    -- Request
    request_path VARCHAR(500),
    request_method VARCHAR(10),
    request_body JSONB,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'started',
    
    -- Timing
    started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    
    -- Reference
    reference_doc_type VARCHAR(50),
    reference_doc_id BIGINT,
    reference_doc_no VARCHAR(100),
    
    -- Metadata
    metadata JSONB,
    
    CONSTRAINT chk_wms_transaction_status CHECK (status IN ('started', 'completed', 'failed', 'partial'))
);

CREATE INDEX IF NOT EXISTS idx_wms_transactions_user ON wms_transactions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_wms_transactions_operation ON wms_transactions(operation_type, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_wms_transactions_status ON wms_transactions(status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_wms_transactions_reference ON wms_transactions(reference_doc_type, reference_doc_id);
CREATE INDEX IF NOT EXISTS idx_wms_transactions_started ON wms_transactions(started_at DESC);

COMMENT ON TABLE wms_transactions IS 
'Transaction registry for correlating all activities. SHADOW TABLE - does not affect existing logic.';

-- ============================================================================
-- 2. Activity Logs (ทุก action ที่เกิดขึ้น)
-- ============================================================================
CREATE TABLE IF NOT EXISTS wms_activity_logs (
    log_id BIGSERIAL PRIMARY KEY,
    transaction_id UUID REFERENCES wms_transactions(transaction_id),
    
    -- Activity
    activity_type VARCHAR(100) NOT NULL,
    activity_status VARCHAR(20) NOT NULL,
    
    -- Entity
    entity_type VARCHAR(100),
    entity_id VARCHAR(100),
    entity_no VARCHAR(100),
    
    -- Stock Context (snapshot at time of activity)
    warehouse_id VARCHAR(50),
    location_id VARCHAR(50),
    sku_id VARCHAR(50),
    pallet_id VARCHAR(50),
    
    -- Quantities (snapshot)
    qty_before NUMERIC(18,3),
    qty_after NUMERIC(18,3),
    qty_delta NUMERIC(18,3),
    reserved_before NUMERIC(18,3),
    reserved_after NUMERIC(18,3),
    
    -- Timing
    logged_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    duration_ms INTEGER,
    
    -- Metadata
    remarks TEXT,
    metadata JSONB,
    
    CONSTRAINT chk_wms_activity_status CHECK (activity_status IN ('success', 'failed', 'partial'))
);

CREATE INDEX IF NOT EXISTS idx_wms_activity_logs_transaction ON wms_activity_logs(transaction_id);
CREATE INDEX IF NOT EXISTS idx_wms_activity_logs_type ON wms_activity_logs(activity_type, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_wms_activity_logs_entity ON wms_activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_wms_activity_logs_sku ON wms_activity_logs(sku_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_wms_activity_logs_location ON wms_activity_logs(warehouse_id, location_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_wms_activity_logs_logged ON wms_activity_logs(logged_at DESC);

COMMENT ON TABLE wms_activity_logs IS 
'Activity log for all stock-related operations. SHADOW TABLE - does not affect existing logic.';

-- ============================================================================
-- 3. Activity Log Items (รายละเอียดระดับ item)
-- ============================================================================
CREATE TABLE IF NOT EXISTS wms_activity_log_items (
    item_id BIGSERIAL PRIMARY KEY,
    log_id BIGINT NOT NULL REFERENCES wms_activity_logs(log_id) ON DELETE CASCADE,
    
    -- Item Details
    line_no INTEGER,
    sku_id VARCHAR(50),
    location_id VARCHAR(50),
    pallet_id VARCHAR(50),
    
    -- Quantities
    qty_requested NUMERIC(18,3),
    qty_actual NUMERIC(18,3),
    qty_before NUMERIC(18,3),
    qty_after NUMERIC(18,3),
    
    -- Status
    item_status VARCHAR(20),
    error_message TEXT,
    
    -- Metadata
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_wms_activity_log_items_log ON wms_activity_log_items(log_id);
CREATE INDEX IF NOT EXISTS idx_wms_activity_log_items_sku ON wms_activity_log_items(sku_id);

COMMENT ON TABLE wms_activity_log_items IS 
'Item-level details for activity logs. SHADOW TABLE - does not affect existing logic.';

-- ============================================================================
-- 4. User Intents (ผู้ใช้ตั้งใจทำอะไร vs ทำได้จริง)
-- ============================================================================
CREATE TABLE IF NOT EXISTS wms_user_intents (
    intent_id BIGSERIAL PRIMARY KEY,
    transaction_id UUID REFERENCES wms_transactions(transaction_id),
    
    -- Intent
    intent_type VARCHAR(50) NOT NULL,
    intent_description TEXT,
    
    -- User
    user_id INTEGER REFERENCES master_system_user(user_id),
    
    -- Requested
    items_requested INTEGER NOT NULL DEFAULT 0,
    qty_requested NUMERIC(18,3) NOT NULL DEFAULT 0,
    
    -- Actual
    items_succeeded INTEGER NOT NULL DEFAULT 0,
    items_failed INTEGER NOT NULL DEFAULT 0,
    qty_succeeded NUMERIC(18,3) NOT NULL DEFAULT 0,
    qty_failed NUMERIC(18,3) NOT NULL DEFAULT 0,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    
    -- Timing
    requested_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    
    -- Reference
    reference_doc_type VARCHAR(50),
    reference_doc_id BIGINT,
    reference_doc_no VARCHAR(100),
    
    -- Failure Analysis
    failure_reasons JSONB,
    
    CONSTRAINT chk_wms_intent_status CHECK (status IN ('pending', 'in_progress', 'completed', 'partial', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_wms_user_intents_transaction ON wms_user_intents(transaction_id);
CREATE INDEX IF NOT EXISTS idx_wms_user_intents_user ON wms_user_intents(user_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_wms_user_intents_status ON wms_user_intents(status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_wms_user_intents_type ON wms_user_intents(intent_type, requested_at DESC);

COMMENT ON TABLE wms_user_intents IS 
'Business intent layer - what users INTENDED vs what actually happened. SHADOW TABLE.';

-- ============================================================================
-- 5. Error Logs (ทุก error ที่เกิดขึ้น)
-- ============================================================================
CREATE TABLE IF NOT EXISTS wms_errors (
    error_id BIGSERIAL PRIMARY KEY,
    transaction_id UUID REFERENCES wms_transactions(transaction_id),
    
    -- Error Details
    error_code VARCHAR(100),
    error_message TEXT NOT NULL,
    error_stack TEXT,
    
    -- Context
    operation_type VARCHAR(100),
    entity_type VARCHAR(100),
    entity_id VARCHAR(100),
    
    -- User
    user_id INTEGER REFERENCES master_system_user(user_id),
    
    -- Request Context
    request_path VARCHAR(500),
    request_body JSONB,
    
    -- Timing
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Metadata
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_wms_errors_transaction ON wms_errors(transaction_id);
CREATE INDEX IF NOT EXISTS idx_wms_errors_code ON wms_errors(error_code, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_wms_errors_operation ON wms_errors(operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_wms_errors_user ON wms_errors(user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_wms_errors_occurred ON wms_errors(occurred_at DESC);

COMMENT ON TABLE wms_errors IS 
'Error log for debugging and pattern analysis. SHADOW TABLE - does not affect existing logic.';

-- ============================================================================
-- 6. Stock Snapshots (snapshot ของ stock ณ เวลาที่ทำ activity)
-- ============================================================================
CREATE TABLE IF NOT EXISTS wms_stock_snapshots (
    snapshot_id BIGSERIAL PRIMARY KEY,
    transaction_id UUID REFERENCES wms_transactions(transaction_id),
    log_id BIGINT REFERENCES wms_activity_logs(log_id),
    
    -- Stock Identity
    warehouse_id VARCHAR(50) NOT NULL,
    location_id VARCHAR(50) NOT NULL,
    sku_id VARCHAR(50) NOT NULL,
    pallet_id VARCHAR(50),
    
    -- Snapshot Values (at time of activity)
    total_piece_qty NUMERIC(18,3),
    total_pack_qty NUMERIC(18,3),
    reserved_piece_qty NUMERIC(18,3),
    reserved_pack_qty NUMERIC(18,3),
    available_piece_qty NUMERIC(18,3),
    
    -- Timing
    snapshot_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Type
    snapshot_type VARCHAR(20) NOT NULL,
    
    CONSTRAINT chk_wms_snapshot_type CHECK (snapshot_type IN ('before', 'after'))
);

CREATE INDEX IF NOT EXISTS idx_wms_stock_snapshots_transaction ON wms_stock_snapshots(transaction_id);
CREATE INDEX IF NOT EXISTS idx_wms_stock_snapshots_log ON wms_stock_snapshots(log_id);
CREATE INDEX IF NOT EXISTS idx_wms_stock_snapshots_sku ON wms_stock_snapshots(sku_id, snapshot_at DESC);
CREATE INDEX IF NOT EXISTS idx_wms_stock_snapshots_location ON wms_stock_snapshots(warehouse_id, location_id, snapshot_at DESC);

COMMENT ON TABLE wms_stock_snapshots IS 
'Stock state snapshots at time of activities. SHADOW TABLE - for debugging and audit.';

-- ============================================================================
-- Enable RLS (optional - for security)
-- ============================================================================
ALTER TABLE wms_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wms_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE wms_activity_log_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE wms_user_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE wms_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE wms_stock_snapshots ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'shadow_service_role_wms_transactions') THEN
        CREATE POLICY shadow_service_role_wms_transactions ON wms_transactions FOR ALL TO service_role USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'shadow_service_role_wms_activity_logs') THEN
        CREATE POLICY shadow_service_role_wms_activity_logs ON wms_activity_logs FOR ALL TO service_role USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'shadow_service_role_wms_activity_log_items') THEN
        CREATE POLICY shadow_service_role_wms_activity_log_items ON wms_activity_log_items FOR ALL TO service_role USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'shadow_service_role_wms_user_intents') THEN
        CREATE POLICY shadow_service_role_wms_user_intents ON wms_user_intents FOR ALL TO service_role USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'shadow_service_role_wms_errors') THEN
        CREATE POLICY shadow_service_role_wms_errors ON wms_errors FOR ALL TO service_role USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'shadow_service_role_wms_stock_snapshots') THEN
        CREATE POLICY shadow_service_role_wms_stock_snapshots ON wms_stock_snapshots FOR ALL TO service_role USING (true);
    END IF;
END $$;

-- ============================================================================
-- Summary
-- ============================================================================
-- Created 6 shadow tables:
-- 1. wms_transactions - Transaction correlation registry
-- 2. wms_activity_logs - Activity records
-- 3. wms_activity_log_items - Item-level details
-- 4. wms_user_intents - Business intent layer
-- 5. wms_errors - Error capture
-- 6. wms_stock_snapshots - Stock state snapshots
--
-- ZERO IMPACT on existing tables/triggers
-- ============================================================================
