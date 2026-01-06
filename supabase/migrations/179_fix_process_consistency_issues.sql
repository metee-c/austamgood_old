-- ============================================================================
-- Migration: 179_fix_process_consistency_issues.sql
-- Description: Fix process consistency issues and add state machine constraints
-- Date: 2026-01-06
-- Issues Fixed:
--   1. Orders stuck in 'in_picking' with no picklist items
--   2. Bonus face sheet stuck in 'picking'
--   3. Add state machine validation triggers
--   4. Add automatic status update triggers
-- ============================================================================

-- ============================================================================
-- STEP 1: Create process audit log table
-- ============================================================================
CREATE TABLE IF NOT EXISTS process_state_audit_log (
    audit_id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,  -- 'order', 'picklist', 'loadlist', etc.
    entity_id BIGINT NOT NULL,
    entity_code VARCHAR(100),
    old_status VARCHAR(50),
    new_status VARCHAR(50),
    transition_reason TEXT,
    triggered_by VARCHAR(50),  -- 'user', 'trigger', 'api', 'migration'
    user_id BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_process_audit_entity ON process_state_audit_log(entity_type, entity_id);
CREATE INDEX idx_process_audit_created ON process_state_audit_log(created_at);

COMMENT ON TABLE process_state_audit_log IS 'Audit trail for all entity state transitions';

-- ============================================================================
-- STEP 2: Fix orders stuck in 'in_picking' with no picklist items
-- ============================================================================

-- Log the fix
INSERT INTO process_state_audit_log (entity_type, entity_id, entity_code, old_status, new_status, transition_reason, triggered_by)
SELECT 
    'order',
    o.order_id,
    o.order_no,
    o.status,
    'confirmed',
    'Migration 179: Reset stuck order - no picklist items found',
    'migration'
FROM wms_orders o
WHERE o.status = 'in_picking'
AND NOT EXISTS (
    SELECT 1 FROM picklist_items pi WHERE pi.order_id = o.order_id
);

-- Reset orders stuck in in_picking with no picklist items
UPDATE wms_orders o
SET 
    status = 'confirmed',
    updated_at = CURRENT_TIMESTAMP
WHERE o.status = 'in_picking'
AND NOT EXISTS (
    SELECT 1 FROM picklist_items pi WHERE pi.order_id = o.order_id
);

RAISE NOTICE 'Fixed orders stuck in in_picking';

-- ============================================================================
-- STEP 3: Fix bonus face sheet stuck in 'picking'
-- ============================================================================

-- Check and fix bonus face sheets where all items are picked
INSERT INTO process_state_audit_log (entity_type, entity_id, entity_code, old_status, new_status, transition_reason, triggered_by)
SELECT 
    'bonus_face_sheet',
    bfs.id,
    bfs.face_sheet_no,
    bfs.status,
    'completed',
    'Migration 179: All items picked, updating status to completed',
    'migration'
FROM bonus_face_sheets bfs
WHERE bfs.status = 'picking'
AND NOT EXISTS (
    SELECT 1 FROM bonus_face_sheet_items bfsi 
    WHERE bfsi.face_sheet_id = bfs.id 
    AND (bfsi.status IS NULL OR bfsi.status != 'picked')
);

UPDATE bonus_face_sheets bfs
SET 
    status = 'completed',
    picking_completed_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE bfs.status = 'picking'
AND NOT EXISTS (
    SELECT 1 FROM bonus_face_sheet_items bfsi 
    WHERE bfsi.face_sheet_id = bfs.id 
    AND (bfsi.status IS NULL OR bfsi.status != 'picked')
);

RAISE NOTICE 'Fixed bonus face sheets stuck in picking';

-- ============================================================================
-- STEP 4: Create order status transition validation function
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_order_status_transition()
RETURNS TRIGGER AS $$
BEGIN
    -- Skip if status not changed
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;
    
    -- Validate transition
    IF NOT (
        (OLD.status = 'draft' AND NEW.status IN ('confirmed', 'cancelled')) OR
        (OLD.status = 'confirmed' AND NEW.status IN ('in_picking', 'cancelled')) OR
        (OLD.status = 'in_picking' AND NEW.status IN ('picked', 'confirmed', 'cancelled')) OR
        (OLD.status = 'picked' AND NEW.status IN ('loaded', 'in_picking', 'cancelled')) OR
        (OLD.status = 'loaded' AND NEW.status IN ('in_transit', 'picked', 'cancelled')) OR
        (OLD.status = 'in_transit' AND NEW.status IN ('delivered', 'loaded')) OR
        -- Terminal states - no transitions allowed
        (OLD.status = 'delivered' AND FALSE) OR
        (OLD.status = 'cancelled' AND FALSE)
    ) THEN
        RAISE EXCEPTION 'Invalid order status transition from % to % for order %', 
            OLD.status, NEW.status, OLD.order_no;
    END IF;
    
    -- Log the transition
    INSERT INTO process_state_audit_log (
        entity_type, entity_id, entity_code, old_status, new_status, 
        transition_reason, triggered_by
    ) VALUES (
        'order', OLD.order_id, OLD.order_no, OLD.status, NEW.status,
        'Status update via trigger', 'trigger'
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (disabled by default - enable after testing)
DROP TRIGGER IF EXISTS trg_validate_order_status ON wms_orders;
CREATE TRIGGER trg_validate_order_status
    BEFORE UPDATE OF status ON wms_orders
    FOR EACH ROW
    EXECUTE FUNCTION validate_order_status_transition();

-- Disable trigger initially for safety
ALTER TABLE wms_orders DISABLE TRIGGER trg_validate_order_status;

COMMENT ON FUNCTION validate_order_status_transition IS 
    'Validates order status transitions according to state machine rules';

-- ============================================================================
-- STEP 5: Create picklist status transition validation function
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_picklist_status_transition()
RETURNS TRIGGER AS $$
BEGIN
    -- Skip if status not changed
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;
    
    -- Validate transition
    IF NOT (
        (OLD.status = 'pending' AND NEW.status IN ('assigned', 'picking', 'cancelled')) OR
        (OLD.status = 'assigned' AND NEW.status IN ('picking', 'pending', 'cancelled')) OR
        (OLD.status = 'picking' AND NEW.status IN ('completed', 'assigned', 'cancelled')) OR
        (OLD.status = 'completed' AND NEW.status IN ('voided')) OR
        -- Terminal states
        (OLD.status = 'cancelled' AND FALSE) OR
        (OLD.status = 'voided' AND FALSE)
    ) THEN
        RAISE EXCEPTION 'Invalid picklist status transition from % to % for picklist %', 
            OLD.status, NEW.status, OLD.picklist_code;
    END IF;
    
    -- Log the transition
    INSERT INTO process_state_audit_log (
        entity_type, entity_id, entity_code, old_status, new_status, 
        transition_reason, triggered_by
    ) VALUES (
        'picklist', OLD.id, OLD.picklist_code, OLD.status::text, NEW.status::text,
        'Status update via trigger', 'trigger'
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (disabled by default)
DROP TRIGGER IF EXISTS trg_validate_picklist_status ON picklists;
CREATE TRIGGER trg_validate_picklist_status
    BEFORE UPDATE OF status ON picklists
    FOR EACH ROW
    EXECUTE FUNCTION validate_picklist_status_transition();

-- Disable trigger initially for safety
ALTER TABLE picklists DISABLE TRIGGER trg_validate_picklist_status;

-- ============================================================================
-- STEP 6: Create loadlist status transition validation function
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_loadlist_status_transition()
RETURNS TRIGGER AS $$
BEGIN
    -- Skip if status not changed
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;
    
    -- Validate transition
    IF NOT (
        (OLD.status = 'pending' AND NEW.status IN ('loaded', 'cancelled')) OR
        (OLD.status = 'loaded' AND NEW.status IN ('in_transit', 'pending', 'cancelled', 'completed')) OR
        (OLD.status = 'in_transit' AND NEW.status IN ('completed', 'loaded')) OR
        (OLD.status = 'completed' AND NEW.status IN ('voided')) OR
        -- Terminal states
        (OLD.status = 'cancelled' AND FALSE) OR
        (OLD.status = 'voided' AND FALSE)
    ) THEN
        RAISE EXCEPTION 'Invalid loadlist status transition from % to % for loadlist %', 
            OLD.status, NEW.status, OLD.loadlist_code;
    END IF;
    
    -- Log the transition
    INSERT INTO process_state_audit_log (
        entity_type, entity_id, entity_code, old_status, new_status, 
        transition_reason, triggered_by
    ) VALUES (
        'loadlist', OLD.id, OLD.loadlist_code, OLD.status::text, NEW.status::text,
        'Status update via trigger', 'trigger'
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (disabled by default)
DROP TRIGGER IF EXISTS trg_validate_loadlist_status ON loadlists;
CREATE TRIGGER trg_validate_loadlist_status
    BEFORE UPDATE OF status ON loadlists
    FOR EACH ROW
    EXECUTE FUNCTION validate_loadlist_status_transition();

-- Disable trigger initially for safety
ALTER TABLE loadlists DISABLE TRIGGER trg_validate_loadlist_status;

-- ============================================================================
-- STEP 7: Create function to auto-update order status when picklist completes
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_update_order_status_on_picklist_complete()
RETURNS TRIGGER AS $$
DECLARE
    v_order_id BIGINT;
    v_all_picked BOOLEAN;
BEGIN
    -- Only process when picklist status changes to 'completed'
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        -- Get all orders in this picklist
        FOR v_order_id IN 
            SELECT DISTINCT order_id 
            FROM picklist_items 
            WHERE picklist_id = NEW.id
        LOOP
            -- Check if ALL picklist items for this order are picked
            SELECT NOT EXISTS (
                SELECT 1 
                FROM picklist_items pi
                JOIN picklists p ON pi.picklist_id = p.id
                WHERE pi.order_id = v_order_id
                AND (pi.status IS NULL OR pi.status != 'picked')
            ) INTO v_all_picked;
            
            -- Update order status if all items picked
            IF v_all_picked THEN
                UPDATE wms_orders
                SET status = 'picked',
                    updated_at = CURRENT_TIMESTAMP
                WHERE order_id = v_order_id
                AND status = 'in_picking';
                
                -- Log the transition
                IF FOUND THEN
                    INSERT INTO process_state_audit_log (
                        entity_type, entity_id, old_status, new_status, 
                        transition_reason, triggered_by
                    ) VALUES (
                        'order', v_order_id, 'in_picking', 'picked',
                        'Auto-updated: All picklist items picked (picklist ' || NEW.picklist_code || ')',
                        'trigger'
                    );
                END IF;
            END IF;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trg_auto_update_order_on_picklist_complete ON picklists;
CREATE TRIGGER trg_auto_update_order_on_picklist_complete
    AFTER UPDATE OF status ON picklists
    FOR EACH ROW
    EXECUTE FUNCTION auto_update_order_status_on_picklist_complete();

-- ============================================================================
-- STEP 8: Create function to auto-update order status when loadlist loads
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_update_order_status_on_loadlist_loaded()
RETURNS TRIGGER AS $$
DECLARE
    v_order_id BIGINT;
BEGIN
    -- Only process when loadlist status changes to 'loaded'
    IF NEW.status = 'loaded' AND (OLD.status IS NULL OR OLD.status != 'loaded') THEN
        -- Update all orders in this loadlist
        FOR v_order_id IN 
            SELECT DISTINCT order_id 
            FROM loadlist_items 
            WHERE loadlist_id = NEW.id
        LOOP
            UPDATE wms_orders
            SET status = 'loaded',
                updated_at = CURRENT_TIMESTAMP
            WHERE order_id = v_order_id
            AND status = 'picked';
            
            -- Log the transition
            IF FOUND THEN
                INSERT INTO process_state_audit_log (
                    entity_type, entity_id, old_status, new_status, 
                    transition_reason, triggered_by
                ) VALUES (
                    'order', v_order_id, 'picked', 'loaded',
                    'Auto-updated: Loadlist loaded (' || NEW.loadlist_code || ')',
                    'trigger'
                );
            END IF;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trg_auto_update_order_on_loadlist_loaded ON loadlists;
CREATE TRIGGER trg_auto_update_order_on_loadlist_loaded
    AFTER UPDATE OF status ON loadlists
    FOR EACH ROW
    EXECUTE FUNCTION auto_update_order_status_on_loadlist_loaded();

-- ============================================================================
-- STEP 9: Create helper function to get allowed transitions
-- ============================================================================

CREATE OR REPLACE FUNCTION get_allowed_order_transitions(p_current_status VARCHAR)
RETURNS VARCHAR[] AS $$
BEGIN
    RETURN CASE p_current_status
        WHEN 'draft' THEN ARRAY['confirmed', 'cancelled']
        WHEN 'confirmed' THEN ARRAY['in_picking', 'cancelled']
        WHEN 'in_picking' THEN ARRAY['picked', 'confirmed', 'cancelled']
        WHEN 'picked' THEN ARRAY['loaded', 'in_picking', 'cancelled']
        WHEN 'loaded' THEN ARRAY['in_transit', 'picked', 'cancelled']
        WHEN 'in_transit' THEN ARRAY['delivered', 'loaded']
        WHEN 'delivered' THEN ARRAY[]::VARCHAR[]
        WHEN 'cancelled' THEN ARRAY[]::VARCHAR[]
        ELSE ARRAY[]::VARCHAR[]
    END;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_allowed_picklist_transitions(p_current_status VARCHAR)
RETURNS VARCHAR[] AS $$
BEGIN
    RETURN CASE p_current_status
        WHEN 'pending' THEN ARRAY['assigned', 'picking', 'cancelled']
        WHEN 'assigned' THEN ARRAY['picking', 'pending', 'cancelled']
        WHEN 'picking' THEN ARRAY['completed', 'assigned', 'cancelled']
        WHEN 'completed' THEN ARRAY['voided']
        WHEN 'cancelled' THEN ARRAY[]::VARCHAR[]
        WHEN 'voided' THEN ARRAY[]::VARCHAR[]
        ELSE ARRAY[]::VARCHAR[]
    END;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 10: Summary of changes
-- ============================================================================

DO $$
DECLARE
    v_orders_fixed INTEGER;
    v_bfs_fixed INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_orders_fixed 
    FROM process_state_audit_log 
    WHERE entity_type = 'order' 
    AND triggered_by = 'migration'
    AND transition_reason LIKE '%Migration 179%';
    
    SELECT COUNT(*) INTO v_bfs_fixed 
    FROM process_state_audit_log 
    WHERE entity_type = 'bonus_face_sheet' 
    AND triggered_by = 'migration'
    AND transition_reason LIKE '%Migration 179%';
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'PROCESS CONSISTENCY FIX SUMMARY';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Orders reset from in_picking: %', v_orders_fixed;
    RAISE NOTICE 'Bonus face sheets fixed: %', v_bfs_fixed;
    RAISE NOTICE 'State machine triggers created (disabled)';
    RAISE NOTICE 'Auto-update triggers created (enabled)';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'To enable state machine validation:';
    RAISE NOTICE 'ALTER TABLE wms_orders ENABLE TRIGGER trg_validate_order_status;';
    RAISE NOTICE 'ALTER TABLE picklists ENABLE TRIGGER trg_validate_picklist_status;';
    RAISE NOTICE 'ALTER TABLE loadlists ENABLE TRIGGER trg_validate_loadlist_status;';
    RAISE NOTICE '========================================';
END $$;
