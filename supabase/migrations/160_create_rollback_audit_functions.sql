-- ============================================================================
-- Migration: Create Rollback Audit Functions
-- Description: Functions สำหรับจัดการ Audit Log ของ Rollback
-- ============================================================================

-- Function: Create Rollback Audit Log
CREATE OR REPLACE FUNCTION create_rollback_audit_log(
  p_order_id BIGINT,
  p_user_id BIGINT,
  p_reason TEXT,
  p_previous_status VARCHAR,
  p_ip_address VARCHAR DEFAULT NULL,
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
    created_at
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
    NOW()
  )
  RETURNING log_id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Complete Rollback Audit Log
CREATE OR REPLACE FUNCTION complete_rollback_audit_log(
  p_log_id BIGINT,
  p_affected_documents JSONB,
  p_affected_ledger_ids BIGINT[],
  p_rollback_summary JSONB
) RETURNS VOID AS $$
BEGIN
  UPDATE wms_rollback_audit_logs
  SET 
    affected_documents = p_affected_documents,
    affected_ledger_ids = p_affected_ledger_ids,
    rollback_summary = p_rollback_summary
  WHERE log_id = p_log_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Fail Rollback Audit Log
CREATE OR REPLACE FUNCTION fail_rollback_audit_log(
  p_log_id BIGINT,
  p_error_message TEXT
) RETURNS VOID AS $$
BEGIN
  UPDATE wms_rollback_audit_logs
  SET 
    rollback_summary = jsonb_build_object(
      'status', 'failed',
      'error', p_error_message,
      'failed_at', NOW()
    )
  WHERE log_id = p_log_id;
END;
$$ LANGUAGE plpgsql;

-- View: Rollback Statistics
CREATE OR REPLACE VIEW v_rollback_statistics AS
SELECT 
  DATE_TRUNC('day', created_at) AS rollback_date,
  COUNT(*) AS total_rollbacks,
  COUNT(*) FILTER (WHERE rollback_summary->>'status' != 'failed') AS successful_rollbacks,
  COUNT(*) FILTER (WHERE rollback_summary->>'status' = 'failed') AS failed_rollbacks,
  COUNT(DISTINCT user_id) AS unique_users
FROM wms_rollback_audit_logs
WHERE action = 'partial_rollback'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY rollback_date DESC;

COMMENT ON FUNCTION create_rollback_audit_log IS 'สร้าง Audit Log เมื่อเริ่ม Rollback';
COMMENT ON FUNCTION complete_rollback_audit_log IS 'อัปเดต Audit Log เมื่อ Rollback สำเร็จ';
COMMENT ON FUNCTION fail_rollback_audit_log IS 'อัปเดต Audit Log เมื่อ Rollback ล้มเหลว';
COMMENT ON VIEW v_rollback_statistics IS 'สถิติการ Rollback รายวัน';
