-- Migration: Create stock replenishment alerts system
-- Description: Creates alerts table and view for tracking stock shortages in picking areas
-- This supports the picklist stock reservation system by alerting when stock needs replenishment

-- Create alert status enum
DO $$ BEGIN
    CREATE TYPE public.stock_alert_status_enum AS ENUM (
        'pending',      -- แจ้งเตือนใหม่ ยังไม่ดำเนินการ
        'in_progress',  -- กำลังดำเนินการเติมสต็อก
        'completed',    -- เติมสต็อกเสร็จแล้ว
        'cancelled'     -- ยกเลิกการแจ้งเตือน
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

COMMENT ON TYPE public.stock_alert_status_enum IS 'สถานะของการแจ้งเตือนการเติมสต็อก';

-- Create stock replenishment alerts table
CREATE TABLE IF NOT EXISTS public.wms_stock_replenishment_alerts (
    alert_id uuid DEFAULT gen_random_uuid() NOT NULL,
    warehouse_id varchar(50) NOT NULL,
    sku_id varchar(50) NOT NULL,
    pick_location_id varchar(50) NOT NULL,  -- โลเคชั่นที่ต้องการเติม (source_location_id จาก picklist)

    -- Stock information
    required_qty numeric(18,2) NOT NULL,      -- ปริมาณที่ต้องการรวม (reserved + min)
    current_qty numeric(18,2) NOT NULL,       -- ปริมาณปัจจุบันที่โลเคชั่น
    shortage_qty numeric(18,2) NOT NULL,      -- ปริมาณที่ขาด
    pallets_needed integer NOT NULL,          -- จำนวนพาเลทที่ต้องการ (คำนวณจาก master_sku.qty_per_pallet)

    -- Replenishment rules
    min_stock_qty numeric(18,2),              -- จากตาราง replenishment_rules
    max_stock_qty numeric(18,2),              -- จากตาราง replenishment_rules
    replen_qty numeric(18,2),                 -- ปริมาณที่ควรเติม

    -- Source recommendations (FEFO search results)
    suggested_sources jsonb,                  -- แนะนำแหล่งที่มาของสต็อก (location_id, available_qty, expiry_date, pallet_count)

    -- Alert metadata
    alert_reason text,                        -- เหตุผลที่แจ้งเตือน (e.g., "Insufficient for picklist reservation")
    picklist_id bigint,                       -- ใบหยิบที่ทำให้เกิดการแจ้งเตือน (optional)
    priority integer DEFAULT 5,               -- ลำดับความสำคัญ 1-10 (10 = สูงสุด)
    status stock_alert_status_enum DEFAULT 'pending' NOT NULL,

    -- Audit fields
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by varchar(100),
    resolved_at timestamp without time zone,
    resolved_by varchar(100),
    notes text,

    CONSTRAINT wms_stock_replenishment_alerts_pkey PRIMARY KEY (alert_id),
    CONSTRAINT wms_stock_replenishment_alerts_shortage_check CHECK (shortage_qty > 0),
    CONSTRAINT wms_stock_replenishment_alerts_pallets_check CHECK (pallets_needed > 0)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_stock_alerts_status
    ON public.wms_stock_replenishment_alerts(status)
    WHERE status IN ('pending', 'in_progress');

CREATE INDEX IF NOT EXISTS idx_stock_alerts_warehouse_sku
    ON public.wms_stock_replenishment_alerts(warehouse_id, sku_id);

CREATE INDEX IF NOT EXISTS idx_stock_alerts_pick_location
    ON public.wms_stock_replenishment_alerts(pick_location_id);

CREATE INDEX IF NOT EXISTS idx_stock_alerts_created_at
    ON public.wms_stock_replenishment_alerts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_alerts_priority
    ON public.wms_stock_replenishment_alerts(priority DESC, created_at DESC)
    WHERE status = 'pending';

-- Add foreign keys
ALTER TABLE public.wms_stock_replenishment_alerts
    ADD CONSTRAINT fk_stock_alerts_warehouse
    FOREIGN KEY (warehouse_id)
    REFERENCES public.master_warehouse(warehouse_id)
    ON DELETE CASCADE;

ALTER TABLE public.wms_stock_replenishment_alerts
    ADD CONSTRAINT fk_stock_alerts_sku
    FOREIGN KEY (sku_id)
    REFERENCES public.master_sku(sku_id)
    ON DELETE CASCADE;

ALTER TABLE public.wms_stock_replenishment_alerts
    ADD CONSTRAINT fk_stock_alerts_location
    FOREIGN KEY (pick_location_id)
    REFERENCES public.master_location(location_id)
    ON DELETE CASCADE;

ALTER TABLE public.wms_stock_replenishment_alerts
    ADD CONSTRAINT fk_stock_alerts_picklist
    FOREIGN KEY (picklist_id)
    REFERENCES public.picklists(id)
    ON DELETE SET NULL;

-- Add comments
COMMENT ON TABLE public.wms_stock_replenishment_alerts IS 'ตารางแจ้งเตือนการเติมสต็อกในพื้นที่หยิบสินค้า';
COMMENT ON COLUMN public.wms_stock_replenishment_alerts.alert_id IS 'รหัสการแจ้งเตือน (UUID)';
COMMENT ON COLUMN public.wms_stock_replenishment_alerts.pick_location_id IS 'โลเคชั่นที่ต้องการเติมสต็อก (source_location_id from picklist)';
COMMENT ON COLUMN public.wms_stock_replenishment_alerts.required_qty IS 'ปริมาณที่ต้องการรวม (reserved + min threshold)';
COMMENT ON COLUMN public.wms_stock_replenishment_alerts.shortage_qty IS 'ปริมาณที่ขาด (required - current)';
COMMENT ON COLUMN public.wms_stock_replenishment_alerts.pallets_needed IS 'จำนวนพาเลทที่ต้องการ (คำนวณจาก qty_per_pallet)';
COMMENT ON COLUMN public.wms_stock_replenishment_alerts.suggested_sources IS 'แนะนำแหล่งที่มาของสต็อก (FEFO order) ในรูปแบบ JSON';
COMMENT ON COLUMN public.wms_stock_replenishment_alerts.priority IS 'ลำดับความสำคัญ 1-10 (10 = urgent)';

-- Create view for active alerts with full details
CREATE OR REPLACE VIEW public.vw_active_stock_alerts AS
SELECT
    a.alert_id,
    a.warehouse_id,
    w.warehouse_name,
    a.sku_id,
    s.sku_name,
    s.sku_id AS sku_code,  -- ใช้ sku_id แทน sku_code
    s.uom_base,
    s.qty_per_pallet,
    a.pick_location_id,
    l.location_code AS pick_location_code,
    l.location_name AS pick_location_name,
    a.required_qty,
    a.current_qty,
    a.shortage_qty,
    a.pallets_needed,
    a.min_stock_qty,
    a.max_stock_qty,
    a.replen_qty,
    a.suggested_sources,
    a.alert_reason,
    a.picklist_id,
    p.picklist_code,
    a.priority,
    a.status,
    a.created_at,
    a.created_by,
    a.notes,
    -- แสดงเวลาที่ผ่านไป
    EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - a.created_at))/3600 AS hours_since_alert
FROM public.wms_stock_replenishment_alerts a
LEFT JOIN public.master_warehouse w ON a.warehouse_id = w.warehouse_id
LEFT JOIN public.master_sku s ON a.sku_id = s.sku_id
LEFT JOIN public.master_location l ON a.pick_location_id = l.location_id
LEFT JOIN public.picklists p ON a.picklist_id = p.id
WHERE a.status IN ('pending', 'in_progress')
ORDER BY a.priority DESC, a.created_at ASC;

COMMENT ON VIEW public.vw_active_stock_alerts IS 'วิวแสดงการแจ้งเตือนที่ยังไม่เสร็จ พร้อมข้อมูลเต็มสำหรับหน้า /mobile/transfer';

-- Create function to automatically check and create alerts when stock is insufficient
CREATE OR REPLACE FUNCTION check_and_create_replenishment_alert(
    p_warehouse_id varchar(50),
    p_sku_id varchar(50),
    p_pick_location_id varchar(50),
    p_required_qty numeric(18,2),
    p_picklist_id bigint DEFAULT NULL,
    p_created_by varchar(100) DEFAULT NULL
)
RETURNS TABLE(
    alert_created boolean,
    alert_id uuid,
    shortage_qty numeric,
    message text
) AS $$
DECLARE
    v_current_qty numeric(18,2);
    v_shortage_qty numeric(18,2);
    v_min_stock numeric(18,2);
    v_max_stock numeric(18,2);
    v_replen_qty numeric(18,2);
    v_qty_per_pallet numeric(18,2);
    v_pallets_needed integer;
    v_suggested_sources jsonb;
    v_alert_id uuid;
    v_target_qty numeric(18,2);
BEGIN
    -- 1. Get current stock at pick location
    SELECT COALESCE(SUM(total_piece_qty), 0)
    INTO v_current_qty
    FROM wms_inventory_balances
    WHERE warehouse_id = p_warehouse_id
      AND location_id = p_pick_location_id
      AND sku_id = p_sku_id;

    -- 2. Get replenishment rules (min/max)
    SELECT min_stock_qty, max_stock_qty, replen_qty
    INTO v_min_stock, v_max_stock, v_replen_qty
    FROM replenishment_rules
    WHERE warehouse_id = p_warehouse_id
      AND sku_id = p_sku_id
      AND pick_zone_id = (SELECT zone_id FROM master_location WHERE location_id = p_pick_location_id)
      AND status = 'active'
    LIMIT 1;

    -- 3. Calculate target quantity (should be at least required + min)
    v_target_qty := GREATEST(p_required_qty, COALESCE(v_min_stock, 0));

    -- 4. Check if current stock is insufficient
    IF v_current_qty < v_target_qty THEN
        v_shortage_qty := v_target_qty - v_current_qty;

        -- 5. Get qty_per_pallet from master_sku
        SELECT COALESCE(qty_per_pallet, 1)
        INTO v_qty_per_pallet
        FROM master_sku
        WHERE sku_id = p_sku_id;

        -- 6. Calculate pallets needed
        v_pallets_needed := CEIL(v_shortage_qty / v_qty_per_pallet)::integer;

        -- 7. Find suggested sources using FEFO across warehouse
        SELECT jsonb_agg(
            jsonb_build_object(
                'location_id', ib.location_id,
                'location_code', ml.location_code,
                'available_qty', ib.total_piece_qty - ib.reserved_piece_qty,
                'expiry_date', ib.expiry_date,
                'production_date', ib.production_date,
                'pallet_id', ib.pallet_id
            ) ORDER BY
                ib.expiry_date ASC NULLS LAST,
                ib.production_date ASC NULLS LAST,
                ib.created_at ASC
        )
        INTO v_suggested_sources
        FROM wms_inventory_balances ib
        LEFT JOIN master_location ml ON ib.location_id = ml.location_id
        WHERE ib.warehouse_id = p_warehouse_id
          AND ib.sku_id = p_sku_id
          AND ib.location_id != p_pick_location_id  -- ไม่รวมโลเคชั่นปลายทาง
          AND (ib.total_piece_qty - ib.reserved_piece_qty) > 0
        LIMIT 10;

        -- 8. Create alert
        INSERT INTO wms_stock_replenishment_alerts (
            warehouse_id,
            sku_id,
            pick_location_id,
            required_qty,
            current_qty,
            shortage_qty,
            pallets_needed,
            min_stock_qty,
            max_stock_qty,
            replen_qty,
            suggested_sources,
            alert_reason,
            picklist_id,
            priority,
            status,
            created_by
        ) VALUES (
            p_warehouse_id,
            p_sku_id,
            p_pick_location_id,
            v_target_qty,
            v_current_qty,
            v_shortage_qty,
            v_pallets_needed,
            v_min_stock,
            v_max_stock,
            COALESCE(v_replen_qty, v_shortage_qty),
            v_suggested_sources,
            CASE
                WHEN p_picklist_id IS NOT NULL THEN 'Insufficient stock for picklist reservation'
                ELSE 'Stock below minimum threshold'
            END,
            p_picklist_id,
            CASE
                WHEN p_picklist_id IS NOT NULL THEN 8  -- High priority for picklist
                WHEN v_current_qty <= 0 THEN 10        -- Urgent: no stock
                WHEN v_min_stock IS NOT NULL AND v_current_qty < v_min_stock THEN 7
                ELSE 5
            END,
            'pending',
            p_created_by
        )
        RETURNING wms_stock_replenishment_alerts.alert_id INTO v_alert_id;

        -- Return success
        RETURN QUERY SELECT
            true AS alert_created,
            v_alert_id AS alert_id,
            v_shortage_qty AS shortage_qty,
            format('Alert created: Need %s pieces (%s pallets)', v_shortage_qty, v_pallets_needed) AS message;
    ELSE
        -- No alert needed
        RETURN QUERY SELECT
            false AS alert_created,
            NULL::uuid AS alert_id,
            0::numeric AS shortage_qty,
            'Stock is sufficient' AS message;
    END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_and_create_replenishment_alert IS 'ตรวจสอบและสร้างการแจ้งเตือนเมื่อสต็อกไม่เพียงพอ (ใช้ FEFO ค้นหาแหล่งเติม)';
