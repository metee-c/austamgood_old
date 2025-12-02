


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."assignment_type_enum" AS ENUM (
    'individual',
    'role',
    'mixed'
);


ALTER TYPE "public"."assignment_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."delivery_type_enum" AS ENUM (
    'normal',
    'express',
    'ems',
    'kerry',
    'flash_express',
    'j_and_t',
    'dhl',
    'other'
);


ALTER TYPE "public"."delivery_type_enum" OWNER TO "postgres";


COMMENT ON TYPE "public"."delivery_type_enum" IS 'ประเภทการจัดส่ง (normal, express, ems, kerry, flash_express, j_and_t, dhl, other)';



CREATE TYPE "public"."employment_type_enum" AS ENUM (
    'permanent',
    'contract',
    'part-time',
    'temporary'
);


ALTER TYPE "public"."employment_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."gender_enum" AS ENUM (
    'male',
    'female',
    'other'
);


ALTER TYPE "public"."gender_enum" OWNER TO "postgres";


CREATE TYPE "public"."inventory_movement_type" AS ENUM (
    'inbound',
    'outbound',
    'transfer',
    'adjustment',
    'picking',
    'putaway',
    'cycle_count',
    'damage',
    'expired'
);


ALTER TYPE "public"."inventory_movement_type" OWNER TO "postgres";


CREATE TYPE "public"."inventory_transaction_status" AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'cancelled'
);


ALTER TYPE "public"."inventory_transaction_status" OWNER TO "postgres";


CREATE TYPE "public"."load_list_status_enum" AS ENUM (
    'draft',
    'pending',
    'loading',
    'completed',
    'cancelled'
);


ALTER TYPE "public"."load_list_status_enum" OWNER TO "postgres";


COMMENT ON TYPE "public"."load_list_status_enum" IS 'สถานะของใบโหลดสินค้า';



CREATE TYPE "public"."loadlist_status_enum" AS ENUM (
    'pending',
    'loaded',
    'cancelled'
);


ALTER TYPE "public"."loadlist_status_enum" OWNER TO "postgres";


COMMENT ON TYPE "public"."loadlist_status_enum" IS 'Loadlist status: pending (รอโหลด), loaded (โหลดเสร็จ), cancelled (ยกเลิก)';



CREATE TYPE "public"."location_status_enum" AS ENUM (
    'active',
    'inactive',
    'maintenance',
    'blocked'
);


ALTER TYPE "public"."location_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."location_type_enum" AS ENUM (
    'receiving',
    'storage',
    'apf_zone',
    'pf_zone',
    'shipping',
    'staging',
    'damage',
    'qc_hold',
    'returns'
);


ALTER TYPE "public"."location_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."material_issue_status" AS ENUM (
    'issued',
    'returned',
    'partially_returned',
    'fully_returned',
    'cancelled'
);


ALTER TYPE "public"."material_issue_status" OWNER TO "postgres";


CREATE TYPE "public"."material_requirement_status" AS ENUM (
    'needed',
    'ordered',
    'received',
    'issued',
    'cancelled'
);


ALTER TYPE "public"."material_requirement_status" OWNER TO "postgres";


CREATE TYPE "public"."move_created_source_enum" AS ENUM (
    'system',
    'manual'
);


ALTER TYPE "public"."move_created_source_enum" OWNER TO "postgres";


COMMENT ON TYPE "public"."move_created_source_enum" IS 'แหล่งที่มาของการสร้างใบงานย้าย (System = สร้างไว้ล่วงหน้า, Manual = ย้ายโดยตรงจาก Mobile)';



CREATE TYPE "public"."move_item_status_enum" AS ENUM (
    'pending',
    'assigned',
    'in_progress',
    'completed',
    'cancelled'
);


ALTER TYPE "public"."move_item_status_enum" OWNER TO "postgres";


COMMENT ON TYPE "public"."move_item_status_enum" IS 'สถานะของรายการย่อยสำหรับการย้ายสินค้า';



CREATE TYPE "public"."move_method_enum" AS ENUM (
    'pallet',
    'sku'
);


ALTER TYPE "public"."move_method_enum" OWNER TO "postgres";


COMMENT ON TYPE "public"."move_method_enum" IS 'รูปแบบการย้ายสินค้า (ย้ายทั้งพาเลท หรือย้ายตาม SKU)';



CREATE TYPE "public"."move_status_enum" AS ENUM (
    'draft',
    'pending',
    'in_progress',
    'completed',
    'cancelled'
);


ALTER TYPE "public"."move_status_enum" OWNER TO "postgres";


COMMENT ON TYPE "public"."move_status_enum" IS 'สถานะของใบงานย้ายสินค้า';



CREATE TYPE "public"."move_type_enum" AS ENUM (
    'putaway',
    'transfer',
    'replenishment',
    'adjustment'
);


ALTER TYPE "public"."move_type_enum" OWNER TO "postgres";


COMMENT ON TYPE "public"."move_type_enum" IS 'ประเภทของงานย้ายสินค้า (Putaway/Transfer/Replenishment/Adjustment)';



CREATE TYPE "public"."movement_direction_enum" AS ENUM (
    'in',
    'out'
);


ALTER TYPE "public"."movement_direction_enum" OWNER TO "postgres";


COMMENT ON TYPE "public"."movement_direction_enum" IS 'ทิศทางการเคลื่อนไหวของสต็อก (เข้า/ออก)';



CREATE TYPE "public"."movement_type_enum" AS ENUM (
    'receive',
    'putaway',
    'pick',
    'replenish',
    'move',
    'cycle_count',
    'adjustment',
    'damage',
    'ship'
);


ALTER TYPE "public"."movement_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."order_status_enum" AS ENUM (
    'draft',
    'confirmed',
    'in_picking',
    'picked',
    'loaded',
    'in_transit',
    'delivered',
    'cancelled'
);


ALTER TYPE "public"."order_status_enum" OWNER TO "postgres";


COMMENT ON TYPE "public"."order_status_enum" IS 'สถานะของ Order (draft→confirmed→in_picking→picked→loaded→in_transit→delivered)';



CREATE TYPE "public"."order_type_enum" AS ENUM (
    'route_planning',
    'express',
    'blank',
    'special'
);


ALTER TYPE "public"."order_type_enum" OWNER TO "postgres";


COMMENT ON TYPE "public"."order_type_enum" IS 'ประเภทออเดอร์: route_planning (ต้องจัดสาย), express (ส่งด่วน), special (สินค้าพิเศษ/แถม)';



CREATE TYPE "public"."pallet_scan_status_enum" AS ENUM (
    'ไม่จำเป็น',
    'สแกนแล้ว',
    'รอดำเนินการ'
);


ALTER TYPE "public"."pallet_scan_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."payment_type_enum" AS ENUM (
    'credit',
    'cash'
);


ALTER TYPE "public"."payment_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."pick_status_enum" AS ENUM (
    'pending',
    'partial',
    'completed',
    'short',
    'cancelled'
);


ALTER TYPE "public"."pick_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."picklist_item_status_enum" AS ENUM (
    'pending',
    'picked',
    'shortage',
    'substituted'
);


ALTER TYPE "public"."picklist_item_status_enum" OWNER TO "postgres";


COMMENT ON TYPE "public"."picklist_item_status_enum" IS 'สถานะของรายการสินค้าในใบจัดเก็บ (pending, picked, shortage, substituted)';



CREATE TYPE "public"."picklist_status_enum" AS ENUM (
    'pending',
    'assigned',
    'picking',
    'completed',
    'cancelled'
);


ALTER TYPE "public"."picklist_status_enum" OWNER TO "postgres";


COMMENT ON TYPE "public"."picklist_status_enum" IS 'สถานะของ Picklist (pending→picking→completed)';



CREATE TYPE "public"."prefix_enum" AS ENUM (
    'Mr',
    'Mrs',
    'Ms',
    'อื่นๆ'
);


ALTER TYPE "public"."prefix_enum" OWNER TO "postgres";


CREATE TYPE "public"."preparation_item_status_enum" AS ENUM (
    'pending',
    'assigned',
    'picking',
    'picked',
    'cancelled'
);


ALTER TYPE "public"."preparation_item_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."preparation_order_status_enum" AS ENUM (
    'draft',
    'pending',
    'in_progress',
    'completed',
    'cancelled'
);


ALTER TYPE "public"."preparation_order_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."preparation_priority_enum" AS ENUM (
    'normal',
    'urgent',
    'high'
);


ALTER TYPE "public"."preparation_priority_enum" OWNER TO "postgres";


CREATE TYPE "public"."product_status_enum" AS ENUM (
    'ปกติ',
    'ชำรุด',
    'หมดอายุ',
    'คืนสินค้า'
);


ALTER TYPE "public"."product_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."production_item_status" AS ENUM (
    'pending',
    'issued',
    'returned'
);


ALTER TYPE "public"."production_item_status" OWNER TO "postgres";


CREATE TYPE "public"."production_order_status" AS ENUM (
    'planned',
    'released',
    'in_progress',
    'completed',
    'on_hold',
    'cancelled'
);


ALTER TYPE "public"."production_order_status" OWNER TO "postgres";


CREATE TYPE "public"."production_plan_status" AS ENUM (
    'draft',
    'approved',
    'in_production',
    'completed',
    'cancelled'
);


ALTER TYPE "public"."production_plan_status" OWNER TO "postgres";


CREATE TYPE "public"."receive_status_enum" AS ENUM (
    'ร่าง',
    'ได้รับ',
    'เก็บเข้าคลัง',
    'ปิด',
    'ยกเลิก',
    'รอรับเข้า',
    'รับเข้าแล้ว',
    'กำลังตรวจสอบ',
    'สำเร็จ'
);


ALTER TYPE "public"."receive_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."receive_type_enum" AS ENUM (
    'ปกติ',
    'gen_pallet',
    'no_pallet',
    'foreign_gen_pallet',
    'foreign_scan_pallet',
    'สิ้นเปลือง',
    'ส่งคืน',
    'เสียหาย',
    'การผลิต',
    'รับสินค้าปกติ',
    'รับสินค้าชำรุด',
    'รับสินค้าหมดอายุ',
    'รับสินค้าคืน',
    'รับสินค้าตีกลับ'
);


ALTER TYPE "public"."receive_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."receiving_route_plan_status_enum" AS ENUM (
    'draft',
    'optimizing',
    'published',
    'completed',
    'cancelled',
    'ready_to_load',
    'in_transit',
    'pending_approval',
    'approved'
);


ALTER TYPE "public"."receiving_route_plan_status_enum" OWNER TO "postgres";


COMMENT ON TYPE "public"."receiving_route_plan_status_enum" IS 'สถานะของชุดแผนเส้นทางรับสินค้า (draft/optimizing/published/ready_to_load/in_transit/completed/cancelled)';



CREATE TYPE "public"."receiving_route_stop_status_enum" AS ENUM (
    'pending',
    'en_route',
    'arrived',
    'completed',
    'skipped'
);


ALTER TYPE "public"."receiving_route_stop_status_enum" OWNER TO "postgres";


COMMENT ON TYPE "public"."receiving_route_stop_status_enum" IS 'สถานะของจุดแวะในเส้นทางรับสินค้า (pending/en_route/arrived/completed/skipped)';



CREATE TYPE "public"."receiving_route_stop_type_enum" AS ENUM (
    'start',
    'pickup',
    'dropoff',
    'break',
    'checkpoint',
    'end'
);


ALTER TYPE "public"."receiving_route_stop_type_enum" OWNER TO "postgres";


COMMENT ON TYPE "public"."receiving_route_stop_type_enum" IS 'ประเภทของจุดแวะ เช่น จุดเริ่มต้น จุดรับสินค้า จุดพัก หรือจุดสิ้นสุด';



CREATE TYPE "public"."receiving_route_trip_status_enum" AS ENUM (
    'planned',
    'assigned',
    'in_progress',
    'completed',
    'cancelled'
);


ALTER TYPE "public"."receiving_route_trip_status_enum" OWNER TO "postgres";


COMMENT ON TYPE "public"."receiving_route_trip_status_enum" IS 'สถานะของใบงานเส้นทางรับสินค้า (planned/assigned/in_progress/completed/cancelled)';



CREATE TYPE "public"."replenishment_priority" AS ENUM (
    'low',
    'normal',
    'high',
    'urgent'
);


ALTER TYPE "public"."replenishment_priority" OWNER TO "postgres";


CREATE TYPE "public"."replenishment_queue_status" AS ENUM (
    'pending',
    'assigned',
    'in_progress',
    'completed',
    'cancelled'
);


ALTER TYPE "public"."replenishment_queue_status" OWNER TO "postgres";


CREATE TYPE "public"."replenishment_rule_status" AS ENUM (
    'active',
    'inactive'
);


ALTER TYPE "public"."replenishment_rule_status" OWNER TO "postgres";


CREATE TYPE "public"."shift_type_enum" AS ENUM (
    'day',
    'night',
    'rotating'
);


ALTER TYPE "public"."shift_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."sku_status" AS ENUM (
    'active',
    'inactive'
);


ALTER TYPE "public"."sku_status" OWNER TO "postgres";


CREATE TYPE "public"."stock_alert_status_enum" AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'cancelled'
);


ALTER TYPE "public"."stock_alert_status_enum" OWNER TO "postgres";


COMMENT ON TYPE "public"."stock_alert_status_enum" IS 'สถานะของการแจ้งเตือนการเติมสต็อก';



CREATE TYPE "public"."stock_status_enum" AS ENUM (
    'available',
    'reserved',
    'blocked',
    'damaged',
    'expired',
    'quarantine'
);


ALTER TYPE "public"."stock_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."storage_condition_type_enum" AS ENUM (
    'sku',
    'category',
    'sub_category',
    'brand',
    'product_type',
    'storage_class',
    'abc_class'
);


ALTER TYPE "public"."storage_condition_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."storage_mix_policy_enum" AS ENUM (
    'single_batch',
    'same_expiry',
    'same_lot',
    'allow_mix'
);


ALTER TYPE "public"."storage_mix_policy_enum" OWNER TO "postgres";


CREATE TYPE "public"."storage_rotation_method_enum" AS ENUM (
    'FIFO',
    'LIFO',
    'FEFO',
    'LEFO',
    'custom'
);


ALTER TYPE "public"."storage_rotation_method_enum" OWNER TO "postgres";


CREATE TYPE "public"."storage_scope_type_enum" AS ENUM (
    'all',
    'zone',
    'location_type',
    'aisle',
    'rack',
    'shelf',
    'bin',
    'group',
    'location'
);


ALTER TYPE "public"."storage_scope_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."storage_strategy_status_enum" AS ENUM (
    'draft',
    'active',
    'inactive',
    'archived'
);


ALTER TYPE "public"."storage_strategy_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."task_priority_enum" AS ENUM (
    'low',
    'normal',
    'high',
    'urgent'
);


ALTER TYPE "public"."task_priority_enum" OWNER TO "postgres";


CREATE TYPE "public"."task_priority_level" AS ENUM (
    'urgent',
    'high',
    'medium',
    'low',
    'deferred'
);


ALTER TYPE "public"."task_priority_level" OWNER TO "postgres";


CREATE TYPE "public"."task_status_enum" AS ENUM (
    'pending',
    'assigned',
    'in_progress',
    'completed',
    'cancelled',
    'on_hold'
);


ALTER TYPE "public"."task_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."warehouse_movement_type" AS ENUM (
    'putaway',
    'replenishment',
    'relocation',
    'consolidation',
    'cycle_count',
    'maintenance',
    'quality_check'
);


ALTER TYPE "public"."warehouse_movement_type" OWNER TO "postgres";


CREATE TYPE "public"."warehouse_task_status" AS ENUM (
    'pending',
    'assigned',
    'in_progress',
    'completed',
    'cancelled',
    'on_hold'
);


ALTER TYPE "public"."warehouse_task_status" OWNER TO "postgres";


CREATE TYPE "public"."wms_pallet_mode_enum" AS ENUM (
    'none',
    'manual',
    'auto'
);


ALTER TYPE "public"."wms_pallet_mode_enum" OWNER TO "postgres";


CREATE TYPE "public"."wms_receive_type_enum" AS ENUM (
    'domestic',
    'import',
    'production',
    'return',
    'transfer',
    'adjustment'
);


ALTER TYPE "public"."wms_receive_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."wms_role_enum" AS ENUM (
    'supervisor',
    'operator',
    'picker',
    'driver',
    'forklift',
    'other'
);


ALTER TYPE "public"."wms_role_enum" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_update_order_status_on_issue"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_order_status production_order_status;
BEGIN
  SELECT status INTO v_order_status
  FROM production_orders
  WHERE id = NEW.production_order_id;

  IF v_order_status = 'planned' THEN
    UPDATE production_orders
    SET status = 'in_progress',
        actual_start_date = COALESCE(actual_start_date, CURRENT_DATE),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.production_order_id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_update_order_status_on_issue"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."auto_update_order_status_on_issue"() IS 'อัปเดตสถานะ production_order เป็น in_progress เมื่อเบิกวัตถุดิบ';



CREATE OR REPLACE FUNCTION "public"."calculate_material_requirements"("p_plan_id" "uuid") RETURNS TABLE("material_sku_id" character varying, "finished_sku_id" character varying, "gross_requirement" numeric, "current_stock" numeric, "shortage_qty" numeric)
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    bom.material_sku_id,
    bom.finished_sku_id,
    SUM(ppi.required_qty * bom.material_qty * (1 + COALESCE(bom.waste_qty, 0) / 100))::DECIMAL(18,2) AS gross_requirement,
    COALESCE(
      (SELECT SUM(ib.total_piece_qty - ib.reserved_piece_qty)
       FROM wms_inventory_balances ib
       WHERE ib.sku_id = bom.material_sku_id), 0
    )::DECIMAL(18,2) AS current_stock,
    GREATEST(
      SUM(ppi.required_qty * bom.material_qty * (1 + COALESCE(bom.waste_qty, 0) / 100)) -
      COALESCE(
        (SELECT SUM(ib.total_piece_qty - ib.reserved_piece_qty)
         FROM wms_inventory_balances ib
         WHERE ib.sku_id = bom.material_sku_id), 0
      ), 0
    )::DECIMAL(18,2) AS shortage_qty
  FROM production_plan_items ppi
  INNER JOIN bom_sku bom ON ppi.sku_id = bom.finished_sku_id
  WHERE ppi.plan_id = p_plan_id
    AND bom.status = 'active'
  GROUP BY
    bom.material_sku_id,
    bom.finished_sku_id;
END;
$$;


ALTER FUNCTION "public"."calculate_material_requirements"("p_plan_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."calculate_material_requirements"("p_plan_id" "uuid") IS 'คำนวณความต้องการวัตถุดิบจาก BOM explosion';



CREATE OR REPLACE FUNCTION "public"."calculate_shipping_cost_formula"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_other_fees_total NUMERIC := 0;
    v_fee JSONB;
BEGIN
    -- คำนวณยอดรวมจาก other_fees
    IF NEW.other_fees IS NOT NULL AND jsonb_array_length(NEW.other_fees) > 0 THEN
        FOR v_fee IN SELECT jsonb_array_elements(NEW.other_fees)
        LOOP
            v_other_fees_total := v_other_fees_total + COALESCE((v_fee->>'amount')::numeric, 0);
        END LOOP;
    END IF;

    -- คำนวณ shipping_cost ตามโหมด
    IF NEW.pricing_mode = 'formula' THEN
        -- Formula mode: base_price + helper_fee + (extra_stops × extra_stop_fee) + porterage_fee + other_fees
        NEW.shipping_cost := COALESCE(NEW.base_price, 0)
                           + COALESCE(NEW.helper_fee, 0)
                           + (COALESCE(NEW.extra_stops_count, 0) * COALESCE(NEW.extra_stop_fee, 0))
                           + COALESCE(NEW.porterage_fee, 0)
                           + v_other_fees_total;
    ELSIF NEW.pricing_mode = 'flat' THEN
        -- Flat mode: ใช้ shipping_cost ที่ผู้ใช้ใส่เข้ามา แต่ยังบวก porterage_fee และ other_fees ได้
        -- (ไม่แก้ไข shipping_cost ใน flat mode - ให้ผู้ใช้กรอกเอง)
        NULL;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."calculate_shipping_cost_formula"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."calculate_shipping_cost_formula"() IS 'คำนวณค่าขนส่งอัตโนมัติในโหมด formula (รวมค่าแบกน้ำหนักและค่าอื่นๆ)';



CREATE OR REPLACE FUNCTION "public"."cancel_route_stop_and_reset_order"("p_stop_id" bigint, "p_order_id" bigint) RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_status_text TEXT;
BEGIN
    -- Step 1: Update the order, if an order_id is provided
    IF p_order_id IS NOT NULL THEN
        UPDATE public.wms_orders
        SET
            status = 'draft',
            delivery_date = NULL
        WHERE order_id = p_order_id;
        v_status_text := 'Order ' || p_order_id || ' updated.';
    ELSE
        v_status_text := 'No Order ID provided; only deleting stop.';
    END IF;

    -- Step 2: Delete the stop
    DELETE FROM public.receiving_route_stops
    WHERE stop_id = p_stop_id;

    -- Step 3: Return status
    RETURN 'Stop ' || p_stop_id || ' deleted. ' || v_status_text;

END;
$$;


ALTER FUNCTION "public"."cancel_route_stop_and_reset_order"("p_stop_id" bigint, "p_order_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_and_create_replenishment_alert"("p_warehouse_id" character varying, "p_sku_id" character varying, "p_pick_location_id" character varying, "p_required_qty" numeric, "p_picklist_id" bigint DEFAULT NULL::bigint, "p_created_by" character varying DEFAULT NULL::character varying) RETURNS TABLE("alert_created" boolean, "alert_id" "uuid", "shortage_qty" numeric, "message" "text")
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."check_and_create_replenishment_alert"("p_warehouse_id" character varying, "p_sku_id" character varying, "p_pick_location_id" character varying, "p_required_qty" numeric, "p_picklist_id" bigint, "p_created_by" character varying) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_and_create_replenishment_alert"("p_warehouse_id" character varying, "p_sku_id" character varying, "p_pick_location_id" character varying, "p_required_qty" numeric, "p_picklist_id" bigint, "p_created_by" character varying) IS 'ตรวจสอบและสร้างการแจ้งเตือนเมื่อสต็อกไม่เพียงพอ (ใช้ FEFO ค้นหาแหล่งเติม)';



CREATE OR REPLACE FUNCTION "public"."check_and_publish_if_cost_complete"("p_plan_id" bigint) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_plan_status TEXT;
    v_all_trips_have_cost BOOLEAN;
    v_total_cost NUMERIC;
    v_trips_without_cost INTEGER;
BEGIN
    -- ดึงสถานะ Route Plan
    SELECT status INTO v_plan_status
    FROM receiving_route_plans
    WHERE plan_id = p_plan_id;

    -- ถ้าไม่ใช่สถานะ optimizing → return error
    IF v_plan_status != 'optimizing' THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Route Plan status must be OPTIMIZING',
            'current_status', v_plan_status
        );
    END IF;

    -- นับจำนวนเที่ยวที่ยังไม่มีค่าขนส่ง
    SELECT COUNT(*) INTO v_trips_without_cost
    FROM receiving_route_trips
    WHERE plan_id = p_plan_id
    AND (shipping_cost IS NULL OR shipping_cost = 0);

    -- ตรวจสอบว่าทุกเที่ยวมีค่าขนส่งหรือยัง
    SELECT NOT EXISTS (
        SELECT 1
        FROM receiving_route_trips
        WHERE plan_id = p_plan_id
        AND (shipping_cost IS NULL OR shipping_cost = 0)
    ) INTO v_all_trips_have_cost;

    -- ถ้าครบแล้ว → เปลี่ยนสถานะเป็น published
    IF v_all_trips_have_cost THEN
        -- คำนวณต้นทุนรวม
        SELECT COALESCE(SUM(shipping_cost), 0) INTO v_total_cost
        FROM receiving_route_trips
        WHERE plan_id = p_plan_id;

        -- อัปเดตสถานะ
        UPDATE receiving_route_plans
        SET
            status = 'published',
            objective_value = v_total_cost,
            updated_at = NOW()
        WHERE plan_id = p_plan_id;

        RETURN jsonb_build_object(
            'success', true,
            'message', 'Route Plan published successfully',
            'new_status', 'published',
            'total_cost', v_total_cost
        );
    ELSE
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Shipping cost incomplete',
            'trips_without_cost', v_trips_without_cost
        );
    END IF;
END;
$$;


ALTER FUNCTION "public"."check_and_publish_if_cost_complete"("p_plan_id" bigint) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_and_publish_if_cost_complete"("p_plan_id" bigint) IS 'ตรวจสอบและเปลี่ยนสถานะ Route Plan เป็น published ถ้าค่าขนส่งครบ (ใช้เรียกด้วยตนเองได้)';



CREATE OR REPLACE FUNCTION "public"."check_order_completion"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_target_qty DECIMAL(18,2);
  v_produced_qty DECIMAL(18,2);
BEGIN
  SELECT quantity, produced_qty
  INTO v_target_qty, v_produced_qty
  FROM production_orders
  WHERE id = NEW.production_order_id;

  IF v_produced_qty >= v_target_qty THEN
    UPDATE production_orders
    SET status = 'completed',
        actual_completion_date = CURRENT_DATE,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.production_order_id
      AND status != 'completed';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_order_completion"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_order_completion"() IS 'ตรวจสอบและอัปเดตสถานะเป็น completed เมื่อผลิตครบแล้ว';



CREATE OR REPLACE FUNCTION "public"."check_pallet_is_unreceived"("p_pallet_id" character varying) RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_is_unreceived BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM wms_receive_items ri
        INNER JOIN wms_receives r ON ri.receive_id = r.receive_id
        WHERE ri.pallet_id = p_pallet_id
        AND r.status = 'รับเข้าแล้ว'
        AND (ri.from_location_id IS NULL OR ri.from_location_id = '' OR ri.from_location_id = '0')
        AND (ri.to_location_id IS NULL OR ri.to_location_id = '' OR ri.to_location_id = '0')
    ) INTO v_is_unreceived;

    RETURN v_is_unreceived;
END;
$$;


ALTER FUNCTION "public"."check_pallet_is_unreceived"("p_pallet_id" character varying) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_pallet_is_unreceived"("p_pallet_id" character varying) IS 'ตรวจสอบว่า pallet เป็น pallet ที่พึ่งรับเข้าโดยยังไม่ได้เก็บเข้าโลเคชั่น (Putaway)';



CREATE OR REPLACE FUNCTION "public"."check_picklist_stock_availability"("p_picklist_id" "uuid") RETURNS TABLE("sku_id" character varying, "sku_name" character varying, "required_qty" integer, "available_qty" integer, "shortage_qty" integer, "needs_replenishment" boolean)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        pli.sku_id,
        ms.sku_name,
        pli.requested_piece_qty AS required_qty,
        COALESCE(stock.available_qty, 0) AS available_qty,
        GREATEST(pli.requested_piece_qty - COALESCE(stock.available_qty, 0), 0) AS shortage_qty,
        (pli.requested_piece_qty > COALESCE(stock.available_qty, 0)) AS needs_replenishment
    FROM
        wms_picklist_items pli
    JOIN
        master_sku ms ON ms.sku_id = pli.sku_id
    LEFT JOIN LATERAL (
        SELECT
            SUM(ib.piece_qty) AS available_qty
        FROM
            wms_inventory_balance ib
        JOIN
            master_location ml ON ml.location_id = ib.location_id
        WHERE
            ib.sku_id = pli.sku_id
            AND ml.zone IN (
                SELECT pa.zone_filter
                FROM wms_picklists pl
                JOIN preparation_areas pa ON pa.area_id = pl.preparation_area_id
                WHERE pl.picklist_id = p_picklist_id
            )
            AND ml.active_status = 'active'
    ) stock ON TRUE
    WHERE
        pli.picklist_id = p_picklist_id;
END;
$$;


ALTER FUNCTION "public"."check_picklist_stock_availability"("p_picklist_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_picklist_stock_availability"("p_picklist_id" "uuid") IS 'ตรวจสอบความพร้อมของสต็อกสำหรับ picklist และระบุรายการที่ต้องเติมสต็อก';



CREATE OR REPLACE FUNCTION "public"."check_shipping_cost_complete_and_publish"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_plan_id BIGINT;
    v_plan_status TEXT;
    v_all_trips_have_cost BOOLEAN;
    v_total_cost NUMERIC;
BEGIN
    -- ดึง plan_id และ status ของ Route Plan
    SELECT plan_id, status INTO v_plan_id, v_plan_status
    FROM receiving_route_plans
    WHERE plan_id = NEW.plan_id;

    -- ทำงานเฉพาะเมื่อ Route Plan อยู่ในสถานะ 'optimizing' เท่านั้น
    IF v_plan_status = 'optimizing' THEN
        -- ตรวจสอบว่าทุกเที่ยวในแผนนี้มีค่าขนส่งหรือยัง
        SELECT NOT EXISTS (
            SELECT 1
            FROM receiving_route_trips
            WHERE plan_id = v_plan_id
            AND (shipping_cost IS NULL OR shipping_cost = 0)
        ) INTO v_all_trips_have_cost;

        -- ถ้าทุกเที่ยวมีค่าขนส่งครบแล้ว
        IF v_all_trips_have_cost THEN
            -- คำนวณต้นทุนรวม (objective_value) จากค่าขนส่งทั้งหมด
            SELECT COALESCE(SUM(shipping_cost), 0) INTO v_total_cost
            FROM receiving_route_trips
            WHERE plan_id = v_plan_id;

            -- เปลี่ยนสถานะ Route Plan เป็น 'published'
            UPDATE receiving_route_plans
            SET
                status = 'published',
                objective_value = v_total_cost,
                updated_at = NOW()
            WHERE plan_id = v_plan_id
            AND status = 'optimizing';

            RAISE NOTICE 'Route Plan ID % → All trips have shipping cost. Status changed to PUBLISHED (Total Cost: %)', v_plan_id, v_total_cost;
        ELSE
            RAISE NOTICE 'Route Plan ID % → Shipping cost incomplete. Still in OPTIMIZING status.', v_plan_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_shipping_cost_complete_and_publish"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_shipping_cost_complete_and_publish"() IS 'เมื่อมีการอัปเดตค่าขนส่ง → ตรวจสอบว่าครบทุกเที่ยวหรือยัง ถ้าครบ → เปลี่ยนสถานะ optimizing → published อัตโนมัติ';



CREATE OR REPLACE FUNCTION "public"."create_face_sheet_packages"("p_face_sheet_no" character varying DEFAULT NULL::character varying, "p_warehouse_id" character varying DEFAULT 'WH01'::character varying, "p_created_by" character varying DEFAULT 'System'::character varying, "p_delivery_date" "date" DEFAULT NULL::"date", "p_order_ids" bigint[] DEFAULT NULL::bigint[]) RETURNS TABLE("success" boolean, "face_sheet_id" bigint, "face_sheet_no" character varying, "total_packages" integer, "small_size_count" integer, "large_size_count" integer, "message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_face_sheet_no VARCHAR;
    v_face_sheet_id BIGINT;
    v_package_number INTEGER := 1;
    v_total_packages INTEGER := 0;
    v_small_size_count INTEGER := 0;
    v_large_size_count INTEGER := 0;
    v_total_orders INTEGER := 0;
    v_total_items NUMERIC := 0;
    v_barcode_id TEXT;
    v_shop_index INTEGER := 0;
    v_temp_key TEXT;
    v_size_value NUMERIC;
    v_size_text VARCHAR;
    v_size_category VARCHAR(20);
    v_package_weight NUMERIC;
    v_pieces_per_pack INTEGER;
    v_product_code TEXT;
    v_product_name TEXT;
    v_package_type VARCHAR(100);
    v_rep_order_id BIGINT;
    v_rep_order_no VARCHAR(100);
    v_address TEXT;
    v_province TEXT;
    v_contact TEXT;
    v_phone TEXT;
    v_notes TEXT;
    v_hub TEXT;
    v_use_qty INTEGER;
    v_units_needed INTEGER;
    v_units_assigned INTEGER;
    v_first_product_code TEXT;
    v_first_product_name TEXT;
    v_is_mixed BOOLEAN;
    v_total_remainder_units INTEGER;
    v_package_items_json JSONB;
    v_package_item_qty NUMERIC;
    v_inserted_package_id BIGINT;
    v_remaining_qty INTEGER;
    v_priority INTEGER;
    v_pairs INTEGER;
    pack_def RECORD;
    pack_counter INTEGER;
    shop_rec RECORD;
    sku_rec RECORD;
    queue_rec RECORD;
    remainder_rec RECORD;
    other_item RECORD;
    pkg_rec RECORD;
BEGIN
    IF p_delivery_date IS NULL THEN
        RETURN QUERY SELECT false, NULL::BIGINT, NULL::VARCHAR, 0, 0, 0, 'กรุณาเลือกวันส่งของ';
        RETURN;
    END IF;

    v_face_sheet_no := COALESCE(NULLIF(p_face_sheet_no, ''), generate_face_sheet_no());

    INSERT INTO face_sheets (
        face_sheet_no,
        warehouse_id,
        status,
        created_by
    ) VALUES (
        v_face_sheet_no,
        p_warehouse_id,
        'generated',
        COALESCE(p_created_by, 'System')
    ) RETURNING id INTO v_face_sheet_id;

    DROP TABLE IF EXISTS tmp_packages_summary;
    CREATE TEMP TABLE tmp_packages_summary (
        temp_key TEXT PRIMARY KEY,
        shop_order INTEGER,
        customer_id VARCHAR(50),
        shop_name VARCHAR(255),
        order_id BIGINT,
        order_no VARCHAR(100),
        package_type VARCHAR(100),
        product_code VARCHAR(100),
        product_name TEXT,
        size TEXT,
        size_value NUMERIC,
        size_category VARCHAR(20),
        pieces_per_pack INTEGER,
        package_weight NUMERIC,
        address TEXT,
        province VARCHAR(100),
        contact_name VARCHAR(200),
        phone VARCHAR(50),
        hub VARCHAR(100),
        notes TEXT,
        priority INTEGER
    ) ON COMMIT DROP;

    DROP TABLE IF EXISTS tmp_package_items;
    CREATE TEMP TABLE tmp_package_items (
        temp_key TEXT,
        order_id BIGINT,
        order_item_id BIGINT,
        product_code VARCHAR(100),
        product_name TEXT,
        size TEXT,
        quantity NUMERIC
    ) ON COMMIT DROP;

    DROP TABLE IF EXISTS tmp_shop_items;
    CREATE TEMP TABLE tmp_shop_items (
        order_id BIGINT,
        order_no VARCHAR(100),
        order_item_id BIGINT,
        customer_id VARCHAR(50),
        shop_name VARCHAR(255),
        sku_id VARCHAR(100),
        sku_name TEXT,
        order_weight NUMERIC,
        order_qty INTEGER,
        pack_12_bags INTEGER,
        pack_4 INTEGER,
        pack_6 INTEGER,
        pack_2 INTEGER,
        pack_1 INTEGER,
        address TEXT,
        province VARCHAR(100),
        contact_name VARCHAR(200),
        phone VARCHAR(50),
        notes TEXT,
        notes_additional TEXT
    ) ON COMMIT DROP;

    DROP TABLE IF EXISTS tmp_sku_queue;
    CREATE TEMP TABLE tmp_sku_queue (
        order_id BIGINT,
        order_no VARCHAR(100),
        order_item_id BIGINT,
        sku_id VARCHAR(100),
        sku_name TEXT,
        remaining_qty INTEGER,
        address TEXT,
        province VARCHAR(100),
        contact_name VARCHAR(200),
        phone VARCHAR(50),
        notes TEXT,
        notes_additional TEXT
    ) ON COMMIT DROP;

    DROP TABLE IF EXISTS tmp_remainders_7;
    CREATE TEMP TABLE tmp_remainders_7 (
        order_id BIGINT,
        order_no VARCHAR(100),
        order_item_id BIGINT,
        sku_id VARCHAR(100),
        sku_name TEXT,
        quantity INTEGER,
        address TEXT,
        province VARCHAR(100),
        contact_name VARCHAR(200),
        phone VARCHAR(50),
        notes TEXT,
        notes_additional TEXT
    ) ON COMMIT DROP;

    DROP TABLE IF EXISTS tmp_remainders_10;
    CREATE TEMP TABLE tmp_remainders_10 (
        order_id BIGINT,
        order_no VARCHAR(100),
        order_item_id BIGINT,
        sku_id VARCHAR(100),
        sku_name TEXT,
        quantity INTEGER,
        address TEXT,
        province VARCHAR(100),
        contact_name VARCHAR(200),
        phone VARCHAR(50),
        notes TEXT,
        notes_additional TEXT
    ) ON COMMIT DROP;

    DROP SEQUENCE IF EXISTS temp_package_seq;
    CREATE TEMP SEQUENCE temp_package_seq;

    FOR shop_rec IN
        SELECT DISTINCT
            o.customer_id,
            o.shop_name,
            mc.hub
        FROM wms_orders o
        JOIN wms_order_items oi ON oi.order_id = o.order_id
        LEFT JOIN master_customer mc ON o.customer_id = mc.customer_id
        WHERE o.order_type = 'express'
          AND o.delivery_date = p_delivery_date
          AND (p_order_ids IS NULL OR o.order_id = ANY(p_order_ids))
        ORDER BY o.shop_name
    LOOP
        v_shop_index := v_shop_index + 1;

        TRUNCATE tmp_shop_items;
        TRUNCATE tmp_sku_queue;
        TRUNCATE tmp_remainders_7;
        TRUNCATE tmp_remainders_10;

        INSERT INTO tmp_shop_items (
            order_id,
            order_no,
            order_item_id,
            customer_id,
            shop_name,
            sku_id,
            sku_name,
            order_weight,
            order_qty,
            pack_12_bags,
            pack_4,
            pack_6,
            pack_2,
            pack_1,
            address,
            province,
            contact_name,
            phone,
            notes,
            notes_additional
        )
        SELECT
            o.order_id,
            o.order_no,
            oi.order_item_id,
            o.customer_id,
            o.shop_name,
            oi.sku_id,
            oi.sku_name,
            COALESCE(oi.order_weight, 0)::NUMERIC,
            COALESCE(oi.order_qty, 0)::INTEGER,
            COALESCE(oi.pack_12_bags, 0)::INTEGER,
            COALESCE(oi.pack_4, 0)::INTEGER,
            COALESCE(oi.pack_6, 0)::INTEGER,
            COALESCE(oi.pack_2, 0)::INTEGER,
            COALESCE(oi.pack_1, 0)::INTEGER,
            o.text_field_long_1,
            o.province,
            o.text_field_additional_1,
            o.phone,
            o.notes,
            o.notes_additional
        FROM wms_orders o
        JOIN wms_order_items oi ON oi.order_id = o.order_id
        WHERE o.order_type = 'express'
          AND o.delivery_date = p_delivery_date
          AND o.customer_id = shop_rec.customer_id
          AND o.shop_name = shop_rec.shop_name
          AND (p_order_ids IS NULL OR o.order_id = ANY(p_order_ids));

        -- Pair processing for 7kg items
        FOR sku_rec IN
            SELECT
                sku_id,
                MIN(sku_name) AS sku_name,
                SUM(order_qty)::INTEGER AS total_qty
            FROM tmp_shop_items
            WHERE order_weight = 7
            GROUP BY sku_id
            ORDER BY sku_id
        LOOP
            TRUNCATE tmp_sku_queue;
            INSERT INTO tmp_sku_queue (
                order_id,
                order_no,
                order_item_id,
                sku_id,
                sku_name,
                remaining_qty,
                address,
                province,
                contact_name,
                phone,
                notes,
                notes_additional
            )
            SELECT
                order_id,
                order_no,
                order_item_id,
                sku_id,
                sku_name,
                order_qty,
                address,
                province,
                contact_name,
                phone,
                notes,
                notes_additional
            FROM tmp_shop_items
            WHERE order_weight = 7
              AND sku_id = sku_rec.sku_id
            ORDER BY order_no, order_item_id;

            v_pairs := sku_rec.total_qty / 2;

            FOR i IN 1..v_pairs LOOP
                v_temp_key := 'pkg_' || nextval('temp_package_seq');
                v_package_weight := 0;
                v_rep_order_id := NULL;
                v_rep_order_no := NULL;
                v_address := NULL;
                v_province := NULL;
                v_contact := NULL;
                v_phone := NULL;
                v_notes := '';
                v_hub := NULL;
                v_units_needed := 2;

                LOOP
                    SELECT *
                    INTO queue_rec
                    FROM tmp_sku_queue
                    WHERE remaining_qty > 0
                    ORDER BY order_item_id
                    LIMIT 1;

                    EXIT WHEN queue_rec.order_item_id IS NULL;

                    v_use_qty := LEAST(v_units_needed, queue_rec.remaining_qty);

                    UPDATE tmp_sku_queue
                    SET remaining_qty = remaining_qty - v_use_qty
                    WHERE order_item_id = queue_rec.order_item_id;

                    INSERT INTO tmp_package_items (
                        temp_key,
                        order_id,
                        order_item_id,
                        product_code,
                        product_name,
                        size,
                        quantity
                    ) VALUES (
                        v_temp_key,
                        queue_rec.order_id,
                        queue_rec.order_item_id,
                        sku_rec.sku_id,
                        sku_rec.sku_name,
                        '7',
                        v_use_qty
                    );

                    IF v_rep_order_id IS NULL THEN
                        v_rep_order_id := queue_rec.order_id;
                        v_rep_order_no := queue_rec.order_no;
                        v_address := queue_rec.address;
                        v_province := queue_rec.province;
                        v_contact := queue_rec.contact_name;
                        v_phone := queue_rec.phone;
                        v_hub := COALESCE(NULLIF(shop_rec.hub, ''), NULLIF(TRIM(queue_rec.notes), ''), queue_rec.province);
                    END IF;

                    v_notes := TRIM(BOTH ' ' FROM CONCAT_WS(' ', v_notes, queue_rec.notes, queue_rec.notes_additional));
                    v_package_weight := v_package_weight + (v_use_qty * 7);
                    v_units_needed := v_units_needed - v_use_qty;

                    EXIT WHEN v_units_needed = 0;
                END LOOP;

                v_size_value := 7;
                v_size_text := '7';
                v_size_category := 'large';
                v_package_type := 'แพ็ค 2 (7 กก.)';
                v_pieces_per_pack := 2;
                v_priority := COALESCE(
                    (SELECT m.priority FROM (VALUES
                        (1::numeric, 1),
                        (1.2::numeric, 2),
                        (1.5::numeric, 3),
                        (2.5::numeric, 4),
                        (3::numeric, 5),
                        (4::numeric, 6),
                        (10::numeric, 7),
                        (7::numeric, 8),
                        (15::numeric, 9)
                    ) AS m(val, priority)
                    WHERE m.val = v_size_value),
                    100 + COALESCE(FLOOR(v_size_value)::INTEGER, 0)
                );

                INSERT INTO tmp_packages_summary (
                    temp_key,
                    shop_order,
                    customer_id,
                    shop_name,
                    order_id,
                    order_no,
                    package_type,
                    product_code,
                    product_name,
                    size,
                    size_value,
                    size_category,
                    pieces_per_pack,
                    package_weight,
                    address,
                    province,
                    contact_name,
                    phone,
                    hub,
                    notes,
                    priority
                ) VALUES (
                    v_temp_key,
                    v_shop_index,
                    shop_rec.customer_id,
                    shop_rec.shop_name,
                    v_rep_order_id,
                    v_rep_order_no,
                    v_package_type,
                    sku_rec.sku_id,
                    sku_rec.sku_name,
                    v_size_text,
                    v_size_value,
                    v_size_category,
                    v_pieces_per_pack,
                    v_package_weight,
                    v_address,
                    v_province,
                    v_contact,
                    v_phone,
                    v_hub,
                    NULLIF(v_notes, ''),
                    v_priority
                );
            END LOOP;

            FOR queue_rec IN
                SELECT *
                FROM tmp_sku_queue
                WHERE remaining_qty > 0
            LOOP
                INSERT INTO tmp_remainders_7 (
                    order_id,
                    order_no,
                    order_item_id,
                    sku_id,
                    sku_name,
                    quantity,
                    address,
                    province,
                    contact_name,
                    phone,
                    notes,
                    notes_additional
                ) VALUES (
                    queue_rec.order_id,
                    queue_rec.order_no,
                    queue_rec.order_item_id,
                    queue_rec.sku_id,
                    queue_rec.sku_name,
                    queue_rec.remaining_qty,
                    queue_rec.address,
                    queue_rec.province,
                    queue_rec.contact_name,
                    queue_rec.phone,
                    queue_rec.notes,
                    queue_rec.notes_additional
                );
            END LOOP;
        END LOOP;

        -- Pair processing for 10kg items
        FOR sku_rec IN
            SELECT
                sku_id,
                MIN(sku_name) AS sku_name,
                SUM(order_qty)::INTEGER AS total_qty
            FROM tmp_shop_items
            WHERE order_weight = 10
            GROUP BY sku_id
            ORDER BY sku_id
        LOOP
            TRUNCATE tmp_sku_queue;
            INSERT INTO tmp_sku_queue (
                order_id,
                order_no,
                order_item_id,
                sku_id,
                sku_name,
                remaining_qty,
                address,
                province,
                contact_name,
                phone,
                notes,
                notes_additional
            )
            SELECT
                order_id,
                order_no,
                order_item_id,
                sku_id,
                sku_name,
                order_qty,
                address,
                province,
                contact_name,
                phone,
                notes,
                notes_additional
            FROM tmp_shop_items
            WHERE order_weight = 10
              AND sku_id = sku_rec.sku_id
            ORDER BY order_no, order_item_id;

            v_pairs := sku_rec.total_qty / 2;

            FOR i IN 1..v_pairs LOOP
                v_temp_key := 'pkg_' || nextval('temp_package_seq');
                v_package_weight := 0;
                v_rep_order_id := NULL;
                v_rep_order_no := NULL;
                v_address := NULL;
                v_province := NULL;
                v_contact := NULL;
                v_phone := NULL;
                v_notes := '';
                v_hub := NULL;
                v_units_needed := 2;

                LOOP
                    SELECT *
                    INTO queue_rec
                    FROM tmp_sku_queue
                    WHERE remaining_qty > 0
                    ORDER BY order_item_id
                    LIMIT 1;

                    EXIT WHEN queue_rec.order_item_id IS NULL;

                    v_use_qty := LEAST(v_units_needed, queue_rec.remaining_qty);

                    UPDATE tmp_sku_queue
                    SET remaining_qty = remaining_qty - v_use_qty
                    WHERE order_item_id = queue_rec.order_item_id;

                    INSERT INTO tmp_package_items (
                        temp_key,
                        order_id,
                        order_item_id,
                        product_code,
                        product_name,
                        size,
                        quantity
                    ) VALUES (
                        v_temp_key,
                        queue_rec.order_id,
                        queue_rec.order_item_id,
                        sku_rec.sku_id,
                        sku_rec.sku_name,
                        '10',
                        v_use_qty
                    );

                    IF v_rep_order_id IS NULL THEN
                        v_rep_order_id := queue_rec.order_id;
                        v_rep_order_no := queue_rec.order_no;
                        v_address := queue_rec.address;
                        v_province := queue_rec.province;
                        v_contact := queue_rec.contact_name;
                        v_phone := queue_rec.phone;
                        v_hub := COALESCE(NULLIF(shop_rec.hub, ''), NULLIF(TRIM(queue_rec.notes), ''), queue_rec.province);
                    END IF;

                    v_notes := TRIM(BOTH ' ' FROM CONCAT_WS(' ', v_notes, queue_rec.notes, queue_rec.notes_additional));
                    v_package_weight := v_package_weight + (v_use_qty * 10);
                    v_units_needed := v_units_needed - v_use_qty;

                    EXIT WHEN v_units_needed = 0;
                END LOOP;

                v_size_value := 10;
                v_size_text := '10';
                v_size_category := 'large';
                v_package_type := 'แพ็ค 2 (10 กก.)';
                v_pieces_per_pack := 2;
                v_priority := COALESCE(
                    (SELECT m.priority FROM (VALUES
                        (1::numeric, 1),
                        (1.2::numeric, 2),
                        (1.5::numeric, 3),
                        (2.5::numeric, 4),
                        (3::numeric, 5),
                        (4::numeric, 6),
                        (10::numeric, 7),
                        (7::numeric, 8),
                        (15::numeric, 9)
                    ) AS m(val, priority)
                    WHERE m.val = v_size_value),
                    100 + COALESCE(FLOOR(v_size_value)::INTEGER, 0)
                );

                INSERT INTO tmp_packages_summary (
                    temp_key,
                    shop_order,
                    customer_id,
                    shop_name,
                    order_id,
                    order_no,
                    package_type,
                    product_code,
                    product_name,
                    size,
                    size_value,
                    size_category,
                    pieces_per_pack,
                    package_weight,
                    address,
                    province,
                    contact_name,
                    phone,
                    hub,
                    notes,
                    priority
                ) VALUES (
                    v_temp_key,
                    v_shop_index,
                    shop_rec.customer_id,
                    shop_rec.shop_name,
                    v_rep_order_id,
                    v_rep_order_no,
                    v_package_type,
                    sku_rec.sku_id,
                    sku_rec.sku_name,
                    v_size_text,
                    v_size_value,
                    v_size_category,
                    v_pieces_per_pack,
                    v_package_weight,
                    v_address,
                    v_province,
                    v_contact,
                    v_phone,
                    v_hub,
                    NULLIF(v_notes, ''),
                    v_priority
                );
            END LOOP;

            FOR queue_rec IN
                SELECT *
                FROM tmp_sku_queue
                WHERE remaining_qty > 0
            LOOP
                INSERT INTO tmp_remainders_10 (
                    order_id,
                    order_no,
                    order_item_id,
                    sku_id,
                    sku_name,
                    quantity,
                    address,
                    province,
                    contact_name,
                    phone,
                    notes,
                    notes_additional
                ) VALUES (
                    queue_rec.order_id,
                    queue_rec.order_no,
                    queue_rec.order_item_id,
                    queue_rec.sku_id,
                    queue_rec.sku_name,
                    queue_rec.remaining_qty,
                    queue_rec.address,
                    queue_rec.province,
                    queue_rec.contact_name,
                    queue_rec.phone,
                    queue_rec.notes,
                    queue_rec.notes_additional
                );
            END LOOP;
        END LOOP;

        -- Combine 7kg remainders into 3-packs
        v_total_remainder_units := COALESCE((SELECT SUM(quantity) FROM tmp_remainders_7), 0);
        WHILE v_total_remainder_units > 0 LOOP
            v_temp_key := 'pkg_' || nextval('temp_package_seq');
            v_units_needed := 3;
            v_units_assigned := 0;
            v_package_weight := 0;
            v_rep_order_id := NULL;
            v_rep_order_no := NULL;
            v_address := NULL;
            v_province := NULL;
            v_contact := NULL;
            v_phone := NULL;
            v_notes := '';
            v_hub := NULL;
            v_first_product_code := NULL;
            v_first_product_name := NULL;
            v_is_mixed := FALSE;

            LOOP
                SELECT *
                INTO remainder_rec
                FROM tmp_remainders_7
                WHERE quantity > 0
                ORDER BY order_item_id
                LIMIT 1;

                EXIT WHEN remainder_rec.order_item_id IS NULL;

                v_use_qty := LEAST(v_units_needed, remainder_rec.quantity);

                UPDATE tmp_remainders_7
                SET quantity = quantity - v_use_qty
                WHERE order_item_id = remainder_rec.order_item_id;

                INSERT INTO tmp_package_items (
                    temp_key,
                    order_id,
                    order_item_id,
                    product_code,
                    product_name,
                    size,
                    quantity
                ) VALUES (
                    v_temp_key,
                    remainder_rec.order_id,
                    remainder_rec.order_item_id,
                    remainder_rec.sku_id,
                    remainder_rec.sku_name,
                    '7',
                    v_use_qty
                );

                IF v_rep_order_id IS NULL THEN
                    v_rep_order_id := remainder_rec.order_id;
                    v_rep_order_no := remainder_rec.order_no;
                    v_address := remainder_rec.address;
                    v_province := remainder_rec.province;
                    v_contact := remainder_rec.contact_name;
                    v_phone := remainder_rec.phone;
                    v_hub := COALESCE(NULLIF(shop_rec.hub, ''), NULLIF(TRIM(remainder_rec.notes), ''), remainder_rec.province);
                END IF;

                IF v_first_product_code IS NULL THEN
                    v_first_product_code := remainder_rec.sku_id;
                    v_first_product_name := remainder_rec.sku_name;
                ELSIF v_first_product_code <> remainder_rec.sku_id THEN
                    v_is_mixed := TRUE;
                END IF;

                v_notes := TRIM(BOTH ' ' FROM CONCAT_WS(' ', v_notes, remainder_rec.notes, remainder_rec.notes_additional));
                v_package_weight := v_package_weight + (v_use_qty * 7);
                v_units_assigned := v_units_assigned + v_use_qty;
                v_units_needed := v_units_needed - v_use_qty;

                EXIT WHEN v_units_needed = 0 OR COALESCE((SELECT SUM(quantity) FROM tmp_remainders_7), 0) = 0;
            END LOOP;

            EXIT WHEN v_units_assigned = 0;

            IF v_is_mixed THEN
                v_product_code := '7KG-MIXED';
                v_product_name := 'สินค้าผสม 7 กก.';
            ELSE
                v_product_code := v_first_product_code;
                v_product_name := v_first_product_name;
            END IF;

            v_size_value := 7;
            v_size_text := '7';
            v_size_category := 'large';
            v_package_type := 'แพ็ค 3 (7 กก. เศษ)';
            v_pieces_per_pack := v_units_assigned;
            v_priority := COALESCE(
                (SELECT m.priority FROM (VALUES
                    (1::numeric, 1),
                    (1.2::numeric, 2),
                    (1.5::numeric, 3),
                    (2.5::numeric, 4),
                    (3::numeric, 5),
                    (4::numeric, 6),
                    (10::numeric, 7),
                    (7::numeric, 8),
                    (15::numeric, 9)
                ) AS m(val, priority)
                WHERE m.val = v_size_value),
                100 + COALESCE(FLOOR(v_size_value)::INTEGER, 0)
            );

            INSERT INTO tmp_packages_summary (
                temp_key,
                shop_order,
                customer_id,
                shop_name,
                order_id,
                order_no,
                package_type,
                product_code,
                product_name,
                size,
                size_value,
                size_category,
                pieces_per_pack,
                package_weight,
                address,
                province,
                contact_name,
                phone,
                hub,
                notes,
                priority
            ) VALUES (
                v_temp_key,
                v_shop_index,
                shop_rec.customer_id,
                shop_rec.shop_name,
                v_rep_order_id,
                v_rep_order_no,
                v_package_type,
                v_product_code,
                v_product_name,
                v_size_text,
                v_size_value,
                v_size_category,
                v_pieces_per_pack,
                v_package_weight,
                v_address,
                v_province,
                v_contact,
                v_phone,
                v_hub,
                NULLIF(v_notes, ''),
                v_priority
            );

            v_total_remainder_units := COALESCE((SELECT SUM(quantity) FROM tmp_remainders_7 WHERE quantity > 0), 0);
        END LOOP;

        -- Single packs for remaining 10kg items
        FOR remainder_rec IN SELECT * FROM tmp_remainders_10 LOOP
            v_units_assigned := remainder_rec.quantity;

            WHILE v_units_assigned > 0 LOOP
                v_temp_key := 'pkg_' || nextval('temp_package_seq');
                v_use_qty := 1;
                v_package_weight := v_use_qty * 10;
                v_rep_order_id := remainder_rec.order_id;
                v_rep_order_no := remainder_rec.order_no;
                v_address := remainder_rec.address;
                v_province := remainder_rec.province;
                v_contact := remainder_rec.contact_name;
                v_phone := remainder_rec.phone;
                v_hub := COALESCE(NULLIF(shop_rec.hub, ''), NULLIF(TRIM(remainder_rec.notes), ''), remainder_rec.province);
                v_notes := TRIM(BOTH ' ' FROM CONCAT_WS(' ', remainder_rec.notes, remainder_rec.notes_additional));

                INSERT INTO tmp_package_items (
                    temp_key,
                    order_id,
                    order_item_id,
                    product_code,
                    product_name,
                    size,
                    quantity
                ) VALUES (
                    v_temp_key,
                    remainder_rec.order_id,
                    remainder_rec.order_item_id,
                    remainder_rec.sku_id,
                    remainder_rec.sku_name,
                    '10',
                    v_use_qty
                );

                v_size_value := 10;
                v_size_text := '10';
                v_size_category := 'large';
                v_package_type := 'แพ็ค 1 (10 กก. เศษ)';
                v_pieces_per_pack := v_use_qty;
                v_priority := COALESCE(
                    (SELECT m.priority FROM (VALUES
                        (1::numeric, 1),
                        (1.2::numeric, 2),
                        (1.5::numeric, 3),
                        (2.5::numeric, 4),
                        (3::numeric, 5),
                        (4::numeric, 6),
                        (10::numeric, 7),
                        (7::numeric, 8),
                        (15::numeric, 9)
                    ) AS m(val, priority)
                    WHERE m.val = v_size_value),
                    100 + COALESCE(FLOOR(v_size_value)::INTEGER, 0)
                );

                INSERT INTO tmp_packages_summary (
                    temp_key,
                    shop_order,
                    customer_id,
                    shop_name,
                    order_id,
                    order_no,
                    package_type,
                    product_code,
                    product_name,
                    size,
                    size_value,
                    size_category,
                    pieces_per_pack,
                    package_weight,
                    address,
                    province,
                    contact_name,
                    phone,
                    hub,
                    notes,
                    priority
                ) VALUES (
                    v_temp_key,
                    v_shop_index,
                    shop_rec.customer_id,
                    shop_rec.shop_name,
                    v_rep_order_id,
                    v_rep_order_no,
                    v_package_type,
                    remainder_rec.sku_id,
                    remainder_rec.sku_name,
                    v_size_text,
                    v_size_value,
                    v_size_category,
                    v_pieces_per_pack,
                    v_package_weight,
                    v_address,
                    v_province,
                    v_contact,
                    v_phone,
                    v_hub,
                    NULLIF(v_notes, ''),
                    v_priority
                );

                v_units_assigned := v_units_assigned - v_use_qty;
            END LOOP;
        END LOOP;

        -- Other sizes based on packing columns
        FOR other_item IN
            SELECT *
            FROM tmp_shop_items
            WHERE order_weight NOT IN (7, 10)
            ORDER BY order_weight, order_item_id
        LOOP
            v_size_value := other_item.order_weight;
            v_size_text := TO_CHAR(v_size_value, 'FM999999.##');
            v_size_category := CASE WHEN v_size_value < 7 THEN 'small' ELSE 'large' END;
            v_priority := COALESCE(
                (SELECT m.priority FROM (VALUES
                    (1::numeric, 1),
                    (1.2::numeric, 2),
                    (1.5::numeric, 3),
                    (2.5::numeric, 4),
                    (3::numeric, 5),
                    (4::numeric, 6),
                    (10::numeric, 7),
                    (7::numeric, 8),
                    (15::numeric, 9)
                ) AS m(val, priority)
                WHERE m.val = v_size_value),
                100 + COALESCE(FLOOR(v_size_value)::INTEGER, 0)
            );

            v_notes := TRIM(BOTH ' ' FROM CONCAT_WS(' ', other_item.notes, other_item.notes_additional));
            v_hub := COALESCE(NULLIF(shop_rec.hub, ''), NULLIF(TRIM(other_item.notes), ''), other_item.province);
            v_remaining_qty := COALESCE(other_item.order_qty, 0);

            IF v_remaining_qty <= 0 THEN
                CONTINUE;
            END IF;

            FOR pack_def IN
                SELECT type_label, pack_count, pack_size
                FROM (VALUES
                    ('แพ็ค 12 ถุง'::TEXT, COALESCE(other_item.pack_12_bags, 0), 12),
                    ('แพ็ค 6'::TEXT, COALESCE(other_item.pack_6, 0), 6),
                    ('แพ็ค 4'::TEXT, COALESCE(other_item.pack_4, 0), 4),
                    ('แพ็ค 2'::TEXT, COALESCE(other_item.pack_2, 0), 2),
                    ('แพ็ค 1'::TEXT, COALESCE(other_item.pack_1, 0), 1)
                ) AS x(type_label, pack_count, pack_size)
            LOOP
                FOR pack_counter IN 1..pack_def.pack_count LOOP
                    v_pieces_per_pack := LEAST(pack_def.pack_size, v_remaining_qty);
                    IF v_pieces_per_pack <= 0 THEN
                        EXIT;
                    END IF;

                    v_temp_key := 'pkg_' || nextval('temp_package_seq');
                    v_package_type := pack_def.type_label;
                    v_package_weight := v_size_value * v_pieces_per_pack;

                    INSERT INTO tmp_package_items (
                        temp_key,
                        order_id,
                        order_item_id,
                        product_code,
                        product_name,
                        size,
                        quantity
                    ) VALUES (
                        v_temp_key,
                        other_item.order_id,
                        other_item.order_item_id,
                        other_item.sku_id,
                        other_item.sku_name,
                        v_size_text,
                        v_pieces_per_pack
                    );

                    INSERT INTO tmp_packages_summary (
                        temp_key,
                        shop_order,
                        customer_id,
                        shop_name,
                        order_id,
                        order_no,
                        package_type,
                        product_code,
                        product_name,
                        size,
                        size_value,
                        size_category,
                        pieces_per_pack,
                        package_weight,
                        address,
                        province,
                        contact_name,
                        phone,
                        hub,
                        notes,
                        priority
                    ) VALUES (
                        v_temp_key,
                        v_shop_index,
                        other_item.customer_id,
                        other_item.shop_name,
                        other_item.order_id,
                        other_item.order_no,
                        v_package_type,
                        other_item.sku_id,
                        other_item.sku_name,
                        v_size_text,
                        v_size_value,
                        v_size_category,
                        v_pieces_per_pack,
                        v_package_weight,
                        other_item.address,
                        other_item.province,
                        other_item.contact_name,
                        other_item.phone,
                        v_hub,
                        NULLIF(v_notes, ''),
                        v_priority
                    );

                    v_remaining_qty := v_remaining_qty - v_pieces_per_pack;
                END LOOP;
            END LOOP;

            IF v_remaining_qty > 0 THEN
                v_temp_key := 'pkg_' || nextval('temp_package_seq');
                v_package_type := 'แพ็คพิเศษ';
                v_pieces_per_pack := v_remaining_qty;
                v_package_weight := v_size_value * v_pieces_per_pack;

                INSERT INTO tmp_package_items (
                    temp_key,
                    order_id,
                    order_item_id,
                    product_code,
                    product_name,
                    size,
                    quantity
                ) VALUES (
                    v_temp_key,
                    other_item.order_id,
                    other_item.order_item_id,
                    other_item.sku_id,
                    other_item.sku_name,
                    v_size_text,
                    v_pieces_per_pack
                );

                INSERT INTO tmp_packages_summary (
                    temp_key,
                    shop_order,
                    customer_id,
                    shop_name,
                    order_id,
                    order_no,
                    package_type,
                    product_code,
                    product_name,
                    size,
                    size_value,
                    size_category,
                    pieces_per_pack,
                    package_weight,
                    address,
                    province,
                    contact_name,
                    phone,
                    hub,
                    notes,
                    priority
                ) VALUES (
                    v_temp_key,
                    v_shop_index,
                    other_item.customer_id,
                    other_item.shop_name,
                    other_item.order_id,
                    other_item.order_no,
                    v_package_type,
                    other_item.sku_id,
                    other_item.sku_name,
                    v_size_text,
                    v_size_value,
                    v_size_category,
                    v_pieces_per_pack,
                    v_package_weight,
                    other_item.address,
                    other_item.province,
                    other_item.contact_name,
                    other_item.phone,
                    v_hub,
                    NULLIF(v_notes, ''),
                    v_priority
                );
            END IF;
        END LOOP;
    END LOOP;
    DROP SEQUENCE IF EXISTS temp_package_seq;

    FOR pkg_rec IN
        SELECT *
        FROM tmp_packages_summary
        ORDER BY priority, shop_order, temp_key
    LOOP
        v_barcode_id := generate_scanner_friendly_code(
            COALESCE(pkg_rec.order_no, v_face_sheet_no),
            COALESCE(pkg_rec.product_code, 'UNKNOWN'),
            v_package_number
        );

        v_package_items_json := (
            SELECT jsonb_agg(jsonb_build_object(
                'order_id', t.order_id,
                'order_item_id', t.order_item_id,
                'product_code', t.product_code,
                'product_name', t.product_name,
                'size', t.size,
                'quantity', t.quantity
            ))
            FROM tmp_package_items t
            WHERE t.temp_key = pkg_rec.temp_key
        );

        v_package_item_qty := COALESCE((
            SELECT SUM(quantity)
            FROM tmp_package_items
            WHERE temp_key = pkg_rec.temp_key
        ), 0);

        INSERT INTO face_sheet_packages (
            face_sheet_id,
            package_number,
            barcode_id,
            order_id,
            order_no,
            customer_id,
            shop_name,
            product_code,
            product_name,
            size,
            size_category,
            package_type,
            pieces_per_pack,
            package_weight,
            address,
            province,
            contact_name,
            phone,
            hub,
            notes,
            product_items
        ) VALUES (
            v_face_sheet_id,
            v_package_number,
            v_barcode_id,
            pkg_rec.order_id,
            pkg_rec.order_no,
            pkg_rec.customer_id,
            pkg_rec.shop_name,
            pkg_rec.product_code,
            pkg_rec.product_name,
            pkg_rec.size,
            pkg_rec.size_category,
            pkg_rec.package_type,
            pkg_rec.pieces_per_pack,
            pkg_rec.package_weight,
            pkg_rec.address,
            pkg_rec.province,
            pkg_rec.contact_name,
            pkg_rec.phone,
            pkg_rec.hub,
            pkg_rec.notes,
            COALESCE(v_package_items_json, '[]'::jsonb)
        ) RETURNING id INTO v_inserted_package_id;

        INSERT INTO face_sheet_items (
            face_sheet_id,
            package_id,
            order_id,
            order_item_id,
            product_code,
            product_name,
            size,
            quantity,
            weight
        )
        SELECT
            v_face_sheet_id,
            v_inserted_package_id,
            t.order_id,
            t.order_item_id,
            t.product_code,
            t.product_name,
            t.size,
            t.quantity,
            COALESCE(NULLIF(t.size, '')::NUMERIC, 0) * t.quantity
        FROM tmp_package_items t
        WHERE t.temp_key = pkg_rec.temp_key;

        v_total_packages := v_total_packages + 1;
        v_total_items := v_total_items + v_package_item_qty;

        IF pkg_rec.size_category = 'small' THEN
            v_small_size_count := v_small_size_count + 1;
        ELSE
            v_large_size_count := v_large_size_count + 1;
        END IF;

        v_package_number := v_package_number + 1;
    END LOOP;

    IF v_total_packages = 0 THEN
        DELETE FROM face_sheets fs WHERE fs.id = v_face_sheet_id;
        RETURN QUERY SELECT false, NULL::BIGINT, v_face_sheet_no, 0, 0, 0, 'ไม่มีข้อมูลสำหรับสร้างใบปะหน้า';
        RETURN;
    END IF;

    SELECT COUNT(DISTINCT fsi.order_id)
    INTO v_total_orders
    FROM face_sheet_items fsi
    WHERE fsi.face_sheet_id = v_face_sheet_id;

    UPDATE face_sheets SET
        total_packages = v_total_packages,
        total_items = COALESCE(v_total_items, 0)::INTEGER,
        total_orders = v_total_orders,
        small_size_count = v_small_size_count,
        large_size_count = v_large_size_count,
        updated_at = NOW()
    WHERE id = v_face_sheet_id;

    RETURN QUERY SELECT
        true,
        v_face_sheet_id,
        v_face_sheet_no,
        v_total_packages,
        v_small_size_count,
        v_large_size_count,
        format('สร้างใบปะหน้าสำเร็จ: %s แพ็ค (เล็ก: %s, ใหญ่: %s)',
            v_total_packages,
            v_small_size_count,
            v_large_size_count)::TEXT;
    RETURN;
EXCEPTION WHEN OTHERS THEN
    DROP SEQUENCE IF EXISTS temp_package_seq;
    IF v_face_sheet_id IS NOT NULL THEN
        DELETE FROM face_sheet_packages fsp WHERE fsp.face_sheet_id = v_face_sheet_id;
        DELETE FROM face_sheet_items fsi WHERE fsi.face_sheet_id = v_face_sheet_id;
        DELETE FROM face_sheets fs WHERE fs.id = v_face_sheet_id;
    END IF;
    RETURN QUERY SELECT false, NULL::BIGINT, NULL::VARCHAR,
        0::INTEGER, 0::INTEGER, 0::INTEGER,
        ('เกิดข้อผิดพลาด: ' || SQLERRM)::TEXT;
END;
$$;


ALTER FUNCTION "public"."create_face_sheet_packages"("p_face_sheet_no" character varying, "p_warehouse_id" character varying, "p_created_by" character varying, "p_delivery_date" "date", "p_order_ids" bigint[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_ledger_from_move"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_move_status text;
    v_from_warehouse_id text;
    v_to_warehouse_id text;
    v_scheduled_at timestamp;
BEGIN
    -- Get the move header info
    SELECT status, from_warehouse_id, to_warehouse_id, scheduled_at
    INTO v_move_status, v_from_warehouse_id, v_to_warehouse_id, v_scheduled_at
    FROM wms_moves
    WHERE move_id = NEW.move_id;

    -- Only create ledger entries if item status is 'completed'
    IF NEW.status = 'completed' THEN
        -- Create OUT entry (from source location)
        IF NEW.from_location_id IS NOT NULL THEN
            INSERT INTO wms_inventory_ledger (
                transaction_type,
                move_item_id,
                warehouse_id,
                location_id,
                sku_id,
                pallet_id,
                pallet_id_external,
                production_date,
                expiry_date,
                pack_qty,
                piece_qty,
                direction,
                movement_at,
                reference_no,
                created_by
            ) VALUES (
                'transfer',
                NEW.move_item_id,
                v_from_warehouse_id,
                NEW.from_location_id,
                NEW.sku_id,
                NEW.pallet_id,
                NEW.pallet_id_external,
                NEW.production_date,
                NEW.expiry_date,
                NEW.confirmed_pack_qty,
                NEW.confirmed_piece_qty,
                'out',
                COALESCE(NEW.completed_at, v_scheduled_at, CURRENT_TIMESTAMP),
                (SELECT move_no FROM wms_moves WHERE move_id = NEW.move_id),
                NEW.executed_by
            );
        END IF;

        -- Create IN entry (to destination location)
        IF NEW.to_location_id IS NOT NULL THEN
            INSERT INTO wms_inventory_ledger (
                transaction_type,
                move_item_id,
                warehouse_id,
                location_id,
                sku_id,
                pallet_id,
                pallet_id_external,
                production_date,
                expiry_date,
                pack_qty,
                piece_qty,
                direction,
                movement_at,
                reference_no,
                created_by
            ) VALUES (
                'transfer',
                NEW.move_item_id,
                v_to_warehouse_id,
                NEW.to_location_id,
                NEW.sku_id,
                NEW.pallet_id,
                NEW.pallet_id_external,
                NEW.production_date,
                NEW.expiry_date,
                NEW.confirmed_pack_qty,
                NEW.confirmed_piece_qty,
                'in',
                COALESCE(NEW.completed_at, v_scheduled_at, CURRENT_TIMESTAMP),
                (SELECT move_no FROM wms_moves WHERE move_id = NEW.move_id),
                NEW.executed_by
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_ledger_from_move"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_ledger_from_move"() IS 'DISABLED: Create inventory ledger entries (OUT and IN) when move item is inserted with completed status. Disabled because API code handles this.';



CREATE OR REPLACE FUNCTION "public"."create_ledger_from_receive"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_receive_status text;
    v_warehouse_id text;
    v_receive_date timestamp;
    v_production_date date;
BEGIN
    -- Get the receive header status and warehouse_id
    SELECT status, warehouse_id, receive_date
    INTO v_receive_status, v_warehouse_id, v_receive_date
    FROM wms_receives
    WHERE receive_id = NEW.receive_id;

    -- Only create ledger entry if status is 'รับเข้าแล้ว' and location is specified
    IF v_receive_status = 'รับเข้าแล้ว' AND NEW.location_id IS NOT NULL THEN
        -- Safely convert production_date (varchar) to date
        v_production_date := safe_string_to_date(NEW.production_date);
        
        INSERT INTO wms_inventory_ledger (
            ledger_id,
            transaction_type,
            receive_item_id,
            warehouse_id,
            location_id,
            sku_id,
            pallet_id,
            pallet_id_external,
            production_date,
            expiry_date,
            pack_qty,
            piece_qty,
            direction,
            movement_at,
            created_by
        ) VALUES (
            nextval('wms_inventory_ledger_ledger_id_seq'),
            'receive',
            NEW.item_id,
            v_warehouse_id,
            NEW.location_id,
            NEW.sku_id,
            NEW.pallet_id,
            NEW.pallet_id_external,
            v_production_date,      -- Use the converted date variable
            NEW.expiry_date,        -- already date type
            NEW.pack_quantity,
            NEW.piece_quantity,
            'in',
            COALESCE(v_receive_date, CURRENT_TIMESTAMP),
            NEW.created_by
        );
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_ledger_from_receive"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_ledger_from_receive"() IS 'Trigger function to create ledger entries from receive items on INSERT';



CREATE OR REPLACE FUNCTION "public"."create_picklist_for_special_trip"("p_trip_id" bigint, "p_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_plan_id BIGINT;
    v_new_picklist_id BIGINT;
    v_picklist_code VARCHAR;
    v_total_lines INT;
    v_total_quantity NUMERIC;
    v_trip_exists BOOLEAN;
    v_order_count INT;
BEGIN
    SELECT EXISTS (SELECT 1 FROM receiving_route_trips WHERE trip_id = p_trip_id) INTO v_trip_exists;
    IF NOT v_trip_exists THEN
        RAISE EXCEPTION 'Trip with ID % does not exist.', p_trip_id;
    END IF;

    IF EXISTS (SELECT 1 FROM picklists WHERE trip_id = p_trip_id AND status <> 'cancelled') THEN
        RAISE EXCEPTION 'A picklist already exists for trip ID %.', p_trip_id;
    END IF;

    UPDATE wms_orders o
    SET matched_trip_id = p_trip_id
    FROM receiving_route_stops rs
    WHERE o.order_type = 'special'
      AND o.status = 'draft'
      AND o.matched_trip_id IS NULL
      AND rs.trip_id = p_trip_id
      AND rs.customer_id = o.customer_id
      AND rs.stop_name = o.shop_name
      AND DATE(rs.planned_arrival_at) = DATE(o.delivery_date);

    SELECT COUNT(*) INTO v_order_count
    FROM wms_orders
    WHERE matched_trip_id = p_trip_id
      AND order_type = 'special'
      AND status = 'draft';

    IF v_order_count = 0 THEN
        RAISE EXCEPTION 'No draft special orders found for trip ID %.', p_trip_id;
    END IF;

    SELECT plan_id INTO v_plan_id FROM receiving_route_trips WHERE trip_id = p_trip_id;

    v_picklist_code := 'PL-SP-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('picklists_id_seq')::TEXT, 4, '0');

    INSERT INTO public.picklists (picklist_code, trip_id, plan_id, status, created_by, created_from)
    VALUES (v_picklist_code, p_trip_id, v_plan_id, 'pending', p_user_id, 'special_trip')
    RETURNING id INTO v_new_picklist_id;

    INSERT INTO public.picklist_items (
        picklist_id,
        order_item_id,
        sku_id,
        stop_id,
        quantity_to_pick,
        source_location_id,
        order_id
    )
    SELECT
        v_new_picklist_id,
        oi.order_item_id,
        oi.sku_id,
        rs.stop_id,
        oi.order_qty,
        (SELECT location_id
         FROM wms_inventory_balances ib
         WHERE ib.sku_id = oi.sku_id
         ORDER BY last_movement_at DESC
         LIMIT 1),
        oi.order_id
    FROM wms_order_items oi
    JOIN wms_orders o ON oi.order_id = o.order_id
    LEFT JOIN receiving_route_stops rs ON rs.customer_id = o.customer_id
                                       AND rs.trip_id = p_trip_id
    WHERE o.matched_trip_id = p_trip_id
      AND o.order_type = 'special'
      AND oi.order_qty > 0;

    SELECT
        COUNT(*),
        SUM(pi.quantity_to_pick)
    INTO
        v_total_lines,
        v_total_quantity
    FROM picklist_items pi
    WHERE pi.picklist_id = v_new_picklist_id;

    UPDATE public.picklists
    SET
        total_lines = COALESCE(v_total_lines, 0),
        total_quantity = COALESCE(v_total_quantity, 0)
    WHERE id = v_new_picklist_id;

    UPDATE wms_orders
    SET
        status = 'confirmed',
        confirmed_at = NOW()
    WHERE matched_trip_id = p_trip_id
      AND order_type = 'special'
      AND status = 'draft';

    RETURN v_new_picklist_id;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error in create_picklist_for_special_trip: % - %', SQLSTATE, SQLERRM;
        RAISE;
END;
$$;


ALTER FUNCTION "public"."create_picklist_for_special_trip"("p_trip_id" bigint, "p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_picklist_for_special_trip"("p_trip_id" bigint, "p_user_id" "uuid") IS 'Creates a picklist for special orders matched to a trip. Pulls items directly from wms_order_items instead of receiving_route_stop_items.';



CREATE OR REPLACE FUNCTION "public"."create_picklist_for_trip"("p_trip_id" bigint, "p_user_id" "uuid") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_plan_id BIGINT;
    v_new_picklist_id BIGINT;
    v_picklist_code VARCHAR;
    v_total_lines INT;
    v_total_quantity NUMERIC;
    v_trip_exists BOOLEAN;
    v_default_location_id VARCHAR(50);
BEGIN
    -- 1. Validate trip_id
    SELECT EXISTS (SELECT 1 FROM receiving_route_trips WHERE trip_id = p_trip_id) INTO v_trip_exists;
    IF NOT v_trip_exists THEN
        RAISE EXCEPTION 'Trip with ID % does not exist.', p_trip_id;
    END IF;

    -- Check if a picklist already exists for this trip
    IF EXISTS (SELECT 1 FROM picklists WHERE trip_id = p_trip_id AND status <> 'cancelled') THEN
        RAISE EXCEPTION 'A picklist already exists for trip ID %.', p_trip_id;
    END IF;

    -- 2. Get plan_id from trip
    SELECT plan_id INTO v_plan_id FROM receiving_route_trips WHERE trip_id = p_trip_id;

    -- 3. Generate a new picklist_code
    v_picklist_code := 'PL-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('picklists_id_seq')::TEXT, 4, '0');

    -- 4. Create main picklist record
    INSERT INTO public.picklists (picklist_code, trip_id, plan_id, status, created_by)
    VALUES (v_picklist_code, p_trip_id, v_plan_id, 'pending', p_user_id)
    RETURNING id INTO v_new_picklist_id;

    -- 5. Insert items from all orders associated with trip's stops
    -- Use a more robust approach to get source_location_id
    INSERT INTO public.picklist_items (picklist_id, order_item_id, sku_id, stop_id, quantity_to_pick, source_location_id)
    SELECT 
        v_new_picklist_id,
        rsi.order_item_id,
        rsi.sku_id,
        rsi.stop_id,
        rsi.allocated_quantity,
        COALESCE(
            -- First try: use master_sku.default_location if it exists in master_location
            (SELECT ms.default_location 
             FROM master_sku ms 
             WHERE ms.sku_id = rsi.sku_id 
               AND EXISTS (SELECT 1 FROM master_location ml WHERE ml.location_id = ms.default_location)
             LIMIT 1),
            -- Second try: get any location from wms_inventory_balances for this SKU
            (SELECT ib.location_id 
             FROM wms_inventory_balances ib 
             WHERE ib.sku_id = rsi.sku_id 
               AND ib.location_id IS NOT NULL
             ORDER BY ib.last_movement_at DESC 
             LIMIT 1),
            -- Third try: use the first available location from master_location
            (SELECT ml.location_id 
             FROM master_location ml 
             WHERE ml.warehouse_id = (SELECT warehouse_id FROM receiving_route_trips WHERE trip_id = p_trip_id)
                 AND ml.active_status = 'active'
             ORDER BY ml.location_code 
             LIMIT 1),
            -- Last resort: use PK001 (which we added above)
            'PK001'
        )
    FROM receiving_route_stop_items rsi
    WHERE rsi.trip_id = p_trip_id
      AND rsi.allocated_quantity > 0
      AND rsi.order_item_id IS NOT NULL;

    -- 6. Update totals in picklist header
    SELECT 
        COUNT(*),
        SUM(pi.quantity_to_pick)
    INTO 
        v_total_lines,
        v_total_quantity
    FROM picklist_items pi
    WHERE pi.picklist_id = v_new_picklist_id;

    UPDATE public.picklists
    SET 
        total_lines = COALESCE(v_total_lines, 0),
        total_quantity = COALESCE(v_total_quantity, 0)
    WHERE id = v_new_picklist_id;

    -- 7. Return new picklist ID
    RETURN v_new_picklist_id;

EXCEPTION
    WHEN OTHERS THEN
        -- Log error and re-raise
        RAISE NOTICE 'Error in create_picklist_for_trip: % - %', SQLSTATE, SQLERRM;
        RAISE;
END;
$$;


ALTER FUNCTION "public"."create_picklist_for_trip"("p_trip_id" bigint, "p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_picklist_for_trip"("p_trip_id" bigint, "p_user_id" "uuid") IS 'Creates a complete picklist with all items based on a vehicle trip ID. Uses robust location selection logic to avoid foreign key violations.';



CREATE OR REPLACE FUNCTION "public"."create_preparation_order_with_locations"("p_warehouse_id" character varying, "p_order_type" character varying, "p_sku_items" "jsonb", "p_priority" "public"."preparation_priority_enum" DEFAULT 'normal'::"public"."preparation_priority_enum", "p_preparation_area_id" "uuid" DEFAULT NULL::"uuid", "p_reference_no" character varying DEFAULT NULL::character varying, "p_notes" "text" DEFAULT NULL::"text", "p_created_by" character varying DEFAULT NULL::character varying) RETURNS TABLE("success" boolean, "order_id" "uuid", "order_no" character varying, "message" "text", "items" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_order_id UUID;
    v_order_no VARCHAR;
    v_line_no INTEGER := 1;
    v_item JSONB;
    v_sku_id VARCHAR;
    v_quantity DECIMAL(18,2);
    v_uom VARCHAR;
    v_preparation_area_id UUID;
    v_location_id VARCHAR;
    v_location_info RECORD;
    v_error_message TEXT := '';
    v_items JSONB := '[]'::JSONB;
BEGIN
    -- Generate order number
    v_order_no := generate_preparation_order_no(p_warehouse_id);
    
    -- Determine preparation area if not specified
    IF p_preparation_area_id IS NULL THEN
        -- Find primary preparation area for the first SKU
        SELECT pam.preparation_area_id
        INTO v_preparation_area_id
        FROM sku_preparation_area_mapping pam
        JOIN preparation_area pa ON pa.area_id = pam.preparation_area_id
        WHERE pam.sku_id = (p_sku_items->0->>'sku_id')
          AND pam.warehouse_id = p_warehouse_id
          AND pa.status = 'active'
          AND (pam.effective_from IS NULL OR pam.effective_from <= CURRENT_DATE)
          AND (pam.effective_to IS NULL OR pam.effective_to >= CURRENT_DATE)
        ORDER BY pam.is_primary DESC, pam.priority
        LIMIT 1;
        
        IF v_preparation_area_id IS NULL THEN
            -- Use any active preparation area
            SELECT area_id INTO v_preparation_area_id
            FROM preparation_area
            WHERE warehouse_id = p_warehouse_id
              AND status = 'active'
            LIMIT 1;
        END IF;
    ELSE
        v_preparation_area_id := p_preparation_area_id;
    END IF;
    
    -- Create preparation order header
    INSERT INTO preparation_order (
        order_no,
        warehouse_id,
        order_type,
        preparation_area_id,
        priority,
        status,
        total_items,
        total_quantity,
        reference_no,
        notes,
        created_by
    ) VALUES (
        v_order_no,
        p_warehouse_id,
        p_order_type,
        v_preparation_area_id,
        p_priority,
        'pending',
        jsonb_array_length(p_sku_items),
        (SELECT SUM((item->>'quantity')::DECIMAL) FROM jsonb_array_elements(p_sku_items) AS item),
        p_reference_no,
        p_notes,
        p_created_by
    ) RETURNING order_id INTO v_order_id;
    
    -- Process each item
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_sku_items) AS item
    LOOP
        v_sku_id := v_item->>'sku_id';
        v_quantity := (v_item->>'quantity')::DECIMAL;
        v_uom := v_item->>'uom';
        
        -- Find location for the SKU based on mapping
        SELECT 
            ml.location_id,
            ml.location_code,
            ml.location_name,
            ml.zone,
            ml.aisle,
            ml.rack,
            ml.shelf,
            ml.bin
        INTO v_location_info
        FROM master_location ml
        JOIN wms_inventory_balances ib ON ib.location_id = ml.location_id
        LEFT JOIN sku_preparation_area_mapping pam ON pam.sku_id = ib.sku_id
        WHERE ib.warehouse_id = p_warehouse_id
          AND ib.sku_id = v_sku_id
          AND ib.total_piece_qty > 0
          AND ml.active_status = 'active'
          AND (pam.preparation_area_id IS NULL OR pam.preparation_area_id = v_preparation_area_id)
          AND (pam.required_zone IS NULL OR ml.zone = pam.required_zone)
          AND (pam.allowed_location_types IS NULL OR ml.location_type = ANY(pam.allowed_location_types))
        ORDER BY 
            pam.is_primary DESC, 
            pam.priority,
            ml.zone,
            ml.aisle,
            ml.rack,
            ml.shelf,
            ml.bin
        LIMIT 1;
        
        IF v_location_info.location_id IS NULL THEN
            v_error_message := 'ไม่พบตำแหน่งสินค้าสำหรับ SKU: ' || v_sku_id;
            
            -- Insert item without location assignment
            INSERT INTO preparation_order_item (
                order_id,
                line_no,
                sku_id,
                required_quantity,
                uom,
                status,
                notes,
                created_by
            ) VALUES (
                v_order_id,
                v_line_no,
                v_sku_id,
                v_quantity,
                v_uom,
                'pending',
                'ไม่พบตำแหน่งสินค้า',
                p_created_by
            );
        ELSE
            -- Insert item with location assignment
            INSERT INTO preparation_order_item (
                order_id,
                line_no,
                sku_id,
                required_quantity,
                uom,
                status,
                assigned_location_id,
                notes,
                created_by
            ) VALUES (
                v_order_id,
                v_line_no,
                v_sku_id,
                v_quantity,
                v_uom,
                'assigned',
                v_location_info.location_id,
                'กำหนดตำแหน่งสินค้าอัตโนมัติ',
                p_created_by
            );
        END IF;
        
        -- Add to result items
        v_items := v_items || jsonb_build_object(
            'line_no', v_line_no,
            'sku_id', v_sku_id,
            'quantity', v_quantity,
            'uom', v_uom,
            'assigned_location_id', COALESCE(v_location_info.location_id, NULL),
            'location_code', COALESCE(v_location_info.location_code, NULL),
            'location_name', COALESCE(v_location_info.location_name, NULL),
            'zone', COALESCE(v_location_info.zone, NULL),
            'aisle', COALESCE(v_location_info.aisle, NULL),
            'rack', COALESCE(v_location_info.rack, NULL),
            'shelf', COALESCE(v_location_info.shelf, NULL),
            'bin', COALESCE(v_location_info.bin, NULL),
            'status', CASE WHEN v_location_info.location_id IS NULL THEN 'error' ELSE 'assigned' END,
            'message', CASE WHEN v_location_info.location_id IS NULL THEN v_error_message ELSE 'กำหนดตำแหน่งสินค้าสำเร็จ' END
        );
        
        v_line_no := v_line_no + 1;
    END LOOP;
    
    -- Return result
    RETURN QUERY SELECT 
        TRUE AS success,
        v_order_id AS order_id,
        v_order_no AS order_no,
        COALESCE(v_error_message, 'สร้างใบจัดเตรียมสินค้าสำเร็จ') AS message,
        v_items AS items;
    
    RETURN;
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 
        FALSE AS success,
        NULL AS order_id,
        NULL AS order_no,
        SQLERRM AS message,
        '[]'::JSONB AS items;
    RETURN;
END;
$$;


ALTER FUNCTION "public"."create_preparation_order_with_locations"("p_warehouse_id" character varying, "p_order_type" character varying, "p_sku_items" "jsonb", "p_priority" "public"."preparation_priority_enum", "p_preparation_area_id" "uuid", "p_reference_no" character varying, "p_notes" "text", "p_created_by" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_replenishment_tasks"("p_warehouse_id" "uuid", "p_trigger_source" character varying DEFAULT 'manual'::character varying, "p_trigger_reference" character varying DEFAULT NULL::character varying) RETURNS TABLE("queue_id" "uuid", "sku_id" character varying, "pick_zone_name" character varying, "requested_qty" integer, "priority" integer)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_queue_record RECORD;
BEGIN
    FOR v_queue_record IN
        SELECT
            gen_random_uuid() AS new_queue_id,
            vw.rule_id,
            vw.warehouse_id,
            vw.sku_id,
            vw.pick_zone_id,
            vw.pick_zone_name,
            vw.replen_needed_qty,
            CASE
                WHEN vw.rule_priority = 'urgent' THEN 10
                WHEN vw.rule_priority = 'high' THEN 8
                WHEN vw.rule_priority = 'normal' THEN 5
                WHEN vw.rule_priority = 'low' THEN 3
                ELSE 5
            END AS calc_priority
        FROM
            vw_pick_zone_stock_status vw
        WHERE
            vw.warehouse_id = p_warehouse_id
            AND vw.needs_replenishment = TRUE
            AND vw.replen_needed_qty > 0
            AND NOT EXISTS (
                SELECT 1
                FROM replenishment_queue rq
                WHERE rq.sku_id = vw.sku_id
                  AND rq.pick_zone_id = vw.pick_zone_id
                  AND rq.status IN ('pending', 'assigned', 'in_progress')
            )
    LOOP
        INSERT INTO replenishment_queue (
            queue_id,
            rule_id,
            warehouse_id,
            sku_id,
            pick_zone_id,
            requested_qty,
            priority,
            status,
            trigger_source,
            trigger_reference
        ) VALUES (
            v_queue_record.new_queue_id,
            v_queue_record.rule_id,
            v_queue_record.warehouse_id,
            v_queue_record.sku_id,
            v_queue_record.pick_zone_id,
            v_queue_record.replen_needed_qty,
            v_queue_record.calc_priority,
            'pending',
            p_trigger_source,
            p_trigger_reference
        );

        queue_id := v_queue_record.new_queue_id;
        sku_id := v_queue_record.sku_id;
        pick_zone_name := v_queue_record.pick_zone_name;
        requested_qty := v_queue_record.replen_needed_qty;
        priority := v_queue_record.calc_priority;

        RETURN NEXT;
    END LOOP;
END;
$$;


ALTER FUNCTION "public"."create_replenishment_tasks"("p_warehouse_id" "uuid", "p_trigger_source" character varying, "p_trigger_reference" character varying) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_replenishment_tasks"("p_warehouse_id" "uuid", "p_trigger_source" character varying, "p_trigger_reference" character varying) IS 'สร้างคิวงานเติมสต็อกอัตโนมัติตามกฎที่กำหนดไว้';



CREATE OR REPLACE FUNCTION "public"."debug_plan_orders"("p_plan_id" bigint) RETURNS TABLE("stop_id" bigint, "order_id" bigint, "tags_json" "jsonb", "extracted_order_ids" bigint[], "current_order_status" character varying)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_tags_column_exists BOOLEAN;
    v_order_id_column_exists BOOLEAN;
BEGIN
    -- Check if columns exist
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'receiving_route_stops' 
        AND column_name = 'tags'
    ) INTO v_tags_column_exists;

    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'receiving_route_stops' 
        AND column_name = 'order_id'
    ) INTO v_order_id_column_exists;

    RETURN QUERY
    SELECT 
        rs.stop_id,
        CASE WHEN v_order_id_column_exists THEN rs.order_id ELSE NULL END,
        CASE WHEN v_tags_column_exists THEN rs.tags ELSE NULL END,
        CASE 
            WHEN v_tags_column_exists AND rs.tags->>'order_ids' IS NOT NULL THEN
                ARRAY(
                    SELECT jsonb_array_elements_text(rs.tags->'order_ids')::BIGINT
                )
            ELSE NULL
        END as extracted_order_ids,
        wo.status as current_order_status
    FROM public.receiving_route_stops rs
    LEFT JOIN public.wms_orders wo ON (
        (v_order_id_column_exists AND wo.order_id = rs.order_id) OR 
        (v_tags_column_exists AND wo.order_id = ANY(
            CASE 
                WHEN rs.tags->>'order_ids' IS NOT NULL THEN
                    ARRAY(
                        SELECT jsonb_array_elements_text(rs.tags->'order_ids')::BIGINT
                    )
                ELSE NULL
            END
        ))
    )
    WHERE rs.plan_id = p_plan_id;
END;
$$;


ALTER FUNCTION "public"."debug_plan_orders"("p_plan_id" bigint) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."debug_plan_orders"("p_plan_id" bigint) IS 'Debug function to show which orders are linked to a plan and their current status. Handles cases where columns might not exist. Fixed unnest function compatibility issue.';



CREATE OR REPLACE FUNCTION "public"."debug_plan_orders_comprehensive"("p_plan_id" bigint) RETURNS TABLE("source" character varying, "customer_id" character varying, "order_id" bigint, "order_code" character varying, "customer_name" character varying, "current_order_status" character varying)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Direct order_ids from stops
    RETURN QUERY
    SELECT 
        'direct_stop' as source,
        rs.customer_id,
        rs.order_id,
        wo.order_code,
        mc.customer_name,
        wo.status as current_order_status
    FROM public.receiving_route_stops rs
    LEFT JOIN public.wms_orders wo ON wo.order_id = rs.order_id
    LEFT JOIN public.master_customer mc ON mc.customer_id = rs.customer_id
    WHERE rs.plan_id = p_plan_id
      AND rs.order_id IS NOT NULL;
    
    -- Order_ids from tags
    RETURN QUERY
    SELECT 
        'tags_json' as source,
        rs.customer_id,
        jsonb_array_elements_text(rs.tags->'order_ids')::BIGINT as order_id,
        wo.order_code,
        mc.customer_name,
        wo.status as current_order_status
    FROM public.receiving_route_stops rs
    LEFT JOIN public.wms_orders wo ON wo.order_id = jsonb_array_elements_text(rs.tags->'order_ids')::BIGINT
    LEFT JOIN public.master_customer mc ON mc.customer_id = rs.customer_id
    WHERE rs.plan_id = p_plan_id
      AND rs.tags IS NOT NULL
      AND rs.tags->>'order_ids' IS NOT NULL;
    
    -- All orders for customers in the plan
    RETURN QUERY
    SELECT 
        'customer_all' as source,
        rs.customer_id,
        wo.order_id,
        wo.order_code,
        mc.customer_name,
        wo.status as current_order_status
    FROM public.receiving_route_stops rs
    JOIN public.wms_orders wo ON wo.customer_id = rs.customer_id
    LEFT JOIN public.master_customer mc ON mc.customer_id = rs.customer_id
    WHERE rs.plan_id = p_plan_id
      AND rs.customer_id IS NOT NULL
      AND wo.order_id IS NOT NULL;
END;
$$;


ALTER FUNCTION "public"."debug_plan_orders_comprehensive"("p_plan_id" bigint) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."debug_plan_orders_comprehensive"("p_plan_id" bigint) IS 'Comprehensive debug function showing all orders that will be updated from all sources: direct stops, tags JSON, and all customer orders.';



CREATE OR REPLACE FUNCTION "public"."fix_master_sku_default_locations"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_updated_count INT;
BEGIN
    -- Update SKUs that have default_location not in master_location
    -- Set them to a valid location from the same warehouse
    UPDATE master_sku ms
    SET default_location = (
        SELECT ml.location_id
        FROM master_location ml
        JOIN master_warehouse mw ON ml.warehouse_id = mw.warehouse_id
        WHERE ml.active_status = 'active'
        ORDER BY ml.location_code
        LIMIT 1
    )
    WHERE ms.default_location IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM master_location ml 
          WHERE ml.location_id = ms.default_location
      );
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    
    RAISE NOTICE 'Updated % SKU records with invalid default_location values', v_updated_count;
END;
$$;


ALTER FUNCTION "public"."fix_master_sku_default_locations"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fix_master_sku_default_locations"() IS 'Updates master_sku.default_location to valid location IDs. Call this function to fix data consistency issues.';



CREATE OR REPLACE FUNCTION "public"."generate_bonus_face_sheet_no"() RETURNS character varying
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_date_str VARCHAR;
    v_seq INTEGER;
    v_face_sheet_no VARCHAR;
BEGIN
    -- สร้างรูปแบบ BFS-YYYYMMDD-XXX
    v_date_str := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
    
    -- หาลำดับถัดไป
    SELECT COALESCE(MAX(CAST(SUBSTRING(face_sheet_no FROM 'BFS-[0-9]{8}-([0-9]{3})') AS INTEGER)), 0) + 1
    INTO v_seq
    FROM public.bonus_face_sheets
    WHERE face_sheet_no LIKE 'BFS-' || v_date_str || '-%';
    
    -- สร้างเลขที่
    v_face_sheet_no := 'BFS-' || v_date_str || '-' || LPAD(v_seq::TEXT, 3, '0');
    
    RETURN v_face_sheet_no;
END;
$$;


ALTER FUNCTION "public"."generate_bonus_face_sheet_no"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."generate_bonus_face_sheet_no"() IS 'สร้างเลขที่ใบปะหน้าของแถมอัตโนมัติ (BFS-YYYYMMDD-XXX)';



CREATE OR REPLACE FUNCTION "public"."generate_face_sheet_no"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    date_part TEXT;
    sequence_num INTEGER;
BEGIN
    date_part := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');

    SELECT COALESCE(MAX(CAST(SUBSTRING(face_sheet_no FROM 12) AS INTEGER)), 0) + 1
    INTO sequence_num
    FROM face_sheets
    WHERE face_sheet_no LIKE 'FS-' || date_part || '-%';

    RETURN 'FS-' || date_part || '-' || LPAD(sequence_num::TEXT, 3, '0');
END;
$$;


ALTER FUNCTION "public"."generate_face_sheet_no"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_issue_no"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $_$
DECLARE
  current_year TEXT;
  next_sequence INT;
  new_issue_no TEXT;
BEGIN
  current_year := TO_CHAR(CURRENT_DATE, 'YYYY');

  SELECT COALESCE(MAX(
    CASE
      WHEN issue_no ~ ('^ISU-' || current_year || '-[0-9]+$')
      THEN CAST(SUBSTRING(issue_no FROM LENGTH('ISU-' || current_year || '-') + 1) AS INTEGER)
      ELSE 0
    END
  ), 0) + 1
  INTO next_sequence
  FROM material_issues
  WHERE issue_no LIKE 'ISU-' || current_year || '-%';

  new_issue_no := 'ISU-' || current_year || '-' || LPAD(next_sequence::TEXT, 4, '0');

  RETURN new_issue_no;
END;
$_$;


ALTER FUNCTION "public"."generate_issue_no"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."generate_issue_no"() IS 'สร้างหมายเลขเบิกวัตถุดิบอัตโนมัติ (ISU-YYYY-NNNN)';



CREATE OR REPLACE FUNCTION "public"."generate_lot_no"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $_$
DECLARE
  current_month TEXT;
  next_sequence INT;
  new_lot_no TEXT;
BEGIN
  current_month := TO_CHAR(CURRENT_DATE, 'YYYYMM');

  SELECT COALESCE(MAX(
    CASE
      WHEN lot_no ~ ('^LOT-' || current_month || '-[0-9]+$')
      THEN CAST(SUBSTRING(lot_no FROM LENGTH('LOT-' || current_month || '-') + 1) AS INTEGER)
      ELSE 0
    END
  ), 0) + 1
  INTO next_sequence
  FROM production_receipts
  WHERE lot_no LIKE 'LOT-' || current_month || '-%';

  new_lot_no := 'LOT-' || current_month || '-' || LPAD(next_sequence::TEXT, 3, '0');

  RETURN new_lot_no;
END;
$_$;


ALTER FUNCTION "public"."generate_lot_no"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."generate_lot_no"() IS 'สร้างหมายเลขล็อตอัตโนมัติ (LOT-YYYYMM-NNN)';



CREATE OR REPLACE FUNCTION "public"."generate_move_no"("p_move_type" "public"."move_type_enum", "p_pallet_id" character varying DEFAULT NULL::character varying) RETURNS character varying
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_prefix VARCHAR(10);
    v_year VARCHAR(4);
    v_month VARCHAR(2);
    v_sequence INT;
    v_move_no VARCHAR(50);
    v_is_unreceived BOOLEAN;
BEGIN
    v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
    v_month := TO_CHAR(CURRENT_DATE, 'MM');

    -- ถ้าระบุ pallet_id ให้ตรวจสอบว่าเป็น pallet ที่พึ่งรับหรือไม่
    IF p_pallet_id IS NOT NULL AND p_pallet_id != '' THEN
        v_is_unreceived := check_pallet_is_unreceived(p_pallet_id);

        -- ถ้าเป็น pallet ที่พึ่งรับโดยยังไม่ได้เก็บ ให้ใช้ prefix PUT (Putaway)
        IF v_is_unreceived THEN
            v_prefix := 'PUT';
        ELSE
            -- ถ้าไม่ใช่ ให้ใช้ prefix ตาม move_type ที่ระบุ
            CASE p_move_type
                WHEN 'putaway' THEN v_prefix := 'PUT';
                WHEN 'transfer' THEN v_prefix := 'TRF';
                WHEN 'replenishment' THEN v_prefix := 'REP';
                WHEN 'adjustment' THEN v_prefix := 'ADJ';
                ELSE v_prefix := 'MOV';
            END CASE;
        END IF;
    ELSE
        -- ถ้าไม่ระบุ pallet_id ให้ใช้ prefix ตาม move_type
        CASE p_move_type
            WHEN 'putaway' THEN v_prefix := 'PUT';
            WHEN 'transfer' THEN v_prefix := 'TRF';
            WHEN 'replenishment' THEN v_prefix := 'REP';
            WHEN 'adjustment' THEN v_prefix := 'ADJ';
            ELSE v_prefix := 'MOV';
        END CASE;
    END IF;

    -- หา sequence ล่าสุดสำหรับ prefix+year+month นี้
    SELECT COALESCE(MAX(
        CAST(SUBSTRING(move_no FROM LENGTH(v_prefix || '-' || v_year || v_month) + 1) AS INT)
    ), 0) + 1
    INTO v_sequence
    FROM wms_moves
    WHERE move_no LIKE v_prefix || '-' || v_year || v_month || '%';

    -- สร้างเลขที่ใบย้ายในรูปแบบ PREFIX-YYYYMM####
    v_move_no := v_prefix || '-' || v_year || v_month || LPAD(v_sequence::TEXT, 4, '0');

    RETURN v_move_no;
END;
$$;


ALTER FUNCTION "public"."generate_move_no"("p_move_type" "public"."move_type_enum", "p_pallet_id" character varying) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."generate_move_no"("p_move_type" "public"."move_type_enum", "p_pallet_id" character varying) IS 'สร้างเลขที่ใบย้ายอัตโนมัติตามประเภทของการย้าย (PUT=Putaway, TRF=Transfer, REP=Replenishment, ADJ=Adjustment)';



CREATE OR REPLACE FUNCTION "public"."generate_preparation_order_no"("p_warehouse_id" character varying) RETURNS character varying
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_prefix VARCHAR := 'PREP';
    v_year_month VARCHAR := TO_CHAR(NOW(), 'YYMM');
    v_sequence INTEGER;
    v_order_no VARCHAR;
BEGIN
    -- Get next sequence
    SELECT COALESCE(MAX(CAST(SUBSTRING(order_no, 9, 4) AS INTEGER)), 0) + 1
    INTO v_sequence
    FROM preparation_order
    WHERE warehouse_id = p_warehouse_id
      AND order_no LIKE v_prefix || v_year_month || '%';
    
    -- Format order number
    v_order_no := v_prefix || v_year_month || LPAD(v_sequence::TEXT, 4, '0');
    
    RETURN v_order_no;
END;
$$;


ALTER FUNCTION "public"."generate_preparation_order_no"("p_warehouse_id" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_production_no"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $_$
DECLARE
  current_year TEXT;
  next_sequence INT;
  new_po_no TEXT;
BEGIN
  current_year := TO_CHAR(CURRENT_DATE, 'YYYY');

  SELECT COALESCE(MAX(
    CASE
      WHEN production_no ~ ('^PO-' || current_year || '-[0-9]+$')
      THEN CAST(SUBSTRING(production_no FROM LENGTH('PO-' || current_year || '-') + 1) AS INTEGER)
      ELSE 0
    END
  ), 0) + 1
  INTO next_sequence
  FROM production_orders
  WHERE production_no LIKE 'PO-' || current_year || '-%';

  new_po_no := 'PO-' || current_year || '-' || LPAD(next_sequence::TEXT, 4, '0');

  RETURN new_po_no;
END;
$_$;


ALTER FUNCTION "public"."generate_production_no"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."generate_production_no"() IS 'สร้างหมายเลขคำสั่งผลิตอัตโนมัติ (PO-YYYY-NNNN)';



CREATE OR REPLACE FUNCTION "public"."generate_receipt_no"() RETURNS character varying
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  next_seq INTEGER;
  new_receipt_no VARCHAR(50);
BEGIN
  -- นับจำนวน receipt ในวันนี้
  SELECT COUNT(*) + 1 INTO next_seq
  FROM production_receipts
  WHERE receipt_date = CURRENT_DATE;

  -- สร้างเลขที่: PR-YYYYMMDD-XXXX
  new_receipt_no := 'PR-' ||
                    TO_CHAR(CURRENT_DATE, 'YYYYMMDD') ||
                    '-' ||
                    LPAD(next_seq::TEXT, 4, '0');

  RETURN new_receipt_no;
END;
$$;


ALTER FUNCTION "public"."generate_receipt_no"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."generate_receipt_no"() IS 'สร้างเลขที่ใบรับสินค้าสำเร็จรูปอัตโนมัติ';



CREATE OR REPLACE FUNCTION "public"."generate_return_no"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $_$
DECLARE
  current_year TEXT;
  next_sequence INT;
  new_return_no TEXT;
BEGIN
  current_year := TO_CHAR(CURRENT_DATE, 'YYYY');

  SELECT COALESCE(MAX(
    CASE
      WHEN return_no ~ ('^RTN-' || current_year || '-[0-9]+$')
      THEN CAST(SUBSTRING(return_no FROM LENGTH('RTN-' || current_year || '-') + 1) AS INTEGER)
      ELSE 0
    END
  ), 0) + 1
  INTO next_sequence
  FROM material_returns
  WHERE return_no LIKE 'RTN-' || current_year || '-%';

  new_return_no := 'RTN-' || current_year || '-' || LPAD(next_sequence::TEXT, 4, '0');

  RETURN new_return_no;
END;
$_$;


ALTER FUNCTION "public"."generate_return_no"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."generate_return_no"() IS 'สร้างหมายเลขคืนวัตถุดิบอัตโนมัติ (RTN-YYYY-NNNN)';



CREATE OR REPLACE FUNCTION "public"."generate_scanner_friendly_code"("p_order_no" character varying, "p_product_code" character varying, "p_package_seq" integer) RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    order_digits TEXT;
    product_digits TEXT;
    timestamp_short TEXT;
BEGIN
    order_digits := REGEXP_REPLACE(COALESCE(p_order_no, '0000'), '[^0-9]', '', 'g');
    product_digits := REGEXP_REPLACE(COALESCE(p_product_code, 'SKU'), '[^0-9A-Z]', '', 'g');
    timestamp_short := LPAD((EXTRACT(EPOCH FROM NOW())::BIGINT % 10000)::TEXT, 4, '0');

    RETURN 'P' ||
           LPAD(SUBSTRING(order_digits, 1, 4), 4, '0') ||
           LPAD(SUBSTRING(product_digits, 1, 4), 4, '0') ||
           LPAD(p_package_seq::TEXT, 3, '0') ||
           timestamp_short;
END;
$$;


ALTER FUNCTION "public"."generate_scanner_friendly_code"("p_order_no" character varying, "p_product_code" character varying, "p_package_seq" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_sequence_no"("prefix" "text", "date_part" "text" DEFAULT NULL::"text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    date_str TEXT;
    next_seq INTEGER;
    sequence_no TEXT;
BEGIN
    -- Use current date if date_part not provided
    IF date_part IS NULL THEN
        date_str := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
    ELSE
        date_str := date_part;
    END IF;
    
    -- This is a simplified version - in production, use a proper sequence table
    next_seq := EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::INTEGER % 100000;
    
    sequence_no := prefix || '-' || date_str || '-' || LPAD(next_seq::TEXT, 6, '0');
    
    RETURN sequence_no;
END;
$$;


ALTER FUNCTION "public"."generate_sequence_no"("prefix" "text", "date_part" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_stock_import_batch_id"() RETURNS character varying
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    new_id VARCHAR(100);
    seq_num INTEGER;
    date_part VARCHAR(8);
BEGIN
    -- Get date in YYYYMMDD format
    date_part := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');

    -- Get next sequence number
    seq_num := nextval('wms_stock_import_batch_seq');

    -- Format: IMP-YYYYMMDD-XXX
    new_id := 'IMP-' || date_part || '-' || LPAD(seq_num::TEXT, 3, '0');

    RETURN new_id;
END;
$$;


ALTER FUNCTION "public"."generate_stock_import_batch_id"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."generate_stock_import_batch_id"() IS 'สร้างรหัส batch สำหรับการนำเข้าสต็อก (เช่น IMP-20251119-001)';



CREATE OR REPLACE FUNCTION "public"."generate_task_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    prefix VARCHAR(5);
    sequence_num INTEGER;
    new_task_no VARCHAR(100);
BEGIN
    -- Determine prefix based on task type
    CASE NEW.task_type
        WHEN 'putaway' THEN prefix := 'PA';
        WHEN 'replenishment' THEN prefix := 'REP';
        WHEN 'relocation' THEN prefix := 'REL';
        WHEN 'consolidation' THEN prefix := 'CON';
        WHEN 'cycle_count' THEN prefix := 'CC';
        WHEN 'maintenance' THEN prefix := 'MNT';
        WHEN 'quality_check' THEN prefix := 'QC';
        ELSE prefix := 'MV';
    END CASE;
    
    -- Get next sequence number for today
    SELECT COALESCE(MAX(
        CAST(SUBSTRING(task_no FROM LENGTH(prefix) + 12) AS INTEGER)
    ), 0) + 1
    INTO sequence_num
    FROM wms_warehouse_task 
    WHERE task_no LIKE prefix || '-' || TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD') || '-%';
    
    -- Generate new task number: PA-2025-01-20-001
    new_task_no := prefix || '-' || TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD') || '-' || 
                   LPAD(sequence_num::TEXT, 3, '0');
    
    NEW.task_no := new_task_no;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_task_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_available_employees_by_role"("p_wms_role" "public"."wms_role_enum", "p_warehouse_id" character varying DEFAULT NULL::character varying) RETURNS TABLE("employee_id" bigint, "employee_code" character varying, "first_name" character varying, "last_name" character varying, "email" character varying, "wms_role" "public"."wms_role_enum")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.employee_id,
        e.employee_code,
        e.first_name,
        e.last_name,
        e.email,
        e.wms_role
    FROM master_employee e
    WHERE e.wms_role = p_wms_role
    AND (
        p_warehouse_id IS NULL 
        OR e.allowed_warehouses IS NULL 
        OR e.allowed_warehouses::jsonb ? p_warehouse_id
    )
    ORDER BY e.first_name, e.last_name;
END;
$$;


ALTER FUNCTION "public"."get_available_employees_by_role"("p_wms_role" "public"."wms_role_enum", "p_warehouse_id" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_available_locations_for_preparation"("p_warehouse_id" character varying, "p_sku_id" character varying, "p_preparation_area_id" "uuid" DEFAULT NULL::"uuid", "p_required_quantity" numeric DEFAULT 0) RETURNS TABLE("location_id" character varying, "location_code" character varying, "location_name" character varying, "zone" character varying, "aisle" character varying, "rack" character varying, "shelf" character varying, "bin" character varying, "location_type" character varying, "available_quantity" numeric, "total_quantity" numeric, "pallet_id" character varying, "pallet_id_external" character varying, "lot_no" character varying, "production_date" "date", "expiry_date" "date", "priority" integer, "distance_score" numeric)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    WITH sku_mapping AS (
        SELECT 
            pam.allowed_location_types,
            pam.required_zone,
            pam.priority AS mapping_priority,
            pam.is_primary
        FROM sku_preparation_area_mapping pam
        WHERE pam.sku_id = p_sku_id
          AND pam.warehouse_id = p_warehouse_id
          AND (pam.preparation_area_id = p_preparation_area_id OR p_preparation_area_id IS NULL)
          AND (pam.effective_from IS NULL OR pam.effective_from <= CURRENT_DATE)
          AND (pam.effective_to IS NULL OR pam.effective_to >= CURRENT_DATE)
        ORDER BY pam.is_primary DESC, pam.priority
        LIMIT 1
    ),
    location_inventory AS (
        SELECT 
            ib.location_id,
            ib.sku_id,
            ib.total_piece_qty,
            ib.pallet_id,
            ib.pallet_id_external,
            ib.lot_no,
            ib.production_date,
            ib.expiry_date,
            ml.location_code,
            ml.location_name,
            ml.zone,
            ml.aisle,
            ml.rack,
            ml.shelf,
            ml.bin,
            ml.location_type,
            sm.allowed_location_types,
            sm.required_zone,
            sm.mapping_priority,
            sm.is_primary,
            -- Calculate distance score (simplified - can be enhanced with actual distance calculation)
            CASE 
                WHEN sm.required_zone IS NOT NULL AND ml.zone = sm.required_zone THEN 100
                WHEN sm.required_zone IS NULL THEN 90
                ELSE 50
            END +
            CASE 
                WHEN sm.allowed_location_types IS NOT NULL AND ml.location_type = ANY(sm.allowed_location_types) THEN 20
                WHEN sm.allowed_location_types IS NULL THEN 10
                ELSE 0
            END +
            CASE 
                WHEN sm.is_primary THEN 30
                ELSE 0
            END AS distance_score
        FROM wms_inventory_balances ib
        JOIN master_location ml ON ml.location_id = ib.location_id
        LEFT JOIN sku_mapping sm ON TRUE
        WHERE ib.warehouse_id = p_warehouse_id
          AND ib.sku_id = p_sku_id
          AND ib.total_piece_qty > 0
          AND ml.active_status = 'active'
          AND (sm.required_zone IS NULL OR ml.zone = sm.required_zone)
          AND (sm.allowed_location_types IS NULL OR ml.location_type = ANY(sm.allowed_location_types))
          AND (p_required_quantity = 0 OR ib.total_piece_qty >= p_required_quantity)
    )
    SELECT 
        li.location_id,
        li.location_code,
        li.location_name,
        li.zone,
        li.aisle,
        li.rack,
        li.shelf,
        li.bin,
        li.location_type,
        li.total_piece_qty AS available_quantity,
        li.total_piece_qty AS total_quantity,
        li.pallet_id,
        li.pallet_id_external,
        li.lot_no,
        li.production_date,
        li.expiry_date,
        COALESCE(li.mapping_priority, 50) AS priority,
        li.distance_score
    FROM location_inventory li
    ORDER BY 
        li.distance_score DESC,
        li.mapping_priority,
        li.zone,
        li.aisle,
        li.rack,
        li.shelf,
        li.bin,
        li.expiry_date NULLS FIRST;
END;
$$;


ALTER FUNCTION "public"."get_available_locations_for_preparation"("p_warehouse_id" character varying, "p_sku_id" character varying, "p_preparation_area_id" "uuid", "p_required_quantity" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_face_sheet_details"("p_face_sheet_id" bigint) RETURNS TABLE("face_sheet_no" character varying, "status" character varying, "created_date" "date", "total_packages" integer, "total_items" integer, "total_orders" integer, "small_size_count" integer, "large_size_count" integer, "packages" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        fs.face_sheet_no,
        fs.status,
        fs.created_date,
        fs.total_packages,
        fs.total_items,
        fs.total_orders,
        fs.small_size_count,
        fs.large_size_count,
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', pkg.id,
                        'package_number', pkg.package_number,
                        'barcode_id', pkg.barcode_id,
                        'order_no', pkg.order_no,
                        'shop_name', pkg.shop_name,
                        'product_code', pkg.product_code,
                        'product_name', pkg.product_name,
                        'size', pkg.size,
                        'size_category', pkg.size_category,
                        'package_type', pkg.package_type,
                        'pieces_per_pack', pkg.pieces_per_pack,
                        'address', pkg.address,
                        'province', pkg.province,
                        'contact_name', pkg.contact_name,
                        'phone', pkg.phone,
                        'hub', pkg.hub,
                        'notes', pkg.notes
                    )
                    ORDER BY pkg.package_number
                )
                FROM face_sheet_packages pkg
                WHERE pkg.face_sheet_id = fs.id  -- ใช้ fs.id แทน face_sheet_id เพื่อหลีกเลี่ยง ambiguous error
            ),
            '[]'::jsonb
        ) as packages
    FROM face_sheets fs
    WHERE fs.id = p_face_sheet_id;
END;
$$;


ALTER FUNCTION "public"."get_face_sheet_details"("p_face_sheet_id" bigint) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_face_sheet_details"("p_face_sheet_id" bigint) IS 'ดึงรายละเอียดใบปะหน้าสินค้าพร้อม packages (แก้ไข ambiguous column error โดยใช้ alias pkg.face_sheet_id = fs.id)';



CREATE OR REPLACE FUNCTION "public"."get_freight_rate_for_route"("p_origin_province" character varying, "p_destination_province" character varying, "p_carrier_id" bigint DEFAULT NULL::bigint, "p_rate_date" "date" DEFAULT CURRENT_DATE) RETURNS TABLE("freight_rate_id" bigint, "carrier_id" bigint, "route_name" character varying, "base_price" numeric, "price_unit" character varying, "calculated_price_per_km" numeric)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fr.freight_rate_id,
        fr.carrier_id,
        fr.route_name,
        fr.base_price,
        fr.price_unit,
        fr.calculated_price_per_km
    FROM master_freight_rate fr
    WHERE fr.origin_province = p_origin_province
        AND fr.destination_province = p_destination_province
        AND fr.effective_start_date <= p_rate_date
        AND (fr.effective_end_date IS NULL OR fr.effective_end_date >= p_rate_date)
        AND (p_carrier_id IS NULL OR fr.carrier_id = p_carrier_id)
    ORDER BY fr.effective_start_date DESC;
END;
$$;


ALTER FUNCTION "public"."get_freight_rate_for_route"("p_origin_province" character varying, "p_destination_province" character varying, "p_carrier_id" bigint, "p_rate_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_freight_rate_for_route"("p_origin_province" character varying, "p_destination_province" character varying, "p_carrier_id" bigint, "p_rate_date" "date") IS 'Function to get applicable freight rates for a specific route and date';



CREATE OR REPLACE FUNCTION "public"."get_materials_fefo"("p_sku_id" character varying, "p_required_qty" numeric) RETURNS TABLE("pallet_id_external" character varying, "location_id" character varying, "location_code" character varying, "lot_no" character varying, "production_date" "date", "expiry_date" "date", "available_qty" numeric, "uom" character varying)
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    ib.pallet_id_external,
    ib.location_id,
    wl.location_code,
    ib.lot_no,
    ib.production_date,
    ib.expiry_date,
    (ib.total_piece_qty - ib.reserved_piece_qty) AS available_qty,
    ms.uom_base AS uom
  FROM wms_inventory_balances ib
  INNER JOIN master_location wl ON ib.location_id = wl.location_id
  INNER JOIN master_sku ms ON ib.sku_id = ms.sku_id
  WHERE ib.sku_id = p_sku_id
    AND (ib.total_piece_qty - ib.reserved_piece_qty) > 0
    AND ib.expiry_date IS NOT NULL
  ORDER BY
    ib.expiry_date ASC,
    ib.production_date ASC NULLS LAST,
    ib.created_at ASC
  LIMIT 50;
END;
$$;


ALTER FUNCTION "public"."get_materials_fefo"("p_sku_id" character varying, "p_required_qty" numeric) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_materials_fefo"("p_sku_id" character varying, "p_required_qty" numeric) IS 'ค้นหาวัตถุดิบตาม FEFO (First Expired, First Out) - สำหรับสินค้าที่มีวันหมดอายุ';



CREATE OR REPLACE FUNCTION "public"."get_materials_fifo"("p_sku_id" character varying, "p_required_qty" numeric) RETURNS TABLE("pallet_id_external" character varying, "location_id" character varying, "location_code" character varying, "lot_no" character varying, "production_date" "date", "expiry_date" "date", "available_qty" numeric, "uom" character varying)
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    ib.pallet_id_external,
    ib.location_id,
    wl.location_code,
    ib.lot_no,
    ib.production_date,
    ib.expiry_date,
    (ib.total_piece_qty - ib.reserved_piece_qty) AS available_qty,
    ms.uom_base AS uom
  FROM wms_inventory_balances ib
  INNER JOIN master_location wl ON ib.location_id = wl.location_id
  INNER JOIN master_sku ms ON ib.sku_id = ms.sku_id
  WHERE ib.sku_id = p_sku_id
    AND (ib.total_piece_qty - ib.reserved_piece_qty) > 0
    AND ib.expiry_date IS NULL
  ORDER BY
    ib.production_date ASC NULLS LAST,
    ib.created_at ASC
  LIMIT 50;
END;
$$;


ALTER FUNCTION "public"."get_materials_fifo"("p_sku_id" character varying, "p_required_qty" numeric) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_materials_fifo"("p_sku_id" character varying, "p_required_qty" numeric) IS 'ค้นหาวัตถุดิบตาม FIFO (First In, First Out) - สำหรับสินค้าที่ไม่มีวันหมดอายุ';



CREATE OR REPLACE FUNCTION "public"."get_picklist_item_reserved_qty"("p_picklist_item_id" bigint) RETURNS TABLE("total_reserved_piece_qty" numeric, "total_reserved_pack_qty" numeric, "reservation_count" integer)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(SUM(reserved_piece_qty), 0) as total_reserved_piece_qty,
        COALESCE(SUM(reserved_pack_qty), 0) as total_reserved_pack_qty,
        COUNT(*)::INTEGER as reservation_count
    FROM picklist_item_reservations
    WHERE picklist_item_id = p_picklist_item_id
    AND status = 'reserved';
END;
$$;


ALTER FUNCTION "public"."get_picklist_item_reserved_qty"("p_picklist_item_id" bigint) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_picklist_item_reserved_qty"("p_picklist_item_id" bigint) IS 'คำนวณยอดรวมที่จองไว้สำหรับ picklist item (เฉพาะสถานะ reserved)';



CREATE OR REPLACE FUNCTION "public"."get_trips_for_picklist_creation"() RETURNS TABLE("trip_id" bigint, "trip_code" character varying, "plate_number" character varying, "driver_name" "text")
    LANGUAGE "sql" STABLE
    AS $$
    SELECT 
        t.trip_id,
        t.trip_code,
        v.plate_number,
        TRIM(e.first_name || ' ' || e.last_name) AS driver_name
    FROM 
        receiving_route_trips t
    JOIN 
        receiving_route_plans rp ON rp.plan_id = t.plan_id
    LEFT JOIN 
        picklists p ON t.trip_id = p.trip_id AND p.status <> 'cancelled'
    LEFT JOIN
        master_vehicle v ON t.vehicle_id = v.vehicle_id
    LEFT JOIN
        master_employee e ON t.driver_id = e.employee_id
    WHERE 
        t.trip_status = 'planned'
        AND rp.status = 'published'
        AND p.id IS NULL;
$$;


ALTER FUNCTION "public"."get_trips_for_picklist_creation"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_trips_for_picklist_creation"() IS 'Returns trips with status "planned" whose plans are published and do not already have an active picklist.';



CREATE OR REPLACE FUNCTION "public"."packing_get_unique_platforms"() RETURNS TABLE("platform_name" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT platform
  FROM packing_orders
  WHERE platform IS NOT NULL
  ORDER BY platform;
END;
$$;


ALTER FUNCTION "public"."packing_get_unique_platforms"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."packing_recommend_box_for_sku"("p_parent_sku" "text", "p_quantity" integer) RETURNS TABLE("box_id" "uuid", "box_code" "text", "box_name" "text", "confidence_score" numeric)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Simple recommendation based on packing rules
  -- Can be enhanced with more complex logic
  RETURN QUERY
  SELECT
    b.id,
    b.box_code,
    b.box_name,
    80.0::DECIMAL(5,2) as confidence_score
  FROM packing_boxes b
  WHERE b.is_active = TRUE
  ORDER BY b.volume ASC
  LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."packing_recommend_box_for_sku"("p_parent_sku" "text", "p_quantity" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."packing_update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."packing_update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."populate_face_sheet_item_sku_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- If sku_id is null but product_code exists, copy product_code to sku_id
    IF NEW.sku_id IS NULL AND NEW.product_code IS NOT NULL THEN
        NEW.sku_id := NEW.product_code;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."populate_face_sheet_item_sku_id"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."populate_face_sheet_item_sku_id"() IS 'Automatically populate sku_id from product_code before insert';



CREATE OR REPLACE FUNCTION "public"."reserve_stock_for_face_sheet_items"("p_face_sheet_id" bigint, "p_warehouse_id" character varying DEFAULT 'WH01'::character varying, "p_reserved_by" character varying DEFAULT 'System'::character varying) RETURNS TABLE("success" boolean, "items_reserved" integer, "message" "text", "insufficient_stock_items" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_item RECORD;
    v_balance RECORD;
    v_items_reserved INTEGER := 0;
    v_insufficient_items JSONB := '[]'::JSONB;
    v_qty_needed NUMERIC;
    v_qty_reserved NUMERIC;
    v_pack_qty NUMERIC;
    v_qty_per_pack INTEGER;
    v_has_insufficient BOOLEAN := FALSE;
BEGIN
    -- Loop through each face_sheet_item
    FOR v_item IN
        SELECT 
            fsi.id as item_id,
            fsi.sku_id,
            fsi.quantity as qty_needed,
            fsi.uom
        FROM face_sheet_items fsi
        WHERE fsi.face_sheet_id = p_face_sheet_id
        AND COALESCE(fsi.status, 'pending') = 'pending'
        ORDER BY fsi.id
    LOOP
        -- Get qty_per_pack from master_sku
        SELECT COALESCE(qty_per_pack, 1) INTO v_qty_per_pack
        FROM master_sku
        WHERE sku_id = v_item.sku_id;
        
        v_qty_needed := v_item.qty_needed;
        v_qty_reserved := 0;
        
        -- Find available balances from Storage/Picking Area (floor, rack)
        -- Use FEFO/FIFO logic
        FOR v_balance IN
            SELECT 
                ib.balance_id,
                ib.location_id,
                ib.total_piece_qty,
                ib.reserved_piece_qty,
                ib.total_piece_qty - ib.reserved_piece_qty as available_qty,
                ib.expiry_date,
                ib.production_date,
                ml.location_code,
                ml.location_type
            FROM wms_inventory_balances ib
            JOIN master_location ml ON ml.location_id = ib.location_id
            WHERE ib.warehouse_id = p_warehouse_id
            AND ib.sku_id = v_item.sku_id
            AND ib.total_piece_qty > ib.reserved_piece_qty
            AND ml.location_type IN ('floor', 'rack')  -- ✅ แก้ไขเป็น floor, rack
            AND ml.active_status = 'active'
            ORDER BY 
                ib.expiry_date ASC NULLS LAST,  -- FEFO
                ib.production_date ASC NULLS LAST,  -- FIFO
                ib.balance_id ASC
        LOOP
            EXIT WHEN v_qty_reserved >= v_qty_needed;
            
            DECLARE
                v_qty_to_reserve NUMERIC;
                v_pack_to_reserve NUMERIC;
            BEGIN
                -- Calculate how much to reserve from this balance
                v_qty_to_reserve := LEAST(v_balance.available_qty, v_qty_needed - v_qty_reserved);
                v_pack_to_reserve := v_qty_to_reserve / v_qty_per_pack;
                
                -- Update inventory balance (increase reserved_qty)
                UPDATE wms_inventory_balances
                SET 
                    reserved_piece_qty = reserved_piece_qty + v_qty_to_reserve,
                    reserved_pack_qty = reserved_pack_qty + v_pack_to_reserve,
                    updated_at = CURRENT_TIMESTAMP
                WHERE balance_id = v_balance.balance_id;
                
                -- Insert reservation record
                INSERT INTO face_sheet_item_reservations (
                    face_sheet_item_id,
                    balance_id,
                    reserved_piece_qty,
                    reserved_pack_qty,
                    status,
                    reserved_at
                ) VALUES (
                    v_item.item_id,
                    v_balance.balance_id,
                    v_qty_to_reserve,
                    v_pack_to_reserve,
                    'reserved',
                    CURRENT_TIMESTAMP
                );
                
                v_qty_reserved := v_qty_reserved + v_qty_to_reserve;
            END;
        END LOOP;
        
        -- Check if we reserved enough
        IF v_qty_reserved >= v_qty_needed THEN
            v_items_reserved := v_items_reserved + 1;
            
            -- Update face_sheet_item status
            UPDATE face_sheet_items
            SET status = 'reserved'
            WHERE id = v_item.item_id;
        ELSE
            v_has_insufficient := TRUE;
            v_insufficient_items := v_insufficient_items || jsonb_build_object(
                'item_id', v_item.item_id,
                'sku_id', v_item.sku_id,
                'qty_needed', v_qty_needed,
                'qty_reserved', v_qty_reserved,
                'qty_short', v_qty_needed - v_qty_reserved
            );
        END IF;
    END LOOP;
    
    -- Return result
    IF v_has_insufficient THEN
        RETURN QUERY SELECT 
            FALSE,
            v_items_reserved,
            'มีบางรายการที่สต็อคไม่เพียงพอ'::TEXT,
            v_insufficient_items;
    ELSE
        RETURN QUERY SELECT 
            TRUE,
            v_items_reserved,
            format('จองสต็อคสำเร็จ %s รายการ', v_items_reserved)::TEXT,
            '[]'::JSONB;
    END IF;
END;
$$;


ALTER FUNCTION "public"."reserve_stock_for_face_sheet_items"("p_face_sheet_id" bigint, "p_warehouse_id" character varying, "p_reserved_by" character varying) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."reserve_stock_for_face_sheet_items"("p_face_sheet_id" bigint, "p_warehouse_id" character varying, "p_reserved_by" character varying) IS 'Reserve stock for face sheet items from floor/rack locations (not preparation areas)';



CREATE OR REPLACE FUNCTION "public"."safe_string_to_date"("date_input" "text") RETURNS "date"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
    -- Handle NULL or empty string
    IF date_input IS NULL OR TRIM(date_input) = '' THEN
        RETURN NULL;
    END IF;

    -- Try to cast to date
    RETURN date_input::date;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error and return NULL
        RAISE WARNING 'Failed to convert % to date: %', date_input, SQLERRM;
        RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."safe_string_to_date"("date_input" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."safe_string_to_date"("date_input" "text") IS 'Safely converts varchar to date, returns NULL on error';



CREATE OR REPLACE FUNCTION "public"."set_receiving_route_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_receiving_route_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_current_stock_from_movement"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
  BEGIN
      IF TG_OP = 'INSERT' AND NEW.status = 'completed' THEN
          IF NEW.from_location_id IS NOT NULL THEN
              UPDATE wms_current_stock
              SET
                  quantity = quantity - NEW.quantity,
                  last_movement_id = NEW.movement_id,
                  last_updated = CURRENT_TIMESTAMP
              WHERE sku_id = NEW.sku_id
              AND location_id = NEW.from_location_id
              AND (pallet_id = NEW.pallet_id OR (pallet_id IS NULL AND NEW.pallet_id IS NULL))
              AND (lot_no = NEW.lot_no OR (lot_no IS NULL AND NEW.lot_no IS NULL))
              AND (batch_no = NEW.batch_no OR (batch_no IS NULL AND NEW.batch_no IS NULL))
              AND (expiry_date = NEW.expiry_date OR (expiry_date IS NULL AND NEW.expiry_date IS NULL));
          END IF;

          INSERT INTO wms_current_stock (
              sku_id, location_id, pallet_id, lot_no, batch_no, expiry_date,
              quantity, uom, last_movement_id
          ) VALUES (
              NEW.sku_id, NEW.to_location_id, NEW.pallet_id, NEW.lot_no, NEW.batch_no,
              NEW.expiry_date, NEW.quantity, NEW.uom, NEW.movement_id
          )
          ON CONFLICT ON CONSTRAINT idx_unique_current_stock
          DO UPDATE SET
              quantity = wms_current_stock.quantity + NEW.quantity,
              last_movement_id = NEW.movement_id,
              last_updated = CURRENT_TIMESTAMP;
      END IF;

      RETURN NEW;
  END;
  $$;


ALTER FUNCTION "public"."sync_current_stock_from_movement"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_inventory_ledger_to_balance"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_balance_id bigint;
    v_current_pack_qty numeric(18,2);
    v_current_piece_qty numeric(18,2);
BEGIN
    -- ✅ เช็ค flag skip_balance_sync ก่อนทำงาน
    IF NEW.skip_balance_sync = TRUE THEN
        RAISE NOTICE 'Skipping balance sync for ledger entry % (skip_balance_sync = TRUE)', NEW.ledger_id;
        RETURN NEW;
    END IF;

    -- Calculate the signed quantity based on direction
    IF NEW.direction = 'in' THEN
        v_current_pack_qty := NEW.pack_qty;
        v_current_piece_qty := NEW.piece_qty;
    ELSE -- direction = 'out'
        v_current_pack_qty := -NEW.pack_qty;
        v_current_piece_qty := -NEW.piece_qty;
    END IF;

    -- Check if balance record exists
    SELECT balance_id INTO v_balance_id
    FROM wms_inventory_balances
    WHERE warehouse_id = NEW.warehouse_id
      AND COALESCE(location_id, '') = COALESCE(NEW.location_id, '')
      AND sku_id = NEW.sku_id
      AND COALESCE(pallet_id, '') = COALESCE(NEW.pallet_id, '')
      AND COALESCE(pallet_id_external, '') = COALESCE(NEW.pallet_id_external, '')
      AND COALESCE(production_date::text, '') = COALESCE(NEW.production_date::text, '')
      AND COALESCE(expiry_date::text, '') = COALESCE(NEW.expiry_date::text, '');

    IF v_balance_id IS NOT NULL THEN
        -- Update existing balance
        UPDATE wms_inventory_balances
        SET
            total_pack_qty = GREATEST(0, total_pack_qty + v_current_pack_qty),
            total_piece_qty = GREATEST(0, total_piece_qty + v_current_piece_qty),
            last_movement_at = NEW.movement_at,
            updated_at = CURRENT_TIMESTAMP
        WHERE balance_id = v_balance_id;

        RAISE NOTICE 'Updated balance % for SKU % at location %', v_balance_id, NEW.sku_id, NEW.location_id;
    ELSE
        -- Insert new balance record (only if direction is 'in')
        IF NEW.direction = 'in' THEN
            INSERT INTO wms_inventory_balances (
                balance_id,
                warehouse_id,
                location_id,
                sku_id,
                pallet_id,
                pallet_id_external,
                production_date,
                expiry_date,
                total_pack_qty,
                total_piece_qty,
                reserved_pack_qty,
                reserved_piece_qty,
                last_movement_at,
                created_at,
                updated_at,
                lot_no
            ) VALUES (
                nextval('wms_inventory_balances_balance_id_seq'),
                NEW.warehouse_id,
                NEW.location_id,
                NEW.sku_id,
                NEW.pallet_id,
                NEW.pallet_id_external,
                NEW.production_date,
                NEW.expiry_date,
                NEW.pack_qty,
                NEW.piece_qty,
                0,
                0,
                NEW.movement_at,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP,
                NULL -- lot_no can be added if available
            );

            RAISE NOTICE 'Created new balance for SKU % at location %', NEW.sku_id, NEW.location_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_inventory_ledger_to_balance"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sync_inventory_ledger_to_balance"() IS 'Automatically sync inventory ledger entries to balance table. Skips sync if skip_balance_sync flag is TRUE. (Updated 2025-11-29)';



CREATE OR REPLACE FUNCTION "public"."sync_location_qty_from_balance"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_location_id text;
    v_total_qty numeric;
BEGIN
    -- Determine which location to update (OLD or NEW)
    IF TG_OP = 'DELETE' THEN
        v_location_id := OLD.location_id;
    ELSE
        v_location_id := NEW.location_id;
    END IF;

    -- Skip if no location
    IF v_location_id IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Calculate total quantity for this location across all SKUs/pallets
    SELECT COALESCE(SUM(total_piece_qty), 0)
    INTO v_total_qty
    FROM wms_inventory_balances
    WHERE location_id = v_location_id;

    -- Update master_location
    UPDATE master_location
    SET 
        current_qty = v_total_qty,
        updated_at = CURRENT_TIMESTAMP
    WHERE location_id = v_location_id;

    RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."sync_location_qty_from_balance"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sync_location_qty_from_balance"() IS 'Automatically sync master_location.current_qty from wms_inventory_balances';



CREATE OR REPLACE FUNCTION "public"."sync_produced_qty_to_plan"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE production_plan_items ppi
  SET produced_qty = (
    SELECT COALESCE(SUM(po.produced_qty), 0)
    FROM production_orders po
    WHERE po.plan_id = ppi.plan_id
      AND po.sku_id = ppi.sku_id
  ),
  updated_at = CURRENT_TIMESTAMP
  WHERE ppi.plan_id = NEW.plan_id
    AND ppi.sku_id = NEW.sku_id;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_produced_qty_to_plan"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sync_produced_qty_to_plan"() IS 'อัปเดต produced_qty ของ plan items จาก orders';



CREATE OR REPLACE FUNCTION "public"."sync_production_plan_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_plan_id UUID;
  v_total_orders INT;
  v_completed_orders INT;
  v_in_progress_orders INT;
  v_new_status production_plan_status;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_plan_id := OLD.plan_id;
  ELSE
    v_plan_id := NEW.plan_id;
  END IF;

  IF v_plan_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    COUNT(*),
    COUNT(CASE WHEN status = 'completed' THEN 1 END),
    COUNT(CASE WHEN status = 'in_progress' THEN 1 END)
  INTO v_total_orders, v_completed_orders, v_in_progress_orders
  FROM production_orders
  WHERE plan_id = v_plan_id;

  IF v_total_orders = 0 THEN
    v_new_status := 'approved';
  ELSIF v_completed_orders = v_total_orders THEN
    v_new_status := 'completed';
  ELSIF v_in_progress_orders > 0 OR v_completed_orders > 0 THEN
    v_new_status := 'in_production';
  ELSE
    v_new_status := 'approved';
  END IF;

  UPDATE production_plan
  SET status = v_new_status,
      updated_at = CURRENT_TIMESTAMP
  WHERE plan_id = v_plan_id
    AND status != v_new_status;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;


ALTER FUNCTION "public"."sync_production_plan_status"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sync_production_plan_status"() IS 'อัปเดตสถานะ production_plan ตามสถานะของ production_orders อัตโนมัติ';



CREATE OR REPLACE FUNCTION "public"."trigger_reserve_stock_after_face_sheet_created"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_result RECORD;
BEGIN
  -- Call the reservation function using NEW.id (not NEW.face_sheet_id)
  -- NEW.id is the primary key of face_sheets table
  SELECT * INTO v_result
  FROM reserve_stock_for_face_sheet_items(
    NEW.id,  -- ใช้ NEW.id แทน NEW.face_sheet_id
    COALESCE(NEW.warehouse_id, 'WH01'),
    COALESCE(NEW.created_by, 'System')
  );
  
  -- Log the result
  IF v_result.success THEN
    RAISE NOTICE 'Stock reserved successfully for face_sheet_id: %, items: %', 
      NEW.id, v_result.items_reserved;
  ELSE
    RAISE WARNING 'Stock reservation failed for face_sheet_id: %, message: %, insufficient: %',
      NEW.id, v_result.message, v_result.insufficient_stock_items;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_reserve_stock_after_face_sheet_created"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."trigger_reserve_stock_after_face_sheet_created"() IS 'Trigger function that calls reserve_stock_for_face_sheet_items to reserve inventory for face sheet items using FEFO/FIFO logic. Fixed to use NEW.id instead of NEW.face_sheet_id';



CREATE OR REPLACE FUNCTION "public"."update_bom_sku_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_bom_sku_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_bonus_face_sheet_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_bonus_face_sheet_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_dashboard_calendar_events_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_dashboard_calendar_events_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_extra_stops_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.extra_stops_count := GREATEST(0, COALESCE(NEW.total_stops, 0) - 1);
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_extra_stops_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_face_sheets_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_face_sheets_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_inventory_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_inventory_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_ledger_from_move"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_move_status text;
    v_from_warehouse_id text;
    v_to_warehouse_id text;
    v_scheduled_at timestamp;
    v_ledger_exists boolean;
BEGIN
    -- Get the move header info
    SELECT status, from_warehouse_id, to_warehouse_id, scheduled_at
    INTO v_move_status, v_from_warehouse_id, v_to_warehouse_id, v_scheduled_at
    FROM wms_moves
    WHERE move_id = NEW.move_id;

    -- Check if ledger entries already exist for this move item
    SELECT EXISTS(
        SELECT 1 FROM wms_inventory_ledger
        WHERE move_item_id = NEW.move_item_id
    ) INTO v_ledger_exists;

    -- If status changed to 'completed' and ledger doesn't exist yet
    IF OLD.status != 'completed' AND NEW.status = 'completed' AND NOT v_ledger_exists THEN
        -- Create OUT entry (from source location)
        IF NEW.from_location_id IS NOT NULL THEN
            INSERT INTO wms_inventory_ledger (
                transaction_type,
                move_item_id,
                warehouse_id,
                location_id,
                sku_id,
                pallet_id,
                pallet_id_external,
                production_date,
                expiry_date,
                pack_qty,
                piece_qty,
                direction,
                movement_at,
                reference_no,
                created_by
            ) VALUES (
                'transfer',
                NEW.move_item_id,
                v_from_warehouse_id,
                NEW.from_location_id,
                NEW.sku_id,
                NEW.pallet_id,
                NEW.pallet_id_external,
                NEW.production_date,
                NEW.expiry_date,
                NEW.confirmed_pack_qty,
                NEW.confirmed_piece_qty,
                'out',
                COALESCE(NEW.completed_at, v_scheduled_at, CURRENT_TIMESTAMP),
                (SELECT move_no FROM wms_moves WHERE move_id = NEW.move_id),
                NEW.executed_by
            );
        END IF;

        -- Create IN entry (to destination location)
        IF NEW.to_location_id IS NOT NULL THEN
            INSERT INTO wms_inventory_ledger (
                transaction_type,
                move_item_id,
                warehouse_id,
                location_id,
                sku_id,
                pallet_id,
                pallet_id_external,
                production_date,
                expiry_date,
                pack_qty,
                piece_qty,
                direction,
                movement_at,
                reference_no,
                created_by
            ) VALUES (
                'transfer',
                NEW.move_item_id,
                v_to_warehouse_id,
                NEW.to_location_id,
                NEW.sku_id,
                NEW.pallet_id,
                NEW.pallet_id_external,
                NEW.production_date,
                NEW.expiry_date,
                NEW.confirmed_pack_qty,
                NEW.confirmed_piece_qty,
                'in',
                COALESCE(NEW.completed_at, v_scheduled_at, CURRENT_TIMESTAMP),
                (SELECT move_no FROM wms_moves WHERE move_id = NEW.move_id),
                NEW.executed_by
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_ledger_from_move"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_ledger_from_move"() IS 'DISABLED: Create inventory ledger entries (OUT and IN) when move item status changes to completed. Disabled because API code handles this.';



CREATE OR REPLACE FUNCTION "public"."update_ledger_from_receive"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_receive_status text;
    v_warehouse_id text;
    v_receive_date timestamp;
    v_production_date date;
    v_ledger_exists boolean;
BEGIN
    -- Get the receive header status
    SELECT status, warehouse_id, receive_date
    INTO v_receive_status, v_warehouse_id, v_receive_date
    FROM wms_receives
    WHERE receive_id = NEW.receive_id;

    -- Check if ledger entry already exists for this item
    SELECT EXISTS(
        SELECT 1 FROM wms_inventory_ledger
        WHERE receive_item_id = NEW.item_id
    ) INTO v_ledger_exists;

    -- If status changed to 'รับเข้าแล้ว' and location is specified and ledger doesn't exist yet
    IF v_receive_status = 'รับเข้าแล้ว' 
       AND NEW.location_id IS NOT NULL 
       AND NOT v_ledger_exists THEN
        
        -- Safely convert production_date (varchar) to date
        v_production_date := safe_string_to_date(NEW.production_date);
        
        INSERT INTO wms_inventory_ledger (
            ledger_id,
            transaction_type,
            receive_item_id,
            warehouse_id,
            location_id,
            sku_id,
            pallet_id,
            pallet_id_external,
            production_date,
            expiry_date,
            pack_qty,
            piece_qty,
            direction,
            movement_at,
            created_by
        ) VALUES (
            nextval('wms_inventory_ledger_ledger_id_seq'),
            'receive',
            NEW.item_id,
            v_warehouse_id,
            NEW.location_id,
            NEW.sku_id,
            NEW.pallet_id,
            NEW.pallet_id_external,
            v_production_date,      -- Use the converted date variable
            NEW.expiry_date,        -- already date type
            NEW.pack_quantity,
            NEW.piece_quantity,
            'in',
            COALESCE(v_receive_date, CURRENT_TIMESTAMP),
            NEW.created_by
        );
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_ledger_from_receive"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_ledger_from_receive"() IS 'Trigger function to create ledger entries from receive items on UPDATE';



CREATE OR REPLACE FUNCTION "public"."update_ledger_from_receive_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- When receive status changes to 'รับเข้าแล้ว', create ledger entries for all items
    IF OLD.status != 'รับเข้าแล้ว' AND NEW.status = 'รับเข้าแล้ว' THEN
        INSERT INTO wms_inventory_ledger (
            transaction_type,
            receive_item_id,
            warehouse_id,
            location_id,
            sku_id,
            pallet_id,
            pallet_id_external,
            production_date,
            expiry_date,
            pack_qty,
            piece_qty,
            direction,
            movement_at,
            created_by
        )
        SELECT
            'receive',
            i.item_id,
            NEW.warehouse_id,
            i.location_id,
            i.sku_id,
            i.pallet_id,
            i.pallet_id_external,
            safe_string_to_date(i.production_date),  -- Convert varchar to date safely
            i.expiry_date,                            -- already date type
            i.pack_quantity,
            i.piece_quantity,
            'in',
            COALESCE(NEW.receive_date, CURRENT_TIMESTAMP),
            i.created_by
        FROM wms_receive_items i
        WHERE i.receive_id = NEW.receive_id
        AND i.location_id IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM wms_inventory_ledger l
            WHERE l.receive_item_id = i.item_id
        );
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_ledger_from_receive_status"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_ledger_from_receive_status"() IS 'Create inventory ledger entries when receive status changes to รับเข้าแล้ว - handles varchar to date conversion for production_date';



CREATE OR REPLACE FUNCTION "public"."update_loadlist_and_route_on_delivery"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_loadlist_id BIGINT;
    v_plan_id BIGINT;
    v_all_delivered BOOLEAN;
    v_all_loadlists_completed BOOLEAN;
BEGIN
    -- เมื่อ Order เปลี่ยนเป็น 'delivered'
    IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') THEN

        -- 1. หา Loadlist ที่ Order นี้อยู่
        SELECT loadlist_id INTO v_loadlist_id
        FROM loadlist_items
        WHERE order_id = NEW.order_id
        LIMIT 1;

        IF v_loadlist_id IS NOT NULL THEN
            -- ตรวจสอบว่า Orders ทั้งหมดใน Loadlist ส่งถึงหรือยัง
            SELECT NOT EXISTS (
                SELECT 1
                FROM wms_orders o
                INNER JOIN loadlist_items li ON o.order_id = li.order_id
                WHERE li.loadlist_id = v_loadlist_id
                AND o.status != 'delivered'
            ) INTO v_all_delivered;

            -- ถ้าส่งถึงหมดแล้ว → Loadlist completed
            IF v_all_delivered THEN
                UPDATE loadlists
                SET
                    status = 'completed',
                    updated_at = NOW()
                WHERE id = v_loadlist_id
                AND status = 'loaded'
                RETURNING plan_id INTO v_plan_id;

                RAISE NOTICE 'All orders delivered for Loadlist ID %. Status changed to completed.', v_loadlist_id;

                -- 2. ตรวจสอบ Route Plan
                IF v_plan_id IS NOT NULL THEN
                    SELECT NOT EXISTS (
                        SELECT 1
                        FROM loadlists
                        WHERE plan_id = v_plan_id
                        AND status NOT IN ('completed', 'cancelled')
                    ) INTO v_all_loadlists_completed;

                    -- ถ้า Loadlists ทั้งหมดเสร็จแล้ว → Route completed
                    IF v_all_loadlists_completed THEN
                        UPDATE receiving_route_plans
                        SET
                            status = 'completed',
                            updated_at = NOW()
                        WHERE plan_id = v_plan_id
                        AND status = 'in_transit';

                        RAISE NOTICE 'All loadlists completed for Route Plan ID %. Status changed to completed.', v_plan_id;
                    END IF;
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_loadlist_and_route_on_delivery"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_loadlist_and_route_on_delivery"() IS 'เมื่อ Order delivered → Loadlist: loaded→completed (ถ้าทุก Order ส่งถึง), Route: in_transit→completed (ถ้าทุก Loadlist เสร็จ)';



CREATE OR REPLACE FUNCTION "public"."update_location_current_qty"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_location_id text;
    v_total_qty integer;
    v_total_weight numeric(18,2);
BEGIN
    -- Determine which location to update
    IF TG_OP = 'DELETE' THEN
        v_location_id := OLD.location_id;
    ELSE
        v_location_id := NEW.location_id;
    END IF;

    -- Skip if no location
    IF v_location_id IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Calculate total quantity for this location
    SELECT 
        COALESCE(SUM(total_piece_qty), 0),
        COALESCE(SUM(total_piece_qty * COALESCE(ms.weight_per_piece_kg, 0)), 0)
    INTO v_total_qty, v_total_weight
    FROM wms_inventory_balances ib
    LEFT JOIN master_sku ms ON ib.sku_id = ms.sku_id
    WHERE ib.location_id = v_location_id;

    -- Update master_location
    UPDATE master_location
    SET 
        current_qty = v_total_qty,
        current_weight_kg = v_total_weight,
        updated_at = CURRENT_TIMESTAMP
    WHERE location_id = v_location_id;

    RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."update_location_current_qty"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_location_current_qty"() IS 'Update master_location current_qty and current_weight_kg when inventory_balances changes';



CREATE OR REPLACE FUNCTION "public"."update_master_customer_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_master_customer_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_master_location_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_master_location_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_master_supplier_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_master_supplier_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_master_vehicle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_master_vehicle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_master_warehouse_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_master_warehouse_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_order_on_loadlist_scan"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- เมื่อมี Order ถูกเพิ่มเข้า Loadlist (สแกนขึ้นรถ)
    -- อัปเดต Order จาก picked → loaded
    UPDATE wms_orders
    SET
        status = 'loaded',
        updated_at = NOW()
    WHERE order_id = NEW.order_id
    AND status = 'picked';

    -- อัปเดต Loadlist status เป็น loading (ถ้ายังเป็น pending)
    UPDATE loadlists
    SET
        status = 'loading',
        updated_at = NOW()
    WHERE id = NEW.loadlist_id
    AND status = 'pending';

    RAISE NOTICE 'Order % scanned into Loadlist %. Order status changed to loaded.', NEW.order_id, NEW.loadlist_id;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_order_on_loadlist_scan"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_order_on_loadlist_scan"() IS 'เมื่อสแกนขึ้นรถ → Order: picked→loaded, Loadlist: pending→loading';



CREATE OR REPLACE FUNCTION "public"."update_order_status_on_face_sheet_in_progress"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- เมื่อ face sheet เปลี่ยนเป็น 'picking' (กำลังหยิบ)
  IF NEW.status = 'picking' AND OLD.status != 'picking' THEN
    -- อัปเดตออเดอร์ที่เกี่ยวข้องเป็น 'in_picking'
    UPDATE wms_orders
    SET 
      status = 'in_picking',
      updated_at = NOW()
    WHERE order_id IN (
      SELECT DISTINCT order_id
      FROM face_sheet_items
      WHERE face_sheet_id = NEW.id
      AND order_id IS NOT NULL
    )
    AND status = 'confirmed'; -- เฉพาะออเดอร์ที่ยังเป็น confirmed
    
    RAISE NOTICE 'Updated orders to in_picking for face sheet %', NEW.face_sheet_no;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_order_status_on_face_sheet_in_progress"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_order_status_on_face_sheet_in_progress"() IS 'Automatically updates order status to in_picking when face sheet starts picking (in_progress)';



CREATE OR REPLACE FUNCTION "public"."update_orders_and_route_on_departure"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_plan_id BIGINT;
BEGIN
    -- เมื่อ Loadlist เปลี่ยนเป็น 'loaded' (พร้อมออกจัดส่ง)
    IF NEW.status = 'loaded' AND (OLD.status IS NULL OR OLD.status != 'loaded') THEN

        -- 1. อัปเดต Orders จาก loaded → in_transit
        UPDATE wms_orders
        SET
            status = 'in_transit',
            updated_at = NOW()
        WHERE order_id IN (
            SELECT order_id
            FROM loadlist_items
            WHERE loadlist_id = NEW.id
        )
        AND status = 'loaded';

        RAISE NOTICE 'Loadlist % departed. Updated orders to in_transit.', NEW.loadlist_code;

        -- 2. อัปเดต Route Plan เป็น in_transit
        v_plan_id := NEW.plan_id;

        IF v_plan_id IS NOT NULL THEN
            UPDATE receiving_route_plans
            SET
                status = 'in_transit',
                updated_at = NOW()
            WHERE plan_id = v_plan_id
            AND status = 'ready_to_load';

            RAISE NOTICE 'Route Plan ID % status changed to in_transit.', v_plan_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_orders_and_route_on_departure"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_orders_and_route_on_departure"() IS 'เมื่อรถออกจัดส่ง (Loadlist loaded) → Orders: loaded→in_transit, Route: ready_to_load→in_transit';



CREATE OR REPLACE FUNCTION "public"."update_orders_and_route_on_picklist_complete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_plan_id BIGINT;
    v_all_completed BOOLEAN;
BEGIN
    -- เมื่อ Picklist เปลี่ยนเป็น 'completed'
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN

        -- 1. อัปเดต Orders จาก in_picking → picked
        UPDATE wms_orders
        SET
            status = 'picked',
            updated_at = NOW()
        WHERE order_id IN (
            SELECT DISTINCT order_id
            FROM picklist_items
            WHERE picklist_id = NEW.id
            AND order_id IS NOT NULL
        )
        AND status = 'in_picking';

        RAISE NOTICE 'Picklist % completed. Updated orders to picked.', NEW.picklist_code;

        -- 2. ตรวจสอบ Route Plan
        v_plan_id := NEW.plan_id;

        IF v_plan_id IS NOT NULL THEN
            -- ตรวจสอบว่า Picklists ทั้งหมดใน Plan นี้เสร็จหรือยัง
            SELECT NOT EXISTS (
                SELECT 1
                FROM picklists
                WHERE plan_id = v_plan_id
                AND status NOT IN ('completed', 'cancelled')
            ) INTO v_all_completed;

            -- ถ้าเสร็จหมดแล้ว → เปลี่ยน Route Plan เป็น ready_to_load
            IF v_all_completed THEN
                UPDATE receiving_route_plans
                SET
                    status = 'ready_to_load',
                    updated_at = NOW()
                WHERE plan_id = v_plan_id
                AND status = 'published';

                RAISE NOTICE 'All picklists completed for Route Plan ID %. Status changed to ready_to_load.', v_plan_id;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_orders_and_route_on_picklist_complete"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_orders_and_route_on_picklist_complete"() IS 'เมื่อ Picklist completed → Orders: in_picking→picked, Route: published→ready_to_load (ถ้าทุก Picklist เสร็จ)';



CREATE OR REPLACE FUNCTION "public"."update_orders_on_face_sheet_complete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- เมื่อ Face Sheet เปลี่ยนเป็น 'completed'
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        
        -- อัปเดต Orders จาก 'in_picking' → 'picked' (รองรับทั้ง confirmed และ in_picking)
        UPDATE wms_orders
        SET status = 'picked', updated_at = NOW()
        WHERE order_id IN (
            SELECT DISTINCT fsi.order_id
            FROM face_sheet_items fsi
            WHERE fsi.face_sheet_id = NEW.id
            AND fsi.order_id IS NOT NULL
        )
        AND status IN ('confirmed', 'in_picking');
        
        RAISE NOTICE 'Face Sheet % completed. Updated orders to picked.', NEW.face_sheet_no;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_orders_on_face_sheet_complete"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_orders_on_face_sheet_complete"() IS 'เมื่อ Face Sheet completed → Orders: confirmed→picked';



CREATE OR REPLACE FUNCTION "public"."update_orders_on_loadlist_complete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- เมื่อ Loadlist เปลี่ยนเป็น 'loaded'
    IF NEW.status = 'loaded' AND (OLD.status IS NULL OR OLD.status != 'loaded') THEN
        
        -- อัปเดต Orders จาก Picklists: 'picked' → 'loaded'
        UPDATE wms_orders
        SET status = 'loaded', updated_at = NOW()
        WHERE order_id IN (
            SELECT DISTINCT pi.order_id
            FROM loadlist_picklists llp
            JOIN picklist_items pi ON pi.picklist_id = llp.picklist_id
            WHERE llp.loadlist_id = NEW.id
            AND pi.order_id IS NOT NULL
        )
        AND status = 'picked';
        
        -- อัปเดต Orders จาก Face Sheets: 'confirmed' → 'loaded'
        UPDATE wms_orders
        SET status = 'loaded', updated_at = NOW()
        WHERE order_id IN (
            SELECT DISTINCT fsi.order_id
            FROM loadlist_face_sheets lfs
            JOIN face_sheet_items fsi ON fsi.face_sheet_id = lfs.face_sheet_id
            WHERE lfs.loadlist_id = NEW.id
            AND fsi.order_id IS NOT NULL
        )
        AND status IN ('confirmed', 'picked');
        
        RAISE NOTICE 'Loadlist % completed. Updated orders to loaded.', NEW.loadlist_code;
        
        -- อัปเดต Route Plan เป็น 'in_transit' ถ้ามี plan_id
        IF NEW.plan_id IS NOT NULL THEN
            UPDATE receiving_route_plans
            SET status = 'in_transit', updated_at = NOW()
            WHERE plan_id = NEW.plan_id
            AND status = 'ready_to_load';
            
            RAISE NOTICE 'Route Plan ID % status changed to in_transit.', NEW.plan_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_orders_on_loadlist_complete"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_orders_on_loadlist_complete"() IS 'เมื่อ Loadlist loaded → Orders: picked/confirmed→loaded (รองรับทั้ง Picklists และ Face Sheets), Route: ready_to_load→in_transit';



CREATE OR REPLACE FUNCTION "public"."update_orders_on_picklist_assign"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- ทำงานเมื่อเปลี่ยนเป็น 'assigned' เท่านั้น
    IF NEW.status = 'assigned' AND (OLD.status IS NULL OR OLD.status != 'assigned') THEN

        -- อัปเดต Orders จาก confirmed → in_picking
        UPDATE wms_orders
        SET
            status = 'in_picking',
            updated_at = NOW()
        WHERE order_id IN (
            SELECT DISTINCT order_id
            FROM picklist_items
            WHERE picklist_id = NEW.id
            AND order_id IS NOT NULL
        )
        AND status = 'confirmed';

        RAISE NOTICE 'Picklist % assigned (status changed to assigned). Updated orders to in_picking.', NEW.picklist_code;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_orders_on_picklist_assign"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_orders_on_picklist_assign"() IS 'เมื่อ Picklist เปลี่ยนเป็น assigned → Orders เปลี่ยนจาก confirmed → in_picking';



CREATE OR REPLACE FUNCTION "public"."update_orders_on_picklist_create"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- เมื่อ Picklist ถูกสร้างใหม่ (INSERT)
    -- อัปเดต Orders ที่อยู่ใน Picklist จาก confirmed → in_picking
    UPDATE wms_orders
    SET
        status = 'in_picking',
        updated_at = NOW()
    WHERE order_id IN (
        SELECT DISTINCT order_id
        FROM picklist_items
        WHERE picklist_id = NEW.id
        AND order_id IS NOT NULL
    )
    AND status = 'confirmed';

    RAISE NOTICE 'Picklist % created. Updated orders to in_picking.', NEW.picklist_code;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_orders_on_picklist_create"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_orders_on_picklist_create"() IS 'เมื่อ Picklist สร้างใหม่ → Orders เปลี่ยนจาก confirmed → in_picking';



CREATE OR REPLACE FUNCTION "public"."update_orders_on_route_publish"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- เมื่อ Route Plan เปลี่ยนเป็น 'published'
    IF NEW.status = 'published' AND (OLD.status IS NULL OR OLD.status != 'published') THEN
        -- อัปเดต Orders ที่อยู่ใน Route Plan นี้จาก draft → confirmed
        UPDATE wms_orders
        SET
            status = 'confirmed',
            confirmed_at = NOW(),
            updated_at = NOW()
        WHERE order_id IN (
            -- ดึง order_id ปกติ
            SELECT DISTINCT s.order_id
            FROM receiving_route_stops s
            INNER JOIN receiving_route_trips t ON s.trip_id = t.trip_id
            WHERE t.plan_id = NEW.plan_id
            AND s.order_id IS NOT NULL
            
            UNION
            
            -- ดึง order_ids จาก tags (สำหรับ consolidated stops)
            SELECT DISTINCT (jsonb_array_elements_text(s.tags->'order_ids'))::bigint as order_id
            FROM receiving_route_stops s
            INNER JOIN receiving_route_trips t ON s.trip_id = t.trip_id
            WHERE t.plan_id = NEW.plan_id
            AND s.tags IS NOT NULL 
            AND s.tags ? 'order_ids'
        )
        AND status = 'draft';

        RAISE NOTICE 'Route Plan % published. Updated orders to confirmed.', NEW.plan_code;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_orders_on_route_publish"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_orders_on_route_publish"() IS 'เมื่อ Route Plan published → Orders เปลี่ยนจาก draft → confirmed';



CREATE OR REPLACE FUNCTION "public"."update_pallet_location_after_movement"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Update pallet location when task detail is completed
    IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.pallet_id IS NOT NULL THEN
        UPDATE wms_receive_pallet 
        SET 
            current_location_id = NEW.to_location_id,
            updated_at = CURRENT_TIMESTAMP
        WHERE pallet_id = NEW.pallet_id;
        
        -- Also create inventory movement record
        INSERT INTO wms_inventory_movement (
            sku_id, from_location_id, to_location_id, movement_type, 
            quantity, uom, pallet_id, movement_date, 
            reference_type, reference_id, reason, created_by, status
        ) VALUES (
            NEW.sku_id, NEW.from_location_id, NEW.to_location_id, 'transfer',
            NEW.actual_qty, NEW.uom, NEW.pallet_id, CURRENT_TIMESTAMP,
            'warehouse_task', NEW.task_id, 'Warehouse task movement', 
            (SELECT created_by FROM wms_warehouse_task WHERE task_id = NEW.task_id),
            'completed'
        );
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_pallet_location_after_movement"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_picklist_item_reservations_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_picklist_item_reservations_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_plan_item_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_plan_item_id UUID;
  v_total_orders INT;
  v_completed_orders INT;
  v_in_progress_orders INT;
  v_new_status production_order_status;
BEGIN
  SELECT plan_item_id INTO v_plan_item_id
  FROM production_orders po
  INNER JOIN production_plan_items ppi ON po.sku_id = ppi.sku_id AND po.plan_id = ppi.plan_id
  WHERE po.id = NEW.id
  LIMIT 1;

  IF v_plan_item_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    COUNT(*),
    COUNT(CASE WHEN po.status = 'completed' THEN 1 END),
    COUNT(CASE WHEN po.status = 'in_progress' THEN 1 END)
  INTO v_total_orders, v_completed_orders, v_in_progress_orders
  FROM production_orders po
  INNER JOIN production_plan_items ppi ON po.sku_id = ppi.sku_id AND po.plan_id = ppi.plan_id
  WHERE ppi.plan_item_id = v_plan_item_id;

  IF v_completed_orders = v_total_orders AND v_total_orders > 0 THEN
    v_new_status := 'completed';
  ELSIF v_in_progress_orders > 0 THEN
    v_new_status := 'in_progress';
  ELSE
    v_new_status := 'planned';
  END IF;

  UPDATE production_plan_items
  SET status = v_new_status,
      actual_start_date = CASE
        WHEN v_new_status = 'in_progress' AND actual_start_date IS NULL
        THEN CURRENT_DATE
        ELSE actual_start_date
      END,
      actual_end_date = CASE
        WHEN v_new_status = 'completed'
        THEN CURRENT_DATE
        ELSE actual_end_date
      END,
      updated_at = CURRENT_TIMESTAMP
  WHERE plan_item_id = v_plan_item_id
    AND status != v_new_status;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_plan_item_status"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_plan_item_status"() IS 'อัปเดตสถานะ production_plan_items ตาม production_orders';



CREATE OR REPLACE FUNCTION "public"."update_production_orders_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_production_orders_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_purchase_orders_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_purchase_orders_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_receive_image_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- อัปเดตจำนวนรูปภาพ
    NEW.receive_image_count = COALESCE(array_length(NEW.receive_images, 1), 0);
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_receive_image_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_replenishment_rule_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_replenishment_rule_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_reservation_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_reservation_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_route_on_delivery"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_plan_id BIGINT;
    v_all_delivered BOOLEAN;
BEGIN
    -- เมื่อ Order เปลี่ยนเป็น 'delivered'
    IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') THEN

        -- หา plan_id จาก picklist ที่ order นี้อยู่
        SELECT DISTINCT p.plan_id INTO v_plan_id
        FROM picklist_items pi
        JOIN picklists p ON p.id = pi.picklist_id
        WHERE pi.order_id = NEW.order_id
        AND p.plan_id IS NOT NULL
        LIMIT 1;

        -- ถ้าไม่เจอใน picklist ให้ลองหาจาก face sheet
        IF v_plan_id IS NULL THEN
            -- Face sheets ไม่มี plan_id โดยตรง แต่อาจจะเพิ่มในอนาคต
            -- ตอนนี้ข้ามไปก่อน
            NULL;
        END IF;

        IF v_plan_id IS NOT NULL THEN
            -- ตรวจสอบว่า Orders ทั้งหมดใน Plan นี้ส่งถึงหรือยัง
            SELECT NOT EXISTS (
                SELECT 1
                FROM wms_orders o
                JOIN picklist_items pi ON pi.order_id = o.order_id
                JOIN picklists p ON p.id = pi.picklist_id
                WHERE p.plan_id = v_plan_id
                AND o.status != 'delivered'
            ) INTO v_all_delivered;

            -- ถ้าส่งถึงหมดแล้ว → Route completed
            IF v_all_delivered THEN
                UPDATE receiving_route_plans
                SET status = 'completed', updated_at = NOW()
                WHERE plan_id = v_plan_id
                AND status = 'in_transit';

                RAISE NOTICE 'All orders delivered for Route Plan ID %. Status changed to completed.', v_plan_id;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_route_on_delivery"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_route_on_delivery"() IS 'เมื่อ Order delivered → Route: in_transit→completed (ถ้าทุก Order ส่งถึง)';



CREATE OR REPLACE FUNCTION "public"."update_route_plan_status_and_orders"("p_plan_id" bigint, "p_new_status" "public"."receiving_route_plan_status_enum") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    PERFORM public.update_route_plan_status_and_orders_comprehensive(p_plan_id, p_new_status);
END;
$$;


ALTER FUNCTION "public"."update_route_plan_status_and_orders"("p_plan_id" bigint, "p_new_status" "public"."receiving_route_plan_status_enum") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_route_plan_status_and_orders"("p_plan_id" bigint, "p_new_status" "public"."receiving_route_plan_status_enum") IS 'Updates route plan status and linked order statuses. Gets orders from direct order_id references, tags.order_ids JSON field, and ALL orders for customers in the plan to ensure no orders are missed when plan is published.';



CREATE OR REPLACE FUNCTION "public"."update_route_plan_status_and_orders_comprehensive"("p_plan_id" bigint, "p_new_status" "public"."receiving_route_plan_status_enum") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_order_status order_status_enum;
    v_customer_ids VARCHAR[];
    v_direct_order_ids BIGINT[];
    v_customer_order_ids BIGINT[];
    v_tag_order_ids BIGINT[];
    v_all_order_ids BIGINT[];
    v_tags_column_exists BOOLEAN;
    v_order_id_column_exists BOOLEAN;
BEGIN
    -- Check if columns exist
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'receiving_route_stops' 
        AND column_name = 'tags'
    ) INTO v_tags_column_exists;

    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'receiving_route_stops' 
        AND column_name = 'order_id'
    ) INTO v_order_id_column_exists;

    -- Update the route plan status
    UPDATE public.receiving_route_plans
    SET status = p_new_status,
        updated_at = CURRENT_TIMESTAMP,
        published_at = CASE
            WHEN p_new_status = 'published' THEN CURRENT_TIMESTAMP
            ELSE published_at
        END
    WHERE plan_id = p_plan_id;

    -- Determine the target order status
    IF p_new_status = 'published' THEN
        v_order_status := 'confirmed';
    ELSIF p_new_status = 'optimizing' OR p_new_status = 'draft' THEN
        v_order_status := 'draft';
    ELSE
        RETURN; -- No status change needed for other statuses
    END IF;

    -- Step 1: Get all unique customer_ids from stops in this plan
    SELECT ARRAY_AGG(DISTINCT customer_id)
    INTO v_customer_ids
    FROM public.receiving_route_stops
    WHERE plan_id = p_plan_id
      AND customer_id IS NOT NULL;

    -- Step 2: Get order_ids from direct order_id references (if column exists)
    IF v_order_id_column_exists THEN
        SELECT ARRAY_AGG(DISTINCT order_id)
        INTO v_direct_order_ids
        FROM public.receiving_route_stops
        WHERE plan_id = p_plan_id
          AND order_id IS NOT NULL;
    END IF;

    -- Step 3: Get order_ids from the tags JSON field (if column exists)
    IF v_tags_column_exists THEN
        SELECT ARRAY_AGG(DISTINCT order_id)
        INTO v_tag_order_ids
        FROM (
            SELECT jsonb_array_elements_text(tags->'order_ids')::BIGINT as order_id
            FROM public.receiving_route_stops
            WHERE plan_id = p_plan_id
              AND tags IS NOT NULL
              AND tags->>'order_ids' IS NOT NULL
        ) subq
        WHERE order_id IS NOT NULL;
    END IF;

    -- Step 4: Get ALL order_ids for customers in this plan (this is the key fix)
    IF v_customer_ids IS NOT NULL AND array_length(v_customer_ids, 1) > 0 THEN
        SELECT ARRAY_AGG(DISTINCT order_id)
        INTO v_customer_order_ids
        FROM public.wms_orders
        WHERE customer_id = ANY(v_customer_ids)
          AND order_id IS NOT NULL;
    END IF;

    -- Step 5: Combine all order_ids from all sources
    -- Start with direct order_ids
    IF v_direct_order_ids IS NOT NULL AND array_length(v_direct_order_ids, 1) > 0 THEN
        v_all_order_ids := v_direct_order_ids;
    END IF;

    -- Add tag order_ids
    IF v_tag_order_ids IS NOT NULL AND array_length(v_tag_order_ids, 1) > 0 THEN
        IF v_all_order_ids IS NOT NULL AND array_length(v_all_order_ids, 1) > 0 THEN
            v_all_order_ids := v_all_order_ids || v_tag_order_ids;
        ELSE
            v_all_order_ids := v_tag_order_ids;
        END IF;
    END IF;

    -- Add customer order_ids (this ensures ALL orders for customers in the plan are updated)
    IF v_customer_order_ids IS NOT NULL AND array_length(v_customer_order_ids, 1) > 0 THEN
        IF v_all_order_ids IS NOT NULL AND array_length(v_all_order_ids, 1) > 0 THEN
            v_all_order_ids := v_all_order_ids || v_customer_order_ids;
        ELSE
            v_all_order_ids := v_customer_order_ids;
        END IF;
    END IF;

    -- Step 6: Remove duplicates and update all found orders
    IF v_all_order_ids IS NOT NULL AND array_length(v_all_order_ids, 1) > 0 THEN
        -- Remove duplicates using a subquery
        SELECT ARRAY_AGG(DISTINCT order_id)
        INTO v_all_order_ids
        FROM (
            SELECT unnest(v_all_order_ids) as order_id
        ) combined;
        
        UPDATE public.wms_orders
        SET status = v_order_status,
            updated_at = CURRENT_TIMESTAMP
        WHERE order_id = ANY(v_all_order_ids);
    END IF;

END;
$$;


ALTER FUNCTION "public"."update_route_plan_status_and_orders_comprehensive"("p_plan_id" bigint, "p_new_status" "public"."receiving_route_plan_status_enum") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_stock_alert_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_stock_alert_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_stock_balance_after_movement"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Update stock at destination location
    IF NEW.to_location_id IS NOT NULL THEN
        INSERT INTO wms_stock_balance (
            location_id, sku_id, lot_no, batch_no, serial_no, 
            expiry_date, manufacture_date, available_qty
        ) VALUES (
            NEW.to_location_id, NEW.sku_id, NEW.lot_no, NEW.batch_no, NEW.serial_no,
            NEW.expiry_date, NULL, NEW.qty
        )
        ON CONFLICT (location_id, sku_id, lot_no, batch_no)
        DO UPDATE SET
            available_qty = wms_stock_balance.available_qty + NEW.qty,
            last_movement_date = CURRENT_TIMESTAMP;
    END IF;
    
    -- Update stock at source location
    IF NEW.from_location_id IS NOT NULL THEN
        UPDATE wms_stock_balance 
        SET 
            available_qty = available_qty - NEW.qty,
            last_movement_date = CURRENT_TIMESTAMP
        WHERE 
            location_id = NEW.from_location_id 
            AND sku_id = NEW.sku_id 
            AND (lot_no = NEW.lot_no OR (lot_no IS NULL AND NEW.lot_no IS NULL))
            AND (batch_no = NEW.batch_no OR (batch_no IS NULL AND NEW.batch_no IS NULL));
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_stock_balance_after_movement"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_warehouse_task_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_warehouse_task_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_wms_inventory_balances_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_wms_inventory_balances_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_wms_inventory_ledger_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_wms_inventory_ledger_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_wms_move_items_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_wms_move_items_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_wms_moves_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_wms_moves_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_wms_order_items_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_wms_order_items_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_wms_orders_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_wms_orders_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_wms_receive_items_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_wms_receive_items_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_wms_receive_pallet_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_wms_receive_pallet_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_wms_receive_universal_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_wms_receive_universal_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_wms_receive_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_wms_receive_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_wms_receives_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_wms_receives_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_dispatch_balance"("p_warehouse_id" "text", "p_location_id" "text", "p_sku_id" "text", "p_production_date" "date", "p_expiry_date" "date", "p_lot_no" "text", "p_pack_qty" numeric, "p_piece_qty" numeric) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Use INSERT ... ON CONFLICT to handle concurrent inserts
  INSERT INTO wms_inventory_balances (
    warehouse_id,
    location_id,
    sku_id,
    production_date,
    expiry_date,
    lot_no,
    total_pack_qty,
    total_piece_qty,
    reserved_pack_qty,
    reserved_piece_qty,
    last_movement_at,
    created_at,
    updated_at
  )
  VALUES (
    p_warehouse_id,
    p_location_id,
    p_sku_id,
    p_production_date,
    p_expiry_date,
    p_lot_no,
    p_pack_qty,
    p_piece_qty,
    0,
    0,
    NOW(),
    NOW(),
    NOW()
  )
  ON CONFLICT (warehouse_id, location_id, sku_id, 
                COALESCE(production_date, '1900-01-01'::DATE), 
                COALESCE(expiry_date, '1900-01-01'::DATE), 
                COALESCE(lot_no, ''))
  DO UPDATE SET
    total_pack_qty = wms_inventory_balances.total_pack_qty + p_pack_qty,
    total_piece_qty = wms_inventory_balances.total_piece_qty + p_piece_qty,
    last_movement_at = NOW(),
    updated_at = NOW();
END;
$$;


ALTER FUNCTION "public"."upsert_dispatch_balance"("p_warehouse_id" "text", "p_location_id" "text", "p_sku_id" "text", "p_production_date" "date", "p_expiry_date" "date", "p_lot_no" "text", "p_pack_qty" numeric, "p_piece_qty" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_inventory_balance"("p_warehouse_id" character varying, "p_location_id" character varying, "p_sku_id" character varying, "p_pallet_id" character varying, "p_pack_qty" numeric, "p_piece_qty" numeric) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_existing_balance RECORD;
    v_new_pack_qty DECIMAL(18,2);
    v_new_piece_qty DECIMAL(18,2);
BEGIN
    SELECT * INTO v_existing_balance
    FROM wms_inventory_balances
    WHERE warehouse_id = p_warehouse_id
    AND location_id = p_location_id
    AND sku_id = p_sku_id
    AND COALESCE(pallet_id, '') = COALESCE(p_pallet_id, '');

    IF FOUND THEN
        v_new_pack_qty := COALESCE(v_existing_balance.total_pack_qty, 0) + p_pack_qty;
        v_new_piece_qty := COALESCE(v_existing_balance.total_piece_qty, 0) + p_piece_qty;

        IF v_new_pack_qty <= 0 AND v_new_piece_qty <= 0 THEN
            DELETE FROM wms_inventory_balances WHERE balance_id = v_existing_balance.balance_id;
        ELSE
            UPDATE wms_inventory_balances
            SET total_pack_qty = v_new_pack_qty,
                total_piece_qty = v_new_piece_qty,
                last_movement_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE balance_id = v_existing_balance.balance_id;
        END IF;
    ELSE
        IF p_pack_qty > 0 OR p_piece_qty > 0 THEN
            INSERT INTO wms_inventory_balances (
                warehouse_id, location_id, sku_id, pallet_id,
                total_pack_qty, total_piece_qty, last_movement_at
            ) VALUES (
                p_warehouse_id, p_location_id, p_sku_id, p_pallet_id,
                p_pack_qty, p_piece_qty, CURRENT_TIMESTAMP
            );
        END IF;
    END IF;
END;
$$;


ALTER FUNCTION "public"."upsert_inventory_balance"("p_warehouse_id" character varying, "p_location_id" character varying, "p_sku_id" character varying, "p_pallet_id" character varying, "p_pack_qty" numeric, "p_piece_qty" numeric) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."upsert_inventory_balance"("p_warehouse_id" character varying, "p_location_id" character varying, "p_sku_id" character varying, "p_pallet_id" character varying, "p_pack_qty" numeric, "p_piece_qty" numeric) IS 'อัพเดทหรือสร้างยอดคงเหลือสินค้า ลบ record ที่มียอดเป็น 0 และ skip การ insert ค่าลบ';



CREATE OR REPLACE FUNCTION "public"."validate_express_orders_for_face_sheet"() RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    result JSONB;
    missing_customers JSONB;
    missing_hubs JSONB;
BEGIN
    -- Find customers from express orders that are not in master_customer
    SELECT jsonb_agg(T.customer_id)
    INTO missing_customers
    FROM (
        SELECT DISTINCT o.customer_id
        FROM wms_orders o
        JOIN wms_order_items oi ON o.order_id = oi.order_id
        WHERE o.order_type = 'express'
          AND o.customer_id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1
              FROM master_customer mc
              WHERE mc.customer_id = o.customer_id
          )
    ) T;

    -- Find customers from express orders that are in master_customer but have no hub
    SELECT jsonb_agg(T.customer_id)
    INTO missing_hubs
    FROM (
        SELECT DISTINCT o.customer_id
        FROM wms_orders o
        JOIN wms_order_items oi ON o.order_id = oi.order_id
        JOIN master_customer mc ON o.customer_id = mc.customer_id
        WHERE o.order_type = 'express'
          AND (mc.hub IS NULL OR TRIM(mc.hub) = '')
    ) T;

    -- Combine results
    result := jsonb_build_object(
        'missing_customers', COALESCE(missing_customers, '[]'::jsonb),
        'missing_hubs', COALESCE(missing_hubs, '[]'::jsonb)
    );

    RETURN result;
END;
$$;


ALTER FUNCTION "public"."validate_express_orders_for_face_sheet"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_loadlist_status_transition"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- ถ้าสถานะไม่เปลี่ยน → อนุญาต
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    -- Validate transitions
    CASE OLD.status
        -- From 'pending'
        WHEN 'pending' THEN
            IF NEW.status NOT IN ('loaded', 'cancelled') THEN
                RAISE EXCEPTION 'Invalid loadlist status transition: pending → %. Allowed: loaded, cancelled', NEW.status;
            END IF;

        -- From 'loaded' (final state - waiting for completion)
        WHEN 'loaded' THEN
            IF NEW.status NOT IN ('completed', 'loaded') THEN
                RAISE EXCEPTION 'Invalid loadlist status transition: loaded → %. Allowed: completed', NEW.status;
            END IF;

        -- From 'completed' (final state)
        WHEN 'completed' THEN
            IF NEW.status != 'completed' THEN
                RAISE EXCEPTION 'Invalid loadlist status transition: completed is a final state. Cannot change to %', NEW.status;
            END IF;

        -- From 'cancelled' (final state)
        WHEN 'cancelled' THEN
            IF NEW.status != 'cancelled' THEN
                RAISE EXCEPTION 'Invalid loadlist status transition: cancelled is a final state. Cannot change to %', NEW.status;
            END IF;

        ELSE
            RAISE EXCEPTION 'Unknown loadlist status: %', OLD.status;
    END CASE;

    RAISE NOTICE 'Loadlist % status changed: % → %', NEW.id, OLD.status, NEW.status;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_loadlist_status_transition"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."validate_loadlist_status_transition"() IS 'Validates loadlist status transitions to prevent invalid workflow state changes';



CREATE OR REPLACE FUNCTION "public"."validate_order_status_transition"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- ถ้าสถานะไม่เปลี่ยน → อนุญาต
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    -- Validate transitions
    CASE OLD.status
        WHEN 'draft' THEN
            IF NEW.status NOT IN ('confirmed', 'cancelled') THEN
                RAISE EXCEPTION 'Invalid order status transition: draft → %. Allowed: confirmed, cancelled', NEW.status;
            END IF;

        WHEN 'confirmed' THEN
            -- ✅ เพิ่ม 'draft' เพื่อให้สามารถถอยกลับได้
            IF NEW.status NOT IN ('draft', 'in_picking', 'cancelled') THEN
                RAISE EXCEPTION 'Invalid order status transition: confirmed → %. Allowed: draft, in_picking, cancelled', NEW.status;
            END IF;

        WHEN 'in_picking' THEN
            IF NEW.status NOT IN ('picked', 'confirmed', 'cancelled') THEN
                RAISE EXCEPTION 'Invalid order status transition: in_picking → %. Allowed: picked, confirmed, cancelled', NEW.status;
            END IF;

        WHEN 'picked' THEN
            IF NEW.status NOT IN ('loaded', 'in_picking', 'cancelled') THEN
                RAISE EXCEPTION 'Invalid order status transition: picked → %. Allowed: loaded, in_picking, cancelled', NEW.status;
            END IF;

        WHEN 'loaded' THEN
            IF NEW.status NOT IN ('in_transit', 'picked', 'cancelled') THEN
                RAISE EXCEPTION 'Invalid order status transition: loaded → %. Allowed: in_transit, picked, cancelled', NEW.status;
            END IF;

        WHEN 'in_transit' THEN
            IF NEW.status NOT IN ('delivered', 'failed', 'cancelled') THEN
                RAISE EXCEPTION 'Invalid order status transition: in_transit → %. Allowed: delivered, failed, cancelled', NEW.status;
            END IF;

        WHEN 'delivered' THEN
            -- Final state - cannot change
            IF NEW.status != 'delivered' THEN
                RAISE EXCEPTION 'Invalid order status transition: delivered is a final state. Cannot change to %', NEW.status;
            END IF;

        WHEN 'failed' THEN
            -- Can retry
            IF NEW.status NOT IN ('in_transit', 'cancelled', 'failed') THEN
                RAISE EXCEPTION 'Invalid order status transition: failed → %. Allowed: in_transit (retry), cancelled', NEW.status;
            END IF;

        WHEN 'cancelled' THEN
            IF NEW.status != 'cancelled' THEN
                RAISE EXCEPTION 'Invalid order status transition: cancelled is a final state. Cannot change to %', NEW.status;
            END IF;

        ELSE
            RAISE EXCEPTION 'Unknown order status: %', OLD.status;
    END CASE;

    RAISE NOTICE 'Order % status changed: % → %', NEW.order_id, OLD.status, NEW.status;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_order_status_transition"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."validate_order_status_transition"() IS 'Validates order status transitions. Updated to allow confirmed → draft for face sheet deletion scenarios.';



CREATE OR REPLACE FUNCTION "public"."validate_picklist_status_transition"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- ถ้าสถานะไม่เปลี่ยน → อนุญาต
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    -- Validate transitions based on current status
    CASE OLD.status
        -- From 'pending'
        WHEN 'pending' THEN
            IF NEW.status NOT IN ('assigned', 'cancelled') THEN
                RAISE EXCEPTION 'Invalid status transition: pending → %. Allowed: assigned, cancelled', NEW.status;
            END IF;

        -- From 'assigned'
        WHEN 'assigned' THEN
            IF NEW.status NOT IN ('picking', 'pending', 'cancelled') THEN
                RAISE EXCEPTION 'Invalid status transition: assigned → %. Allowed: picking, pending, cancelled', NEW.status;
            END IF;

        -- From 'picking'
        WHEN 'picking' THEN
            IF NEW.status NOT IN ('completed', 'assigned', 'cancelled') THEN
                RAISE EXCEPTION 'Invalid status transition: picking → %. Allowed: completed, assigned, cancelled', NEW.status;
            END IF;

        -- From 'completed' (final state)
        WHEN 'completed' THEN
            IF NEW.status != 'completed' THEN
                RAISE EXCEPTION 'Invalid status transition: completed is a final state. Cannot change to %', NEW.status;
            END IF;

        -- From 'cancelled' (final state)
        WHEN 'cancelled' THEN
            IF NEW.status != 'cancelled' THEN
                RAISE EXCEPTION 'Invalid status transition: cancelled is a final state. Cannot change to %', NEW.status;
            END IF;

        ELSE
            RAISE EXCEPTION 'Unknown picklist status: %', OLD.status;
    END CASE;

    RAISE NOTICE 'Picklist % status changed: % → %', NEW.id, OLD.status, NEW.status;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_picklist_status_transition"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."validate_picklist_status_transition"() IS 'Validates picklist status transitions to prevent invalid workflow state changes';



CREATE OR REPLACE FUNCTION "public"."validate_route_plan_status_transition"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- ถ้าสถานะไม่เปลี่ยน → อนุญาต
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    -- Validate transitions
    CASE OLD.status
        WHEN 'draft' THEN
            IF NEW.status NOT IN ('optimizing', 'published', 'cancelled') THEN
                RAISE EXCEPTION 'Invalid route plan status transition: draft → %. Allowed: optimizing, published, cancelled', NEW.status;
            END IF;

        WHEN 'optimizing' THEN
            IF NEW.status NOT IN ('published', 'draft', 'cancelled') THEN
                RAISE EXCEPTION 'Invalid route plan status transition: optimizing → %. Allowed: published, draft, cancelled', NEW.status;
            END IF;

        WHEN 'published' THEN
            IF NEW.status NOT IN ('pending_approval', 'ready_to_load', 'cancelled') THEN
                RAISE EXCEPTION 'Invalid route plan status transition: published → %. Allowed: pending_approval, ready_to_load, cancelled', NEW.status;
            END IF;

        WHEN 'pending_approval' THEN
            IF NEW.status NOT IN ('approved', 'published', 'cancelled') THEN
                RAISE EXCEPTION 'Invalid route plan status transition: pending_approval → %. Allowed: approved, published, cancelled', NEW.status;
            END IF;

        WHEN 'approved' THEN
            IF NEW.status NOT IN ('ready_to_load', 'cancelled') THEN
                RAISE EXCEPTION 'Invalid route plan status transition: approved → %. Allowed: ready_to_load, cancelled', NEW.status;
            END IF;

        WHEN 'ready_to_load' THEN
            IF NEW.status NOT IN ('in_transit', 'approved', 'cancelled') THEN
                RAISE EXCEPTION 'Invalid route plan status transition: ready_to_load → %. Allowed: in_transit, approved, cancelled', NEW.status;
            END IF;

        WHEN 'in_transit' THEN
            IF NEW.status NOT IN ('completed', 'in_transit') THEN
                RAISE EXCEPTION 'Invalid route plan status transition: in_transit → %. Allowed: completed', NEW.status;
            END IF;

        WHEN 'completed' THEN
            IF NEW.status != 'completed' THEN
                RAISE EXCEPTION 'Invalid route plan status transition: completed is a final state. Cannot change to %', NEW.status;
            END IF;

        WHEN 'cancelled' THEN
            IF NEW.status != 'cancelled' THEN
                RAISE EXCEPTION 'Invalid route plan status transition: cancelled is a final state. Cannot change to %', NEW.status;
            END IF;

        ELSE
            RAISE EXCEPTION 'Unknown route plan status: %', OLD.status;
    END CASE;

    RAISE NOTICE 'Route Plan % status changed: % → %', NEW.plan_id, OLD.status, NEW.status;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_route_plan_status_transition"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."validate_route_plan_status_transition"() IS 'Validates route plan status transitions to prevent invalid workflow state changes';



CREATE OR REPLACE FUNCTION "public"."wms_recommend_putaway_locations"("p_warehouse_id" character varying, "p_sku_id" character varying, "p_expected_pack_qty" numeric DEFAULT 0, "p_expected_piece_qty" numeric DEFAULT 0, "p_expected_expiry" "date" DEFAULT NULL::"date") RETURNS TABLE("recommendation_rank" integer, "strategy_id" "uuid", "strategy_code" character varying, "strategy_name" character varying, "location_id" character varying, "location_code" character varying, "location_name" character varying, "zone" character varying, "location_type" character varying, "source_type" "text", "is_primary" boolean, "current_pack_qty" numeric, "current_piece_qty" numeric, "available_piece_capacity" numeric, "available_capacity_pct" numeric, "remaining_pack_allocation" numeric, "target_min_expiry" "date", "target_max_expiry" "date", "target_expiry_bucket_count" integer, "target_lot_bucket_count" integer, "allow_mixed_expiry" boolean, "allow_mixed_lot" boolean, "allow_mixed_sku" boolean, "has_target_sku" boolean, "has_other_sku" boolean, "occupancy_state" "text", "expiry_gap_days" integer, "candidate_priority" integer, "require_empty" boolean, "require_same_sku" boolean, "capacity_threshold_pct" numeric, "max_open_pallets" integer, "projected_piece_total" numeric, "projected_pack_total" numeric)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    WITH strategy_sku_settings AS (
        SELECT
            ss.strategy_id,
            ss.strategy_code,
            ss.strategy_name,
            ss.priority AS strategy_priority,
            COALESCE(ssku.priority, ss.priority) AS sku_priority,
            COALESCE(ssku.is_primary, FALSE) AS is_primary,
            COALESCE(ssku.allow_mixed_expiry, FALSE) AS allow_mixed_expiry,
            COALESCE(ssku.allow_mixed_lot, FALSE) AS allow_mixed_lot,
            COALESCE(ssku.allow_mixed_sku, FALSE) AS allow_mixed_sku,
            ssku.max_locations,
            ssku.min_remaining_shelf_life_days,
            ssku.max_days_difference_expiry
        FROM storage_strategy ss
        JOIN storage_strategy_sku_settings ssku
          ON ssku.strategy_id = ss.strategy_id
        WHERE ss.warehouse_id = p_warehouse_id
          AND ssku.sku_id = p_sku_id
          AND ss.status = 'active'
          AND (ss.effective_from IS NULL OR ss.effective_from <= CURRENT_DATE)
          AND (ss.effective_to IS NULL OR ss.effective_to >= CURRENT_DATE)
    ),
    strategy_scope_locations AS (
        SELECT
            sss.strategy_id,
            sss.strategy_code,
            sss.strategy_name,
            sss.strategy_priority,
            sss.sku_priority,
            sss.is_primary,
            sss.allow_mixed_expiry AS sku_allow_mixed_expiry,
            sss.allow_mixed_lot AS sku_allow_mixed_lot,
            sss.allow_mixed_sku AS sku_allow_mixed_sku,
            sss.max_locations,
            sc.scope_id,
            sc.scope_type,
            COALESCE(sc.priority, 50) AS scope_priority,
            loc.location_id,
            loc.location_code,
            loc.location_name,
            loc.zone,
            loc.location_type,
            loc.max_capacity_qty,
            loc.max_capacity_weight_kg,
            sc.allow_only_empty,
            sc.allow_same_sku_only,
            sc.allow_mixed_expiry,
            sc.allow_mixed_lot,
            sc.capacity_threshold_pct,
            sc.max_open_pallets
        FROM strategy_sku_settings sss
        JOIN storage_strategy_scope sc
          ON sc.strategy_id = sss.strategy_id
         AND sc.warehouse_id = p_warehouse_id
        JOIN LATERAL (
            SELECT ml.*
            FROM master_location ml
            WHERE ml.warehouse_id = p_warehouse_id
              AND ml.active_status = 'active'
              AND (
                    (sc.scope_type <> 'group' AND sc.scope_type = 'all') OR
                    (sc.scope_type <> 'group' AND sc.scope_type = 'zone' AND ml.zone = sc.zone) OR
                    (sc.scope_type <> 'group' AND sc.scope_type = 'location_type' AND ml.location_type = sc.location_type) OR
                    (sc.scope_type <> 'group' AND sc.scope_type = 'aisle' AND ml.aisle = sc.aisle) OR
                    (sc.scope_type <> 'group' AND sc.scope_type = 'rack' AND ml.rack = sc.rack) OR
                    (sc.scope_type <> 'group' AND sc.scope_type = 'shelf' AND ml.shelf = sc.shelf) OR
                    (sc.scope_type <> 'group' AND sc.scope_type = 'bin' AND ml.bin = sc.bin) OR
                    (sc.scope_type <> 'group' AND sc.scope_type = 'location' AND ml.location_id = sc.location_id)
              )
            UNION ALL
            SELECT ml.*
            FROM location_group_members lgm
            JOIN master_location ml ON ml.location_id = lgm.location_id
            WHERE sc.scope_type = 'group'
              AND lgm.group_id = sc.group_id
              AND ml.warehouse_id = p_warehouse_id
              AND ml.active_status = 'active'
        ) loc ON TRUE
    ),
    allocation_candidates AS (
        SELECT
            lsa.allocation_id,
            lsa.strategy_id,
            loc.location_id,
            loc.location_code,
            loc.location_name,
            loc.zone,
            loc.location_type,
            loc.max_capacity_qty,
            loc.max_capacity_weight_kg,
            lsa.priority,
            lsa.is_primary,
            lsa.allow_mixed_expiry,
            lsa.allow_mixed_lot,
            lsa.allow_mixed_sku,
            lsa.enforce_single_pallet,
            lsa.max_pack_qty,
            lsa.max_piece_qty
        FROM location_sku_allocation lsa
        JOIN master_location loc ON loc.location_id = lsa.location_id
        WHERE lsa.sku_id = p_sku_id
          AND loc.warehouse_id = p_warehouse_id
          AND loc.active_status = 'active'
          AND (lsa.effective_from IS NULL OR lsa.effective_from <= CURRENT_DATE)
          AND (lsa.effective_to IS NULL OR lsa.effective_to >= CURRENT_DATE)
    ),
    candidate_locations AS (
        SELECT
            ac.strategy_id,
            ss.strategy_code,
            ss.strategy_name,
            ac.location_id,
            ac.location_code,
            ac.location_name,
            ac.zone,
            ac.location_type,
            ac.max_capacity_qty,
            ac.max_capacity_weight_kg,
            ac.priority AS candidate_priority,
            ac.is_primary,
            COALESCE(ac.allow_mixed_expiry, FALSE) AS allow_mixed_expiry,
            COALESCE(ac.allow_mixed_lot, FALSE) AS allow_mixed_lot,
            COALESCE(ac.allow_mixed_sku, FALSE) AS allow_mixed_sku,
            ac.enforce_single_pallet AS require_empty,
            FALSE AS require_same_sku,
            ac.max_pack_qty,
            ac.max_piece_qty,
            NULL::NUMERIC AS capacity_threshold_pct,
            NULL::INTEGER AS max_open_pallets,
            'allocation'::TEXT AS source_type
        FROM allocation_candidates ac
        LEFT JOIN storage_strategy ss ON ss.strategy_id = ac.strategy_id

        UNION ALL

        SELECT
            ssl.strategy_id,
            ssl.strategy_code,
            ssl.strategy_name,
            ssl.location_id,
            ssl.location_code,
            ssl.location_name,
            ssl.zone,
            ssl.location_type,
            ssl.max_capacity_qty,
            ssl.max_capacity_weight_kg,
            (ssl.strategy_priority * 100) + ssl.scope_priority AS candidate_priority,
            ssl.is_primary,
            COALESCE(ssl.allow_mixed_expiry, ssl.sku_allow_mixed_expiry, FALSE) AS allow_mixed_expiry,
            COALESCE(ssl.allow_mixed_lot, ssl.sku_allow_mixed_lot, FALSE) AS allow_mixed_lot,
            COALESCE(ssl.sku_allow_mixed_sku, FALSE) AS allow_mixed_sku,
            ssl.allow_only_empty AS require_empty,
            ssl.allow_same_sku_only AS require_same_sku,
            NULL::NUMERIC AS max_pack_qty,
            NULL::NUMERIC AS max_piece_qty,
            ssl.capacity_threshold_pct,
            ssl.max_open_pallets,
            'strategy'::TEXT AS source_type
        FROM strategy_scope_locations ssl
    ),
    location_metrics AS (
        SELECT
            ib.location_id,
            SUM(ib.total_pack_qty) AS total_pack_qty,
            SUM(ib.total_piece_qty) AS total_piece_qty,
            SUM(CASE WHEN ib.sku_id = p_sku_id THEN ib.total_pack_qty ELSE 0 END) AS target_pack_qty,
            SUM(CASE WHEN ib.sku_id = p_sku_id THEN ib.total_piece_qty ELSE 0 END) AS target_piece_qty,
            BOOL_OR((ib.total_pack_qty > 0 OR ib.total_piece_qty > 0) AND ib.sku_id = p_sku_id) AS has_target_sku,
            BOOL_OR((ib.total_pack_qty > 0 OR ib.total_piece_qty > 0) AND ib.sku_id <> p_sku_id) AS has_other_sku,
            COUNT(DISTINCT CASE WHEN ib.total_pack_qty > 0 OR ib.total_piece_qty > 0 THEN ib.sku_id END) AS active_sku_count,
            COUNT(DISTINCT CASE WHEN ib.sku_id = p_sku_id AND (ib.total_pack_qty > 0 OR ib.total_piece_qty > 0) AND ib.expiry_date IS NOT NULL THEN ib.expiry_date END) AS target_expiry_bucket_count,
            COUNT(DISTINCT CASE WHEN ib.sku_id = p_sku_id AND (ib.total_pack_qty > 0 OR ib.total_piece_qty > 0) THEN COALESCE(ib.lot_no, CONCAT_WS('::', COALESCE(ib.production_date::TEXT,'~'), COALESCE(ib.expiry_date::TEXT,'~'))) END) AS target_lot_bucket_count,
            MIN(CASE WHEN ib.sku_id = p_sku_id THEN ib.expiry_date END) AS target_min_expiry,
            MAX(CASE WHEN ib.sku_id = p_sku_id THEN ib.expiry_date END) AS target_max_expiry,
            MIN(CASE WHEN ib.total_pack_qty > 0 OR ib.total_piece_qty > 0 THEN ib.expiry_date END) AS location_min_expiry,
            MAX(CASE WHEN ib.total_pack_qty > 0 OR ib.total_piece_qty > 0 THEN ib.expiry_date END) AS location_max_expiry,
            COUNT(DISTINCT CASE WHEN ib.total_pack_qty > 0 OR ib.total_piece_qty > 0 THEN COALESCE(ib.pallet_id, ib.pallet_id_external, '') END) AS active_pallet_count
        FROM wms_inventory_balances ib
        WHERE ib.warehouse_id = p_warehouse_id
        GROUP BY ib.location_id
    ),
    location_profiles AS (
        SELECT
            lsp.location_id,
            lsp.max_pallets,
            lsp.max_skus,
            lsp.max_batches,
            COALESCE(lsp.allow_mixed_sku, TRUE) AS allow_mixed_sku,
            COALESCE(lsp.allow_mixed_lot, TRUE) AS allow_mixed_lot,
            COALESCE(lsp.allow_mixed_expiry, TRUE) AS allow_mixed_expiry
        FROM location_storage_profile lsp
    ),
    incompatible_pairs AS (
        SELECT incompatible_sku_id AS sku_id FROM sku_incompatibilities WHERE sku_id = p_sku_id
        UNION
        SELECT sku_id FROM sku_incompatibilities WHERE incompatible_sku_id = p_sku_id
    ),
    incompatible_locations AS (
        SELECT DISTINCT ib.location_id
        FROM wms_inventory_balances ib
        JOIN incompatible_pairs ip ON ip.sku_id = ib.sku_id
        WHERE ib.warehouse_id = p_warehouse_id
          AND (ib.total_pack_qty > 0 OR ib.total_piece_qty > 0)
    ),
    eligible AS (
        SELECT
            c.strategy_id,
            c.strategy_code,
            c.strategy_name,
            c.location_id,
            c.location_code,
            c.location_name,
            c.zone,
            c.location_type,
            c.source_type,
            c.is_primary,
            c.candidate_priority,
            c.allow_mixed_expiry,
            c.allow_mixed_lot,
            c.allow_mixed_sku,
            c.require_empty,
            c.require_same_sku,
            c.max_pack_qty,
            c.max_piece_qty,
            c.capacity_threshold_pct,
            c.max_open_pallets,
            ml.max_capacity_qty,
            ml.max_capacity_weight_kg,
            lm.total_pack_qty,
            lm.total_piece_qty,
            lm.target_pack_qty,
            lm.target_piece_qty,
            lm.has_target_sku,
            lm.has_other_sku,
            lm.active_sku_count,
            lm.target_expiry_bucket_count,
            lm.target_lot_bucket_count,
            lm.target_min_expiry,
            lm.target_max_expiry,
            lm.location_min_expiry,
            lm.location_max_expiry,
            lm.active_pallet_count,
            COALESCE(lp.allow_mixed_sku, TRUE) AS location_allow_mixed_sku,
            COALESCE(lp.allow_mixed_lot, TRUE) AS location_allow_mixed_lot,
            COALESCE(lp.allow_mixed_expiry, TRUE) AS location_allow_mixed_expiry,
            lp.max_pallets,
            lp.max_skus,
            lp.max_batches,
            CASE
                WHEN c.max_piece_qty IS NOT NULL AND (COALESCE(lm.target_piece_qty,0) + p_expected_piece_qty) > c.max_piece_qty THEN FALSE
                WHEN c.max_pack_qty IS NOT NULL AND (COALESCE(lm.target_pack_qty,0) + p_expected_pack_qty) > c.max_pack_qty THEN FALSE
                ELSE TRUE
            END AS allocation_limit_ok,
            CASE
                WHEN ml.max_capacity_qty IS NULL OR ml.max_capacity_qty = 0 THEN TRUE
                ELSE (COALESCE(lm.total_piece_qty,0) + p_expected_piece_qty) <= ml.max_capacity_qty
            END AS capacity_ok,
            CASE
                WHEN c.capacity_threshold_pct IS NOT NULL
                     AND ml.max_capacity_qty IS NOT NULL
                     AND ml.max_capacity_qty > 0
                     AND ((COALESCE(lm.total_piece_qty,0)::NUMERIC * 100.0) / ml.max_capacity_qty) >= c.capacity_threshold_pct
                THEN FALSE
                ELSE TRUE
            END AS threshold_ok,
            CASE
                WHEN NOT COALESCE(c.allow_mixed_sku, TRUE) AND COALESCE(lm.has_other_sku, FALSE) THEN FALSE
                WHEN NOT COALESCE(lp.allow_mixed_sku, TRUE) AND COALESCE(lm.has_other_sku, FALSE) THEN FALSE
                WHEN c.require_same_sku AND (COALESCE(lm.has_target_sku, FALSE) = FALSE) AND (COALESCE(lm.total_piece_qty,0) > 0 OR COALESCE(lm.total_pack_qty,0) > 0) THEN FALSE
                WHEN c.require_empty AND (COALESCE(lm.total_piece_qty,0) > 0 OR COALESCE(lm.total_pack_qty,0) > 0) THEN FALSE
                ELSE TRUE
            END AS mix_ok,
            CASE
                WHEN NOT COALESCE(c.allow_mixed_expiry, TRUE)
                     AND COALESCE(lm.has_target_sku, FALSE)
                     AND (
                         (p_expected_expiry IS NOT NULL AND lm.target_min_expiry IS NOT NULL AND lm.target_min_expiry <> p_expected_expiry) OR
                         (p_expected_expiry IS NOT NULL AND lm.target_max_expiry IS NOT NULL AND lm.target_max_expiry <> p_expected_expiry) OR
                         (p_expected_expiry IS NULL AND COALESCE(lm.target_expiry_bucket_count,0) > 1)
                     )
                THEN FALSE
                WHEN NOT COALESCE(lp.allow_mixed_expiry, TRUE)
                     AND COALESCE(lm.has_target_sku, FALSE)
                     AND (
                         (p_expected_expiry IS NOT NULL AND lm.target_min_expiry IS NOT NULL AND lm.target_min_expiry <> p_expected_expiry) OR
                         (p_expected_expiry IS NULL AND COALESCE(lm.target_expiry_bucket_count,0) > 1)
                     )
                THEN FALSE
                ELSE TRUE
            END AS expiry_ok,
            CASE
                WHEN NOT COALESCE(c.allow_mixed_lot, TRUE)
                     AND COALESCE(lm.has_target_sku, FALSE)
                     AND COALESCE(lm.target_lot_bucket_count,0) > 1
                THEN FALSE
                WHEN NOT COALESCE(lp.allow_mixed_lot, TRUE)
                     AND COALESCE(lm.has_target_sku, FALSE)
                     AND COALESCE(lm.target_lot_bucket_count,0) > 1
                THEN FALSE
                ELSE TRUE
            END AS lot_ok,
            CASE WHEN il.location_id IS NULL THEN TRUE ELSE FALSE END AS incompatibility_ok
        FROM candidate_locations c
        JOIN master_location ml ON ml.location_id = c.location_id
        LEFT JOIN location_metrics lm ON lm.location_id = c.location_id
        LEFT JOIN location_profiles lp ON lp.location_id = c.location_id
        LEFT JOIN incompatible_locations il ON il.location_id = c.location_id
    ),
    filtered AS (
        SELECT
            e.*,
            CASE
                WHEN COALESCE(e.total_pack_qty,0) = 0 AND COALESCE(e.total_piece_qty,0) = 0 THEN 'empty'
                WHEN COALESCE(e.has_target_sku, FALSE) AND NOT COALESCE(e.has_other_sku, FALSE) THEN 'same_sku_only'
                WHEN COALESCE(e.has_target_sku, FALSE) AND COALESCE(e.has_other_sku, FALSE) THEN 'mixed_with_other'
                WHEN COALESCE(e.has_other_sku, FALSE) THEN 'occupied_other_sku'
                ELSE 'unknown'
            END AS occupancy_state,
            CASE
                WHEN p_expected_expiry IS NOT NULL AND e.target_min_expiry IS NOT NULL THEN ABS((e.target_min_expiry - p_expected_expiry))
                ELSE NULL
            END AS expiry_gap_days
        FROM eligible e
        WHERE e.allocation_limit_ok
          AND e.capacity_ok
          AND e.threshold_ok
          AND e.mix_ok
          AND e.expiry_ok
          AND e.lot_ok
          AND e.incompatibility_ok
    )
    SELECT
        ROW_NUMBER() OVER (
            ORDER BY
                filtered.candidate_priority,
                CASE WHEN COALESCE(filtered.has_target_sku, FALSE) THEN 0 ELSE 1 END,
                COALESCE(filtered.expiry_gap_days, 9999),
                filtered.location_code
        ) AS recommendation_rank,
        filtered.strategy_id,
        filtered.strategy_code,
        filtered.strategy_name,
        filtered.location_id,
        filtered.location_code,
        filtered.location_name,
        filtered.zone,
        filtered.location_type,
        filtered.source_type,
        filtered.is_primary,
        COALESCE(filtered.total_pack_qty,0) AS current_pack_qty,
        COALESCE(filtered.total_piece_qty,0) AS current_piece_qty,
        CASE
            WHEN filtered.max_capacity_qty IS NULL OR filtered.max_capacity_qty = 0 THEN NULL
            ELSE GREATEST(filtered.max_capacity_qty - COALESCE(filtered.total_piece_qty,0), 0)
        END AS available_piece_capacity,
        CASE
            WHEN filtered.max_capacity_qty IS NULL OR filtered.max_capacity_qty = 0 THEN NULL
            ELSE ROUND(
                (GREATEST(filtered.max_capacity_qty - COALESCE(filtered.total_piece_qty,0), 0)::NUMERIC * 100.0)
                / filtered.max_capacity_qty,
                2
            )
        END AS available_capacity_pct,
        CASE
            WHEN filtered.max_pack_qty IS NOT NULL THEN GREATEST(filtered.max_pack_qty - COALESCE(filtered.target_pack_qty,0), 0)
            ELSE NULL
        END AS remaining_pack_allocation,
        filtered.target_min_expiry,
        filtered.target_max_expiry,
        COALESCE(filtered.target_expiry_bucket_count,0) AS target_expiry_bucket_count,
        COALESCE(filtered.target_lot_bucket_count,0) AS target_lot_bucket_count,
        filtered.allow_mixed_expiry,
        filtered.allow_mixed_lot,
        filtered.allow_mixed_sku,
        COALESCE(filtered.has_target_sku, FALSE) AS has_target_sku,
        COALESCE(filtered.has_other_sku, FALSE) AS has_other_sku,
        filtered.occupancy_state,
        filtered.expiry_gap_days,
        filtered.candidate_priority,
        filtered.require_empty,
        filtered.require_same_sku,
        filtered.capacity_threshold_pct,
        filtered.max_open_pallets,
        COALESCE(filtered.total_piece_qty,0) + p_expected_piece_qty AS projected_piece_total,
        COALESCE(filtered.total_pack_qty,0) + p_expected_pack_qty AS projected_pack_total
    FROM filtered
    ORDER BY recommendation_rank;
END;
$$;


ALTER FUNCTION "public"."wms_recommend_putaway_locations"("p_warehouse_id" character varying, "p_sku_id" character varying, "p_expected_pack_qty" numeric, "p_expected_piece_qty" numeric, "p_expected_expiry" "date") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."master_freight_rate" (
    "freight_rate_id" bigint NOT NULL,
    "carrier_id" character varying(50) NOT NULL,
    "route_name" character varying(255) NOT NULL,
    "origin_province" character varying(100) NOT NULL,
    "origin_district" character varying(100),
    "destination_province" character varying(100) NOT NULL,
    "destination_district" character varying(100),
    "total_distance_km" numeric(10,2) NOT NULL,
    "base_price" numeric(10,2) NOT NULL,
    "extra_drop_price" numeric(10,2),
    "helper_price" numeric(10,2),
    "price_unit" character varying(20) DEFAULT 'trip'::character varying NOT NULL,
    "effective_start_date" "date" NOT NULL,
    "effective_end_date" "date",
    "notes" "text",
    "created_by" character varying(100) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "pricing_mode" character varying(20) DEFAULT 'flat'::character varying,
    CONSTRAINT "chk_effective_dates" CHECK ((("effective_end_date" IS NULL) OR ("effective_end_date" >= "effective_start_date"))),
    CONSTRAINT "chk_positive_base_price" CHECK (("base_price" > (0)::numeric)),
    CONSTRAINT "chk_positive_distance" CHECK (("total_distance_km" > (0)::numeric)),
    CONSTRAINT "chk_positive_extra_drop_price" CHECK ((("extra_drop_price" IS NULL) OR ("extra_drop_price" >= (0)::numeric))),
    CONSTRAINT "chk_positive_helper_price" CHECK ((("helper_price" IS NULL) OR ("helper_price" >= (0)::numeric))),
    CONSTRAINT "chk_price_unit" CHECK ((("price_unit")::"text" = ANY ((ARRAY['trip'::character varying, 'kg'::character varying, 'pallet'::character varying, 'other'::character varying])::"text"[]))),
    CONSTRAINT "master_freight_rate_pricing_mode_check" CHECK ((("pricing_mode")::"text" = ANY ((ARRAY['flat'::character varying, 'formula'::character varying])::"text"[])))
);


ALTER TABLE "public"."master_freight_rate" OWNER TO "postgres";


COMMENT ON TABLE "public"."master_freight_rate" IS 'Master table for freight transportation rates and pricing';



COMMENT ON COLUMN "public"."master_freight_rate"."freight_rate_id" IS 'Primary key - Freight rate ID';



COMMENT ON COLUMN "public"."master_freight_rate"."carrier_id" IS 'Foreign key to master_carrier';



COMMENT ON COLUMN "public"."master_freight_rate"."route_name" IS 'Transportation route name (e.g., Bangkok-Chiang Mai-Chiang Rai)';



COMMENT ON COLUMN "public"."master_freight_rate"."origin_province" IS 'Origin province';



COMMENT ON COLUMN "public"."master_freight_rate"."origin_district" IS 'Origin district (optional)';



COMMENT ON COLUMN "public"."master_freight_rate"."destination_province" IS 'Main destination province';



COMMENT ON COLUMN "public"."master_freight_rate"."destination_district" IS 'Main destination district (optional)';



COMMENT ON COLUMN "public"."master_freight_rate"."total_distance_km" IS 'Total route distance in kilometers';



COMMENT ON COLUMN "public"."master_freight_rate"."base_price" IS 'Base transportation price';



COMMENT ON COLUMN "public"."master_freight_rate"."extra_drop_price" IS 'Additional price per extra delivery point';



COMMENT ON COLUMN "public"."master_freight_rate"."helper_price" IS 'Helper/assistant fee';



COMMENT ON COLUMN "public"."master_freight_rate"."price_unit" IS 'Pricing unit (trip, kg, pallet, other)';



COMMENT ON COLUMN "public"."master_freight_rate"."effective_start_date" IS 'Rate effective start date';



COMMENT ON COLUMN "public"."master_freight_rate"."effective_end_date" IS 'Rate effective end date (NULL for ongoing)';



COMMENT ON COLUMN "public"."master_freight_rate"."notes" IS 'Additional notes or special conditions';



COMMENT ON COLUMN "public"."master_freight_rate"."created_by" IS 'User who created the record';



COMMENT ON COLUMN "public"."master_freight_rate"."created_at" IS 'Record creation timestamp';



COMMENT ON COLUMN "public"."master_freight_rate"."updated_at" IS 'Record last update timestamp';



COMMENT ON COLUMN "public"."master_freight_rate"."pricing_mode" IS 'โหมดการคิดราคา: flat (เหมา) หรือ formula (คำนวณ)';



CREATE OR REPLACE VIEW "public"."active_freight_rates" AS
 SELECT "freight_rate_id",
    "carrier_id",
    "route_name",
    "origin_province",
    "origin_district",
    "destination_province",
    "destination_district",
    "total_distance_km",
    "pricing_mode",
    "base_price",
    "extra_drop_price",
    "helper_price",
    "price_unit",
    "effective_start_date",
    "effective_end_date",
    "notes",
    "created_by",
    "created_at",
    "updated_at"
   FROM "public"."master_freight_rate"
  WHERE ((("effective_end_date" IS NULL) OR ("effective_end_date" >= CURRENT_DATE)) AND ("effective_start_date" <= CURRENT_DATE));


ALTER VIEW "public"."active_freight_rates" OWNER TO "postgres";


COMMENT ON VIEW "public"."active_freight_rates" IS 'View of currently active freight rates (excluding variable cost columns)';



CREATE TABLE IF NOT EXISTS "public"."bom_sku" (
    "id" integer NOT NULL,
    "bom_id" character varying(50) NOT NULL,
    "finished_sku_id" character varying(50) NOT NULL,
    "material_sku_id" character varying(50) NOT NULL,
    "material_qty" numeric(10,3) DEFAULT 0 NOT NULL,
    "material_uom" character varying(20) NOT NULL,
    "step_order" integer DEFAULT 1 NOT NULL,
    "step_name" character varying(100),
    "step_description" "text",
    "waste_qty" numeric(10,3) DEFAULT 0,
    "created_by" character varying(100) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "status" character varying(20) DEFAULT 'active'::character varying,
    CONSTRAINT "bom_sku_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::"text"[])))
);


ALTER TABLE "public"."bom_sku" OWNER TO "postgres";


COMMENT ON TABLE "public"."bom_sku" IS 'Bill of Materials (BOM) table storing material requirements and production steps';



COMMENT ON COLUMN "public"."bom_sku"."bom_id" IS 'BOM identifier code';



COMMENT ON COLUMN "public"."bom_sku"."finished_sku_id" IS 'Finished product SKU ID (Foreign Key to master_sku)';



COMMENT ON COLUMN "public"."bom_sku"."material_sku_id" IS 'Material/component SKU ID (Foreign Key to master_sku)';



COMMENT ON COLUMN "public"."bom_sku"."material_qty" IS 'Quantity of material required per 1 unit of finished product';



COMMENT ON COLUMN "public"."bom_sku"."material_uom" IS 'Unit of measure for the material';



COMMENT ON COLUMN "public"."bom_sku"."step_order" IS 'Production step sequence order';



COMMENT ON COLUMN "public"."bom_sku"."step_name" IS 'Production step name (e.g., Pack, Label)';



COMMENT ON COLUMN "public"."bom_sku"."step_description" IS 'Detailed description of the production step';



COMMENT ON COLUMN "public"."bom_sku"."waste_qty" IS 'Expected waste/loss quantity according to formula';



COMMENT ON COLUMN "public"."bom_sku"."created_by" IS 'User who created the BOM record';



COMMENT ON COLUMN "public"."bom_sku"."created_at" IS 'Timestamp when record was created';



COMMENT ON COLUMN "public"."bom_sku"."updated_at" IS 'Timestamp when record was last updated';



COMMENT ON COLUMN "public"."bom_sku"."status" IS 'BOM status (active/inactive)';



CREATE SEQUENCE IF NOT EXISTS "public"."bom_sku_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."bom_sku_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."bom_sku_id_seq" OWNED BY "public"."bom_sku"."id";



CREATE TABLE IF NOT EXISTS "public"."bonus_face_sheet_items" (
    "id" bigint NOT NULL,
    "face_sheet_id" bigint NOT NULL,
    "package_id" bigint NOT NULL,
    "order_item_id" bigint,
    "product_code" character varying(100),
    "product_name" "text",
    "quantity" numeric(15,3) NOT NULL,
    "unit" character varying(20) DEFAULT 'ชิ้น'::character varying,
    "weight" numeric(15,3),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."bonus_face_sheet_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."bonus_face_sheet_items" IS 'ตารางรายการสินค้าของแถมในแต่ละแพ็ค';



COMMENT ON COLUMN "public"."bonus_face_sheet_items"."order_item_id" IS 'FK อ้างอิงไปที่ wms_order_items';



COMMENT ON COLUMN "public"."bonus_face_sheet_items"."product_code" IS 'รหัสสินค้า';



COMMENT ON COLUMN "public"."bonus_face_sheet_items"."product_name" IS 'ชื่อสินค้า';



COMMENT ON COLUMN "public"."bonus_face_sheet_items"."quantity" IS 'จำนวน';



COMMENT ON COLUMN "public"."bonus_face_sheet_items"."unit" IS 'หน่วย';



CREATE SEQUENCE IF NOT EXISTS "public"."bonus_face_sheet_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."bonus_face_sheet_items_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."bonus_face_sheet_items_id_seq" OWNED BY "public"."bonus_face_sheet_items"."id";



CREATE TABLE IF NOT EXISTS "public"."bonus_face_sheet_packages" (
    "id" bigint NOT NULL,
    "face_sheet_id" bigint NOT NULL,
    "package_number" integer NOT NULL,
    "barcode_id" character varying(100) NOT NULL,
    "order_id" bigint,
    "order_no" character varying(100),
    "customer_id" character varying(50),
    "shop_name" character varying(255),
    "address" "text",
    "province" character varying(100),
    "contact_info" character varying(200),
    "phone" character varying(50),
    "hub" character varying(100),
    "delivery_type" character varying(50),
    "remark" "text",
    "sales_territory" character varying(100),
    "trip_number" character varying(50),
    "package_weight" numeric(15,3) DEFAULT 0,
    "total_items" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."bonus_face_sheet_packages" OWNER TO "postgres";


COMMENT ON TABLE "public"."bonus_face_sheet_packages" IS 'ตารางแพ็คสินค้าของแถมแต่ละแพ็คในใบปะหน้า';



COMMENT ON COLUMN "public"."bonus_face_sheet_packages"."package_number" IS 'หมายเลขแพ็ค (เช่น 1, 2, 3)';



COMMENT ON COLUMN "public"."bonus_face_sheet_packages"."barcode_id" IS 'รหัสบาร์โค้ดของแพ็ค';



COMMENT ON COLUMN "public"."bonus_face_sheet_packages"."order_id" IS 'FK อ้างอิงไปที่ wms_orders';



COMMENT ON COLUMN "public"."bonus_face_sheet_packages"."order_no" IS 'เลขที่ใบสั่งส่ง';



COMMENT ON COLUMN "public"."bonus_face_sheet_packages"."delivery_type" IS 'ประเภทจัดส่ง (เช่น จัดส่งพร้อมออเดอร์, จัดส่งลงออฟฟิศ)';



COMMENT ON COLUMN "public"."bonus_face_sheet_packages"."remark" IS 'หมายเหตุ (ภายใน)';



COMMENT ON COLUMN "public"."bonus_face_sheet_packages"."sales_territory" IS 'เขตการขาย (สำหรับแสดง watermark บนใบปะหน้า)';



COMMENT ON COLUMN "public"."bonus_face_sheet_packages"."trip_number" IS 'คันที่';



CREATE SEQUENCE IF NOT EXISTS "public"."bonus_face_sheet_packages_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."bonus_face_sheet_packages_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."bonus_face_sheet_packages_id_seq" OWNED BY "public"."bonus_face_sheet_packages"."id";



CREATE OR REPLACE VIEW "public"."bonus_face_sheet_summary" AS
SELECT
    NULL::bigint AS "id",
    NULL::character varying(50) AS "face_sheet_no",
    NULL::character varying(20) AS "warehouse_id",
    NULL::character varying(20) AS "status",
    NULL::"date" AS "created_date",
    NULL::character varying(100) AS "created_by",
    NULL::integer AS "total_packages",
    NULL::integer AS "total_items",
    NULL::integer AS "total_orders",
    NULL::"text" AS "notes",
    NULL::timestamp with time zone AS "created_at",
    NULL::timestamp with time zone AS "updated_at",
    NULL::bigint AS "package_count",
    NULL::bigint AS "item_count";


ALTER VIEW "public"."bonus_face_sheet_summary" OWNER TO "postgres";


COMMENT ON VIEW "public"."bonus_face_sheet_summary" IS 'View สรุปข้อมูลใบปะหน้าของแถม';



CREATE TABLE IF NOT EXISTS "public"."bonus_face_sheets" (
    "id" bigint NOT NULL,
    "face_sheet_no" character varying(50) NOT NULL,
    "warehouse_id" character varying(20) DEFAULT 'WH01'::character varying NOT NULL,
    "status" character varying(20) DEFAULT 'draft'::character varying,
    "delivery_date" "date",
    "created_date" "date" DEFAULT CURRENT_DATE,
    "created_by" character varying(100),
    "total_packages" integer DEFAULT 0,
    "total_items" integer DEFAULT 0,
    "total_orders" integer DEFAULT 0,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "bonus_face_sheets_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['draft'::character varying, 'generated'::character varying, 'picking'::character varying, 'completed'::character varying, 'cancelled'::character varying])::"text"[])))
);


ALTER TABLE "public"."bonus_face_sheets" OWNER TO "postgres";


COMMENT ON TABLE "public"."bonus_face_sheets" IS 'ตารางหลักสำหรับใบปะหน้าของแถม (Bonus Face Sheets) - ใช้กับ wms_orders ที่ order_type = special';



COMMENT ON COLUMN "public"."bonus_face_sheets"."face_sheet_no" IS 'เลขที่ใบปะหน้าของแถม (เช่น BFS-20250116-001)';



COMMENT ON COLUMN "public"."bonus_face_sheets"."warehouse_id" IS 'รหัสคลังสินค้า';



COMMENT ON COLUMN "public"."bonus_face_sheets"."status" IS 'สถานะ: draft, generated, printed, completed';



COMMENT ON COLUMN "public"."bonus_face_sheets"."delivery_date" IS 'วันที่ส่งของ';



COMMENT ON COLUMN "public"."bonus_face_sheets"."total_packages" IS 'จำนวนแพ็คทั้งหมด';



COMMENT ON COLUMN "public"."bonus_face_sheets"."total_items" IS 'จำนวนรายการสินค้าทั้งหมด';



COMMENT ON COLUMN "public"."bonus_face_sheets"."total_orders" IS 'จำนวนออเดอร์ทั้งหมด';



CREATE SEQUENCE IF NOT EXISTS "public"."bonus_face_sheets_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."bonus_face_sheets_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."bonus_face_sheets_id_seq" OWNED BY "public"."bonus_face_sheets"."id";



CREATE TABLE IF NOT EXISTS "public"."dashboard_calendar_attendees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "employee_id" bigint NOT NULL,
    "is_notified" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."dashboard_calendar_attendees" OWNER TO "postgres";


COMMENT ON TABLE "public"."dashboard_calendar_attendees" IS 'ตารางเก็บพนักงานที่เกี่ยวข้องกับกิจกรรมในปฏิทิน Dashboard';



CREATE TABLE IF NOT EXISTS "public"."dashboard_calendar_events" (
    "event_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" character varying(255) NOT NULL,
    "description" "text",
    "event_date" "date" NOT NULL,
    "event_time" time without time zone,
    "event_type" character varying(50) DEFAULT 'general'::character varying NOT NULL,
    "priority" character varying(20) DEFAULT 'normal'::character varying,
    "created_by" character varying(100) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."dashboard_calendar_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."dashboard_calendar_events" IS 'ตารางเก็บข้อมูลกิจกรรมในปฏิทินหน้า Dashboard';



COMMENT ON COLUMN "public"."dashboard_calendar_events"."event_type" IS 'ประเภทกิจกรรม: general, meeting, deadline, important, holiday';



COMMENT ON COLUMN "public"."dashboard_calendar_events"."priority" IS 'ความสำคัญ: low, normal, high, urgent';



CREATE TABLE IF NOT EXISTS "public"."export_jobs" (
    "id" bigint NOT NULL,
    "data_entity" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "filters" "jsonb",
    "file_path" "text",
    "download_url" "text",
    "error_log" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."export_jobs" OWNER TO "postgres";


COMMENT ON TABLE "public"."export_jobs" IS 'ตารางสำหรับติดตามสถานะการส่งออกข้อมูล';



COMMENT ON COLUMN "public"."export_jobs"."id" IS 'รหัสงานส่งออก';



COMMENT ON COLUMN "public"."export_jobs"."data_entity" IS 'ประเภทข้อมูลที่ส่งออก (เช่น master_sku)';



COMMENT ON COLUMN "public"."export_jobs"."status" IS 'สถานะงาน (pending, processing, completed, failed)';



COMMENT ON COLUMN "public"."export_jobs"."filters" IS 'เงื่อนไขที่ใช้ในการกรองข้อมูล (JSONB)';



COMMENT ON COLUMN "public"."export_jobs"."file_path" IS 'เส้นทางไฟล์ที่ส่งออกใน Storage';



COMMENT ON COLUMN "public"."export_jobs"."download_url" IS 'URL สำหรับดาวน์โหลดไฟล์';



COMMENT ON COLUMN "public"."export_jobs"."error_log" IS 'ข้อความข้อผิดพลาด (ถ้ามี)';



COMMENT ON COLUMN "public"."export_jobs"."started_at" IS 'เวลาเริ่มประมวลผล';



COMMENT ON COLUMN "public"."export_jobs"."completed_at" IS 'เวลาสิ้นสุดการประมวลผล';



COMMENT ON COLUMN "public"."export_jobs"."created_by" IS 'ผู้สร้างงาน (FK -> auth.users.id)';



COMMENT ON COLUMN "public"."export_jobs"."created_at" IS 'วันที่สร้างงาน';



CREATE SEQUENCE IF NOT EXISTS "public"."export_jobs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."export_jobs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."export_jobs_id_seq" OWNED BY "public"."export_jobs"."id";



CREATE TABLE IF NOT EXISTS "public"."face_sheet_item_reservations" (
    "reservation_id" bigint NOT NULL,
    "face_sheet_item_id" bigint NOT NULL,
    "balance_id" bigint NOT NULL,
    "reserved_piece_qty" numeric(18,2) DEFAULT 0 NOT NULL,
    "reserved_pack_qty" numeric(18,2) DEFAULT 0 NOT NULL,
    "reserved_by" character varying,
    "reserved_at" timestamp with time zone DEFAULT "now"(),
    "status" character varying(20) DEFAULT 'reserved'::character varying NOT NULL,
    "picked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "chk_reserved_pack_qty" CHECK (("reserved_pack_qty" >= (0)::numeric)),
    CONSTRAINT "chk_reserved_piece_qty" CHECK (("reserved_piece_qty" >= (0)::numeric)),
    CONSTRAINT "chk_status" CHECK ((("status")::"text" = ANY ((ARRAY['reserved'::character varying, 'picked'::character varying, 'cancelled'::character varying])::"text"[])))
);


ALTER TABLE "public"."face_sheet_item_reservations" OWNER TO "postgres";


COMMENT ON TABLE "public"."face_sheet_item_reservations" IS 'ตารางเก็บข้อมูลการจองสต็อคสำหรับ face sheet items';



COMMENT ON COLUMN "public"."face_sheet_item_reservations"."face_sheet_item_id" IS 'FK ไปยัง face_sheet_items';



COMMENT ON COLUMN "public"."face_sheet_item_reservations"."balance_id" IS 'FK ไปยัง wms_inventory_balances ที่จองไว้';



COMMENT ON COLUMN "public"."face_sheet_item_reservations"."reserved_piece_qty" IS 'จำนวนชิ้นที่จอง';



COMMENT ON COLUMN "public"."face_sheet_item_reservations"."reserved_pack_qty" IS 'จำนวนแพ็คที่จอง';



COMMENT ON COLUMN "public"."face_sheet_item_reservations"."reserved_by" IS 'User ID or system identifier who reserved the stock. Changed from UUID to VARCHAR for flexibility.';



COMMENT ON COLUMN "public"."face_sheet_item_reservations"."status" IS 'สถานะการจอง: reserved, picked, cancelled';



CREATE SEQUENCE IF NOT EXISTS "public"."face_sheet_item_reservations_reservation_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."face_sheet_item_reservations_reservation_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."face_sheet_item_reservations_reservation_id_seq" OWNED BY "public"."face_sheet_item_reservations"."reservation_id";



CREATE TABLE IF NOT EXISTS "public"."face_sheet_items" (
    "id" bigint NOT NULL,
    "face_sheet_id" bigint NOT NULL,
    "package_id" bigint NOT NULL,
    "order_id" bigint,
    "order_item_id" bigint,
    "product_code" character varying(100),
    "product_name" "text",
    "size" character varying(20),
    "quantity" numeric(15,3) NOT NULL,
    "weight" numeric(15,3),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "sku_id" character varying(50),
    "source_location_id" character varying(50),
    "quantity_to_pick" numeric(18,2),
    "quantity_picked" numeric(18,2) DEFAULT 0,
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "picked_at" timestamp with time zone,
    "uom" character varying(20),
    CONSTRAINT "chk_face_sheet_item_status" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'reserved'::character varying, 'picked'::character varying, 'shortage'::character varying, 'substituted'::character varying])::"text"[])))
);


ALTER TABLE "public"."face_sheet_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."face_sheet_items" IS 'ตารางรายการสินค้าในแต่ละแพ็ค';



COMMENT ON COLUMN "public"."face_sheet_items"."sku_id" IS 'SKU ID for stock reservation - populated from product_code';



COMMENT ON COLUMN "public"."face_sheet_items"."source_location_id" IS 'พื้นที่หยิบสินค้า (preparation area code)';



COMMENT ON COLUMN "public"."face_sheet_items"."quantity_to_pick" IS 'จำนวนที่ต้องหยิบ';



COMMENT ON COLUMN "public"."face_sheet_items"."quantity_picked" IS 'จำนวนที่หยิบแล้ว';



COMMENT ON COLUMN "public"."face_sheet_items"."status" IS 'สถานะ: pending, picked, shortage, substituted';



COMMENT ON COLUMN "public"."face_sheet_items"."picked_at" IS 'วันเวลาที่หยิบ';



COMMENT ON COLUMN "public"."face_sheet_items"."uom" IS 'หน่วยนับ';



COMMENT ON CONSTRAINT "chk_face_sheet_item_status" ON "public"."face_sheet_items" IS 'Valid statuses: pending (initial), reserved (stock allocated), picked (completed), shortage (insufficient stock), substituted (replaced with alternative)';



CREATE SEQUENCE IF NOT EXISTS "public"."face_sheet_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."face_sheet_items_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."face_sheet_items_id_seq" OWNED BY "public"."face_sheet_items"."id";



CREATE TABLE IF NOT EXISTS "public"."face_sheet_packages" (
    "id" bigint NOT NULL,
    "face_sheet_id" bigint NOT NULL,
    "package_number" integer NOT NULL,
    "barcode_id" character varying(100) NOT NULL,
    "order_no" character varying(100),
    "order_id" bigint,
    "customer_id" character varying(50),
    "shop_name" character varying(255),
    "product_code" character varying(100),
    "product_name" "text",
    "size" character varying(20),
    "size_category" character varying(20),
    "package_type" character varying(100),
    "pieces_per_pack" integer DEFAULT 1,
    "package_weight" numeric(15,3) DEFAULT 0,
    "address" "text",
    "province" character varying(100),
    "contact_name" character varying(200),
    "phone" character varying(50),
    "hub" character varying(100),
    "shipping_condition" "text",
    "notes" "text",
    "product_items" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "face_sheet_packages_size_category_check" CHECK ((("size_category")::"text" = ANY ((ARRAY['small'::character varying, 'large'::character varying])::"text"[])))
);


ALTER TABLE "public"."face_sheet_packages" OWNER TO "postgres";


COMMENT ON TABLE "public"."face_sheet_packages" IS 'ตารางแพ็คสินค้าแต่ละแพ็คในใบปะหน้า';



CREATE SEQUENCE IF NOT EXISTS "public"."face_sheet_packages_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."face_sheet_packages_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."face_sheet_packages_id_seq" OWNED BY "public"."face_sheet_packages"."id";



CREATE OR REPLACE VIEW "public"."face_sheet_summary" AS
SELECT
    NULL::bigint AS "id",
    NULL::character varying(50) AS "face_sheet_no",
    NULL::character varying(20) AS "status",
    NULL::"date" AS "created_date",
    NULL::character varying(100) AS "created_by",
    NULL::integer AS "total_packages",
    NULL::integer AS "total_items",
    NULL::integer AS "total_orders",
    NULL::integer AS "small_size_count",
    NULL::integer AS "large_size_count",
    NULL::character varying(20) AS "warehouse_id",
    NULL::"text" AS "notes",
    NULL::timestamp with time zone AS "created_at",
    NULL::timestamp with time zone AS "updated_at",
    NULL::bigint AS "package_count";


ALTER VIEW "public"."face_sheet_summary" OWNER TO "postgres";


COMMENT ON VIEW "public"."face_sheet_summary" IS 'View สรุปข้อมูลใบปะหน้าสินค้า';



CREATE TABLE IF NOT EXISTS "public"."face_sheets" (
    "id" bigint NOT NULL,
    "face_sheet_no" character varying(50) NOT NULL,
    "warehouse_id" character varying(20) DEFAULT 'WH01'::character varying NOT NULL,
    "status" character varying(20) DEFAULT 'draft'::character varying,
    "created_date" "date" DEFAULT CURRENT_DATE,
    "created_by" character varying(100),
    "total_packages" integer DEFAULT 0,
    "total_items" integer DEFAULT 0,
    "total_orders" integer DEFAULT 0,
    "small_size_count" integer DEFAULT 0,
    "large_size_count" integer DEFAULT 0,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "checker_employee_ids" bigint[],
    "picker_employee_ids" bigint[],
    "picking_started_at" timestamp with time zone,
    "picking_completed_at" timestamp with time zone,
    CONSTRAINT "face_sheets_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['draft'::character varying, 'generated'::character varying, 'picking'::character varying, 'completed'::character varying, 'cancelled'::character varying])::"text"[])))
);


ALTER TABLE "public"."face_sheets" OWNER TO "postgres";


COMMENT ON TABLE "public"."face_sheets" IS 'ตารางหลักสำหรับใบปะหน้าสินค้า (Face Sheets)';



COMMENT ON COLUMN "public"."face_sheets"."checker_employee_ids" IS 'รายการ employee_id ของพนักงานเช็ค (array)';



COMMENT ON COLUMN "public"."face_sheets"."picker_employee_ids" IS 'รายการ employee_id ของพนักงานจัดสินค้า (array)';



COMMENT ON COLUMN "public"."face_sheets"."picking_started_at" IS 'วันเวลาที่เริ่มหยิบ';



COMMENT ON COLUMN "public"."face_sheets"."picking_completed_at" IS 'วันเวลาที่หยิบเสร็จ';



CREATE SEQUENCE IF NOT EXISTS "public"."face_sheets_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."face_sheets_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."face_sheets_id_seq" OWNED BY "public"."face_sheets"."id";



CREATE TABLE IF NOT EXISTS "public"."file_uploads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "file_name" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "file_type" "text",
    "file_size" bigint,
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "metadata" "jsonb"
);


ALTER TABLE "public"."file_uploads" OWNER TO "postgres";


COMMENT ON TABLE "public"."file_uploads" IS 'ตารางสำหรับจัดเก็บข้อมูลไฟล์ที่อัปโหลดเข้าระบบ';



COMMENT ON COLUMN "public"."file_uploads"."id" IS 'รหัสไฟล์ (UUID)';



COMMENT ON COLUMN "public"."file_uploads"."file_name" IS 'ชื่อไฟล์เดิม';



COMMENT ON COLUMN "public"."file_uploads"."storage_path" IS 'เส้นทางจัดเก็บไฟล์ใน Supabase Storage';



COMMENT ON COLUMN "public"."file_uploads"."file_type" IS 'ประเภทของไฟล์ (MIME type)';



COMMENT ON COLUMN "public"."file_uploads"."file_size" IS 'ขนาดไฟล์ (bytes)';



COMMENT ON COLUMN "public"."file_uploads"."uploaded_by" IS 'ผู้ใช้อัปโหลด (FK -> auth.users.id)';



COMMENT ON COLUMN "public"."file_uploads"."created_at" IS 'วันที่อัปโหลด';



COMMENT ON COLUMN "public"."file_uploads"."metadata" IS 'ข้อมูลเพิ่มเติมเกี่ยวกับไฟล์ (JSONB)';



CREATE TABLE IF NOT EXISTS "public"."import_jobs" (
    "id" bigint NOT NULL,
    "file_id" "uuid" NOT NULL,
    "data_entity" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "total_rows" integer,
    "processed_rows" integer DEFAULT 0,
    "successful_rows" integer DEFAULT 0,
    "failed_rows" integer DEFAULT 0,
    "error_log_path" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."import_jobs" OWNER TO "postgres";


COMMENT ON TABLE "public"."import_jobs" IS 'ตารางสำหรับติดตามสถานะการนำเข้าข้อมูล';



COMMENT ON COLUMN "public"."import_jobs"."id" IS 'รหัสงานนำเข้า';



COMMENT ON COLUMN "public"."import_jobs"."file_id" IS 'รหัสไฟล์ที่นำเข้า (FK -> file_uploads.id)';



COMMENT ON COLUMN "public"."import_jobs"."data_entity" IS 'ประเภทข้อมูลที่นำเข้า (เช่น master_sku)';



COMMENT ON COLUMN "public"."import_jobs"."status" IS 'สถานะงาน (pending, processing, completed, failed)';



COMMENT ON COLUMN "public"."import_jobs"."total_rows" IS 'จำนวนแถวทั้งหมดในไฟล์';



COMMENT ON COLUMN "public"."import_jobs"."processed_rows" IS 'จำนวนแถวที่ประมวลผลแล้ว';



COMMENT ON COLUMN "public"."import_jobs"."successful_rows" IS 'จำนวนแถวที่สำเร็จ';



COMMENT ON COLUMN "public"."import_jobs"."failed_rows" IS 'จำนวนแถวที่ล้มเหลว';



COMMENT ON COLUMN "public"."import_jobs"."error_log_path" IS 'เส้นทางไฟล์ log ข้อผิดพลาด';



COMMENT ON COLUMN "public"."import_jobs"."started_at" IS 'เวลาเริ่มประมวลผล';



COMMENT ON COLUMN "public"."import_jobs"."completed_at" IS 'เวลาสิ้นสุดการประมวลผล';



COMMENT ON COLUMN "public"."import_jobs"."created_by" IS 'ผู้สร้างงาน (FK -> auth.users.id)';



COMMENT ON COLUMN "public"."import_jobs"."created_at" IS 'วันที่สร้างงาน';



CREATE SEQUENCE IF NOT EXISTS "public"."import_jobs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."import_jobs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."import_jobs_id_seq" OWNED BY "public"."import_jobs"."id";



CREATE TABLE IF NOT EXISTS "public"."loadlist_face_sheets" (
    "loadlist_id" bigint NOT NULL,
    "face_sheet_id" bigint NOT NULL,
    "added_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."loadlist_face_sheets" OWNER TO "postgres";


COMMENT ON TABLE "public"."loadlist_face_sheets" IS 'Junction table linking loadlists with face sheets';



COMMENT ON COLUMN "public"."loadlist_face_sheets"."loadlist_id" IS 'Reference to loadlist';



COMMENT ON COLUMN "public"."loadlist_face_sheets"."face_sheet_id" IS 'Reference to face sheet';



CREATE TABLE IF NOT EXISTS "public"."loadlist_picklists" (
    "loadlist_id" bigint NOT NULL,
    "picklist_id" bigint NOT NULL,
    "added_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."loadlist_picklists" OWNER TO "postgres";


COMMENT ON TABLE "public"."loadlist_picklists" IS 'Junction table linking loadlists with picklists';



COMMENT ON COLUMN "public"."loadlist_picklists"."loadlist_id" IS 'Reference to loadlist';



COMMENT ON COLUMN "public"."loadlist_picklists"."picklist_id" IS 'Reference to picklist';



CREATE TABLE IF NOT EXISTS "public"."loadlists" (
    "id" bigint NOT NULL,
    "loadlist_code" character varying(50) NOT NULL,
    "plan_id" bigint,
    "trip_id" bigint,
    "vehicle_id" character varying(50),
    "driver_employee_id" bigint,
    "status" "public"."loadlist_status_enum" DEFAULT 'pending'::"public"."loadlist_status_enum" NOT NULL,
    "total_orders" integer DEFAULT 0,
    "total_weight_kg" numeric(12,3) DEFAULT 0,
    "total_volume_cbm" numeric(12,3) DEFAULT 0,
    "departure_time" timestamp with time zone,
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "loading_door_number" character varying(50),
    "loading_queue_number" character varying(50),
    "checker_employee_id" bigint,
    "vehicle_type" character varying(100),
    "delivery_number" character varying(100),
    "driver_phone" character varying(20),
    "helper_employee_id" bigint,
    CONSTRAINT "loadlists_total_orders_check" CHECK (("total_orders" >= 0)),
    CONSTRAINT "loadlists_total_volume_check" CHECK (("total_volume_cbm" >= (0)::numeric)),
    CONSTRAINT "loadlists_total_weight_check" CHECK (("total_weight_kg" >= (0)::numeric))
);


ALTER TABLE "public"."loadlists" OWNER TO "postgres";


COMMENT ON TABLE "public"."loadlists" IS 'ใบขึ้นรถสำหรับการจัดส่ง';



COMMENT ON COLUMN "public"."loadlists"."loading_door_number" IS 'ประตูโหลดสินค้า (Loading Door)';



COMMENT ON COLUMN "public"."loadlists"."loading_queue_number" IS 'คิวลำดับการโหลด';



COMMENT ON COLUMN "public"."loadlists"."checker_employee_id" IS 'พนักงานผู้เช็คการโหลดสินค้า (FK to master_employee)';



COMMENT ON COLUMN "public"."loadlists"."vehicle_type" IS 'ประเภทรถที่ใช้ขนส่ง';



COMMENT ON COLUMN "public"."loadlists"."delivery_number" IS 'เลขงานจัดส่ง (Delivery Order Number)';



COMMENT ON COLUMN "public"."loadlists"."driver_phone" IS 'เบอร์โทรศัพท์คนขับรถ';



COMMENT ON COLUMN "public"."loadlists"."helper_employee_id" IS 'เด็กติดรถ/ผู้ช่วยคนขับ (FK to master_employee)';



CREATE TABLE IF NOT EXISTS "public"."picklists" (
    "id" bigint NOT NULL,
    "picklist_code" character varying(50) NOT NULL,
    "trip_id" bigint,
    "plan_id" bigint,
    "assigned_to_employee_id" bigint,
    "status" "public"."picklist_status_enum" DEFAULT 'pending'::"public"."picklist_status_enum" NOT NULL,
    "total_lines" integer DEFAULT 0,
    "total_quantity" numeric(15,3) DEFAULT 0,
    "picking_started_at" timestamp with time zone,
    "picking_completed_at" timestamp with time zone,
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "created_from" character varying(20) DEFAULT 'trip'::character varying,
    "loading_door_number" character varying,
    "checker_employee_ids" bigint[],
    "picker_employee_ids" bigint[],
    CONSTRAINT "picklists_total_lines_check" CHECK (("total_lines" >= 0)),
    CONSTRAINT "picklists_total_quantity_check" CHECK (("total_quantity" >= (0)::numeric))
);


ALTER TABLE "public"."picklists" OWNER TO "postgres";


COMMENT ON TABLE "public"."picklists" IS 'ตารางหลักสำหรับใบจัดสินค้า (Picklist Header) อ้างอิงตามเที่ยวรถ';



COMMENT ON COLUMN "public"."picklists"."picklist_code" IS 'รหัสใบจัดสินค้าที่ไม่ซ้ำกัน เช่น PL-20251010-001';



COMMENT ON COLUMN "public"."picklists"."trip_id" IS 'FK อ้างอิงถึงเที่ยวรถในตาราง receiving_route_trips';



COMMENT ON COLUMN "public"."picklists"."plan_id" IS 'FK อ้างอิงถึงแผนในตาราง receiving_route_plans เพื่อความสะดวกในการ query';



COMMENT ON COLUMN "public"."picklists"."assigned_to_employee_id" IS 'FK อ้างอิงถึงพนักงานที่ได้รับมอบหมายให้จัดสินค้า';



COMMENT ON COLUMN "public"."picklists"."status" IS 'สถานะปัจจุบันของใบจัดสินค้า';



COMMENT ON COLUMN "public"."picklists"."total_lines" IS 'จำนวนรายการ (SKU) ทั้งหมดในใบจัดนี้';



COMMENT ON COLUMN "public"."picklists"."total_quantity" IS 'จำนวนชิ้นทั้งหมดที่ต้องจัดเก็บ';



COMMENT ON COLUMN "public"."picklists"."created_from" IS 'แหล่งที่มาของการสร้าง picklist (normal_trip, special_trip, direct_order)';



COMMENT ON COLUMN "public"."picklists"."loading_door_number" IS 'ประตูโหลดสินค้าที่กำหนดให้ picklist นี้ (เช่น D01, D02)';



COMMENT ON COLUMN "public"."picklists"."checker_employee_ids" IS 'รายการ employee_id ของพนักงานเช็ค (array)';



COMMENT ON COLUMN "public"."picklists"."picker_employee_ids" IS 'รายการ employee_id ของพนักงานจัดสินค้า (array)';



CREATE OR REPLACE VIEW "public"."loadlist_details_with_face_sheets" AS
 SELECT "id" AS "loadlist_id",
    "loadlist_code",
    "status",
    "vehicle_id",
    "driver_employee_id",
    "created_by",
    "created_at",
    "updated_at",
    ( SELECT "count"(*) AS "count"
           FROM "public"."loadlist_picklists" "lp"
          WHERE ("lp"."loadlist_id" = "l"."id")) AS "picklist_count",
    ( SELECT "count"(*) AS "count"
           FROM "public"."loadlist_face_sheets" "lfs"
          WHERE ("lfs"."loadlist_id" = "l"."id")) AS "face_sheet_count",
    ( SELECT COALESCE("sum"("p"."total_lines"), (0)::bigint) AS "coalesce"
           FROM ("public"."loadlist_picklists" "lp"
             JOIN "public"."picklists" "p" ON (("lp"."picklist_id" = "p"."id")))
          WHERE ("lp"."loadlist_id" = "l"."id")) AS "picklist_total_lines",
    ( SELECT COALESCE("sum"("fs"."total_packages"), (0)::bigint) AS "coalesce"
           FROM ("public"."loadlist_face_sheets" "lfs"
             JOIN "public"."face_sheets" "fs" ON (("lfs"."face_sheet_id" = "fs"."id")))
          WHERE ("lfs"."loadlist_id" = "l"."id")) AS "face_sheet_total_packages"
   FROM "public"."loadlists" "l";


ALTER VIEW "public"."loadlist_details_with_face_sheets" OWNER TO "postgres";


COMMENT ON VIEW "public"."loadlist_details_with_face_sheets" IS 'Loadlist summary including both picklists and face sheets';



CREATE TABLE IF NOT EXISTS "public"."loadlist_items" (
    "id" bigint NOT NULL,
    "loadlist_id" bigint NOT NULL,
    "order_id" bigint NOT NULL,
    "sequence_no" integer,
    "weight_kg" numeric(12,3),
    "volume_cbm" numeric(12,3),
    "scanned_at" timestamp with time zone,
    "scanned_by_employee_id" bigint,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."loadlist_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."loadlist_items" IS 'รายการ Orders ที่ขึ้นรถ';



CREATE SEQUENCE IF NOT EXISTS "public"."loadlist_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."loadlist_items_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."loadlist_items_id_seq" OWNED BY "public"."loadlist_items"."id";



CREATE SEQUENCE IF NOT EXISTS "public"."loadlists_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."loadlists_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."loadlists_id_seq" OWNED BY "public"."loadlists"."id";



CREATE TABLE IF NOT EXISTS "public"."location_group" (
    "group_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "warehouse_id" character varying(50) NOT NULL,
    "group_code" character varying(50) NOT NULL,
    "group_name" character varying(255) NOT NULL,
    "group_type" character varying(50),
    "description" "text",
    "priority" smallint DEFAULT 50,
    "created_by" character varying(100),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "location_group_priority_check" CHECK ((("priority" >= 1) AND ("priority" <= 999)))
);


ALTER TABLE "public"."location_group" OWNER TO "postgres";


COMMENT ON TABLE "public"."location_group" IS 'กลุ่มรวมตำแหน่งจัดเก็บเพื่อผูก strategy เป็นชุด';



COMMENT ON COLUMN "public"."location_group"."group_type" IS 'ใช้บอกประเภทกลุ่ม เช่น pick-face, bulk, chill';



CREATE TABLE IF NOT EXISTS "public"."location_group_members" (
    "group_id" "uuid" NOT NULL,
    "location_id" character varying(50) NOT NULL,
    "assigned_at" timestamp with time zone DEFAULT "now"(),
    "assigned_by" character varying(100)
);


ALTER TABLE "public"."location_group_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."location_sku_allocation" (
    "allocation_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "location_id" character varying(50) NOT NULL,
    "sku_id" character varying(50) NOT NULL,
    "strategy_id" "uuid",
    "priority" smallint DEFAULT 50,
    "is_primary" boolean DEFAULT false,
    "allow_mixed_expiry" boolean DEFAULT false,
    "allow_mixed_lot" boolean DEFAULT false,
    "allow_mixed_sku" boolean DEFAULT false,
    "enforce_single_pallet" boolean DEFAULT false,
    "max_pack_qty" numeric(18,2),
    "max_piece_qty" numeric(18,2),
    "effective_from" "date" DEFAULT CURRENT_DATE,
    "effective_to" "date",
    "remarks" "text",
    "created_by" character varying(100),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "chk_location_sku_allocation_dates" CHECK ((("effective_to" IS NULL) OR ("effective_to" >= "effective_from"))),
    CONSTRAINT "location_sku_allocation_priority_check" CHECK ((("priority" >= 1) AND ("priority" <= 999)))
);


ALTER TABLE "public"."location_sku_allocation" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."location_storage_profile" (
    "location_id" character varying(50) NOT NULL,
    "storage_class" character varying(50),
    "hazard_class" character varying(50),
    "temperature_min_c" numeric(5,2),
    "temperature_max_c" numeric(5,2),
    "humidity_min_percent" numeric(5,2),
    "humidity_max_percent" numeric(5,2),
    "max_pallets" integer,
    "max_skus" integer,
    "max_batches" integer,
    "allow_mixed_sku" boolean DEFAULT true,
    "allow_mixed_lot" boolean DEFAULT true,
    "allow_mixed_expiry" boolean DEFAULT true,
    "allow_partial_case" boolean DEFAULT true,
    "allow_split_pallet" boolean DEFAULT true,
    "notes" "text",
    "updated_by" character varying(100),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "chk_location_storage_profile_humidity" CHECK ((("humidity_min_percent" IS NULL) OR ("humidity_max_percent" IS NULL) OR ("humidity_min_percent" <= "humidity_max_percent"))),
    CONSTRAINT "chk_location_storage_profile_temp" CHECK ((("temperature_min_c" IS NULL) OR ("temperature_max_c" IS NULL) OR ("temperature_min_c" <= "temperature_max_c")))
);


ALTER TABLE "public"."location_storage_profile" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."master_customer" (
    "customer_id" character varying(50) NOT NULL,
    "customer_code" character varying(50) NOT NULL,
    "customer_name" character varying(255) NOT NULL,
    "customer_type" character varying(20) DEFAULT 'retail'::character varying,
    "business_reg_no" character varying(100),
    "tax_id" character varying(50),
    "contact_person" character varying(100),
    "phone" character varying(50),
    "email" character varying(100),
    "line_id" character varying(100),
    "website" character varying(255),
    "billing_address" character varying(500),
    "shipping_address" character varying(500),
    "province" character varying(100),
    "district" character varying(100),
    "subdistrict" character varying(100),
    "postal_code" character varying(20),
    "latitude" numeric(10,7),
    "longitude" numeric(10,7),
    "delivery_instructions" "text",
    "preferred_delivery_time" character varying(100),
    "channel_source" character varying(100),
    "customer_segment" character varying(100),
    "status" character varying(20) DEFAULT 'active'::character varying,
    "created_by" character varying(100) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "remarks" "text",
    "hub" character varying(100),
    CONSTRAINT "master_customer_customer_type_check" CHECK ((("customer_type")::"text" = ANY ((ARRAY['retail'::character varying, 'wholesale'::character varying, 'distributor'::character varying, 'other'::character varying])::"text"[]))),
    CONSTRAINT "master_customer_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::"text"[])))
);


ALTER TABLE "public"."master_customer" OWNER TO "postgres";


COMMENT ON TABLE "public"."master_customer" IS 'Master customer table storing customer information for order management';



COMMENT ON COLUMN "public"."master_customer"."customer_id" IS 'Customer identifier code (Primary Key)';



COMMENT ON COLUMN "public"."master_customer"."customer_code" IS 'Internal customer code used in documents/systems';



COMMENT ON COLUMN "public"."master_customer"."customer_name" IS 'Customer name or shop name';



COMMENT ON COLUMN "public"."master_customer"."customer_type" IS 'Customer type (retail/wholesale/distributor/other)';



COMMENT ON COLUMN "public"."master_customer"."business_reg_no" IS 'Business registration number/juristic person number';



COMMENT ON COLUMN "public"."master_customer"."tax_id" IS 'Tax identification number';



COMMENT ON COLUMN "public"."master_customer"."contact_person" IS 'Primary contact person name';



COMMENT ON COLUMN "public"."master_customer"."phone" IS 'Contact phone number';



COMMENT ON COLUMN "public"."master_customer"."email" IS 'Contact email address';



COMMENT ON COLUMN "public"."master_customer"."line_id" IS 'Line ID for communication';



COMMENT ON COLUMN "public"."master_customer"."website" IS 'Website URL (if available)';



COMMENT ON COLUMN "public"."master_customer"."billing_address" IS 'Billing address for invoices/documents';



COMMENT ON COLUMN "public"."master_customer"."shipping_address" IS 'Shipping address for goods delivery';



COMMENT ON COLUMN "public"."master_customer"."province" IS 'Province name';



COMMENT ON COLUMN "public"."master_customer"."district" IS 'District name';



COMMENT ON COLUMN "public"."master_customer"."subdistrict" IS 'Subdistrict name';



COMMENT ON COLUMN "public"."master_customer"."postal_code" IS 'Postal code';



COMMENT ON COLUMN "public"."master_customer"."latitude" IS 'Latitude coordinate for delivery point';



COMMENT ON COLUMN "public"."master_customer"."longitude" IS 'Longitude coordinate for delivery point';



COMMENT ON COLUMN "public"."master_customer"."delivery_instructions" IS 'Special delivery instructions';



COMMENT ON COLUMN "public"."master_customer"."preferred_delivery_time" IS 'Preferred delivery time (e.g., 09:00-12:00)';



COMMENT ON COLUMN "public"."master_customer"."channel_source" IS 'Channel source (e.g., Online, Dealer, Social)';



COMMENT ON COLUMN "public"."master_customer"."customer_segment" IS 'Customer segment (e.g., Restaurant, Pet Shop, Modern Trade)';



COMMENT ON COLUMN "public"."master_customer"."status" IS 'Customer status (active/inactive)';



COMMENT ON COLUMN "public"."master_customer"."created_by" IS 'User who created the customer record';



COMMENT ON COLUMN "public"."master_customer"."created_at" IS 'Timestamp when record was created';



COMMENT ON COLUMN "public"."master_customer"."updated_at" IS 'Timestamp when record was last updated';



COMMENT ON COLUMN "public"."master_customer"."remarks" IS 'Additional remarks or notes';



COMMENT ON COLUMN "public"."master_customer"."hub" IS 'รหัสหรือชื่อ HUB ที่ลูกค้าสังกัด';



CREATE TABLE IF NOT EXISTS "public"."master_customer_no_price_goods" (
    "record_id" bigint NOT NULL,
    "customer_id" character varying(50) NOT NULL,
    "customer_name" character varying(255) NOT NULL,
    "reason" "text",
    "note_for_picking" "text",
    "effective_start_date" "date",
    "effective_end_date" "date",
    "is_active" boolean DEFAULT true,
    "created_by" character varying(100) NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."master_customer_no_price_goods" OWNER TO "postgres";


COMMENT ON TABLE "public"."master_customer_no_price_goods" IS 'Master table for customers who require products without price labels';



COMMENT ON COLUMN "public"."master_customer_no_price_goods"."record_id" IS 'รหัสแถวข้อมูล (Primary Key)';



COMMENT ON COLUMN "public"."master_customer_no_price_goods"."customer_id" IS 'รหัสลูกค้า (FK → master_customer.customer_id)';



COMMENT ON COLUMN "public"."master_customer_no_price_goods"."customer_name" IS 'ชื่อลูกค้า/ร้านค้า';



COMMENT ON COLUMN "public"."master_customer_no_price_goods"."reason" IS 'เหตุผล/หมายเหตุที่ร้านไม่ต้องการสินค้ามีราคา';



COMMENT ON COLUMN "public"."master_customer_no_price_goods"."note_for_picking" IS 'ข้อความที่จะพิมพ์บนใบจัดสินค้า เพื่อแจ้งพนักงาน';



COMMENT ON COLUMN "public"."master_customer_no_price_goods"."effective_start_date" IS 'วันที่เริ่มมีผลบังคับ';



COMMENT ON COLUMN "public"."master_customer_no_price_goods"."effective_end_date" IS 'วันที่สิ้นสุด (ถ้ามี)';



COMMENT ON COLUMN "public"."master_customer_no_price_goods"."is_active" IS 'ใช้งานอยู่หรือไม่';



COMMENT ON COLUMN "public"."master_customer_no_price_goods"."created_by" IS 'ผู้สร้างข้อมูล';



COMMENT ON COLUMN "public"."master_customer_no_price_goods"."created_at" IS 'วันที่สร้าง';



COMMENT ON COLUMN "public"."master_customer_no_price_goods"."updated_at" IS 'วันที่แก้ไขล่าสุด';



CREATE SEQUENCE IF NOT EXISTS "public"."master_customer_no_price_goods_record_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."master_customer_no_price_goods_record_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."master_customer_no_price_goods_record_id_seq" OWNED BY "public"."master_customer_no_price_goods"."record_id";



CREATE TABLE IF NOT EXISTS "public"."master_employee" (
    "employee_id" bigint NOT NULL,
    "employee_code" character varying(50) NOT NULL,
    "prefix" "public"."prefix_enum",
    "first_name" character varying(100) NOT NULL,
    "last_name" character varying(100) NOT NULL,
    "nickname" character varying(50),
    "gender" "public"."gender_enum",
    "date_of_birth" "date",
    "national_id" character varying(20),
    "phone_number" character varying(50),
    "email" character varying(150),
    "address" character varying(500),
    "emergency_contact_name" character varying(100),
    "emergency_contact_phone" character varying(50),
    "hire_date" "date",
    "employment_type" "public"."employment_type_enum",
    "position" character varying(100),
    "department" character varying(100),
    "profile_photo_url" character varying(500),
    "wms_role" "public"."wms_role_enum",
    "allowed_warehouses" json,
    "rf_device_id" character varying(100),
    "barcode_id" character varying(100),
    "shift_type" "public"."shift_type_enum",
    "training_certifications" "text",
    "created_by" character varying(100),
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "remarks" "text"
);


ALTER TABLE "public"."master_employee" OWNER TO "postgres";


COMMENT ON COLUMN "public"."master_employee"."employee_id" IS 'รหัสพนักงาน (Primary Key)';



COMMENT ON COLUMN "public"."master_employee"."employee_code" IS 'รหัสประจำตัว/รหัสพนักงาน';



COMMENT ON COLUMN "public"."master_employee"."prefix" IS 'คำนำหน้าชื่อ';



COMMENT ON COLUMN "public"."master_employee"."first_name" IS 'ชื่อ';



COMMENT ON COLUMN "public"."master_employee"."last_name" IS 'นามสกุล';



COMMENT ON COLUMN "public"."master_employee"."nickname" IS 'ชื่อเล่น';



COMMENT ON COLUMN "public"."master_employee"."gender" IS 'เพศ';



COMMENT ON COLUMN "public"."master_employee"."date_of_birth" IS 'วันเกิด';



COMMENT ON COLUMN "public"."master_employee"."national_id" IS 'เลขบัตรประชาชน/พาสปอร์ต';



COMMENT ON COLUMN "public"."master_employee"."phone_number" IS 'เบอร์โทร';



COMMENT ON COLUMN "public"."master_employee"."email" IS 'อีเมล';



COMMENT ON COLUMN "public"."master_employee"."address" IS 'ที่อยู่ปัจจุบัน';



COMMENT ON COLUMN "public"."master_employee"."emergency_contact_name" IS 'ชื่อผู้ติดต่อกรณีฉุกเฉิน';



COMMENT ON COLUMN "public"."master_employee"."emergency_contact_phone" IS 'เบอร์ผู้ติดต่อฉุกเฉิน';



COMMENT ON COLUMN "public"."master_employee"."hire_date" IS 'วันที่เริ่มงาน';



COMMENT ON COLUMN "public"."master_employee"."employment_type" IS 'ประเภทการจ้าง';



COMMENT ON COLUMN "public"."master_employee"."position" IS 'ตำแหน่งงาน';



COMMENT ON COLUMN "public"."master_employee"."department" IS 'แผนก';



COMMENT ON COLUMN "public"."master_employee"."profile_photo_url" IS 'ลิงก์รูปภาพพนักงาน';



COMMENT ON COLUMN "public"."master_employee"."wms_role" IS 'บทบาทการทำงานในคลัง';



COMMENT ON COLUMN "public"."master_employee"."allowed_warehouses" IS 'รายชื่อคลังที่พนักงานปฏิบัติงานได้ (array ของ warehouse_id)';



COMMENT ON COLUMN "public"."master_employee"."rf_device_id" IS 'รหัส/Serial ของอุปกรณ์ RF/handheld ที่มอบให้';



COMMENT ON COLUMN "public"."master_employee"."barcode_id" IS 'รหัสบาร์โค้ด/บัตรพนักงาน';



COMMENT ON COLUMN "public"."master_employee"."shift_type" IS 'ประเภทกะการทำงาน';



COMMENT ON COLUMN "public"."master_employee"."training_certifications" IS 'ใบรับรองการฝึกอบรม (เช่น forklift license)';



COMMENT ON COLUMN "public"."master_employee"."created_by" IS 'ผู้สร้างข้อมูล';



COMMENT ON COLUMN "public"."master_employee"."created_at" IS 'วันที่สร้าง';



COMMENT ON COLUMN "public"."master_employee"."updated_at" IS 'วันที่แก้ไขล่าสุด';



COMMENT ON COLUMN "public"."master_employee"."remarks" IS 'หมายเหตุเพิ่มเติม';



ALTER TABLE "public"."master_employee" ALTER COLUMN "employee_id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."master_employee_employee_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE "public"."master_freight_rate" ALTER COLUMN "freight_rate_id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."master_freight_rate_freight_rate_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."master_iv_document_type" (
    "doc_type_id" bigint NOT NULL,
    "doc_type_code" character varying(50) NOT NULL,
    "doc_type_name" character varying(200) NOT NULL,
    "description" "text",
    "required_case" json,
    "special_customer_ids" json,
    "special_customer_names" json,
    "return_required" boolean DEFAULT true,
    "ocr_template_id" character varying(100),
    "storage_location" character varying(200),
    "retention_period_months" integer,
    "is_active" boolean DEFAULT true,
    "created_by" character varying(100) NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "remarks" "text"
);


ALTER TABLE "public"."master_iv_document_type" OWNER TO "postgres";


COMMENT ON TABLE "public"."master_iv_document_type" IS 'Master table for invoice document types and their configurations';



COMMENT ON COLUMN "public"."master_iv_document_type"."doc_type_id" IS 'รหัสประเภทเอกสาร (Primary Key)';



COMMENT ON COLUMN "public"."master_iv_document_type"."doc_type_code" IS 'รหัสย่อประเภทเอกสาร เช่น IV-ORIGINAL, COPY-ACCOUNT';



COMMENT ON COLUMN "public"."master_iv_document_type"."doc_type_name" IS 'ชื่อประเภทเอกสาร เช่น "ต้นฉบับอินวอยซ์", "สำเนาบัญชี", "ใบวางบิล"';



COMMENT ON COLUMN "public"."master_iv_document_type"."description" IS 'คำอธิบายเพิ่มเติม';



COMMENT ON COLUMN "public"."master_iv_document_type"."required_case" IS 'เงื่อนไขทั่วไป เช่น { "payment_type": ["cash","credit"], "customer_type": ["special","normal"] }';



COMMENT ON COLUMN "public"."master_iv_document_type"."special_customer_ids" IS 'รหัสลูกค้าพิเศษ หลายราย เช่น ["CUST0001","CUST0999"]';



COMMENT ON COLUMN "public"."master_iv_document_type"."special_customer_names" IS 'ชื่อเต็มลูกค้าพิเศษ ตรงกับ special_customer_ids เช่น ["บริษัท เอ บี ซี จำกัด","ร้านวีไอพี เพ็ท"]';



COMMENT ON COLUMN "public"."master_iv_document_type"."return_required" IS 'ต้องดึงเอกสารกลับคืนหรือไม่';



COMMENT ON COLUMN "public"."master_iv_document_type"."ocr_template_id" IS 'รหัสเทมเพลต OCR สำหรับเอกสารนี้';



COMMENT ON COLUMN "public"."master_iv_document_type"."storage_location" IS 'ตำแหน่งจัดเก็บเอกสาร (เช่น ตู้เอกสาร/Drive Path)';



COMMENT ON COLUMN "public"."master_iv_document_type"."retention_period_months" IS 'ระยะเวลาเก็บรักษา (เดือน)';



COMMENT ON COLUMN "public"."master_iv_document_type"."is_active" IS 'สถานะการใช้งาน';



COMMENT ON COLUMN "public"."master_iv_document_type"."created_by" IS 'ผู้สร้างข้อมูล';



COMMENT ON COLUMN "public"."master_iv_document_type"."created_at" IS 'วันที่สร้าง';



COMMENT ON COLUMN "public"."master_iv_document_type"."updated_at" IS 'วันที่แก้ไขล่าสุด';



COMMENT ON COLUMN "public"."master_iv_document_type"."remarks" IS 'หมายเหตุเพิ่มเติม';



CREATE SEQUENCE IF NOT EXISTS "public"."master_iv_document_type_doc_type_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."master_iv_document_type_doc_type_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."master_iv_document_type_doc_type_id_seq" OWNED BY "public"."master_iv_document_type"."doc_type_id";



CREATE TABLE IF NOT EXISTS "public"."master_location" (
    "location_id" character varying(50) NOT NULL,
    "warehouse_id" character varying(50) NOT NULL,
    "warehouse_name" character varying(255),
    "location_code" character varying(50) NOT NULL,
    "location_name" character varying(255),
    "location_type" character varying(20) DEFAULT 'rack'::character varying,
    "max_capacity_qty" integer DEFAULT 0,
    "max_capacity_weight_kg" numeric(10,3) DEFAULT 0,
    "current_qty" integer DEFAULT 0,
    "current_weight_kg" numeric(10,3) DEFAULT 0,
    "putaway_strategy" character varying(50),
    "zone" character varying(50),
    "aisle" character varying(50),
    "rack" character varying(50),
    "shelf" character varying(50),
    "bin" character varying(50),
    "temperature_controlled" boolean DEFAULT false,
    "humidity_controlled" boolean DEFAULT false,
    "active_status" character varying(20) DEFAULT 'active'::character varying,
    "created_by" character varying(100) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "remarks" "text",
    "default_strategy_id" "uuid",
    "is_quarantine" boolean DEFAULT false,
    "is_pick_face" boolean DEFAULT false,
    "is_bulk_storage" boolean DEFAULT false,
    CONSTRAINT "master_location_active_status_check" CHECK ((("active_status")::"text" = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::"text"[]))),
    CONSTRAINT "master_location_location_type_check" CHECK ((("location_type")::"text" = ANY (ARRAY[('rack'::character varying)::"text", ('floor'::character varying)::"text", ('bulk'::character varying)::"text", ('other'::character varying)::"text", ('receiving'::character varying)::"text", ('dispatch'::character varying)::"text", ('delivery'::character varying)::"text"])))
);


ALTER TABLE "public"."master_location" OWNER TO "postgres";


COMMENT ON TABLE "public"."master_location" IS 'ข้อมูลตำแหน่งจัดเก็บสินค้าในคลัง รวมพื้นที่รับสินค้า (receiving)';



COMMENT ON COLUMN "public"."master_location"."location_id" IS 'Location identifier code (Primary Key)';



COMMENT ON COLUMN "public"."master_location"."warehouse_id" IS 'Warehouse ID (Foreign Key to master_warehouse)';



COMMENT ON COLUMN "public"."master_location"."warehouse_name" IS 'Warehouse name (denormalized for performance)';



COMMENT ON COLUMN "public"."master_location"."location_code" IS 'Location code (e.g., A01-R01-S01)';



COMMENT ON COLUMN "public"."master_location"."location_name" IS 'Location name or description';



COMMENT ON COLUMN "public"."master_location"."location_type" IS 'Location type: rack, floor, bulk, receiving, dispatch, delivery, other';



COMMENT ON COLUMN "public"."master_location"."max_capacity_qty" IS 'Maximum capacity by quantity/units';



COMMENT ON COLUMN "public"."master_location"."max_capacity_weight_kg" IS 'Maximum capacity by weight (kg)';



COMMENT ON COLUMN "public"."master_location"."current_qty" IS 'Current quantity stored';



COMMENT ON COLUMN "public"."master_location"."current_weight_kg" IS 'Current weight stored (kg)';



COMMENT ON COLUMN "public"."master_location"."putaway_strategy" IS 'Storage strategy (FIFO, LIFO, ABC, Zone)';



COMMENT ON COLUMN "public"."master_location"."zone" IS 'Zone within warehouse (e.g., Zone A, Zone B)';



COMMENT ON COLUMN "public"."master_location"."aisle" IS 'Aisle identifier for rack storage';



COMMENT ON COLUMN "public"."master_location"."rack" IS 'Rack identifier';



COMMENT ON COLUMN "public"."master_location"."shelf" IS 'Shelf identifier';



COMMENT ON COLUMN "public"."master_location"."bin" IS 'Bin identifier';



COMMENT ON COLUMN "public"."master_location"."temperature_controlled" IS 'Temperature controlled location';



COMMENT ON COLUMN "public"."master_location"."humidity_controlled" IS 'Humidity controlled location';



COMMENT ON COLUMN "public"."master_location"."active_status" IS 'Location status (active/inactive)';



COMMENT ON COLUMN "public"."master_location"."created_by" IS 'User who created the location record';



COMMENT ON COLUMN "public"."master_location"."created_at" IS 'Timestamp when record was created';



COMMENT ON COLUMN "public"."master_location"."updated_at" IS 'Timestamp when record was last updated';



COMMENT ON COLUMN "public"."master_location"."remarks" IS 'Additional remarks';



CREATE TABLE IF NOT EXISTS "public"."master_permission_module" (
    "module_id" bigint NOT NULL,
    "module_name" character varying(150) NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."master_permission_module" OWNER TO "postgres";


COMMENT ON TABLE "public"."master_permission_module" IS 'ตารางโมดูล/ฟีเจอร์ที่ต้องกำหนดสิทธิ์';



COMMENT ON COLUMN "public"."master_permission_module"."module_id" IS 'รหัสโมดูล';



COMMENT ON COLUMN "public"."master_permission_module"."module_name" IS 'ชื่อโมดูล เช่น Master SKU, Receive, Dispatch, Reports';



COMMENT ON COLUMN "public"."master_permission_module"."description" IS 'รายละเอียด';



COMMENT ON COLUMN "public"."master_permission_module"."created_at" IS 'วันที่สร้าง';



CREATE SEQUENCE IF NOT EXISTS "public"."master_permission_module_module_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."master_permission_module_module_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."master_permission_module_module_id_seq" OWNED BY "public"."master_permission_module"."module_id";



CREATE TABLE IF NOT EXISTS "public"."master_sku" (
    "sku_id" character varying(50) NOT NULL,
    "sku_name" character varying(255) NOT NULL,
    "sku_description" "text",
    "category" character varying(100),
    "sub_category" character varying(100),
    "brand" character varying(100),
    "product_type" character varying(100),
    "uom_base" character varying(50) NOT NULL,
    "qty_per_pack" integer DEFAULT 1,
    "qty_per_pallet" integer,
    "weight_per_piece_kg" numeric(10,3),
    "weight_per_pack_kg" numeric(10,3),
    "weight_per_pallet_kg" numeric(10,3),
    "dimension_length_cm" numeric(10,2),
    "dimension_width_cm" numeric(10,2),
    "dimension_height_cm" numeric(10,2),
    "barcode" character varying(100),
    "pack_barcode" character varying(100),
    "pallet_barcode" character varying(100),
    "storage_condition" character varying(100),
    "shelf_life_days" integer,
    "lot_tracking_required" boolean DEFAULT false,
    "expiry_date_required" boolean DEFAULT false,
    "reorder_point" integer DEFAULT 0,
    "safety_stock" integer DEFAULT 0,
    "default_location" character varying(100),
    "created_by" character varying(100) NOT NULL,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "status" "public"."sku_status" DEFAULT 'active'::"public"."sku_status",
    "storage_class" character varying(50),
    "hazard_class" character varying(50),
    "abc_class" character(1),
    "putaway_rotation_method" "public"."storage_rotation_method_enum",
    "temperature_min_c" numeric(5,2),
    "temperature_max_c" numeric(5,2),
    "humidity_min_percent" numeric(5,2),
    "humidity_max_percent" numeric(5,2),
    "allow_mixed_expiry" boolean DEFAULT false,
    "allow_mixed_lot" boolean DEFAULT false,
    "prefer_full_pallet" boolean DEFAULT false,
    "default_storage_strategy_id" "uuid",
    "storage_notes" "text",
    CONSTRAINT "chk_master_sku_dimensions" CHECK (((("dimension_length_cm" IS NULL) OR ("dimension_length_cm" > (0)::numeric)) AND (("dimension_width_cm" IS NULL) OR ("dimension_width_cm" > (0)::numeric)) AND (("dimension_height_cm" IS NULL) OR ("dimension_height_cm" > (0)::numeric)))),
    CONSTRAINT "chk_master_sku_humidity_range" CHECK ((("humidity_min_percent" IS NULL) OR ("humidity_max_percent" IS NULL) OR ("humidity_min_percent" <= "humidity_max_percent"))),
    CONSTRAINT "chk_master_sku_qty_per_pack" CHECK (("qty_per_pack" > 0)),
    CONSTRAINT "chk_master_sku_qty_per_pallet" CHECK ((("qty_per_pallet" IS NULL) OR ("qty_per_pallet" > 0))),
    CONSTRAINT "chk_master_sku_reorder_point" CHECK (("reorder_point" >= 0)),
    CONSTRAINT "chk_master_sku_safety_stock" CHECK (("safety_stock" >= 0)),
    CONSTRAINT "chk_master_sku_shelf_life" CHECK ((("shelf_life_days" IS NULL) OR ("shelf_life_days" > 0))),
    CONSTRAINT "chk_master_sku_temp_range" CHECK ((("temperature_min_c" IS NULL) OR ("temperature_max_c" IS NULL) OR ("temperature_min_c" <= "temperature_max_c"))),
    CONSTRAINT "chk_master_sku_weights" CHECK (((("weight_per_piece_kg" IS NULL) OR ("weight_per_piece_kg" >= (0)::numeric)) AND (("weight_per_pack_kg" IS NULL) OR ("weight_per_pack_kg" >= (0)::numeric)) AND (("weight_per_pallet_kg" IS NULL) OR ("weight_per_pallet_kg" >= (0)::numeric)))),
    CONSTRAINT "master_sku_abc_class_check" CHECK (("abc_class" = ANY (ARRAY['A'::"bpchar", 'B'::"bpchar", 'C'::"bpchar"])))
);


ALTER TABLE "public"."master_sku" OWNER TO "postgres";


COMMENT ON TABLE "public"."master_sku" IS 'ตารางข้อมูล SKU หลักสำหรับระบบ WMS - เก็บข้อมูลรายละเอียดสินค้าทั้งหมด';



COMMENT ON COLUMN "public"."master_sku"."sku_id" IS 'รหัส SKU ไม่ซ้ำ';



COMMENT ON COLUMN "public"."master_sku"."sku_name" IS 'ชื่อสินค้า';



COMMENT ON COLUMN "public"."master_sku"."sku_description" IS 'รายละเอียดสินค้า';



COMMENT ON COLUMN "public"."master_sku"."category" IS 'หมวดหมู่สินค้า';



COMMENT ON COLUMN "public"."master_sku"."sub_category" IS 'หมวดหมู่ย่อย';



COMMENT ON COLUMN "public"."master_sku"."brand" IS 'แบรนด์สินค้า';



COMMENT ON COLUMN "public"."master_sku"."product_type" IS 'ประเภทสินค้า เช่น อาหารแมว, อาหารสุนัข';



COMMENT ON COLUMN "public"."master_sku"."uom_base" IS 'หน่วยพื้นฐาน เช่น ชิ้น, กก.';



COMMENT ON COLUMN "public"."master_sku"."qty_per_pack" IS 'จำนวนต่อ 1 แพ็ค';



COMMENT ON COLUMN "public"."master_sku"."qty_per_pallet" IS 'จำนวนต่อ 1 พาเลท';



COMMENT ON COLUMN "public"."master_sku"."weight_per_piece_kg" IS 'น้ำหนักต่อ 1 ชิ้น (กก.)';



COMMENT ON COLUMN "public"."master_sku"."weight_per_pack_kg" IS 'น้ำหนักต่อ 1 แพ็ค (กก.)';



COMMENT ON COLUMN "public"."master_sku"."weight_per_pallet_kg" IS 'น้ำหนักต่อ 1 พาเลท (กก.)';



COMMENT ON COLUMN "public"."master_sku"."dimension_length_cm" IS 'ความยาวต่อชิ้น (ซม.)';



COMMENT ON COLUMN "public"."master_sku"."dimension_width_cm" IS 'ความกว้างต่อชิ้น (ซม.)';



COMMENT ON COLUMN "public"."master_sku"."dimension_height_cm" IS 'ความสูงต่อชิ้น (ซม.)';



COMMENT ON COLUMN "public"."master_sku"."barcode" IS 'บาร์โค้ดสินค้า';



COMMENT ON COLUMN "public"."master_sku"."pack_barcode" IS 'บาร์โค้ดของแพ็ค (ถ้ามี)';



COMMENT ON COLUMN "public"."master_sku"."pallet_barcode" IS 'บาร์โค้ดของพาเลท (ถ้ามี)';



COMMENT ON COLUMN "public"."master_sku"."storage_condition" IS 'เงื่อนไขการเก็บ เช่น อุณหภูมิห้อง, แช่เย็น';



COMMENT ON COLUMN "public"."master_sku"."shelf_life_days" IS 'อายุสินค้า (วัน)';



COMMENT ON COLUMN "public"."master_sku"."lot_tracking_required" IS 'ต้องติดตาม Lot หรือไม่';



COMMENT ON COLUMN "public"."master_sku"."expiry_date_required" IS 'ต้องบันทึกวันหมดอายุหรือไม่';



COMMENT ON COLUMN "public"."master_sku"."reorder_point" IS 'จุดสั่งซื้อขั้นต่ำ (ชิ้น)';



COMMENT ON COLUMN "public"."master_sku"."safety_stock" IS 'ปริมาณสต็อกเพื่อความปลอดภัย (ชิ้น)';



COMMENT ON COLUMN "public"."master_sku"."default_location" IS 'Location พื้นฐาน/แนะนำ';



COMMENT ON COLUMN "public"."master_sku"."created_by" IS 'ชื่อผู้สร้างข้อมูล SKU';



COMMENT ON COLUMN "public"."master_sku"."created_at" IS 'วันที่สร้างข้อมูล';



COMMENT ON COLUMN "public"."master_sku"."updated_at" IS 'วันที่แก้ไขข้อมูลล่าสุด';



COMMENT ON COLUMN "public"."master_sku"."status" IS 'สถานะการใช้งาน';



CREATE TABLE IF NOT EXISTS "public"."master_supplier" (
    "supplier_id" character varying(50) NOT NULL,
    "supplier_code" character varying(50) NOT NULL,
    "supplier_name" character varying(255) NOT NULL,
    "supplier_type" character varying(20) DEFAULT 'vendor'::character varying,
    "business_reg_no" character varying(100),
    "tax_id" character varying(50),
    "contact_person" character varying(100),
    "phone" character varying(50),
    "email" character varying(100),
    "website" character varying(255),
    "billing_address" character varying(500),
    "shipping_address" character varying(500),
    "payment_terms" character varying(100),
    "service_category" character varying(100),
    "product_category" character varying(100),
    "rating" numeric(3,2) DEFAULT 0,
    "status" character varying(20) DEFAULT 'active'::character varying,
    "created_by" character varying(100) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "remarks" "text",
    CONSTRAINT "master_supplier_rating_check" CHECK ((("rating" >= (0)::numeric) AND ("rating" <= (5)::numeric))),
    CONSTRAINT "master_supplier_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::"text"[]))),
    CONSTRAINT "master_supplier_supplier_type_check" CHECK ((("supplier_type")::"text" = ANY ((ARRAY['vendor'::character varying, 'service_provider'::character varying, 'both'::character varying])::"text"[])))
);


ALTER TABLE "public"."master_supplier" OWNER TO "postgres";


COMMENT ON TABLE "public"."master_supplier" IS 'Master supplier table storing supplier/vendor information';



COMMENT ON COLUMN "public"."master_supplier"."supplier_id" IS 'Supplier identifier code (Primary Key)';



COMMENT ON COLUMN "public"."master_supplier"."supplier_code" IS 'Internal supplier code used in documents/systems';



COMMENT ON COLUMN "public"."master_supplier"."supplier_name" IS 'Supplier or company name';



COMMENT ON COLUMN "public"."master_supplier"."supplier_type" IS 'Supplier role (vendor/service_provider/both)';



COMMENT ON COLUMN "public"."master_supplier"."business_reg_no" IS 'Business registration number/juristic person number';



COMMENT ON COLUMN "public"."master_supplier"."tax_id" IS 'Tax identification number';



COMMENT ON COLUMN "public"."master_supplier"."contact_person" IS 'Primary contact person name';



COMMENT ON COLUMN "public"."master_supplier"."phone" IS 'Phone number';



COMMENT ON COLUMN "public"."master_supplier"."email" IS 'Email address';



COMMENT ON COLUMN "public"."master_supplier"."website" IS 'Website URL (if available)';



COMMENT ON COLUMN "public"."master_supplier"."billing_address" IS 'Billing address for invoices/documents';



COMMENT ON COLUMN "public"."master_supplier"."shipping_address" IS 'Shipping address for goods/materials delivery';



COMMENT ON COLUMN "public"."master_supplier"."payment_terms" IS 'Payment terms (e.g., 30 days, cash)';



COMMENT ON COLUMN "public"."master_supplier"."service_category" IS 'Service category (e.g., transport, manufacturing, QC) - for service providers';



COMMENT ON COLUMN "public"."master_supplier"."product_category" IS 'Product category sold - for vendors';



COMMENT ON COLUMN "public"."master_supplier"."rating" IS 'Supplier rating (1-5 scale)';



COMMENT ON COLUMN "public"."master_supplier"."status" IS 'Supplier status (active/inactive)';



COMMENT ON COLUMN "public"."master_supplier"."created_by" IS 'User who created the supplier record';



COMMENT ON COLUMN "public"."master_supplier"."created_at" IS 'Timestamp when record was created';



COMMENT ON COLUMN "public"."master_supplier"."updated_at" IS 'Timestamp when record was last updated';



COMMENT ON COLUMN "public"."master_supplier"."remarks" IS 'Additional remarks such as special conditions';



CREATE TABLE IF NOT EXISTS "public"."master_system_role" (
    "role_id" bigint NOT NULL,
    "role_name" character varying(100) NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_by" bigint,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."master_system_role" OWNER TO "postgres";


COMMENT ON TABLE "public"."master_system_role" IS 'ตารางกลุ่มสิทธิ์ผู้ใช้งาน';



COMMENT ON COLUMN "public"."master_system_role"."role_id" IS 'รหัส Role';



COMMENT ON COLUMN "public"."master_system_role"."role_name" IS 'ชื่อ Role เช่น Admin, Picker';



COMMENT ON COLUMN "public"."master_system_role"."description" IS 'คำอธิบาย';



COMMENT ON COLUMN "public"."master_system_role"."is_active" IS 'ใช้งานหรือไม่';



COMMENT ON COLUMN "public"."master_system_role"."created_by" IS 'ใครสร้าง';



COMMENT ON COLUMN "public"."master_system_role"."created_at" IS 'วันที่สร้าง';



COMMENT ON COLUMN "public"."master_system_role"."updated_at" IS 'วันที่แก้ไขล่าสุด';



CREATE SEQUENCE IF NOT EXISTS "public"."master_system_role_role_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."master_system_role_role_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."master_system_role_role_id_seq" OWNED BY "public"."master_system_role"."role_id";



CREATE TABLE IF NOT EXISTS "public"."master_system_user" (
    "user_id" bigint NOT NULL,
    "username" character varying(100) NOT NULL,
    "email" character varying(150) NOT NULL,
    "full_name" character varying(200) NOT NULL,
    "phone_number" character varying(50),
    "employee_id" bigint,
    "password_hash" character varying(255) NOT NULL,
    "last_login_at" timestamp with time zone,
    "is_active" boolean DEFAULT true,
    "created_by" bigint,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "remarks" "text"
);


ALTER TABLE "public"."master_system_user" OWNER TO "postgres";


COMMENT ON TABLE "public"."master_system_user" IS 'ตารางข้อมูลผู้ใช้งานระบบ';



COMMENT ON COLUMN "public"."master_system_user"."user_id" IS 'รหัสผู้ใช้';



COMMENT ON COLUMN "public"."master_system_user"."username" IS 'ชื่อ login';



COMMENT ON COLUMN "public"."master_system_user"."email" IS 'อีเมล';



COMMENT ON COLUMN "public"."master_system_user"."full_name" IS 'ชื่อ-นามสกุล';



COMMENT ON COLUMN "public"."master_system_user"."phone_number" IS 'เบอร์โทร';



COMMENT ON COLUMN "public"."master_system_user"."employee_id" IS 'รหัสพนักงาน (FK → master_employee.employee_id)';



COMMENT ON COLUMN "public"."master_system_user"."password_hash" IS 'รหัสผ่านเข้ารหัส';



COMMENT ON COLUMN "public"."master_system_user"."last_login_at" IS 'เวลาเข้าใช้งานล่าสุด';



COMMENT ON COLUMN "public"."master_system_user"."is_active" IS 'สถานะใช้งาน';



COMMENT ON COLUMN "public"."master_system_user"."created_by" IS 'ใครสร้าง';



COMMENT ON COLUMN "public"."master_system_user"."created_at" IS 'วันที่สร้าง';



COMMENT ON COLUMN "public"."master_system_user"."updated_at" IS 'วันที่แก้ไขล่าสุด';



COMMENT ON COLUMN "public"."master_system_user"."remarks" IS 'หมายเหตุ';



CREATE SEQUENCE IF NOT EXISTS "public"."master_system_user_user_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."master_system_user_user_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."master_system_user_user_id_seq" OWNED BY "public"."master_system_user"."user_id";



CREATE TABLE IF NOT EXISTS "public"."master_vehicle" (
    "vehicle_id" bigint NOT NULL,
    "vehicle_code" character varying(50) NOT NULL,
    "vehicle_type" character varying(50),
    "plate_number" character varying(20) NOT NULL,
    "brand" character varying(100),
    "model" character varying(100),
    "year_of_manufacture" integer,
    "capacity_kg" numeric(10,2),
    "capacity_cbm" numeric(10,2),
    "fuel_type" character varying(50),
    "driver_id" bigint,
    "gps_device_id" character varying(100),
    "location_base_id" character varying(50),
    "registration_expiry_date" "date",
    "insurance_expiry_date" "date",
    "maintenance_schedule" "text",
    "current_status" character varying(50) DEFAULT 'Active'::character varying,
    "remarks" "text",
    "created_by" character varying(100),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "master_vehicle_current_status_check" CHECK ((("current_status")::"text" = ANY ((ARRAY['Active'::character varying, 'Under Maintenance'::character varying, 'Inactive'::character varying])::"text"[])))
);


ALTER TABLE "public"."master_vehicle" OWNER TO "postgres";


COMMENT ON TABLE "public"."master_vehicle" IS 'Master table for storing vehicle information';



COMMENT ON COLUMN "public"."master_vehicle"."vehicle_id" IS 'Unique identifier for each vehicle (Primary Key)';



COMMENT ON COLUMN "public"."master_vehicle"."vehicle_code" IS 'Internal code for the vehicle (e.g., TRUCK-01)';



COMMENT ON COLUMN "public"."master_vehicle"."vehicle_type" IS 'Type of vehicle (e.g., Truck, Van, Pickup)';



COMMENT ON COLUMN "public"."master_vehicle"."plate_number" IS 'Vehicle plate number';



COMMENT ON COLUMN "public"."master_vehicle"."driver_id" IS 'Foreign key referencing the main driver from master_employee table';



COMMENT ON COLUMN "public"."master_vehicle"."location_base_id" IS 'Foreign key referencing the base warehouse from master_warehouse table';



COMMENT ON COLUMN "public"."master_vehicle"."current_status" IS 'Current operational status of the vehicle';



CREATE SEQUENCE IF NOT EXISTS "public"."master_vehicle_vehicle_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."master_vehicle_vehicle_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."master_vehicle_vehicle_id_seq" OWNED BY "public"."master_vehicle"."vehicle_id";



CREATE TABLE IF NOT EXISTS "public"."master_warehouse" (
    "warehouse_id" character varying(50) NOT NULL,
    "warehouse_name" character varying(255) NOT NULL,
    "warehouse_type" character varying(20) DEFAULT 'central'::character varying,
    "address" character varying(500),
    "contact_person" character varying(100),
    "phone" character varying(50),
    "email" character varying(100),
    "capacity_qty" integer DEFAULT 0,
    "capacity_weight_kg" numeric(10,3) DEFAULT 0,
    "active_status" character varying(20) DEFAULT 'active'::character varying,
    "created_by" character varying(100) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "remarks" "text",
    CONSTRAINT "master_warehouse_active_status_check" CHECK ((("active_status")::"text" = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::"text"[]))),
    CONSTRAINT "master_warehouse_warehouse_type_check" CHECK ((("warehouse_type")::"text" = ANY ((ARRAY['central'::character varying, 'branch'::character varying, 'crossdock'::character varying, 'other'::character varying])::"text"[])))
);


ALTER TABLE "public"."master_warehouse" OWNER TO "postgres";


COMMENT ON TABLE "public"."master_warehouse" IS 'Master warehouse table storing warehouse information';



COMMENT ON COLUMN "public"."master_warehouse"."warehouse_id" IS 'Warehouse identifier code (Primary Key)';



COMMENT ON COLUMN "public"."master_warehouse"."warehouse_name" IS 'Warehouse name';



COMMENT ON COLUMN "public"."master_warehouse"."warehouse_type" IS 'Warehouse type (central/branch/crossdock/other)';



COMMENT ON COLUMN "public"."master_warehouse"."address" IS 'Warehouse address';



COMMENT ON COLUMN "public"."master_warehouse"."contact_person" IS 'Warehouse contact person';



COMMENT ON COLUMN "public"."master_warehouse"."phone" IS 'Warehouse phone number';



COMMENT ON COLUMN "public"."master_warehouse"."email" IS 'Warehouse email';



COMMENT ON COLUMN "public"."master_warehouse"."capacity_qty" IS 'Maximum capacity by quantity/units';



COMMENT ON COLUMN "public"."master_warehouse"."capacity_weight_kg" IS 'Maximum capacity by weight (kg)';



COMMENT ON COLUMN "public"."master_warehouse"."active_status" IS 'Warehouse status (active/inactive)';



COMMENT ON COLUMN "public"."master_warehouse"."created_by" IS 'User who created the warehouse record';



COMMENT ON COLUMN "public"."master_warehouse"."created_at" IS 'Timestamp when record was created';



COMMENT ON COLUMN "public"."master_warehouse"."updated_at" IS 'Timestamp when record was last updated';



COMMENT ON COLUMN "public"."master_warehouse"."remarks" IS 'Additional remarks';



CREATE TABLE IF NOT EXISTS "public"."master_warehouse_asset" (
    "asset_id" bigint NOT NULL,
    "asset_code" character varying(50) NOT NULL,
    "asset_name" character varying(200) NOT NULL,
    "asset_type" character varying(100) NOT NULL,
    "description" "text",
    "warehouse_id" character varying(50),
    "location_id" character varying(50),
    "brand" character varying(100),
    "model" character varying(100),
    "serial_number" character varying(100),
    "purchase_date" "date",
    "warranty_expiry_date" "date",
    "maintenance_schedule" "text",
    "last_maintenance_date" "date",
    "status" character varying(50) DEFAULT 'Active'::character varying NOT NULL,
    "capacity_spec" character varying(200),
    "assigned_person_id" bigint,
    "safety_certificate_expiry" "date",
    "remarks" "text",
    "created_by" character varying(100) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "chk_asset_status" CHECK ((("status")::"text" = ANY ((ARRAY['Active'::character varying, 'Under Maintenance'::character varying, 'Out of Service'::character varying, 'Retired'::character varying])::"text"[]))),
    CONSTRAINT "chk_asset_type" CHECK ((("asset_type")::"text" = ANY ((ARRAY['Rack'::character varying, 'Forklift'::character varying, 'Hand Pallet'::character varying, 'Barcode Scanner'::character varying, 'Weighing Scale'::character varying, 'Conveyor'::character varying, 'Other'::character varying])::"text"[])))
);


ALTER TABLE "public"."master_warehouse_asset" OWNER TO "postgres";


COMMENT ON TABLE "public"."master_warehouse_asset" IS 'Master table for warehouse assets and equipment';



COMMENT ON COLUMN "public"."master_warehouse_asset"."asset_id" IS 'Primary key - Asset ID';



COMMENT ON COLUMN "public"."master_warehouse_asset"."asset_code" IS 'Unique asset code (e.g., ASSET-0001)';



COMMENT ON COLUMN "public"."master_warehouse_asset"."asset_name" IS 'Asset name (e.g., Forklift Toyota 2.5T)';



COMMENT ON COLUMN "public"."master_warehouse_asset"."asset_type" IS 'Asset type (Rack, Forklift, Hand Pallet, etc.)';



COMMENT ON COLUMN "public"."master_warehouse_asset"."description" IS 'Additional asset description';



COMMENT ON COLUMN "public"."master_warehouse_asset"."warehouse_id" IS 'Foreign key to master_warehouse';



COMMENT ON COLUMN "public"."master_warehouse_asset"."location_id" IS 'Foreign key to master_location';



COMMENT ON COLUMN "public"."master_warehouse_asset"."brand" IS 'Asset brand/manufacturer';



COMMENT ON COLUMN "public"."master_warehouse_asset"."model" IS 'Asset model';



COMMENT ON COLUMN "public"."master_warehouse_asset"."serial_number" IS 'Manufacturer serial number';



COMMENT ON COLUMN "public"."master_warehouse_asset"."purchase_date" IS 'Purchase/acquisition date';



COMMENT ON COLUMN "public"."master_warehouse_asset"."warranty_expiry_date" IS 'Warranty expiry date';



COMMENT ON COLUMN "public"."master_warehouse_asset"."maintenance_schedule" IS 'Maintenance schedule details';



COMMENT ON COLUMN "public"."master_warehouse_asset"."last_maintenance_date" IS 'Last maintenance date';



COMMENT ON COLUMN "public"."master_warehouse_asset"."status" IS 'Current asset status';



COMMENT ON COLUMN "public"."master_warehouse_asset"."capacity_spec" IS 'Capacity/weight specifications';



COMMENT ON COLUMN "public"."master_warehouse_asset"."assigned_person_id" IS 'Foreign key to master_employee (responsible person)';



COMMENT ON COLUMN "public"."master_warehouse_asset"."safety_certificate_expiry" IS 'Safety certificate expiry date';



COMMENT ON COLUMN "public"."master_warehouse_asset"."remarks" IS 'Additional remarks';



COMMENT ON COLUMN "public"."master_warehouse_asset"."created_by" IS 'User who created the record';



COMMENT ON COLUMN "public"."master_warehouse_asset"."created_at" IS 'Record creation timestamp';



COMMENT ON COLUMN "public"."master_warehouse_asset"."updated_at" IS 'Record last update timestamp';



ALTER TABLE "public"."master_warehouse_asset" ALTER COLUMN "asset_id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."master_warehouse_asset_asset_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."material_issue_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "material_issue_id" "uuid" NOT NULL,
    "production_order_item_id" "uuid",
    "material_sku_id" character varying(50) NOT NULL,
    "pallet_id_external" character varying(100),
    "location_id" character varying(50),
    "location_code" character varying(50),
    "lot_no" character varying(50),
    "production_date" "date",
    "expiry_date" "date",
    "issued_qty" numeric(18,4) NOT NULL,
    "returned_qty" numeric(18,4) DEFAULT 0,
    "net_qty" numeric(18,4) GENERATED ALWAYS AS (("issued_qty" - "returned_qty")) STORED,
    "uom" character varying(20),
    "issue_method" character varying(10),
    "remarks" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "material_issue_items_issue_method_check" CHECK ((("issue_method")::"text" = ANY ((ARRAY['FEFO'::character varying, 'FIFO'::character varying, 'MANUAL'::character varying])::"text"[]))),
    CONSTRAINT "material_issue_items_issued_qty_check" CHECK (("issued_qty" > (0)::numeric)),
    CONSTRAINT "material_issue_items_returned_qty_check" CHECK (("returned_qty" >= (0)::numeric))
);


ALTER TABLE "public"."material_issue_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."material_issue_items" IS 'รายการวัตถุดิบที่เบิกแต่ละรายการ';



CREATE TABLE IF NOT EXISTS "public"."material_issues" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "production_order_id" "uuid" NOT NULL,
    "material_sku_id" character varying(50) NOT NULL,
    "issued_qty" numeric(18,2) NOT NULL,
    "issue_location_id" "uuid",
    "issued_by" bigint,
    "issued_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "status" "public"."material_issue_status" DEFAULT 'issued'::"public"."material_issue_status" NOT NULL,
    "remarks" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "issue_no" character varying(50),
    "issue_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "issue_time" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "issued_by_name" character varying(255),
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" bigint,
    "pallet_id_external" character varying(100),
    "location_id" character varying(50),
    "location_code" character varying(50),
    "lot_no" character varying(50),
    "production_date" "date",
    "expiry_date" "date",
    "returned_qty" numeric(18,4) DEFAULT 0,
    "uom" character varying(20),
    "issue_method" character varying(10),
    CONSTRAINT "material_issues_issue_method_check" CHECK ((("issue_method")::"text" = ANY ((ARRAY['FEFO'::character varying, 'FIFO'::character varying, 'MANUAL'::character varying])::"text"[]))),
    CONSTRAINT "material_issues_issued_qty_check" CHECK (("issued_qty" > (0)::numeric))
);


ALTER TABLE "public"."material_issues" OWNER TO "postgres";


COMMENT ON TABLE "public"."material_issues" IS 'บันทึกการจ่ายวัตถุดิบเข้าสู่การผลิต';



COMMENT ON COLUMN "public"."material_issues"."material_sku_id" IS 'รหัสวัตถุดิบที่จ่าย';



COMMENT ON COLUMN "public"."material_issues"."issued_qty" IS 'จำนวนที่จ่ายออก';



COMMENT ON COLUMN "public"."material_issues"."issue_location_id" IS 'ตำแหน่งคลังต้นทาง';



COMMENT ON COLUMN "public"."material_issues"."status" IS 'สถานะ: issued (จ่ายออก), returned (คืนกลับ)';



CREATE TABLE IF NOT EXISTS "public"."material_requirements" (
    "requirement_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "plan_item_id" "uuid",
    "material_sku_id" character varying(50) NOT NULL,
    "finished_sku_id" character varying(50) NOT NULL,
    "bom_id" character varying(50),
    "material_qty_per_unit" numeric(10,3) NOT NULL,
    "waste_qty_per_unit" numeric(10,3) DEFAULT 0,
    "production_qty" numeric(18,2) NOT NULL,
    "gross_requirement" numeric(18,2) NOT NULL,
    "current_stock" numeric(18,2) DEFAULT 0,
    "allocated_stock" numeric(18,2) DEFAULT 0,
    "available_stock" numeric(18,2) GENERATED ALWAYS AS (("current_stock" - "allocated_stock")) STORED,
    "net_requirement" numeric(18,2) GENERATED ALWAYS AS (GREATEST(("gross_requirement" - ("current_stock" - "allocated_stock")), (0)::numeric)) STORED,
    "shortage_qty" numeric(18,2) GENERATED ALWAYS AS (GREATEST(("gross_requirement" - ("current_stock" - "allocated_stock")), (0)::numeric)) STORED,
    "suggested_order_qty" numeric(18,2),
    "supplier_id" character varying(50),
    "lead_time_days" integer DEFAULT 0,
    "required_date" "date",
    "status" "public"."material_requirement_status" DEFAULT 'needed'::"public"."material_requirement_status" NOT NULL,
    "po_no" character varying(100),
    "po_qty" numeric(18,2),
    "po_date" "date",
    "calculated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "material_uom" character varying(20),
    CONSTRAINT "positive_quantities" CHECK (("gross_requirement" > (0)::numeric))
);


ALTER TABLE "public"."material_requirements" OWNER TO "postgres";


COMMENT ON TABLE "public"."material_requirements" IS 'ความต้องการวัตถุดิบที่คำนวณจาก BOM explosion สำหรับแต่ละแผนการผลิต';



COMMENT ON COLUMN "public"."material_requirements"."gross_requirement" IS 'ความต้องการรวม = production_qty × material_qty_per_unit × (1 + waste%)';



COMMENT ON COLUMN "public"."material_requirements"."net_requirement" IS 'ความต้องการสุทธิ = gross_requirement - available_stock';



COMMENT ON COLUMN "public"."material_requirements"."shortage_qty" IS 'ปริมาณที่ขาด (เหมือน net_requirement)';



COMMENT ON COLUMN "public"."material_requirements"."material_uom" IS 'หน่วยวัดวัตถุดิบจาก BOM (อาจต่างจากหน่วยพื้นฐานของ SKU)';



CREATE TABLE IF NOT EXISTS "public"."material_return_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "material_return_id" "uuid" NOT NULL,
    "material_issue_item_id" "uuid",
    "material_sku_id" character varying(50) NOT NULL,
    "pallet_id_external" character varying(100),
    "location_id" character varying(50),
    "location_code" character varying(50),
    "lot_no" character varying(50),
    "production_date" "date",
    "expiry_date" "date",
    "returned_qty" numeric(18,4) NOT NULL,
    "uom" character varying(20),
    "condition" character varying(50) DEFAULT 'good'::character varying,
    "remarks" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "material_return_items_condition_check" CHECK ((("condition")::"text" = ANY ((ARRAY['good'::character varying, 'damaged'::character varying, 'expired'::character varying, 'other'::character varying])::"text"[]))),
    CONSTRAINT "material_return_items_returned_qty_check" CHECK (("returned_qty" > (0)::numeric))
);


ALTER TABLE "public"."material_return_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."material_return_items" IS 'รายการวัตถุดิบที่คืนแต่ละรายการ';



CREATE TABLE IF NOT EXISTS "public"."material_returns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "return_no" character varying(50) NOT NULL,
    "material_issue_id" "uuid" NOT NULL,
    "production_order_id" "uuid" NOT NULL,
    "return_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "return_time" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "reason" character varying(100),
    "reason_details" "text",
    "status" character varying(20) DEFAULT 'returned'::character varying NOT NULL,
    "returned_by" bigint,
    "returned_by_name" character varying(255),
    "remarks" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" bigint,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "material_returns_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['returned'::character varying, 'inspected'::character varying, 'restocked'::character varying, 'cancelled'::character varying])::"text"[])))
);


ALTER TABLE "public"."material_returns" OWNER TO "postgres";


COMMENT ON TABLE "public"."material_returns" IS 'การคืนวัตถุดิบที่เหลือจากการผลิต';



CREATE TABLE IF NOT EXISTS "public"."packing_backup_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "original_order_id" "text",
    "order_number" "text" NOT NULL,
    "buyer_name" "text" NOT NULL,
    "tracking_number" "text",
    "parent_sku" "text",
    "product_name" "text",
    "quantity" integer,
    "fulfillment_status" "text",
    "completed_at" timestamp with time zone,
    "platform" "text" NOT NULL,
    "shipping_provider" "text",
    "packing_status" "text",
    "packed_at" timestamp with time zone,
    "packed_by" "text",
    "sample_alert" "text",
    "moved_to_backup_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."packing_backup_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."packing_box_stock_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "box_stock_id" "uuid",
    "box_id" "uuid",
    "box_code" "text" NOT NULL,
    "quantity_before" integer NOT NULL,
    "quantity_after" integer NOT NULL,
    "quantity_change" integer NOT NULL,
    "change_type" "text" NOT NULL,
    "reason" "text",
    "changed_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "packing_box_stock_history_change_type_check" CHECK (("change_type" = ANY (ARRAY['restock'::"text", 'use'::"text", 'adjustment'::"text", 'initial'::"text"])))
);


ALTER TABLE "public"."packing_box_stock_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."packing_box_stocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "box_id" "uuid",
    "current_quantity" integer DEFAULT 0 NOT NULL,
    "minimum_quantity" integer DEFAULT 10,
    "maximum_quantity" integer DEFAULT 1000,
    "last_restocked_at" timestamp with time zone,
    "last_restocked_quantity" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "packing_box_stocks_current_quantity_check" CHECK (("current_quantity" >= 0))
);


ALTER TABLE "public"."packing_box_stocks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."packing_boxes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "box_code" "text" NOT NULL,
    "box_name" "text" NOT NULL,
    "dimensions_length" numeric(10,2) NOT NULL,
    "dimensions_width" numeric(10,2) NOT NULL,
    "dimensions_height" numeric(10,2) NOT NULL,
    "max_weight" numeric(10,2) NOT NULL,
    "volume" numeric(15,2) GENERATED ALWAYS AS ((("dimensions_length" * "dimensions_width") * "dimensions_height")) STORED,
    "cost_per_box" numeric(10,2) DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."packing_boxes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."packing_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tracking_number" "text" NOT NULL,
    "box_id" "uuid",
    "box_code" "text",
    "total_weight" numeric(10,3),
    "total_volume" numeric(15,2),
    "items_count" integer,
    "packed_by" "text",
    "pack_duration" integer,
    "efficiency_score" numeric(5,2),
    "notes" "text",
    "packed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."packing_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."packing_order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid",
    "parent_sku" "text" NOT NULL,
    "product_name" "text" NOT NULL,
    "quantity" integer NOT NULL,
    "scanned_quantity" integer DEFAULT 0,
    "is_completed" boolean DEFAULT false,
    "bundle_info" "jsonb",
    "freebie_display_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "packing_order_items_quantity_check" CHECK (("quantity" > 0)),
    CONSTRAINT "packing_order_items_scanned_quantity_check" CHECK (("scanned_quantity" >= 0))
);


ALTER TABLE "public"."packing_order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."packing_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_number" "text" NOT NULL,
    "buyer_name" "text" NOT NULL,
    "tracking_number" "text",
    "parent_sku" "text",
    "product_name" "text",
    "quantity" integer DEFAULT 1,
    "fulfillment_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "completed_at" timestamp with time zone,
    "platform" "text" NOT NULL,
    "shipping_provider" "text",
    "packing_status" "text",
    "packed_at" timestamp with time zone,
    "packed_by" "text",
    "sample_alert" "text",
    "recommended_box_id" "uuid",
    "actual_box_id" "uuid",
    "box_cost" numeric(10,2),
    "packaging_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "packing_orders_fulfillment_status_check" CHECK (("fulfillment_status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'packed'::"text", 'shipped'::"text", 'delivered'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "packing_orders_packing_status_check" CHECK (("packing_status" = ANY (ARRAY['not_started'::"text", 'in_progress'::"text", 'completed'::"text"]))),
    CONSTRAINT "packing_orders_quantity_check" CHECK (("quantity" > 0))
);


ALTER TABLE "public"."packing_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."packing_product_weight_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_type_code" "text" NOT NULL,
    "weight_kg" numeric(10,2) NOT NULL,
    "dimensions_length" numeric(10,2) NOT NULL,
    "dimensions_width" numeric(10,2) NOT NULL,
    "dimensions_height" numeric(10,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."packing_product_weight_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."packing_products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parent_sku" "text" NOT NULL,
    "product_name" "text" NOT NULL,
    "barcode" "text",
    "is_sample" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."packing_products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."packing_promotion_freebies" (
    "id" integer NOT NULL,
    "product_barcode" "text" NOT NULL,
    "product_name" "text",
    "product_code" "text",
    "freebie_name" "text" NOT NULL,
    "freebie_description" "text",
    "display_name" "text",
    "freebie_skus" "jsonb",
    "random_freebie" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "text",
    "updated_by" "text"
);


ALTER TABLE "public"."packing_promotion_freebies" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."packing_promotion_freebies_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."packing_promotion_freebies_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."packing_promotion_freebies_id_seq" OWNED BY "public"."packing_promotion_freebies"."id";



CREATE TABLE IF NOT EXISTS "public"."packing_returns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "text" NOT NULL,
    "order_number" "text" NOT NULL,
    "buyer_name" "text" NOT NULL,
    "product_name" "text" NOT NULL,
    "parent_sku" "text" NOT NULL,
    "quantity" integer NOT NULL,
    "return_quantity" integer NOT NULL,
    "return_reason" "text" NOT NULL,
    "return_status" "text" DEFAULT 'pending'::"text",
    "notes" "text",
    "processed_by" "text",
    "processed_at" timestamp with time zone,
    "confirmation_images" "text"[],
    "image_upload_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "packing_returns_return_status_check" CHECK (("return_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."packing_returns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."packing_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "box_code" "text" NOT NULL,
    "primary_product_type_code" "text" NOT NULL,
    "rule_code" "text" NOT NULL,
    "components" "jsonb",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."packing_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."packing_system_menus" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "menu_path" "text" NOT NULL,
    "menu_name_th" "text" NOT NULL,
    "menu_name_en" "text" NOT NULL,
    "menu_icon" "text",
    "menu_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."packing_system_menus" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."packing_user_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "text",
    "menu_path" "text" NOT NULL,
    "can_access" boolean DEFAULT true,
    "can_create" boolean DEFAULT false,
    "can_edit" boolean DEFAULT false,
    "can_delete" boolean DEFAULT false,
    "can_export" boolean DEFAULT false,
    "can_print" boolean DEFAULT false,
    "notes" "text",
    "granted_by" "text",
    "granted_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."packing_user_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."packing_users" (
    "id" "text" NOT NULL,
    "user_code" "text",
    "username" "text" NOT NULL,
    "full_name" "text" NOT NULL,
    "email" "text",
    "password_hash" "text" NOT NULL,
    "role" "text" DEFAULT 'operator'::"text",
    "is_active" boolean DEFAULT true,
    "last_login" timestamp with time zone,
    "failed_login_attempts" integer DEFAULT 0,
    "locked_until" timestamp with time zone,
    "phone" "text",
    "department" "text",
    "profile_image" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "packing_users_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'operator'::"text"])))
);


ALTER TABLE "public"."packing_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."picklist_item_reservations" (
    "reservation_id" bigint NOT NULL,
    "picklist_item_id" bigint NOT NULL,
    "balance_id" bigint NOT NULL,
    "reserved_piece_qty" numeric(18,6) NOT NULL,
    "reserved_pack_qty" numeric(18,6) NOT NULL,
    "reserved_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "reserved_by" "uuid",
    "released_at" timestamp with time zone,
    "released_by" "uuid",
    "status" character varying(20) DEFAULT 'reserved'::character varying NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "picked_at" timestamp with time zone,
    CONSTRAINT "picklist_item_reservations_reserved_pack_qty_check" CHECK (("reserved_pack_qty" >= (0)::numeric)),
    CONSTRAINT "picklist_item_reservations_reserved_piece_qty_check" CHECK (("reserved_piece_qty" >= (0)::numeric)),
    CONSTRAINT "valid_status" CHECK ((("status")::"text" = ANY ((ARRAY['reserved'::character varying, 'picked'::character varying, 'released'::character varying, 'cancelled'::character varying])::"text"[])))
);


ALTER TABLE "public"."picklist_item_reservations" OWNER TO "postgres";


COMMENT ON TABLE "public"."picklist_item_reservations" IS 'เก็บรายละเอียดการจองสต็อคสำหรับแต่ละ picklist item โดยระบุ balance_id ที่จองไว้เพื่อให้ลดสต็อคถูกต้องตาม FEFO/FIFO';



COMMENT ON COLUMN "public"."picklist_item_reservations"."picklist_item_id" IS 'รายการในใบหยิบที่จองสต็อค';



COMMENT ON COLUMN "public"."picklist_item_reservations"."balance_id" IS 'Balance ที่จองสต็อคจาก (เพื่อให้ลดถูก balance เมื่อหยิบจริง)';



COMMENT ON COLUMN "public"."picklist_item_reservations"."reserved_piece_qty" IS 'จำนวนชิ้นที่จองไว้ (NUMERIC(18,6) เพื่อรองรับทศนิยม)';



COMMENT ON COLUMN "public"."picklist_item_reservations"."reserved_pack_qty" IS 'จำนวนแพ็คที่จองไว้ (คำนวณจาก reserved_piece_qty / qty_per_pack)';



COMMENT ON COLUMN "public"."picklist_item_reservations"."status" IS 'สถานะการจอง: reserved=จองแล้ว, picked=หยิบแล้ว, released=ปลดจอง, cancelled=ยกเลิก';



CREATE SEQUENCE IF NOT EXISTS "public"."picklist_item_reservations_reservation_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."picklist_item_reservations_reservation_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."picklist_item_reservations_reservation_id_seq" OWNED BY "public"."picklist_item_reservations"."reservation_id";



CREATE TABLE IF NOT EXISTS "public"."picklist_items" (
    "id" bigint NOT NULL,
    "picklist_id" bigint NOT NULL,
    "order_item_id" bigint,
    "sku_id" character varying(50) NOT NULL,
    "stop_id" bigint,
    "quantity_to_pick" numeric(15,3) NOT NULL,
    "quantity_picked" numeric(15,3) DEFAULT 0,
    "source_location_id" character varying(50),
    "status" "public"."picklist_item_status_enum" DEFAULT 'pending'::"public"."picklist_item_status_enum" NOT NULL,
    "picked_by_employee_id" bigint,
    "picked_at" timestamp with time zone,
    "notes" "text",
    "sku_name" character varying(255),
    "uom" character varying(20),
    "order_no" character varying(100),
    "order_id" bigint,
    "pack_no" character varying(100),
    CONSTRAINT "picklist_items_quantity_picked_check" CHECK (("quantity_picked" >= (0)::numeric)),
    CONSTRAINT "picklist_items_quantity_to_pick_check" CHECK (("quantity_to_pick" >= (0)::numeric))
);


ALTER TABLE "public"."picklist_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."picklist_items" IS 'ตารางรายการสินค้าที่ต้องจัดในแต่ละใบจัด (Picklist Details)';



COMMENT ON COLUMN "public"."picklist_items"."picklist_id" IS 'FK อ้างอิงถึงใบจัดสินค้าในตาราง picklists';



COMMENT ON COLUMN "public"."picklist_items"."order_item_id" IS 'FK อ้างอิงถึงรายการสินค้าในออเดอร์ wms_order_items';



COMMENT ON COLUMN "public"."picklist_items"."sku_id" IS 'รหัสสินค้า (SKU) ที่ต้องจัด';



COMMENT ON COLUMN "public"."picklist_items"."stop_id" IS 'FK อ้างอิงถึงจุดหยุดในเที่ยวรถ เพื่อระบุว่าสินค้านี้สำหรับลูกค้า/ร้านไหน';



COMMENT ON COLUMN "public"."picklist_items"."quantity_to_pick" IS 'จำนวนที่ต้องจัดตามออเดอร์';



COMMENT ON COLUMN "public"."picklist_items"."quantity_picked" IS 'จำนวนที่จัดได้จริง';



COMMENT ON COLUMN "public"."picklist_items"."source_location_id" IS 'ตำแหน่งแนะนำสำหรับจัดเก็บสินค้านี้ (Suggested pick location)';



COMMENT ON COLUMN "public"."picklist_items"."status" IS 'สถานะของรายการสินค้านี้';



COMMENT ON COLUMN "public"."picklist_items"."sku_name" IS 'ชื่อสินค้า (denormalized สำหรับการแสดงผลและพิมพ์เอกสาร)';



COMMENT ON COLUMN "public"."picklist_items"."uom" IS 'หน่วยนับ (denormalized สำหรับการแสดงผลและพิมพ์เอกสาร)';



COMMENT ON COLUMN "public"."picklist_items"."order_no" IS 'เลขที่ออเดอร์ (denormalized สำหรับการแสดงผลและพิมพ์เอกสาร)';



COMMENT ON COLUMN "public"."picklist_items"."order_id" IS 'FK อ้างอิงถึง wms_orders เพื่อเก็บความสัมพันธ์ระหว่างรายการจัดสินค้ากับออเดอร์';



COMMENT ON COLUMN "public"."picklist_items"."pack_no" IS 'หมายเลขแพ็ค (เช่น 1, 2, 3 หรือ 1,2 ถ้าแบ่งหลายแพ็ค)';



CREATE SEQUENCE IF NOT EXISTS "public"."picklist_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."picklist_items_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."picklist_items_id_seq" OWNED BY "public"."picklist_items"."id";



CREATE SEQUENCE IF NOT EXISTS "public"."picklists_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."picklists_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."picklists_id_seq" OWNED BY "public"."picklists"."id";



CREATE TABLE IF NOT EXISTS "public"."preparation_area" (
    "area_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "area_code" character varying(50) NOT NULL,
    "area_name" character varying(255) NOT NULL,
    "description" "text",
    "warehouse_id" character varying(50) NOT NULL,
    "zone" character varying(50) NOT NULL,
    "area_type" character varying(50) NOT NULL,
    "capacity_sqm" numeric(10,2),
    "current_utilization_pct" numeric(5,2) DEFAULT 0,
    "max_capacity_pallets" integer,
    "current_pallets" integer DEFAULT 0,
    "status" character varying(20) DEFAULT 'active'::character varying NOT NULL,
    "created_by" character varying(100),
    "updated_by" character varying(100),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "preparation_area_current_utilization_pct_check" CHECK ((("current_utilization_pct" >= (0)::numeric) AND ("current_utilization_pct" <= (100)::numeric))),
    CONSTRAINT "preparation_area_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'maintenance'::character varying])::"text"[])))
);


ALTER TABLE "public"."preparation_area" OWNER TO "postgres";


COMMENT ON TABLE "public"."preparation_area" IS 'พื้นที่จัดเตรียมสินค้า เช่น พื้นที่บรรจุภัณฑ์, พื้นที่ตรวจสอบคุณภาพ, พื้นที่รวมสินค้า';



COMMENT ON COLUMN "public"."preparation_area"."area_type" IS 'ประเภทของพื้นที่จัดเตรียมสินค้า';



COMMENT ON COLUMN "public"."preparation_area"."current_utilization_pct" IS 'เปอร์เซ็นต์การใช้งานพื้นที่ปัจจุบัน';



CREATE TABLE IF NOT EXISTS "public"."preparation_order" (
    "order_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_no" character varying(30) NOT NULL,
    "warehouse_id" character varying(50) NOT NULL,
    "order_type" character varying(50) NOT NULL,
    "preparation_area_id" "uuid",
    "priority" "public"."preparation_priority_enum" DEFAULT 'normal'::"public"."preparation_priority_enum" NOT NULL,
    "status" "public"."preparation_order_status_enum" DEFAULT 'draft'::"public"."preparation_order_status_enum" NOT NULL,
    "total_items" integer DEFAULT 0 NOT NULL,
    "total_quantity" numeric(18,2) DEFAULT 0 NOT NULL,
    "completed_items" integer DEFAULT 0 NOT NULL,
    "completed_quantity" numeric(18,2) DEFAULT 0 NOT NULL,
    "planned_start_time" timestamp with time zone,
    "planned_end_time" timestamp with time zone,
    "actual_start_time" timestamp with time zone,
    "actual_end_time" timestamp with time zone,
    "assigned_to" character varying(100),
    "notes" "text",
    "reference_no" character varying(50),
    "created_by" character varying(100),
    "updated_by" character varying(100),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."preparation_order" OWNER TO "postgres";


COMMENT ON TABLE "public"."preparation_order" IS 'ใบจัดเตรียมสินค้า';



COMMENT ON COLUMN "public"."preparation_order"."order_type" IS 'ประเภทของใบจัดเตรียมสินค้า';



COMMENT ON COLUMN "public"."preparation_order"."reference_no" IS 'เลขที่อ้างอิง เช่น เลขที่ออเดอร์, เลขที่พิคลิสต์';



CREATE TABLE IF NOT EXISTS "public"."preparation_order_item" (
    "item_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "line_no" integer NOT NULL,
    "sku_id" character varying(50) NOT NULL,
    "required_quantity" numeric(18,2) NOT NULL,
    "picked_quantity" numeric(18,2) DEFAULT 0 NOT NULL,
    "uom" character varying(20) NOT NULL,
    "status" "public"."preparation_item_status_enum" DEFAULT 'pending'::"public"."preparation_item_status_enum" NOT NULL,
    "assigned_location_id" character varying(50),
    "assigned_pallet_id" character varying(100),
    "assigned_lot_no" character varying(100),
    "assigned_expiry_date" "date",
    "notes" "text",
    "created_by" character varying(100),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."preparation_order_item" OWNER TO "postgres";


COMMENT ON TABLE "public"."preparation_order_item" IS 'รายการสินค้าในใบจัดเตรียมสินค้า';



COMMENT ON COLUMN "public"."preparation_order_item"."assigned_location_id" IS 'ตำแหน่งที่กำหนดให้ไปหยิบสินค้า';



COMMENT ON COLUMN "public"."preparation_order_item"."assigned_pallet_id" IS 'พาเลทที่กำหนดให้ไปหยิบสินค้า';



CREATE TABLE IF NOT EXISTS "public"."production_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "production_order_id" "uuid" NOT NULL,
    "action" character varying(100) NOT NULL,
    "old_value" "text",
    "new_value" "text",
    "remarks" "text",
    "created_by" bigint,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."production_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."production_logs" IS 'บันทึกกิจกรรมและการเปลี่ยนแปลง';



COMMENT ON COLUMN "public"."production_logs"."action" IS 'เช่น Created, Status Updated, Materials Issued, Completed';



CREATE TABLE IF NOT EXISTS "public"."production_order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "production_order_id" "uuid" NOT NULL,
    "material_sku_id" character varying(50) NOT NULL,
    "required_qty" numeric(18,2) NOT NULL,
    "issued_qty" numeric(18,2) DEFAULT 0,
    "remaining_qty" numeric(18,2) GENERATED ALWAYS AS (("required_qty" - "issued_qty")) STORED,
    "uom" character varying(20),
    "status" "public"."production_item_status" DEFAULT 'pending'::"public"."production_item_status" NOT NULL,
    "issued_date" timestamp with time zone,
    "remarks" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "production_order_items_issued_qty_check" CHECK (("issued_qty" >= (0)::numeric)),
    CONSTRAINT "production_order_items_required_qty_check" CHECK (("required_qty" > (0)::numeric))
);


ALTER TABLE "public"."production_order_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."production_order_items" IS 'รายการวัตถุดิบที่ต้องใช้ในการผลิต';



COMMENT ON COLUMN "public"."production_order_items"."material_sku_id" IS 'วัตถุดิบที่ต้องใช้';



COMMENT ON COLUMN "public"."production_order_items"."required_qty" IS 'จำนวนที่ต้องใช้';



COMMENT ON COLUMN "public"."production_order_items"."issued_qty" IS 'จำนวนที่จ่ายออกไปแล้ว';



CREATE TABLE IF NOT EXISTS "public"."production_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "production_no" character varying(50) NOT NULL,
    "plan_id" "uuid",
    "sku_id" character varying(50) NOT NULL,
    "quantity" numeric(18,2) NOT NULL,
    "produced_qty" numeric(18,2) DEFAULT 0,
    "remaining_qty" numeric(18,2) GENERATED ALWAYS AS (("quantity" - "produced_qty")) STORED,
    "uom" character varying(20),
    "start_date" "date" NOT NULL,
    "due_date" "date" NOT NULL,
    "actual_start_date" "date",
    "actual_completion_date" "date",
    "status" "public"."production_order_status" DEFAULT 'planned'::"public"."production_order_status" NOT NULL,
    "priority" smallint DEFAULT 5,
    "remarks" "text",
    "created_by" bigint,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "production_orders_priority_check" CHECK ((("priority" >= 1) AND ("priority" <= 99))),
    CONSTRAINT "production_orders_produced_qty_check" CHECK (("produced_qty" >= (0)::numeric)),
    CONSTRAINT "production_orders_quantity_check" CHECK (("quantity" > (0)::numeric)),
    CONSTRAINT "valid_production_dates" CHECK (("due_date" >= "start_date"))
);


ALTER TABLE "public"."production_orders" OWNER TO "postgres";


COMMENT ON TABLE "public"."production_orders" IS 'คำสั่งผลิตสินค้า';



COMMENT ON COLUMN "public"."production_orders"."production_no" IS 'หมายเลขคำสั่งผลิต (PO-YYYY-NNNN)';



COMMENT ON COLUMN "public"."production_orders"."plan_id" IS 'อ้างอิงแผนการผลิต MRP';



COMMENT ON COLUMN "public"."production_orders"."sku_id" IS 'สินค้าที่ต้องผลิต';



COMMENT ON COLUMN "public"."production_orders"."quantity" IS 'จำนวนที่ต้องผลิต';



COMMENT ON COLUMN "public"."production_orders"."produced_qty" IS 'จำนวนที่ผลิตแล้ว';



COMMENT ON COLUMN "public"."production_orders"."remaining_qty" IS 'จำนวนคงเหลือ (คำนวณอัตโนมัติ)';



CREATE TABLE IF NOT EXISTS "public"."production_plan" (
    "plan_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plan_no" character varying(50) NOT NULL,
    "plan_name" character varying(255) NOT NULL,
    "plan_description" "text",
    "plan_start_date" "date" NOT NULL,
    "plan_end_date" "date" NOT NULL,
    "warehouse_id" character varying(50),
    "production_area_id" "uuid",
    "priority" smallint DEFAULT 5,
    "status" "public"."production_plan_status" DEFAULT 'draft'::"public"."production_plan_status" NOT NULL,
    "total_products_planned" integer DEFAULT 0,
    "total_materials_required" integer DEFAULT 0,
    "total_shortage_items" integer DEFAULT 0,
    "created_by" bigint,
    "approved_by" bigint,
    "approved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "production_plan_priority_check" CHECK ((("priority" >= 1) AND ("priority" <= 99))),
    CONSTRAINT "valid_plan_dates" CHECK (("plan_end_date" >= "plan_start_date"))
);


ALTER TABLE "public"."production_plan" OWNER TO "postgres";


COMMENT ON TABLE "public"."production_plan" IS 'แผนการผลิตหลัก (Master Production Schedule) - กำหนดสินค้าที่จะผลิตในแต่ละช่วงเวลา';



COMMENT ON COLUMN "public"."production_plan"."plan_no" IS 'รหัสแผนการผลิต (เช่น PLAN-2025-001)';



COMMENT ON COLUMN "public"."production_plan"."priority" IS 'ระดับความสำคัญ 1-99 (99 = สูงสุด)';



COMMENT ON COLUMN "public"."production_plan"."total_shortage_items" IS 'จำนวนวัตถุดิบที่ขาด (คำนวณจาก material_requirements)';



CREATE TABLE IF NOT EXISTS "public"."production_plan_items" (
    "plan_item_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "sku_id" character varying(50) NOT NULL,
    "required_qty" numeric(18,2) NOT NULL,
    "produced_qty" numeric(18,2) DEFAULT 0,
    "remaining_qty" numeric(18,2) GENERATED ALWAYS AS (("required_qty" - "produced_qty")) STORED,
    "current_stock_qty" numeric(18,2) DEFAULT 0,
    "safety_stock_qty" numeric(18,2) DEFAULT 0,
    "net_requirement_qty" numeric(18,2) GENERATED ALWAYS AS (GREATEST((("required_qty" - "current_stock_qty") - "safety_stock_qty"), (0)::numeric)) STORED,
    "scheduled_start_date" "date",
    "scheduled_end_date" "date",
    "actual_start_date" "date",
    "actual_end_date" "date",
    "status" "public"."production_order_status" DEFAULT 'planned'::"public"."production_order_status" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "production_plan_items_produced_qty_check" CHECK (("produced_qty" >= (0)::numeric)),
    CONSTRAINT "production_plan_items_required_qty_check" CHECK (("required_qty" > (0)::numeric)),
    CONSTRAINT "valid_item_dates" CHECK (("scheduled_end_date" >= "scheduled_start_date"))
);


ALTER TABLE "public"."production_plan_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."production_plan_items" IS 'รายการสินค้าที่ต้องการผลิตในแต่ละแผนการผลิต';



COMMENT ON COLUMN "public"."production_plan_items"."net_requirement_qty" IS 'ความต้องการสุทธิ = required_qty - current_stock - safety_stock';



CREATE TABLE IF NOT EXISTS "public"."production_receipts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "production_order_id" "uuid" NOT NULL,
    "product_sku_id" character varying(50) NOT NULL,
    "received_qty" numeric(18,2) NOT NULL,
    "receive_location_id" "uuid",
    "lot_no" character varying(50),
    "batch_no" character varying(50),
    "produced_by" bigint,
    "received_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "remarks" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "production_receipts_received_qty_check" CHECK (("received_qty" > (0)::numeric))
);


ALTER TABLE "public"."production_receipts" OWNER TO "postgres";


COMMENT ON TABLE "public"."production_receipts" IS 'บันทึกการรับสินค้าสำเร็จรูปจากการผลิต';



COMMENT ON COLUMN "public"."production_receipts"."product_sku_id" IS 'รหัสสินค้าสำเร็จรูป';



COMMENT ON COLUMN "public"."production_receipts"."received_qty" IS 'จำนวนที่รับเข้า';



COMMENT ON COLUMN "public"."production_receipts"."receive_location_id" IS 'ตำแหน่งคลังปลายทาง';



COMMENT ON COLUMN "public"."production_receipts"."lot_no" IS 'หมายเลขล็อต (เช่น LOT-202511-001)';



CREATE TABLE IF NOT EXISTS "public"."purchase_order_items" (
    "poi_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "po_id" "uuid",
    "sku_id" character varying(50),
    "required_qty" numeric(15,3) NOT NULL,
    "ordered_qty" numeric(15,3) NOT NULL,
    "unit_price" numeric(15,2) DEFAULT 0,
    "amount" numeric(15,2) DEFAULT 0,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."purchase_order_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."purchase_order_items" IS 'ตารางเก็บรายการสินค้าในใบสั่งซื้อ';



CREATE TABLE IF NOT EXISTS "public"."purchase_orders" (
    "po_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "po_no" character varying(50) NOT NULL,
    "plan_id" "uuid",
    "supplier_id" character varying(50),
    "po_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "expected_delivery_date" "date",
    "status" character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    "total_amount" numeric(15,2) DEFAULT 0,
    "notes" "text",
    "created_by" character varying(100),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."purchase_orders" OWNER TO "postgres";


COMMENT ON TABLE "public"."purchase_orders" IS 'ตารางเก็บข้อมูลใบสั่งซื้อวัตถุดิบ';



COMMENT ON COLUMN "public"."purchase_orders"."status" IS 'สถานะ: draft, submitted, approved, received, cancelled';



CREATE TABLE IF NOT EXISTS "public"."receiving_route_clusters" (
    "cluster_id" bigint NOT NULL,
    "plan_id" bigint NOT NULL,
    "cluster_code" character varying(50),
    "algorithm" character varying(50),
    "color_hex" character varying(7),
    "centroid_latitude" numeric(10,7),
    "centroid_longitude" numeric(10,7),
    "total_inputs" integer DEFAULT 0,
    "total_weight_kg" numeric(12,3) DEFAULT 0,
    "total_volume_cbm" numeric(12,3) DEFAULT 0,
    "total_distance_km" numeric(12,2),
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "receiving_route_clusters_total_distance_km_check" CHECK ((("total_distance_km" IS NULL) OR ("total_distance_km" >= (0)::numeric))),
    CONSTRAINT "receiving_route_clusters_total_inputs_check" CHECK (("total_inputs" >= 0)),
    CONSTRAINT "receiving_route_clusters_total_volume_cbm_check" CHECK (("total_volume_cbm" >= (0)::numeric)),
    CONSTRAINT "receiving_route_clusters_total_weight_kg_check" CHECK (("total_weight_kg" >= (0)::numeric))
);


ALTER TABLE "public"."receiving_route_clusters" OWNER TO "postgres";


COMMENT ON TABLE "public"."receiving_route_clusters" IS 'ผลลัพธ์การจัดกลุ่มพื้นที่ (cluster first) ก่อนสร้างเส้นทาง รายงาน centroid และ KPI ของแต่ละโซน';



COMMENT ON COLUMN "public"."receiving_route_clusters"."algorithm" IS 'ชื่ออัลกอริทึมที่ใช้ เช่น kmeans, grid, province';



CREATE SEQUENCE IF NOT EXISTS "public"."receiving_route_clusters_cluster_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."receiving_route_clusters_cluster_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."receiving_route_clusters_cluster_id_seq" OWNED BY "public"."receiving_route_clusters"."cluster_id";



CREATE TABLE IF NOT EXISTS "public"."receiving_route_plan_inputs" (
    "input_id" bigint NOT NULL,
    "plan_id" bigint NOT NULL,
    "receive_id" bigint,
    "receive_universal_id" bigint,
    "supplier_id" character varying(50),
    "source_reference" character varying(100),
    "stop_name" character varying(255),
    "contact_name" character varying(100),
    "contact_phone" character varying(50),
    "address" "text",
    "latitude" numeric(10,7),
    "longitude" numeric(10,7),
    "ready_time" timestamp with time zone,
    "due_time" timestamp with time zone,
    "service_duration_minutes" integer DEFAULT 0,
    "priority" smallint DEFAULT 50,
    "demand_weight_kg" numeric(12,3) DEFAULT 0,
    "demand_volume_cbm" numeric(12,3) DEFAULT 0,
    "demand_pallets" numeric(12,2) DEFAULT 0,
    "demand_units" integer DEFAULT 0,
    "cluster_hint" character varying(50),
    "zone_hint" character varying(50),
    "is_active" boolean DEFAULT true,
    "tags" "jsonb",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "order_id" bigint,
    CONSTRAINT "receiving_route_plan_inputs_demand_pallets_check" CHECK (("demand_pallets" >= (0)::numeric)),
    CONSTRAINT "receiving_route_plan_inputs_demand_units_check" CHECK (("demand_units" >= 0)),
    CONSTRAINT "receiving_route_plan_inputs_demand_volume_cbm_check" CHECK (("demand_volume_cbm" >= (0)::numeric)),
    CONSTRAINT "receiving_route_plan_inputs_demand_weight_kg_check" CHECK (("demand_weight_kg" >= (0)::numeric)),
    CONSTRAINT "receiving_route_plan_inputs_priority_check" CHECK ((("priority" >= 1) AND ("priority" <= 999))),
    CONSTRAINT "receiving_route_plan_inputs_service_duration_minutes_check" CHECK (("service_duration_minutes" >= 0))
);


ALTER TABLE "public"."receiving_route_plan_inputs" OWNER TO "postgres";


COMMENT ON TABLE "public"."receiving_route_plan_inputs" IS 'ข้อมูลดิบสำหรับจุดรับสินค้าที่ต้องนำไปจัดเส้นทางในแต่ละแผน';



COMMENT ON COLUMN "public"."receiving_route_plan_inputs"."cluster_hint" IS 'ตัวช่วยจัดกลุ่ม/โซนจากผู้ใช้หรืออัลกอริทึมภายนอก';



COMMENT ON COLUMN "public"."receiving_route_plan_inputs"."tags" IS 'ข้อมูลเสริม (JSON) เช่น ประเภทสินค้า เงื่อนไขพิเศษ';



COMMENT ON COLUMN "public"."receiving_route_plan_inputs"."order_id" IS 'Order ID reference for route planning (FK → wms_orders.order_id)';



CREATE SEQUENCE IF NOT EXISTS "public"."receiving_route_plan_inputs_input_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."receiving_route_plan_inputs_input_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."receiving_route_plan_inputs_input_id_seq" OWNED BY "public"."receiving_route_plan_inputs"."input_id";



CREATE TABLE IF NOT EXISTS "public"."receiving_route_plan_metrics" (
    "metric_id" bigint NOT NULL,
    "plan_id" bigint NOT NULL,
    "metric_key" character varying(100) NOT NULL,
    "metric_value" numeric,
    "metric_unit" character varying(50),
    "metric_context" "jsonb",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "total_distance_km" numeric,
    "total_duration_minutes" integer,
    "total_trips" integer,
    "total_orders" integer,
    "total_cost" numeric,
    "avg_orders_per_trip" numeric,
    "avg_distance_per_trip" numeric
);


ALTER TABLE "public"."receiving_route_plan_metrics" OWNER TO "postgres";


COMMENT ON TABLE "public"."receiving_route_plan_metrics" IS 'KPI/Metric เสริมสำหรับแผนรับสินค้า เช่น ค่าใช้จ่ายรวม ระยะเวลาเฉลี่ย';



COMMENT ON COLUMN "public"."receiving_route_plan_metrics"."total_distance_km" IS 'Total route distance in kilometers for the plan';



COMMENT ON COLUMN "public"."receiving_route_plan_metrics"."total_duration_minutes" IS 'Combined drive + service minutes for the plan';



COMMENT ON COLUMN "public"."receiving_route_plan_metrics"."total_trips" IS 'Total trips produced by the optimization';



COMMENT ON COLUMN "public"."receiving_route_plan_metrics"."total_orders" IS 'Total delivery orders assigned across all trips';



COMMENT ON COLUMN "public"."receiving_route_plan_metrics"."total_cost" IS 'Estimated total logistics cost for the plan';



COMMENT ON COLUMN "public"."receiving_route_plan_metrics"."avg_orders_per_trip" IS 'Average orders handled per trip';



COMMENT ON COLUMN "public"."receiving_route_plan_metrics"."avg_distance_per_trip" IS 'Average distance driven per trip (km)';



CREATE SEQUENCE IF NOT EXISTS "public"."receiving_route_plan_metrics_metric_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."receiving_route_plan_metrics_metric_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."receiving_route_plan_metrics_metric_id_seq" OWNED BY "public"."receiving_route_plan_metrics"."metric_id";



CREATE TABLE IF NOT EXISTS "public"."receiving_route_plans" (
    "plan_id" bigint NOT NULL,
    "plan_code" character varying(50) NOT NULL,
    "plan_name" character varying(255),
    "plan_date" "date" NOT NULL,
    "warehouse_id" character varying(50) NOT NULL,
    "description" "text",
    "optimization_profile" character varying(100),
    "settings" "jsonb",
    "status" "public"."receiving_route_plan_status_enum" DEFAULT 'draft'::"public"."receiving_route_plan_status_enum" NOT NULL,
    "total_trips" integer DEFAULT 0,
    "total_distance_km" numeric(12,2) DEFAULT 0,
    "total_drive_minutes" integer DEFAULT 0,
    "total_service_minutes" integer DEFAULT 0,
    "total_weight_kg" numeric(12,3) DEFAULT 0,
    "total_volume_cbm" numeric(12,3) DEFAULT 0,
    "total_pallets" numeric(12,2) DEFAULT 0,
    "objective_value" numeric(14,4),
    "objective_unit" character varying(50),
    "summary" "jsonb",
    "created_by" bigint,
    "started_optimization_at" timestamp with time zone,
    "completed_optimization_at" timestamp with time zone,
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "printed_at" timestamp with time zone,
    "printed_by" "uuid",
    "approved_at" timestamp with time zone,
    "approved_by" "uuid",
    CONSTRAINT "receiving_route_plans_total_distance_km_check" CHECK (("total_distance_km" >= (0)::numeric)),
    CONSTRAINT "receiving_route_plans_total_drive_minutes_check" CHECK (("total_drive_minutes" >= 0)),
    CONSTRAINT "receiving_route_plans_total_pallets_check" CHECK (("total_pallets" >= (0)::numeric)),
    CONSTRAINT "receiving_route_plans_total_service_minutes_check" CHECK (("total_service_minutes" >= 0)),
    CONSTRAINT "receiving_route_plans_total_trips_check" CHECK (("total_trips" >= 0)),
    CONSTRAINT "receiving_route_plans_total_volume_cbm_check" CHECK (("total_volume_cbm" >= (0)::numeric)),
    CONSTRAINT "receiving_route_plans_total_weight_kg_check" CHECK (("total_weight_kg" >= (0)::numeric))
);


ALTER TABLE "public"."receiving_route_plans" OWNER TO "postgres";


COMMENT ON TABLE "public"."receiving_route_plans" IS 'หัวตารางแผนเส้นทางรับสินค้า ใช้เก็บการตั้งค่าและผลลัพธ์รวมของการจัดเส้นทางแบบ VRP (Updated: 2025-11-10)';



COMMENT ON COLUMN "public"."receiving_route_plans"."plan_code" IS 'โค้ดอ้างอิงแผน เช่น RCV-PLAN-20250101-01';



COMMENT ON COLUMN "public"."receiving_route_plans"."plan_date" IS 'วันที่วางแผนรับสินค้า';



COMMENT ON COLUMN "public"."receiving_route_plans"."warehouse_id" IS 'คลังปลายทาง (FK → master_warehouse.warehouse_id)';



COMMENT ON COLUMN "public"."receiving_route_plans"."settings" IS 'ค่า configuration/parameter สำหรับการจัดเส้นทาง (JSON)';



COMMENT ON COLUMN "public"."receiving_route_plans"."summary" IS 'ข้อมูลสรุปผลการ optimize เช่น KPI หรือข้อความสำหรับแดชบอร์ด';



COMMENT ON COLUMN "public"."receiving_route_plans"."printed_at" IS 'วันเวลาที่พิมพ์ใบว่าจ้าง';



COMMENT ON COLUMN "public"."receiving_route_plans"."printed_by" IS 'ผู้ใช้ที่พิมพ์ใบว่าจ้าง';



COMMENT ON COLUMN "public"."receiving_route_plans"."approved_at" IS 'วันเวลาที่อนุมัติใบว่าจ้าง';



COMMENT ON COLUMN "public"."receiving_route_plans"."approved_by" IS 'ผู้จัดการที่อนุมัติใบว่าจ้าง';



CREATE SEQUENCE IF NOT EXISTS "public"."receiving_route_plans_plan_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."receiving_route_plans_plan_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."receiving_route_plans_plan_id_seq" OWNED BY "public"."receiving_route_plans"."plan_id";



CREATE TABLE IF NOT EXISTS "public"."receiving_route_stop_items" (
    "stop_item_id" bigint NOT NULL,
    "plan_id" bigint NOT NULL,
    "trip_id" bigint NOT NULL,
    "stop_id" bigint NOT NULL,
    "order_id" bigint NOT NULL,
    "order_item_id" bigint,
    "sku_id" character varying(50),
    "sku_name" character varying(255),
    "allocated_quantity" numeric(15,3),
    "allocated_weight_kg" numeric(15,3),
    "allocated_volume_cbm" numeric(15,3),
    "allocated_pallets" numeric(15,3),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."receiving_route_stop_items" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."receiving_route_stop_items_stop_item_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."receiving_route_stop_items_stop_item_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."receiving_route_stop_items_stop_item_id_seq" OWNED BY "public"."receiving_route_stop_items"."stop_item_id";



CREATE TABLE IF NOT EXISTS "public"."receiving_route_stops" (
    "stop_id" bigint NOT NULL,
    "trip_id" bigint NOT NULL,
    "plan_id" bigint NOT NULL,
    "cluster_id" bigint,
    "input_id" bigint,
    "stop_code" character varying(50),
    "sequence_no" smallint NOT NULL,
    "stop_type" "public"."receiving_route_stop_type_enum" DEFAULT 'pickup'::"public"."receiving_route_stop_type_enum" NOT NULL,
    "status" "public"."receiving_route_stop_status_enum" DEFAULT 'pending'::"public"."receiving_route_stop_status_enum" NOT NULL,
    "supplier_id" character varying(50),
    "warehouse_id" character varying(50),
    "location_id" character varying(50),
    "receive_id" bigint,
    "receive_universal_id" bigint,
    "stop_name" character varying(255),
    "address" "text",
    "latitude" numeric(10,7),
    "longitude" numeric(10,7),
    "time_window_start" timestamp with time zone,
    "time_window_end" timestamp with time zone,
    "planned_arrival_at" timestamp with time zone,
    "planned_departure_at" timestamp with time zone,
    "actual_arrival_at" timestamp with time zone,
    "actual_departure_at" timestamp with time zone,
    "travel_minutes_from_prev" integer,
    "service_duration_minutes" integer DEFAULT 0,
    "wait_minutes" integer DEFAULT 0,
    "load_weight_kg" numeric(12,3) DEFAULT 0,
    "load_volume_cbm" numeric(12,3) DEFAULT 0,
    "load_pallets" numeric(12,2) DEFAULT 0,
    "load_units" integer DEFAULT 0,
    "is_break" boolean DEFAULT false,
    "is_last_stop" boolean DEFAULT false,
    "exception_reason" "text",
    "proof_document_urls" "text"[],
    "proof_signature_name" character varying(100),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "customer_id" character varying(50),
    "order_id" bigint,
    "manual_override" boolean DEFAULT false,
    "override_note" "text",
    "split_from_stop_id" bigint,
    "allocated_units" integer,
    "allocated_volume_cbm" numeric(12,3),
    "allocated_pallets" numeric(12,2),
    "tags" "jsonb",
    CONSTRAINT "receiving_route_stops_load_pallets_check" CHECK (("load_pallets" >= (0)::numeric)),
    CONSTRAINT "receiving_route_stops_load_units_check" CHECK (("load_units" >= 0)),
    CONSTRAINT "receiving_route_stops_load_volume_cbm_check" CHECK (("load_volume_cbm" >= (0)::numeric)),
    CONSTRAINT "receiving_route_stops_load_weight_kg_check" CHECK (("load_weight_kg" >= (0)::numeric)),
    CONSTRAINT "receiving_route_stops_sequence_no_check" CHECK (("sequence_no" >= 1)),
    CONSTRAINT "receiving_route_stops_service_duration_minutes_check" CHECK (("service_duration_minutes" >= 0)),
    CONSTRAINT "receiving_route_stops_travel_minutes_from_prev_check" CHECK ((("travel_minutes_from_prev" IS NULL) OR ("travel_minutes_from_prev" >= 0))),
    CONSTRAINT "receiving_route_stops_wait_minutes_check" CHECK (("wait_minutes" >= 0))
);


ALTER TABLE "public"."receiving_route_stops" OWNER TO "postgres";


COMMENT ON TABLE "public"."receiving_route_stops" IS 'ตารางจุดแวะในเส้นทางรับสินค้า (Updated: 2025-11-10)';



COMMENT ON COLUMN "public"."receiving_route_stops"."stop_type" IS 'ประเภทจุดแวะ (start/pickup/dropoff/break/checkpoint/end)';



COMMENT ON COLUMN "public"."receiving_route_stops"."proof_document_urls" IS 'ลิงก์ไฟล์หลักฐาน เช่น รูปภาพ ใบเซ็นรับสินค้า';



COMMENT ON COLUMN "public"."receiving_route_stops"."customer_id" IS 'Reference to master_customer for the stop (FK → master_customer.customer_id)';



COMMENT ON COLUMN "public"."receiving_route_stops"."order_id" IS 'Reference to wms_orders for the stop (FK → wms_orders.order_id)';



COMMENT ON COLUMN "public"."receiving_route_stops"."manual_override" IS 'Indicates stop was manually adjusted by user';



COMMENT ON COLUMN "public"."receiving_route_stops"."override_note" IS 'Manual adjustment note from planner';



COMMENT ON COLUMN "public"."receiving_route_stops"."split_from_stop_id" IS 'Reference to original stop when order is split across multiple trips';



COMMENT ON COLUMN "public"."receiving_route_stops"."allocated_units" IS 'Units allocated to this stop when order split';



COMMENT ON COLUMN "public"."receiving_route_stops"."allocated_volume_cbm" IS 'Volume allocated to this stop when order split (CBM)';



COMMENT ON COLUMN "public"."receiving_route_stops"."allocated_pallets" IS 'Pallets allocated to this stop when order split';



COMMENT ON COLUMN "public"."receiving_route_stops"."tags" IS 'Additional data in JSON format, including order_ids array for orders linked to this stop';



CREATE SEQUENCE IF NOT EXISTS "public"."receiving_route_stops_stop_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."receiving_route_stops_stop_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."receiving_route_stops_stop_id_seq" OWNED BY "public"."receiving_route_stops"."stop_id";



CREATE TABLE IF NOT EXISTS "public"."receiving_route_trips" (
    "trip_id" bigint NOT NULL,
    "plan_id" bigint NOT NULL,
    "cluster_id" bigint,
    "trip_code" character varying(50),
    "trip_status" "public"."receiving_route_trip_status_enum" DEFAULT 'planned'::"public"."receiving_route_trip_status_enum" NOT NULL,
    "trip_sequence" smallint,
    "vehicle_id" bigint,
    "driver_id" bigint,
    "helper_id" bigint,
    "freight_rate_id" bigint,
    "warehouse_id" character varying(50),
    "start_location_id" character varying(50),
    "end_location_id" character varying(50),
    "scheduled_departure_at" timestamp with time zone,
    "scheduled_return_at" timestamp with time zone,
    "actual_departure_at" timestamp with time zone,
    "actual_return_at" timestamp with time zone,
    "total_distance_km" numeric(12,2) DEFAULT 0,
    "total_drive_minutes" integer DEFAULT 0,
    "total_service_minutes" integer DEFAULT 0,
    "total_stops" integer DEFAULT 0,
    "total_weight_kg" numeric(12,3) DEFAULT 0,
    "total_volume_cbm" numeric(12,3) DEFAULT 0,
    "total_pallets" numeric(12,2) DEFAULT 0,
    "capacity_utilization" numeric(5,2),
    "fuel_cost_estimate" numeric(12,2),
    "labor_cost_estimate" numeric(12,2),
    "cost_breakdown" "jsonb",
    "route_polyline" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "manual_override" boolean DEFAULT false,
    "shipping_cost" numeric(12,2) DEFAULT 0,
    "supplier_id" character varying(50),
    "is_overweight" boolean DEFAULT false,
    "pricing_mode" character varying(20) DEFAULT 'flat'::character varying,
    "base_price" numeric(12,2) DEFAULT 0,
    "helper_fee" numeric(12,2) DEFAULT 0,
    "extra_stop_fee" numeric(12,2) DEFAULT 0,
    "extra_stops_count" integer DEFAULT 0,
    "porterage_fee" numeric(12,2) DEFAULT 0,
    "other_fees" "jsonb" DEFAULT '[]'::"jsonb",
    CONSTRAINT "receiving_route_trips_base_price_check" CHECK (("base_price" >= (0)::numeric)),
    CONSTRAINT "receiving_route_trips_extra_stop_fee_check" CHECK (("extra_stop_fee" >= (0)::numeric)),
    CONSTRAINT "receiving_route_trips_extra_stops_count_check" CHECK (("extra_stops_count" >= 0)),
    CONSTRAINT "receiving_route_trips_helper_fee_check" CHECK (("helper_fee" >= (0)::numeric)),
    CONSTRAINT "receiving_route_trips_porterage_fee_check" CHECK (("porterage_fee" >= (0)::numeric)),
    CONSTRAINT "receiving_route_trips_pricing_mode_check" CHECK ((("pricing_mode")::"text" = ANY ((ARRAY['flat'::character varying, 'formula'::character varying])::"text"[]))),
    CONSTRAINT "receiving_route_trips_total_distance_km_check" CHECK (("total_distance_km" >= (0)::numeric)),
    CONSTRAINT "receiving_route_trips_total_drive_minutes_check" CHECK (("total_drive_minutes" >= 0)),
    CONSTRAINT "receiving_route_trips_total_pallets_check" CHECK (("total_pallets" >= (0)::numeric)),
    CONSTRAINT "receiving_route_trips_total_service_minutes_check" CHECK (("total_service_minutes" >= 0)),
    CONSTRAINT "receiving_route_trips_total_stops_check" CHECK (("total_stops" >= 0)),
    CONSTRAINT "receiving_route_trips_total_volume_cbm_check" CHECK (("total_volume_cbm" >= (0)::numeric)),
    CONSTRAINT "receiving_route_trips_total_weight_kg_check" CHECK (("total_weight_kg" >= (0)::numeric)),
    CONSTRAINT "receiving_route_trips_trip_sequence_check" CHECK ((("trip_sequence" IS NULL) OR ("trip_sequence" >= 1)))
);


ALTER TABLE "public"."receiving_route_trips" OWNER TO "postgres";


COMMENT ON TABLE "public"."receiving_route_trips" IS 'ตารางเที่ยวรถในแผนเส้นทางรับสินค้า (Updated: 2025-11-10)';



COMMENT ON COLUMN "public"."receiving_route_trips"."capacity_utilization" IS 'อัตราการใช้ความจุ (%) เทียบกับความจุรถ';



COMMENT ON COLUMN "public"."receiving_route_trips"."route_polyline" IS 'Polyline หรือ GeoJSON สำหรับวาดเส้นทางบนแผนที่';



COMMENT ON COLUMN "public"."receiving_route_trips"."manual_override" IS 'Indicates trip sequence/data was manually adjusted';



COMMENT ON COLUMN "public"."receiving_route_trips"."shipping_cost" IS 'ค่าขนส่งสำหรับเที่ยวรถนี้';



COMMENT ON COLUMN "public"."receiving_route_trips"."supplier_id" IS 'ซัพพลายเออร์ขนส่ง (Transport Supplier)';



COMMENT ON COLUMN "public"."receiving_route_trips"."is_overweight" IS 'แฟล็กบ่งชี้ว่าเที่ยวนี้มีน้ำหนักเกินความจุรถ (เกิดจากการบังคับจำนวนรถสูงสุด)';



COMMENT ON COLUMN "public"."receiving_route_trips"."pricing_mode" IS 'Pricing calculation mode: flat (lump sum) or formula (base + helper + extra stops)';



COMMENT ON COLUMN "public"."receiving_route_trips"."base_price" IS 'Base price by province/region (used in formula mode)';



COMMENT ON COLUMN "public"."receiving_route_trips"."helper_fee" IS 'Helper/assistant fee (used in formula mode)';



COMMENT ON COLUMN "public"."receiving_route_trips"."extra_stop_fee" IS 'Fee per extra stop beyond first stop (used in formula mode)';



COMMENT ON COLUMN "public"."receiving_route_trips"."extra_stops_count" IS 'Number of extra stops (total_stops - 1) for calculation reference';



COMMENT ON COLUMN "public"."receiving_route_trips"."porterage_fee" IS 'ค่าแบกน้ำหนัก (บาท)';



COMMENT ON COLUMN "public"."receiving_route_trips"."other_fees" IS 'ค่าใช้จ่ายอื่นๆ ที่ผู้ใช้กำหนดเอง (JSONB array) - รูปแบบ: [{"label": "ค่าทางด่วน", "amount": 100}, {"label": "ค่าจอดรถ", "amount": 50}]';



CREATE SEQUENCE IF NOT EXISTS "public"."receiving_route_trips_trip_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."receiving_route_trips_trip_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."receiving_route_trips_trip_id_seq" OWNED BY "public"."receiving_route_trips"."trip_id";



CREATE TABLE IF NOT EXISTS "public"."replenishment_queue" (
    "queue_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rule_id" "uuid",
    "warehouse_id" character varying(50) NOT NULL,
    "sku_id" character varying(50) NOT NULL,
    "pick_zone_id" "uuid",
    "from_location_id" character varying(50),
    "to_location_id" character varying(50),
    "requested_qty" integer NOT NULL,
    "confirmed_qty" integer DEFAULT 0,
    "priority" integer DEFAULT 5,
    "status" "public"."replenishment_queue_status" DEFAULT 'pending'::"public"."replenishment_queue_status",
    "trigger_source" character varying(50),
    "trigger_reference" character varying(100),
    "assigned_to" integer,
    "assigned_at" timestamp without time zone,
    "move_id" bigint,
    "started_at" timestamp without time zone,
    "completed_at" timestamp without time zone,
    "notes" "text",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "replenishment_queue_confirmed_qty_check" CHECK (("confirmed_qty" >= 0)),
    CONSTRAINT "replenishment_queue_priority_check" CHECK ((("priority" >= 1) AND ("priority" <= 10))),
    CONSTRAINT "replenishment_queue_requested_qty_check" CHECK (("requested_qty" > 0))
);


ALTER TABLE "public"."replenishment_queue" OWNER TO "postgres";


COMMENT ON TABLE "public"."replenishment_queue" IS 'คิวงานเติมสต็อกที่รอดำเนินการ';



COMMENT ON COLUMN "public"."replenishment_queue"."priority" IS 'ลำดับความสำคัญ 1-10 (10 = สูงสุด)';



COMMENT ON COLUMN "public"."replenishment_queue"."trigger_source" IS 'แหล่งที่มาของคำขอเติมสต็อก เช่น picklist_created, manual, scheduled';



COMMENT ON COLUMN "public"."replenishment_queue"."trigger_reference" IS 'เลขที่อ้างอิง เช่น PICK-NO หรือ ORDER-NO';



COMMENT ON COLUMN "public"."replenishment_queue"."move_id" IS 'เชื่อมโยงกับใบย้ายที่สร้างขึ้น';



CREATE TABLE IF NOT EXISTS "public"."replenishment_rules" (
    "rule_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "warehouse_id" character varying(50) NOT NULL,
    "sku_id" character varying(50) NOT NULL,
    "pick_zone_id" "uuid",
    "min_stock_qty" integer NOT NULL,
    "max_stock_qty" integer NOT NULL,
    "replen_qty" integer NOT NULL,
    "priority" "public"."replenishment_priority" DEFAULT 'normal'::"public"."replenishment_priority",
    "source_zone" character varying(100),
    "auto_trigger" boolean DEFAULT true,
    "status" "public"."replenishment_rule_status" DEFAULT 'active'::"public"."replenishment_rule_status",
    "created_by" character varying(100) NOT NULL,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "replenishment_rules_check" CHECK (("max_stock_qty" > "min_stock_qty")),
    CONSTRAINT "replenishment_rules_min_stock_qty_check" CHECK (("min_stock_qty" >= 0)),
    CONSTRAINT "replenishment_rules_replen_qty_check" CHECK (("replen_qty" > 0))
);


ALTER TABLE "public"."replenishment_rules" OWNER TO "postgres";


COMMENT ON TABLE "public"."replenishment_rules" IS 'กฎการเติมสต็อกอัตโนมัติสำหรับแต่ละ SKU ในแต่ละโซนเบิก';



COMMENT ON COLUMN "public"."replenishment_rules"."min_stock_qty" IS 'ปริมาณขั้นต่ำที่จะทริกเกอร์การเติมสต็อก';



COMMENT ON COLUMN "public"."replenishment_rules"."max_stock_qty" IS 'ปริมาณสูงสุดที่ต้องการให้มีในโซนเบิก';



COMMENT ON COLUMN "public"."replenishment_rules"."replen_qty" IS 'จำนวนที่จะเติมแต่ละครั้ง';



COMMENT ON COLUMN "public"."replenishment_rules"."source_zone" IS 'โซนต้นทางที่จะดึงสินค้ามา (เช่น Storage Zone)';



COMMENT ON COLUMN "public"."replenishment_rules"."auto_trigger" IS 'เปิดการทริกเกอร์อัตโนมัติหรือไม่';



CREATE TABLE IF NOT EXISTS "public"."role_permission" (
    "role_id" bigint NOT NULL,
    "module_id" bigint NOT NULL,
    "can_view" boolean DEFAULT false,
    "can_create" boolean DEFAULT false,
    "can_edit" boolean DEFAULT false,
    "can_delete" boolean DEFAULT false,
    "can_approve" boolean DEFAULT false,
    "created_by" bigint,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."role_permission" OWNER TO "postgres";


COMMENT ON TABLE "public"."role_permission" IS 'ตารางกำหนดสิทธิ์ต่อ Role และต่อโมดูล';



COMMENT ON COLUMN "public"."role_permission"."role_id" IS 'รหัส Role (FK → master_system_role.role_id)';



COMMENT ON COLUMN "public"."role_permission"."module_id" IS 'รหัสโมดูล (FK → master_permission_module.module_id)';



COMMENT ON COLUMN "public"."role_permission"."can_view" IS 'สิทธิ์ดู';



COMMENT ON COLUMN "public"."role_permission"."can_create" IS 'สิทธิ์เพิ่มข้อมูล';



COMMENT ON COLUMN "public"."role_permission"."can_edit" IS 'สิทธิ์แก้ไข';



COMMENT ON COLUMN "public"."role_permission"."can_delete" IS 'สิทธิ์ลบ';



COMMENT ON COLUMN "public"."role_permission"."can_approve" IS 'สิทธิ์อนุมัติ';



COMMENT ON COLUMN "public"."role_permission"."created_by" IS 'ใครสร้าง';



COMMENT ON COLUMN "public"."role_permission"."created_at" IS 'วันที่สร้าง';



COMMENT ON COLUMN "public"."role_permission"."updated_at" IS 'วันที่แก้ไขล่าสุด';



CREATE TABLE IF NOT EXISTS "public"."sku_incompatibilities" (
    "sku_id" character varying(50) NOT NULL,
    "incompatible_sku_id" character varying(50) NOT NULL,
    "reason" "text",
    "created_by" character varying(100),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "sku_incompatibilities_check" CHECK ((("sku_id")::"text" <> ("incompatible_sku_id")::"text"))
);


ALTER TABLE "public"."sku_incompatibilities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sku_preparation_area_mapping" (
    "mapping_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sku_id" character varying(50) NOT NULL,
    "warehouse_id" character varying(50) NOT NULL,
    "preparation_area_id" "uuid" NOT NULL,
    "priority" smallint DEFAULT 50 NOT NULL,
    "is_primary" boolean DEFAULT false,
    "allowed_location_types" "text"[],
    "required_zone" character varying(50),
    "min_quantity" numeric(18,2),
    "max_quantity" numeric(18,2),
    "effective_from" "date" DEFAULT CURRENT_DATE,
    "effective_to" "date",
    "notes" "text",
    "created_by" character varying(100),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" character varying(100),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "chk_sku_preparation_area_mapping_dates" CHECK ((("effective_to" IS NULL) OR ("effective_to" >= "effective_from"))),
    CONSTRAINT "sku_preparation_area_mapping_priority_check" CHECK ((("priority" >= 1) AND ("priority" <= 999)))
);


ALTER TABLE "public"."sku_preparation_area_mapping" OWNER TO "postgres";


COMMENT ON TABLE "public"."sku_preparation_area_mapping" IS 'การกำหนดพื้นที่จัดเตรียมสินค้าสำหรับแต่ละ SKU';



COMMENT ON COLUMN "public"."sku_preparation_area_mapping"."allowed_location_types" IS 'ประเภทตำแหน่งที่อนุญาตให้หยิบ SKU นี้ได้';



COMMENT ON COLUMN "public"."sku_preparation_area_mapping"."required_zone" IS 'โซนที่ SKU นี้ต้องถูกหยิบมาจาก';



CREATE TABLE IF NOT EXISTS "public"."sku_storage_profile" (
    "sku_id" character varying(50) NOT NULL,
    "storage_class" character varying(50),
    "hazard_class" character varying(50),
    "temperature_min_c" numeric(5,2),
    "temperature_max_c" numeric(5,2),
    "humidity_min_percent" numeric(5,2),
    "humidity_max_percent" numeric(5,2),
    "max_stack_height" integer,
    "max_weight_per_stack_kg" numeric(10,2),
    "pallet_height_cm" numeric(8,2),
    "pallet_width_cm" numeric(8,2),
    "pallet_length_cm" numeric(8,2),
    "lot_mixing_policy" "public"."storage_mix_policy_enum" DEFAULT 'single_batch'::"public"."storage_mix_policy_enum",
    "expiry_mixing_policy" "public"."storage_mix_policy_enum" DEFAULT 'same_expiry'::"public"."storage_mix_policy_enum",
    "putaway_rotation" "public"."storage_rotation_method_enum",
    "prefer_full_pallet" boolean DEFAULT false,
    "notes" "text",
    "updated_by" character varying(100),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "chk_sku_storage_profile_humidity" CHECK ((("humidity_min_percent" IS NULL) OR ("humidity_max_percent" IS NULL) OR ("humidity_min_percent" <= "humidity_max_percent"))),
    CONSTRAINT "chk_sku_storage_profile_temp" CHECK ((("temperature_min_c" IS NULL) OR ("temperature_max_c" IS NULL) OR ("temperature_min_c" <= "temperature_max_c")))
);


ALTER TABLE "public"."sku_storage_profile" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_replenishment_alerts" (
    "alert_id" bigint NOT NULL,
    "alert_type" character varying(50) DEFAULT 'insufficient_stock'::character varying NOT NULL,
    "warehouse_id" character varying(50) NOT NULL,
    "location_id" character varying(50),
    "sku_id" character varying(100) NOT NULL,
    "required_qty" numeric(18,6) NOT NULL,
    "current_qty" numeric(18,6) NOT NULL,
    "shortage_qty" numeric(18,6) NOT NULL,
    "priority" character varying(20) DEFAULT 'medium'::character varying NOT NULL,
    "status" character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    "reference_no" character varying(100),
    "reference_doc_type" character varying(50),
    "resolved_at" timestamp with time zone,
    "resolved_by" "uuid",
    "resolution_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."stock_replenishment_alerts" OWNER TO "postgres";


COMMENT ON TABLE "public"."stock_replenishment_alerts" IS 'Tracks insufficient stock alerts during loading/picking operations';



CREATE SEQUENCE IF NOT EXISTS "public"."stock_replenishment_alerts_alert_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."stock_replenishment_alerts_alert_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."stock_replenishment_alerts_alert_id_seq" OWNED BY "public"."stock_replenishment_alerts"."alert_id";



CREATE TABLE IF NOT EXISTS "public"."storage_strategy" (
    "strategy_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "strategy_code" character varying(30) NOT NULL,
    "strategy_name" character varying(255) NOT NULL,
    "description" "text",
    "warehouse_id" character varying(50) NOT NULL,
    "default_zone" character varying(50),
    "default_location_type" character varying(20),
    "priority" smallint DEFAULT 50 NOT NULL,
    "status" "public"."storage_strategy_status_enum" DEFAULT 'draft'::"public"."storage_strategy_status_enum" NOT NULL,
    "putaway_rotation" "public"."storage_rotation_method_enum" DEFAULT 'FIFO'::"public"."storage_rotation_method_enum",
    "allow_auto_assign" boolean DEFAULT true,
    "effective_from" "date",
    "effective_to" "date",
    "created_by" character varying(100),
    "updated_by" character varying(100),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "storage_strategy_priority_check" CHECK ((("priority" >= 1) AND ("priority" <= 999)))
);


ALTER TABLE "public"."storage_strategy" OWNER TO "postgres";


COMMENT ON TABLE "public"."storage_strategy" IS 'กลยุทธ์การจัดเก็บสินค้าตามคลัง';



COMMENT ON COLUMN "public"."storage_strategy"."priority" IS 'ยิ่งค่าน้อยยิ่งถูกประเมินก่อน';



COMMENT ON COLUMN "public"."storage_strategy"."allow_auto_assign" IS 'true = ให้ระบบเสนออัตโนมัติ';



CREATE TABLE IF NOT EXISTS "public"."storage_strategy_conditions" (
    "condition_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "strategy_id" "uuid" NOT NULL,
    "condition_type" "public"."storage_condition_type_enum" NOT NULL,
    "condition_value" "text" NOT NULL,
    "priority" smallint DEFAULT 50,
    "notes" "text",
    "created_by" character varying(100),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "storage_strategy_conditions_priority_check" CHECK ((("priority" >= 1) AND ("priority" <= 999)))
);


ALTER TABLE "public"."storage_strategy_conditions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."storage_strategy_scope" (
    "scope_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "strategy_id" "uuid" NOT NULL,
    "warehouse_id" character varying(50) NOT NULL,
    "scope_type" "public"."storage_scope_type_enum" NOT NULL,
    "group_id" "uuid",
    "zone" character varying(50),
    "aisle" character varying(50),
    "rack" character varying(50),
    "shelf" character varying(50),
    "bin" character varying(50),
    "location_type" character varying(20),
    "location_id" character varying(50),
    "allow_only_empty" boolean DEFAULT false,
    "allow_same_sku_only" boolean DEFAULT false,
    "allow_mixed_expiry" boolean,
    "allow_mixed_lot" boolean,
    "capacity_threshold_pct" numeric(5,2) DEFAULT 100,
    "max_open_pallets" integer,
    "priority" smallint DEFAULT 50,
    "remarks" "text",
    "created_by" character varying(100),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "storage_strategy_scope_capacity_threshold_pct_check" CHECK ((("capacity_threshold_pct" >= (0)::numeric) AND ("capacity_threshold_pct" <= (100)::numeric))),
    CONSTRAINT "storage_strategy_scope_priority_check" CHECK ((("priority" >= 1) AND ("priority" <= 999))),
    CONSTRAINT "storage_strategy_scope_target_ck" CHECK (((("scope_type" = 'all'::"public"."storage_scope_type_enum") AND ("group_id" IS NULL) AND ("zone" IS NULL) AND ("aisle" IS NULL) AND ("rack" IS NULL) AND ("shelf" IS NULL) AND ("bin" IS NULL) AND ("location_type" IS NULL) AND ("location_id" IS NULL)) OR (("scope_type" = 'zone'::"public"."storage_scope_type_enum") AND ("zone" IS NOT NULL)) OR (("scope_type" = 'location_type'::"public"."storage_scope_type_enum") AND ("location_type" IS NOT NULL)) OR (("scope_type" = 'aisle'::"public"."storage_scope_type_enum") AND ("aisle" IS NOT NULL)) OR (("scope_type" = 'rack'::"public"."storage_scope_type_enum") AND ("rack" IS NOT NULL)) OR (("scope_type" = 'shelf'::"public"."storage_scope_type_enum") AND ("shelf" IS NOT NULL)) OR (("scope_type" = 'bin'::"public"."storage_scope_type_enum") AND ("bin" IS NOT NULL)) OR (("scope_type" = 'group'::"public"."storage_scope_type_enum") AND ("group_id" IS NOT NULL)) OR (("scope_type" = 'location'::"public"."storage_scope_type_enum") AND ("location_id" IS NOT NULL))))
);


ALTER TABLE "public"."storage_strategy_scope" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."storage_strategy_sku_settings" (
    "strategy_id" "uuid" NOT NULL,
    "sku_id" character varying(50) NOT NULL,
    "priority" smallint DEFAULT 50,
    "is_primary" boolean DEFAULT false,
    "allow_mixed_expiry" boolean DEFAULT false,
    "allow_mixed_lot" boolean DEFAULT false,
    "allow_mixed_sku" boolean DEFAULT false,
    "max_locations" smallint,
    "min_remaining_shelf_life_days" integer,
    "max_days_difference_expiry" integer,
    "preferred_putaway_qty" numeric(18,2),
    "notes" "text",
    "created_by" character varying(100),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "storage_strategy_sku_settings_priority_check" CHECK ((("priority" >= 1) AND ("priority" <= 999)))
);


ALTER TABLE "public"."storage_strategy_sku_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_role" (
    "user_id" bigint NOT NULL,
    "role_id" bigint NOT NULL,
    "created_by" bigint,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."user_role" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_role" IS 'ตารางเชื่อมโยงผู้ใช้กับ Role';



COMMENT ON COLUMN "public"."user_role"."user_id" IS 'รหัสผู้ใช้ (FK → master_system_user.user_id)';



COMMENT ON COLUMN "public"."user_role"."role_id" IS 'รหัส Role (FK → master_system_role.role_id)';



COMMENT ON COLUMN "public"."user_role"."created_by" IS 'ใครสร้าง';



COMMENT ON COLUMN "public"."user_role"."created_at" IS 'วันที่สร้าง';



CREATE OR REPLACE VIEW "public"."v_active_customer_no_price_goods" AS
 SELECT "record_id",
    "customer_id",
    "customer_name",
    "reason",
    "note_for_picking",
    "effective_start_date",
    "effective_end_date",
    "created_by",
    "created_at",
    "updated_at"
   FROM "public"."master_customer_no_price_goods"
  WHERE (("is_active" = true) AND (("effective_start_date" IS NULL) OR ("effective_start_date" <= CURRENT_DATE)) AND (("effective_end_date" IS NULL) OR ("effective_end_date" >= CURRENT_DATE)));


ALTER VIEW "public"."v_active_customer_no_price_goods" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_active_customer_no_price_goods" IS 'View of currently active customers who require products without price labels';



CREATE OR REPLACE VIEW "public"."v_active_promotion_freebies" AS
 SELECT "pf"."id",
    "pf"."product_barcode",
    COALESCE("p"."product_name", "pf"."product_name") AS "product_name",
    "pf"."freebie_name",
    "pf"."freebie_description",
    "pf"."display_name",
    "pf"."random_freebie",
    "pf"."freebie_skus",
    "pf"."created_at",
    "pf"."updated_at"
   FROM ("public"."packing_promotion_freebies" "pf"
     LEFT JOIN "public"."packing_products" "p" ON (("p"."barcode" = "pf"."product_barcode")))
  WHERE ("pf"."is_active" = true)
  ORDER BY "pf"."created_at" DESC;


ALTER VIEW "public"."v_active_promotion_freebies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wms_move_items" (
    "move_item_id" bigint NOT NULL,
    "move_id" bigint NOT NULL,
    "receive_item_id" bigint,
    "sku_id" character varying(50) NOT NULL,
    "pallet_id" character varying(100),
    "pallet_id_external" character varying(100),
    "move_method" "public"."move_method_enum" DEFAULT 'sku'::"public"."move_method_enum" NOT NULL,
    "status" "public"."move_item_status_enum" DEFAULT 'pending'::"public"."move_item_status_enum" NOT NULL,
    "from_location_id" character varying(50),
    "to_location_id" character varying(50),
    "requested_pack_qty" numeric(18,2) DEFAULT 0,
    "requested_piece_qty" numeric(18,2) DEFAULT 0,
    "confirmed_pack_qty" numeric(18,2) DEFAULT 0,
    "confirmed_piece_qty" numeric(18,2) DEFAULT 0,
    "production_date" "date",
    "expiry_date" "date",
    "remarks" "text",
    "created_by" bigint,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "assigned_to" bigint,
    "pallet_scanned_at" timestamp with time zone,
    "location_scanned_at" timestamp with time zone,
    "executed_by" bigint,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "assignment_type" "public"."assignment_type_enum" DEFAULT 'individual'::"public"."assignment_type_enum",
    "assigned_role" "public"."wms_role_enum",
    "assignment_details" json,
    "planned_pack_qty" integer DEFAULT 0,
    "planned_piece_qty" integer DEFAULT 0,
    "parent_pallet_id" "text",
    "new_pallet_id" "text",
    CONSTRAINT "chk_move_items_confirmed_pack_qty" CHECK (("confirmed_pack_qty" >= (0)::numeric)),
    CONSTRAINT "chk_move_items_confirmed_piece_qty" CHECK (("confirmed_piece_qty" >= (0)::numeric)),
    CONSTRAINT "chk_move_items_requested_pack_qty" CHECK (("requested_pack_qty" >= (0)::numeric)),
    CONSTRAINT "chk_move_items_requested_piece_qty" CHECK (("requested_piece_qty" >= (0)::numeric))
);


ALTER TABLE "public"."wms_move_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."wms_move_items" IS 'รายละเอียดรายการสินค้าที่ต้องย้ายในแต่ละใบงาน';



COMMENT ON COLUMN "public"."wms_move_items"."move_id" IS 'FK → wms_moves.move_id';



COMMENT ON COLUMN "public"."wms_move_items"."receive_item_id" IS 'เชื่อมไปยังรายการรับสินค้า (ถ้ามาจากใบรับ)';



COMMENT ON COLUMN "public"."wms_move_items"."sku_id" IS 'รหัส SKU ที่จะย้าย';



COMMENT ON COLUMN "public"."wms_move_items"."pallet_id" IS 'หมายเลขพาเลทภายในคลัง';



COMMENT ON COLUMN "public"."wms_move_items"."pallet_id_external" IS 'หมายเลขพาเลทจากภายนอก (ถ้ามี)';



COMMENT ON COLUMN "public"."wms_move_items"."move_method" IS 'วิธีการย้าย (ทั้งพาเลท หรือย้ายตามจำนวน SKU)';



COMMENT ON COLUMN "public"."wms_move_items"."status" IS 'สถานะของรายการย่อย';



COMMENT ON COLUMN "public"."wms_move_items"."from_location_id" IS 'ตำแหน่งจัดเก็บต้นทาง';



COMMENT ON COLUMN "public"."wms_move_items"."to_location_id" IS 'ตำแหน่งจัดเก็บปลายทาง';



COMMENT ON COLUMN "public"."wms_move_items"."requested_pack_qty" IS 'จำนวนแพ็คที่ร้องขอย้าย';



COMMENT ON COLUMN "public"."wms_move_items"."requested_piece_qty" IS 'จำนวนชิ้นที่ร้องขอย้าย';



COMMENT ON COLUMN "public"."wms_move_items"."confirmed_pack_qty" IS 'จำนวนแพ็คที่ย้ายจริง';



COMMENT ON COLUMN "public"."wms_move_items"."confirmed_piece_qty" IS 'จำนวนชิ้นที่ย้ายจริง';



COMMENT ON COLUMN "public"."wms_move_items"."production_date" IS 'วันที่ผลิต (ถ้ามี)';



COMMENT ON COLUMN "public"."wms_move_items"."expiry_date" IS 'วันหมดอายุ (ถ้ามี)';



COMMENT ON COLUMN "public"."wms_move_items"."remarks" IS 'หมายเหตุเพิ่มเติม';



COMMENT ON COLUMN "public"."wms_move_items"."created_by" IS 'พนักงานที่สร้างรายการย้าย';



COMMENT ON COLUMN "public"."wms_move_items"."assigned_to" IS 'พนักงานที่ได้รับมอบหมายให้ทำงานรายการนี้';



COMMENT ON COLUMN "public"."wms_move_items"."pallet_scanned_at" IS 'เวลาที่สแกนพาเลทเพื่อยืนยันการย้าย';



COMMENT ON COLUMN "public"."wms_move_items"."location_scanned_at" IS 'เวลาที่สแกนโลเคชั่นปลายทางเพื่อยืนยันการเก็บ';



COMMENT ON COLUMN "public"."wms_move_items"."executed_by" IS 'พนักงานที่ปฏิบัติงานจริง (อาจแตกต่างจาก assigned_to)';



COMMENT ON COLUMN "public"."wms_move_items"."started_at" IS 'เวลาเริ่มปฏิบัติงานรายการนี้';



COMMENT ON COLUMN "public"."wms_move_items"."completed_at" IS 'เวลาเสร็จสิ้นงานรายการนี้';



COMMENT ON COLUMN "public"."wms_move_items"."assignment_type" IS 'ประเภทการมอบหมาย: individual=เจาะจงคน, role=ตาม Role, mixed=ผสม';



COMMENT ON COLUMN "public"."wms_move_items"."assigned_role" IS 'Role ที่ต้องการ เช่น forklift, picker, driver (ใช้เมื่อ assignment_type = role หรือ mixed)';



COMMENT ON COLUMN "public"."wms_move_items"."assignment_details" IS 'รายละเอียดการมอบหมายเพิ่มเติม (JSON format)';



COMMENT ON COLUMN "public"."wms_move_items"."planned_pack_qty" IS 'จำนวนแพ็คที่วางแผนจะย้าย (Planned pack quantity to move)';



COMMENT ON COLUMN "public"."wms_move_items"."planned_piece_qty" IS 'จำนวนชิ้นที่วางแผนจะย้าย (Planned piece quantity to move)';



COMMENT ON COLUMN "public"."wms_move_items"."parent_pallet_id" IS 'Original pallet ID when this item was split from a larger pallet during partial move';



COMMENT ON COLUMN "public"."wms_move_items"."new_pallet_id" IS 'Newly generated pallet ID when splitting a pallet for partial move';



CREATE OR REPLACE VIEW "public"."v_move_item_assignments" AS
 SELECT "mi"."move_item_id",
    "mi"."move_id",
    "mi"."assignment_type",
    "mi"."assigned_to",
    "mi"."assigned_role",
    "mi"."assignment_details",
    "mi"."status",
    "e_assigned"."employee_code" AS "assigned_employee_code",
    "e_assigned"."first_name" AS "assigned_first_name",
    "e_assigned"."last_name" AS "assigned_last_name",
    "e_assigned"."wms_role" AS "assigned_employee_role",
    "e_executed"."employee_code" AS "executed_employee_code",
    "e_executed"."first_name" AS "executed_first_name",
    "e_executed"."last_name" AS "executed_last_name",
    "ms"."sku_name",
    "loc_from"."location_name" AS "from_location_name",
    "loc_to"."location_name" AS "to_location_name",
    "mi"."requested_piece_qty",
    "mi"."confirmed_piece_qty",
    "mi"."started_at",
    "mi"."completed_at",
    "mi"."created_at",
    "mi"."updated_at"
   FROM ((((("public"."wms_move_items" "mi"
     LEFT JOIN "public"."master_employee" "e_assigned" ON (("mi"."assigned_to" = "e_assigned"."employee_id")))
     LEFT JOIN "public"."master_employee" "e_executed" ON (("mi"."executed_by" = "e_executed"."employee_id")))
     LEFT JOIN "public"."master_sku" "ms" ON ((("mi"."sku_id")::"text" = ("ms"."sku_id")::"text")))
     LEFT JOIN "public"."master_location" "loc_from" ON ((("mi"."from_location_id")::"text" = ("loc_from"."location_id")::"text")))
     LEFT JOIN "public"."master_location" "loc_to" ON ((("mi"."to_location_id")::"text" = ("loc_to"."location_id")::"text")));


ALTER VIEW "public"."v_move_item_assignments" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_move_item_assignments" IS 'View แสดงการมอบหมายงานแบบรวม รองรับทั้งการมอบหมายเจาะจงและตาม Role';



CREATE OR REPLACE VIEW "public"."v_packing_box_usage_stats" AS
 SELECT "b"."box_code",
    "b"."box_name",
    "count"("ph"."id") AS "total_uses",
    "avg"("ph"."efficiency_score") AS "avg_efficiency",
    "sum"(
        CASE
            WHEN ("ph"."packed_at" >= CURRENT_DATE) THEN 1
            ELSE 0
        END) AS "uses_today",
    "sum"(
        CASE
            WHEN ("ph"."packed_at" >= (CURRENT_DATE - '7 days'::interval)) THEN 1
            ELSE 0
        END) AS "uses_this_week",
    "sum"(
        CASE
            WHEN ("ph"."packed_at" >= "date_trunc"('month'::"text", (CURRENT_DATE)::timestamp with time zone)) THEN 1
            ELSE 0
        END) AS "uses_this_month"
   FROM ("public"."packing_boxes" "b"
     LEFT JOIN "public"."packing_history" "ph" ON (("b"."id" = "ph"."box_id")))
  WHERE ("b"."is_active" = true)
  GROUP BY "b"."id", "b"."box_code", "b"."box_name"
  ORDER BY ("count"("ph"."id")) DESC;


ALTER VIEW "public"."v_packing_box_usage_stats" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_packing_user_performance" AS
 SELECT "packed_by",
    "count"("id") AS "total_packs",
    "avg"("pack_duration") AS "avg_pack_duration",
    "avg"("efficiency_score") AS "avg_efficiency",
    "sum"(
        CASE
            WHEN ("packed_at" >= CURRENT_DATE) THEN 1
            ELSE 0
        END) AS "packs_today",
    "max"("packed_at") AS "last_pack_time"
   FROM "public"."packing_history" "ph"
  WHERE ("packed_by" IS NOT NULL)
  GROUP BY "packed_by"
  ORDER BY ("count"("id")) DESC;


ALTER VIEW "public"."v_packing_user_performance" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_receiving_route_stop_overview" AS
 SELECT "s"."stop_id",
    "s"."trip_id",
    "s"."plan_id",
    "p"."plan_code",
    "t"."trip_code",
    "s"."sequence_no",
    "s"."stop_type",
    "s"."status",
    "s"."stop_name",
    "s"."address",
    "s"."latitude",
    "s"."longitude",
    "s"."time_window_start",
    "s"."time_window_end",
    "s"."planned_arrival_at",
    "s"."planned_departure_at",
    "s"."actual_arrival_at",
    "s"."actual_departure_at",
    "s"."travel_minutes_from_prev",
    "s"."service_duration_minutes",
    "s"."wait_minutes",
    "s"."load_weight_kg",
    "s"."load_volume_cbm",
    "s"."load_pallets",
    "s"."load_units",
    "s"."is_break",
    "s"."is_last_stop",
    "s"."exception_reason",
    "s"."proof_document_urls",
    "s"."proof_signature_name",
    "supplier"."supplier_name",
    "supplier"."phone" AS "supplier_phone",
    "supplier"."product_category",
    "wh"."warehouse_name" AS "stop_warehouse",
    "loc"."location_name" AS "stop_location"
   FROM ((((("public"."receiving_route_stops" "s"
     JOIN "public"."receiving_route_trips" "t" ON (("t"."trip_id" = "s"."trip_id")))
     JOIN "public"."receiving_route_plans" "p" ON (("p"."plan_id" = "s"."plan_id")))
     LEFT JOIN "public"."master_supplier" "supplier" ON ((("supplier"."supplier_id")::"text" = ("s"."supplier_id")::"text")))
     LEFT JOIN "public"."master_warehouse" "wh" ON ((("wh"."warehouse_id")::"text" = ("s"."warehouse_id")::"text")))
     LEFT JOIN "public"."master_location" "loc" ON ((("loc"."location_id")::"text" = ("s"."location_id")::"text")));


ALTER VIEW "public"."v_receiving_route_stop_overview" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_receiving_route_stop_overview" IS 'มุมมองรวมจุดแวะของเส้นทางรับสินค้า พร้อมข้อมูลซัพพลายเออร์และสถานะล่าสุด';



CREATE OR REPLACE VIEW "public"."v_receiving_route_trip_overview" AS
 SELECT "p"."plan_id",
    "p"."plan_code",
    "p"."plan_date",
    "p"."status" AS "plan_status",
    "t"."trip_id",
    "t"."trip_code",
    "t"."trip_status",
    "t"."trip_sequence",
    "t"."total_stops",
    "t"."total_distance_km",
    "t"."total_drive_minutes",
    "t"."total_service_minutes",
    "t"."total_weight_kg",
    "t"."total_volume_cbm",
    "t"."total_pallets",
    "t"."vehicle_id",
    "mv"."vehicle_code",
    "mv"."vehicle_type",
    "t"."driver_id",
    "driver"."first_name" AS "driver_first_name",
    "driver"."last_name" AS "driver_last_name",
    "t"."helper_id",
    "helper"."first_name" AS "helper_first_name",
    "helper"."last_name" AS "helper_last_name",
    "t"."scheduled_departure_at",
    "t"."scheduled_return_at",
    "t"."actual_departure_at",
    "t"."actual_return_at",
    "t"."capacity_utilization",
    "t"."fuel_cost_estimate",
    "t"."labor_cost_estimate",
    "t"."cost_breakdown"
   FROM (((("public"."receiving_route_trips" "t"
     JOIN "public"."receiving_route_plans" "p" ON (("p"."plan_id" = "t"."plan_id")))
     LEFT JOIN "public"."master_vehicle" "mv" ON (("mv"."vehicle_id" = "t"."vehicle_id")))
     LEFT JOIN "public"."master_employee" "driver" ON (("driver"."employee_id" = "t"."driver_id")))
     LEFT JOIN "public"."master_employee" "helper" ON (("helper"."employee_id" = "t"."helper_id")));


ALTER VIEW "public"."v_receiving_route_trip_overview" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_receiving_route_trip_overview" IS 'มุมมองสรุปเส้นทางรับสินค้า เชื่อมข้อมูลแผน รถ พนักงาน และตัวชี้วัดหลัก';



CREATE OR REPLACE VIEW "public"."v_reservation_accuracy" AS
 SELECT "pi"."picklist_id",
    "pi"."id" AS "picklist_item_id",
    "pi"."sku_id",
    "pi"."quantity_to_pick",
    COALESCE("sum"("r"."reserved_piece_qty"), (0)::numeric) AS "total_reserved",
    ("pi"."quantity_to_pick" - COALESCE("sum"("r"."reserved_piece_qty"), (0)::numeric)) AS "reservation_variance",
    "count"("r"."reservation_id") AS "reservation_count",
        CASE
            WHEN ("abs"(("pi"."quantity_to_pick" - COALESCE("sum"("r"."reserved_piece_qty"), (0)::numeric))) < 0.01) THEN 'accurate'::"text"
            ELSE 'mismatch'::"text"
        END AS "accuracy_status"
   FROM ("public"."picklist_items" "pi"
     LEFT JOIN "public"."picklist_item_reservations" "r" ON (("pi"."id" = "r"."picklist_item_id")))
  GROUP BY "pi"."picklist_id", "pi"."id", "pi"."sku_id", "pi"."quantity_to_pick";


ALTER VIEW "public"."v_reservation_accuracy" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_stock_alert_summary" AS
 SELECT "location_id",
    "sku_id",
    "count"(*) AS "alert_count",
    "sum"("shortage_qty") AS "total_shortage",
    "max"("created_at") AS "last_alert_at",
    "count"(
        CASE
            WHEN (("status")::"text" = 'pending'::"text") THEN 1
            ELSE NULL::integer
        END) AS "pending_count",
    "count"(
        CASE
            WHEN (("priority")::"text" = 'urgent'::"text") THEN 1
            ELSE NULL::integer
        END) AS "urgent_count"
   FROM "public"."stock_replenishment_alerts"
  WHERE (("status")::"text" = ANY ((ARRAY['pending'::character varying, 'acknowledged'::character varying])::"text"[]))
  GROUP BY "location_id", "sku_id"
 HAVING ("count"(
        CASE
            WHEN (("status")::"text" = 'pending'::"text") THEN 1
            ELSE NULL::integer
        END) > 0);


ALTER VIEW "public"."v_stock_alert_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wms_loadlist_picklists" (
    "id" bigint NOT NULL,
    "loadlist_id" bigint NOT NULL,
    "picklist_id" bigint NOT NULL,
    "sequence" integer DEFAULT 1,
    "loaded_at" timestamp with time zone,
    "loaded_by_employee_id" bigint,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "wms_loadlist_picklists_sequence_check" CHECK (("sequence" > 0))
);


ALTER TABLE "public"."wms_loadlist_picklists" OWNER TO "postgres";


COMMENT ON TABLE "public"."wms_loadlist_picklists" IS 'ตารางเชื่อมระหว่าง loadlists และ picklists (junction table)';



COMMENT ON COLUMN "public"."wms_loadlist_picklists"."loadlist_id" IS 'รหัส loadlist (FK to loadlists.id)';



COMMENT ON COLUMN "public"."wms_loadlist_picklists"."picklist_id" IS 'รหัส picklist (FK to picklists.id)';



COMMENT ON COLUMN "public"."wms_loadlist_picklists"."sequence" IS 'ลำดับการโหลด picklist นี้ในใบโหลด';



COMMENT ON COLUMN "public"."wms_loadlist_picklists"."loaded_at" IS 'วันเวลาที่โหลดเสร็จ';



COMMENT ON COLUMN "public"."wms_loadlist_picklists"."loaded_by_employee_id" IS 'พนักงานที่โหลด (FK to master_employee)';



CREATE TABLE IF NOT EXISTS "public"."wms_orders" (
    "order_id" bigint NOT NULL,
    "order_no" character varying(100) NOT NULL,
    "order_type" "public"."order_type_enum" NOT NULL,
    "order_date" "date" NOT NULL,
    "sequence_no" character varying(50),
    "warehouse_id" character varying(50) NOT NULL,
    "customer_id" character varying(50) NOT NULL,
    "shop_name" character varying(255),
    "province" character varying(100),
    "phone" character varying(50),
    "payment_type" "public"."payment_type_enum" NOT NULL,
    "pickup_datetime" timestamp with time zone,
    "delivery_date" "date",
    "total_items" integer DEFAULT 0,
    "total_qty" numeric(15,3) DEFAULT 0,
    "total_weight" numeric(15,3) DEFAULT 0,
    "total_pack_all" integer DEFAULT 0,
    "pack_12_bags" integer DEFAULT 0,
    "pack_4" integer DEFAULT 0,
    "pack_6" integer DEFAULT 0,
    "pack_2" integer DEFAULT 0,
    "pack_1" integer DEFAULT 0,
    "text_field_long_1" "text",
    "text_field_additional_1" character varying(500),
    "text_field_additional_4" character varying(500),
    "notes" "text",
    "notes_additional" "text",
    "status" "public"."order_status_enum" DEFAULT 'draft'::"public"."order_status_enum",
    "import_file_name" character varying(255),
    "import_file_type" character varying(50),
    "imported_by" bigint,
    "imported_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "matched_trip_id" bigint,
    "auto_matched_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone,
    "delivery_type" "public"."delivery_type_enum" DEFAULT 'normal'::"public"."delivery_type_enum",
    "sales_territory" character varying(100)
);


ALTER TABLE "public"."wms_orders" OWNER TO "postgres";


COMMENT ON TABLE "public"."wms_orders" IS 'ตารางหลักสำหรับคำสั่งขาย รองรับทั้งประเภทต้องจัดสายรถ และประเภทส่งด่วน';



COMMENT ON COLUMN "public"."wms_orders"."order_id" IS 'รหัสคำสั่งขาย (Auto Increment Primary Key)';



COMMENT ON COLUMN "public"."wms_orders"."order_no" IS 'เลขที่ใบสั่งส่ง/เลขที่ใบขาย';



COMMENT ON COLUMN "public"."wms_orders"."order_type" IS 'ประเภทคำสั่งขาย (route_planning = ต้องจัดสายรถ, express = ส่งด่วน)';



COMMENT ON COLUMN "public"."wms_orders"."order_date" IS 'วันที่';



COMMENT ON COLUMN "public"."wms_orders"."sequence_no" IS 'วันที่-ลำดับ (สำหรับประเภท express)';



COMMENT ON COLUMN "public"."wms_orders"."warehouse_id" IS 'คลัง (FK → master_warehouse.warehouse_id)';



COMMENT ON COLUMN "public"."wms_orders"."customer_id" IS 'รหัสลูกค้า/ผู้ขาย (FK → master_customer.customer_id)';



COMMENT ON COLUMN "public"."wms_orders"."shop_name" IS 'ชื่อร้านค้า';



COMMENT ON COLUMN "public"."wms_orders"."province" IS 'จังหวัด';



COMMENT ON COLUMN "public"."wms_orders"."phone" IS 'โทรศัพท์ (สำหรับประเภท express)';



COMMENT ON COLUMN "public"."wms_orders"."payment_type" IS 'เครดิต/เงินสด';



COMMENT ON COLUMN "public"."wms_orders"."pickup_datetime" IS 'วัน เวลารับสินค้า';



COMMENT ON COLUMN "public"."wms_orders"."delivery_date" IS 'วันส่งของ';



COMMENT ON COLUMN "public"."wms_orders"."total_items" IS 'จำนวนรายการทั้งหมด';



COMMENT ON COLUMN "public"."wms_orders"."total_qty" IS 'จำนวนรวม';



COMMENT ON COLUMN "public"."wms_orders"."total_weight" IS 'น้ำหนักรวม';



COMMENT ON COLUMN "public"."wms_orders"."total_pack_all" IS 'จำนวนแพ็ครวม/แพ็ครวม';



COMMENT ON COLUMN "public"."wms_orders"."pack_12_bags" IS 'แพ็ค 12 ถุง';



COMMENT ON COLUMN "public"."wms_orders"."pack_4" IS 'แพ็ค 4';



COMMENT ON COLUMN "public"."wms_orders"."pack_6" IS 'แพ็ค 6';



COMMENT ON COLUMN "public"."wms_orders"."pack_2" IS 'แพ็ค 2';



COMMENT ON COLUMN "public"."wms_orders"."pack_1" IS 'แพ็ค 1';



COMMENT ON COLUMN "public"."wms_orders"."text_field_long_1" IS 'ประเภทข้อความแบบยาว 1';



COMMENT ON COLUMN "public"."wms_orders"."text_field_additional_1" IS 'ข้อความเพิ่มเติม 1';



COMMENT ON COLUMN "public"."wms_orders"."text_field_additional_4" IS 'ประเภทข้อความเพิ่มเติม 4';



COMMENT ON COLUMN "public"."wms_orders"."notes" IS 'หมายเหตุ';



COMMENT ON COLUMN "public"."wms_orders"."notes_additional" IS 'หมายเหตุ (เพิ่มเติม)';



COMMENT ON COLUMN "public"."wms_orders"."status" IS 'สถานะคำสั่งขาย';



COMMENT ON COLUMN "public"."wms_orders"."import_file_name" IS 'ชื่อไฟล์ที่นำเข้า';



COMMENT ON COLUMN "public"."wms_orders"."import_file_type" IS 'ประเภทไฟล์ที่นำเข้า';



COMMENT ON COLUMN "public"."wms_orders"."imported_by" IS 'ผู้นำเข้าข้อมูล (FK → master_employee.employee_id)';



COMMENT ON COLUMN "public"."wms_orders"."imported_at" IS 'วันเวลาที่นำเข้า';



COMMENT ON COLUMN "public"."wms_orders"."matched_trip_id" IS 'FK อ้างอิงถึงเที่ยวรถที่แมพกับออเดอร์พิเศษ (สำหรับ order_type = special)';



COMMENT ON COLUMN "public"."wms_orders"."auto_matched_at" IS 'วันเวลาที่ match อัตโนมัติกับเที่ยวรถ';



COMMENT ON COLUMN "public"."wms_orders"."confirmed_at" IS 'วันเวลาที่ออเดอร์ถูกยืนยัน (เมื่อสร้าง picklist หรือยืนยันออเดอร์)';



COMMENT ON COLUMN "public"."wms_orders"."delivery_type" IS 'ประเภทการจัดส่ง (ธรรมดา, Express, EMS, Kerry, Flash Express, J&T, DHL, อื่นๆ)';



COMMENT ON COLUMN "public"."wms_orders"."sales_territory" IS 'เขตการขาย (สำหรับแสดง watermark บนใบปะหน้า)';



CREATE OR REPLACE VIEW "public"."v_workflow_status_overview" AS
 SELECT "rp"."plan_id" AS "route_plan_id",
    "rp"."plan_code",
    "rp"."status" AS "route_status",
    "count"(DISTINCT "p"."id") AS "total_picklists",
    "count"(DISTINCT
        CASE
            WHEN ("p"."status" = 'completed'::"public"."picklist_status_enum") THEN "p"."id"
            ELSE NULL::bigint
        END) AS "completed_picklists",
    "count"(DISTINCT "l"."id") AS "total_loadlists",
    "count"(DISTINCT
        CASE
            WHEN ("l"."status" = 'loaded'::"public"."loadlist_status_enum") THEN "l"."id"
            ELSE NULL::bigint
        END) AS "loaded_loadlists",
    "count"(DISTINCT "rpi"."order_id") AS "total_orders",
    "count"(DISTINCT
        CASE
            WHEN ("o"."status" = 'delivered'::"public"."order_status_enum") THEN "rpi"."order_id"
            ELSE NULL::bigint
        END) AS "delivered_orders"
   FROM ((((("public"."receiving_route_plans" "rp"
     LEFT JOIN "public"."picklists" "p" ON (("p"."plan_id" = "rp"."plan_id")))
     LEFT JOIN "public"."wms_loadlist_picklists" "lp" ON (("lp"."picklist_id" = "p"."id")))
     LEFT JOIN "public"."loadlists" "l" ON (("l"."id" = "lp"."loadlist_id")))
     LEFT JOIN "public"."receiving_route_plan_inputs" "rpi" ON (("rpi"."plan_id" = "rp"."plan_id")))
     LEFT JOIN "public"."wms_orders" "o" ON (("o"."order_id" = "rpi"."order_id")))
  WHERE ("rp"."status" <> ALL (ARRAY['draft'::"public"."receiving_route_plan_status_enum", 'cancelled'::"public"."receiving_route_plan_status_enum"]))
  GROUP BY "rp"."plan_id", "rp"."plan_code", "rp"."status";


ALTER VIEW "public"."v_workflow_status_overview" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wms_stock_replenishment_alerts" (
    "alert_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "warehouse_id" character varying(50) NOT NULL,
    "sku_id" character varying(50) NOT NULL,
    "pick_location_id" character varying(50) NOT NULL,
    "required_qty" numeric(18,2) NOT NULL,
    "current_qty" numeric(18,2) NOT NULL,
    "shortage_qty" numeric(18,2) NOT NULL,
    "pallets_needed" integer NOT NULL,
    "min_stock_qty" numeric(18,2),
    "max_stock_qty" numeric(18,2),
    "replen_qty" numeric(18,2),
    "suggested_sources" "jsonb",
    "alert_reason" "text",
    "picklist_id" bigint,
    "priority" integer DEFAULT 5,
    "status" "public"."stock_alert_status_enum" DEFAULT 'pending'::"public"."stock_alert_status_enum" NOT NULL,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" character varying(100),
    "resolved_at" timestamp without time zone,
    "resolved_by" character varying(100),
    "notes" "text",
    CONSTRAINT "wms_stock_replenishment_alerts_pallets_check" CHECK (("pallets_needed" > 0)),
    CONSTRAINT "wms_stock_replenishment_alerts_shortage_check" CHECK (("shortage_qty" > (0)::numeric))
);


ALTER TABLE "public"."wms_stock_replenishment_alerts" OWNER TO "postgres";


COMMENT ON TABLE "public"."wms_stock_replenishment_alerts" IS 'ตารางแจ้งเตือนการเติมสต็อกในพื้นที่หยิบสินค้า';



COMMENT ON COLUMN "public"."wms_stock_replenishment_alerts"."alert_id" IS 'รหัสการแจ้งเตือน (UUID)';



COMMENT ON COLUMN "public"."wms_stock_replenishment_alerts"."pick_location_id" IS 'โลเคชั่นที่ต้องการเติมสต็อก (source_location_id from picklist)';



COMMENT ON COLUMN "public"."wms_stock_replenishment_alerts"."required_qty" IS 'ปริมาณที่ต้องการรวม (reserved + min threshold)';



COMMENT ON COLUMN "public"."wms_stock_replenishment_alerts"."shortage_qty" IS 'ปริมาณที่ขาด (required - current)';



COMMENT ON COLUMN "public"."wms_stock_replenishment_alerts"."pallets_needed" IS 'จำนวนพาเลทที่ต้องการ (คำนวณจาก qty_per_pallet)';



COMMENT ON COLUMN "public"."wms_stock_replenishment_alerts"."suggested_sources" IS 'แนะนำแหล่งที่มาของสต็อก (FEFO order) ในรูปแบบ JSON';



COMMENT ON COLUMN "public"."wms_stock_replenishment_alerts"."priority" IS 'ลำดับความสำคัญ 1-10 (10 = urgent)';



CREATE OR REPLACE VIEW "public"."vw_active_stock_alerts" AS
 SELECT "a"."alert_id",
    "a"."warehouse_id",
    "w"."warehouse_name",
    "a"."sku_id",
    "s"."sku_name",
    "s"."sku_id" AS "sku_code",
    "s"."uom_base",
    "s"."qty_per_pallet",
    "a"."pick_location_id",
    "l"."location_code" AS "pick_location_code",
    "l"."location_name" AS "pick_location_name",
    "a"."required_qty",
    "a"."current_qty",
    "a"."shortage_qty",
    "a"."pallets_needed",
    "a"."min_stock_qty",
    "a"."max_stock_qty",
    "a"."replen_qty",
    "a"."suggested_sources",
    "a"."alert_reason",
    "a"."picklist_id",
    "p"."picklist_code",
    "a"."priority",
    "a"."status",
    "a"."created_at",
    "a"."created_by",
    "a"."notes",
    (EXTRACT(epoch FROM (CURRENT_TIMESTAMP - ("a"."created_at")::timestamp with time zone)) / (3600)::numeric) AS "hours_since_alert"
   FROM (((("public"."wms_stock_replenishment_alerts" "a"
     LEFT JOIN "public"."master_warehouse" "w" ON ((("a"."warehouse_id")::"text" = ("w"."warehouse_id")::"text")))
     LEFT JOIN "public"."master_sku" "s" ON ((("a"."sku_id")::"text" = ("s"."sku_id")::"text")))
     LEFT JOIN "public"."master_location" "l" ON ((("a"."pick_location_id")::"text" = ("l"."location_id")::"text")))
     LEFT JOIN "public"."picklists" "p" ON (("a"."picklist_id" = "p"."id")))
  WHERE ("a"."status" = ANY (ARRAY['pending'::"public"."stock_alert_status_enum", 'in_progress'::"public"."stock_alert_status_enum"]))
  ORDER BY "a"."priority" DESC, "a"."created_at";


ALTER VIEW "public"."vw_active_stock_alerts" OWNER TO "postgres";


COMMENT ON VIEW "public"."vw_active_stock_alerts" IS 'วิวแสดงการแจ้งเตือนที่ยังไม่เสร็จ พร้อมข้อมูลเต็มสำหรับหน้า /mobile/transfer';



CREATE TABLE IF NOT EXISTS "public"."wms_inventory_balances" (
    "balance_id" bigint NOT NULL,
    "warehouse_id" character varying(50) NOT NULL,
    "location_id" character varying(50),
    "sku_id" character varying(50) NOT NULL,
    "pallet_id" character varying(100),
    "pallet_id_external" character varying(100),
    "production_date" "date",
    "expiry_date" "date",
    "total_pack_qty" numeric(18,2) DEFAULT 0 NOT NULL,
    "total_piece_qty" numeric(18,2) DEFAULT 0 NOT NULL,
    "reserved_pack_qty" numeric(18,2) DEFAULT 0 NOT NULL,
    "reserved_piece_qty" numeric(18,2) DEFAULT 0 NOT NULL,
    "last_move_id" bigint,
    "last_movement_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "lot_no" character varying(100),
    CONSTRAINT "chk_inventory_balances_reserved_pack_qty" CHECK (("reserved_pack_qty" >= (0)::numeric)),
    CONSTRAINT "chk_inventory_balances_reserved_piece_qty" CHECK (("reserved_piece_qty" >= (0)::numeric)),
    CONSTRAINT "chk_inventory_balances_total_pack_qty" CHECK (("total_pack_qty" >= (0)::numeric)),
    CONSTRAINT "chk_inventory_balances_total_piece_qty" CHECK (("total_piece_qty" >= (0)::numeric))
);


ALTER TABLE "public"."wms_inventory_balances" OWNER TO "postgres";


COMMENT ON TABLE "public"."wms_inventory_balances" IS 'Inventory balances by location, SKU, and lot. Updated by ledger triggers unless skip_balance_sync is true.';



COMMENT ON COLUMN "public"."wms_inventory_balances"."warehouse_id" IS 'คลังสินค้าที่เก็บสินค้า';



COMMENT ON COLUMN "public"."wms_inventory_balances"."location_id" IS 'ตำแหน่งจัดเก็บภายในคลัง';



COMMENT ON COLUMN "public"."wms_inventory_balances"."sku_id" IS 'รหัส SKU';



COMMENT ON COLUMN "public"."wms_inventory_balances"."pallet_id" IS 'หมายเลขพาเลท (ถ้ามี)';



COMMENT ON COLUMN "public"."wms_inventory_balances"."total_pack_qty" IS 'จำนวนคงเหลือหน่วยแพ็ค';



COMMENT ON COLUMN "public"."wms_inventory_balances"."total_piece_qty" IS 'จำนวนคงเหลือหน่วยชิ้น';



COMMENT ON COLUMN "public"."wms_inventory_balances"."reserved_pack_qty" IS 'ปริมาณที่ถูกกันไว้ (หน่วยแพ็ค)';



COMMENT ON COLUMN "public"."wms_inventory_balances"."reserved_piece_qty" IS 'ปริมาณที่ถูกกันไว้ (หน่วยชิ้น)';



COMMENT ON COLUMN "public"."wms_inventory_balances"."last_move_id" IS 'ใบงานย้ายสินค้าล่าสุดที่ปรับยอด';



CREATE OR REPLACE VIEW "public"."vw_location_inventory_summary" AS
 SELECT "ib"."warehouse_id",
    "ib"."location_id",
    "ml"."location_code",
    "ml"."location_name",
    "ml"."zone",
    "ml"."location_type",
    "sum"("ib"."total_pack_qty") AS "total_pack_qty",
    "sum"("ib"."total_piece_qty") AS "total_piece_qty",
    "sum"("ib"."reserved_pack_qty") AS "reserved_pack_qty",
    "sum"("ib"."reserved_piece_qty") AS "reserved_piece_qty",
    "count"(DISTINCT
        CASE
            WHEN (("ib"."total_pack_qty" > (0)::numeric) OR ("ib"."total_piece_qty" > (0)::numeric)) THEN "ib"."sku_id"
            ELSE NULL::character varying
        END) AS "active_sku_count",
    "min"(
        CASE
            WHEN (("ib"."total_pack_qty" > (0)::numeric) OR ("ib"."total_piece_qty" > (0)::numeric)) THEN "ib"."expiry_date"
            ELSE NULL::"date"
        END) AS "earliest_expiry",
    "max"(
        CASE
            WHEN (("ib"."total_pack_qty" > (0)::numeric) OR ("ib"."total_piece_qty" > (0)::numeric)) THEN "ib"."expiry_date"
            ELSE NULL::"date"
        END) AS "latest_expiry",
    "max"("ib"."last_movement_at") AS "last_movement_at"
   FROM ("public"."wms_inventory_balances" "ib"
     LEFT JOIN "public"."master_location" "ml" ON ((("ml"."location_id")::"text" = ("ib"."location_id")::"text")))
  GROUP BY "ib"."warehouse_id", "ib"."location_id", "ml"."location_code", "ml"."location_name", "ml"."zone", "ml"."location_type";


ALTER VIEW "public"."vw_location_inventory_summary" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_material_issue_history" AS
 SELECT "mi"."id",
    "mi"."production_order_id",
    "po"."production_no",
    "mi"."material_sku_id",
    "ms"."sku_name" AS "material_name",
    "mi"."issued_qty",
    "mi"."status",
    "wl"."location_code",
    "wl"."location_name",
    "me"."employee_code" AS "issued_by_name",
    "mi"."issued_at",
    "mi"."remarks"
   FROM (((("public"."material_issues" "mi"
     JOIN "public"."production_orders" "po" ON (("mi"."production_order_id" = "po"."id")))
     LEFT JOIN "public"."master_sku" "ms" ON ((("mi"."material_sku_id")::"text" = ("ms"."sku_id")::"text")))
     LEFT JOIN "public"."master_location" "wl" ON ((("mi"."issue_location_id")::"text" = ("wl"."location_id")::"text")))
     LEFT JOIN "public"."master_employee" "me" ON (("mi"."issued_by" = "me"."employee_id")))
  ORDER BY "mi"."issued_at" DESC;


ALTER VIEW "public"."vw_material_issue_history" OWNER TO "postgres";


COMMENT ON VIEW "public"."vw_material_issue_history" IS 'ประวัติการจ่ายวัตถุดิบทั้งหมด';



CREATE OR REPLACE VIEW "public"."vw_material_issue_summary" AS
 SELECT "mi"."id",
    "mi"."issue_no",
    "mi"."production_order_id",
    "po"."production_no",
    "mi"."issue_date",
    "mi"."status",
    "mi"."issued_by_name",
    "count"(DISTINCT "mii"."id") AS "total_items",
    "count"(DISTINCT "mii"."material_sku_id") AS "total_skus",
    COALESCE("sum"("mii"."issued_qty"), (0)::numeric) AS "total_issued_qty",
    COALESCE("sum"("mii"."returned_qty"), (0)::numeric) AS "total_returned_qty",
    COALESCE("sum"("mii"."net_qty"), (0)::numeric) AS "total_net_qty",
    "mi"."created_at"
   FROM (("public"."material_issues" "mi"
     LEFT JOIN "public"."production_orders" "po" ON (("mi"."production_order_id" = "po"."id")))
     LEFT JOIN "public"."material_issue_items" "mii" ON (("mi"."id" = "mii"."material_issue_id")))
  GROUP BY "mi"."id", "mi"."issue_no", "mi"."production_order_id", "po"."production_no", "mi"."issue_date", "mi"."status", "mi"."issued_by_name", "mi"."created_at";


ALTER VIEW "public"."vw_material_issue_summary" OWNER TO "postgres";


COMMENT ON VIEW "public"."vw_material_issue_summary" IS 'สรุปข้อมูลการเบิกวัตถุดิบ';



CREATE OR REPLACE VIEW "public"."vw_material_shortage_report" AS
 SELECT "mr"."requirement_id",
    "pp"."plan_no",
    "pp"."plan_name",
    "pp"."plan_start_date",
    "pp"."priority" AS "plan_priority",
    "mr"."material_sku_id",
    "ms"."sku_name" AS "material_name",
    "ms"."category" AS "material_category",
    "mr"."finished_sku_id",
    "fs"."sku_name" AS "finished_product_name",
    "mr"."gross_requirement",
    "mr"."current_stock",
    "mr"."allocated_stock",
    "mr"."available_stock",
    "mr"."shortage_qty",
    "mr"."suggested_order_qty",
    "mr"."supplier_id",
    "sup"."supplier_name",
    "mr"."lead_time_days",
    "mr"."required_date",
    "mr"."status",
    "mr"."po_no",
    "mr"."calculated_at"
   FROM (((("public"."material_requirements" "mr"
     JOIN "public"."production_plan" "pp" ON (("mr"."plan_id" = "pp"."plan_id")))
     JOIN "public"."master_sku" "ms" ON ((("mr"."material_sku_id")::"text" = ("ms"."sku_id")::"text")))
     JOIN "public"."master_sku" "fs" ON ((("mr"."finished_sku_id")::"text" = ("fs"."sku_id")::"text")))
     LEFT JOIN "public"."master_supplier" "sup" ON ((("mr"."supplier_id")::"text" = ("sup"."supplier_id")::"text")))
  WHERE (("mr"."shortage_qty" > (0)::numeric) AND ("pp"."status" = ANY (ARRAY['approved'::"public"."production_plan_status", 'in_production'::"public"."production_plan_status"])))
  ORDER BY "pp"."priority" DESC, "mr"."required_date", "mr"."shortage_qty" DESC;


ALTER VIEW "public"."vw_material_shortage_report" OWNER TO "postgres";


COMMENT ON VIEW "public"."vw_material_shortage_report" IS 'รายงานวัตถุดิบที่ขาด - เรียงตามความสำคัญและวันที่ต้องการ';



CREATE OR REPLACE VIEW "public"."vw_mrp_summary" AS
 SELECT "pp"."plan_id",
    "pp"."plan_no",
    "pp"."plan_name",
    "pp"."plan_start_date",
    "pp"."plan_end_date",
    "pp"."status",
    "pp"."priority",
    "pp"."warehouse_id",
    "count"(DISTINCT "ppi"."plan_item_id") AS "total_products_planned",
    COALESCE("sum"("ppi"."required_qty"), (0)::numeric) AS "total_required_qty",
    COALESCE("sum"("ppi"."produced_qty"), (0)::numeric) AS "total_produced_qty",
    COALESCE("sum"("ppi"."remaining_qty"), (0)::numeric) AS "total_remaining_qty",
    "count"(DISTINCT "mr"."requirement_id") AS "total_materials_required",
    "count"(DISTINCT
        CASE
            WHEN ("mr"."shortage_qty" > (0)::numeric) THEN "mr"."requirement_id"
            ELSE NULL::"uuid"
        END) AS "total_shortage_items",
    COALESCE("sum"("mr"."gross_requirement"), (0)::numeric) AS "total_gross_requirement",
    COALESCE("sum"("mr"."net_requirement"), (0)::numeric) AS "total_net_requirement",
    COALESCE("sum"("mr"."shortage_qty"), (0)::numeric) AS "total_shortage_qty",
    COALESCE("sum"("mr"."current_stock"), (0)::numeric) AS "total_current_stock",
    "count"(DISTINCT
        CASE
            WHEN ("mr"."status" = 'needed'::"public"."material_requirement_status") THEN "mr"."requirement_id"
            ELSE NULL::"uuid"
        END) AS "materials_needed",
    "count"(DISTINCT
        CASE
            WHEN ("mr"."status" = 'ordered'::"public"."material_requirement_status") THEN "mr"."requirement_id"
            ELSE NULL::"uuid"
        END) AS "materials_ordered",
    "count"(DISTINCT
        CASE
            WHEN ("mr"."status" = 'received'::"public"."material_requirement_status") THEN "mr"."requirement_id"
            ELSE NULL::"uuid"
        END) AS "materials_received",
    "pp"."created_at",
    "pp"."updated_at"
   FROM (("public"."production_plan" "pp"
     LEFT JOIN "public"."production_plan_items" "ppi" ON (("pp"."plan_id" = "ppi"."plan_id")))
     LEFT JOIN "public"."material_requirements" "mr" ON (("pp"."plan_id" = "mr"."plan_id")))
  GROUP BY "pp"."plan_id", "pp"."plan_no", "pp"."plan_name", "pp"."plan_start_date", "pp"."plan_end_date", "pp"."status", "pp"."priority", "pp"."warehouse_id", "pp"."created_at", "pp"."updated_at";


ALTER VIEW "public"."vw_mrp_summary" OWNER TO "postgres";


COMMENT ON VIEW "public"."vw_mrp_summary" IS 'สรุปภาพรวม MRP - แสดงสถานะแผนการผลิตและความต้องการวัตถุดิบ';



CREATE OR REPLACE VIEW "public"."vw_pick_zone_stock_status" AS
 SELECT "pa"."area_id" AS "pick_zone_id",
    "pa"."area_name" AS "pick_zone_name",
    "pa"."warehouse_id",
    "ib"."sku_id",
    "ms"."sku_name",
    "ms"."uom_base",
    "sum"("ib"."total_piece_qty") AS "current_stock_qty",
    "rr"."min_stock_qty",
    "rr"."max_stock_qty",
    "rr"."replen_qty",
    "rr"."priority" AS "rule_priority",
    "rr"."rule_id",
    "rr"."source_zone",
        CASE
            WHEN (("rr"."min_stock_qty" IS NOT NULL) AND ("sum"("ib"."total_piece_qty") <= ("rr"."min_stock_qty")::numeric)) THEN true
            ELSE false
        END AS "needs_replenishment",
        CASE
            WHEN (("rr"."min_stock_qty" IS NOT NULL) AND ("sum"("ib"."total_piece_qty") <= ("rr"."min_stock_qty")::numeric)) THEN (("rr"."max_stock_qty")::numeric - "sum"("ib"."total_piece_qty"))
            ELSE (0)::numeric
        END AS "replen_needed_qty"
   FROM ((("public"."preparation_area" "pa"
     LEFT JOIN "public"."wms_inventory_balances" "ib" ON ((("ib"."location_id")::"text" IN ( SELECT "ml"."location_id"
           FROM "public"."master_location" "ml"
          WHERE ((("ml"."zone")::"text" = ("pa"."zone")::"text") AND (("ml"."warehouse_id")::"text" = ("pa"."warehouse_id")::"text") AND (("ml"."active_status")::"text" = 'active'::"text"))))))
     LEFT JOIN "public"."master_sku" "ms" ON ((("ms"."sku_id")::"text" = ("ib"."sku_id")::"text")))
     LEFT JOIN "public"."replenishment_rules" "rr" ON (((("rr"."warehouse_id")::"text" = ("pa"."warehouse_id")::"text") AND (("rr"."sku_id")::"text" = ("ib"."sku_id")::"text") AND ("rr"."pick_zone_id" = "pa"."area_id") AND ("rr"."status" = 'active'::"public"."replenishment_rule_status"))))
  WHERE (("pa"."status")::"text" = 'active'::"text")
  GROUP BY "pa"."area_id", "pa"."area_name", "pa"."warehouse_id", "ib"."sku_id", "ms"."sku_name", "ms"."uom_base", "rr"."min_stock_qty", "rr"."max_stock_qty", "rr"."replen_qty", "rr"."priority", "rr"."rule_id", "rr"."source_zone";


ALTER VIEW "public"."vw_pick_zone_stock_status" OWNER TO "postgres";


COMMENT ON VIEW "public"."vw_pick_zone_stock_status" IS 'วิวแสดงสถานะสต็อกในแต่ละโซนเบิกพร้อมตรวจสอบว่าต้องการเติมสต็อกหรือไม่';



CREATE OR REPLACE VIEW "public"."vw_preparation_area_utilization" AS
 SELECT "pa"."area_id",
    "pa"."area_code",
    "pa"."area_name",
    "pa"."warehouse_id",
    "pa"."zone",
    "pa"."area_type",
    "pa"."capacity_sqm",
    "pa"."current_utilization_pct",
    "pa"."max_capacity_pallets",
    "pa"."current_pallets",
    "pa"."status",
    "mw"."warehouse_name",
    "count"("po"."order_id") FILTER (WHERE ("po"."status" = ANY (ARRAY['pending'::"public"."preparation_order_status_enum", 'in_progress'::"public"."preparation_order_status_enum"]))) AS "active_orders",
    COALESCE("sum"("poi"."required_quantity") FILTER (WHERE ("po"."status" = ANY (ARRAY['pending'::"public"."preparation_order_status_enum", 'in_progress'::"public"."preparation_order_status_enum"]))), (0)::numeric) AS "active_order_quantity",
        CASE
            WHEN ("pa"."max_capacity_pallets" > 0) THEN "round"(((("pa"."current_pallets")::numeric / ("pa"."max_capacity_pallets")::numeric) * (100)::numeric), 2)
            ELSE NULL::numeric
        END AS "pallet_utilization_pct"
   FROM ((("public"."preparation_area" "pa"
     JOIN "public"."master_warehouse" "mw" ON ((("mw"."warehouse_id")::"text" = ("pa"."warehouse_id")::"text")))
     LEFT JOIN "public"."preparation_order" "po" ON (("po"."preparation_area_id" = "pa"."area_id")))
     LEFT JOIN "public"."preparation_order_item" "poi" ON (("poi"."order_id" = "po"."order_id")))
  GROUP BY "pa"."area_id", "pa"."area_code", "pa"."area_name", "pa"."warehouse_id", "pa"."zone", "pa"."area_type", "pa"."capacity_sqm", "pa"."current_utilization_pct", "pa"."max_capacity_pallets", "pa"."current_pallets", "pa"."status", "mw"."warehouse_name";


ALTER VIEW "public"."vw_preparation_area_utilization" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_preparation_order_detail" AS
 SELECT "poi"."item_id",
    "poi"."order_id",
    "poi"."line_no",
    "poi"."sku_id",
    "poi"."sku_id" AS "sku_code",
    "ms"."sku_name",
    "ms"."sku_description",
    "poi"."required_quantity",
    "poi"."picked_quantity",
    "poi"."uom",
    "poi"."status",
    "poi"."assigned_location_id",
    "ml"."location_code",
    "ml"."location_name",
    "ml"."zone",
    "ml"."aisle",
    "ml"."rack",
    "ml"."shelf",
    "ml"."bin",
    "poi"."assigned_pallet_id",
    "poi"."assigned_lot_no",
    "poi"."assigned_expiry_date",
    "poi"."notes",
    "poi"."created_at",
    "poi"."updated_at"
   FROM (("public"."preparation_order_item" "poi"
     JOIN "public"."master_sku" "ms" ON ((("ms"."sku_id")::"text" = ("poi"."sku_id")::"text")))
     LEFT JOIN "public"."master_location" "ml" ON ((("ml"."location_id")::"text" = ("poi"."assigned_location_id")::"text")));


ALTER VIEW "public"."vw_preparation_order_detail" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_preparation_order_summary" AS
 SELECT "po"."order_id",
    "po"."order_no",
    "po"."warehouse_id",
    "po"."order_type",
    "po"."preparation_area_id",
    "pa"."area_name" AS "preparation_area_name",
    "pa"."zone" AS "preparation_zone",
    "pa"."area_type",
    "po"."priority",
    "po"."status",
    "po"."total_items",
    "po"."total_quantity",
    "po"."completed_items",
    "po"."completed_quantity",
    "po"."planned_start_time",
    "po"."planned_end_time",
    "po"."actual_start_time",
    "po"."actual_end_time",
    "po"."assigned_to",
    "po"."reference_no",
    "po"."notes",
    "po"."created_by",
    "po"."created_at",
    "po"."updated_at",
        CASE
            WHEN ("po"."status" = 'completed'::"public"."preparation_order_status_enum") THEN (100)::numeric
            WHEN ("po"."status" = 'in_progress'::"public"."preparation_order_status_enum") THEN
            CASE
                WHEN ("po"."total_quantity" > (0)::numeric) THEN "round"((("po"."completed_quantity" / "po"."total_quantity") * (100)::numeric), 2)
                ELSE (0)::numeric
            END
            WHEN ("po"."status" = 'pending'::"public"."preparation_order_status_enum") THEN (0)::numeric
            ELSE (0)::numeric
        END AS "completion_percentage"
   FROM ("public"."preparation_order" "po"
     LEFT JOIN "public"."preparation_area" "pa" ON (("pa"."area_id" = "po"."preparation_area_id")));


ALTER VIEW "public"."vw_preparation_order_summary" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_production_material_shortage" AS
 SELECT "po"."id" AS "production_order_id",
    "po"."production_no",
    "poi"."material_sku_id",
    "ms"."sku_name" AS "material_name",
    "poi"."required_qty",
    "poi"."issued_qty",
    "poi"."remaining_qty",
    "poi"."uom",
    "poi"."status",
    COALESCE(( SELECT "sum"(("ib"."total_piece_qty" - "ib"."reserved_piece_qty")) AS "sum"
           FROM "public"."wms_inventory_balances" "ib"
          WHERE (("ib"."sku_id")::"text" = ("poi"."material_sku_id")::"text")), (0)::numeric) AS "available_stock",
    GREATEST(("poi"."remaining_qty" - COALESCE(( SELECT "sum"(("ib"."total_piece_qty" - "ib"."reserved_piece_qty")) AS "sum"
           FROM "public"."wms_inventory_balances" "ib"
          WHERE (("ib"."sku_id")::"text" = ("poi"."material_sku_id")::"text")), (0)::numeric)), (0)::numeric) AS "shortage_qty"
   FROM (("public"."production_order_items" "poi"
     JOIN "public"."production_orders" "po" ON (("poi"."production_order_id" = "po"."id")))
     LEFT JOIN "public"."master_sku" "ms" ON ((("poi"."material_sku_id")::"text" = ("ms"."sku_id")::"text")))
  WHERE ("po"."status" = ANY (ARRAY['planned'::"public"."production_order_status", 'in_progress'::"public"."production_order_status"]));


ALTER VIEW "public"."vw_production_material_shortage" OWNER TO "postgres";


COMMENT ON VIEW "public"."vw_production_material_shortage" IS 'รายงานวัตถุดิบขาดสำหรับคำสั่งผลิตที่กำลังดำเนินการ';



CREATE OR REPLACE VIEW "public"."vw_production_order_summary" AS
 SELECT "po"."id",
    "po"."production_no",
    "po"."sku_id",
    "ms"."sku_name" AS "product_name",
    "po"."quantity",
    "po"."produced_qty",
    "po"."remaining_qty",
    "po"."uom",
    "po"."start_date",
    "po"."due_date",
    "po"."actual_start_date",
    "po"."actual_completion_date",
    "po"."status",
    "po"."priority",
    "po"."created_at",
    "count"(DISTINCT "poi"."id") AS "total_materials",
    "count"(DISTINCT
        CASE
            WHEN ("poi"."status" = 'pending'::"public"."production_item_status") THEN "poi"."id"
            ELSE NULL::"uuid"
        END) AS "pending_materials",
    "count"(DISTINCT
        CASE
            WHEN ("poi"."status" = 'issued'::"public"."production_item_status") THEN "poi"."id"
            ELSE NULL::"uuid"
        END) AS "issued_materials",
    COALESCE("sum"("poi"."required_qty"), (0)::numeric) AS "total_material_required",
    COALESCE("sum"("poi"."issued_qty"), (0)::numeric) AS "total_material_issued"
   FROM (("public"."production_orders" "po"
     LEFT JOIN "public"."master_sku" "ms" ON ((("po"."sku_id")::"text" = ("ms"."sku_id")::"text")))
     LEFT JOIN "public"."production_order_items" "poi" ON (("po"."id" = "poi"."production_order_id")))
  GROUP BY "po"."id", "po"."production_no", "po"."sku_id", "ms"."sku_name", "po"."quantity", "po"."produced_qty", "po"."remaining_qty", "po"."uom", "po"."start_date", "po"."due_date", "po"."actual_start_date", "po"."actual_completion_date", "po"."status", "po"."priority", "po"."created_at";


ALTER VIEW "public"."vw_production_order_summary" OWNER TO "postgres";


COMMENT ON VIEW "public"."vw_production_order_summary" IS 'สรุปข้อมูลคำสั่งผลิตพร้อมสถานะวัตถุดิบ';



CREATE OR REPLACE VIEW "public"."vw_production_progress" AS
 SELECT "po"."id",
    "po"."production_no",
    "po"."sku_id",
    "ms"."sku_name" AS "product_name",
    "po"."quantity" AS "target_qty",
    "po"."produced_qty",
    "po"."remaining_qty",
    "po"."status",
    "count"(DISTINCT "poi"."id") AS "total_materials",
    "count"(DISTINCT
        CASE
            WHEN ("poi"."status" = 'issued'::"public"."production_item_status") THEN "poi"."id"
            ELSE NULL::"uuid"
        END) AS "issued_materials",
    "count"(DISTINCT
        CASE
            WHEN ("poi"."status" = 'pending'::"public"."production_item_status") THEN "poi"."id"
            ELSE NULL::"uuid"
        END) AS "pending_materials",
    COALESCE("sum"("mi"."issued_qty"), (0)::numeric) AS "total_material_issued_qty",
    "count"(DISTINCT "pr"."id") AS "total_receipts",
    COALESCE("sum"("pr"."received_qty"), (0)::numeric) AS "total_received_qty",
        CASE
            WHEN ("count"(DISTINCT
            CASE
                WHEN ("poi"."status" = 'pending'::"public"."production_item_status") THEN "poi"."id"
                ELSE NULL::"uuid"
            END) = 0) THEN true
            ELSE false
        END AS "all_materials_issued"
   FROM (((("public"."production_orders" "po"
     LEFT JOIN "public"."master_sku" "ms" ON ((("po"."sku_id")::"text" = ("ms"."sku_id")::"text")))
     LEFT JOIN "public"."production_order_items" "poi" ON (("po"."id" = "poi"."production_order_id")))
     LEFT JOIN "public"."material_issues" "mi" ON ((("po"."id" = "mi"."production_order_id") AND ("mi"."status" = 'issued'::"public"."material_issue_status"))))
     LEFT JOIN "public"."production_receipts" "pr" ON (("po"."id" = "pr"."production_order_id")))
  GROUP BY "po"."id", "po"."production_no", "po"."sku_id", "ms"."sku_name", "po"."quantity", "po"."produced_qty", "po"."remaining_qty", "po"."status";


ALTER VIEW "public"."vw_production_progress" OWNER TO "postgres";


COMMENT ON VIEW "public"."vw_production_progress" IS 'สรุปความคืบหน้าการผลิตพร้อมสถานะวัตถุดิบและสินค้าสำเร็จรูป';



CREATE OR REPLACE VIEW "public"."vw_production_receipt_history" AS
 SELECT "pr"."id",
    "pr"."production_order_id",
    "po"."production_no",
    "pr"."product_sku_id",
    "ms"."sku_name" AS "product_name",
    "pr"."received_qty",
    "pr"."lot_no",
    "pr"."batch_no",
    "wl"."location_code",
    "wl"."location_name",
    "me"."employee_code" AS "produced_by_name",
    "pr"."received_at",
    "pr"."remarks"
   FROM (((("public"."production_receipts" "pr"
     JOIN "public"."production_orders" "po" ON (("pr"."production_order_id" = "po"."id")))
     LEFT JOIN "public"."master_sku" "ms" ON ((("pr"."product_sku_id")::"text" = ("ms"."sku_id")::"text")))
     LEFT JOIN "public"."master_location" "wl" ON ((("pr"."receive_location_id")::"text" = ("wl"."location_id")::"text")))
     LEFT JOIN "public"."master_employee" "me" ON (("pr"."produced_by" = "me"."employee_id")))
  ORDER BY "pr"."received_at" DESC;


ALTER VIEW "public"."vw_production_receipt_history" OWNER TO "postgres";


COMMENT ON VIEW "public"."vw_production_receipt_history" IS 'ประวัติการรับสินค้าสำเร็จรูปทั้งหมด';



CREATE OR REPLACE VIEW "public"."vw_sku_location_inventory" AS
 SELECT "ib"."warehouse_id",
    "ib"."location_id",
    "ib"."sku_id",
    "ml"."location_code",
    "ml"."zone",
    "sum"("ib"."total_pack_qty") AS "total_pack_qty",
    "sum"("ib"."total_piece_qty") AS "total_piece_qty",
    "count"(DISTINCT COALESCE("ib"."lot_no", ("concat_ws"('::'::"text", COALESCE(("ib"."production_date")::"text", '~'::"text"), COALESCE(("ib"."expiry_date")::"text", '~'::"text")))::character varying)) AS "lot_bucket_count",
    "min"("ib"."expiry_date") AS "earliest_expiry",
    "max"("ib"."expiry_date") AS "latest_expiry"
   FROM ("public"."wms_inventory_balances" "ib"
     LEFT JOIN "public"."master_location" "ml" ON ((("ml"."location_id")::"text" = ("ib"."location_id")::"text")))
  GROUP BY "ib"."warehouse_id", "ib"."location_id", "ib"."sku_id", "ml"."location_code", "ml"."zone";


ALTER VIEW "public"."vw_sku_location_inventory" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wms_stock_import_batches" (
    "batch_id" character varying(100) NOT NULL,
    "batch_name" character varying(255),
    "warehouse_id" character varying(50) NOT NULL,
    "file_name" character varying(255),
    "file_size" bigint,
    "file_type" character varying(50),
    "total_rows" integer DEFAULT 0,
    "validated_rows" integer DEFAULT 0,
    "error_rows" integer DEFAULT 0,
    "processed_rows" integer DEFAULT 0,
    "skipped_rows" integer DEFAULT 0,
    "status" character varying(20) DEFAULT 'uploading'::character varying,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_by" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "validation_summary" "jsonb",
    "processing_summary" "jsonb",
    "error_summary" "jsonb",
    CONSTRAINT "wms_stock_import_batches_status_check" CHECK ((("status")::"text" = ANY (ARRAY[('uploading'::character varying)::"text", ('validating'::character varying)::"text", ('validated'::character varying)::"text", ('processing'::character varying)::"text", ('completed'::character varying)::"text", ('failed'::character varying)::"text", ('cancelled'::character varying)::"text"])))
);


ALTER TABLE "public"."wms_stock_import_batches" OWNER TO "postgres";


COMMENT ON TABLE "public"."wms_stock_import_batches" IS 'ตารางติดตาม batch การนำเข้าสต็อกจากระบบเก่า';



COMMENT ON COLUMN "public"."wms_stock_import_batches"."batch_id" IS 'รหัส batch (เช่น IMP-20251119-001)';



COMMENT ON COLUMN "public"."wms_stock_import_batches"."status" IS 'สถานะการประมวลผล';



COMMENT ON COLUMN "public"."wms_stock_import_batches"."validation_summary" IS 'สรุปผลการตรวจสอบ (JSON)';



COMMENT ON COLUMN "public"."wms_stock_import_batches"."processing_summary" IS 'สรุปผลการนำเข้า (JSON)';



CREATE OR REPLACE VIEW "public"."vw_stock_import_batches_summary" AS
 SELECT "b"."batch_id",
    "b"."batch_name",
    "b"."warehouse_id",
    "mw"."warehouse_name",
    "b"."file_name",
    "b"."file_type",
    "b"."total_rows",
    "b"."validated_rows",
    "b"."error_rows",
    "b"."processed_rows",
    "b"."skipped_rows",
    "b"."status",
    "b"."created_at",
    "b"."started_at",
    "b"."completed_at",
        CASE
            WHEN (("b"."completed_at" IS NOT NULL) AND ("b"."started_at" IS NOT NULL)) THEN EXTRACT(epoch FROM ("b"."completed_at" - "b"."started_at"))
            ELSE NULL::numeric
        END AS "processing_duration_seconds",
        CASE
            WHEN ("b"."total_rows" > 0) THEN "round"(((("b"."processed_rows")::numeric / ("b"."total_rows")::numeric) * (100)::numeric), 2)
            ELSE (0)::numeric
        END AS "success_percentage",
    ((("me"."first_name")::"text" || ' '::"text") || ("me"."last_name")::"text") AS "created_by_name",
    "b"."validation_summary",
    "b"."processing_summary",
    "b"."error_summary"
   FROM (("public"."wms_stock_import_batches" "b"
     LEFT JOIN "public"."master_warehouse" "mw" ON ((("mw"."warehouse_id")::"text" = ("b"."warehouse_id")::"text")))
     LEFT JOIN "public"."master_employee" "me" ON (("me"."employee_id" = "b"."created_by")));


ALTER VIEW "public"."vw_stock_import_batches_summary" OWNER TO "postgres";


COMMENT ON VIEW "public"."vw_stock_import_batches_summary" IS 'View สรุปข้อมูล import batches พร้อมสถิติ';



CREATE SEQUENCE IF NOT EXISTS "public"."wms_inventory_balances_balance_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."wms_inventory_balances_balance_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."wms_inventory_balances_balance_id_seq" OWNED BY "public"."wms_inventory_balances"."balance_id";



CREATE TABLE IF NOT EXISTS "public"."wms_inventory_ledger" (
    "ledger_id" bigint NOT NULL,
    "movement_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "transaction_type" character varying(50) NOT NULL,
    "direction" "public"."movement_direction_enum" NOT NULL,
    "move_item_id" bigint,
    "receive_item_id" bigint,
    "warehouse_id" character varying(50) NOT NULL,
    "location_id" character varying(50),
    "sku_id" character varying(50) NOT NULL,
    "pallet_id" character varying(100),
    "pallet_id_external" character varying(100),
    "production_date" "date",
    "expiry_date" "date",
    "pack_qty" numeric(18,2) DEFAULT 0 NOT NULL,
    "piece_qty" numeric(18,2) DEFAULT 0 NOT NULL,
    "reference_no" character varying(100),
    "remarks" "text",
    "created_by" bigint,
    "reference_doc_type" character varying(50),
    "reference_doc_id" bigint,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "skip_balance_sync" boolean DEFAULT false,
    CONSTRAINT "chk_inventory_ledger_pack_qty" CHECK (("pack_qty" >= (0)::numeric)),
    CONSTRAINT "chk_inventory_ledger_piece_qty" CHECK (("piece_qty" >= (0)::numeric))
);


ALTER TABLE "public"."wms_inventory_ledger" OWNER TO "postgres";


COMMENT ON TABLE "public"."wms_inventory_ledger" IS 'Inventory ledger - dates fixed on 2025-01-22';



COMMENT ON COLUMN "public"."wms_inventory_ledger"."transaction_type" IS 'ประเภทของธุรกรรม (เช่น receive/move/adjustment/pick/etc.)';



COMMENT ON COLUMN "public"."wms_inventory_ledger"."direction" IS 'ทิศทางการเคลื่อนไหว: in = เข้าสต็อก, out = ออกจากสต็อก';



COMMENT ON COLUMN "public"."wms_inventory_ledger"."production_date" IS 'วันที่ผลิต (DATE type - application should cast string to date)';



COMMENT ON COLUMN "public"."wms_inventory_ledger"."expiry_date" IS 'วันหมดอายุ (DATE type - application should cast string to date)';



COMMENT ON COLUMN "public"."wms_inventory_ledger"."pack_qty" IS 'ปริมาณแพ็ค (ค่าบวก/ลบตามทิศทาง)';



COMMENT ON COLUMN "public"."wms_inventory_ledger"."piece_qty" IS 'ปริมาณชิ้น (ค่าบวก/ลบตามทิศทาง)';



COMMENT ON COLUMN "public"."wms_inventory_ledger"."reference_doc_type" IS 'ประเภทของเอกสารอ้างอิง (เช่น PO, SO, Transfer Order, etc.)';



COMMENT ON COLUMN "public"."wms_inventory_ledger"."reference_doc_id" IS 'ID ของเอกสารอ้างอิง (เช่น receive_id, order_id, etc.)';



COMMENT ON COLUMN "public"."wms_inventory_ledger"."created_at" IS 'วันที่สร้างรายการ';



COMMENT ON COLUMN "public"."wms_inventory_ledger"."updated_at" IS 'วันที่แก้ไขล่าสุด';



COMMENT ON COLUMN "public"."wms_inventory_ledger"."skip_balance_sync" IS 'Flag to skip automatic balance sync by trigger. Set to TRUE when API already updated balance manually. (เพิ่มเมื่อ 2025-11-29)';



CREATE SEQUENCE IF NOT EXISTS "public"."wms_inventory_ledger_ledger_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."wms_inventory_ledger_ledger_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."wms_inventory_ledger_ledger_id_seq" OWNED BY "public"."wms_inventory_ledger"."ledger_id";



CREATE SEQUENCE IF NOT EXISTS "public"."wms_loadlist_picklists_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."wms_loadlist_picklists_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."wms_loadlist_picklists_id_seq" OWNED BY "public"."wms_loadlist_picklists"."id";



CREATE SEQUENCE IF NOT EXISTS "public"."wms_move_items_move_item_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."wms_move_items_move_item_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."wms_move_items_move_item_id_seq" OWNED BY "public"."wms_move_items"."move_item_id";



CREATE TABLE IF NOT EXISTS "public"."wms_moves" (
    "move_id" bigint NOT NULL,
    "move_no" character varying(50) NOT NULL,
    "move_type" "public"."move_type_enum" DEFAULT 'putaway'::"public"."move_type_enum" NOT NULL,
    "status" "public"."move_status_enum" DEFAULT 'draft'::"public"."move_status_enum" NOT NULL,
    "priority" smallint DEFAULT 50,
    "source_receive_id" bigint,
    "source_document" character varying(100),
    "from_warehouse_id" character varying(50),
    "to_warehouse_id" character varying(50),
    "requested_by" bigint,
    "assigned_to" bigint,
    "approved_by" bigint,
    "scheduled_at" timestamp with time zone,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "notes" "text",
    "created_by" bigint,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "created_source" "public"."move_created_source_enum" DEFAULT 'system'::"public"."move_created_source_enum" NOT NULL,
    CONSTRAINT "wms_moves_priority_check" CHECK ((("priority" >= 1) AND ("priority" <= 99)))
);


ALTER TABLE "public"."wms_moves" OWNER TO "postgres";


COMMENT ON TABLE "public"."wms_moves" IS 'หัวข้อใบงานย้ายสินค้า (Move Orders)';



COMMENT ON COLUMN "public"."wms_moves"."move_no" IS 'รหัสใบงานย้ายสินค้า (เช่น MV-2024-0001)';



COMMENT ON COLUMN "public"."wms_moves"."move_type" IS 'ประเภทของการย้ายสินค้า (Putaway/Transfer/Replenishment/Adjustment)';



COMMENT ON COLUMN "public"."wms_moves"."status" IS 'สถานะใบงาน (Draft/Pending/In Progress/Completed/Cancelled)';



COMMENT ON COLUMN "public"."wms_moves"."priority" IS 'ลำดับความสำคัญของใบงาน (1 = สูงสุด, 99 = ต่ำสุด)';



COMMENT ON COLUMN "public"."wms_moves"."source_receive_id" IS 'อ้างอิงไปยังใบรับสินค้า (wms_receives.receive_id) ถ้ามาจากกระบวนการรับ';



COMMENT ON COLUMN "public"."wms_moves"."source_document" IS 'หมายเลขอ้างอิงภายนอก';



COMMENT ON COLUMN "public"."wms_moves"."from_warehouse_id" IS 'คลังสินค้าต้นทาง (FK → master_warehouse)';



COMMENT ON COLUMN "public"."wms_moves"."to_warehouse_id" IS 'คลังสินค้าปลายทาง (FK → master_warehouse)';



COMMENT ON COLUMN "public"."wms_moves"."requested_by" IS 'พนักงานที่สร้างคำขอย้ายสินค้า';



COMMENT ON COLUMN "public"."wms_moves"."assigned_to" IS 'พนักงานที่ได้รับมอบหมาย';



COMMENT ON COLUMN "public"."wms_moves"."approved_by" IS 'ผู้อนุมัติการย้าย (ถ้ามี)';



COMMENT ON COLUMN "public"."wms_moves"."scheduled_at" IS 'เวลาที่วางแผนเริ่มงาน';



COMMENT ON COLUMN "public"."wms_moves"."started_at" IS 'เวลาที่เริ่มทำงานจริง';



COMMENT ON COLUMN "public"."wms_moves"."completed_at" IS 'เวลาที่งานเสร็จสมบูรณ์';



COMMENT ON COLUMN "public"."wms_moves"."notes" IS 'หมายเหตุเพิ่มเติมของใบงาน';



COMMENT ON COLUMN "public"."wms_moves"."created_by" IS 'พนักงานที่สร้างใบงาน';



COMMENT ON COLUMN "public"."wms_moves"."created_source" IS 'แหล่งที่มาของการสร้างใบงาน (system = สร้างจาก warehouse/transfer, manual = สร้างจาก mobile/transfer)';



CREATE SEQUENCE IF NOT EXISTS "public"."wms_moves_move_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."wms_moves_move_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."wms_moves_move_id_seq" OWNED BY "public"."wms_moves"."move_id";



CREATE TABLE IF NOT EXISTS "public"."wms_order_items" (
    "order_item_id" bigint NOT NULL,
    "order_id" bigint NOT NULL,
    "line_no" integer NOT NULL,
    "sku_id" character varying(50) NOT NULL,
    "sku_name" character varying(255),
    "number_field_additional_1" numeric(15,3),
    "order_qty" numeric(15,3) NOT NULL,
    "order_weight" numeric(15,3),
    "pack_all" integer DEFAULT 0,
    "pack_12_bags" integer DEFAULT 0,
    "pack_4" integer DEFAULT 0,
    "pack_6" integer DEFAULT 0,
    "pack_2" integer DEFAULT 0,
    "pack_1" integer DEFAULT 0,
    "picked_qty" numeric(15,3) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."wms_order_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."wms_order_items" IS 'ตารางรายการสินค้าในคำสั่งขาย';



COMMENT ON COLUMN "public"."wms_order_items"."order_item_id" IS 'รหัสรายการสินค้า (Auto Increment Primary Key)';



COMMENT ON COLUMN "public"."wms_order_items"."order_id" IS 'รหัสคำสั่งขาย (FK → wms_orders.order_id)';



COMMENT ON COLUMN "public"."wms_order_items"."line_no" IS 'ลำดับรายการ';



COMMENT ON COLUMN "public"."wms_order_items"."sku_id" IS 'รหัสสินค้า (FK → master_sku.sku_id)';



COMMENT ON COLUMN "public"."wms_order_items"."sku_name" IS 'ชื่อสินค้า';



COMMENT ON COLUMN "public"."wms_order_items"."number_field_additional_1" IS 'ฟิลด์เพิ่มเติมประเภทตัวเลข 1';



COMMENT ON COLUMN "public"."wms_order_items"."order_qty" IS 'จำนวน';



COMMENT ON COLUMN "public"."wms_order_items"."order_weight" IS 'น้ำหนัก';



COMMENT ON COLUMN "public"."wms_order_items"."pack_all" IS 'แพ็ครวม';



COMMENT ON COLUMN "public"."wms_order_items"."pack_12_bags" IS 'แพ็ค 12 ถุง';



COMMENT ON COLUMN "public"."wms_order_items"."pack_4" IS 'แพ็ค 4';



COMMENT ON COLUMN "public"."wms_order_items"."pack_6" IS 'แพ็ค 6';



COMMENT ON COLUMN "public"."wms_order_items"."pack_2" IS 'แพ็ค 2';



COMMENT ON COLUMN "public"."wms_order_items"."pack_1" IS 'แพ็ค 1';



COMMENT ON COLUMN "public"."wms_order_items"."picked_qty" IS 'จำนวนที่เบิกแล้ว';



CREATE SEQUENCE IF NOT EXISTS "public"."wms_order_items_order_item_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."wms_order_items_order_item_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."wms_order_items_order_item_id_seq" OWNED BY "public"."wms_order_items"."order_item_id";



CREATE SEQUENCE IF NOT EXISTS "public"."wms_orders_order_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."wms_orders_order_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."wms_orders_order_id_seq" OWNED BY "public"."wms_orders"."order_id";



CREATE TABLE IF NOT EXISTS "public"."wms_receive_items" (
    "item_id" bigint NOT NULL,
    "receive_id" bigint NOT NULL,
    "sku_id" character varying(50) NOT NULL,
    "product_name" character varying(255),
    "barcode" character varying(100),
    "production_date" character varying(100),
    "expiry_date" "date",
    "pack_quantity" numeric(18,2) DEFAULT 0 NOT NULL,
    "piece_quantity" numeric(18,2) DEFAULT 0 NOT NULL,
    "weight_kg" numeric(18,3),
    "pallet_id" character varying(100),
    "pallet_scan_status" "public"."pallet_scan_status_enum" DEFAULT 'ไม่จำเป็น'::"public"."pallet_scan_status_enum",
    "pallet_id_external" character varying(100),
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "pallet_color" character varying(50),
    "received_date" "date",
    "created_by" bigint,
    "location_id" character varying(50),
    "product_status" "public"."product_status_enum" DEFAULT 'ปกติ'::"public"."product_status_enum",
    "remarks" "text",
    CONSTRAINT "chk_items_pack_quantity" CHECK (("pack_quantity" >= (0)::numeric)),
    CONSTRAINT "chk_items_piece_quantity" CHECK (("piece_quantity" >= (0)::numeric)),
    CONSTRAINT "chk_items_weight" CHECK ((("weight_kg" IS NULL) OR ("weight_kg" >= (0)::numeric)))
);


ALTER TABLE "public"."wms_receive_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."wms_receive_items" IS 'Line items for goods receipt documents.';



COMMENT ON COLUMN "public"."wms_receive_items"."item_id" IS 'Line Item ID (Auto Increment Primary Key)';



COMMENT ON COLUMN "public"."wms_receive_items"."receive_id" IS 'FK to wms_receives table';



COMMENT ON COLUMN "public"."wms_receive_items"."sku_id" IS 'FK to master_sku table';



COMMENT ON COLUMN "public"."wms_receive_items"."product_name" IS 'Product Name (denormalized)';



COMMENT ON COLUMN "public"."wms_receive_items"."barcode" IS 'Product Barcode (denormalized)';



COMMENT ON COLUMN "public"."wms_receive_items"."production_date" IS 'Production Date (วันที่ผลิต)';



COMMENT ON COLUMN "public"."wms_receive_items"."expiry_date" IS 'Expiry Date (if any)';



COMMENT ON COLUMN "public"."wms_receive_items"."pack_quantity" IS 'Pack Quantity';



COMMENT ON COLUMN "public"."wms_receive_items"."piece_quantity" IS 'Piece Quantity';



COMMENT ON COLUMN "public"."wms_receive_items"."weight_kg" IS 'Weight (kg)';



COMMENT ON COLUMN "public"."wms_receive_items"."pallet_id" IS 'Pallet ID (if any)';



COMMENT ON COLUMN "public"."wms_receive_items"."pallet_scan_status" IS 'Pallet scan status';



COMMENT ON COLUMN "public"."wms_receive_items"."pallet_id_external" IS 'External Pallet ID from supplier (if applicable)';



COMMENT ON COLUMN "public"."wms_receive_items"."pallet_color" IS 'Pallet color for identification (applicable for normal goods receipt)';



COMMENT ON COLUMN "public"."wms_receive_items"."received_date" IS 'Date when the specific item was received (item-level tracking)';



COMMENT ON COLUMN "public"."wms_receive_items"."created_by" IS 'Employee ID who created this receive item record (FK → master_employee.employee_id)';



COMMENT ON COLUMN "public"."wms_receive_items"."location_id" IS 'Storage Location ID (FK -> master_location.location_id)';



COMMENT ON COLUMN "public"."wms_receive_items"."product_status" IS 'สถานะของสินค้าที่รับเข้า (ปกติ, ชำรุด, หมดอายุ, คืนสินค้า)';



COMMENT ON COLUMN "public"."wms_receive_items"."remarks" IS 'หมายเหตุเพิ่มเติมสำหรับรายการสินค้า';



CREATE SEQUENCE IF NOT EXISTS "public"."wms_receive_items_item_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."wms_receive_items_item_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."wms_receive_items_item_id_seq" OWNED BY "public"."wms_receive_items"."item_id";



CREATE TABLE IF NOT EXISTS "public"."wms_receives" (
    "receive_id" bigint NOT NULL,
    "receive_no" character varying(50) NOT NULL,
    "receive_type" "public"."receive_type_enum" DEFAULT 'รับสินค้าปกติ'::"public"."receive_type_enum" NOT NULL,
    "reference_doc" character varying(100),
    "supplier_id" character varying(50),
    "customer_id" character varying(50),
    "warehouse_id" character varying(50) NOT NULL,
    "receive_date" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "received_by" bigint,
    "status" "public"."receive_status_enum" DEFAULT 'รอรับเข้า'::"public"."receive_status_enum",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" bigint,
    "receive_images" "text"[],
    "receive_image_names" "text"[],
    "receive_image_count" integer DEFAULT 0,
    "pallet_box_option" character varying(100),
    "pallet_calculation_method" character varying(100)
);


ALTER TABLE "public"."wms_receives" OWNER TO "postgres";


COMMENT ON TABLE "public"."wms_receives" IS 'Header table for goods receipt documents.';



COMMENT ON COLUMN "public"."wms_receives"."receive_id" IS 'Receive ID (Auto Increment Primary Key)';



COMMENT ON COLUMN "public"."wms_receives"."receive_no" IS 'Goods Receipt document number, e.g., GR-2025-0001';



COMMENT ON COLUMN "public"."wms_receives"."receive_type" IS 'Type of receipt (Normal/Return/etc.)';



COMMENT ON COLUMN "public"."wms_receives"."reference_doc" IS 'Reference number (PO/SO/etc.)';



COMMENT ON COLUMN "public"."wms_receives"."supplier_id" IS 'Supplier ID (FK → master_supplier.supplier_id)';



COMMENT ON COLUMN "public"."wms_receives"."customer_id" IS 'Customer ID (FK → master_customer.customer_id) for returns';



COMMENT ON COLUMN "public"."wms_receives"."warehouse_id" IS 'Warehouse ID (FK → master_warehouse.warehouse_id)';



COMMENT ON COLUMN "public"."wms_receives"."receive_date" IS 'Date the goods were received';



COMMENT ON COLUMN "public"."wms_receives"."received_by" IS 'Employee who received the goods (FK → master_employee.employee_id)';



COMMENT ON COLUMN "public"."wms_receives"."status" IS 'Document status (Draft/Received/Stored/Closed/Cancelled)';



COMMENT ON COLUMN "public"."wms_receives"."notes" IS 'Additional notes for the entire receipt';



COMMENT ON COLUMN "public"."wms_receives"."created_at" IS 'Timestamp of creation';



COMMENT ON COLUMN "public"."wms_receives"."updated_at" IS 'Timestamp of last update';



COMMENT ON COLUMN "public"."wms_receives"."created_by" IS 'Employee ID who created this receive record (FK → master_employee.employee_id)';



COMMENT ON COLUMN "public"."wms_receives"."receive_images" IS 'อาเรย์ของ URLs รูปภาพที่เกี่ยวข้องกับการรับสินค้า';



COMMENT ON COLUMN "public"."wms_receives"."receive_image_names" IS 'อาเรย์ของชื่อไฟล์รูปภาพต้นฉบับ';



COMMENT ON COLUMN "public"."wms_receives"."receive_image_count" IS 'จำนวนรูปภาพทั้งหมดในการรับสินค้านี้';



COMMENT ON COLUMN "public"."wms_receives"."pallet_box_option" IS 'เงื่อนไขการสร้าง Pallet/Box เช่น สร้าง_Pallet_ID, สร้าง_Pallet_ID_รวม, สร้าง_Pallet_ID_และ_Box_ID, สร้าง_Pallet_ID_และ_สแกน_Pallet_ID_ภายนอก';



COMMENT ON COLUMN "public"."wms_receives"."pallet_calculation_method" IS 'วิธีการคำนวณจำนวนต่อ Pallet เช่น ใช้จำนวนจากมาสเตอร์สินค้า, กำหนดจำนวนเอง';



CREATE SEQUENCE IF NOT EXISTS "public"."wms_receives_receive_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."wms_receives_receive_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."wms_receives_receive_id_seq" OWNED BY "public"."wms_receives"."receive_id";



CREATE SEQUENCE IF NOT EXISTS "public"."wms_stock_import_batch_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."wms_stock_import_batch_seq" OWNER TO "postgres";


COMMENT ON SEQUENCE "public"."wms_stock_import_batch_seq" IS 'Sequence สำหรับสร้างหมายเลข batch import';



CREATE TABLE IF NOT EXISTS "public"."wms_stock_import_staging" (
    "staging_id" bigint NOT NULL,
    "import_batch_id" character varying(100) NOT NULL,
    "row_number" integer,
    "location_id" character varying(50),
    "zone" character varying(50),
    "row_code" character varying(50),
    "level_code" character varying(50),
    "loc_code" character varying(50),
    "sku_pick_face" character varying(50),
    "max_weight" numeric(10,3),
    "max_pallet" integer,
    "max_high" character varying(50),
    "location_status" character varying(50),
    "pallet_id_check" character varying(100),
    "pallet_id_external" character varying(100),
    "last_updated_check" character varying(100),
    "last_updated_check_2" character varying(100),
    "last_updated" character varying(100),
    "sku_id" character varying(50),
    "product_name" "text",
    "pack_qty" numeric(18,2),
    "piece_qty" numeric(18,2),
    "weight_kg" numeric(10,3),
    "lot_no" character varying(100),
    "received_date" character varying(50),
    "expiration_date" character varying(50),
    "barcode" character varying(100),
    "name_edit" character varying(255),
    "stock_status" character varying(50),
    "pallet_color" character varying(50),
    "remarks" "text",
    "warehouse_id" character varying(50),
    "parsed_received_date" "date",
    "parsed_expiration_date" "date",
    "parsed_last_updated" timestamp with time zone,
    "processing_status" character varying(20) DEFAULT 'pending'::character varying,
    "validation_errors" "text"[],
    "validation_warnings" "text"[],
    "processed_at" timestamp with time zone,
    "processed_balance_id" bigint,
    "processed_ledger_id" bigint,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" bigint,
    CONSTRAINT "wms_stock_import_staging_status_check" CHECK ((("processing_status")::"text" = ANY (ARRAY[('pending'::character varying)::"text", ('validated'::character varying)::"text", ('processed'::character varying)::"text", ('error'::character varying)::"text", ('skipped'::character varying)::"text"])))
);


ALTER TABLE "public"."wms_stock_import_staging" OWNER TO "postgres";


COMMENT ON TABLE "public"."wms_stock_import_staging" IS 'ตาราง staging สำหรับเก็บข้อมูลก่อนนำเข้าจริง';



COMMENT ON COLUMN "public"."wms_stock_import_staging"."row_number" IS 'หมายเลขแถวในไฟล์ต้นฉบับ';



COMMENT ON COLUMN "public"."wms_stock_import_staging"."processing_status" IS 'สถานะการประมวลผล';



COMMENT ON COLUMN "public"."wms_stock_import_staging"."validation_errors" IS 'รายการ error จากการ validate';



COMMENT ON COLUMN "public"."wms_stock_import_staging"."validation_warnings" IS 'รายการ warning จากการ validate';



CREATE SEQUENCE IF NOT EXISTS "public"."wms_stock_import_staging_staging_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."wms_stock_import_staging_staging_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."wms_stock_import_staging_staging_id_seq" OWNED BY "public"."wms_stock_import_staging"."staging_id";



ALTER TABLE ONLY "public"."bom_sku" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."bom_sku_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."bonus_face_sheet_items" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."bonus_face_sheet_items_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."bonus_face_sheet_packages" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."bonus_face_sheet_packages_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."bonus_face_sheets" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."bonus_face_sheets_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."export_jobs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."export_jobs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."face_sheet_item_reservations" ALTER COLUMN "reservation_id" SET DEFAULT "nextval"('"public"."face_sheet_item_reservations_reservation_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."face_sheet_items" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."face_sheet_items_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."face_sheet_packages" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."face_sheet_packages_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."face_sheets" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."face_sheets_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."import_jobs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."import_jobs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."loadlist_items" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."loadlist_items_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."loadlists" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."loadlists_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."master_customer_no_price_goods" ALTER COLUMN "record_id" SET DEFAULT "nextval"('"public"."master_customer_no_price_goods_record_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."master_iv_document_type" ALTER COLUMN "doc_type_id" SET DEFAULT "nextval"('"public"."master_iv_document_type_doc_type_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."master_permission_module" ALTER COLUMN "module_id" SET DEFAULT "nextval"('"public"."master_permission_module_module_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."master_system_role" ALTER COLUMN "role_id" SET DEFAULT "nextval"('"public"."master_system_role_role_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."master_system_user" ALTER COLUMN "user_id" SET DEFAULT "nextval"('"public"."master_system_user_user_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."master_vehicle" ALTER COLUMN "vehicle_id" SET DEFAULT "nextval"('"public"."master_vehicle_vehicle_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."packing_promotion_freebies" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."packing_promotion_freebies_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."picklist_item_reservations" ALTER COLUMN "reservation_id" SET DEFAULT "nextval"('"public"."picklist_item_reservations_reservation_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."picklist_items" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."picklist_items_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."picklists" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."picklists_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."receiving_route_clusters" ALTER COLUMN "cluster_id" SET DEFAULT "nextval"('"public"."receiving_route_clusters_cluster_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."receiving_route_plan_inputs" ALTER COLUMN "input_id" SET DEFAULT "nextval"('"public"."receiving_route_plan_inputs_input_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."receiving_route_plan_metrics" ALTER COLUMN "metric_id" SET DEFAULT "nextval"('"public"."receiving_route_plan_metrics_metric_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."receiving_route_plans" ALTER COLUMN "plan_id" SET DEFAULT "nextval"('"public"."receiving_route_plans_plan_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."receiving_route_stop_items" ALTER COLUMN "stop_item_id" SET DEFAULT "nextval"('"public"."receiving_route_stop_items_stop_item_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."receiving_route_stops" ALTER COLUMN "stop_id" SET DEFAULT "nextval"('"public"."receiving_route_stops_stop_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."receiving_route_trips" ALTER COLUMN "trip_id" SET DEFAULT "nextval"('"public"."receiving_route_trips_trip_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."stock_replenishment_alerts" ALTER COLUMN "alert_id" SET DEFAULT "nextval"('"public"."stock_replenishment_alerts_alert_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."wms_inventory_balances" ALTER COLUMN "balance_id" SET DEFAULT "nextval"('"public"."wms_inventory_balances_balance_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."wms_inventory_ledger" ALTER COLUMN "ledger_id" SET DEFAULT "nextval"('"public"."wms_inventory_ledger_ledger_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."wms_loadlist_picklists" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."wms_loadlist_picklists_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."wms_move_items" ALTER COLUMN "move_item_id" SET DEFAULT "nextval"('"public"."wms_move_items_move_item_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."wms_moves" ALTER COLUMN "move_id" SET DEFAULT "nextval"('"public"."wms_moves_move_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."wms_order_items" ALTER COLUMN "order_item_id" SET DEFAULT "nextval"('"public"."wms_order_items_order_item_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."wms_orders" ALTER COLUMN "order_id" SET DEFAULT "nextval"('"public"."wms_orders_order_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."wms_receive_items" ALTER COLUMN "item_id" SET DEFAULT "nextval"('"public"."wms_receive_items_item_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."wms_receives" ALTER COLUMN "receive_id" SET DEFAULT "nextval"('"public"."wms_receives_receive_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."wms_stock_import_staging" ALTER COLUMN "staging_id" SET DEFAULT "nextval"('"public"."wms_stock_import_staging_staging_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."bom_sku"
    ADD CONSTRAINT "bom_sku_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bonus_face_sheet_items"
    ADD CONSTRAINT "bonus_face_sheet_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bonus_face_sheet_packages"
    ADD CONSTRAINT "bonus_face_sheet_packages_barcode_id_key" UNIQUE ("barcode_id");



ALTER TABLE ONLY "public"."bonus_face_sheet_packages"
    ADD CONSTRAINT "bonus_face_sheet_packages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bonus_face_sheet_packages"
    ADD CONSTRAINT "bonus_face_sheet_packages_unique" UNIQUE ("face_sheet_id", "package_number");



ALTER TABLE ONLY "public"."bonus_face_sheets"
    ADD CONSTRAINT "bonus_face_sheets_face_sheet_no_key" UNIQUE ("face_sheet_no");



ALTER TABLE ONLY "public"."bonus_face_sheets"
    ADD CONSTRAINT "bonus_face_sheets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dashboard_calendar_attendees"
    ADD CONSTRAINT "dashboard_calendar_attendees_event_id_employee_id_key" UNIQUE ("event_id", "employee_id");



ALTER TABLE ONLY "public"."dashboard_calendar_attendees"
    ADD CONSTRAINT "dashboard_calendar_attendees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dashboard_calendar_events"
    ADD CONSTRAINT "dashboard_calendar_events_pkey" PRIMARY KEY ("event_id");



ALTER TABLE ONLY "public"."export_jobs"
    ADD CONSTRAINT "export_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."face_sheet_item_reservations"
    ADD CONSTRAINT "face_sheet_item_reservations_pkey" PRIMARY KEY ("reservation_id");



ALTER TABLE ONLY "public"."face_sheet_items"
    ADD CONSTRAINT "face_sheet_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."face_sheet_packages"
    ADD CONSTRAINT "face_sheet_packages_barcode_id_key" UNIQUE ("barcode_id");



ALTER TABLE ONLY "public"."face_sheet_packages"
    ADD CONSTRAINT "face_sheet_packages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."face_sheets"
    ADD CONSTRAINT "face_sheets_face_sheet_no_key" UNIQUE ("face_sheet_no");



ALTER TABLE ONLY "public"."face_sheets"
    ADD CONSTRAINT "face_sheets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."file_uploads"
    ADD CONSTRAINT "file_uploads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."file_uploads"
    ADD CONSTRAINT "file_uploads_storage_path_key" UNIQUE ("storage_path");



ALTER TABLE ONLY "public"."import_jobs"
    ADD CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loadlist_face_sheets"
    ADD CONSTRAINT "loadlist_face_sheets_pkey" PRIMARY KEY ("loadlist_id", "face_sheet_id");



ALTER TABLE ONLY "public"."loadlist_items"
    ADD CONSTRAINT "loadlist_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loadlist_items"
    ADD CONSTRAINT "loadlist_items_unique_order" UNIQUE ("loadlist_id", "order_id");



ALTER TABLE ONLY "public"."loadlist_picklists"
    ADD CONSTRAINT "loadlist_picklists_pkey" PRIMARY KEY ("loadlist_id", "picklist_id");



ALTER TABLE ONLY "public"."loadlists"
    ADD CONSTRAINT "loadlists_loadlist_code_key" UNIQUE ("loadlist_code");



ALTER TABLE ONLY "public"."loadlists"
    ADD CONSTRAINT "loadlists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."location_group_members"
    ADD CONSTRAINT "location_group_members_pkey" PRIMARY KEY ("group_id", "location_id");



ALTER TABLE ONLY "public"."location_group"
    ADD CONSTRAINT "location_group_pkey" PRIMARY KEY ("group_id");



ALTER TABLE ONLY "public"."location_group"
    ADD CONSTRAINT "location_group_warehouse_id_group_code_key" UNIQUE ("warehouse_id", "group_code");



ALTER TABLE ONLY "public"."location_sku_allocation"
    ADD CONSTRAINT "location_sku_allocation_pkey" PRIMARY KEY ("allocation_id");



ALTER TABLE ONLY "public"."location_storage_profile"
    ADD CONSTRAINT "location_storage_profile_pkey" PRIMARY KEY ("location_id");



ALTER TABLE ONLY "public"."master_customer_no_price_goods"
    ADD CONSTRAINT "master_customer_no_price_goods_pkey" PRIMARY KEY ("record_id");



ALTER TABLE ONLY "public"."master_customer"
    ADD CONSTRAINT "master_customer_pkey" PRIMARY KEY ("customer_id");



ALTER TABLE ONLY "public"."master_employee"
    ADD CONSTRAINT "master_employee_employee_code_key" UNIQUE ("employee_code");



ALTER TABLE ONLY "public"."master_employee"
    ADD CONSTRAINT "master_employee_pkey" PRIMARY KEY ("employee_id");



ALTER TABLE ONLY "public"."master_freight_rate"
    ADD CONSTRAINT "master_freight_rate_pkey" PRIMARY KEY ("freight_rate_id");



ALTER TABLE ONLY "public"."master_iv_document_type"
    ADD CONSTRAINT "master_iv_document_type_doc_type_code_key" UNIQUE ("doc_type_code");



ALTER TABLE ONLY "public"."master_iv_document_type"
    ADD CONSTRAINT "master_iv_document_type_pkey" PRIMARY KEY ("doc_type_id");



ALTER TABLE ONLY "public"."master_location"
    ADD CONSTRAINT "master_location_pkey" PRIMARY KEY ("location_id");



ALTER TABLE ONLY "public"."master_permission_module"
    ADD CONSTRAINT "master_permission_module_pkey" PRIMARY KEY ("module_id");



ALTER TABLE ONLY "public"."master_sku"
    ADD CONSTRAINT "master_sku_pkey" PRIMARY KEY ("sku_id");



ALTER TABLE ONLY "public"."master_supplier"
    ADD CONSTRAINT "master_supplier_pkey" PRIMARY KEY ("supplier_id");



ALTER TABLE ONLY "public"."master_system_role"
    ADD CONSTRAINT "master_system_role_pkey" PRIMARY KEY ("role_id");



ALTER TABLE ONLY "public"."master_system_role"
    ADD CONSTRAINT "master_system_role_role_name_key" UNIQUE ("role_name");



ALTER TABLE ONLY "public"."master_system_user"
    ADD CONSTRAINT "master_system_user_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."master_system_user"
    ADD CONSTRAINT "master_system_user_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."master_system_user"
    ADD CONSTRAINT "master_system_user_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."master_vehicle"
    ADD CONSTRAINT "master_vehicle_pkey" PRIMARY KEY ("vehicle_id");



ALTER TABLE ONLY "public"."master_vehicle"
    ADD CONSTRAINT "master_vehicle_plate_number_key" UNIQUE ("plate_number");



ALTER TABLE ONLY "public"."master_vehicle"
    ADD CONSTRAINT "master_vehicle_vehicle_code_key" UNIQUE ("vehicle_code");



ALTER TABLE ONLY "public"."master_warehouse_asset"
    ADD CONSTRAINT "master_warehouse_asset_asset_code_key" UNIQUE ("asset_code");



ALTER TABLE ONLY "public"."master_warehouse_asset"
    ADD CONSTRAINT "master_warehouse_asset_pkey" PRIMARY KEY ("asset_id");



ALTER TABLE ONLY "public"."master_warehouse"
    ADD CONSTRAINT "master_warehouse_pkey" PRIMARY KEY ("warehouse_id");



ALTER TABLE ONLY "public"."material_issue_items"
    ADD CONSTRAINT "material_issue_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."material_issues"
    ADD CONSTRAINT "material_issues_issue_no_key" UNIQUE ("issue_no");



ALTER TABLE ONLY "public"."material_issues"
    ADD CONSTRAINT "material_issues_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."material_requirements"
    ADD CONSTRAINT "material_requirements_pkey" PRIMARY KEY ("requirement_id");



ALTER TABLE ONLY "public"."material_return_items"
    ADD CONSTRAINT "material_return_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."material_returns"
    ADD CONSTRAINT "material_returns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."material_returns"
    ADD CONSTRAINT "material_returns_return_no_key" UNIQUE ("return_no");



ALTER TABLE ONLY "public"."packing_backup_orders"
    ADD CONSTRAINT "packing_backup_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."packing_box_stock_history"
    ADD CONSTRAINT "packing_box_stock_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."packing_box_stocks"
    ADD CONSTRAINT "packing_box_stocks_box_id_key" UNIQUE ("box_id");



ALTER TABLE ONLY "public"."packing_box_stocks"
    ADD CONSTRAINT "packing_box_stocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."packing_boxes"
    ADD CONSTRAINT "packing_boxes_box_code_key" UNIQUE ("box_code");



ALTER TABLE ONLY "public"."packing_boxes"
    ADD CONSTRAINT "packing_boxes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."packing_history"
    ADD CONSTRAINT "packing_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."packing_order_items"
    ADD CONSTRAINT "packing_order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."packing_orders"
    ADD CONSTRAINT "packing_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."packing_product_weight_profiles"
    ADD CONSTRAINT "packing_product_weight_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."packing_product_weight_profiles"
    ADD CONSTRAINT "packing_product_weight_profiles_product_type_code_key" UNIQUE ("product_type_code");



ALTER TABLE ONLY "public"."packing_product_weight_profiles"
    ADD CONSTRAINT "packing_product_weight_profiles_weight_kg_key" UNIQUE ("weight_kg");



ALTER TABLE ONLY "public"."packing_products"
    ADD CONSTRAINT "packing_products_barcode_key" UNIQUE ("barcode");



ALTER TABLE ONLY "public"."packing_products"
    ADD CONSTRAINT "packing_products_parent_sku_key" UNIQUE ("parent_sku");



ALTER TABLE ONLY "public"."packing_products"
    ADD CONSTRAINT "packing_products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."packing_promotion_freebies"
    ADD CONSTRAINT "packing_promotion_freebies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."packing_returns"
    ADD CONSTRAINT "packing_returns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."packing_rules"
    ADD CONSTRAINT "packing_rules_box_code_primary_product_type_code_key" UNIQUE ("box_code", "primary_product_type_code");



ALTER TABLE ONLY "public"."packing_rules"
    ADD CONSTRAINT "packing_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."packing_system_menus"
    ADD CONSTRAINT "packing_system_menus_menu_path_key" UNIQUE ("menu_path");



ALTER TABLE ONLY "public"."packing_system_menus"
    ADD CONSTRAINT "packing_system_menus_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."packing_user_permissions"
    ADD CONSTRAINT "packing_user_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."packing_user_permissions"
    ADD CONSTRAINT "packing_user_permissions_user_id_menu_path_key" UNIQUE ("user_id", "menu_path");



ALTER TABLE ONLY "public"."packing_users"
    ADD CONSTRAINT "packing_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."packing_users"
    ADD CONSTRAINT "packing_users_user_code_key" UNIQUE ("user_code");



ALTER TABLE ONLY "public"."packing_users"
    ADD CONSTRAINT "packing_users_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."picklist_item_reservations"
    ADD CONSTRAINT "picklist_item_reservations_pkey" PRIMARY KEY ("reservation_id");



ALTER TABLE ONLY "public"."picklist_items"
    ADD CONSTRAINT "picklist_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."picklists"
    ADD CONSTRAINT "picklists_picklist_code_key" UNIQUE ("picklist_code");



ALTER TABLE ONLY "public"."picklists"
    ADD CONSTRAINT "picklists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."preparation_area"
    ADD CONSTRAINT "preparation_area_pkey" PRIMARY KEY ("area_id");



ALTER TABLE ONLY "public"."preparation_area"
    ADD CONSTRAINT "preparation_area_warehouse_id_area_code_key" UNIQUE ("warehouse_id", "area_code");



ALTER TABLE ONLY "public"."preparation_order_item"
    ADD CONSTRAINT "preparation_order_item_order_id_line_no_key" UNIQUE ("order_id", "line_no");



ALTER TABLE ONLY "public"."preparation_order_item"
    ADD CONSTRAINT "preparation_order_item_pkey" PRIMARY KEY ("item_id");



ALTER TABLE ONLY "public"."preparation_order"
    ADD CONSTRAINT "preparation_order_pkey" PRIMARY KEY ("order_id");



ALTER TABLE ONLY "public"."preparation_order"
    ADD CONSTRAINT "preparation_order_warehouse_id_order_no_key" UNIQUE ("warehouse_id", "order_no");



ALTER TABLE ONLY "public"."production_logs"
    ADD CONSTRAINT "production_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."production_order_items"
    ADD CONSTRAINT "production_order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."production_order_items"
    ADD CONSTRAINT "production_order_items_production_order_id_material_sku_id_key" UNIQUE ("production_order_id", "material_sku_id");



ALTER TABLE ONLY "public"."production_orders"
    ADD CONSTRAINT "production_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."production_orders"
    ADD CONSTRAINT "production_orders_production_no_key" UNIQUE ("production_no");



ALTER TABLE ONLY "public"."production_plan_items"
    ADD CONSTRAINT "production_plan_items_pkey" PRIMARY KEY ("plan_item_id");



ALTER TABLE ONLY "public"."production_plan"
    ADD CONSTRAINT "production_plan_pkey" PRIMARY KEY ("plan_id");



ALTER TABLE ONLY "public"."production_plan"
    ADD CONSTRAINT "production_plan_plan_no_key" UNIQUE ("plan_no");



ALTER TABLE ONLY "public"."production_receipts"
    ADD CONSTRAINT "production_receipts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_order_items"
    ADD CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("poi_id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("po_id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_po_no_key" UNIQUE ("po_no");



ALTER TABLE ONLY "public"."receiving_route_clusters"
    ADD CONSTRAINT "receiving_route_clusters_pkey" PRIMARY KEY ("cluster_id");



ALTER TABLE ONLY "public"."receiving_route_clusters"
    ADD CONSTRAINT "receiving_route_clusters_plan_id_cluster_code_key" UNIQUE ("plan_id", "cluster_code");



ALTER TABLE ONLY "public"."receiving_route_plan_inputs"
    ADD CONSTRAINT "receiving_route_plan_inputs_pkey" PRIMARY KEY ("input_id");



ALTER TABLE ONLY "public"."receiving_route_plan_metrics"
    ADD CONSTRAINT "receiving_route_plan_metrics_pkey" PRIMARY KEY ("metric_id");



ALTER TABLE ONLY "public"."receiving_route_plan_metrics"
    ADD CONSTRAINT "receiving_route_plan_metrics_plan_id_metric_key_key" UNIQUE ("plan_id", "metric_key");



ALTER TABLE ONLY "public"."receiving_route_plans"
    ADD CONSTRAINT "receiving_route_plans_pkey" PRIMARY KEY ("plan_id");



ALTER TABLE ONLY "public"."receiving_route_plans"
    ADD CONSTRAINT "receiving_route_plans_plan_code_key" UNIQUE ("plan_code");



ALTER TABLE ONLY "public"."receiving_route_stop_items"
    ADD CONSTRAINT "receiving_route_stop_items_pkey" PRIMARY KEY ("stop_item_id");



ALTER TABLE ONLY "public"."receiving_route_stops"
    ADD CONSTRAINT "receiving_route_stops_pkey" PRIMARY KEY ("stop_id");



ALTER TABLE ONLY "public"."receiving_route_stops"
    ADD CONSTRAINT "receiving_route_stops_trip_id_sequence_no_key" UNIQUE ("trip_id", "sequence_no");



ALTER TABLE ONLY "public"."receiving_route_trips"
    ADD CONSTRAINT "receiving_route_trips_pkey" PRIMARY KEY ("trip_id");



ALTER TABLE ONLY "public"."receiving_route_trips"
    ADD CONSTRAINT "receiving_route_trips_plan_id_trip_code_key" UNIQUE ("plan_id", "trip_code");



ALTER TABLE ONLY "public"."replenishment_queue"
    ADD CONSTRAINT "replenishment_queue_pkey" PRIMARY KEY ("queue_id");



ALTER TABLE ONLY "public"."replenishment_rules"
    ADD CONSTRAINT "replenishment_rules_pkey" PRIMARY KEY ("rule_id");



ALTER TABLE ONLY "public"."replenishment_rules"
    ADD CONSTRAINT "replenishment_rules_warehouse_id_sku_id_pick_zone_id_key" UNIQUE ("warehouse_id", "sku_id", "pick_zone_id");



ALTER TABLE ONLY "public"."role_permission"
    ADD CONSTRAINT "role_permission_pkey" PRIMARY KEY ("role_id", "module_id");



ALTER TABLE ONLY "public"."sku_incompatibilities"
    ADD CONSTRAINT "sku_incompatibilities_pkey" PRIMARY KEY ("sku_id", "incompatible_sku_id");



ALTER TABLE ONLY "public"."sku_preparation_area_mapping"
    ADD CONSTRAINT "sku_preparation_area_mapping_pkey" PRIMARY KEY ("mapping_id");



ALTER TABLE ONLY "public"."sku_preparation_area_mapping"
    ADD CONSTRAINT "sku_preparation_area_mapping_sku_id_warehouse_id_preparatio_key" UNIQUE ("sku_id", "warehouse_id", "preparation_area_id");



ALTER TABLE ONLY "public"."sku_storage_profile"
    ADD CONSTRAINT "sku_storage_profile_pkey" PRIMARY KEY ("sku_id");



ALTER TABLE ONLY "public"."stock_replenishment_alerts"
    ADD CONSTRAINT "stock_replenishment_alerts_pkey" PRIMARY KEY ("alert_id");



ALTER TABLE ONLY "public"."storage_strategy_conditions"
    ADD CONSTRAINT "storage_strategy_conditions_pkey" PRIMARY KEY ("condition_id");



ALTER TABLE ONLY "public"."storage_strategy"
    ADD CONSTRAINT "storage_strategy_pkey" PRIMARY KEY ("strategy_id");



ALTER TABLE ONLY "public"."storage_strategy_scope"
    ADD CONSTRAINT "storage_strategy_scope_pkey" PRIMARY KEY ("scope_id");



ALTER TABLE ONLY "public"."storage_strategy_sku_settings"
    ADD CONSTRAINT "storage_strategy_sku_settings_pkey" PRIMARY KEY ("strategy_id", "sku_id");



ALTER TABLE ONLY "public"."storage_strategy"
    ADD CONSTRAINT "storage_strategy_warehouse_id_strategy_code_key" UNIQUE ("warehouse_id", "strategy_code");



ALTER TABLE ONLY "public"."master_customer"
    ADD CONSTRAINT "unique_customer_code" UNIQUE ("customer_code");



ALTER TABLE ONLY "public"."master_location"
    ADD CONSTRAINT "unique_location_code" UNIQUE ("location_code");



ALTER TABLE ONLY "public"."picklist_item_reservations"
    ADD CONSTRAINT "unique_picklist_item_balance" UNIQUE ("picklist_item_id", "balance_id");



ALTER TABLE ONLY "public"."master_supplier"
    ADD CONSTRAINT "unique_supplier_code" UNIQUE ("supplier_code");



ALTER TABLE ONLY "public"."master_supplier"
    ADD CONSTRAINT "unique_supplier_name" UNIQUE ("supplier_name");



ALTER TABLE ONLY "public"."master_warehouse"
    ADD CONSTRAINT "unique_warehouse_name" UNIQUE ("warehouse_name");



ALTER TABLE ONLY "public"."wms_inventory_balances"
    ADD CONSTRAINT "uq_wms_inventory_balances_sku_location" UNIQUE ("warehouse_id", "location_id", "sku_id", "pallet_id");



ALTER TABLE ONLY "public"."user_role"
    ADD CONSTRAINT "user_role_pkey" PRIMARY KEY ("user_id", "role_id");



ALTER TABLE ONLY "public"."wms_inventory_balances"
    ADD CONSTRAINT "wms_inventory_balances_pkey" PRIMARY KEY ("balance_id");



ALTER TABLE ONLY "public"."wms_inventory_ledger"
    ADD CONSTRAINT "wms_inventory_ledger_pkey" PRIMARY KEY ("ledger_id");



ALTER TABLE ONLY "public"."wms_loadlist_picklists"
    ADD CONSTRAINT "wms_loadlist_picklists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wms_loadlist_picklists"
    ADD CONSTRAINT "wms_loadlist_picklists_unique" UNIQUE ("loadlist_id", "picklist_id");



ALTER TABLE ONLY "public"."wms_move_items"
    ADD CONSTRAINT "wms_move_items_pkey" PRIMARY KEY ("move_item_id");



ALTER TABLE ONLY "public"."wms_moves"
    ADD CONSTRAINT "wms_moves_move_no_key" UNIQUE ("move_no");



ALTER TABLE ONLY "public"."wms_moves"
    ADD CONSTRAINT "wms_moves_pkey" PRIMARY KEY ("move_id");



ALTER TABLE ONLY "public"."wms_order_items"
    ADD CONSTRAINT "wms_order_items_pkey" PRIMARY KEY ("order_item_id");



ALTER TABLE ONLY "public"."wms_orders"
    ADD CONSTRAINT "wms_orders_order_no_key" UNIQUE ("order_no");



ALTER TABLE ONLY "public"."wms_orders"
    ADD CONSTRAINT "wms_orders_pkey" PRIMARY KEY ("order_id");



ALTER TABLE ONLY "public"."wms_receive_items"
    ADD CONSTRAINT "wms_receive_items_pkey" PRIMARY KEY ("item_id");



ALTER TABLE ONLY "public"."wms_receives"
    ADD CONSTRAINT "wms_receives_pkey" PRIMARY KEY ("receive_id");



ALTER TABLE ONLY "public"."wms_receives"
    ADD CONSTRAINT "wms_receives_receive_no_key" UNIQUE ("receive_no");



ALTER TABLE ONLY "public"."wms_stock_import_batches"
    ADD CONSTRAINT "wms_stock_import_batches_pkey" PRIMARY KEY ("batch_id");



ALTER TABLE ONLY "public"."wms_stock_import_staging"
    ADD CONSTRAINT "wms_stock_import_staging_pkey" PRIMARY KEY ("staging_id");



ALTER TABLE ONLY "public"."wms_stock_replenishment_alerts"
    ADD CONSTRAINT "wms_stock_replenishment_alerts_pkey" PRIMARY KEY ("alert_id");



CREATE INDEX "idx_balances_fefo_fifo" ON "public"."wms_inventory_balances" USING "btree" ("warehouse_id", "location_id", "sku_id", "expiry_date", "production_date", "created_at") WHERE ("reserved_piece_qty" > (0)::numeric);



CREATE INDEX "idx_bom_sku_bom_id" ON "public"."bom_sku" USING "btree" ("bom_id");



CREATE INDEX "idx_bom_sku_finished_sku" ON "public"."bom_sku" USING "btree" ("finished_sku_id");



CREATE INDEX "idx_bom_sku_material_sku" ON "public"."bom_sku" USING "btree" ("material_sku_id");



CREATE INDEX "idx_bom_sku_status" ON "public"."bom_sku" USING "btree" ("status");



CREATE INDEX "idx_bonus_face_sheet_items_face_sheet" ON "public"."bonus_face_sheet_items" USING "btree" ("face_sheet_id");



CREATE INDEX "idx_bonus_face_sheet_items_package" ON "public"."bonus_face_sheet_items" USING "btree" ("package_id");



CREATE INDEX "idx_bonus_face_sheet_packages_face_sheet" ON "public"."bonus_face_sheet_packages" USING "btree" ("face_sheet_id");



CREATE INDEX "idx_bonus_face_sheet_packages_order_no" ON "public"."bonus_face_sheet_packages" USING "btree" ("order_no");



CREATE INDEX "idx_bonus_face_sheets_created_date" ON "public"."bonus_face_sheets" USING "btree" ("created_date");



CREATE INDEX "idx_bonus_face_sheets_status" ON "public"."bonus_face_sheets" USING "btree" ("status");



CREATE INDEX "idx_bonus_face_sheets_warehouse" ON "public"."bonus_face_sheets" USING "btree" ("warehouse_id");



CREATE INDEX "idx_dashboard_calendar_attendees_employee" ON "public"."dashboard_calendar_attendees" USING "btree" ("employee_id");



CREATE INDEX "idx_dashboard_calendar_attendees_event" ON "public"."dashboard_calendar_attendees" USING "btree" ("event_id");



CREATE INDEX "idx_dashboard_calendar_events_created_by" ON "public"."dashboard_calendar_events" USING "btree" ("created_by");



CREATE INDEX "idx_dashboard_calendar_events_date" ON "public"."dashboard_calendar_events" USING "btree" ("event_date");



CREATE INDEX "idx_export_jobs_created_by" ON "public"."export_jobs" USING "btree" ("created_by");



CREATE INDEX "idx_export_jobs_data_entity" ON "public"."export_jobs" USING "btree" ("data_entity");



CREATE INDEX "idx_export_jobs_status" ON "public"."export_jobs" USING "btree" ("status");



CREATE INDEX "idx_face_sheet_item_reservations_balance" ON "public"."face_sheet_item_reservations" USING "btree" ("balance_id");



CREATE INDEX "idx_face_sheet_item_reservations_item" ON "public"."face_sheet_item_reservations" USING "btree" ("face_sheet_item_id");



CREATE INDEX "idx_face_sheet_item_reservations_status" ON "public"."face_sheet_item_reservations" USING "btree" ("status");



CREATE INDEX "idx_face_sheet_items_face_sheet" ON "public"."face_sheet_items" USING "btree" ("face_sheet_id");



CREATE INDEX "idx_face_sheet_items_order" ON "public"."face_sheet_items" USING "btree" ("order_id");



CREATE INDEX "idx_face_sheet_items_package" ON "public"."face_sheet_items" USING "btree" ("package_id");



CREATE INDEX "idx_face_sheet_items_sku" ON "public"."face_sheet_items" USING "btree" ("sku_id");



CREATE INDEX "idx_face_sheet_items_source_location" ON "public"."face_sheet_items" USING "btree" ("source_location_id");



CREATE INDEX "idx_face_sheet_items_status" ON "public"."face_sheet_items" USING "btree" ("status");



CREATE INDEX "idx_face_sheet_packages_barcode" ON "public"."face_sheet_packages" USING "btree" ("barcode_id");



CREATE INDEX "idx_face_sheet_packages_face_sheet" ON "public"."face_sheet_packages" USING "btree" ("face_sheet_id");



CREATE INDEX "idx_face_sheet_packages_order" ON "public"."face_sheet_packages" USING "btree" ("order_id");



CREATE INDEX "idx_face_sheets_checker_employees" ON "public"."face_sheets" USING "gin" ("checker_employee_ids");



CREATE INDEX "idx_face_sheets_created_date" ON "public"."face_sheets" USING "btree" ("created_date");



CREATE INDEX "idx_face_sheets_picker_employees" ON "public"."face_sheets" USING "gin" ("picker_employee_ids");



CREATE INDEX "idx_face_sheets_status" ON "public"."face_sheets" USING "btree" ("status");



CREATE INDEX "idx_face_sheets_warehouse" ON "public"."face_sheets" USING "btree" ("warehouse_id");



CREATE INDEX "idx_file_uploads_created_at" ON "public"."file_uploads" USING "btree" ("created_at");



CREATE INDEX "idx_file_uploads_uploaded_by" ON "public"."file_uploads" USING "btree" ("uploaded_by");



CREATE INDEX "idx_freight_rate_carrier_id" ON "public"."master_freight_rate" USING "btree" ("carrier_id");



CREATE INDEX "idx_freight_rate_created_at" ON "public"."master_freight_rate" USING "btree" ("created_at");



CREATE INDEX "idx_freight_rate_destination_province" ON "public"."master_freight_rate" USING "btree" ("destination_province");



CREATE INDEX "idx_freight_rate_effective_dates" ON "public"."master_freight_rate" USING "btree" ("effective_start_date", "effective_end_date");



CREATE INDEX "idx_freight_rate_origin_province" ON "public"."master_freight_rate" USING "btree" ("origin_province");



CREATE INDEX "idx_freight_rate_route_name" ON "public"."master_freight_rate" USING "btree" ("route_name");



CREATE INDEX "idx_import_jobs_created_by" ON "public"."import_jobs" USING "btree" ("created_by");



CREATE INDEX "idx_import_jobs_data_entity" ON "public"."import_jobs" USING "btree" ("data_entity");



CREATE INDEX "idx_import_jobs_file_id" ON "public"."import_jobs" USING "btree" ("file_id");



CREATE INDEX "idx_import_jobs_status" ON "public"."import_jobs" USING "btree" ("status");



CREATE INDEX "idx_loadlist_face_sheets_face_sheet" ON "public"."loadlist_face_sheets" USING "btree" ("face_sheet_id");



CREATE INDEX "idx_loadlist_face_sheets_loadlist" ON "public"."loadlist_face_sheets" USING "btree" ("loadlist_id");



CREATE INDEX "idx_loadlist_items_loadlist_id" ON "public"."loadlist_items" USING "btree" ("loadlist_id");



CREATE INDEX "idx_loadlist_items_order_id" ON "public"."loadlist_items" USING "btree" ("order_id");



CREATE INDEX "idx_loadlist_picklists_loadlist" ON "public"."wms_loadlist_picklists" USING "btree" ("loadlist_id");



CREATE INDEX "idx_loadlist_picklists_picklist" ON "public"."wms_loadlist_picklists" USING "btree" ("picklist_id");



CREATE INDEX "idx_loadlists_checker_employee" ON "public"."loadlists" USING "btree" ("checker_employee_id");



CREATE INDEX "idx_loadlists_created_at" ON "public"."loadlists" USING "btree" ("created_at");



CREATE INDEX "idx_loadlists_delivery_number" ON "public"."loadlists" USING "btree" ("delivery_number");



CREATE INDEX "idx_loadlists_helper_employee" ON "public"."loadlists" USING "btree" ("helper_employee_id");



CREATE INDEX "idx_loadlists_loading_door" ON "public"."loadlists" USING "btree" ("loading_door_number");



CREATE INDEX "idx_loadlists_loading_queue" ON "public"."loadlists" USING "btree" ("loading_queue_number");



CREATE INDEX "idx_loadlists_plan_id" ON "public"."loadlists" USING "btree" ("plan_id");



CREATE INDEX "idx_loadlists_status" ON "public"."loadlists" USING "btree" ("status");



CREATE INDEX "idx_loadlists_trip_id" ON "public"."loadlists" USING "btree" ("trip_id");



CREATE INDEX "idx_location_group_members_location" ON "public"."location_group_members" USING "btree" ("location_id");



CREATE INDEX "idx_location_sku_allocation_sku" ON "public"."location_sku_allocation" USING "btree" ("sku_id");



CREATE INDEX "idx_location_sku_allocation_strategy" ON "public"."location_sku_allocation" USING "btree" ("strategy_id");



CREATE INDEX "idx_master_customer_channel_source" ON "public"."master_customer" USING "btree" ("channel_source");



CREATE INDEX "idx_master_customer_code" ON "public"."master_customer" USING "btree" ("customer_code");



CREATE INDEX "idx_master_customer_district" ON "public"."master_customer" USING "btree" ("district");



CREATE INDEX "idx_master_customer_email" ON "public"."master_customer" USING "btree" ("email");



CREATE INDEX "idx_master_customer_hub" ON "public"."master_customer" USING "btree" ("hub");



CREATE INDEX "idx_master_customer_name" ON "public"."master_customer" USING "btree" ("customer_name");



CREATE INDEX "idx_master_customer_no_price_goods_active" ON "public"."master_customer_no_price_goods" USING "btree" ("is_active");



CREATE INDEX "idx_master_customer_no_price_goods_created_at" ON "public"."master_customer_no_price_goods" USING "btree" ("created_at");



CREATE INDEX "idx_master_customer_no_price_goods_customer_id" ON "public"."master_customer_no_price_goods" USING "btree" ("customer_id");



CREATE INDEX "idx_master_customer_no_price_goods_effective_dates" ON "public"."master_customer_no_price_goods" USING "btree" ("effective_start_date", "effective_end_date");



CREATE INDEX "idx_master_customer_phone" ON "public"."master_customer" USING "btree" ("phone");



CREATE INDEX "idx_master_customer_province" ON "public"."master_customer" USING "btree" ("province");



CREATE INDEX "idx_master_customer_segment" ON "public"."master_customer" USING "btree" ("customer_segment");



CREATE INDEX "idx_master_customer_status" ON "public"."master_customer" USING "btree" ("status");



CREATE INDEX "idx_master_customer_type" ON "public"."master_customer" USING "btree" ("customer_type");



CREATE INDEX "idx_master_employee_wms_role" ON "public"."master_employee" USING "btree" ("wms_role");



CREATE INDEX "idx_master_iv_document_type_active" ON "public"."master_iv_document_type" USING "btree" ("is_active");



CREATE INDEX "idx_master_iv_document_type_code" ON "public"."master_iv_document_type" USING "btree" ("doc_type_code");



CREATE INDEX "idx_master_iv_document_type_created_at" ON "public"."master_iv_document_type" USING "btree" ("created_at");



CREATE INDEX "idx_master_location_code" ON "public"."master_location" USING "btree" ("location_code");



CREATE INDEX "idx_master_location_status" ON "public"."master_location" USING "btree" ("active_status");



CREATE INDEX "idx_master_location_type" ON "public"."master_location" USING "btree" ("location_type");



CREATE INDEX "idx_master_location_warehouse" ON "public"."master_location" USING "btree" ("warehouse_id");



CREATE INDEX "idx_master_location_zone" ON "public"."master_location" USING "btree" ("zone");



CREATE INDEX "idx_master_permission_module_name" ON "public"."master_permission_module" USING "btree" ("module_name");



CREATE INDEX "idx_master_sku_barcode_search" ON "public"."master_sku" USING "btree" ("barcode") WHERE ("barcode" IS NOT NULL);



CREATE INDEX "idx_master_sku_brand" ON "public"."master_sku" USING "btree" ("brand");



CREATE INDEX "idx_master_sku_category" ON "public"."master_sku" USING "btree" ("category");



CREATE INDEX "idx_master_sku_created_at" ON "public"."master_sku" USING "btree" ("created_at");



CREATE INDEX "idx_master_sku_name" ON "public"."master_sku" USING "btree" ("sku_name");



CREATE INDEX "idx_master_sku_product_type" ON "public"."master_sku" USING "btree" ("product_type");



CREATE INDEX "idx_master_sku_status" ON "public"."master_sku" USING "btree" ("status");



CREATE INDEX "idx_master_supplier_code" ON "public"."master_supplier" USING "btree" ("supplier_code");



CREATE INDEX "idx_master_supplier_name" ON "public"."master_supplier" USING "btree" ("supplier_name");



CREATE INDEX "idx_master_supplier_product_category" ON "public"."master_supplier" USING "btree" ("product_category");



CREATE INDEX "idx_master_supplier_rating" ON "public"."master_supplier" USING "btree" ("rating");



CREATE INDEX "idx_master_supplier_service_category" ON "public"."master_supplier" USING "btree" ("service_category");



CREATE INDEX "idx_master_supplier_status" ON "public"."master_supplier" USING "btree" ("status");



CREATE INDEX "idx_master_supplier_type" ON "public"."master_supplier" USING "btree" ("supplier_type");



CREATE INDEX "idx_master_system_role_is_active" ON "public"."master_system_role" USING "btree" ("is_active");



CREATE INDEX "idx_master_system_role_name" ON "public"."master_system_role" USING "btree" ("role_name");



CREATE INDEX "idx_master_system_user_created_at" ON "public"."master_system_user" USING "btree" ("created_at");



CREATE INDEX "idx_master_system_user_email" ON "public"."master_system_user" USING "btree" ("email");



CREATE INDEX "idx_master_system_user_employee_id" ON "public"."master_system_user" USING "btree" ("employee_id");



CREATE INDEX "idx_master_system_user_is_active" ON "public"."master_system_user" USING "btree" ("is_active");



CREATE INDEX "idx_master_system_user_username" ON "public"."master_system_user" USING "btree" ("username");



CREATE INDEX "idx_master_vehicle_driver_id" ON "public"."master_vehicle" USING "btree" ("driver_id");



CREATE INDEX "idx_master_vehicle_location_base_id" ON "public"."master_vehicle" USING "btree" ("location_base_id");



CREATE INDEX "idx_master_vehicle_status" ON "public"."master_vehicle" USING "btree" ("current_status");



CREATE INDEX "idx_master_vehicle_type" ON "public"."master_vehicle" USING "btree" ("vehicle_type");



CREATE INDEX "idx_master_warehouse_name" ON "public"."master_warehouse" USING "btree" ("warehouse_name");



CREATE INDEX "idx_master_warehouse_status" ON "public"."master_warehouse" USING "btree" ("active_status");



CREATE INDEX "idx_master_warehouse_type" ON "public"."master_warehouse" USING "btree" ("warehouse_type");



CREATE INDEX "idx_material_issue_items_expiry" ON "public"."material_issue_items" USING "btree" ("expiry_date") WHERE ("expiry_date" IS NOT NULL);



CREATE INDEX "idx_material_issue_items_issue" ON "public"."material_issue_items" USING "btree" ("material_issue_id");



CREATE INDEX "idx_material_issue_items_location" ON "public"."material_issue_items" USING "btree" ("location_id");



CREATE INDEX "idx_material_issue_items_pallet" ON "public"."material_issue_items" USING "btree" ("pallet_id_external");



CREATE INDEX "idx_material_issue_items_sku" ON "public"."material_issue_items" USING "btree" ("material_sku_id");



CREATE INDEX "idx_material_issues_date" ON "public"."material_issues" USING "btree" ("issue_date");



CREATE INDEX "idx_material_issues_issued_at" ON "public"."material_issues" USING "btree" ("issued_at" DESC);



CREATE INDEX "idx_material_issues_location" ON "public"."material_issues" USING "btree" ("issue_location_id");



CREATE INDEX "idx_material_issues_material" ON "public"."material_issues" USING "btree" ("material_sku_id");



CREATE INDEX "idx_material_issues_no" ON "public"."material_issues" USING "btree" ("issue_no");



CREATE INDEX "idx_material_issues_order" ON "public"."material_issues" USING "btree" ("production_order_id");



CREATE INDEX "idx_material_requirements_finished_sku" ON "public"."material_requirements" USING "btree" ("finished_sku_id");



CREATE INDEX "idx_material_requirements_material_sku" ON "public"."material_requirements" USING "btree" ("material_sku_id");



CREATE INDEX "idx_material_requirements_plan_id" ON "public"."material_requirements" USING "btree" ("plan_id");



CREATE INDEX "idx_material_requirements_plan_item_id" ON "public"."material_requirements" USING "btree" ("plan_item_id");



CREATE INDEX "idx_material_requirements_required_date" ON "public"."material_requirements" USING "btree" ("required_date");



CREATE INDEX "idx_material_requirements_shortage" ON "public"."material_requirements" USING "btree" ("shortage_qty") WHERE ("shortage_qty" > (0)::numeric);



CREATE INDEX "idx_material_requirements_status" ON "public"."material_requirements" USING "btree" ("status");



CREATE UNIQUE INDEX "idx_material_requirements_unique" ON "public"."material_requirements" USING "btree" ("plan_id", "plan_item_id", "material_sku_id");



CREATE INDEX "idx_material_return_items_return" ON "public"."material_return_items" USING "btree" ("material_return_id");



CREATE INDEX "idx_material_return_items_sku" ON "public"."material_return_items" USING "btree" ("material_sku_id");



CREATE INDEX "idx_material_returns_date" ON "public"."material_returns" USING "btree" ("return_date");



CREATE INDEX "idx_material_returns_issue" ON "public"."material_returns" USING "btree" ("material_issue_id");



CREATE INDEX "idx_material_returns_order" ON "public"."material_returns" USING "btree" ("production_order_id");



CREATE INDEX "idx_material_returns_status" ON "public"."material_returns" USING "btree" ("status");



CREATE INDEX "idx_orders_matched_trip" ON "public"."wms_orders" USING "btree" ("matched_trip_id") WHERE ("matched_trip_id" IS NOT NULL);



CREATE INDEX "idx_orders_status" ON "public"."wms_orders" USING "btree" ("status");



CREATE INDEX "idx_packing_backup_orders_packed_at" ON "public"."packing_backup_orders" USING "btree" ("packed_at" DESC);



CREATE INDEX "idx_packing_backup_orders_tracking" ON "public"."packing_backup_orders" USING "btree" ("tracking_number");



CREATE INDEX "idx_packing_boxes_active" ON "public"."packing_boxes" USING "btree" ("is_active", "box_code");



CREATE INDEX "idx_packing_boxes_code" ON "public"."packing_boxes" USING "btree" ("box_code");



CREATE INDEX "idx_packing_history_packed_at" ON "public"."packing_history" USING "btree" ("packed_at" DESC);



CREATE INDEX "idx_packing_history_tracking" ON "public"."packing_history" USING "btree" ("tracking_number", "packed_at" DESC);



CREATE INDEX "idx_packing_order_items_order_id" ON "public"."packing_order_items" USING "btree" ("order_id");



CREATE INDEX "idx_packing_order_items_parent_sku" ON "public"."packing_order_items" USING "btree" ("parent_sku");



CREATE INDEX "idx_packing_orders_created" ON "public"."packing_orders" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_packing_orders_order_number" ON "public"."packing_orders" USING "btree" ("order_number");



CREATE INDEX "idx_packing_orders_platform" ON "public"."packing_orders" USING "btree" ("platform");



CREATE INDEX "idx_packing_orders_status" ON "public"."packing_orders" USING "btree" ("fulfillment_status", "packing_status");



CREATE INDEX "idx_packing_orders_tracking" ON "public"."packing_orders" USING "btree" ("tracking_number") WHERE ("tracking_number" IS NOT NULL);



CREATE INDEX "idx_packing_products_barcode" ON "public"."packing_products" USING "btree" ("barcode") WHERE ("barcode" IS NOT NULL);



CREATE INDEX "idx_packing_products_name_search" ON "public"."packing_products" USING "gin" ("product_name" "public"."gin_trgm_ops");



CREATE INDEX "idx_packing_products_parent_sku" ON "public"."packing_products" USING "btree" ("parent_sku");



CREATE INDEX "idx_packing_promotion_freebies_active" ON "public"."packing_promotion_freebies" USING "btree" ("is_active");



CREATE INDEX "idx_packing_promotion_freebies_barcode" ON "public"."packing_promotion_freebies" USING "btree" ("product_barcode");



CREATE INDEX "idx_packing_returns_order_number" ON "public"."packing_returns" USING "btree" ("order_number");



CREATE INDEX "idx_packing_returns_status" ON "public"."packing_returns" USING "btree" ("return_status");



CREATE INDEX "idx_packing_user_permissions_user_menu" ON "public"."packing_user_permissions" USING "btree" ("user_id", "menu_path");



CREATE INDEX "idx_packing_users_active" ON "public"."packing_users" USING "btree" ("is_active");



CREATE INDEX "idx_packing_users_username" ON "public"."packing_users" USING "btree" ("username");



CREATE INDEX "idx_picklist_item_reservations_balance_id" ON "public"."picklist_item_reservations" USING "btree" ("balance_id");



CREATE INDEX "idx_picklist_item_reservations_item_id" ON "public"."picklist_item_reservations" USING "btree" ("picklist_item_id");



CREATE INDEX "idx_picklist_item_reservations_reserved_at" ON "public"."picklist_item_reservations" USING "btree" ("reserved_at");



CREATE INDEX "idx_picklist_item_reservations_status" ON "public"."picklist_item_reservations" USING "btree" ("status");



CREATE INDEX "idx_picklist_items_order_id" ON "public"."picklist_items" USING "btree" ("order_id");



CREATE INDEX "idx_picklist_items_pack_no" ON "public"."picklist_items" USING "btree" ("pack_no");



CREATE INDEX "idx_picklist_items_picklist_id" ON "public"."picklist_items" USING "btree" ("picklist_id");



CREATE INDEX "idx_picklist_items_sku_id" ON "public"."picklist_items" USING "btree" ("sku_id");



CREATE INDEX "idx_picklist_items_source_location" ON "public"."picklist_items" USING "btree" ("source_location_id");



CREATE INDEX "idx_picklist_items_status" ON "public"."picklist_items" USING "btree" ("status");



CREATE INDEX "idx_picklist_items_stop_id" ON "public"."picklist_items" USING "btree" ("stop_id");



CREATE INDEX "idx_picklist_reservations_balance" ON "public"."picklist_item_reservations" USING "btree" ("balance_id");



CREATE INDEX "idx_picklist_reservations_status" ON "public"."picklist_item_reservations" USING "btree" ("status");



CREATE INDEX "idx_picklists_assigned_to" ON "public"."picklists" USING "btree" ("assigned_to_employee_id");



CREATE INDEX "idx_picklists_checker_employees" ON "public"."picklists" USING "gin" ("checker_employee_ids");



CREATE INDEX "idx_picklists_created_from" ON "public"."picklists" USING "btree" ("created_from");



CREATE INDEX "idx_picklists_loading_door" ON "public"."picklists" USING "btree" ("loading_door_number") WHERE ("loading_door_number" IS NOT NULL);



CREATE INDEX "idx_picklists_picker_employees" ON "public"."picklists" USING "gin" ("picker_employee_ids");



CREATE INDEX "idx_picklists_plan_id" ON "public"."picklists" USING "btree" ("plan_id");



CREATE INDEX "idx_picklists_status" ON "public"."picklists" USING "btree" ("status");



CREATE INDEX "idx_picklists_trip" ON "public"."picklists" USING "btree" ("trip_id") WHERE ("trip_id" IS NOT NULL);



CREATE INDEX "idx_picklists_trip_id" ON "public"."picklists" USING "btree" ("trip_id");



CREATE INDEX "idx_preparation_area_type" ON "public"."preparation_area" USING "btree" ("area_type");



CREATE INDEX "idx_preparation_area_warehouse" ON "public"."preparation_area" USING "btree" ("warehouse_id");



CREATE INDEX "idx_preparation_area_zone" ON "public"."preparation_area" USING "btree" ("zone");



CREATE INDEX "idx_preparation_order_assigned_to" ON "public"."preparation_order" USING "btree" ("assigned_to");



CREATE INDEX "idx_preparation_order_items_location" ON "public"."preparation_order_item" USING "btree" ("assigned_location_id");



CREATE INDEX "idx_preparation_order_items_order" ON "public"."preparation_order_item" USING "btree" ("order_id");



CREATE INDEX "idx_preparation_order_items_sku" ON "public"."preparation_order_item" USING "btree" ("sku_id");



CREATE INDEX "idx_preparation_order_items_status" ON "public"."preparation_order_item" USING "btree" ("status");



CREATE INDEX "idx_preparation_order_status" ON "public"."preparation_order" USING "btree" ("status");



CREATE INDEX "idx_preparation_order_warehouse" ON "public"."preparation_order" USING "btree" ("warehouse_id");



CREATE INDEX "idx_production_logs_created" ON "public"."production_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_production_logs_order" ON "public"."production_logs" USING "btree" ("production_order_id");



CREATE INDEX "idx_production_order_items_material" ON "public"."production_order_items" USING "btree" ("material_sku_id");



CREATE INDEX "idx_production_order_items_order" ON "public"."production_order_items" USING "btree" ("production_order_id");



CREATE INDEX "idx_production_orders_dates" ON "public"."production_orders" USING "btree" ("start_date", "due_date");



CREATE INDEX "idx_production_orders_plan" ON "public"."production_orders" USING "btree" ("plan_id");



CREATE INDEX "idx_production_orders_sku" ON "public"."production_orders" USING "btree" ("sku_id");



CREATE INDEX "idx_production_orders_status" ON "public"."production_orders" USING "btree" ("status");



CREATE INDEX "idx_production_plan_created_at" ON "public"."production_plan" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_production_plan_dates" ON "public"."production_plan" USING "btree" ("plan_start_date", "plan_end_date");



CREATE INDEX "idx_production_plan_items_plan_id" ON "public"."production_plan_items" USING "btree" ("plan_id");



CREATE INDEX "idx_production_plan_items_scheduled_dates" ON "public"."production_plan_items" USING "btree" ("scheduled_start_date", "scheduled_end_date");



CREATE INDEX "idx_production_plan_items_sku_id" ON "public"."production_plan_items" USING "btree" ("sku_id");



CREATE INDEX "idx_production_plan_items_status" ON "public"."production_plan_items" USING "btree" ("status");



CREATE UNIQUE INDEX "idx_production_plan_items_unique" ON "public"."production_plan_items" USING "btree" ("plan_id", "sku_id");



CREATE INDEX "idx_production_plan_plan_no" ON "public"."production_plan" USING "btree" ("plan_no");



CREATE INDEX "idx_production_plan_status" ON "public"."production_plan" USING "btree" ("status");



CREATE INDEX "idx_production_plan_warehouse" ON "public"."production_plan" USING "btree" ("warehouse_id");



CREATE INDEX "idx_production_receipts_location" ON "public"."production_receipts" USING "btree" ("receive_location_id");



CREATE INDEX "idx_production_receipts_lot" ON "public"."production_receipts" USING "btree" ("lot_no");



CREATE INDEX "idx_production_receipts_order" ON "public"."production_receipts" USING "btree" ("production_order_id");



CREATE INDEX "idx_production_receipts_product" ON "public"."production_receipts" USING "btree" ("product_sku_id");



CREATE INDEX "idx_production_receipts_received_at" ON "public"."production_receipts" USING "btree" ("received_at" DESC);



CREATE INDEX "idx_purchase_order_items_po_id" ON "public"."purchase_order_items" USING "btree" ("po_id");



CREATE INDEX "idx_purchase_order_items_sku_id" ON "public"."purchase_order_items" USING "btree" ("sku_id");



CREATE INDEX "idx_purchase_orders_plan_id" ON "public"."purchase_orders" USING "btree" ("plan_id");



CREATE INDEX "idx_purchase_orders_po_no" ON "public"."purchase_orders" USING "btree" ("po_no");



CREATE INDEX "idx_purchase_orders_status" ON "public"."purchase_orders" USING "btree" ("status");



CREATE INDEX "idx_purchase_orders_supplier_id" ON "public"."purchase_orders" USING "btree" ("supplier_id");



CREATE INDEX "idx_receiving_route_clusters_plan" ON "public"."receiving_route_clusters" USING "btree" ("plan_id");



CREATE INDEX "idx_receiving_route_plan_inputs_order" ON "public"."receiving_route_plan_inputs" USING "btree" ("order_id");



CREATE INDEX "idx_receiving_route_plan_inputs_plan" ON "public"."receiving_route_plan_inputs" USING "btree" ("plan_id");



CREATE INDEX "idx_receiving_route_plan_inputs_ready_due" ON "public"."receiving_route_plan_inputs" USING "btree" ("ready_time", "due_time");



CREATE INDEX "idx_receiving_route_plan_inputs_supplier" ON "public"."receiving_route_plan_inputs" USING "btree" ("supplier_id");



CREATE INDEX "idx_receiving_route_plans_date" ON "public"."receiving_route_plans" USING "btree" ("plan_date");



CREATE INDEX "idx_receiving_route_plans_status" ON "public"."receiving_route_plans" USING "btree" ("status");



CREATE INDEX "idx_receiving_route_plans_warehouse" ON "public"."receiving_route_plans" USING "btree" ("warehouse_id");



CREATE INDEX "idx_receiving_route_stops_customer" ON "public"."receiving_route_stops" USING "btree" ("customer_id");



CREATE INDEX "idx_receiving_route_stops_input" ON "public"."receiving_route_stops" USING "btree" ("input_id");



CREATE INDEX "idx_receiving_route_stops_manual_override" ON "public"."receiving_route_stops" USING "btree" ("manual_override");



CREATE INDEX "idx_receiving_route_stops_order" ON "public"."receiving_route_stops" USING "btree" ("order_id");



CREATE INDEX "idx_receiving_route_stops_plan" ON "public"."receiving_route_stops" USING "btree" ("plan_id");



CREATE INDEX "idx_receiving_route_stops_split_from" ON "public"."receiving_route_stops" USING "btree" ("split_from_stop_id");



CREATE INDEX "idx_receiving_route_stops_status" ON "public"."receiving_route_stops" USING "btree" ("status");



CREATE INDEX "idx_receiving_route_stops_supplier" ON "public"."receiving_route_stops" USING "btree" ("supplier_id");



CREATE INDEX "idx_receiving_route_stops_tags_order_ids" ON "public"."receiving_route_stops" USING "gin" ((("tags" -> 'order_ids'::"text"))) WHERE (("tags" IS NOT NULL) AND (("tags" ->> 'order_ids'::"text") IS NOT NULL));



CREATE INDEX "idx_receiving_route_stops_trip" ON "public"."receiving_route_stops" USING "btree" ("trip_id");



CREATE INDEX "idx_receiving_route_stops_type" ON "public"."receiving_route_stops" USING "btree" ("stop_type");



CREATE INDEX "idx_receiving_route_trips_driver" ON "public"."receiving_route_trips" USING "btree" ("driver_id");



CREATE INDEX "idx_receiving_route_trips_plan" ON "public"."receiving_route_trips" USING "btree" ("plan_id");



CREATE INDEX "idx_receiving_route_trips_pricing_mode" ON "public"."receiving_route_trips" USING "btree" ("pricing_mode");



CREATE INDEX "idx_receiving_route_trips_status" ON "public"."receiving_route_trips" USING "btree" ("trip_status");



CREATE INDEX "idx_receiving_route_trips_supplier" ON "public"."receiving_route_trips" USING "btree" ("supplier_id");



CREATE INDEX "idx_receiving_route_trips_vehicle" ON "public"."receiving_route_trips" USING "btree" ("vehicle_id");



CREATE INDEX "idx_replenishment_queue_assigned" ON "public"."replenishment_queue" USING "btree" ("assigned_to");



CREATE INDEX "idx_replenishment_queue_created" ON "public"."replenishment_queue" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_replenishment_queue_priority" ON "public"."replenishment_queue" USING "btree" ("priority" DESC);



CREATE INDEX "idx_replenishment_queue_sku" ON "public"."replenishment_queue" USING "btree" ("sku_id");



CREATE INDEX "idx_replenishment_queue_status" ON "public"."replenishment_queue" USING "btree" ("status");



CREATE INDEX "idx_replenishment_queue_warehouse" ON "public"."replenishment_queue" USING "btree" ("warehouse_id");



CREATE INDEX "idx_replenishment_queue_zone" ON "public"."replenishment_queue" USING "btree" ("pick_zone_id");



CREATE INDEX "idx_replenishment_rules_sku" ON "public"."replenishment_rules" USING "btree" ("sku_id");



CREATE INDEX "idx_replenishment_rules_status" ON "public"."replenishment_rules" USING "btree" ("status");



CREATE INDEX "idx_replenishment_rules_warehouse" ON "public"."replenishment_rules" USING "btree" ("warehouse_id");



CREATE INDEX "idx_replenishment_rules_zone" ON "public"."replenishment_rules" USING "btree" ("pick_zone_id");



CREATE INDEX "idx_role_permission_module_id" ON "public"."role_permission" USING "btree" ("module_id");



CREATE INDEX "idx_role_permission_role_id" ON "public"."role_permission" USING "btree" ("role_id");



CREATE INDEX "idx_route_plans_published" ON "public"."receiving_route_plans" USING "btree" ("status", "created_at" DESC) WHERE ("status" = ANY (ARRAY['published'::"public"."receiving_route_plan_status_enum", 'ready_to_load'::"public"."receiving_route_plan_status_enum", 'in_transit'::"public"."receiving_route_plan_status_enum"]));



CREATE INDEX "idx_route_plans_status" ON "public"."receiving_route_plans" USING "btree" ("status");



CREATE INDEX "idx_route_stop_items_order" ON "public"."receiving_route_stop_items" USING "btree" ("order_id");



CREATE INDEX "idx_route_stop_items_plan" ON "public"."receiving_route_stop_items" USING "btree" ("plan_id");



CREATE INDEX "idx_route_stop_items_stop" ON "public"."receiving_route_stop_items" USING "btree" ("stop_id");



CREATE INDEX "idx_route_stop_items_trip" ON "public"."receiving_route_stop_items" USING "btree" ("trip_id");



CREATE INDEX "idx_sku_incompatibilities_lookup" ON "public"."sku_incompatibilities" USING "btree" ("incompatible_sku_id");



CREATE INDEX "idx_sku_preparation_mapping_area" ON "public"."sku_preparation_area_mapping" USING "btree" ("preparation_area_id");



CREATE INDEX "idx_sku_preparation_mapping_sku" ON "public"."sku_preparation_area_mapping" USING "btree" ("sku_id");



CREATE INDEX "idx_sku_preparation_mapping_warehouse" ON "public"."sku_preparation_area_mapping" USING "btree" ("warehouse_id");



CREATE INDEX "idx_sku_storage_profile_class" ON "public"."sku_storage_profile" USING "btree" ("storage_class");



CREATE INDEX "idx_stock_alerts_created" ON "public"."stock_replenishment_alerts" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_stock_alerts_created_at" ON "public"."wms_stock_replenishment_alerts" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_stock_alerts_location" ON "public"."stock_replenishment_alerts" USING "btree" ("location_id");



CREATE INDEX "idx_stock_alerts_pick_location" ON "public"."wms_stock_replenishment_alerts" USING "btree" ("pick_location_id");



CREATE INDEX "idx_stock_alerts_priority" ON "public"."wms_stock_replenishment_alerts" USING "btree" ("priority" DESC, "created_at" DESC) WHERE ("status" = 'pending'::"public"."stock_alert_status_enum");



CREATE INDEX "idx_stock_alerts_sku" ON "public"."stock_replenishment_alerts" USING "btree" ("sku_id");



CREATE INDEX "idx_stock_alerts_status" ON "public"."wms_stock_replenishment_alerts" USING "btree" ("status") WHERE ("status" = ANY (ARRAY['pending'::"public"."stock_alert_status_enum", 'in_progress'::"public"."stock_alert_status_enum"]));



CREATE INDEX "idx_stock_alerts_warehouse_sku" ON "public"."wms_stock_replenishment_alerts" USING "btree" ("warehouse_id", "sku_id");



CREATE INDEX "idx_stock_import_batches_created_at" ON "public"."wms_stock_import_batches" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_stock_import_batches_status" ON "public"."wms_stock_import_batches" USING "btree" ("status");



CREATE INDEX "idx_stock_import_batches_warehouse" ON "public"."wms_stock_import_batches" USING "btree" ("warehouse_id");



CREATE INDEX "idx_stock_import_staging_batch" ON "public"."wms_stock_import_staging" USING "btree" ("import_batch_id");



CREATE INDEX "idx_stock_import_staging_location" ON "public"."wms_stock_import_staging" USING "btree" ("location_id");



CREATE INDEX "idx_stock_import_staging_sku" ON "public"."wms_stock_import_staging" USING "btree" ("sku_id");



CREATE INDEX "idx_stock_import_staging_status" ON "public"."wms_stock_import_staging" USING "btree" ("processing_status");



CREATE INDEX "idx_storage_strategy_conditions_type" ON "public"."storage_strategy_conditions" USING "btree" ("strategy_id", "condition_type");



CREATE INDEX "idx_storage_strategy_scope_strategy" ON "public"."storage_strategy_scope" USING "btree" ("strategy_id");



CREATE INDEX "idx_storage_strategy_sku_settings_sku" ON "public"."storage_strategy_sku_settings" USING "btree" ("sku_id");



CREATE INDEX "idx_user_role_role_id" ON "public"."user_role" USING "btree" ("role_id");



CREATE INDEX "idx_user_role_user_id" ON "public"."user_role" USING "btree" ("user_id");



CREATE INDEX "idx_warehouse_asset_code" ON "public"."master_warehouse_asset" USING "btree" ("asset_code");



CREATE INDEX "idx_warehouse_asset_created_at" ON "public"."master_warehouse_asset" USING "btree" ("created_at");



CREATE INDEX "idx_warehouse_asset_location_id" ON "public"."master_warehouse_asset" USING "btree" ("location_id");



CREATE INDEX "idx_warehouse_asset_status" ON "public"."master_warehouse_asset" USING "btree" ("status");



CREATE INDEX "idx_warehouse_asset_type" ON "public"."master_warehouse_asset" USING "btree" ("asset_type");



CREATE INDEX "idx_warehouse_asset_warehouse_id" ON "public"."master_warehouse_asset" USING "btree" ("warehouse_id");



CREATE INDEX "idx_wms_inventory_balances_location" ON "public"."wms_inventory_balances" USING "btree" ("location_id");



CREATE INDEX "idx_wms_inventory_balances_pallet" ON "public"."wms_inventory_balances" USING "btree" ("pallet_id");



CREATE INDEX "idx_wms_inventory_ledger_direction" ON "public"."wms_inventory_ledger" USING "btree" ("direction");



CREATE INDEX "idx_wms_inventory_ledger_location" ON "public"."wms_inventory_ledger" USING "btree" ("location_id");



CREATE INDEX "idx_wms_inventory_ledger_movement_at" ON "public"."wms_inventory_ledger" USING "btree" ("movement_at");



CREATE INDEX "idx_wms_inventory_ledger_ref_doc_id" ON "public"."wms_inventory_ledger" USING "btree" ("reference_doc_id");



CREATE INDEX "idx_wms_inventory_ledger_ref_doc_type" ON "public"."wms_inventory_ledger" USING "btree" ("reference_doc_type");



CREATE INDEX "idx_wms_inventory_ledger_sku" ON "public"."wms_inventory_ledger" USING "btree" ("sku_id");



CREATE INDEX "idx_wms_inventory_ledger_warehouse" ON "public"."wms_inventory_ledger" USING "btree" ("warehouse_id");



CREATE INDEX "idx_wms_loadlist_picklists_created_at" ON "public"."wms_loadlist_picklists" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_wms_loadlist_picklists_loadlist_id" ON "public"."wms_loadlist_picklists" USING "btree" ("loadlist_id");



CREATE INDEX "idx_wms_loadlist_picklists_picklist_id" ON "public"."wms_loadlist_picklists" USING "btree" ("picklist_id");



CREATE INDEX "idx_wms_move_items_assigned_role" ON "public"."wms_move_items" USING "btree" ("assigned_role");



CREATE INDEX "idx_wms_move_items_assigned_to" ON "public"."wms_move_items" USING "btree" ("assigned_to");



CREATE INDEX "idx_wms_move_items_assignment_type" ON "public"."wms_move_items" USING "btree" ("assignment_type");



CREATE INDEX "idx_wms_move_items_from_location" ON "public"."wms_move_items" USING "btree" ("from_location_id");



CREATE INDEX "idx_wms_move_items_move_id" ON "public"."wms_move_items" USING "btree" ("move_id");



CREATE INDEX "idx_wms_move_items_new_pallet" ON "public"."wms_move_items" USING "btree" ("new_pallet_id") WHERE ("new_pallet_id" IS NOT NULL);



CREATE INDEX "idx_wms_move_items_pallet" ON "public"."wms_move_items" USING "btree" ("pallet_id");



CREATE INDEX "idx_wms_move_items_parent_pallet" ON "public"."wms_move_items" USING "btree" ("parent_pallet_id") WHERE ("parent_pallet_id" IS NOT NULL);



CREATE INDEX "idx_wms_move_items_sku" ON "public"."wms_move_items" USING "btree" ("sku_id");



CREATE INDEX "idx_wms_move_items_status" ON "public"."wms_move_items" USING "btree" ("status");



CREATE INDEX "idx_wms_move_items_to_location" ON "public"."wms_move_items" USING "btree" ("to_location_id");



CREATE INDEX "idx_wms_moves_assigned_to" ON "public"."wms_moves" USING "btree" ("assigned_to");



CREATE INDEX "idx_wms_moves_created_source" ON "public"."wms_moves" USING "btree" ("created_source");



CREATE INDEX "idx_wms_moves_priority" ON "public"."wms_moves" USING "btree" ("priority");



CREATE INDEX "idx_wms_moves_source_receive" ON "public"."wms_moves" USING "btree" ("source_receive_id");



CREATE INDEX "idx_wms_moves_status" ON "public"."wms_moves" USING "btree" ("status");



CREATE INDEX "idx_wms_moves_type" ON "public"."wms_moves" USING "btree" ("move_type");



CREATE INDEX "idx_wms_order_items_line_no" ON "public"."wms_order_items" USING "btree" ("order_id", "line_no");



CREATE INDEX "idx_wms_order_items_order_id" ON "public"."wms_order_items" USING "btree" ("order_id");



CREATE INDEX "idx_wms_order_items_sku_id" ON "public"."wms_order_items" USING "btree" ("sku_id");



CREATE INDEX "idx_wms_orders_confirmed_at" ON "public"."wms_orders" USING "btree" ("confirmed_at");



CREATE INDEX "idx_wms_orders_customer_id" ON "public"."wms_orders" USING "btree" ("customer_id");



CREATE INDEX "idx_wms_orders_delivery_date" ON "public"."wms_orders" USING "btree" ("delivery_date");



CREATE INDEX "idx_wms_orders_delivery_type" ON "public"."wms_orders" USING "btree" ("delivery_type");



CREATE INDEX "idx_wms_orders_imported_at" ON "public"."wms_orders" USING "btree" ("imported_at");



CREATE INDEX "idx_wms_orders_matched_trip_id" ON "public"."wms_orders" USING "btree" ("matched_trip_id");



CREATE INDEX "idx_wms_orders_order_date" ON "public"."wms_orders" USING "btree" ("order_date");



CREATE INDEX "idx_wms_orders_order_no" ON "public"."wms_orders" USING "btree" ("order_no");



CREATE INDEX "idx_wms_orders_order_type" ON "public"."wms_orders" USING "btree" ("order_type");



CREATE INDEX "idx_wms_orders_order_type_delivery_date" ON "public"."wms_orders" USING "btree" ("order_type", "delivery_date");



CREATE INDEX "idx_wms_orders_order_type_status" ON "public"."wms_orders" USING "btree" ("order_type", "status");



CREATE INDEX "idx_wms_orders_payment_type" ON "public"."wms_orders" USING "btree" ("payment_type");



CREATE INDEX "idx_wms_orders_sales_territory" ON "public"."wms_orders" USING "btree" ("sales_territory");



CREATE INDEX "idx_wms_orders_status" ON "public"."wms_orders" USING "btree" ("status");



CREATE INDEX "idx_wms_orders_status_confirmed_at" ON "public"."wms_orders" USING "btree" ("status", "confirmed_at");



CREATE INDEX "idx_wms_orders_warehouse_id" ON "public"."wms_orders" USING "btree" ("warehouse_id");



CREATE INDEX "idx_wms_receive_items_barcode" ON "public"."wms_receive_items" USING "btree" ("barcode");



CREATE INDEX "idx_wms_receive_items_created_by" ON "public"."wms_receive_items" USING "btree" ("created_by");



CREATE INDEX "idx_wms_receive_items_pallet_color" ON "public"."wms_receive_items" USING "btree" ("pallet_color");



CREATE INDEX "idx_wms_receive_items_pallet_id" ON "public"."wms_receive_items" USING "btree" ("pallet_id");



CREATE INDEX "idx_wms_receive_items_product_status" ON "public"."wms_receive_items" USING "btree" ("product_status");



CREATE INDEX "idx_wms_receive_items_production_date" ON "public"."wms_receive_items" USING "btree" ("production_date");



CREATE INDEX "idx_wms_receive_items_receive_id" ON "public"."wms_receive_items" USING "btree" ("receive_id");



CREATE INDEX "idx_wms_receive_items_received_date" ON "public"."wms_receive_items" USING "btree" ("received_date");



CREATE INDEX "idx_wms_receive_items_sku_id" ON "public"."wms_receive_items" USING "btree" ("sku_id");



CREATE INDEX "idx_wms_receives_created_by" ON "public"."wms_receives" USING "btree" ("created_by");



CREATE INDEX "idx_wms_receives_customer_id" ON "public"."wms_receives" USING "btree" ("customer_id");



CREATE INDEX "idx_wms_receives_receive_date" ON "public"."wms_receives" USING "btree" ("receive_date");



CREATE INDEX "idx_wms_receives_receive_no" ON "public"."wms_receives" USING "btree" ("receive_no");



CREATE INDEX "idx_wms_receives_receive_type" ON "public"."wms_receives" USING "btree" ("receive_type");



CREATE INDEX "idx_wms_receives_reference_doc" ON "public"."wms_receives" USING "btree" ("reference_doc");



CREATE INDEX "idx_wms_receives_status" ON "public"."wms_receives" USING "btree" ("status");



CREATE INDEX "idx_wms_receives_supplier_id" ON "public"."wms_receives" USING "btree" ("supplier_id");



CREATE INDEX "idx_wms_receives_warehouse_id" ON "public"."wms_receives" USING "btree" ("warehouse_id");



CREATE UNIQUE INDEX "uq_location_sku_allocation_active" ON "public"."location_sku_allocation" USING "btree" ("location_id", "sku_id") WHERE ("effective_to" IS NULL);



CREATE UNIQUE INDEX "uq_receiving_route_plan_inputs_plan_receive" ON "public"."receiving_route_plan_inputs" USING "btree" ("plan_id", "receive_id") WHERE ("receive_id" IS NOT NULL);



CREATE UNIQUE INDEX "uq_receiving_route_plan_inputs_plan_receive_universal" ON "public"."receiving_route_plan_inputs" USING "btree" ("plan_id", "receive_universal_id") WHERE ("receive_universal_id" IS NOT NULL);



CREATE UNIQUE INDEX "uq_receiving_route_stops_input_once" ON "public"."receiving_route_stops" USING "btree" ("input_id") WHERE ("input_id" IS NOT NULL);



CREATE UNIQUE INDEX "uq_receiving_route_stops_unique_end" ON "public"."receiving_route_stops" USING "btree" ("trip_id") WHERE ("stop_type" = 'end'::"public"."receiving_route_stop_type_enum");



CREATE UNIQUE INDEX "uq_receiving_route_stops_unique_start" ON "public"."receiving_route_stops" USING "btree" ("trip_id") WHERE ("stop_type" = 'start'::"public"."receiving_route_stop_type_enum");



CREATE UNIQUE INDEX "uq_wms_inventory_balances_sku_location_v2" ON "public"."wms_inventory_balances" USING "btree" ("warehouse_id", COALESCE("location_id", ''::character varying), "sku_id", COALESCE("pallet_id", ''::character varying), COALESCE("pallet_id_external", ''::character varying), COALESCE("lot_no", ''::character varying), COALESCE("production_date", 'infinity'::"date"), COALESCE("expiry_date", 'infinity'::"date"));



CREATE UNIQUE INDEX "wms_inventory_balances_unique_idx" ON "public"."wms_inventory_balances" USING "btree" ("warehouse_id", "location_id", "sku_id", COALESCE("production_date", '1900-01-01'::"date"), COALESCE("expiry_date", '1900-01-01'::"date"), COALESCE("lot_no", ''::character varying));



CREATE OR REPLACE VIEW "public"."bonus_face_sheet_summary" AS
 SELECT "bfs"."id",
    "bfs"."face_sheet_no",
    "bfs"."warehouse_id",
    "bfs"."status",
    "bfs"."created_date",
    "bfs"."created_by",
    "bfs"."total_packages",
    "bfs"."total_items",
    "bfs"."total_orders",
    "bfs"."notes",
    "bfs"."created_at",
    "bfs"."updated_at",
    "count"(DISTINCT "bfsp"."id") AS "package_count",
    "count"(DISTINCT "bfsi"."id") AS "item_count"
   FROM (("public"."bonus_face_sheets" "bfs"
     LEFT JOIN "public"."bonus_face_sheet_packages" "bfsp" ON (("bfs"."id" = "bfsp"."face_sheet_id")))
     LEFT JOIN "public"."bonus_face_sheet_items" "bfsi" ON (("bfs"."id" = "bfsi"."face_sheet_id")))
  GROUP BY "bfs"."id";



CREATE OR REPLACE VIEW "public"."face_sheet_summary" AS
 SELECT "fs"."id",
    "fs"."face_sheet_no",
    "fs"."status",
    "fs"."created_date",
    "fs"."created_by",
    "fs"."total_packages",
    "fs"."total_items",
    "fs"."total_orders",
    "fs"."small_size_count",
    "fs"."large_size_count",
    "fs"."warehouse_id",
    "fs"."notes",
    "fs"."created_at",
    "fs"."updated_at",
    "count"("fsp"."id") AS "package_count"
   FROM ("public"."face_sheets" "fs"
     LEFT JOIN "public"."face_sheet_packages" "fsp" ON (("fsp"."face_sheet_id" = "fs"."id")))
  GROUP BY "fs"."id";



CREATE OR REPLACE TRIGGER "handle_updated_at_picklists" BEFORE UPDATE ON "public"."picklists" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "packing_box_stocks_updated_at" BEFORE UPDATE ON "public"."packing_box_stocks" FOR EACH ROW EXECUTE FUNCTION "public"."packing_update_updated_at_column"();



CREATE OR REPLACE TRIGGER "packing_boxes_updated_at" BEFORE UPDATE ON "public"."packing_boxes" FOR EACH ROW EXECUTE FUNCTION "public"."packing_update_updated_at_column"();



CREATE OR REPLACE TRIGGER "packing_order_items_updated_at" BEFORE UPDATE ON "public"."packing_order_items" FOR EACH ROW EXECUTE FUNCTION "public"."packing_update_updated_at_column"();



CREATE OR REPLACE TRIGGER "packing_orders_updated_at" BEFORE UPDATE ON "public"."packing_orders" FOR EACH ROW EXECUTE FUNCTION "public"."packing_update_updated_at_column"();



CREATE OR REPLACE TRIGGER "packing_products_updated_at" BEFORE UPDATE ON "public"."packing_products" FOR EACH ROW EXECUTE FUNCTION "public"."packing_update_updated_at_column"();



CREATE OR REPLACE TRIGGER "packing_promotion_freebies_updated_at" BEFORE UPDATE ON "public"."packing_promotion_freebies" FOR EACH ROW EXECUTE FUNCTION "public"."packing_update_updated_at_column"();



CREATE OR REPLACE TRIGGER "packing_returns_updated_at" BEFORE UPDATE ON "public"."packing_returns" FOR EACH ROW EXECUTE FUNCTION "public"."packing_update_updated_at_column"();



CREATE OR REPLACE TRIGGER "packing_user_permissions_updated_at" BEFORE UPDATE ON "public"."packing_user_permissions" FOR EACH ROW EXECUTE FUNCTION "public"."packing_update_updated_at_column"();



CREATE OR REPLACE TRIGGER "packing_users_updated_at" BEFORE UPDATE ON "public"."packing_users" FOR EACH ROW EXECUTE FUNCTION "public"."packing_update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_auto_update_order_status_on_issue" AFTER INSERT ON "public"."material_issues" FOR EACH ROW EXECUTE FUNCTION "public"."auto_update_order_status_on_issue"();



COMMENT ON TRIGGER "trg_auto_update_order_status_on_issue" ON "public"."material_issues" IS 'อัปเดตสถานะ production_order เป็น in_progress เมื่อเบิกวัตถุดิบ';



CREATE OR REPLACE TRIGGER "trg_check_order_completion" AFTER INSERT OR UPDATE OF "received_qty" ON "public"."production_receipts" FOR EACH ROW EXECUTE FUNCTION "public"."check_order_completion"();



COMMENT ON TRIGGER "trg_check_order_completion" ON "public"."production_receipts" IS 'ตรวจสอบและอัปเดตสถานะเป็น completed เมื่อผลิตครบ';



CREATE OR REPLACE TRIGGER "trg_create_ledger_from_receive_insert" AFTER INSERT ON "public"."wms_receive_items" FOR EACH ROW EXECUTE FUNCTION "public"."create_ledger_from_receive"();



CREATE OR REPLACE TRIGGER "trg_location_group_updated_at" BEFORE UPDATE ON "public"."location_group" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_location_sku_allocation_updated_at" BEFORE UPDATE ON "public"."location_sku_allocation" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_location_storage_profile_updated_at" BEFORE UPDATE ON "public"."location_storage_profile" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_preparation_area_updated_at" BEFORE UPDATE ON "public"."preparation_area" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_preparation_order_item_updated_at" BEFORE UPDATE ON "public"."preparation_order_item" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_preparation_order_updated_at" BEFORE UPDATE ON "public"."preparation_order" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_receiving_route_clusters_updated_at" BEFORE UPDATE ON "public"."receiving_route_clusters" FOR EACH ROW EXECUTE FUNCTION "public"."set_receiving_route_updated_at"();



CREATE OR REPLACE TRIGGER "trg_receiving_route_plan_inputs_updated_at" BEFORE UPDATE ON "public"."receiving_route_plan_inputs" FOR EACH ROW EXECUTE FUNCTION "public"."set_receiving_route_updated_at"();



CREATE OR REPLACE TRIGGER "trg_receiving_route_plans_updated_at" BEFORE UPDATE ON "public"."receiving_route_plans" FOR EACH ROW EXECUTE FUNCTION "public"."set_receiving_route_updated_at"();



CREATE OR REPLACE TRIGGER "trg_receiving_route_stops_updated_at" BEFORE UPDATE ON "public"."receiving_route_stops" FOR EACH ROW EXECUTE FUNCTION "public"."set_receiving_route_updated_at"();



CREATE OR REPLACE TRIGGER "trg_receiving_route_trips_updated_at" BEFORE UPDATE ON "public"."receiving_route_trips" FOR EACH ROW EXECUTE FUNCTION "public"."set_receiving_route_updated_at"();



CREATE OR REPLACE TRIGGER "trg_sku_preparation_area_mapping_updated_at" BEFORE UPDATE ON "public"."sku_preparation_area_mapping" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_sku_storage_profile_updated_at" BEFORE UPDATE ON "public"."sku_storage_profile" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_storage_strategy_scope_updated_at" BEFORE UPDATE ON "public"."storage_strategy_scope" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_storage_strategy_sku_settings_updated_at" BEFORE UPDATE ON "public"."storage_strategy_sku_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_storage_strategy_updated_at" BEFORE UPDATE ON "public"."storage_strategy" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_sync_inventory_ledger_to_balance" AFTER INSERT ON "public"."wms_inventory_ledger" FOR EACH ROW EXECUTE FUNCTION "public"."sync_inventory_ledger_to_balance"();



CREATE OR REPLACE TRIGGER "trg_sync_location_qty_from_balance" AFTER INSERT OR DELETE OR UPDATE ON "public"."wms_inventory_balances" FOR EACH ROW EXECUTE FUNCTION "public"."sync_location_qty_from_balance"();



CREATE OR REPLACE TRIGGER "trg_sync_plan_status_on_order_change" AFTER INSERT OR DELETE OR UPDATE OF "status" ON "public"."production_orders" FOR EACH ROW EXECUTE FUNCTION "public"."sync_production_plan_status"();



COMMENT ON TRIGGER "trg_sync_plan_status_on_order_change" ON "public"."production_orders" IS 'Sync สถานะ production_plan เมื่อมีการเปลี่ยนแปลง production_orders';



CREATE OR REPLACE TRIGGER "trg_sync_produced_qty_to_plan" AFTER UPDATE OF "produced_qty" ON "public"."production_orders" FOR EACH ROW WHEN (("old"."produced_qty" IS DISTINCT FROM "new"."produced_qty")) EXECUTE FUNCTION "public"."sync_produced_qty_to_plan"();



COMMENT ON TRIGGER "trg_sync_produced_qty_to_plan" ON "public"."production_orders" IS 'Sync produced_qty จาก orders ไปยัง plan items';



CREATE OR REPLACE TRIGGER "trg_update_ledger_from_receive" AFTER UPDATE ON "public"."wms_receive_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_ledger_from_receive"();



CREATE OR REPLACE TRIGGER "trg_update_ledger_from_receive_status" AFTER UPDATE ON "public"."wms_receives" FOR EACH ROW EXECUTE FUNCTION "public"."update_ledger_from_receive_status"();



CREATE OR REPLACE TRIGGER "trg_update_location_qty_delete" AFTER DELETE ON "public"."wms_inventory_balances" FOR EACH ROW EXECUTE FUNCTION "public"."update_location_current_qty"();



CREATE OR REPLACE TRIGGER "trg_update_location_qty_insert" AFTER INSERT ON "public"."wms_inventory_balances" FOR EACH ROW EXECUTE FUNCTION "public"."update_location_current_qty"();



CREATE OR REPLACE TRIGGER "trg_update_location_qty_update" AFTER UPDATE ON "public"."wms_inventory_balances" FOR EACH ROW WHEN ((("old"."total_piece_qty" IS DISTINCT FROM "new"."total_piece_qty") OR (("old"."location_id")::"text" IS DISTINCT FROM ("new"."location_id")::"text"))) EXECUTE FUNCTION "public"."update_location_current_qty"();



CREATE OR REPLACE TRIGGER "trg_update_plan_item_status" AFTER UPDATE OF "status" ON "public"."production_orders" FOR EACH ROW WHEN (("old"."status" IS DISTINCT FROM "new"."status")) EXECUTE FUNCTION "public"."update_plan_item_status"();



COMMENT ON TRIGGER "trg_update_plan_item_status" ON "public"."production_orders" IS 'อัปเดตสถานะ production_plan_items ตาม production_orders';



CREATE OR REPLACE TRIGGER "trg_update_wms_inventory_ledger_updated_at" BEFORE UPDATE ON "public"."wms_inventory_ledger" FOR EACH ROW EXECUTE FUNCTION "public"."update_wms_inventory_ledger_updated_at"();



CREATE OR REPLACE TRIGGER "trg_wms_inventory_balances_updated_at" BEFORE UPDATE ON "public"."wms_inventory_balances" FOR EACH ROW EXECUTE FUNCTION "public"."update_wms_inventory_balances_updated_at"();



CREATE OR REPLACE TRIGGER "trg_wms_move_items_updated_at" BEFORE UPDATE ON "public"."wms_move_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_wms_move_items_updated_at"();



CREATE OR REPLACE TRIGGER "trg_wms_moves_updated_at" BEFORE UPDATE ON "public"."wms_moves" FOR EACH ROW EXECUTE FUNCTION "public"."update_wms_moves_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_calculate_shipping_cost_formula" BEFORE INSERT OR UPDATE OF "pricing_mode", "base_price", "helper_fee", "extra_stop_fee", "extra_stops_count", "porterage_fee", "other_fees" ON "public"."receiving_route_trips" FOR EACH ROW EXECUTE FUNCTION "public"."calculate_shipping_cost_formula"();



CREATE OR REPLACE TRIGGER "trigger_check_shipping_cost_complete" AFTER UPDATE OF "shipping_cost" ON "public"."receiving_route_trips" FOR EACH ROW WHEN (("new"."shipping_cost" IS DISTINCT FROM "old"."shipping_cost")) EXECUTE FUNCTION "public"."check_shipping_cost_complete_and_publish"();



CREATE OR REPLACE TRIGGER "trigger_delivery_update_route" AFTER UPDATE ON "public"."wms_orders" FOR EACH ROW EXECUTE FUNCTION "public"."update_route_on_delivery"();



CREATE OR REPLACE TRIGGER "trigger_face_sheet_complete_update_orders" AFTER UPDATE ON "public"."face_sheets" FOR EACH ROW EXECUTE FUNCTION "public"."update_orders_on_face_sheet_complete"();



CREATE OR REPLACE TRIGGER "trigger_loadlist_complete_update_orders" AFTER UPDATE ON "public"."loadlists" FOR EACH ROW EXECUTE FUNCTION "public"."update_orders_on_loadlist_complete"();



CREATE OR REPLACE TRIGGER "trigger_picklist_assign_update_orders" AFTER UPDATE ON "public"."picklists" FOR EACH ROW WHEN ((("new"."status" = 'assigned'::"public"."picklist_status_enum") AND ("old"."status" IS DISTINCT FROM 'assigned'::"public"."picklist_status_enum"))) EXECUTE FUNCTION "public"."update_orders_on_picklist_assign"();



CREATE OR REPLACE TRIGGER "trigger_picklist_complete_update_orders_and_route" AFTER UPDATE ON "public"."picklists" FOR EACH ROW EXECUTE FUNCTION "public"."update_orders_and_route_on_picklist_complete"();



CREATE OR REPLACE TRIGGER "trigger_populate_sku_id" BEFORE INSERT ON "public"."face_sheet_items" FOR EACH ROW EXECUTE FUNCTION "public"."populate_face_sheet_item_sku_id"();



CREATE OR REPLACE TRIGGER "trigger_production_order_items_updated_at" BEFORE UPDATE ON "public"."production_order_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_production_orders_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_production_orders_updated_at" BEFORE UPDATE ON "public"."production_orders" FOR EACH ROW EXECUTE FUNCTION "public"."update_production_orders_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_reserve_stock_after_face_sheet_created" AFTER INSERT ON "public"."face_sheets" FOR EACH ROW WHEN ((("new"."status")::"text" = 'generated'::"text")) EXECUTE FUNCTION "public"."trigger_reserve_stock_after_face_sheet_created"();



COMMENT ON TRIGGER "trigger_reserve_stock_after_face_sheet_created" ON "public"."face_sheets" IS 'Automatically reserves stock for face sheet items after face sheet is created';



CREATE OR REPLACE TRIGGER "trigger_route_publish_update_orders" AFTER UPDATE ON "public"."receiving_route_plans" FOR EACH ROW EXECUTE FUNCTION "public"."update_orders_on_route_publish"();



CREATE OR REPLACE TRIGGER "trigger_update_bom_sku_updated_at" BEFORE UPDATE ON "public"."bom_sku" FOR EACH ROW EXECUTE FUNCTION "public"."update_bom_sku_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_bonus_face_sheet_updated_at" BEFORE UPDATE ON "public"."bonus_face_sheets" FOR EACH ROW EXECUTE FUNCTION "public"."update_bonus_face_sheet_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_dashboard_calendar_events_updated_at" BEFORE UPDATE ON "public"."dashboard_calendar_events" FOR EACH ROW EXECUTE FUNCTION "public"."update_dashboard_calendar_events_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_extra_stops_count" BEFORE INSERT OR UPDATE OF "total_stops" ON "public"."receiving_route_trips" FOR EACH ROW EXECUTE FUNCTION "public"."update_extra_stops_count"();



CREATE OR REPLACE TRIGGER "trigger_update_face_sheets_updated_at" BEFORE UPDATE ON "public"."face_sheets" FOR EACH ROW EXECUTE FUNCTION "public"."update_face_sheets_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_master_customer_updated_at" BEFORE UPDATE ON "public"."master_customer" FOR EACH ROW EXECUTE FUNCTION "public"."update_master_customer_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_master_location_updated_at" BEFORE UPDATE ON "public"."master_location" FOR EACH ROW EXECUTE FUNCTION "public"."update_master_location_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_master_supplier_updated_at" BEFORE UPDATE ON "public"."master_supplier" FOR EACH ROW EXECUTE FUNCTION "public"."update_master_supplier_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_master_vehicle_updated_at" BEFORE UPDATE ON "public"."master_vehicle" FOR EACH ROW EXECUTE FUNCTION "public"."update_master_vehicle_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_master_warehouse_updated_at" BEFORE UPDATE ON "public"."master_warehouse" FOR EACH ROW EXECUTE FUNCTION "public"."update_master_warehouse_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_picklist_item_reservations_updated_at" BEFORE UPDATE ON "public"."picklist_item_reservations" FOR EACH ROW EXECUTE FUNCTION "public"."update_picklist_item_reservations_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_purchase_orders_updated_at" BEFORE UPDATE ON "public"."purchase_orders" FOR EACH ROW EXECUTE FUNCTION "public"."update_purchase_orders_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_receive_image_count" BEFORE INSERT OR UPDATE OF "receive_images" ON "public"."wms_receives" FOR EACH ROW EXECUTE FUNCTION "public"."update_receive_image_count"();



CREATE OR REPLACE TRIGGER "trigger_update_reservation_timestamp" BEFORE UPDATE ON "public"."picklist_item_reservations" FOR EACH ROW EXECUTE FUNCTION "public"."update_reservation_timestamp"();



CREATE OR REPLACE TRIGGER "trigger_update_stock_alert_timestamp" BEFORE UPDATE ON "public"."stock_replenishment_alerts" FOR EACH ROW EXECUTE FUNCTION "public"."update_stock_alert_timestamp"();



CREATE OR REPLACE TRIGGER "trigger_validate_loadlist_status" BEFORE UPDATE ON "public"."loadlists" FOR EACH ROW WHEN (("old"."status" IS DISTINCT FROM "new"."status")) EXECUTE FUNCTION "public"."validate_loadlist_status_transition"();



CREATE OR REPLACE TRIGGER "trigger_validate_order_status" BEFORE UPDATE ON "public"."wms_orders" FOR EACH ROW WHEN (("old"."status" IS DISTINCT FROM "new"."status")) EXECUTE FUNCTION "public"."validate_order_status_transition"();



CREATE OR REPLACE TRIGGER "trigger_validate_picklist_status" BEFORE UPDATE ON "public"."picklists" FOR EACH ROW WHEN (("old"."status" IS DISTINCT FROM "new"."status")) EXECUTE FUNCTION "public"."validate_picklist_status_transition"();



CREATE OR REPLACE TRIGGER "trigger_validate_route_plan_status" BEFORE UPDATE ON "public"."receiving_route_plans" FOR EACH ROW WHEN (("old"."status" IS DISTINCT FROM "new"."status")) EXECUTE FUNCTION "public"."validate_route_plan_status_transition"();



CREATE OR REPLACE TRIGGER "update_face_sheet_item_reservations_updated_at" BEFORE UPDATE ON "public"."face_sheet_item_reservations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_loadlist_items_updated_at" BEFORE UPDATE ON "public"."loadlist_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



COMMENT ON TRIGGER "update_loadlist_items_updated_at" ON "public"."loadlist_items" IS 'อัปเดต updated_at อัตโนมัติเมื่อมีการแก้ไข loadlist item';



CREATE OR REPLACE TRIGGER "update_loadlists_updated_at" BEFORE UPDATE ON "public"."loadlists" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



COMMENT ON TRIGGER "update_loadlists_updated_at" ON "public"."loadlists" IS 'อัปเดต updated_at อัตโนมัติเมื่อมีการแก้ไข loadlist';



CREATE OR REPLACE TRIGGER "update_master_customer_no_price_goods_updated_at" BEFORE UPDATE ON "public"."master_customer_no_price_goods" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_master_employee_updated_at" BEFORE UPDATE ON "public"."master_employee" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_master_freight_rate_updated_at" BEFORE UPDATE ON "public"."master_freight_rate" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_master_iv_document_type_updated_at" BEFORE UPDATE ON "public"."master_iv_document_type" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_master_sku_updated_at" BEFORE UPDATE ON "public"."master_sku" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_master_system_role_updated_at" BEFORE UPDATE ON "public"."master_system_role" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_master_system_user_updated_at" BEFORE UPDATE ON "public"."master_system_user" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_master_warehouse_asset_updated_at" BEFORE UPDATE ON "public"."master_warehouse_asset" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_material_issue_items_updated_at" BEFORE UPDATE ON "public"."material_issue_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_material_issues_updated_at" BEFORE UPDATE ON "public"."material_issues" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_material_requirements_updated_at" BEFORE UPDATE ON "public"."material_requirements" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_material_return_items_updated_at" BEFORE UPDATE ON "public"."material_return_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_material_returns_updated_at" BEFORE UPDATE ON "public"."material_returns" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_order_status_on_face_sheet_in_progress" AFTER UPDATE ON "public"."face_sheets" FOR EACH ROW WHEN (((("new"."status")::"text" = 'picking'::"text") AND (("old"."status")::"text" IS DISTINCT FROM 'picking'::"text"))) EXECUTE FUNCTION "public"."update_order_status_on_face_sheet_in_progress"();



CREATE OR REPLACE TRIGGER "update_production_plan_items_updated_at" BEFORE UPDATE ON "public"."production_plan_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_production_plan_updated_at" BEFORE UPDATE ON "public"."production_plan" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_replenishment_queue_updated_at" BEFORE UPDATE ON "public"."replenishment_queue" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_replenishment_rules_updated_at" BEFORE UPDATE ON "public"."replenishment_rules" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_role_permission_updated_at" BEFORE UPDATE ON "public"."role_permission" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_wms_loadlist_picklists_updated_at" BEFORE UPDATE ON "public"."wms_loadlist_picklists" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_wms_order_items_updated_at" BEFORE UPDATE ON "public"."wms_order_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_wms_order_items_updated_at"();



CREATE OR REPLACE TRIGGER "update_wms_orders_updated_at" BEFORE UPDATE ON "public"."wms_orders" FOR EACH ROW EXECUTE FUNCTION "public"."update_wms_orders_updated_at"();



CREATE OR REPLACE TRIGGER "update_wms_receive_items_updated_at" BEFORE UPDATE ON "public"."wms_receive_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_wms_receive_items_updated_at"();



CREATE OR REPLACE TRIGGER "update_wms_receives_updated_at" BEFORE UPDATE ON "public"."wms_receives" FOR EACH ROW EXECUTE FUNCTION "public"."update_wms_receives_updated_at"();



ALTER TABLE ONLY "public"."bonus_face_sheet_items"
    ADD CONSTRAINT "bonus_face_sheet_items_face_sheet_id_fkey" FOREIGN KEY ("face_sheet_id") REFERENCES "public"."bonus_face_sheets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bonus_face_sheet_items"
    ADD CONSTRAINT "bonus_face_sheet_items_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "public"."wms_order_items"("order_item_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bonus_face_sheet_items"
    ADD CONSTRAINT "bonus_face_sheet_items_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."bonus_face_sheet_packages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bonus_face_sheet_packages"
    ADD CONSTRAINT "bonus_face_sheet_packages_face_sheet_id_fkey" FOREIGN KEY ("face_sheet_id") REFERENCES "public"."bonus_face_sheets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bonus_face_sheet_packages"
    ADD CONSTRAINT "bonus_face_sheet_packages_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."wms_orders"("order_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."dashboard_calendar_attendees"
    ADD CONSTRAINT "dashboard_calendar_attendees_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."master_employee"("employee_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dashboard_calendar_attendees"
    ADD CONSTRAINT "dashboard_calendar_attendees_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."dashboard_calendar_events"("event_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."export_jobs"
    ADD CONSTRAINT "export_jobs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."face_sheet_items"
    ADD CONSTRAINT "face_sheet_items_face_sheet_id_fkey" FOREIGN KEY ("face_sheet_id") REFERENCES "public"."face_sheets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."face_sheet_items"
    ADD CONSTRAINT "face_sheet_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."wms_orders"("order_id");



ALTER TABLE ONLY "public"."face_sheet_items"
    ADD CONSTRAINT "face_sheet_items_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "public"."wms_order_items"("order_item_id");



ALTER TABLE ONLY "public"."face_sheet_items"
    ADD CONSTRAINT "face_sheet_items_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."face_sheet_packages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."face_sheet_packages"
    ADD CONSTRAINT "face_sheet_packages_face_sheet_id_fkey" FOREIGN KEY ("face_sheet_id") REFERENCES "public"."face_sheets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."face_sheet_packages"
    ADD CONSTRAINT "face_sheet_packages_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."wms_orders"("order_id");



ALTER TABLE ONLY "public"."file_uploads"
    ADD CONSTRAINT "file_uploads_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."face_sheet_item_reservations"
    ADD CONSTRAINT "fk_balance" FOREIGN KEY ("balance_id") REFERENCES "public"."wms_inventory_balances"("balance_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."master_customer_no_price_goods"
    ADD CONSTRAINT "fk_customer_no_price_goods_customer" FOREIGN KEY ("customer_id") REFERENCES "public"."master_customer"("customer_id");



ALTER TABLE ONLY "public"."face_sheet_item_reservations"
    ADD CONSTRAINT "fk_face_sheet_item" FOREIGN KEY ("face_sheet_item_id") REFERENCES "public"."face_sheet_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."face_sheet_items"
    ADD CONSTRAINT "fk_face_sheet_items_sku" FOREIGN KEY ("sku_id") REFERENCES "public"."master_sku"("sku_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."bom_sku"
    ADD CONSTRAINT "fk_finished_sku" FOREIGN KEY ("finished_sku_id") REFERENCES "public"."master_sku"("sku_id");



ALTER TABLE ONLY "public"."master_freight_rate"
    ADD CONSTRAINT "fk_freight_rate_carrier_supplier" FOREIGN KEY ("carrier_id") REFERENCES "public"."master_supplier"("supplier_id");



ALTER TABLE ONLY "public"."wms_inventory_balances"
    ADD CONSTRAINT "fk_inventory_balances_last_move" FOREIGN KEY ("last_move_id") REFERENCES "public"."wms_moves"("move_id");



ALTER TABLE ONLY "public"."wms_inventory_balances"
    ADD CONSTRAINT "fk_inventory_balances_location" FOREIGN KEY ("location_id") REFERENCES "public"."master_location"("location_id");



ALTER TABLE ONLY "public"."wms_inventory_balances"
    ADD CONSTRAINT "fk_inventory_balances_sku" FOREIGN KEY ("sku_id") REFERENCES "public"."master_sku"("sku_id");



ALTER TABLE ONLY "public"."wms_inventory_balances"
    ADD CONSTRAINT "fk_inventory_balances_warehouse" FOREIGN KEY ("warehouse_id") REFERENCES "public"."master_warehouse"("warehouse_id");



ALTER TABLE ONLY "public"."wms_inventory_ledger"
    ADD CONSTRAINT "fk_inventory_ledger_created_by" FOREIGN KEY ("created_by") REFERENCES "public"."master_employee"("employee_id");



ALTER TABLE ONLY "public"."wms_inventory_ledger"
    ADD CONSTRAINT "fk_inventory_ledger_location" FOREIGN KEY ("location_id") REFERENCES "public"."master_location"("location_id");



ALTER TABLE ONLY "public"."wms_inventory_ledger"
    ADD CONSTRAINT "fk_inventory_ledger_move_item" FOREIGN KEY ("move_item_id") REFERENCES "public"."wms_move_items"("move_item_id");



ALTER TABLE ONLY "public"."wms_inventory_ledger"
    ADD CONSTRAINT "fk_inventory_ledger_receive_item" FOREIGN KEY ("receive_item_id") REFERENCES "public"."wms_receive_items"("item_id") ON DELETE SET NULL;



COMMENT ON CONSTRAINT "fk_inventory_ledger_receive_item" ON "public"."wms_inventory_ledger" IS 'เชื่อมโยงกับรายการรับสินค้า (Link to receive item)';



ALTER TABLE ONLY "public"."wms_inventory_ledger"
    ADD CONSTRAINT "fk_inventory_ledger_sku" FOREIGN KEY ("sku_id") REFERENCES "public"."master_sku"("sku_id");



ALTER TABLE ONLY "public"."wms_inventory_ledger"
    ADD CONSTRAINT "fk_inventory_ledger_warehouse" FOREIGN KEY ("warehouse_id") REFERENCES "public"."master_warehouse"("warehouse_id");



ALTER TABLE ONLY "public"."wms_receive_items"
    ADD CONSTRAINT "fk_items_location" FOREIGN KEY ("location_id") REFERENCES "public"."master_location"("location_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wms_receive_items"
    ADD CONSTRAINT "fk_items_receive" FOREIGN KEY ("receive_id") REFERENCES "public"."wms_receives"("receive_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wms_receive_items"
    ADD CONSTRAINT "fk_items_sku" FOREIGN KEY ("sku_id") REFERENCES "public"."master_sku"("sku_id");



ALTER TABLE ONLY "public"."loadlists"
    ADD CONSTRAINT "fk_loadlists_checker_employee" FOREIGN KEY ("checker_employee_id") REFERENCES "public"."master_employee"("employee_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."loadlists"
    ADD CONSTRAINT "fk_loadlists_helper_employee" FOREIGN KEY ("helper_employee_id") REFERENCES "public"."master_employee"("employee_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."master_freight_rate"
    ADD CONSTRAINT "fk_master_freight_rate_supplier" FOREIGN KEY ("carrier_id") REFERENCES "public"."master_supplier"("supplier_id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."master_location"
    ADD CONSTRAINT "fk_master_location_default_strategy" FOREIGN KEY ("default_strategy_id") REFERENCES "public"."storage_strategy"("strategy_id");



ALTER TABLE ONLY "public"."master_sku"
    ADD CONSTRAINT "fk_master_sku_default_strategy" FOREIGN KEY ("default_storage_strategy_id") REFERENCES "public"."storage_strategy"("strategy_id");



ALTER TABLE ONLY "public"."material_issue_items"
    ADD CONSTRAINT "fk_material_issue_items_issue" FOREIGN KEY ("material_issue_id") REFERENCES "public"."material_issues"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."material_returns"
    ADD CONSTRAINT "fk_material_returns_issue" FOREIGN KEY ("material_issue_id") REFERENCES "public"."material_issues"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bom_sku"
    ADD CONSTRAINT "fk_material_sku" FOREIGN KEY ("material_sku_id") REFERENCES "public"."master_sku"("sku_id");



ALTER TABLE ONLY "public"."wms_move_items"
    ADD CONSTRAINT "fk_move_items_assigned_to" FOREIGN KEY ("assigned_to") REFERENCES "public"."master_employee"("employee_id");



ALTER TABLE ONLY "public"."wms_move_items"
    ADD CONSTRAINT "fk_move_items_created_by" FOREIGN KEY ("created_by") REFERENCES "public"."master_employee"("employee_id");



ALTER TABLE ONLY "public"."wms_move_items"
    ADD CONSTRAINT "fk_move_items_executed_by" FOREIGN KEY ("executed_by") REFERENCES "public"."master_employee"("employee_id");



ALTER TABLE ONLY "public"."wms_move_items"
    ADD CONSTRAINT "fk_move_items_from_location" FOREIGN KEY ("from_location_id") REFERENCES "public"."master_location"("location_id");



ALTER TABLE ONLY "public"."wms_move_items"
    ADD CONSTRAINT "fk_move_items_move" FOREIGN KEY ("move_id") REFERENCES "public"."wms_moves"("move_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wms_move_items"
    ADD CONSTRAINT "fk_move_items_receive_item" FOREIGN KEY ("receive_item_id") REFERENCES "public"."wms_receive_items"("item_id");



ALTER TABLE ONLY "public"."wms_move_items"
    ADD CONSTRAINT "fk_move_items_sku" FOREIGN KEY ("sku_id") REFERENCES "public"."master_sku"("sku_id");



ALTER TABLE ONLY "public"."wms_move_items"
    ADD CONSTRAINT "fk_move_items_to_location" FOREIGN KEY ("to_location_id") REFERENCES "public"."master_location"("location_id");



ALTER TABLE ONLY "public"."wms_order_items"
    ADD CONSTRAINT "fk_order_items_order" FOREIGN KEY ("order_id") REFERENCES "public"."wms_orders"("order_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wms_orders"
    ADD CONSTRAINT "fk_orders_matched_trip" FOREIGN KEY ("matched_trip_id") REFERENCES "public"."receiving_route_trips"("trip_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."picklist_items"
    ADD CONSTRAINT "fk_picklist_items_employee" FOREIGN KEY ("picked_by_employee_id") REFERENCES "public"."master_employee"("employee_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."picklist_items"
    ADD CONSTRAINT "fk_picklist_items_location" FOREIGN KEY ("source_location_id") REFERENCES "public"."master_location"("location_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."picklist_items"
    ADD CONSTRAINT "fk_picklist_items_order" FOREIGN KEY ("order_id") REFERENCES "public"."wms_orders"("order_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."picklist_items"
    ADD CONSTRAINT "fk_picklist_items_order_item" FOREIGN KEY ("order_item_id") REFERENCES "public"."wms_order_items"("order_item_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."picklist_items"
    ADD CONSTRAINT "fk_picklist_items_picklist" FOREIGN KEY ("picklist_id") REFERENCES "public"."picklists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."picklist_items"
    ADD CONSTRAINT "fk_picklist_items_sku" FOREIGN KEY ("sku_id") REFERENCES "public"."master_sku"("sku_id");



ALTER TABLE ONLY "public"."picklist_items"
    ADD CONSTRAINT "fk_picklist_items_stop" FOREIGN KEY ("stop_id") REFERENCES "public"."receiving_route_stops"("stop_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."picklists"
    ADD CONSTRAINT "fk_picklists_employee" FOREIGN KEY ("assigned_to_employee_id") REFERENCES "public"."master_employee"("employee_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."picklists"
    ADD CONSTRAINT "fk_picklists_plan" FOREIGN KEY ("plan_id") REFERENCES "public"."receiving_route_plans"("plan_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."picklists"
    ADD CONSTRAINT "fk_picklists_trip" FOREIGN KEY ("trip_id") REFERENCES "public"."receiving_route_trips"("trip_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wms_receive_items"
    ADD CONSTRAINT "fk_receive_items_created_by" FOREIGN KEY ("created_by") REFERENCES "public"."master_employee"("employee_id");



ALTER TABLE ONLY "public"."wms_receives"
    ADD CONSTRAINT "fk_receives_created_by" FOREIGN KEY ("created_by") REFERENCES "public"."master_employee"("employee_id");



ALTER TABLE ONLY "public"."wms_receives"
    ADD CONSTRAINT "fk_receives_customer" FOREIGN KEY ("customer_id") REFERENCES "public"."master_customer"("customer_id");



ALTER TABLE ONLY "public"."wms_receives"
    ADD CONSTRAINT "fk_receives_employee" FOREIGN KEY ("received_by") REFERENCES "public"."master_employee"("employee_id");



ALTER TABLE ONLY "public"."wms_receives"
    ADD CONSTRAINT "fk_receives_supplier" FOREIGN KEY ("supplier_id") REFERENCES "public"."master_supplier"("supplier_id");



ALTER TABLE ONLY "public"."wms_receives"
    ADD CONSTRAINT "fk_receives_warehouse" FOREIGN KEY ("warehouse_id") REFERENCES "public"."master_warehouse"("warehouse_id");



ALTER TABLE ONLY "public"."receiving_route_clusters"
    ADD CONSTRAINT "fk_receiving_route_clusters_plan" FOREIGN KEY ("plan_id") REFERENCES "public"."receiving_route_plans"("plan_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."receiving_route_plan_inputs"
    ADD CONSTRAINT "fk_receiving_route_plan_inputs_order" FOREIGN KEY ("order_id") REFERENCES "public"."wms_orders"("order_id") ON DELETE SET NULL;



COMMENT ON CONSTRAINT "fk_receiving_route_plan_inputs_order" ON "public"."receiving_route_plan_inputs" IS 'Foreign key ไปยัง wms_orders สำหรับการจัดเส้นทางขนส่ง';



ALTER TABLE ONLY "public"."receiving_route_plan_inputs"
    ADD CONSTRAINT "fk_receiving_route_plan_inputs_plan" FOREIGN KEY ("plan_id") REFERENCES "public"."receiving_route_plans"("plan_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."receiving_route_plan_inputs"
    ADD CONSTRAINT "fk_receiving_route_plan_inputs_receive" FOREIGN KEY ("receive_id") REFERENCES "public"."wms_receives"("receive_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."receiving_route_plan_inputs"
    ADD CONSTRAINT "fk_receiving_route_plan_inputs_supplier" FOREIGN KEY ("supplier_id") REFERENCES "public"."master_supplier"("supplier_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."receiving_route_plan_metrics"
    ADD CONSTRAINT "fk_receiving_route_plan_metrics_plan" FOREIGN KEY ("plan_id") REFERENCES "public"."receiving_route_plans"("plan_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."receiving_route_plans"
    ADD CONSTRAINT "fk_receiving_route_plans_created_by" FOREIGN KEY ("created_by") REFERENCES "public"."master_employee"("employee_id");



ALTER TABLE ONLY "public"."receiving_route_plans"
    ADD CONSTRAINT "fk_receiving_route_plans_warehouse" FOREIGN KEY ("warehouse_id") REFERENCES "public"."master_warehouse"("warehouse_id");



ALTER TABLE ONLY "public"."receiving_route_stops"
    ADD CONSTRAINT "fk_receiving_route_stops_cluster" FOREIGN KEY ("cluster_id") REFERENCES "public"."receiving_route_clusters"("cluster_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."receiving_route_stops"
    ADD CONSTRAINT "fk_receiving_route_stops_customer" FOREIGN KEY ("customer_id") REFERENCES "public"."master_customer"("customer_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."receiving_route_stops"
    ADD CONSTRAINT "fk_receiving_route_stops_input" FOREIGN KEY ("input_id") REFERENCES "public"."receiving_route_plan_inputs"("input_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."receiving_route_stops"
    ADD CONSTRAINT "fk_receiving_route_stops_location" FOREIGN KEY ("location_id") REFERENCES "public"."master_location"("location_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."receiving_route_stops"
    ADD CONSTRAINT "fk_receiving_route_stops_order" FOREIGN KEY ("order_id") REFERENCES "public"."wms_orders"("order_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."receiving_route_stops"
    ADD CONSTRAINT "fk_receiving_route_stops_plan" FOREIGN KEY ("plan_id") REFERENCES "public"."receiving_route_plans"("plan_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."receiving_route_stops"
    ADD CONSTRAINT "fk_receiving_route_stops_receive" FOREIGN KEY ("receive_id") REFERENCES "public"."wms_receives"("receive_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."receiving_route_stops"
    ADD CONSTRAINT "fk_receiving_route_stops_split_from" FOREIGN KEY ("split_from_stop_id") REFERENCES "public"."receiving_route_stops"("stop_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."receiving_route_stops"
    ADD CONSTRAINT "fk_receiving_route_stops_supplier" FOREIGN KEY ("supplier_id") REFERENCES "public"."master_supplier"("supplier_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."receiving_route_stops"
    ADD CONSTRAINT "fk_receiving_route_stops_trip" FOREIGN KEY ("trip_id") REFERENCES "public"."receiving_route_trips"("trip_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."receiving_route_stops"
    ADD CONSTRAINT "fk_receiving_route_stops_warehouse" FOREIGN KEY ("warehouse_id") REFERENCES "public"."master_warehouse"("warehouse_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."receiving_route_trips"
    ADD CONSTRAINT "fk_receiving_route_trips_cluster" FOREIGN KEY ("cluster_id") REFERENCES "public"."receiving_route_clusters"("cluster_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."receiving_route_trips"
    ADD CONSTRAINT "fk_receiving_route_trips_driver" FOREIGN KEY ("driver_id") REFERENCES "public"."master_employee"("employee_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."receiving_route_trips"
    ADD CONSTRAINT "fk_receiving_route_trips_end_location" FOREIGN KEY ("end_location_id") REFERENCES "public"."master_location"("location_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."receiving_route_trips"
    ADD CONSTRAINT "fk_receiving_route_trips_freight_rate" FOREIGN KEY ("freight_rate_id") REFERENCES "public"."master_freight_rate"("freight_rate_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."receiving_route_trips"
    ADD CONSTRAINT "fk_receiving_route_trips_helper" FOREIGN KEY ("helper_id") REFERENCES "public"."master_employee"("employee_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."receiving_route_trips"
    ADD CONSTRAINT "fk_receiving_route_trips_plan" FOREIGN KEY ("plan_id") REFERENCES "public"."receiving_route_plans"("plan_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."receiving_route_trips"
    ADD CONSTRAINT "fk_receiving_route_trips_start_location" FOREIGN KEY ("start_location_id") REFERENCES "public"."master_location"("location_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."receiving_route_trips"
    ADD CONSTRAINT "fk_receiving_route_trips_supplier" FOREIGN KEY ("supplier_id") REFERENCES "public"."master_supplier"("supplier_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."receiving_route_trips"
    ADD CONSTRAINT "fk_receiving_route_trips_vehicle" FOREIGN KEY ("vehicle_id") REFERENCES "public"."master_vehicle"("vehicle_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."receiving_route_trips"
    ADD CONSTRAINT "fk_receiving_route_trips_warehouse" FOREIGN KEY ("warehouse_id") REFERENCES "public"."master_warehouse"("warehouse_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."receiving_route_stop_items"
    ADD CONSTRAINT "fk_route_stop_items_order" FOREIGN KEY ("order_id") REFERENCES "public"."wms_orders"("order_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."receiving_route_stop_items"
    ADD CONSTRAINT "fk_route_stop_items_order_item" FOREIGN KEY ("order_item_id") REFERENCES "public"."wms_order_items"("order_item_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."receiving_route_stop_items"
    ADD CONSTRAINT "fk_route_stop_items_plan" FOREIGN KEY ("plan_id") REFERENCES "public"."receiving_route_plans"("plan_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."receiving_route_stop_items"
    ADD CONSTRAINT "fk_route_stop_items_stop" FOREIGN KEY ("stop_id") REFERENCES "public"."receiving_route_stops"("stop_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."receiving_route_stop_items"
    ADD CONSTRAINT "fk_route_stop_items_trip" FOREIGN KEY ("trip_id") REFERENCES "public"."receiving_route_trips"("trip_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wms_stock_replenishment_alerts"
    ADD CONSTRAINT "fk_stock_alerts_location" FOREIGN KEY ("pick_location_id") REFERENCES "public"."master_location"("location_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wms_stock_replenishment_alerts"
    ADD CONSTRAINT "fk_stock_alerts_picklist" FOREIGN KEY ("picklist_id") REFERENCES "public"."picklists"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wms_stock_replenishment_alerts"
    ADD CONSTRAINT "fk_stock_alerts_sku" FOREIGN KEY ("sku_id") REFERENCES "public"."master_sku"("sku_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wms_stock_replenishment_alerts"
    ADD CONSTRAINT "fk_stock_alerts_warehouse" FOREIGN KEY ("warehouse_id") REFERENCES "public"."master_warehouse"("warehouse_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."master_vehicle"
    ADD CONSTRAINT "fk_vehicle_driver" FOREIGN KEY ("driver_id") REFERENCES "public"."master_employee"("employee_id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."master_vehicle"
    ADD CONSTRAINT "fk_vehicle_location_base" FOREIGN KEY ("location_base_id") REFERENCES "public"."master_warehouse"("warehouse_id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."master_location"
    ADD CONSTRAINT "fk_warehouse" FOREIGN KEY ("warehouse_id") REFERENCES "public"."master_warehouse"("warehouse_id");



ALTER TABLE ONLY "public"."master_warehouse_asset"
    ADD CONSTRAINT "fk_warehouse_asset_assigned_person" FOREIGN KEY ("assigned_person_id") REFERENCES "public"."master_employee"("employee_id");



ALTER TABLE ONLY "public"."master_warehouse_asset"
    ADD CONSTRAINT "fk_warehouse_asset_location" FOREIGN KEY ("location_id") REFERENCES "public"."master_location"("location_id");



ALTER TABLE ONLY "public"."master_warehouse_asset"
    ADD CONSTRAINT "fk_warehouse_asset_warehouse" FOREIGN KEY ("warehouse_id") REFERENCES "public"."master_warehouse"("warehouse_id");



ALTER TABLE ONLY "public"."wms_loadlist_picklists"
    ADD CONSTRAINT "fk_wms_loadlist_picklists_employee" FOREIGN KEY ("loaded_by_employee_id") REFERENCES "public"."master_employee"("employee_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wms_loadlist_picklists"
    ADD CONSTRAINT "fk_wms_loadlist_picklists_loadlist" FOREIGN KEY ("loadlist_id") REFERENCES "public"."loadlists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wms_loadlist_picklists"
    ADD CONSTRAINT "fk_wms_loadlist_picklists_picklist" FOREIGN KEY ("picklist_id") REFERENCES "public"."picklists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wms_moves"
    ADD CONSTRAINT "fk_wms_moves_approved_by" FOREIGN KEY ("approved_by") REFERENCES "public"."master_employee"("employee_id");



ALTER TABLE ONLY "public"."wms_moves"
    ADD CONSTRAINT "fk_wms_moves_assigned_to" FOREIGN KEY ("assigned_to") REFERENCES "public"."master_employee"("employee_id");



ALTER TABLE ONLY "public"."wms_moves"
    ADD CONSTRAINT "fk_wms_moves_created_by" FOREIGN KEY ("created_by") REFERENCES "public"."master_employee"("employee_id");



ALTER TABLE ONLY "public"."wms_moves"
    ADD CONSTRAINT "fk_wms_moves_from_wh" FOREIGN KEY ("from_warehouse_id") REFERENCES "public"."master_warehouse"("warehouse_id");



ALTER TABLE ONLY "public"."wms_moves"
    ADD CONSTRAINT "fk_wms_moves_requested_by" FOREIGN KEY ("requested_by") REFERENCES "public"."master_employee"("employee_id");



ALTER TABLE ONLY "public"."wms_moves"
    ADD CONSTRAINT "fk_wms_moves_source_receive" FOREIGN KEY ("source_receive_id") REFERENCES "public"."wms_receives"("receive_id");



ALTER TABLE ONLY "public"."wms_moves"
    ADD CONSTRAINT "fk_wms_moves_to_wh" FOREIGN KEY ("to_warehouse_id") REFERENCES "public"."master_warehouse"("warehouse_id");



ALTER TABLE ONLY "public"."wms_orders"
    ADD CONSTRAINT "fk_wms_orders_matched_trip" FOREIGN KEY ("matched_trip_id") REFERENCES "public"."receiving_route_trips"("trip_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."import_jobs"
    ADD CONSTRAINT "import_jobs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."import_jobs"
    ADD CONSTRAINT "import_jobs_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."file_uploads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loadlist_face_sheets"
    ADD CONSTRAINT "loadlist_face_sheets_face_sheet_id_fkey" FOREIGN KEY ("face_sheet_id") REFERENCES "public"."face_sheets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loadlist_face_sheets"
    ADD CONSTRAINT "loadlist_face_sheets_loadlist_id_fkey" FOREIGN KEY ("loadlist_id") REFERENCES "public"."loadlists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loadlist_items"
    ADD CONSTRAINT "loadlist_items_loadlist_id_fkey" FOREIGN KEY ("loadlist_id") REFERENCES "public"."loadlists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loadlist_items"
    ADD CONSTRAINT "loadlist_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."wms_orders"("order_id");



ALTER TABLE ONLY "public"."loadlist_picklists"
    ADD CONSTRAINT "loadlist_picklists_loadlist_id_fkey" FOREIGN KEY ("loadlist_id") REFERENCES "public"."loadlists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loadlist_picklists"
    ADD CONSTRAINT "loadlist_picklists_picklist_id_fkey" FOREIGN KEY ("picklist_id") REFERENCES "public"."picklists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loadlists"
    ADD CONSTRAINT "loadlists_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."receiving_route_plans"("plan_id");



ALTER TABLE ONLY "public"."location_group_members"
    ADD CONSTRAINT "location_group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."location_group"("group_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."location_group_members"
    ADD CONSTRAINT "location_group_members_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."master_location"("location_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."location_group"
    ADD CONSTRAINT "location_group_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."master_warehouse"("warehouse_id");



ALTER TABLE ONLY "public"."location_sku_allocation"
    ADD CONSTRAINT "location_sku_allocation_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."master_location"("location_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."location_sku_allocation"
    ADD CONSTRAINT "location_sku_allocation_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "public"."master_sku"("sku_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."location_sku_allocation"
    ADD CONSTRAINT "location_sku_allocation_strategy_id_fkey" FOREIGN KEY ("strategy_id") REFERENCES "public"."storage_strategy"("strategy_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."location_storage_profile"
    ADD CONSTRAINT "location_storage_profile_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."master_location"("location_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."master_system_user"
    ADD CONSTRAINT "master_system_user_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."master_employee"("employee_id");



ALTER TABLE ONLY "public"."material_issue_items"
    ADD CONSTRAINT "material_issue_items_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."master_location"("location_id");



ALTER TABLE ONLY "public"."material_issue_items"
    ADD CONSTRAINT "material_issue_items_material_sku_id_fkey" FOREIGN KEY ("material_sku_id") REFERENCES "public"."master_sku"("sku_id");



ALTER TABLE ONLY "public"."material_issue_items"
    ADD CONSTRAINT "material_issue_items_production_order_item_id_fkey" FOREIGN KEY ("production_order_item_id") REFERENCES "public"."production_order_items"("id");



ALTER TABLE ONLY "public"."material_issues"
    ADD CONSTRAINT "material_issues_issued_by_fkey" FOREIGN KEY ("issued_by") REFERENCES "public"."master_employee"("employee_id");



ALTER TABLE ONLY "public"."material_issues"
    ADD CONSTRAINT "material_issues_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."master_location"("location_id");



ALTER TABLE ONLY "public"."material_issues"
    ADD CONSTRAINT "material_issues_material_sku_id_fkey" FOREIGN KEY ("material_sku_id") REFERENCES "public"."master_sku"("sku_id");



ALTER TABLE ONLY "public"."material_issues"
    ADD CONSTRAINT "material_issues_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "public"."production_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."material_requirements"
    ADD CONSTRAINT "material_requirements_finished_sku_id_fkey" FOREIGN KEY ("finished_sku_id") REFERENCES "public"."master_sku"("sku_id");



ALTER TABLE ONLY "public"."material_requirements"
    ADD CONSTRAINT "material_requirements_material_sku_id_fkey" FOREIGN KEY ("material_sku_id") REFERENCES "public"."master_sku"("sku_id");



ALTER TABLE ONLY "public"."material_requirements"
    ADD CONSTRAINT "material_requirements_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."production_plan"("plan_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."material_requirements"
    ADD CONSTRAINT "material_requirements_plan_item_id_fkey" FOREIGN KEY ("plan_item_id") REFERENCES "public"."production_plan_items"("plan_item_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."material_requirements"
    ADD CONSTRAINT "material_requirements_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."master_supplier"("supplier_id");



ALTER TABLE ONLY "public"."material_return_items"
    ADD CONSTRAINT "material_return_items_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."master_location"("location_id");



ALTER TABLE ONLY "public"."material_return_items"
    ADD CONSTRAINT "material_return_items_material_issue_item_id_fkey" FOREIGN KEY ("material_issue_item_id") REFERENCES "public"."material_issue_items"("id");



ALTER TABLE ONLY "public"."material_return_items"
    ADD CONSTRAINT "material_return_items_material_return_id_fkey" FOREIGN KEY ("material_return_id") REFERENCES "public"."material_returns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."material_return_items"
    ADD CONSTRAINT "material_return_items_material_sku_id_fkey" FOREIGN KEY ("material_sku_id") REFERENCES "public"."master_sku"("sku_id");



ALTER TABLE ONLY "public"."material_returns"
    ADD CONSTRAINT "material_returns_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "public"."production_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."material_returns"
    ADD CONSTRAINT "material_returns_returned_by_fkey" FOREIGN KEY ("returned_by") REFERENCES "public"."master_employee"("employee_id");



ALTER TABLE ONLY "public"."packing_box_stock_history"
    ADD CONSTRAINT "packing_box_stock_history_box_id_fkey" FOREIGN KEY ("box_id") REFERENCES "public"."packing_boxes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."packing_box_stock_history"
    ADD CONSTRAINT "packing_box_stock_history_box_stock_id_fkey" FOREIGN KEY ("box_stock_id") REFERENCES "public"."packing_box_stocks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."packing_box_stocks"
    ADD CONSTRAINT "packing_box_stocks_box_id_fkey" FOREIGN KEY ("box_id") REFERENCES "public"."packing_boxes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."packing_history"
    ADD CONSTRAINT "packing_history_box_id_fkey" FOREIGN KEY ("box_id") REFERENCES "public"."packing_boxes"("id");



ALTER TABLE ONLY "public"."packing_order_items"
    ADD CONSTRAINT "packing_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."packing_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."packing_orders"
    ADD CONSTRAINT "packing_orders_actual_box_id_fkey" FOREIGN KEY ("actual_box_id") REFERENCES "public"."packing_boxes"("id");



ALTER TABLE ONLY "public"."packing_orders"
    ADD CONSTRAINT "packing_orders_recommended_box_id_fkey" FOREIGN KEY ("recommended_box_id") REFERENCES "public"."packing_boxes"("id");



ALTER TABLE ONLY "public"."packing_user_permissions"
    ADD CONSTRAINT "packing_user_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."packing_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."picklist_item_reservations"
    ADD CONSTRAINT "picklist_item_reservations_balance_id_fkey" FOREIGN KEY ("balance_id") REFERENCES "public"."wms_inventory_balances"("balance_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."picklist_item_reservations"
    ADD CONSTRAINT "picklist_item_reservations_picklist_item_id_fkey" FOREIGN KEY ("picklist_item_id") REFERENCES "public"."picklist_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."picklists"
    ADD CONSTRAINT "picklists_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."preparation_area"
    ADD CONSTRAINT "preparation_area_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."master_warehouse"("warehouse_id");



ALTER TABLE ONLY "public"."preparation_order_item"
    ADD CONSTRAINT "preparation_order_item_assigned_location_id_fkey" FOREIGN KEY ("assigned_location_id") REFERENCES "public"."master_location"("location_id");



ALTER TABLE ONLY "public"."preparation_order_item"
    ADD CONSTRAINT "preparation_order_item_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."preparation_order"("order_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."preparation_order_item"
    ADD CONSTRAINT "preparation_order_item_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "public"."master_sku"("sku_id");



ALTER TABLE ONLY "public"."preparation_order"
    ADD CONSTRAINT "preparation_order_preparation_area_id_fkey" FOREIGN KEY ("preparation_area_id") REFERENCES "public"."preparation_area"("area_id");



ALTER TABLE ONLY "public"."preparation_order"
    ADD CONSTRAINT "preparation_order_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."master_warehouse"("warehouse_id");



ALTER TABLE ONLY "public"."production_logs"
    ADD CONSTRAINT "production_logs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."master_employee"("employee_id");



ALTER TABLE ONLY "public"."production_logs"
    ADD CONSTRAINT "production_logs_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "public"."production_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."production_order_items"
    ADD CONSTRAINT "production_order_items_material_sku_id_fkey" FOREIGN KEY ("material_sku_id") REFERENCES "public"."master_sku"("sku_id");



ALTER TABLE ONLY "public"."production_order_items"
    ADD CONSTRAINT "production_order_items_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "public"."production_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."production_orders"
    ADD CONSTRAINT "production_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."master_employee"("employee_id");



ALTER TABLE ONLY "public"."production_orders"
    ADD CONSTRAINT "production_orders_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."production_plan"("plan_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."production_orders"
    ADD CONSTRAINT "production_orders_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "public"."master_sku"("sku_id");



ALTER TABLE ONLY "public"."production_plan"
    ADD CONSTRAINT "production_plan_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."master_employee"("employee_id");



ALTER TABLE ONLY "public"."production_plan"
    ADD CONSTRAINT "production_plan_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."master_employee"("employee_id");



ALTER TABLE ONLY "public"."production_plan_items"
    ADD CONSTRAINT "production_plan_items_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."production_plan"("plan_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."production_plan_items"
    ADD CONSTRAINT "production_plan_items_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "public"."master_sku"("sku_id");



ALTER TABLE ONLY "public"."production_plan"
    ADD CONSTRAINT "production_plan_production_area_id_fkey" FOREIGN KEY ("production_area_id") REFERENCES "public"."preparation_area"("area_id");



ALTER TABLE ONLY "public"."production_plan"
    ADD CONSTRAINT "production_plan_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."master_warehouse"("warehouse_id");



ALTER TABLE ONLY "public"."production_receipts"
    ADD CONSTRAINT "production_receipts_produced_by_fkey" FOREIGN KEY ("produced_by") REFERENCES "public"."master_employee"("employee_id");



ALTER TABLE ONLY "public"."production_receipts"
    ADD CONSTRAINT "production_receipts_product_sku_id_fkey" FOREIGN KEY ("product_sku_id") REFERENCES "public"."master_sku"("sku_id");



ALTER TABLE ONLY "public"."production_receipts"
    ADD CONSTRAINT "production_receipts_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "public"."production_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_order_items"
    ADD CONSTRAINT "purchase_order_items_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("po_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_order_items"
    ADD CONSTRAINT "purchase_order_items_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "public"."master_sku"("sku_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."master_supplier"("supplier_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."receiving_route_plans"
    ADD CONSTRAINT "receiving_route_plans_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."receiving_route_plans"
    ADD CONSTRAINT "receiving_route_plans_printed_by_fkey" FOREIGN KEY ("printed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."replenishment_queue"
    ADD CONSTRAINT "replenishment_queue_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."master_employee"("employee_id");



ALTER TABLE ONLY "public"."replenishment_queue"
    ADD CONSTRAINT "replenishment_queue_from_location_id_fkey" FOREIGN KEY ("from_location_id") REFERENCES "public"."master_location"("location_id");



ALTER TABLE ONLY "public"."replenishment_queue"
    ADD CONSTRAINT "replenishment_queue_move_id_fkey" FOREIGN KEY ("move_id") REFERENCES "public"."wms_moves"("move_id");



ALTER TABLE ONLY "public"."replenishment_queue"
    ADD CONSTRAINT "replenishment_queue_pick_zone_id_fkey" FOREIGN KEY ("pick_zone_id") REFERENCES "public"."preparation_area"("area_id");



ALTER TABLE ONLY "public"."replenishment_queue"
    ADD CONSTRAINT "replenishment_queue_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "public"."replenishment_rules"("rule_id");



ALTER TABLE ONLY "public"."replenishment_queue"
    ADD CONSTRAINT "replenishment_queue_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "public"."master_sku"("sku_id");



ALTER TABLE ONLY "public"."replenishment_queue"
    ADD CONSTRAINT "replenishment_queue_to_location_id_fkey" FOREIGN KEY ("to_location_id") REFERENCES "public"."master_location"("location_id");



ALTER TABLE ONLY "public"."replenishment_queue"
    ADD CONSTRAINT "replenishment_queue_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."master_warehouse"("warehouse_id");



ALTER TABLE ONLY "public"."replenishment_rules"
    ADD CONSTRAINT "replenishment_rules_pick_zone_id_fkey" FOREIGN KEY ("pick_zone_id") REFERENCES "public"."preparation_area"("area_id");



ALTER TABLE ONLY "public"."replenishment_rules"
    ADD CONSTRAINT "replenishment_rules_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "public"."master_sku"("sku_id");



ALTER TABLE ONLY "public"."replenishment_rules"
    ADD CONSTRAINT "replenishment_rules_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."master_warehouse"("warehouse_id");



ALTER TABLE ONLY "public"."role_permission"
    ADD CONSTRAINT "role_permission_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "public"."master_permission_module"("module_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."role_permission"
    ADD CONSTRAINT "role_permission_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."master_system_role"("role_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sku_incompatibilities"
    ADD CONSTRAINT "sku_incompatibilities_incompatible_sku_id_fkey" FOREIGN KEY ("incompatible_sku_id") REFERENCES "public"."master_sku"("sku_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sku_incompatibilities"
    ADD CONSTRAINT "sku_incompatibilities_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "public"."master_sku"("sku_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sku_preparation_area_mapping"
    ADD CONSTRAINT "sku_preparation_area_mapping_preparation_area_id_fkey" FOREIGN KEY ("preparation_area_id") REFERENCES "public"."preparation_area"("area_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sku_preparation_area_mapping"
    ADD CONSTRAINT "sku_preparation_area_mapping_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "public"."master_sku"("sku_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sku_preparation_area_mapping"
    ADD CONSTRAINT "sku_preparation_area_mapping_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."master_warehouse"("warehouse_id");



ALTER TABLE ONLY "public"."sku_storage_profile"
    ADD CONSTRAINT "sku_storage_profile_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "public"."master_sku"("sku_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_replenishment_alerts"
    ADD CONSTRAINT "stock_replenishment_alerts_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."storage_strategy_conditions"
    ADD CONSTRAINT "storage_strategy_conditions_strategy_id_fkey" FOREIGN KEY ("strategy_id") REFERENCES "public"."storage_strategy"("strategy_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."storage_strategy_scope"
    ADD CONSTRAINT "storage_strategy_scope_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."location_group"("group_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."storage_strategy_scope"
    ADD CONSTRAINT "storage_strategy_scope_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."master_location"("location_id");



ALTER TABLE ONLY "public"."storage_strategy_scope"
    ADD CONSTRAINT "storage_strategy_scope_strategy_id_fkey" FOREIGN KEY ("strategy_id") REFERENCES "public"."storage_strategy"("strategy_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."storage_strategy_scope"
    ADD CONSTRAINT "storage_strategy_scope_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."master_warehouse"("warehouse_id");



ALTER TABLE ONLY "public"."storage_strategy_sku_settings"
    ADD CONSTRAINT "storage_strategy_sku_settings_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "public"."master_sku"("sku_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."storage_strategy_sku_settings"
    ADD CONSTRAINT "storage_strategy_sku_settings_strategy_id_fkey" FOREIGN KEY ("strategy_id") REFERENCES "public"."storage_strategy"("strategy_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."storage_strategy"
    ADD CONSTRAINT "storage_strategy_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."master_warehouse"("warehouse_id");



ALTER TABLE ONLY "public"."user_role"
    ADD CONSTRAINT "user_role_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."master_system_role"("role_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_role"
    ADD CONSTRAINT "user_role_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."master_system_user"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wms_stock_import_batches"
    ADD CONSTRAINT "wms_stock_import_batches_warehouse_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."master_warehouse"("warehouse_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."wms_stock_import_staging"
    ADD CONSTRAINT "wms_stock_import_staging_batch_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."wms_stock_import_batches"("batch_id") ON DELETE CASCADE;



CREATE POLICY "Allow all for authenticated users" ON "public"."packing_backup_orders" USING (true);



CREATE POLICY "Allow all for authenticated users" ON "public"."packing_box_stock_history" USING (true);



CREATE POLICY "Allow all for authenticated users" ON "public"."packing_box_stocks" USING (true);



CREATE POLICY "Allow all for authenticated users" ON "public"."packing_boxes" USING (true);



CREATE POLICY "Allow all for authenticated users" ON "public"."packing_history" USING (true);



CREATE POLICY "Allow all for authenticated users" ON "public"."packing_order_items" USING (true);



CREATE POLICY "Allow all for authenticated users" ON "public"."packing_orders" USING (true);



CREATE POLICY "Allow all for authenticated users" ON "public"."packing_product_weight_profiles" USING (true);



CREATE POLICY "Allow all for authenticated users" ON "public"."packing_products" USING (true);



CREATE POLICY "Allow all for authenticated users" ON "public"."packing_promotion_freebies" USING (true);



CREATE POLICY "Allow all for authenticated users" ON "public"."packing_returns" USING (true);



CREATE POLICY "Allow all for authenticated users" ON "public"."packing_rules" USING (true);



CREATE POLICY "Allow all for authenticated users" ON "public"."packing_system_menus" USING (true);



CREATE POLICY "Allow all for authenticated users" ON "public"."packing_user_permissions" USING (true);



CREATE POLICY "Allow all for authenticated users" ON "public"."packing_users" USING (true);



CREATE POLICY "Allow all operations for service role" ON "public"."material_issues" USING (true);



CREATE POLICY "Allow all operations for service role" ON "public"."production_logs" USING (true);



CREATE POLICY "Allow all operations for service role" ON "public"."production_order_items" USING (true);



CREATE POLICY "Allow all operations for service role" ON "public"."production_orders" USING (true);



CREATE POLICY "Allow all operations for service role" ON "public"."production_receipts" USING (true);



CREATE POLICY "Allow authenticated users to insert face sheets" ON "public"."face_sheets" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated users to insert items" ON "public"."face_sheet_items" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated users to insert packages" ON "public"."face_sheet_packages" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated users to manage their own export jobs" ON "public"."export_jobs" USING (("auth"."uid"() = "created_by")) WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "Allow authenticated users to manage their own files" ON "public"."file_uploads" USING (("auth"."uid"() = "uploaded_by")) WITH CHECK (("auth"."uid"() = "uploaded_by"));



CREATE POLICY "Allow authenticated users to manage their own import jobs" ON "public"."import_jobs" USING (("auth"."uid"() = "created_by")) WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "Allow authenticated users to update face sheets" ON "public"."face_sheets" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated users to view face sheets" ON "public"."face_sheets" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated users to view items" ON "public"."face_sheet_items" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated users to view modules" ON "public"."master_permission_module" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated users to view packages" ON "public"."face_sheet_packages" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated users to view permissions" ON "public"."role_permission" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated users to view roles" ON "public"."master_system_role" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated users to view user roles" ON "public"."user_role" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated users to view users" ON "public"."master_system_user" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated write access" ON "public"."picklist_items" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow authenticated write access" ON "public"."picklists" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow public delete access to master_sku" ON "public"."master_sku" FOR DELETE USING (true);



CREATE POLICY "Allow public insert access to master_sku" ON "public"."master_sku" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public read access" ON "public"."picklist_items" FOR SELECT USING (true);



COMMENT ON POLICY "Allow public read access" ON "public"."picklist_items" IS 'Temporary: Allow anyone to read picklist items for troubleshooting';



CREATE POLICY "Allow public read access" ON "public"."picklists" FOR SELECT USING (true);



COMMENT ON POLICY "Allow public read access" ON "public"."picklists" IS 'Temporary: Allow anyone to read picklists for troubleshooting';



CREATE POLICY "Allow public read access to master_sku" ON "public"."master_sku" FOR SELECT USING (true);



CREATE POLICY "Allow public read access to permission modules" ON "public"."master_permission_module" FOR SELECT USING (true);



CREATE POLICY "Allow public read access to role permissions" ON "public"."role_permission" FOR SELECT USING (true);



CREATE POLICY "Allow public read access to roles" ON "public"."master_system_role" FOR SELECT USING (true);



CREATE POLICY "Allow public update access to master_sku" ON "public"."master_sku" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "Enable all access for material_issue_items" ON "public"."material_issue_items" USING (true);



CREATE POLICY "Enable all access for material_return_items" ON "public"."material_return_items" USING (true);



CREATE POLICY "Enable all access for material_returns" ON "public"."material_returns" USING (true);



CREATE POLICY "Enable delete for anon users" ON "public"."loadlists" FOR DELETE TO "anon" USING (true);



CREATE POLICY "Enable delete for anon users" ON "public"."wms_loadlist_picklists" FOR DELETE TO "anon" USING (true);



CREATE POLICY "Enable delete for authenticated users" ON "public"."loadlist_items" FOR DELETE TO "authenticated" USING (true);



COMMENT ON POLICY "Enable delete for authenticated users" ON "public"."loadlist_items" IS 'อนุญาตให้ authenticated users ลบ loadlist item';



CREATE POLICY "Enable delete for authenticated users" ON "public"."loadlists" FOR DELETE TO "authenticated" USING (true);



COMMENT ON POLICY "Enable delete for authenticated users" ON "public"."loadlists" IS 'อนุญาตให้ authenticated users ลบ loadlist';



CREATE POLICY "Enable delete for authenticated users" ON "public"."wms_loadlist_picklists" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Enable insert for anon users" ON "public"."loadlists" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "Enable insert for anon users" ON "public"."wms_loadlist_picklists" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users" ON "public"."loadlist_items" FOR INSERT TO "authenticated" WITH CHECK (true);



COMMENT ON POLICY "Enable insert for authenticated users" ON "public"."loadlist_items" IS 'อนุญาตให้ authenticated users เพิ่ม item เข้า loadlist';



CREATE POLICY "Enable insert for authenticated users" ON "public"."loadlists" FOR INSERT TO "authenticated" WITH CHECK (true);



COMMENT ON POLICY "Enable insert for authenticated users" ON "public"."loadlists" IS 'อนุญาตให้ authenticated users สร้าง loadlist ใหม่';



CREATE POLICY "Enable insert for authenticated users" ON "public"."wms_loadlist_picklists" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable read access for anon users" ON "public"."loadlists" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Enable read access for anon users" ON "public"."wms_loadlist_picklists" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Enable read access for authenticated users" ON "public"."loadlist_items" FOR SELECT TO "authenticated" USING (true);



COMMENT ON POLICY "Enable read access for authenticated users" ON "public"."loadlist_items" IS 'อนุญาตให้ authenticated users อ่าน loadlist items ทั้งหมด';



CREATE POLICY "Enable read access for authenticated users" ON "public"."loadlists" FOR SELECT TO "authenticated" USING (true);



COMMENT ON POLICY "Enable read access for authenticated users" ON "public"."loadlists" IS 'อนุญาตให้ authenticated users อ่าน loadlists ทั้งหมด';



CREATE POLICY "Enable read access for authenticated users" ON "public"."wms_loadlist_picklists" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable update for anon users" ON "public"."loadlists" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Enable update for anon users" ON "public"."wms_loadlist_picklists" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Enable update for authenticated users" ON "public"."loadlist_items" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



COMMENT ON POLICY "Enable update for authenticated users" ON "public"."loadlist_items" IS 'อนุญาตให้ authenticated users แก้ไข loadlist item';



CREATE POLICY "Enable update for authenticated users" ON "public"."loadlists" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



COMMENT ON POLICY "Enable update for authenticated users" ON "public"."loadlists" IS 'อนุญาตให้ authenticated users แก้ไข loadlist';



CREATE POLICY "Enable update for authenticated users" ON "public"."production_receipts" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable update for authenticated users" ON "public"."wms_loadlist_picklists" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."export_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."file_uploads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."import_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."master_permission_module" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."master_sku" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."master_system_role" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."master_system_user" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."material_issue_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."material_issues" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."material_return_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."material_returns" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."packing_backup_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."packing_box_stock_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."packing_box_stocks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."packing_boxes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."packing_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."packing_order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."packing_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."packing_product_weight_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."packing_products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."packing_promotion_freebies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."packing_returns" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."packing_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."packing_system_menus" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."packing_user_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."packing_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."production_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."production_order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."production_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."production_receipts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."role_permission" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_role" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."auto_update_order_status_on_issue"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_update_order_status_on_issue"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_update_order_status_on_issue"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_material_requirements"("p_plan_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_material_requirements"("p_plan_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_material_requirements"("p_plan_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_shipping_cost_formula"() TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_shipping_cost_formula"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_shipping_cost_formula"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cancel_route_stop_and_reset_order"("p_stop_id" bigint, "p_order_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."cancel_route_stop_and_reset_order"("p_stop_id" bigint, "p_order_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_route_stop_and_reset_order"("p_stop_id" bigint, "p_order_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_and_create_replenishment_alert"("p_warehouse_id" character varying, "p_sku_id" character varying, "p_pick_location_id" character varying, "p_required_qty" numeric, "p_picklist_id" bigint, "p_created_by" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."check_and_create_replenishment_alert"("p_warehouse_id" character varying, "p_sku_id" character varying, "p_pick_location_id" character varying, "p_required_qty" numeric, "p_picklist_id" bigint, "p_created_by" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_and_create_replenishment_alert"("p_warehouse_id" character varying, "p_sku_id" character varying, "p_pick_location_id" character varying, "p_required_qty" numeric, "p_picklist_id" bigint, "p_created_by" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_and_publish_if_cost_complete"("p_plan_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."check_and_publish_if_cost_complete"("p_plan_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_and_publish_if_cost_complete"("p_plan_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_order_completion"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_order_completion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_order_completion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_pallet_is_unreceived"("p_pallet_id" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."check_pallet_is_unreceived"("p_pallet_id" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_pallet_is_unreceived"("p_pallet_id" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_picklist_stock_availability"("p_picklist_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_picklist_stock_availability"("p_picklist_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_picklist_stock_availability"("p_picklist_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_shipping_cost_complete_and_publish"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_shipping_cost_complete_and_publish"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_shipping_cost_complete_and_publish"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_face_sheet_packages"("p_face_sheet_no" character varying, "p_warehouse_id" character varying, "p_created_by" character varying, "p_delivery_date" "date", "p_order_ids" bigint[]) TO "anon";
GRANT ALL ON FUNCTION "public"."create_face_sheet_packages"("p_face_sheet_no" character varying, "p_warehouse_id" character varying, "p_created_by" character varying, "p_delivery_date" "date", "p_order_ids" bigint[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_face_sheet_packages"("p_face_sheet_no" character varying, "p_warehouse_id" character varying, "p_created_by" character varying, "p_delivery_date" "date", "p_order_ids" bigint[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_ledger_from_move"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_ledger_from_move"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_ledger_from_move"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_ledger_from_receive"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_ledger_from_receive"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_ledger_from_receive"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_picklist_for_special_trip"("p_trip_id" bigint, "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_picklist_for_special_trip"("p_trip_id" bigint, "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_picklist_for_special_trip"("p_trip_id" bigint, "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_picklist_for_trip"("p_trip_id" bigint, "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_picklist_for_trip"("p_trip_id" bigint, "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_picklist_for_trip"("p_trip_id" bigint, "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_preparation_order_with_locations"("p_warehouse_id" character varying, "p_order_type" character varying, "p_sku_items" "jsonb", "p_priority" "public"."preparation_priority_enum", "p_preparation_area_id" "uuid", "p_reference_no" character varying, "p_notes" "text", "p_created_by" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."create_preparation_order_with_locations"("p_warehouse_id" character varying, "p_order_type" character varying, "p_sku_items" "jsonb", "p_priority" "public"."preparation_priority_enum", "p_preparation_area_id" "uuid", "p_reference_no" character varying, "p_notes" "text", "p_created_by" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_preparation_order_with_locations"("p_warehouse_id" character varying, "p_order_type" character varying, "p_sku_items" "jsonb", "p_priority" "public"."preparation_priority_enum", "p_preparation_area_id" "uuid", "p_reference_no" character varying, "p_notes" "text", "p_created_by" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_replenishment_tasks"("p_warehouse_id" "uuid", "p_trigger_source" character varying, "p_trigger_reference" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."create_replenishment_tasks"("p_warehouse_id" "uuid", "p_trigger_source" character varying, "p_trigger_reference" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_replenishment_tasks"("p_warehouse_id" "uuid", "p_trigger_source" character varying, "p_trigger_reference" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."debug_plan_orders"("p_plan_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."debug_plan_orders"("p_plan_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."debug_plan_orders"("p_plan_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."debug_plan_orders_comprehensive"("p_plan_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."debug_plan_orders_comprehensive"("p_plan_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."debug_plan_orders_comprehensive"("p_plan_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."fix_master_sku_default_locations"() TO "anon";
GRANT ALL ON FUNCTION "public"."fix_master_sku_default_locations"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fix_master_sku_default_locations"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_bonus_face_sheet_no"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_bonus_face_sheet_no"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_bonus_face_sheet_no"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_face_sheet_no"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_face_sheet_no"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_face_sheet_no"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_issue_no"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_issue_no"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_issue_no"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_lot_no"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_lot_no"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_lot_no"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_move_no"("p_move_type" "public"."move_type_enum", "p_pallet_id" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."generate_move_no"("p_move_type" "public"."move_type_enum", "p_pallet_id" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_move_no"("p_move_type" "public"."move_type_enum", "p_pallet_id" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_preparation_order_no"("p_warehouse_id" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."generate_preparation_order_no"("p_warehouse_id" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_preparation_order_no"("p_warehouse_id" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_production_no"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_production_no"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_production_no"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_receipt_no"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_receipt_no"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_receipt_no"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_return_no"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_return_no"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_return_no"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_scanner_friendly_code"("p_order_no" character varying, "p_product_code" character varying, "p_package_seq" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."generate_scanner_friendly_code"("p_order_no" character varying, "p_product_code" character varying, "p_package_seq" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_scanner_friendly_code"("p_order_no" character varying, "p_product_code" character varying, "p_package_seq" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_sequence_no"("prefix" "text", "date_part" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_sequence_no"("prefix" "text", "date_part" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_sequence_no"("prefix" "text", "date_part" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_stock_import_batch_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_stock_import_batch_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_stock_import_batch_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_task_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_task_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_task_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_available_employees_by_role"("p_wms_role" "public"."wms_role_enum", "p_warehouse_id" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."get_available_employees_by_role"("p_wms_role" "public"."wms_role_enum", "p_warehouse_id" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_available_employees_by_role"("p_wms_role" "public"."wms_role_enum", "p_warehouse_id" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_available_locations_for_preparation"("p_warehouse_id" character varying, "p_sku_id" character varying, "p_preparation_area_id" "uuid", "p_required_quantity" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."get_available_locations_for_preparation"("p_warehouse_id" character varying, "p_sku_id" character varying, "p_preparation_area_id" "uuid", "p_required_quantity" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_available_locations_for_preparation"("p_warehouse_id" character varying, "p_sku_id" character varying, "p_preparation_area_id" "uuid", "p_required_quantity" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_face_sheet_details"("p_face_sheet_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_face_sheet_details"("p_face_sheet_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_face_sheet_details"("p_face_sheet_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_freight_rate_for_route"("p_origin_province" character varying, "p_destination_province" character varying, "p_carrier_id" bigint, "p_rate_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_freight_rate_for_route"("p_origin_province" character varying, "p_destination_province" character varying, "p_carrier_id" bigint, "p_rate_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_freight_rate_for_route"("p_origin_province" character varying, "p_destination_province" character varying, "p_carrier_id" bigint, "p_rate_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_materials_fefo"("p_sku_id" character varying, "p_required_qty" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."get_materials_fefo"("p_sku_id" character varying, "p_required_qty" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_materials_fefo"("p_sku_id" character varying, "p_required_qty" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_materials_fifo"("p_sku_id" character varying, "p_required_qty" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."get_materials_fifo"("p_sku_id" character varying, "p_required_qty" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_materials_fifo"("p_sku_id" character varying, "p_required_qty" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_picklist_item_reserved_qty"("p_picklist_item_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_picklist_item_reserved_qty"("p_picklist_item_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_picklist_item_reserved_qty"("p_picklist_item_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_trips_for_picklist_creation"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_trips_for_picklist_creation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_trips_for_picklist_creation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."packing_get_unique_platforms"() TO "anon";
GRANT ALL ON FUNCTION "public"."packing_get_unique_platforms"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."packing_get_unique_platforms"() TO "service_role";



GRANT ALL ON FUNCTION "public"."packing_recommend_box_for_sku"("p_parent_sku" "text", "p_quantity" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."packing_recommend_box_for_sku"("p_parent_sku" "text", "p_quantity" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."packing_recommend_box_for_sku"("p_parent_sku" "text", "p_quantity" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."packing_update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."packing_update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."packing_update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."populate_face_sheet_item_sku_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."populate_face_sheet_item_sku_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."populate_face_sheet_item_sku_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reserve_stock_for_face_sheet_items"("p_face_sheet_id" bigint, "p_warehouse_id" character varying, "p_reserved_by" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."reserve_stock_for_face_sheet_items"("p_face_sheet_id" bigint, "p_warehouse_id" character varying, "p_reserved_by" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reserve_stock_for_face_sheet_items"("p_face_sheet_id" bigint, "p_warehouse_id" character varying, "p_reserved_by" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."safe_string_to_date"("date_input" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."safe_string_to_date"("date_input" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."safe_string_to_date"("date_input" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_receiving_route_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_receiving_route_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_receiving_route_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_current_stock_from_movement"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_current_stock_from_movement"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_current_stock_from_movement"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_inventory_ledger_to_balance"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_inventory_ledger_to_balance"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_inventory_ledger_to_balance"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_location_qty_from_balance"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_location_qty_from_balance"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_location_qty_from_balance"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_produced_qty_to_plan"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_produced_qty_to_plan"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_produced_qty_to_plan"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_production_plan_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_production_plan_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_production_plan_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_reserve_stock_after_face_sheet_created"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_reserve_stock_after_face_sheet_created"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_reserve_stock_after_face_sheet_created"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_bom_sku_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_bom_sku_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_bom_sku_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_bonus_face_sheet_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_bonus_face_sheet_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_bonus_face_sheet_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_dashboard_calendar_events_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_dashboard_calendar_events_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_dashboard_calendar_events_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_extra_stops_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_extra_stops_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_extra_stops_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_face_sheets_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_face_sheets_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_face_sheets_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_inventory_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_inventory_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_inventory_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_ledger_from_move"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_ledger_from_move"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_ledger_from_move"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_ledger_from_receive"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_ledger_from_receive"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_ledger_from_receive"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_ledger_from_receive_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_ledger_from_receive_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_ledger_from_receive_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_loadlist_and_route_on_delivery"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_loadlist_and_route_on_delivery"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_loadlist_and_route_on_delivery"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_location_current_qty"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_location_current_qty"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_location_current_qty"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_master_customer_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_master_customer_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_master_customer_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_master_location_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_master_location_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_master_location_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_master_supplier_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_master_supplier_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_master_supplier_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_master_vehicle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_master_vehicle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_master_vehicle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_master_warehouse_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_master_warehouse_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_master_warehouse_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_order_on_loadlist_scan"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_order_on_loadlist_scan"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_order_on_loadlist_scan"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_order_status_on_face_sheet_in_progress"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_order_status_on_face_sheet_in_progress"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_order_status_on_face_sheet_in_progress"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_orders_and_route_on_departure"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_orders_and_route_on_departure"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_orders_and_route_on_departure"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_orders_and_route_on_picklist_complete"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_orders_and_route_on_picklist_complete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_orders_and_route_on_picklist_complete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_orders_on_face_sheet_complete"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_orders_on_face_sheet_complete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_orders_on_face_sheet_complete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_orders_on_loadlist_complete"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_orders_on_loadlist_complete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_orders_on_loadlist_complete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_orders_on_picklist_assign"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_orders_on_picklist_assign"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_orders_on_picklist_assign"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_orders_on_picklist_create"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_orders_on_picklist_create"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_orders_on_picklist_create"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_orders_on_route_publish"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_orders_on_route_publish"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_orders_on_route_publish"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_pallet_location_after_movement"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_pallet_location_after_movement"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_pallet_location_after_movement"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_picklist_item_reservations_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_picklist_item_reservations_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_picklist_item_reservations_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_plan_item_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_plan_item_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_plan_item_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_production_orders_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_production_orders_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_production_orders_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_purchase_orders_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_purchase_orders_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_purchase_orders_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_receive_image_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_receive_image_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_receive_image_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_replenishment_rule_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_replenishment_rule_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_replenishment_rule_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_reservation_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_reservation_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_reservation_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_route_on_delivery"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_route_on_delivery"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_route_on_delivery"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_route_plan_status_and_orders"("p_plan_id" bigint, "p_new_status" "public"."receiving_route_plan_status_enum") TO "anon";
GRANT ALL ON FUNCTION "public"."update_route_plan_status_and_orders"("p_plan_id" bigint, "p_new_status" "public"."receiving_route_plan_status_enum") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_route_plan_status_and_orders"("p_plan_id" bigint, "p_new_status" "public"."receiving_route_plan_status_enum") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_route_plan_status_and_orders_comprehensive"("p_plan_id" bigint, "p_new_status" "public"."receiving_route_plan_status_enum") TO "anon";
GRANT ALL ON FUNCTION "public"."update_route_plan_status_and_orders_comprehensive"("p_plan_id" bigint, "p_new_status" "public"."receiving_route_plan_status_enum") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_route_plan_status_and_orders_comprehensive"("p_plan_id" bigint, "p_new_status" "public"."receiving_route_plan_status_enum") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_stock_alert_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_stock_alert_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_stock_alert_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_stock_balance_after_movement"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_stock_balance_after_movement"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_stock_balance_after_movement"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_warehouse_task_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_warehouse_task_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_warehouse_task_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_wms_inventory_balances_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_wms_inventory_balances_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_wms_inventory_balances_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_wms_inventory_ledger_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_wms_inventory_ledger_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_wms_inventory_ledger_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_wms_move_items_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_wms_move_items_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_wms_move_items_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_wms_moves_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_wms_moves_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_wms_moves_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_wms_order_items_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_wms_order_items_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_wms_order_items_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_wms_orders_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_wms_orders_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_wms_orders_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_wms_receive_items_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_wms_receive_items_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_wms_receive_items_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_wms_receive_pallet_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_wms_receive_pallet_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_wms_receive_pallet_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_wms_receive_universal_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_wms_receive_universal_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_wms_receive_universal_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_wms_receive_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_wms_receive_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_wms_receive_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_wms_receives_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_wms_receives_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_wms_receives_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_dispatch_balance"("p_warehouse_id" "text", "p_location_id" "text", "p_sku_id" "text", "p_production_date" "date", "p_expiry_date" "date", "p_lot_no" "text", "p_pack_qty" numeric, "p_piece_qty" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_dispatch_balance"("p_warehouse_id" "text", "p_location_id" "text", "p_sku_id" "text", "p_production_date" "date", "p_expiry_date" "date", "p_lot_no" "text", "p_pack_qty" numeric, "p_piece_qty" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_dispatch_balance"("p_warehouse_id" "text", "p_location_id" "text", "p_sku_id" "text", "p_production_date" "date", "p_expiry_date" "date", "p_lot_no" "text", "p_pack_qty" numeric, "p_piece_qty" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_inventory_balance"("p_warehouse_id" character varying, "p_location_id" character varying, "p_sku_id" character varying, "p_pallet_id" character varying, "p_pack_qty" numeric, "p_piece_qty" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_inventory_balance"("p_warehouse_id" character varying, "p_location_id" character varying, "p_sku_id" character varying, "p_pallet_id" character varying, "p_pack_qty" numeric, "p_piece_qty" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_inventory_balance"("p_warehouse_id" character varying, "p_location_id" character varying, "p_sku_id" character varying, "p_pallet_id" character varying, "p_pack_qty" numeric, "p_piece_qty" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_express_orders_for_face_sheet"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_express_orders_for_face_sheet"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_express_orders_for_face_sheet"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_loadlist_status_transition"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_loadlist_status_transition"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_loadlist_status_transition"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_order_status_transition"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_order_status_transition"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_order_status_transition"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_picklist_status_transition"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_picklist_status_transition"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_picklist_status_transition"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_route_plan_status_transition"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_route_plan_status_transition"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_route_plan_status_transition"() TO "service_role";



GRANT ALL ON FUNCTION "public"."wms_recommend_putaway_locations"("p_warehouse_id" character varying, "p_sku_id" character varying, "p_expected_pack_qty" numeric, "p_expected_piece_qty" numeric, "p_expected_expiry" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."wms_recommend_putaway_locations"("p_warehouse_id" character varying, "p_sku_id" character varying, "p_expected_pack_qty" numeric, "p_expected_piece_qty" numeric, "p_expected_expiry" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."wms_recommend_putaway_locations"("p_warehouse_id" character varying, "p_sku_id" character varying, "p_expected_pack_qty" numeric, "p_expected_piece_qty" numeric, "p_expected_expiry" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";


















GRANT ALL ON TABLE "public"."master_freight_rate" TO "anon";
GRANT ALL ON TABLE "public"."master_freight_rate" TO "authenticated";
GRANT ALL ON TABLE "public"."master_freight_rate" TO "service_role";



GRANT ALL ON TABLE "public"."active_freight_rates" TO "anon";
GRANT ALL ON TABLE "public"."active_freight_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."active_freight_rates" TO "service_role";



GRANT ALL ON TABLE "public"."bom_sku" TO "anon";
GRANT ALL ON TABLE "public"."bom_sku" TO "authenticated";
GRANT ALL ON TABLE "public"."bom_sku" TO "service_role";



GRANT ALL ON SEQUENCE "public"."bom_sku_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."bom_sku_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."bom_sku_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."bonus_face_sheet_items" TO "anon";
GRANT ALL ON TABLE "public"."bonus_face_sheet_items" TO "authenticated";
GRANT ALL ON TABLE "public"."bonus_face_sheet_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."bonus_face_sheet_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."bonus_face_sheet_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."bonus_face_sheet_items_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."bonus_face_sheet_packages" TO "anon";
GRANT ALL ON TABLE "public"."bonus_face_sheet_packages" TO "authenticated";
GRANT ALL ON TABLE "public"."bonus_face_sheet_packages" TO "service_role";



GRANT ALL ON SEQUENCE "public"."bonus_face_sheet_packages_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."bonus_face_sheet_packages_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."bonus_face_sheet_packages_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."bonus_face_sheet_summary" TO "anon";
GRANT ALL ON TABLE "public"."bonus_face_sheet_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."bonus_face_sheet_summary" TO "service_role";



GRANT ALL ON TABLE "public"."bonus_face_sheets" TO "anon";
GRANT ALL ON TABLE "public"."bonus_face_sheets" TO "authenticated";
GRANT ALL ON TABLE "public"."bonus_face_sheets" TO "service_role";



GRANT ALL ON SEQUENCE "public"."bonus_face_sheets_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."bonus_face_sheets_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."bonus_face_sheets_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."dashboard_calendar_attendees" TO "anon";
GRANT ALL ON TABLE "public"."dashboard_calendar_attendees" TO "authenticated";
GRANT ALL ON TABLE "public"."dashboard_calendar_attendees" TO "service_role";



GRANT ALL ON TABLE "public"."dashboard_calendar_events" TO "anon";
GRANT ALL ON TABLE "public"."dashboard_calendar_events" TO "authenticated";
GRANT ALL ON TABLE "public"."dashboard_calendar_events" TO "service_role";



GRANT ALL ON TABLE "public"."export_jobs" TO "anon";
GRANT ALL ON TABLE "public"."export_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."export_jobs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."export_jobs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."export_jobs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."export_jobs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."face_sheet_item_reservations" TO "anon";
GRANT ALL ON TABLE "public"."face_sheet_item_reservations" TO "authenticated";
GRANT ALL ON TABLE "public"."face_sheet_item_reservations" TO "service_role";



GRANT ALL ON SEQUENCE "public"."face_sheet_item_reservations_reservation_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."face_sheet_item_reservations_reservation_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."face_sheet_item_reservations_reservation_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."face_sheet_items" TO "anon";
GRANT ALL ON TABLE "public"."face_sheet_items" TO "authenticated";
GRANT ALL ON TABLE "public"."face_sheet_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."face_sheet_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."face_sheet_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."face_sheet_items_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."face_sheet_packages" TO "anon";
GRANT ALL ON TABLE "public"."face_sheet_packages" TO "authenticated";
GRANT ALL ON TABLE "public"."face_sheet_packages" TO "service_role";



GRANT ALL ON SEQUENCE "public"."face_sheet_packages_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."face_sheet_packages_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."face_sheet_packages_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."face_sheet_summary" TO "anon";
GRANT ALL ON TABLE "public"."face_sheet_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."face_sheet_summary" TO "service_role";



GRANT ALL ON TABLE "public"."face_sheets" TO "anon";
GRANT ALL ON TABLE "public"."face_sheets" TO "authenticated";
GRANT ALL ON TABLE "public"."face_sheets" TO "service_role";



GRANT ALL ON SEQUENCE "public"."face_sheets_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."face_sheets_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."face_sheets_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."file_uploads" TO "anon";
GRANT ALL ON TABLE "public"."file_uploads" TO "authenticated";
GRANT ALL ON TABLE "public"."file_uploads" TO "service_role";



GRANT ALL ON TABLE "public"."import_jobs" TO "anon";
GRANT ALL ON TABLE "public"."import_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."import_jobs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."import_jobs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."import_jobs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."import_jobs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."loadlist_face_sheets" TO "anon";
GRANT ALL ON TABLE "public"."loadlist_face_sheets" TO "authenticated";
GRANT ALL ON TABLE "public"."loadlist_face_sheets" TO "service_role";



GRANT ALL ON TABLE "public"."loadlist_picklists" TO "anon";
GRANT ALL ON TABLE "public"."loadlist_picklists" TO "authenticated";
GRANT ALL ON TABLE "public"."loadlist_picklists" TO "service_role";



GRANT ALL ON TABLE "public"."loadlists" TO "anon";
GRANT ALL ON TABLE "public"."loadlists" TO "authenticated";
GRANT ALL ON TABLE "public"."loadlists" TO "service_role";



GRANT ALL ON TABLE "public"."picklists" TO "anon";
GRANT ALL ON TABLE "public"."picklists" TO "authenticated";
GRANT ALL ON TABLE "public"."picklists" TO "service_role";



GRANT ALL ON TABLE "public"."loadlist_details_with_face_sheets" TO "anon";
GRANT ALL ON TABLE "public"."loadlist_details_with_face_sheets" TO "authenticated";
GRANT ALL ON TABLE "public"."loadlist_details_with_face_sheets" TO "service_role";



GRANT ALL ON TABLE "public"."loadlist_items" TO "anon";
GRANT ALL ON TABLE "public"."loadlist_items" TO "authenticated";
GRANT ALL ON TABLE "public"."loadlist_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."loadlist_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."loadlist_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."loadlist_items_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."loadlists_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."loadlists_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."loadlists_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."location_group" TO "anon";
GRANT ALL ON TABLE "public"."location_group" TO "authenticated";
GRANT ALL ON TABLE "public"."location_group" TO "service_role";



GRANT ALL ON TABLE "public"."location_group_members" TO "anon";
GRANT ALL ON TABLE "public"."location_group_members" TO "authenticated";
GRANT ALL ON TABLE "public"."location_group_members" TO "service_role";



GRANT ALL ON TABLE "public"."location_sku_allocation" TO "anon";
GRANT ALL ON TABLE "public"."location_sku_allocation" TO "authenticated";
GRANT ALL ON TABLE "public"."location_sku_allocation" TO "service_role";



GRANT ALL ON TABLE "public"."location_storage_profile" TO "anon";
GRANT ALL ON TABLE "public"."location_storage_profile" TO "authenticated";
GRANT ALL ON TABLE "public"."location_storage_profile" TO "service_role";



GRANT ALL ON TABLE "public"."master_customer" TO "anon";
GRANT ALL ON TABLE "public"."master_customer" TO "authenticated";
GRANT ALL ON TABLE "public"."master_customer" TO "service_role";



GRANT ALL ON TABLE "public"."master_customer_no_price_goods" TO "anon";
GRANT ALL ON TABLE "public"."master_customer_no_price_goods" TO "authenticated";
GRANT ALL ON TABLE "public"."master_customer_no_price_goods" TO "service_role";



GRANT ALL ON SEQUENCE "public"."master_customer_no_price_goods_record_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."master_customer_no_price_goods_record_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."master_customer_no_price_goods_record_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."master_employee" TO "anon";
GRANT ALL ON TABLE "public"."master_employee" TO "authenticated";
GRANT ALL ON TABLE "public"."master_employee" TO "service_role";



GRANT ALL ON SEQUENCE "public"."master_employee_employee_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."master_employee_employee_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."master_employee_employee_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."master_freight_rate_freight_rate_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."master_freight_rate_freight_rate_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."master_freight_rate_freight_rate_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."master_iv_document_type" TO "anon";
GRANT ALL ON TABLE "public"."master_iv_document_type" TO "authenticated";
GRANT ALL ON TABLE "public"."master_iv_document_type" TO "service_role";



GRANT ALL ON SEQUENCE "public"."master_iv_document_type_doc_type_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."master_iv_document_type_doc_type_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."master_iv_document_type_doc_type_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."master_location" TO "anon";
GRANT ALL ON TABLE "public"."master_location" TO "authenticated";
GRANT ALL ON TABLE "public"."master_location" TO "service_role";



GRANT ALL ON TABLE "public"."master_permission_module" TO "anon";
GRANT ALL ON TABLE "public"."master_permission_module" TO "authenticated";
GRANT ALL ON TABLE "public"."master_permission_module" TO "service_role";



GRANT ALL ON SEQUENCE "public"."master_permission_module_module_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."master_permission_module_module_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."master_permission_module_module_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."master_sku" TO "anon";
GRANT ALL ON TABLE "public"."master_sku" TO "authenticated";
GRANT ALL ON TABLE "public"."master_sku" TO "service_role";



GRANT ALL ON TABLE "public"."master_supplier" TO "anon";
GRANT ALL ON TABLE "public"."master_supplier" TO "authenticated";
GRANT ALL ON TABLE "public"."master_supplier" TO "service_role";



GRANT ALL ON TABLE "public"."master_system_role" TO "anon";
GRANT ALL ON TABLE "public"."master_system_role" TO "authenticated";
GRANT ALL ON TABLE "public"."master_system_role" TO "service_role";



GRANT ALL ON SEQUENCE "public"."master_system_role_role_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."master_system_role_role_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."master_system_role_role_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."master_system_user" TO "anon";
GRANT ALL ON TABLE "public"."master_system_user" TO "authenticated";
GRANT ALL ON TABLE "public"."master_system_user" TO "service_role";



GRANT ALL ON SEQUENCE "public"."master_system_user_user_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."master_system_user_user_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."master_system_user_user_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."master_vehicle" TO "anon";
GRANT ALL ON TABLE "public"."master_vehicle" TO "authenticated";
GRANT ALL ON TABLE "public"."master_vehicle" TO "service_role";



GRANT ALL ON SEQUENCE "public"."master_vehicle_vehicle_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."master_vehicle_vehicle_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."master_vehicle_vehicle_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."master_warehouse" TO "anon";
GRANT ALL ON TABLE "public"."master_warehouse" TO "authenticated";
GRANT ALL ON TABLE "public"."master_warehouse" TO "service_role";



GRANT ALL ON TABLE "public"."master_warehouse_asset" TO "anon";
GRANT ALL ON TABLE "public"."master_warehouse_asset" TO "authenticated";
GRANT ALL ON TABLE "public"."master_warehouse_asset" TO "service_role";



GRANT ALL ON SEQUENCE "public"."master_warehouse_asset_asset_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."master_warehouse_asset_asset_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."master_warehouse_asset_asset_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."material_issue_items" TO "anon";
GRANT ALL ON TABLE "public"."material_issue_items" TO "authenticated";
GRANT ALL ON TABLE "public"."material_issue_items" TO "service_role";



GRANT ALL ON TABLE "public"."material_issues" TO "anon";
GRANT ALL ON TABLE "public"."material_issues" TO "authenticated";
GRANT ALL ON TABLE "public"."material_issues" TO "service_role";



GRANT ALL ON TABLE "public"."material_requirements" TO "anon";
GRANT ALL ON TABLE "public"."material_requirements" TO "authenticated";
GRANT ALL ON TABLE "public"."material_requirements" TO "service_role";



GRANT ALL ON TABLE "public"."material_return_items" TO "anon";
GRANT ALL ON TABLE "public"."material_return_items" TO "authenticated";
GRANT ALL ON TABLE "public"."material_return_items" TO "service_role";



GRANT ALL ON TABLE "public"."material_returns" TO "anon";
GRANT ALL ON TABLE "public"."material_returns" TO "authenticated";
GRANT ALL ON TABLE "public"."material_returns" TO "service_role";



GRANT ALL ON TABLE "public"."packing_backup_orders" TO "anon";
GRANT ALL ON TABLE "public"."packing_backup_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."packing_backup_orders" TO "service_role";



GRANT ALL ON TABLE "public"."packing_box_stock_history" TO "anon";
GRANT ALL ON TABLE "public"."packing_box_stock_history" TO "authenticated";
GRANT ALL ON TABLE "public"."packing_box_stock_history" TO "service_role";



GRANT ALL ON TABLE "public"."packing_box_stocks" TO "anon";
GRANT ALL ON TABLE "public"."packing_box_stocks" TO "authenticated";
GRANT ALL ON TABLE "public"."packing_box_stocks" TO "service_role";



GRANT ALL ON TABLE "public"."packing_boxes" TO "anon";
GRANT ALL ON TABLE "public"."packing_boxes" TO "authenticated";
GRANT ALL ON TABLE "public"."packing_boxes" TO "service_role";



GRANT ALL ON TABLE "public"."packing_history" TO "anon";
GRANT ALL ON TABLE "public"."packing_history" TO "authenticated";
GRANT ALL ON TABLE "public"."packing_history" TO "service_role";



GRANT ALL ON TABLE "public"."packing_order_items" TO "anon";
GRANT ALL ON TABLE "public"."packing_order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."packing_order_items" TO "service_role";



GRANT ALL ON TABLE "public"."packing_orders" TO "anon";
GRANT ALL ON TABLE "public"."packing_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."packing_orders" TO "service_role";



GRANT ALL ON TABLE "public"."packing_product_weight_profiles" TO "anon";
GRANT ALL ON TABLE "public"."packing_product_weight_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."packing_product_weight_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."packing_products" TO "anon";
GRANT ALL ON TABLE "public"."packing_products" TO "authenticated";
GRANT ALL ON TABLE "public"."packing_products" TO "service_role";



GRANT ALL ON TABLE "public"."packing_promotion_freebies" TO "anon";
GRANT ALL ON TABLE "public"."packing_promotion_freebies" TO "authenticated";
GRANT ALL ON TABLE "public"."packing_promotion_freebies" TO "service_role";



GRANT ALL ON SEQUENCE "public"."packing_promotion_freebies_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."packing_promotion_freebies_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."packing_promotion_freebies_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."packing_returns" TO "anon";
GRANT ALL ON TABLE "public"."packing_returns" TO "authenticated";
GRANT ALL ON TABLE "public"."packing_returns" TO "service_role";



GRANT ALL ON TABLE "public"."packing_rules" TO "anon";
GRANT ALL ON TABLE "public"."packing_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."packing_rules" TO "service_role";



GRANT ALL ON TABLE "public"."packing_system_menus" TO "anon";
GRANT ALL ON TABLE "public"."packing_system_menus" TO "authenticated";
GRANT ALL ON TABLE "public"."packing_system_menus" TO "service_role";



GRANT ALL ON TABLE "public"."packing_user_permissions" TO "anon";
GRANT ALL ON TABLE "public"."packing_user_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."packing_user_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."packing_users" TO "anon";
GRANT ALL ON TABLE "public"."packing_users" TO "authenticated";
GRANT ALL ON TABLE "public"."packing_users" TO "service_role";



GRANT ALL ON TABLE "public"."picklist_item_reservations" TO "anon";
GRANT ALL ON TABLE "public"."picklist_item_reservations" TO "authenticated";
GRANT ALL ON TABLE "public"."picklist_item_reservations" TO "service_role";



GRANT ALL ON SEQUENCE "public"."picklist_item_reservations_reservation_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."picklist_item_reservations_reservation_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."picklist_item_reservations_reservation_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."picklist_items" TO "anon";
GRANT ALL ON TABLE "public"."picklist_items" TO "authenticated";
GRANT ALL ON TABLE "public"."picklist_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."picklist_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."picklist_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."picklist_items_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."picklists_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."picklists_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."picklists_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."preparation_area" TO "anon";
GRANT ALL ON TABLE "public"."preparation_area" TO "authenticated";
GRANT ALL ON TABLE "public"."preparation_area" TO "service_role";



GRANT ALL ON TABLE "public"."preparation_order" TO "anon";
GRANT ALL ON TABLE "public"."preparation_order" TO "authenticated";
GRANT ALL ON TABLE "public"."preparation_order" TO "service_role";



GRANT ALL ON TABLE "public"."preparation_order_item" TO "anon";
GRANT ALL ON TABLE "public"."preparation_order_item" TO "authenticated";
GRANT ALL ON TABLE "public"."preparation_order_item" TO "service_role";



GRANT ALL ON TABLE "public"."production_logs" TO "anon";
GRANT ALL ON TABLE "public"."production_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."production_logs" TO "service_role";



GRANT ALL ON TABLE "public"."production_order_items" TO "anon";
GRANT ALL ON TABLE "public"."production_order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."production_order_items" TO "service_role";



GRANT ALL ON TABLE "public"."production_orders" TO "anon";
GRANT ALL ON TABLE "public"."production_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."production_orders" TO "service_role";



GRANT ALL ON TABLE "public"."production_plan" TO "anon";
GRANT ALL ON TABLE "public"."production_plan" TO "authenticated";
GRANT ALL ON TABLE "public"."production_plan" TO "service_role";



GRANT ALL ON TABLE "public"."production_plan_items" TO "anon";
GRANT ALL ON TABLE "public"."production_plan_items" TO "authenticated";
GRANT ALL ON TABLE "public"."production_plan_items" TO "service_role";



GRANT ALL ON TABLE "public"."production_receipts" TO "anon";
GRANT ALL ON TABLE "public"."production_receipts" TO "authenticated";
GRANT ALL ON TABLE "public"."production_receipts" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_order_items" TO "anon";
GRANT ALL ON TABLE "public"."purchase_order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_order_items" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_orders" TO "anon";
GRANT ALL ON TABLE "public"."purchase_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_orders" TO "service_role";



GRANT ALL ON TABLE "public"."receiving_route_clusters" TO "anon";
GRANT ALL ON TABLE "public"."receiving_route_clusters" TO "authenticated";
GRANT ALL ON TABLE "public"."receiving_route_clusters" TO "service_role";



GRANT ALL ON SEQUENCE "public"."receiving_route_clusters_cluster_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."receiving_route_clusters_cluster_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."receiving_route_clusters_cluster_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."receiving_route_plan_inputs" TO "anon";
GRANT ALL ON TABLE "public"."receiving_route_plan_inputs" TO "authenticated";
GRANT ALL ON TABLE "public"."receiving_route_plan_inputs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."receiving_route_plan_inputs_input_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."receiving_route_plan_inputs_input_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."receiving_route_plan_inputs_input_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."receiving_route_plan_metrics" TO "anon";
GRANT ALL ON TABLE "public"."receiving_route_plan_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."receiving_route_plan_metrics" TO "service_role";



GRANT ALL ON SEQUENCE "public"."receiving_route_plan_metrics_metric_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."receiving_route_plan_metrics_metric_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."receiving_route_plan_metrics_metric_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."receiving_route_plans" TO "anon";
GRANT ALL ON TABLE "public"."receiving_route_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."receiving_route_plans" TO "service_role";



GRANT ALL ON SEQUENCE "public"."receiving_route_plans_plan_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."receiving_route_plans_plan_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."receiving_route_plans_plan_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."receiving_route_stop_items" TO "anon";
GRANT ALL ON TABLE "public"."receiving_route_stop_items" TO "authenticated";
GRANT ALL ON TABLE "public"."receiving_route_stop_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."receiving_route_stop_items_stop_item_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."receiving_route_stop_items_stop_item_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."receiving_route_stop_items_stop_item_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."receiving_route_stops" TO "anon";
GRANT ALL ON TABLE "public"."receiving_route_stops" TO "authenticated";
GRANT ALL ON TABLE "public"."receiving_route_stops" TO "service_role";



GRANT ALL ON SEQUENCE "public"."receiving_route_stops_stop_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."receiving_route_stops_stop_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."receiving_route_stops_stop_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."receiving_route_trips" TO "anon";
GRANT ALL ON TABLE "public"."receiving_route_trips" TO "authenticated";
GRANT ALL ON TABLE "public"."receiving_route_trips" TO "service_role";



GRANT ALL ON SEQUENCE "public"."receiving_route_trips_trip_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."receiving_route_trips_trip_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."receiving_route_trips_trip_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."replenishment_queue" TO "anon";
GRANT ALL ON TABLE "public"."replenishment_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."replenishment_queue" TO "service_role";



GRANT ALL ON TABLE "public"."replenishment_rules" TO "anon";
GRANT ALL ON TABLE "public"."replenishment_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."replenishment_rules" TO "service_role";



GRANT ALL ON TABLE "public"."role_permission" TO "anon";
GRANT ALL ON TABLE "public"."role_permission" TO "authenticated";
GRANT ALL ON TABLE "public"."role_permission" TO "service_role";



GRANT ALL ON TABLE "public"."sku_incompatibilities" TO "anon";
GRANT ALL ON TABLE "public"."sku_incompatibilities" TO "authenticated";
GRANT ALL ON TABLE "public"."sku_incompatibilities" TO "service_role";



GRANT ALL ON TABLE "public"."sku_preparation_area_mapping" TO "anon";
GRANT ALL ON TABLE "public"."sku_preparation_area_mapping" TO "authenticated";
GRANT ALL ON TABLE "public"."sku_preparation_area_mapping" TO "service_role";



GRANT ALL ON TABLE "public"."sku_storage_profile" TO "anon";
GRANT ALL ON TABLE "public"."sku_storage_profile" TO "authenticated";
GRANT ALL ON TABLE "public"."sku_storage_profile" TO "service_role";



GRANT ALL ON TABLE "public"."stock_replenishment_alerts" TO "anon";
GRANT ALL ON TABLE "public"."stock_replenishment_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_replenishment_alerts" TO "service_role";



GRANT ALL ON SEQUENCE "public"."stock_replenishment_alerts_alert_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."stock_replenishment_alerts_alert_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."stock_replenishment_alerts_alert_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."storage_strategy" TO "anon";
GRANT ALL ON TABLE "public"."storage_strategy" TO "authenticated";
GRANT ALL ON TABLE "public"."storage_strategy" TO "service_role";



GRANT ALL ON TABLE "public"."storage_strategy_conditions" TO "anon";
GRANT ALL ON TABLE "public"."storage_strategy_conditions" TO "authenticated";
GRANT ALL ON TABLE "public"."storage_strategy_conditions" TO "service_role";



GRANT ALL ON TABLE "public"."storage_strategy_scope" TO "anon";
GRANT ALL ON TABLE "public"."storage_strategy_scope" TO "authenticated";
GRANT ALL ON TABLE "public"."storage_strategy_scope" TO "service_role";



GRANT ALL ON TABLE "public"."storage_strategy_sku_settings" TO "anon";
GRANT ALL ON TABLE "public"."storage_strategy_sku_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."storage_strategy_sku_settings" TO "service_role";



GRANT ALL ON TABLE "public"."user_role" TO "anon";
GRANT ALL ON TABLE "public"."user_role" TO "authenticated";
GRANT ALL ON TABLE "public"."user_role" TO "service_role";



GRANT ALL ON TABLE "public"."v_active_customer_no_price_goods" TO "anon";
GRANT ALL ON TABLE "public"."v_active_customer_no_price_goods" TO "authenticated";
GRANT ALL ON TABLE "public"."v_active_customer_no_price_goods" TO "service_role";



GRANT ALL ON TABLE "public"."v_active_promotion_freebies" TO "anon";
GRANT ALL ON TABLE "public"."v_active_promotion_freebies" TO "authenticated";
GRANT ALL ON TABLE "public"."v_active_promotion_freebies" TO "service_role";



GRANT ALL ON TABLE "public"."wms_move_items" TO "anon";
GRANT ALL ON TABLE "public"."wms_move_items" TO "authenticated";
GRANT ALL ON TABLE "public"."wms_move_items" TO "service_role";



GRANT ALL ON TABLE "public"."v_move_item_assignments" TO "anon";
GRANT ALL ON TABLE "public"."v_move_item_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."v_move_item_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."v_packing_box_usage_stats" TO "anon";
GRANT ALL ON TABLE "public"."v_packing_box_usage_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."v_packing_box_usage_stats" TO "service_role";



GRANT ALL ON TABLE "public"."v_packing_user_performance" TO "anon";
GRANT ALL ON TABLE "public"."v_packing_user_performance" TO "authenticated";
GRANT ALL ON TABLE "public"."v_packing_user_performance" TO "service_role";



GRANT ALL ON TABLE "public"."v_receiving_route_stop_overview" TO "anon";
GRANT ALL ON TABLE "public"."v_receiving_route_stop_overview" TO "authenticated";
GRANT ALL ON TABLE "public"."v_receiving_route_stop_overview" TO "service_role";



GRANT ALL ON TABLE "public"."v_receiving_route_trip_overview" TO "anon";
GRANT ALL ON TABLE "public"."v_receiving_route_trip_overview" TO "authenticated";
GRANT ALL ON TABLE "public"."v_receiving_route_trip_overview" TO "service_role";



GRANT ALL ON TABLE "public"."v_reservation_accuracy" TO "anon";
GRANT ALL ON TABLE "public"."v_reservation_accuracy" TO "authenticated";
GRANT ALL ON TABLE "public"."v_reservation_accuracy" TO "service_role";



GRANT ALL ON TABLE "public"."v_stock_alert_summary" TO "anon";
GRANT ALL ON TABLE "public"."v_stock_alert_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."v_stock_alert_summary" TO "service_role";



GRANT ALL ON TABLE "public"."wms_loadlist_picklists" TO "anon";
GRANT ALL ON TABLE "public"."wms_loadlist_picklists" TO "authenticated";
GRANT ALL ON TABLE "public"."wms_loadlist_picklists" TO "service_role";



GRANT ALL ON TABLE "public"."wms_orders" TO "anon";
GRANT ALL ON TABLE "public"."wms_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."wms_orders" TO "service_role";



GRANT ALL ON TABLE "public"."v_workflow_status_overview" TO "anon";
GRANT ALL ON TABLE "public"."v_workflow_status_overview" TO "authenticated";
GRANT ALL ON TABLE "public"."v_workflow_status_overview" TO "service_role";



GRANT ALL ON TABLE "public"."wms_stock_replenishment_alerts" TO "anon";
GRANT ALL ON TABLE "public"."wms_stock_replenishment_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."wms_stock_replenishment_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."vw_active_stock_alerts" TO "anon";
GRANT ALL ON TABLE "public"."vw_active_stock_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_active_stock_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."wms_inventory_balances" TO "anon";
GRANT ALL ON TABLE "public"."wms_inventory_balances" TO "authenticated";
GRANT ALL ON TABLE "public"."wms_inventory_balances" TO "service_role";



GRANT ALL ON TABLE "public"."vw_location_inventory_summary" TO "anon";
GRANT ALL ON TABLE "public"."vw_location_inventory_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_location_inventory_summary" TO "service_role";



GRANT ALL ON TABLE "public"."vw_material_issue_history" TO "anon";
GRANT ALL ON TABLE "public"."vw_material_issue_history" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_material_issue_history" TO "service_role";



GRANT ALL ON TABLE "public"."vw_material_issue_summary" TO "anon";
GRANT ALL ON TABLE "public"."vw_material_issue_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_material_issue_summary" TO "service_role";



GRANT ALL ON TABLE "public"."vw_material_shortage_report" TO "anon";
GRANT ALL ON TABLE "public"."vw_material_shortage_report" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_material_shortage_report" TO "service_role";



GRANT ALL ON TABLE "public"."vw_mrp_summary" TO "anon";
GRANT ALL ON TABLE "public"."vw_mrp_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_mrp_summary" TO "service_role";



GRANT ALL ON TABLE "public"."vw_pick_zone_stock_status" TO "anon";
GRANT ALL ON TABLE "public"."vw_pick_zone_stock_status" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_pick_zone_stock_status" TO "service_role";



GRANT ALL ON TABLE "public"."vw_preparation_area_utilization" TO "anon";
GRANT ALL ON TABLE "public"."vw_preparation_area_utilization" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_preparation_area_utilization" TO "service_role";



GRANT ALL ON TABLE "public"."vw_preparation_order_detail" TO "anon";
GRANT ALL ON TABLE "public"."vw_preparation_order_detail" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_preparation_order_detail" TO "service_role";



GRANT ALL ON TABLE "public"."vw_preparation_order_summary" TO "anon";
GRANT ALL ON TABLE "public"."vw_preparation_order_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_preparation_order_summary" TO "service_role";



GRANT ALL ON TABLE "public"."vw_production_material_shortage" TO "anon";
GRANT ALL ON TABLE "public"."vw_production_material_shortage" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_production_material_shortage" TO "service_role";



GRANT ALL ON TABLE "public"."vw_production_order_summary" TO "anon";
GRANT ALL ON TABLE "public"."vw_production_order_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_production_order_summary" TO "service_role";



GRANT ALL ON TABLE "public"."vw_production_progress" TO "anon";
GRANT ALL ON TABLE "public"."vw_production_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_production_progress" TO "service_role";



GRANT ALL ON TABLE "public"."vw_production_receipt_history" TO "anon";
GRANT ALL ON TABLE "public"."vw_production_receipt_history" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_production_receipt_history" TO "service_role";



GRANT ALL ON TABLE "public"."vw_sku_location_inventory" TO "anon";
GRANT ALL ON TABLE "public"."vw_sku_location_inventory" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_sku_location_inventory" TO "service_role";



GRANT ALL ON TABLE "public"."wms_stock_import_batches" TO "anon";
GRANT ALL ON TABLE "public"."wms_stock_import_batches" TO "authenticated";
GRANT ALL ON TABLE "public"."wms_stock_import_batches" TO "service_role";



GRANT ALL ON TABLE "public"."vw_stock_import_batches_summary" TO "anon";
GRANT ALL ON TABLE "public"."vw_stock_import_batches_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_stock_import_batches_summary" TO "service_role";



GRANT ALL ON SEQUENCE "public"."wms_inventory_balances_balance_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."wms_inventory_balances_balance_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."wms_inventory_balances_balance_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."wms_inventory_ledger" TO "anon";
GRANT ALL ON TABLE "public"."wms_inventory_ledger" TO "authenticated";
GRANT ALL ON TABLE "public"."wms_inventory_ledger" TO "service_role";



GRANT ALL ON SEQUENCE "public"."wms_inventory_ledger_ledger_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."wms_inventory_ledger_ledger_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."wms_inventory_ledger_ledger_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."wms_loadlist_picklists_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."wms_loadlist_picklists_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."wms_loadlist_picklists_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."wms_move_items_move_item_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."wms_move_items_move_item_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."wms_move_items_move_item_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."wms_moves" TO "anon";
GRANT ALL ON TABLE "public"."wms_moves" TO "authenticated";
GRANT ALL ON TABLE "public"."wms_moves" TO "service_role";



GRANT ALL ON SEQUENCE "public"."wms_moves_move_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."wms_moves_move_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."wms_moves_move_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."wms_order_items" TO "anon";
GRANT ALL ON TABLE "public"."wms_order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."wms_order_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."wms_order_items_order_item_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."wms_order_items_order_item_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."wms_order_items_order_item_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."wms_orders_order_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."wms_orders_order_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."wms_orders_order_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."wms_receive_items" TO "anon";
GRANT ALL ON TABLE "public"."wms_receive_items" TO "authenticated";
GRANT ALL ON TABLE "public"."wms_receive_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."wms_receive_items_item_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."wms_receive_items_item_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."wms_receive_items_item_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."wms_receives" TO "anon";
GRANT ALL ON TABLE "public"."wms_receives" TO "authenticated";
GRANT ALL ON TABLE "public"."wms_receives" TO "service_role";



GRANT ALL ON SEQUENCE "public"."wms_receives_receive_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."wms_receives_receive_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."wms_receives_receive_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."wms_stock_import_batch_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."wms_stock_import_batch_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."wms_stock_import_batch_seq" TO "service_role";



GRANT ALL ON TABLE "public"."wms_stock_import_staging" TO "anon";
GRANT ALL ON TABLE "public"."wms_stock_import_staging" TO "authenticated";
GRANT ALL ON TABLE "public"."wms_stock_import_staging" TO "service_role";



GRANT ALL ON SEQUENCE "public"."wms_stock_import_staging_staging_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."wms_stock_import_staging_staging_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."wms_stock_import_staging_staging_id_seq" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































