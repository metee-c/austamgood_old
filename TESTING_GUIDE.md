# คู่มือทดสอบระบบ WMS หลังติดตั้ง Fixes

**วันที่**: 2025-11-29
**สถานะ**: พร้อมทดสอบ

---

## 🎯 เส้นทางการทดสอบที่แนะนำ

### **วิธีที่ 1: ทดสอบแบบ End-to-End (แนะนำสำหรับ Production)**

ทดสอบตามลำดับขั้นตอนการทำงานจริง:

```
1. สร้าง Route Plan และ Trip
   ↓
2. สร้าง Picklist (ทดสอบการจองสต็อค)
   ↓
3. Assign Picklist ให้พนักงาน
   ↓
4. หยิบสินค้า (Mobile Pick)
   ↓
5. โหลดสินค้า (Loading)
   ↓
6. ตรวจสอบ Monitoring Views
```

---

### **วิธีที่ 2: ทดสอบแบบ Unit Test (แนะนำสำหรับ Development)**

ทดสอบทีละ API แบบแยกส่วน:

```
1. ทดสอบ API: สร้าง Picklist
2. ทดสอบ API: Mobile Pick
3. ทดสอบ API: Loading Complete
4. ทดสอบ Database Triggers
5. ทดสอบ Monitoring Views
```

---

## 📋 ขั้นตอนที่ 1: ตรวจสอบข้อมูลเบื้องต้น

### **1.1 ตรวจสอบว่า Migration ติดตั้งครบหรือยัง**

เข้า Supabase Studio → SQL Editor → รันคำสั่ง:

```sql
-- ตรวจสอบว่าตารางใหม่ถูกสร้างหรือยัง
SELECT table_name
FROM information_schema.tables
WHERE table_name IN (
    'picklist_item_reservations',
    'stock_replenishment_alerts'
)
ORDER BY table_name;
```

**ผลลัพธ์ที่ถูกต้อง:**
```
table_name
----------------------------
picklist_item_reservations
stock_replenishment_alerts
```

---

### **1.2 ตรวจสอบว่า Views ถูกสร้างหรือยัง**

```sql
-- ตรวจสอบ views
SELECT table_name
FROM information_schema.views
WHERE table_name IN (
    'v_reservation_accuracy',
    'v_workflow_status_overview',
    'v_stock_alert_summary'
)
ORDER BY table_name;
```

**ผลลัพธ์ที่ถูกต้อง:**
```
table_name
-------------------------
v_reservation_accuracy
v_stock_alert_summary
v_workflow_status_overview
```

---

### **1.3 ตรวจสอบว่ามีข้อมูลสำหรับทดสอบหรือยัง**

```sql
-- ตรวจสอบว่ามี Route Plan ที่ published อยู่หรือไม่
SELECT
    plan_id,
    plan_code,
    status,
    created_at
FROM receiving_route_plans
WHERE status IN ('published', 'ready_to_load')
ORDER BY created_at DESC
LIMIT 5;
```

```sql
-- ตรวจสอบว่ามี Trip หรือยัง
SELECT
    trip_id,
    trip_number,
    route_plan_id,
    created_at
FROM receiving_route_trips
ORDER BY created_at DESC
LIMIT 5;
```

```sql
-- ตรวจสอบสต็อคที่ location PK001 (หรือ location ที่จะใช้หยิบ)
SELECT
    location_id,
    sku_id,
    total_piece_qty,
    reserved_piece_qty,
    total_piece_qty - reserved_piece_qty AS available_qty
FROM wms_inventory_balances
WHERE location_id = 'PK001'
    AND total_piece_qty > 0
ORDER BY sku_id
LIMIT 10;
```

---

## 🧪 ขั้นตอนที่ 2: ทดสอบ API - สร้าง Picklist

### **2.1 เตรียมข้อมูล**

จาก query ในขั้นตอนที่ 1.3 เลือก:
- `trip_id` ที่ต้องการสร้าง picklist
- `source_location_id` ที่มีสต็อคเพียงพอ (เช่น PK001)

---

### **2.2 ทดสอบสร้าง Picklist**

**API Endpoint:**
```
POST http://localhost:3000/api/picklists/create-from-trip
```

**Request Body:**
```json
{
  "trip_id": 123,
  "source_location_id": "PK001",
  "warehouse_id": "WH001"
}
```

**ตัวอย่างการทดสอบด้วย curl:**
```bash
curl -X POST http://localhost:3000/api/picklists/create-from-trip \
  -H "Content-Type: application/json" \
  -d '{
    "trip_id": 123,
    "source_location_id": "PK001",
    "warehouse_id": "WH001"
  }'
```

---

### **2.3 ตรวจสอบผลลัพธ์**

**ผลลัพธ์ที่ถูกต้อง (Success):**
```json
{
  "success": true,
  "message": "สร้างใบจัดสินค้าสำเร็จ",
  "picklist_id": 456,
  "picklist_code": "PL-20251129-0001",
  "items_count": 5,
  "reservations_created": 5
}
```

**ผลลัพธ์เมื่อข้อมูลไม่ถูกต้อง:**
```json
// Location ไม่มีอยู่จริง
{
  "error": "Source location PK999 not found"
}

// สต็อคไม่พอ
{
  "error": "Insufficient stock for items",
  "insufficient_items": [
    {
      "sku_id": "B-BEY-C|MNB|010",
      "required": 100,
      "available": 50,
      "shortage": 50
    }
  ]
}
```

---

### **2.4 ตรวจสอบในฐานข้อมูล**

```sql
-- ตรวจสอบว่า picklist ถูกสร้างหรือยัง
SELECT
    id AS picklist_id,
    picklist_code,
    status,
    created_at
FROM picklists
ORDER BY created_at DESC
LIMIT 1;
```

```sql
-- ตรวจสอบว่า reservations ถูกสร้างหรือยัง
SELECT
    r.reservation_id,
    r.picklist_item_id,
    r.balance_id,
    r.reserved_piece_qty,
    r.reserved_pack_qty,
    r.status,
    pi.sku_id
FROM picklist_item_reservations r
JOIN picklist_items pi ON pi.id = r.picklist_item_id
WHERE pi.picklist_id = 456  -- ใช้ picklist_id ที่ได้จาก API
ORDER BY r.reservation_id;
```

**ผลลัพธ์ที่ถูกต้อง:**
- มีข้อมูลใน `picklist_item_reservations`
- `status = 'reserved'`
- `balance_id` มีค่า (ไม่เป็น NULL)
- `reserved_piece_qty` ตรงกับที่ต้องการ

---

```sql
-- ตรวจสอบว่า reserved_piece_qty ลดลงใน wms_inventory_balances
SELECT
    balance_id,
    location_id,
    sku_id,
    total_piece_qty,
    reserved_piece_qty,
    total_piece_qty - reserved_piece_qty AS available_qty
FROM wms_inventory_balances
WHERE balance_id IN (
    SELECT DISTINCT balance_id
    FROM picklist_item_reservations r
    JOIN picklist_items pi ON pi.id = r.picklist_item_id
    WHERE pi.picklist_id = 456
);
```

**ผลลัพธ์ที่ถูกต้อง:**
- `reserved_piece_qty > 0`
- `available_qty = total_piece_qty - reserved_piece_qty`

---

## 🧪 ขั้นตอนที่ 3: ทดสอบ API - Assign Picklist

### **3.1 Assign ให้พนักงาน**

```sql
-- Update picklist status เป็น 'assigned'
UPDATE picklists
SET
    status = 'assigned',
    assigned_to_employee_id = 1,  -- เปลี่ยนเป็น employee_id ที่มีจริง
    updated_at = NOW()
WHERE id = 456;
```

---

### **3.2 ตรวจสอบว่า Trigger ทำงานหรือไม่**

```sql
-- ตรวจสอบว่า orders ที่เกี่ยวข้องเปลี่ยนเป็น 'in_picking' หรือยัง
SELECT
    o.order_id,
    o.order_code,
    o.status,
    o.updated_at
FROM wms_orders o
JOIN receiving_route_plan_inputs rpi ON rpi.order_id = o.order_id
JOIN picklists p ON p.plan_id = rpi.plan_id
WHERE p.id = 456;
```

**ผลลัพธ์ที่ถูกต้อง:**
- `status = 'in_picking'`
- `updated_at` ถูก update ใหม่

---

## 🧪 ขั้นตอนที่ 4: ทดสอบ API - Mobile Pick

### **4.1 เตรียมข้อมูล**

```sql
-- ดึงข้อมูล picklist_item ที่จะทดสอบหยิบ
SELECT
    pi.id AS item_id,
    pi.picklist_id,
    pi.sku_id,
    pi.quantity_to_pick,
    pi.source_location_id,
    p.picklist_code
FROM picklist_items pi
JOIN picklists p ON p.id = pi.picklist_id
WHERE pi.picklist_id = 456
    AND pi.status = 'pending'
LIMIT 1;
```

---

### **4.2 ทดสอบ Mobile Pick API**

**API Endpoint:**
```
POST http://localhost:3000/api/mobile/pick/scan
```

**Request Body:**
```json
{
  "picklist_id": 456,
  "item_id": 789,
  "quantity_picked": 10,
  "scanned_code": "B-BEY-C|MNB|010"
}
```

**ตัวอย่างการทดสอบด้วย curl:**
```bash
curl -X POST http://localhost:3000/api/mobile/pick/scan \
  -H "Content-Type: application/json" \
  -d '{
    "picklist_id": 456,
    "item_id": 789,
    "quantity_picked": 10,
    "scanned_code": "B-BEY-C|MNB|010"
  }'
```

---

### **4.3 ตรวจสอบผลลัพธ์**

**ผลลัพธ์ที่ถูกต้อง:**
```json
{
  "success": true,
  "message": "บันทึกการหยิบสินค้าสำเร็จ",
  "picklist_status": "picking",
  "picklist_completed": false,
  "quantity_picked": 10,
  "reservations_processed": 1
}
```

---

### **4.4 ตรวจสอบในฐานข้อมูล**

```sql
-- ✅ Check 1: Reservation status เปลี่ยนเป็น 'picked'
SELECT
    r.reservation_id,
    r.status,
    r.picked_at,
    r.reserved_piece_qty
FROM picklist_item_reservations r
WHERE r.picklist_item_id = 789;
```

**ผลลัพธ์ที่ถูกต้อง:**
- `status = 'picked'`
- `picked_at` มีค่า (ไม่เป็น NULL)

---

```sql
-- ✅ Check 2: สต็อคที่ source location ลดลง
SELECT
    balance_id,
    location_id,
    sku_id,
    total_piece_qty,
    reserved_piece_qty
FROM wms_inventory_balances
WHERE balance_id IN (
    SELECT balance_id
    FROM picklist_item_reservations
    WHERE picklist_item_id = 789
);
```

**ผลลัพธ์ที่ถูกต้อง:**
- `total_piece_qty` ลดลงตามจำนวนที่หยิบ
- `reserved_piece_qty` ลดลงตามจำนวนที่หยิบ

---

```sql
-- ✅ Check 3: สต็อคที่ Dispatch เพิ่มขึ้น
SELECT
    balance_id,
    location_id,
    sku_id,
    total_piece_qty
FROM wms_inventory_balances
WHERE location_id = 'Dispatch'
    AND sku_id = 'B-BEY-C|MNB|010';
```

**ผลลัพธ์ที่ถูกต้อง:**
- `total_piece_qty` เพิ่มขึ้นตามจำนวนที่หยิบ

---

```sql
-- ✅ Check 4: Ledger entries ถูกสร้าง (OUT + IN)
SELECT
    ledger_id,
    direction,
    location_id,
    sku_id,
    piece_qty,
    reference_no,
    remarks
FROM wms_inventory_ledger
WHERE reference_doc_type = 'picklist'
    AND reference_no = 'PL-20251129-0001'
ORDER BY ledger_id DESC
LIMIT 2;
```

**ผลลัพธ์ที่ถูกต้อง:**
- มี 2 entries: `direction = 'out'` และ `direction = 'in'`
- `location_id` ต้นทาง = source_location
- `location_id` ปลายทาง = Dispatch

---

```sql
-- ✅ Check 5: picklist_item status เปลี่ยน
SELECT
    id,
    sku_id,
    status,
    quantity_picked
FROM picklist_items
WHERE id = 789;
```

**ผลลัพธ์ที่ถูกต้อง:**
- `status = 'picked'`
- `quantity_picked = 10`

---

## 🧪 ขั้นตอนที่ 5: ทดสอบ API - Loading Complete

### **5.1 เตรียมข้อมูล**

```sql
-- ตรวจสอบว่ามี loadlist หรือยัง
SELECT
    l.id AS loadlist_id,
    l.loadlist_code,
    l.status,
    lp.picklist_id
FROM loadlists l
JOIN wms_loadlist_picklists lp ON lp.loadlist_id = l.id
WHERE lp.picklist_id = 456
LIMIT 1;
```

ถ้ายังไม่มี loadlist ให้สร้างก่อน:

```sql
-- สร้าง loadlist
INSERT INTO loadlists (loadlist_code, status, created_at, updated_at)
VALUES ('LD-20251129-0001', 'pending', NOW(), NOW())
RETURNING id;

-- Link picklist กับ loadlist
INSERT INTO wms_loadlist_picklists (loadlist_id, picklist_id, created_at)
VALUES (101, 456, NOW());  -- ใช้ loadlist_id ที่ได้จาก RETURNING
```

---

### **5.2 ทดสอบ Loading Complete API**

**API Endpoint:**
```
POST http://localhost:3000/api/mobile/loading/complete
```

**Request Body:**
```json
{
  "loadlist_id": 101,
  "loadlist_code": "LD-20251129-0001",
  "warehouse_id": "WH001"
}
```

**ตัวอย่างการทดสอบด้วย curl:**
```bash
curl -X POST http://localhost:3000/api/mobile/loading/complete \
  -H "Content-Type: application/json" \
  -d '{
    "loadlist_code": "LD-20251129-0001",
    "warehouse_id": "WH001"
  }'
```

---

### **5.3 ตรวจสอบผลลัพธ์**

**ผลลัพธ์ที่ถูกต้อง (สต็อคเพียงพอ):**
```json
{
  "success": true,
  "message": "ยืนยันการโหลดสินค้าเสร็จสิ้น",
  "loadlist_code": "LD-20251129-0001",
  "items_moved": 5,
  "total_items": 5
}
```

**ผลลัพธ์เมื่อสต็อคไม่พอ (ทดสอบ Pre-Validation):**
```json
{
  "error": "ไม่สามารถโหลดสินค้าได้: สต็อคที่ Dispatch ไม่เพียงพอ",
  "insufficient_items": [
    {
      "sku_id": "B-BEY-C|MNB|010",
      "sku_code": "B-BEY-C|MNB|010",
      "sku_name": "สินค้า A",
      "picklist_code": "PL-20251129-0001",
      "required": 100,
      "available": 50,
      "shortage": 50
    }
  ],
  "message": "กรุณาตรวจสอบและเติมสต็อคที่ Dispatch ก่อนโหลด",
  "total_items": 1,
  "alerts_created": 1
}
```

---

### **5.4 ตรวจสอบในฐานข้อมูล**

```sql
-- ✅ Check 1: Loadlist status เปลี่ยนเป็น 'loaded'
SELECT
    id,
    loadlist_code,
    status,
    updated_at
FROM loadlists
WHERE id = 101;
```

**ผลลัพธ์ที่ถูกต้อง:**
- `status = 'loaded'`

---

```sql
-- ✅ Check 2: สต็อคที่ Dispatch ลดลง
SELECT
    balance_id,
    location_id,
    sku_id,
    total_piece_qty
FROM wms_inventory_balances
WHERE location_id = 'Dispatch'
    AND sku_id IN (
        SELECT DISTINCT sku_id
        FROM picklist_items
        WHERE picklist_id = 456
    );
```

**ผลลัพธ์ที่ถูกต้อง:**
- `total_piece_qty` ลดลงตามจำนวนที่โหลด

---

```sql
-- ✅ Check 3: สต็อคที่ Delivery-In-Progress เพิ่มขึ้น
SELECT
    balance_id,
    location_id,
    sku_id,
    total_piece_qty
FROM wms_inventory_balances
WHERE location_id = 'Delivery-In-Progress'
    AND sku_id IN (
        SELECT DISTINCT sku_id
        FROM picklist_items
        WHERE picklist_id = 456
    );
```

**ผลลัพธ์ที่ถูกต้อง:**
- `total_piece_qty` เพิ่มขึ้นตามจำนวนที่โหลด

---

```sql
-- ✅ Check 4: Ledger entries ถูกสร้าง
SELECT
    ledger_id,
    direction,
    location_id,
    sku_id,
    piece_qty,
    reference_no,
    remarks
FROM wms_inventory_ledger
WHERE reference_doc_type = 'loadlist'
    AND reference_no = 'LD-20251129-0001'
ORDER BY ledger_id DESC;
```

**ผลลัพธ์ที่ถูกต้อง:**
- มี entries ทั้ง OUT (จาก Dispatch) และ IN (ไป Delivery-In-Progress)

---

### **5.5 ทดสอบ Alert Creation (เมื่อสต็อคไม่พอ)**

**วิธีทดสอบ:**
1. ลดสต็อคที่ Dispatch ให้ไม่เพียงพอ:
```sql
UPDATE wms_inventory_balances
SET total_piece_qty = 5  -- ให้น้อยกว่าที่ต้องการโหลด
WHERE location_id = 'Dispatch'
    AND sku_id = 'B-BEY-C|MNB|010';
```

2. เรียก API อีกครั้ง (ควร fail และสร้าง alert)

3. ตรวจสอบ alert:
```sql
SELECT
    alert_id,
    location_id,
    sku_id,
    required_qty,
    current_qty,
    shortage_qty,
    priority,
    status,
    reference_no,
    created_at
FROM stock_replenishment_alerts
WHERE reference_no = 'LD-20251129-0001'
ORDER BY created_at DESC;
```

**ผลลัพธ์ที่ถูกต้อง:**
- มี alert ถูกสร้าง
- `priority = 'urgent'`
- `status = 'pending'`
- `shortage_qty` แสดงจำนวนที่ขาด

---

## 🧪 ขั้นตอนที่ 6: ทดสอบ Monitoring Views

### **6.1 ทดสอบ v_reservation_accuracy**

```sql
-- ตรวจสอบความแม่นยำของการจอง
SELECT
    picklist_id,
    picklist_item_id,
    sku_id,
    quantity_to_pick,
    total_reserved,
    reservation_variance,
    reservation_count,
    accuracy_status
FROM v_reservation_accuracy
WHERE picklist_id = 456;
```

**ผลลัพธ์ที่ถูกต้อง:**
- `accuracy_status = 'accurate'`
- `reservation_variance` ใกล้ 0 (< 0.01)

---

### **6.2 ทดสอบ v_workflow_status_overview**

```sql
-- ตรวจสอบสถานะ workflow
SELECT
    route_plan_id,
    plan_code,
    route_status,
    total_picklists,
    completed_picklists,
    total_loadlists,
    loaded_loadlists,
    total_orders,
    delivered_orders
FROM v_workflow_status_overview
WHERE route_plan_id IN (
    SELECT plan_id FROM picklists WHERE id = 456
);
```

**ผลลัพธ์ที่ถูกต้อง:**
- แสดงจำนวน picklists ที่ completed
- แสดงจำนวน loadlists ที่ loaded

---

### **6.3 ทดสอบ v_stock_alert_summary**

```sql
-- ตรวจสอบสรุป alerts
SELECT
    location_id,
    sku_id,
    alert_count,
    total_shortage,
    last_alert_at,
    pending_count,
    urgent_count
FROM v_stock_alert_summary;
```

**ผลลัพธ์ที่ถูกต้อง:**
- แสดง alerts ที่ยัง pending
- แสดงจำนวน shortage รวม

---

## 🧪 ขั้นตอนที่ 7: ทดสอบ State Machine (Status Validation)

### **7.1 ทดสอบ Invalid Transition (ควร fail)**

```sql
-- พยายามข้ามสถานะ (ควรเกิด error)
UPDATE wms_orders
SET status = 'delivered'
WHERE order_id = 'ORD-001'
    AND status = 'draft';
```

**ผลลัพธ์ที่ถูกต้อง:**
- ต้องเกิด ERROR
- Error message: "Invalid status transition: draft → delivered"

---

### **7.2 ทดสอบ Valid Transition (ควร success)**

```sql
-- Update ตามลำดับที่ถูกต้อง
UPDATE wms_orders
SET status = 'confirmed'
WHERE order_id = 'ORD-001'
    AND status = 'draft';
```

**ผลลัพธ์ที่ถูกต้อง:**
- UPDATE สำเร็จ
- `status = 'confirmed'`

---

## ✅ Checklist การทดสอบ

### **Phase 1: Setup & Validation**
- [ ] ตรวจสอบ migrations ติดตั้งครบ (2 tables)
- [ ] ตรวจสอบ views ถูกสร้าง (3 views)
- [ ] ตรวจสอบมีข้อมูลสำหรับทดสอบ

### **Phase 2: Picklist Creation**
- [ ] API สร้าง picklist สำเร็จ
- [ ] Reservations ถูกสร้างใน `picklist_item_reservations`
- [ ] `balance_id` ถูกบันทึก
- [ ] `reserved_piece_qty` ลดลงใน balances

### **Phase 3: Mobile Pick**
- [ ] API pick สำเร็จ
- [ ] ใช้ `balance_id` ที่จองไว้ (ไม่ query FEFO ใหม่)
- [ ] Reservation status → `picked`
- [ ] สต็อคย้ายจาก source → Dispatch
- [ ] Ledger entries ถูกสร้าง (OUT + IN)
- [ ] picklist_item status → `picked`

### **Phase 4: Loading**
- [ ] API loading สำเร็จเมื่อสต็อคเพียงพอ
- [ ] API fail เมื่อสต็อคไม่พอ
- [ ] Alert ถูกสร้างเมื่อสต็อคไม่พอ
- [ ] สต็อคย้ายจาก Dispatch → Delivery-In-Progress
- [ ] Ledger entries ถูกสร้าง
- [ ] Loadlist status → `loaded`

### **Phase 5: Monitoring**
- [ ] v_reservation_accuracy แสดงผลถูกต้อง
- [ ] v_workflow_status_overview แสดงผลถูกต้อง
- [ ] v_stock_alert_summary แสดงผลถูกต้อง

### **Phase 6: State Machine**
- [ ] Invalid transitions ถูก reject
- [ ] Valid transitions ทำงานได้

---

## 🐛 การแก้ไขปัญหาที่อาจเจอ

### **ปัญหา: API ตอบกลับ 500 Internal Server Error**

**วิธีแก้:**
1. เปิด Developer Tools → Console
2. เปิด Network tab → ดู Response
3. เปิด Terminal → ดู dev server logs
4. ตรวจสอบ Supabase logs

---

### **ปัญหา: Reservation ไม่ถูกสร้าง**

**ตรวจสอบ:**
```sql
-- ตรวจสอบว่า picklist ถูกสร้างหรือยัง
SELECT * FROM picklists WHERE id = 456;

-- ตรวจสอบว่า API error หรือไม่
-- ดูใน dev server console logs
```

---

### **ปัญหา: สต็อคไม่ลดลง/ไม่เพิ่มขึ้น**

**ตรวจสอบ:**
```sql
-- ตรวจสอบ ledger entries
SELECT * FROM wms_inventory_ledger
WHERE reference_no = 'PL-20251129-0001'
ORDER BY ledger_id DESC;

-- ตรวจสอบ balances
SELECT * FROM wms_inventory_balances
WHERE location_id IN ('PK001', 'Dispatch', 'Delivery-In-Progress')
ORDER BY sku_id, location_id;
```

---

### **ปัญหา: Alert ไม่ถูกสร้าง**

**ตรวจสอบ:**
```sql
-- ตรวจสอบว่าตาราง alerts มีอยู่หรือไม่
SELECT * FROM stock_replenishment_alerts
ORDER BY created_at DESC LIMIT 5;

-- ตรวจสอบ API logs
-- ดูใน dev server console
```

---

## 📞 สรุป

เริ่มทดสอบจาก:
1. ✅ **ขั้นตอนที่ 1** - ตรวจสอบ migrations ติดตั้งครบ
2. ✅ **ขั้นตอนที่ 2** - สร้าง Picklist (ทดสอบการจองสต็อค)
3. ✅ **ขั้นตอนที่ 4** - Mobile Pick (ทดสอบการใช้ reservation)
4. ✅ **ขั้นตอนที่ 5** - Loading (ทดสอบ pre-validation)
5. ✅ **ขั้นตอนที่ 6** - Monitoring Views

**หากพบปัญหา:**
- ตรวจสอบ console logs
- ตรวจสอบ database โดยตรง
- อ่าน error messages ให้ละเอียด

---

**End of Testing Guide**
