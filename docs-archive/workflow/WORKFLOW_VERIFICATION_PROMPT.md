# Workflow Status Management - Verification Prompt for MCP Supabase

## Context
ระบบ Workflow Status Management ถูกพัฒนาเพื่อจัดการการเปลี่ยนสถานะอัตโนมัติในกระบวนการจัดส่งสินค้า ครอบคลุม 8 ขั้นตอน จาก Order นำเข้า → Route Planning → Picking → Loading → จัดส่ง

## Your Task
ใช้ MCP Supabase เพื่อตรวจสอบว่าระบบที่พัฒนามาทำงานได้ถูกต้องครบถ้วน 100% หรือไม่

---

## 🔍 Part 1: Database Schema Verification

### 1.1 ตรวจสอบ Enum Types ใหม่

```sql
-- ตรวจสอบว่า receiving_route_plan_status_enum มีค่าใหม่หรือไม่
SELECT enumlabel
FROM pg_enum
WHERE enumtypid = (
  SELECT oid FROM pg_type WHERE typname = 'receiving_route_plan_status_enum'
);
-- ต้องมี: 'ready_to_load', 'in_transit'
```

```sql
-- ตรวจสอบว่ามี loadlist_status_enum หรือไม่
SELECT enumlabel
FROM pg_enum
WHERE enumtypid = (
  SELECT oid FROM pg_type WHERE typname = 'loadlist_status_enum'
);
-- ต้องมี: 'pending', 'loading', 'loaded', 'completed', 'cancelled'
```

### 1.2 ตรวจสอบตาราง loadlists

```sql
-- ตรวจสอบว่าตาราง loadlists ถูกสร้างและมี columns ครบ
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'loadlists'
ORDER BY ordinal_position;

-- ต้องมี columns:
-- - id (bigint)
-- - loadlist_code (varchar)
-- - plan_id (bigint, FK to receiving_route_plans)
-- - status (loadlist_status_enum)
-- - total_orders, total_weight_kg, total_volume_cbm
-- - departure_time (timestamp with time zone)
-- - created_at, updated_at
```

### 1.3 ตรวจสอบตาราง loadlist_items

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'loadlist_items'
ORDER BY ordinal_position;

-- ต้องมี columns:
-- - id, loadlist_id, order_id
-- - weight_kg, volume_cbm
-- - scanned_at, scanned_by_employee_id
-- - UNIQUE constraint: (loadlist_id, order_id)
```

### 1.4 ตรวจสอบ Foreign Keys

```sql
-- ตรวจสอบ FK ของ loadlists
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('loadlists', 'loadlist_items');

-- ต้องมี:
-- loadlists.plan_id → receiving_route_plans.plan_id
-- loadlist_items.loadlist_id → loadlists.id
-- loadlist_items.order_id → wms_orders.order_id
```

---

## 🔍 Part 2: Trigger Functions Verification

### 2.1 ตรวจสอบว่ามี Trigger Functions ครบ 6 ตัว

```sql
SELECT
    routine_name,
    routine_definition
FROM information_schema.routines
WHERE routine_type = 'FUNCTION'
  AND routine_schema = 'public'
  AND routine_name IN (
    'update_orders_on_route_publish',
    'update_orders_on_picklist_create',
    'update_orders_and_route_on_picklist_complete',
    'update_order_on_loadlist_scan',
    'update_orders_and_route_on_departure',
    'update_loadlist_and_route_on_delivery'
  )
ORDER BY routine_name;

-- ต้องมีครบ 6 functions
```

### 2.2 ตรวจสอบว่ามี Triggers ครบ 6 ตัว

```sql
SELECT
    trigger_name,
    event_object_table,
    action_timing,
    event_manipulation
FROM information_schema.triggers
WHERE trigger_name IN (
    'trigger_route_publish_update_orders',
    'trigger_picklist_create_update_orders',
    'trigger_picklist_complete_update_orders_and_route',
    'trigger_loadlist_item_update_order',
    'trigger_departure_update_orders_and_route',
    'trigger_delivery_update_loadlist_and_route'
)
ORDER BY trigger_name;

-- ต้องมีครบ 6 triggers
-- ตรวจสอบว่าแต่ละ trigger ผูกกับ table และ event ที่ถูกต้อง
```

### 2.3 ตรวจสอบ Trigger Details

```sql
-- Trigger 1: Route Publish
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_name = 'trigger_route_publish_update_orders';
-- ต้องเป็น: AFTER UPDATE ON receiving_route_plans

-- Trigger 2: Picklist Create
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_name = 'trigger_picklist_create_update_orders';
-- ต้องเป็น: AFTER INSERT ON picklists

-- Trigger 3: Picklist Complete
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_name = 'trigger_picklist_complete_update_orders_and_route';
-- ต้องเป็น: AFTER UPDATE ON picklists

-- Trigger 4: Loadlist Scan
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_name = 'trigger_loadlist_item_update_order';
-- ต้องเป็น: AFTER INSERT ON loadlist_items

-- Trigger 5: Departure
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_name = 'trigger_departure_update_orders_and_route';
-- ต้องเป็น: AFTER UPDATE ON loadlists

-- Trigger 6: Delivery
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_name = 'trigger_delivery_update_loadlist_and_route';
-- ต้องเป็น: AFTER UPDATE ON wms_orders
```

---

## 🔍 Part 3: Data Integrity Checks

### 3.1 ตรวจสอบสถานะ Orders ที่ถูกต้อง

```sql
-- ตรวจสอบว่ามี Orders ในแต่ละสถานะ (ถ้ามีข้อมูลทดสอบ)
SELECT
    status,
    COUNT(*) as count
FROM wms_orders
WHERE status IN ('draft', 'confirmed', 'in_picking', 'picked', 'loaded', 'in_transit', 'delivered')
GROUP BY status
ORDER BY
    CASE status
        WHEN 'draft' THEN 1
        WHEN 'confirmed' THEN 2
        WHEN 'in_picking' THEN 3
        WHEN 'picked' THEN 4
        WHEN 'loaded' THEN 5
        WHEN 'in_transit' THEN 6
        WHEN 'delivered' THEN 7
    END;
```

### 3.2 ตรวจสอบ Route Plans

```sql
-- ตรวจสอบสถานะของ Route Plans
SELECT
    status,
    COUNT(*) as count
FROM receiving_route_plans
GROUP BY status
ORDER BY status;

-- ต้องมีสถานะ: draft, optimizing, published, ready_to_load, in_transit, completed, cancelled
```

### 3.3 ตรวจสอบ Picklists

```sql
SELECT
    status,
    COUNT(*) as count
FROM picklists
GROUP BY status
ORDER BY status;

-- ต้องมีสถานะ: pending, assigned, picking, completed, cancelled
```

### 3.4 ตรวจสอบ Loadlists

```sql
SELECT
    status,
    COUNT(*) as count
FROM loadlists
GROUP BY status
ORDER BY status;

-- ต้องมีสถานะ: pending, loading, loaded, completed, cancelled
```

---

## 🧪 Part 4: Trigger Behavior Testing (Simulation)

### 4.1 Test Trigger 1: Route Publish → Orders Confirmed

```sql
-- ดูข้อมูลก่อนทดสอบ
SELECT plan_id, plan_code, status FROM receiving_route_plans WHERE plan_id = [TEST_PLAN_ID];
SELECT order_id, order_no, status FROM wms_orders WHERE order_id IN (
    SELECT DISTINCT unnest(order_ids)
    FROM receiving_route_trip_stops
    WHERE trip_id IN (
        SELECT trip_id FROM receiving_route_trips WHERE plan_id = [TEST_PLAN_ID]
    )
);

-- จำลองการ Publish
-- UPDATE receiving_route_plans SET status = 'published' WHERE plan_id = [TEST_PLAN_ID];

-- ตรวจสอบว่า Orders เปลี่ยนเป็น 'confirmed' หรือไม่
-- SELECT order_id, order_no, status FROM wms_orders WHERE order_id IN (...);
```

### 4.2 Test Trigger 2: Picklist Create → Orders In_Picking

```sql
-- หา Picklist ที่เพิ่งสร้าง
SELECT id, picklist_code, status FROM picklists WHERE status = 'pending' LIMIT 1;

-- ดู Orders ที่อยู่ใน Picklist นี้
SELECT o.order_id, o.order_no, o.status
FROM wms_orders o
INNER JOIN picklist_items pi ON o.order_id = pi.order_id
WHERE pi.picklist_id = [PICKLIST_ID];

-- ตรวจสอบว่า Orders มีสถานะ 'in_picking' หรือไม่
```

### 4.3 Test Trigger 3: Picklist Complete → Orders Picked + Route Ready_to_Load

```sql
-- หา Picklist ที่มีสถานะ 'picking'
SELECT id, picklist_code, status, plan_id FROM picklists WHERE status = 'picking' LIMIT 1;

-- จำลองการ Complete
-- UPDATE picklists SET status = 'completed' WHERE id = [PICKLIST_ID];

-- ตรวจสอบ Orders เปลี่ยนเป็น 'picked'
SELECT o.order_id, o.order_no, o.status
FROM wms_orders o
INNER JOIN picklist_items pi ON o.order_id = pi.order_id
WHERE pi.picklist_id = [PICKLIST_ID];

-- ตรวจสอบ Route Plan (ถ้า Picklists เสร็จหมด)
SELECT plan_id, plan_code, status FROM receiving_route_plans WHERE plan_id = [PLAN_ID];
```

### 4.4 Test Trigger 4: Loadlist Scan → Orders Loaded

```sql
-- หา Loadlist
SELECT id, loadlist_code, status FROM loadlists LIMIT 1;

-- จำลองการสแกน Order เข้า Loadlist
-- INSERT INTO loadlist_items (loadlist_id, order_id, weight_kg, scanned_at)
-- VALUES ([LOADLIST_ID], [ORDER_ID], 10.5, NOW());

-- ตรวจสอบว่า Order เปลี่ยนเป็น 'loaded'
SELECT order_id, order_no, status FROM wms_orders WHERE order_id = [ORDER_ID];

-- ตรวจสอบว่า Loadlist เปลี่ยนเป็น 'loading'
SELECT id, loadlist_code, status FROM loadlists WHERE id = [LOADLIST_ID];
```

### 4.5 Test Trigger 5: Loadlist Depart → Orders In_Transit + Route In_Transit

```sql
-- จำลองการออกจัดส่ง
-- UPDATE loadlists SET status = 'loaded', departure_time = NOW() WHERE id = [LOADLIST_ID];

-- ตรวจสอบ Orders เปลี่ยนเป็น 'in_transit'
SELECT o.order_id, o.order_no, o.status
FROM wms_orders o
INNER JOIN loadlist_items li ON o.order_id = li.order_id
WHERE li.loadlist_id = [LOADLIST_ID];

-- ตรวจสอบ Route Plan เปลี่ยนเป็น 'in_transit'
SELECT plan_id, plan_code, status FROM receiving_route_plans WHERE plan_id = [PLAN_ID];
```

### 4.6 Test Trigger 6: Order Delivered → Loadlist + Route Completed

```sql
-- จำลองการส่งถึง
-- UPDATE wms_orders SET status = 'delivered' WHERE order_id = [ORDER_ID];

-- ตรวจสอบว่า Loadlist เปลี่ยนเป็น 'completed' (ถ้า Orders ทั้งหมดส่งถึง)
SELECT l.id, l.loadlist_code, l.status
FROM loadlists l
INNER JOIN loadlist_items li ON l.id = li.loadlist_id
WHERE li.order_id = [ORDER_ID];

-- ตรวจสอบว่า Route Plan เปลี่ยนเป็น 'completed' (ถ้า Loadlists ทั้งหมดเสร็จ)
SELECT plan_id, plan_code, status FROM receiving_route_plans WHERE plan_id = [PLAN_ID];
```

---

## 🔍 Part 5: API Endpoint Verification (Logical Check)

เนื่องจาก MCP Supabase ไม่สามารถเรียก API endpoints ได้โดยตรง ให้ตรวจสอบเฉพาะ Logic ที่เกี่ยวข้องกับ Database:

### 5.1 Picklist Print Logic

```sql
-- ตรวจสอบว่า Picklist ที่มีสถานะ 'pending' สามารถเปลี่ยนเป็น 'picking' ได้
SELECT id, picklist_code, status
FROM picklists
WHERE status = 'pending'
LIMIT 5;

-- Endpoint: POST /api/picklists/{id}/print
-- Logic: UPDATE picklists SET status = 'picking', picking_started_at = NOW() WHERE id = ? AND status = 'pending'
```

### 5.2 Picklist Complete Logic

```sql
-- ตรวจสอบว่า Picklist ที่มีสถานะ 'picking' สามารถเปลี่ยนเป็น 'completed' ได้
SELECT id, picklist_code, status
FROM picklists
WHERE status = 'picking'
LIMIT 5;

-- Endpoint: POST /api/picklists/{id}/complete
-- Logic: UPDATE picklists SET status = 'completed', picking_completed_at = NOW() WHERE id = ? AND status = 'picking'
```

### 5.3 Loadlist Scan Logic

```sql
-- ตรวจสอบว่า Order ที่มีสถานะ 'picked' สามารถสแกนเข้า Loadlist ได้
SELECT order_id, order_no, status
FROM wms_orders
WHERE status = 'picked'
LIMIT 5;

-- Endpoint: POST /api/loadlists/{id}/scan
-- Logic: INSERT INTO loadlist_items (loadlist_id, order_id, ...) WHERE order.status = 'picked'
```

### 5.4 Loadlist Depart Logic

```sql
-- ตรวจสอบว่า Loadlist ที่มีสถานะ 'loading' สามารถออกจัดส่งได้
SELECT id, loadlist_code, status
FROM loadlists
WHERE status = 'loading'
LIMIT 5;

-- Endpoint: POST /api/loadlists/{id}/depart
-- Logic: UPDATE loadlists SET status = 'loaded', departure_time = NOW() WHERE id = ? AND status = 'loading'
```

---

## 🔍 Part 6: Relationship & Consistency Checks

### 6.1 ตรวจสอบความสัมพันธ์ Route Plan → Picklists → Orders

```sql
SELECT
    rp.plan_id,
    rp.plan_code,
    rp.status as plan_status,
    COUNT(DISTINCT p.id) as total_picklists,
    COUNT(DISTINCT CASE WHEN p.status = 'completed' THEN p.id END) as completed_picklists,
    COUNT(DISTINCT pi.order_id) as total_orders
FROM receiving_route_plans rp
LEFT JOIN picklists p ON rp.plan_id = p.plan_id
LEFT JOIN picklist_items pi ON p.id = pi.picklist_id
WHERE rp.plan_id IS NOT NULL
GROUP BY rp.plan_id, rp.plan_code, rp.status
ORDER BY rp.plan_id DESC
LIMIT 10;

-- ตรวจสอบ Logic:
-- - ถ้า plan_status = 'ready_to_load' → ทุก Picklist ต้อง completed
-- - ถ้า plan_status = 'in_transit' → ต้องมี Loadlist ที่ loaded
-- - ถ้า plan_status = 'completed' → ทุก Loadlist ต้อง completed
```

### 6.2 ตรวจสอบความสัมพันธ์ Loadlist → Orders

```sql
SELECT
    l.id,
    l.loadlist_code,
    l.status as loadlist_status,
    COUNT(li.order_id) as total_orders,
    COUNT(CASE WHEN o.status = 'loaded' THEN 1 END) as loaded_orders,
    COUNT(CASE WHEN o.status = 'in_transit' THEN 1 END) as intransit_orders,
    COUNT(CASE WHEN o.status = 'delivered' THEN 1 END) as delivered_orders
FROM loadlists l
LEFT JOIN loadlist_items li ON l.id = li.loadlist_id
LEFT JOIN wms_orders o ON li.order_id = o.order_id
GROUP BY l.id, l.loadlist_code, l.status
ORDER BY l.id DESC
LIMIT 10;

-- ตรวจสอบ Logic:
-- - ถ้า loadlist_status = 'loading' → Orders ควรเป็น 'loaded'
-- - ถ้า loadlist_status = 'loaded' → Orders ควรเป็น 'in_transit'
-- - ถ้า loadlist_status = 'completed' → Orders ควรเป็น 'delivered'
```

### 6.3 ตรวจสอบ Orphan Records

```sql
-- Loadlist items ที่ไม่มี Order
SELECT COUNT(*) as orphan_count
FROM loadlist_items li
LEFT JOIN wms_orders o ON li.order_id = o.order_id
WHERE o.order_id IS NULL;

-- Picklist items ที่ไม่มี Order
SELECT COUNT(*) as orphan_count
FROM picklist_items pi
LEFT JOIN wms_orders o ON pi.order_id = o.order_id
WHERE o.order_id IS NULL;

-- ต้องได้ 0 ทั้งหมด
```

---

## 📊 Part 7: Summary Report

หลังจากตรวจสอบทุก Part แล้ว กรุณาสรุปผลลัพธ์ดังนี้:

### Database Schema
- ✅/❌ Enum types ถูกเพิ่มครบ (ready_to_load, in_transit, loadlist_status_enum)
- ✅/❌ Tables ถูกสร้าง (loadlists, loadlist_items)
- ✅/❌ Foreign keys ถูกต้อง
- ✅/❌ Unique constraints ถูกตั้งค่า

### Trigger Functions
- ✅/❌ มี Trigger Functions ครบ 6 ตัว
- ✅/❌ Triggers ผูกกับ Tables และ Events ถูกต้อง
- ✅/❌ Trigger timing (AFTER UPDATE/INSERT) ถูกต้อง

### Data Integrity
- ✅/❌ Order statuses ถูกต้องตาม Workflow
- ✅/❌ Route Plan statuses มีค่าใหม่ (ready_to_load, in_transit)
- ✅/❌ Loadlist และ Loadlist Items มีข้อมูลที่สอดคล้อง
- ✅/❌ ไม่มี Orphan Records

### Trigger Behavior (ถ้าทดสอบได้)
- ✅/❌ Trigger 1: Route Publish → Orders Confirmed
- ✅/❌ Trigger 2: Picklist Create → Orders In_Picking
- ✅/❌ Trigger 3: Picklist Complete → Orders Picked + Route Ready_to_Load
- ✅/❌ Trigger 4: Loadlist Scan → Orders Loaded
- ✅/❌ Trigger 5: Loadlist Depart → Orders In_Transit + Route In_Transit
- ✅/❌ Trigger 6: Order Delivered → Loadlist + Route Completed

### Relationship Consistency
- ✅/❌ Route Plans → Picklists → Orders สัมพันธ์กันถูกต้อง
- ✅/❌ Loadlists → Orders สัมพันธ์กันถูกต้อง
- ✅/❌ Status consistency ระหว่าง parent-child records

### Overall Assessment
- **สรุป:** [ระบบพร้อมใช้งาน / มีปัญหาที่ต้องแก้ไข]
- **ปัญหาที่พบ:** [ระบุรายละเอียด]
- **คำแนะนำ:** [แนวทางแก้ไข]

---

## 🎯 Expected Results

**ถ้าระบบถูกต้อง 100%:**

1. ✅ มี Enum types: `ready_to_load`, `in_transit`, `loadlist_status_enum`
2. ✅ มีตาราง: `loadlists`, `loadlist_items` พร้อม FK และ constraints ครบ
3. ✅ มี Trigger Functions ครบ 6 ตัว
4. ✅ มี Triggers ครบ 6 ตัว ผูกกับ Tables ถูกต้อง
5. ✅ Workflow สามารถทำงานได้ตามลำดับ: draft → confirmed → in_picking → picked → loaded → in_transit → delivered
6. ✅ Route Plans เปลี่ยนสถานะได้: published → ready_to_load → in_transit → completed
7. ✅ Loadlists เปลี่ยนสถานะได้: pending → loading → loaded → completed
8. ✅ ไม่มี Orphan Records
9. ✅ Relationships สอดคล้องกัน

---

## 📝 Notes

- ใช้ MCP Supabase เรียก SQL queries ข้างต้น
- ถ้าพบปัญหา ให้ระบุรายละเอียดและแนะนำแนวทางแก้ไข
- ถ้าไม่สามารถทดสอบ Trigger Behavior ได้ (ไม่มีข้อมูลทดสอบ) ให้ข้ามและระบุในรายงาน
- สรุปผลเป็นภาษาไทยให้เข้าใจง่าย

---

**Good luck with the verification! 🚀**
