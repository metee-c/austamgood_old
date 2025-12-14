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
        RETURN QUERY SELECT false, NULL::BIGINT, NULL::VARCHAR, 0, 0, 0, 'เธเธฃเธธเธ“เธฒเน€เธฅเธทเธญเธเธงเธฑเธเธชเนเธเธเธญเธ';
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
                v_package_type := 'เนเธเนเธ 2 (7 เธเธ.)';
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
                v_package_type := 'เนเธเนเธ 2 (10 เธเธ.)';
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
                v_product_name := 'เธชเธดเธเธเนเธฒเธเธชเธก 7 เธเธ.';
            ELSE
                v_product_code := v_first_product_code;
                v_product_name := v_first_product_name;
            END IF;

            v_size_value := 7;
            v_size_text := '7';
            v_size_category := 'large';
            v_package_type := 'เนเธเนเธ 3 (7 เธเธ. เน€เธจเธฉ)';
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
                v_package_type := 'เนเธเนเธ 1 (10 เธเธ. เน€เธจเธฉ)';
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
                    ('เนเธเนเธ 12 เธ–เธธเธ'::TEXT, COALESCE(other_item.pack_12_bags, 0), 12),
                    ('เนเธเนเธ 6'::TEXT, COALESCE(other_item.pack_6, 0), 6),
                    ('เนเธเนเธ 4'::TEXT, COALESCE(other_item.pack_4, 0), 4),
                    ('เนเธเนเธ 2'::TEXT, COALESCE(other_item.pack_2, 0), 2),
                    ('เนเธเนเธ 1'::TEXT, COALESCE(other_item.pack_1, 0), 1)
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
                v_package_type := 'เนเธเนเธเธเธดเน€เธจเธฉ';
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
        RETURN QUERY SELECT false, NULL::BIGINT, v_face_sheet_no, 0, 0, 0, 'เนเธกเนเธกเธตเธเนเธญเธกเธนเธฅเธชเธณเธซเธฃเธฑเธเธชเธฃเนเธฒเธเนเธเธเธฐเธซเธเนเธฒ';
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
        format('เธชเธฃเนเธฒเธเนเธเธเธฐเธซเธเนเธฒเธชเธณเน€เธฃเนเธ: %s เนเธเนเธ (เน€เธฅเนเธ: %s, เนเธซเธเน: %s)',
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
        ('เน€เธเธดเธ”เธเนเธญเธเธดเธ”เธเธฅเธฒเธ”: ' || SQLERRM)::TEXT;
END;
$$;
