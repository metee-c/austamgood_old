-- ============================================================================
-- Migration 051: Complete Database Schema Updates (Simplified)
-- Created: 2025-11-29
-- Purpose: Add monitoring and alerts without breaking existing views
-- Dependencies: Requires migrations 048, 049, 050 to be run first
-- ============================================================================

-- ============================================================================
-- 1. STOCK REPLENISHMENT ALERTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS stock_replenishment_alerts (
    alert_id BIGSERIAL PRIMARY KEY,
    alert_type VARCHAR(50) NOT NULL DEFAULT 'insufficient_stock',
    warehouse_id VARCHAR(50) NOT NULL,
    location_id VARCHAR(50),
    sku_id VARCHAR(100) NOT NULL,
    required_qty NUMERIC(18,6) NOT NULL,
    current_qty NUMERIC(18,6) NOT NULL,
    shortage_qty NUMERIC(18,6) NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'medium',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    reference_no VARCHAR(100),
    reference_doc_type VARCHAR(50),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id),
    resolution_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_alerts_status ON stock_replenishment_alerts(status);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_priority ON stock_replenishment_alerts(priority);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_sku ON stock_replenishment_alerts(sku_id);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_location ON stock_replenishment_alerts(location_id);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_created ON stock_replenishment_alerts(created_at DESC);

CREATE OR REPLACE FUNCTION update_stock_alert_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_stock_alert_timestamp ON stock_replenishment_alerts;
CREATE TRIGGER trigger_update_stock_alert_timestamp
    BEFORE UPDATE ON stock_replenishment_alerts
    FOR EACH ROW
    EXECUTE FUNCTION update_stock_alert_timestamp();

COMMENT ON TABLE stock_replenishment_alerts IS 'Tracks insufficient stock alerts during loading/picking operations';

-- ============================================================================
-- 2. ADD COLUMNS TO picklist_item_reservations
-- ============================================================================
ALTER TABLE picklist_item_reservations
    ADD COLUMN IF NOT EXISTS reserved_by UUID REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS picked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE OR REPLACE FUNCTION update_reservation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_reservation_timestamp ON picklist_item_reservations;
CREATE TRIGGER trigger_update_reservation_timestamp
    BEFORE UPDATE ON picklist_item_reservations
    FOR EACH ROW
    EXECUTE FUNCTION update_reservation_timestamp();

CREATE INDEX IF NOT EXISTS idx_picklist_reservations_status ON picklist_item_reservations(status);
CREATE INDEX IF NOT EXISTS idx_picklist_reservations_balance ON picklist_item_reservations(balance_id);

-- ============================================================================
-- 3. ADD PERFORMANCE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_balances_fefo_fifo
    ON wms_inventory_balances(warehouse_id, location_id, sku_id, expiry_date ASC NULLS LAST, production_date ASC NULLS LAST, created_at ASC)
    WHERE reserved_piece_qty > 0;

CREATE INDEX IF NOT EXISTS idx_picklists_status ON picklists(status);
CREATE INDEX IF NOT EXISTS idx_picklists_trip ON picklists(trip_id) WHERE trip_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_picklist_items_status ON picklist_items(status);
CREATE INDEX IF NOT EXISTS idx_picklist_items_source_location ON picklist_items(source_location_id);
CREATE INDEX IF NOT EXISTS idx_loadlists_status ON loadlists(status);
CREATE INDEX IF NOT EXISTS idx_loadlist_picklists_loadlist ON wms_loadlist_picklists(loadlist_id);
CREATE INDEX IF NOT EXISTS idx_loadlist_picklists_picklist ON wms_loadlist_picklists(picklist_id);
CREATE INDEX IF NOT EXISTS idx_route_plans_status ON receiving_route_plans(status);
CREATE INDEX IF NOT EXISTS idx_route_plans_published
    ON receiving_route_plans(status, created_at DESC)
    WHERE status IN ('published', 'ready_to_load', 'in_transit');
CREATE INDEX IF NOT EXISTS idx_orders_status ON wms_orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_matched_trip ON wms_orders(matched_trip_id) WHERE matched_trip_id IS NOT NULL;

-- ============================================================================
-- 4. ADD MONITORING VIEWS
-- ============================================================================

CREATE OR REPLACE VIEW v_reservation_accuracy AS
SELECT
    pi.picklist_id,
    pi.id AS picklist_item_id,
    pi.sku_id,
    pi.quantity_to_pick,
    COALESCE(SUM(r.reserved_piece_qty), 0) AS total_reserved,
    pi.quantity_to_pick - COALESCE(SUM(r.reserved_piece_qty), 0) AS reservation_variance,
    COUNT(r.reservation_id) AS reservation_count,
    CASE
        WHEN ABS(pi.quantity_to_pick - COALESCE(SUM(r.reserved_piece_qty), 0)) < 0.01 THEN 'accurate'
        ELSE 'mismatch'
    END AS accuracy_status
FROM picklist_items pi
LEFT JOIN picklist_item_reservations r ON pi.id = r.picklist_item_id
GROUP BY pi.picklist_id, pi.id, pi.sku_id, pi.quantity_to_pick;

CREATE OR REPLACE VIEW v_workflow_status_overview AS
SELECT
    rp.plan_id AS route_plan_id,
    rp.plan_code,
    rp.status AS route_status,
    COUNT(DISTINCT p.id) AS total_picklists,
    COUNT(DISTINCT CASE WHEN p.status = 'completed' THEN p.id END) AS completed_picklists,
    COUNT(DISTINCT l.id) AS total_loadlists,
    COUNT(DISTINCT CASE WHEN l.status = 'loaded' THEN l.id END) AS loaded_loadlists,
    COUNT(DISTINCT rpi.order_id) AS total_orders,
    COUNT(DISTINCT CASE WHEN o.status = 'delivered' THEN rpi.order_id END) AS delivered_orders
FROM receiving_route_plans rp
LEFT JOIN picklists p ON p.plan_id = rp.plan_id
LEFT JOIN wms_loadlist_picklists lp ON lp.picklist_id = p.id
LEFT JOIN loadlists l ON l.id = lp.loadlist_id
LEFT JOIN receiving_route_plan_inputs rpi ON rpi.plan_id = rp.plan_id
LEFT JOIN wms_orders o ON o.order_id = rpi.order_id
WHERE rp.status NOT IN ('draft', 'cancelled')
GROUP BY rp.plan_id, rp.plan_code, rp.status;

CREATE OR REPLACE VIEW v_stock_alert_summary AS
SELECT
    location_id,
    sku_id,
    COUNT(*) AS alert_count,
    SUM(shortage_qty) AS total_shortage,
    MAX(created_at) AS last_alert_at,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending_count,
    COUNT(CASE WHEN priority = 'urgent' THEN 1 END) AS urgent_count
FROM stock_replenishment_alerts
WHERE status IN ('pending', 'acknowledged')
GROUP BY location_id, sku_id
HAVING COUNT(CASE WHEN status = 'pending' THEN 1 END) > 0;

-- ============================================================================
-- 5. GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON stock_replenishment_alerts TO authenticated;
GRANT SELECT ON v_reservation_accuracy TO authenticated;
GRANT SELECT ON v_workflow_status_overview TO authenticated;
GRANT SELECT ON v_stock_alert_summary TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'picklist_item_reservations') THEN
        RAISE EXCEPTION 'Migration 048 must be run first';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_picklist_assign_update_orders') THEN
        RAISE EXCEPTION 'Migration 050 must be run first';
    END IF;

    RAISE NOTICE '✅ Migration 051 completed successfully';
    RAISE NOTICE '✅ Added stock_replenishment_alerts table';
    RAISE NOTICE '✅ Enhanced picklist_item_reservations with metadata';
    RAISE NOTICE '✅ Added 11 performance indexes';
    RAISE NOTICE '✅ Created 3 monitoring views';
    RAISE NOTICE '⚠️  Note: NUMERIC precision upgrade skipped (blocked by views)';
END $$;
