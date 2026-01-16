-- Migration: Auto-resequence trip_sequence when plan_date changes
-- ปัญหา: เมื่อย้ายแผนจากวันหนึ่งไปอีกวันหนึ่ง trip_sequence ไม่ได้รีเซ็ตและรันต่อจากเลขสุดท้ายของวันใหม่
-- วิธีแก้: สร้าง trigger ที่คำนวณ trip_sequence ใหม่อัตโนมัติเมื่อ plan_date เปลี่ยน

-- =====================================================
-- FUNCTION: recalculate_trip_sequences_for_plan_on_date_change
-- คำนวณ trip_sequence ใหม่สำหรับแผนที่ถูกย้ายวันที่
-- =====================================================
CREATE OR REPLACE FUNCTION recalculate_trip_sequences_for_plan_on_date_change(
    p_plan_id BIGINT,
    p_new_date DATE
)
RETURNS void AS $$
DECLARE
    v_max_sequence SMALLINT;
    v_trip RECORD;
    v_new_sequence SMALLINT;
BEGIN
    -- หา trip_sequence สูงสุดของวันใหม่ (ไม่รวมแผนที่กำลังย้าย)
    SELECT COALESCE(MAX(t.trip_sequence), 0) INTO v_max_sequence
    FROM receiving_route_trips t
    INNER JOIN receiving_route_plans p ON t.plan_id = p.plan_id
    WHERE p.plan_date = p_new_date
      AND t.plan_id != p_plan_id;
    
    v_new_sequence := v_max_sequence;
    
    -- อัปเดต trip_sequence ของทุก trips ในแผนนี้
    FOR v_trip IN
        SELECT trip_id
        FROM receiving_route_trips
        WHERE plan_id = p_plan_id
        ORDER BY trip_sequence NULLS LAST, trip_id
    LOOP
        v_new_sequence := v_new_sequence + 1;
        
        UPDATE receiving_route_trips
        SET trip_sequence = v_new_sequence
        WHERE trip_id = v_trip.trip_id;
    END LOOP;
    
    RAISE NOTICE 'Recalculated trip_sequence for plan % on date %. New sequences start from %', 
        p_plan_id, p_new_date, v_max_sequence + 1;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGER FUNCTION: trigger_recalculate_trip_sequence_on_plan_date_change
-- เรียก recalculate เมื่อ plan_date เปลี่ยน
-- =====================================================
CREATE OR REPLACE FUNCTION trigger_recalculate_trip_sequence_on_plan_date_change()
RETURNS TRIGGER AS $$
BEGIN
    -- ถ้า plan_date เปลี่ยน
    IF OLD.plan_date IS DISTINCT FROM NEW.plan_date THEN
        -- คำนวณ trip_sequence ใหม่สำหรับแผนนี้
        PERFORM recalculate_trip_sequences_for_plan_on_date_change(NEW.plan_id, NEW.plan_date);
        
        RAISE NOTICE 'Plan % moved from % to %. Trip sequences recalculated.', 
            NEW.plan_code, OLD.plan_date, NEW.plan_date;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- สร้าง trigger
DROP TRIGGER IF EXISTS auto_recalculate_trip_sequence_on_plan_date_change ON receiving_route_plans;
CREATE TRIGGER auto_recalculate_trip_sequence_on_plan_date_change
    AFTER UPDATE ON receiving_route_plans
    FOR EACH ROW
    WHEN (OLD.plan_date IS DISTINCT FROM NEW.plan_date)
    EXECUTE FUNCTION trigger_recalculate_trip_sequence_on_plan_date_change();

-- =====================================================
-- COMMENT
-- =====================================================
COMMENT ON FUNCTION recalculate_trip_sequences_for_plan_on_date_change(BIGINT, DATE) IS 
'คำนวณ trip_sequence ใหม่สำหรับแผนที่ถูกย้ายวันที่ โดยต่อจากเลขสูงสุดของวันนั้น';

COMMENT ON TRIGGER auto_recalculate_trip_sequence_on_plan_date_change ON receiving_route_plans IS 
'เมื่อ plan_date เปลี่ยน ให้คำนวณ trip_sequence ของ trips ในแผนนั้นใหม่อัตโนมัติ';
