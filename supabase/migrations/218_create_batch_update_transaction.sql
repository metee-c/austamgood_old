-- Migration: Create batch update transaction function
-- Purpose: แก้ไข Bug #7 - Batch Update Transaction
-- ป้องกัน partial update โดยใช้ transaction

-- ฟังก์ชันสำหรับ batch update stops ใน transaction
CREATE OR REPLACE FUNCTION batch_update_route_stops(
  p_moves jsonb DEFAULT '[]'::jsonb,
  p_reorders jsonb DEFAULT '[]'::jsonb,
  p_deletes jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_result jsonb := '{}'::jsonb;
  v_move jsonb;
  v_reorder jsonb;
  v_delete jsonb;
  v_stop_id integer;
  v_from_trip_id integer;
  v_to_trip_id integer;
  v_order_id integer;
  v_trip_id integer;
  v_stop_ids integer[];
  v_new_seq integer;
  v_temp_offset integer := 10000;
  v_i integer;
BEGIN
  -- เริ่ม transaction (implicit ใน function)
  
  -- 1. Process deletes first
  IF jsonb_array_length(p_deletes) > 0 THEN
    FOR v_i IN 0..jsonb_array_length(p_deletes)-1 LOOP
      v_delete := p_deletes->v_i;
      v_stop_id := (v_delete->>'stopId')::integer;
      v_order_id := (v_delete->>'orderId')::integer;
      v_trip_id := (v_delete->>'tripId')::integer;
      
      -- Delete stop items
      DELETE FROM receiving_route_stop_items
      WHERE stop_id = v_stop_id;
      
      -- Delete stop
      DELETE FROM receiving_route_stops
      WHERE stop_id = v_stop_id;
      
      -- Revert order status
      UPDATE wms_orders
      SET status = 'confirmed',
          updated_at = NOW()
      WHERE order_id = v_order_id;
      
      -- Resequence remaining stops
      IF v_trip_id IS NOT NULL THEN
        WITH numbered_stops AS (
          SELECT stop_id, ROW_NUMBER() OVER (ORDER BY sequence_no) as new_seq
          FROM receiving_route_stops
          WHERE trip_id = v_trip_id
        )
        UPDATE receiving_route_stops rs
        SET sequence_no = ns.new_seq
        FROM numbered_stops ns
        WHERE rs.stop_id = ns.stop_id;
      END IF;
    END LOOP;
  END IF;
  
  -- 2. Process moves
  IF jsonb_array_length(p_moves) > 0 THEN
    FOR v_i IN 0..jsonb_array_length(p_moves)-1 LOOP
      v_move := p_moves->v_i;
      v_order_id := (v_move->>'orderId')::integer;
      v_from_trip_id := (v_move->>'fromTripId')::integer;
      v_to_trip_id := (v_move->>'toTripId')::integer;
      
      -- Find stop with this order
      SELECT stop_id INTO v_stop_id
      FROM receiving_route_stops
      WHERE trip_id = v_from_trip_id
        AND (order_id = v_order_id OR tags->'order_ids' @> to_jsonb(v_order_id))
      LIMIT 1;
      
      IF v_stop_id IS NOT NULL THEN
        -- Get max sequence in target trip
        SELECT COALESCE(MAX(sequence_no), 0) + 1 INTO v_new_seq
        FROM receiving_route_stops
        WHERE trip_id = v_to_trip_id;
        
        -- Move stop to target trip
        UPDATE receiving_route_stops
        SET trip_id = v_to_trip_id,
            sequence_no = v_new_seq,
            updated_at = NOW()
        WHERE stop_id = v_stop_id;
        
        -- Update stop items trip_id
        UPDATE receiving_route_stop_items
        SET trip_id = v_to_trip_id
        WHERE stop_id = v_stop_id;
        
        -- Resequence remaining stops in source trip
        WITH numbered_stops AS (
          SELECT stop_id, ROW_NUMBER() OVER (ORDER BY sequence_no) as new_seq
          FROM receiving_route_stops
          WHERE trip_id = v_from_trip_id
        )
        UPDATE receiving_route_stops rs
        SET sequence_no = ns.new_seq
        FROM numbered_stops ns
        WHERE rs.stop_id = ns.stop_id;
      END IF;
    END LOOP;
  END IF;
  
  -- 3. Process reorders (2-phase update to avoid unique constraint violations)
  IF jsonb_array_length(p_reorders) > 0 THEN
    FOR v_i IN 0..jsonb_array_length(p_reorders)-1 LOOP
      v_reorder := p_reorders->v_i;
      v_trip_id := (v_reorder->>'tripId')::integer;
      
      -- Convert jsonb array to integer array
      SELECT ARRAY(
        SELECT (value::text)::integer
        FROM jsonb_array_elements(v_reorder->'orderedStopIds')
      ) INTO v_stop_ids;
      
      -- Phase 1: Set temporary sequence numbers
      FOR v_i IN 1..array_length(v_stop_ids, 1) LOOP
        UPDATE receiving_route_stops
        SET sequence_no = v_temp_offset + v_i
        WHERE stop_id = v_stop_ids[v_i];
      END LOOP;
      
      -- Phase 2: Set final sequence numbers
      FOR v_i IN 1..array_length(v_stop_ids, 1) LOOP
        UPDATE receiving_route_stops
        SET sequence_no = v_i,
            updated_at = NOW()
        WHERE stop_id = v_stop_ids[v_i];
      END LOOP;
    END LOOP;
  END IF;
  
  -- Return success result
  v_result := jsonb_build_object(
    'success', true,
    'moves_processed', jsonb_array_length(p_moves),
    'reorders_processed', jsonb_array_length(p_reorders),
    'deletes_processed', jsonb_array_length(p_deletes)
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Rollback จะเกิดอัตโนมัติเมื่อมี exception
    RAISE EXCEPTION 'Batch update failed: %', SQLERRM;
END;
$$;

-- Comment
COMMENT ON FUNCTION batch_update_route_stops IS 
'Batch update route stops in a single transaction. Prevents partial updates by using atomic operations.';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION batch_update_route_stops TO authenticated;
GRANT EXECUTE ON FUNCTION batch_update_route_stops TO service_role;
