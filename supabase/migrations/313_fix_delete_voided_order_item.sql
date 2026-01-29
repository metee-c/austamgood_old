-- ============================================================================
-- Migration: 313_fix_delete_voided_order_item.sql
-- Description: แก้ไข function delete_voided_order_item ให้ใช้ order_id สำหรับ audit log
-- Date: 2026-01-29
-- ============================================================================

CREATE OR REPLACE FUNCTION delete_voided_order_item(
    p_order_item_id BIGINT,
    p_user_id BIGINT
) RETURNS JSONB AS $$
DECLARE
    v_order_item RECORD;
BEGIN
    -- ดึงข้อมูล order item
    SELECT oi.*, o.order_no, o.status as order_status
    INTO v_order_item
    FROM wms_order_items oi
    JOIN wms_orders o ON oi.order_id = o.order_id
    WHERE oi.order_item_id = p_order_item_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'ไม่พบรายการสินค้า'
        );
    END IF;
    
    -- ตรวจสอบว่า item ถูก void แล้วหรือยัง
    IF v_order_item.voided_at IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'ไม่สามารถลบรายการที่ยังไม่ได้ Rollback กรุณา Rollback ก่อน'
        );
    END IF;
    
    -- ลบ order item
    DELETE FROM wms_order_items WHERE order_item_id = p_order_item_id;
    
    -- บันทึก audit log (use order_id for entity_id due to FK constraint)
    INSERT INTO wms_rollback_audit_logs (
        action,
        entity_type,
        entity_id,
        user_id,
        reason,
        previous_status,
        new_status,
        affected_documents,
        status,
        completed_at
    ) VALUES (
        'item_delete',
        'order_item',
        v_order_item.order_id,  -- Use order_id instead of order_item_id (FK constraint)
        p_user_id,
        'ลบรายการสินค้าที่ Rollback แล้ว',
        'voided',
        'deleted',
        jsonb_build_object(
            'order_id', v_order_item.order_id,
            'order_no', v_order_item.order_no,
            'order_item_id', p_order_item_id,
            'sku_id', v_order_item.sku_id
        ),
        'completed',
        NOW()
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'order_item_id', p_order_item_id,
        'order_id', v_order_item.order_id,
        'order_no', v_order_item.order_no,
        'sku_id', v_order_item.sku_id,
        'message', 'ลบรายการสินค้าสำเร็จ'
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Migration 313 completed: delete_voided_order_item function fixed';
END $$;
