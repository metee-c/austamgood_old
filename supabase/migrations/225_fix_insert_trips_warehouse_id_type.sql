-- Fix insert_trips_with_daily_numbers to handle VARCHAR warehouse_id
-- Migration: 225_fix_insert_trips_warehouse_id_type.sql

-- Drop existing function
DROP FUNCTION IF EXISTS insert_trips_with_daily_numbers(date, jsonb);

-- Recreate with correct warehouse_id type (VARCHAR instead of INTEGER)
CREATE OR REPLACE FUNCTION insert_trips_with_daily_numbers(
  p_plan_date DATE,
  p_trips JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_start_number INTEGER;
  v_lock_key BIGINT;
  v_trip JSONB;
  v_index INTEGER := 0;
  v_inserted_ids INTEGER[] := '{}';
  v_trip_id INTEGER;
BEGIN
  -- สร้าง lock key จากวันที่
  v_lock_key := EXTRACT(EPOCH FROM p_plan_date)::BIGINT;
  
  -- ใช้ advisory lock ป้องกัน race condition
  PERFORM pg_advisory_xact_lock(v_lock_key);
  
  -- ดึงเลขคันสูงสุดของวันนั้น
  SELECT COALESCE(MAX(t.daily_trip_number), 0)
  INTO v_start_number
  FROM receiving_route_trips t
  JOIN receiving_route_plans p ON t.plan_id = p.plan_id
  WHERE DATE(p.plan_date) = p_plan_date;
  
  -- Insert แต่ละ trip พร้อมกำหนด daily_trip_number
  FOR v_trip IN SELECT * FROM jsonb_array_elements(p_trips)
  LOOP
    v_index := v_index + 1;
    
    INSERT INTO receiving_route_trips (
      plan_id,
      trip_sequence,
      trip_code,
      trip_status,
      warehouse_id,
      total_distance_km,
      total_drive_minutes,
      total_service_minutes,
      total_stops,
      total_weight_kg,
      total_volume_cbm,
      total_pallets,
      capacity_utilization,
      fuel_cost_estimate,
      shipping_cost,
      base_price,
      helper_fee,
      extra_stop_fee,
      is_overweight,
      notes,
      daily_trip_number
    ) VALUES (
      (v_trip->>'plan_id')::INTEGER,
      (v_trip->>'trip_sequence')::INTEGER,
      v_trip->>'trip_code',
      COALESCE((v_trip->>'trip_status'), 'planned')::receiving_route_trip_status_enum,
      v_trip->>'warehouse_id', -- ✅ Changed: Keep as VARCHAR, don't cast to INTEGER
      COALESCE((v_trip->>'total_distance_km')::NUMERIC, 0),
      COALESCE((v_trip->>'total_drive_minutes')::INTEGER, 0),
      COALESCE((v_trip->>'total_service_minutes')::INTEGER, 0),
      COALESCE((v_trip->>'total_stops')::INTEGER, 0),
      COALESCE((v_trip->>'total_weight_kg')::NUMERIC, 0),
      COALESCE((v_trip->>'total_volume_cbm')::NUMERIC, 0),
      COALESCE((v_trip->>'total_pallets')::NUMERIC, 0),
      COALESCE((v_trip->>'capacity_utilization')::INTEGER, 0),
      COALESCE((v_trip->>'fuel_cost_estimate')::NUMERIC, 0),
      NULLIF(v_trip->>'shipping_cost', '')::NUMERIC,
      NULLIF(v_trip->>'base_price', '')::NUMERIC,
      NULLIF(v_trip->>'helper_fee', '')::NUMERIC,
      NULLIF(v_trip->>'extra_stop_fee', '')::NUMERIC,
      COALESCE((v_trip->>'is_overweight')::BOOLEAN, false),
      v_trip->>'notes',
      v_start_number + v_index  -- เลขคันที่ไม่ซ้ำกัน
    )
    RETURNING trip_id INTO v_trip_id;
    
    v_inserted_ids := array_append(v_inserted_ids, v_trip_id);
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'start_number', v_start_number + 1,
    'count', v_index,
    'trip_ids', to_jsonb(v_inserted_ids)
  );
END;
$$;

-- Add comment
COMMENT ON FUNCTION insert_trips_with_daily_numbers(DATE, JSONB) IS 
'Insert multiple trips with auto-generated daily_trip_number. Uses advisory lock to prevent race conditions. Fixed to handle VARCHAR warehouse_id.';
