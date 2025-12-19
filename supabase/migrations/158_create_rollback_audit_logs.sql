-- ============================================================================
-- Migration: 158_create_rollback_audit_logs.sql
-- Description: สร้างตาราง wms_rollback_audit_logs สำหรับบันทึก Rollback History
-- Date: 2024-12-19
-- ============================================================================

-- ============================================================================
-- STEP 1: สร้างตาราง wms_rollback_audit_logs
-- ============================================================================

CREATE TABLE IF NOT EXISTS wms_rollback_audit_logs (
    log_id BIGSERIAL PRIMARY KEY,
    
    -- Action Info
    action VARCHAR(50) NOT NULL DEFAULT 'partial_rollback',
    entity_type VARCHAR(50) NOT NULL DEFAULT 'order',
    entity_id BIGINT NOT NULL,
    
    -- User Info
    user_id BIGINT NOT NULL,
    
    -- Rollback Details
    reason TEXT,
    previous_status VARCHAR(50),
    new_status VARCHAR(50) DEFAULT 'draft',
    
    -- Affected Documents (JSON)
    affected_documents JSONB DEFAULT '{}',
    -- Example: {
    --   "picklists": [{"id": 1, "code": "PL-001", "items_voided": 5}],
    --   "face_sheets": [{"id": 2, "code": "FS-001", "items_voided": 3}],
    --   "loadlists": [{"id": 3, "code": "LL-001", "items_removed": 2}],
    --   "route_stops": [{"stop_id": 10, "trip_id": 5}]
    -- }
    
    -- Affected Ledger Entries
    affected_ledger_ids BIGINT[] DEFAULT '{}',
    
    -- Rollback Summary (JSON)
    rollback_summary JSONB DEFAULT '{}',
    -- Example: {
    --   "items_reversed": 10,
    --   "qty_restored": 500,
    --   "reservations_released": 8,
    --   "ledger_entries_created": 20,
    --   "stock_movements": [
    --     {"sku_id": "SKU001", "from": "Dispatch", "to": "PK001", "qty": 100}
    --   ]
    -- }
    
    -- Request Info
    ip_address VARCHAR(50),
    user_agent TEXT,
    
    -- Timestamps
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INT,
    
    -- Status
    status VARCHAR(20) DEFAULT 'in_progress',  -- in_progress, completed, failed
    error_message TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- STEP 2: เพิ่ม Foreign Key Constraints
-- ============================================================================

-- FK สำหรับ user_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_rollback_audit_user_id' 
        AND table_name = 'wms_rollback_audit_logs'
    ) THEN
        ALTER TABLE wms_rollback_audit_logs 
        ADD CONSTRAINT fk_rollback_audit_user_id 
        FOREIGN KEY (user_id) REFERENCES master_system_user(user_id) ON DELETE SET NULL;
    END IF;
END $$;

-- FK สำหรับ entity_id (order_id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_rollback_audit_order_id' 
        AND table_name = 'wms_rollback_audit_logs'
    ) THEN
        ALTER TABLE wms_rollback_audit_logs 
        ADD CONSTRAINT fk_rollback_audit_order_id 
        FOREIGN KEY (entity_id) REFERENCES wms_orders(order_id) ON DELETE CASCADE;
    END IF;
END $$;

-- ============================================================================
-- STEP 3: สร้าง Indexes
-- ============================================================================

-- Index สำหรับ query ตาม order
CREATE INDEX IF NOT EXISTS idx_rollback_audit_entity 
ON wms_rollback_audit_logs(entity_type, entity_id);

-- Index สำหรับ query ตาม user
CREATE INDEX IF NOT EXISTS idx_rollback_audit_user 
ON wms_rollback_audit_logs(user_id);

-- Index สำหรับ query ตาม date
CREATE INDEX IF NOT EXISTS idx_rollback_audit_date 
ON wms_rollback_audit_logs(created_at DESC);

-- Index สำหรับ query ตาม status
CREATE INDEX IF NOT EXISTS idx_rollback_audit_status 
ON wms_rollback_audit_logs(status);

-- GIN Index สำหรับ JSONB queries
CREATE INDEX IF NOT EXISTS idx_rollback_audit_documents 
ON wms_rollback_audit_logs USING GIN (affected_documents);

CREATE INDEX IF NOT EXISTS idx_rollback_audit_summary 
ON wms_rollback_audit_logs USING GIN (rollback_summary);


-- ============================================================================
-- STEP 4: สร้าง Helper Functions สำหรับ Audit Logging
-- ============================================================================

-- 4.1 Function: สร้าง Rollback Audit Log Entry
CREATE OR REPLACE FUNCTION create_rollback_audit_log(
    p_order_id BIGINT,
    p_user_id BIGINT,
    p_reason TEXT,
    p_previous_status VARCHAR(50),
    p_ip_address VARCHAR(50) DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
) RETURNS BIGINT AS $$
DECLARE
    v_log_id BIGINT;
BEGIN
    INSERT INTO wms_rollback_audit_logs (
        action,
        entity_type,
        entity_id,
        user_id,
        reason,
        previous_status,
        new_status,
        ip_address,
        user_agent,
        status,
        started_at
    ) VALUES (
        'partial_rollback',
        'order',
        p_order_id,
        p_user_id,
        p_reason,
        p_previous_status,
        'draft',
        p_ip_address,
        p_user_agent,
        'in_progress',
        NOW()
    )
    RETURNING log_id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4.2 Function: อัปเดต Audit Log เมื่อ Rollback สำเร็จ
CREATE OR REPLACE FUNCTION complete_rollback_audit_log(
    p_log_id BIGINT,
    p_affected_documents JSONB,
    p_affected_ledger_ids BIGINT[],
    p_rollback_summary JSONB
) RETURNS VOID AS $$
DECLARE
    v_started_at TIMESTAMPTZ;
    v_duration_ms INT;
BEGIN
    -- ดึง started_at
    SELECT started_at INTO v_started_at
    FROM wms_rollback_audit_logs
    WHERE log_id = p_log_id;
    
    -- คำนวณ duration
    v_duration_ms := EXTRACT(EPOCH FROM (NOW() - v_started_at)) * 1000;
    
    UPDATE wms_rollback_audit_logs
    SET 
        affected_documents = p_affected_documents,
        affected_ledger_ids = p_affected_ledger_ids,
        rollback_summary = p_rollback_summary,
        status = 'completed',
        completed_at = NOW(),
        duration_ms = v_duration_ms
    WHERE log_id = p_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4.3 Function: อัปเดต Audit Log เมื่อ Rollback ล้มเหลว
CREATE OR REPLACE FUNCTION fail_rollback_audit_log(
    p_log_id BIGINT,
    p_error_message TEXT,
    p_partial_documents JSONB DEFAULT NULL,
    p_partial_ledger_ids BIGINT[] DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_started_at TIMESTAMPTZ;
    v_duration_ms INT;
BEGIN
    -- ดึง started_at
    SELECT started_at INTO v_started_at
    FROM wms_rollback_audit_logs
    WHERE log_id = p_log_id;
    
    -- คำนวณ duration
    v_duration_ms := EXTRACT(EPOCH FROM (NOW() - v_started_at)) * 1000;
    
    UPDATE wms_rollback_audit_logs
    SET 
        affected_documents = COALESCE(p_partial_documents, '{}'),
        affected_ledger_ids = COALESCE(p_partial_ledger_ids, '{}'),
        status = 'failed',
        error_message = p_error_message,
        completed_at = NOW(),
        duration_ms = v_duration_ms
    WHERE log_id = p_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4.4 Function: ดึง Rollback History ของ Order
CREATE OR REPLACE FUNCTION get_order_rollback_history(p_order_id BIGINT)
RETURNS TABLE(
    log_id BIGINT,
    user_id BIGINT,
    user_name TEXT,
    reason TEXT,
    previous_status VARCHAR(50),
    affected_documents JSONB,
    rollback_summary JSONB,
    status VARCHAR(20),
    error_message TEXT,
    created_at TIMESTAMPTZ,
    duration_ms INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ral.log_id,
        ral.user_id,
        u.full_name AS user_name,
        ral.reason,
        ral.previous_status,
        ral.affected_documents,
        ral.rollback_summary,
        ral.status,
        ral.error_message,
        ral.created_at,
        ral.duration_ms
    FROM wms_rollback_audit_logs ral
    LEFT JOIN master_system_user u ON ral.user_id = u.user_id
    WHERE ral.entity_type = 'order' AND ral.entity_id = p_order_id
    ORDER BY ral.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 5: สร้าง View สำหรับ Rollback Statistics
-- ============================================================================

CREATE OR REPLACE VIEW v_rollback_statistics AS
SELECT 
    DATE_TRUNC('day', created_at) AS rollback_date,
    COUNT(*) AS total_rollbacks,
    COUNT(*) FILTER (WHERE status = 'completed') AS successful_rollbacks,
    COUNT(*) FILTER (WHERE status = 'failed') AS failed_rollbacks,
    AVG(duration_ms) FILTER (WHERE status = 'completed') AS avg_duration_ms,
    COUNT(DISTINCT user_id) AS unique_users,
    COUNT(DISTINCT entity_id) AS unique_orders
FROM wms_rollback_audit_logs
WHERE entity_type = 'order'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY rollback_date DESC;

-- ============================================================================
-- STEP 6: Add Comments
-- ============================================================================

COMMENT ON TABLE wms_rollback_audit_logs IS 'บันทึก Audit Log สำหรับ Partial Rollback';
COMMENT ON COLUMN wms_rollback_audit_logs.action IS 'ประเภท action (partial_rollback)';
COMMENT ON COLUMN wms_rollback_audit_logs.entity_type IS 'ประเภท entity (order)';
COMMENT ON COLUMN wms_rollback_audit_logs.entity_id IS 'ID ของ entity (order_id)';
COMMENT ON COLUMN wms_rollback_audit_logs.affected_documents IS 'JSON ของ documents ที่ได้รับผลกระทบ';
COMMENT ON COLUMN wms_rollback_audit_logs.affected_ledger_ids IS 'Array ของ ledger_id ที่สร้างจาก rollback';
COMMENT ON COLUMN wms_rollback_audit_logs.rollback_summary IS 'JSON สรุปผลการ rollback';
COMMENT ON COLUMN wms_rollback_audit_logs.status IS 'สถานะ: in_progress, completed, failed';
COMMENT ON COLUMN wms_rollback_audit_logs.duration_ms IS 'ระยะเวลาที่ใช้ในการ rollback (milliseconds)';

COMMENT ON FUNCTION create_rollback_audit_log IS 'สร้าง audit log entry เมื่อเริ่ม rollback';
COMMENT ON FUNCTION complete_rollback_audit_log IS 'อัปเดต audit log เมื่อ rollback สำเร็จ';
COMMENT ON FUNCTION fail_rollback_audit_log IS 'อัปเดต audit log เมื่อ rollback ล้มเหลว';
COMMENT ON FUNCTION get_order_rollback_history IS 'ดึง rollback history ของ order';
COMMENT ON VIEW v_rollback_statistics IS 'สถิติการ rollback รายวัน';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wms_rollback_audit_logs') THEN
        RAISE NOTICE '✅ Migration 158 completed: wms_rollback_audit_logs table created';
    ELSE
        RAISE EXCEPTION 'Migration 158 failed: wms_rollback_audit_logs table not created';
    END IF;
END $$;
