# 📊 การวิเคราะห์ครบวงจรการจัดการสต็อกทั้ง 3 ประเภทออเดอร์

**วันที่:** 2 ธันวาคม 2025
**วัตถุประสงค์:** วิเคราะห์และออกแบบระบบจัดการสต็อกสำหรับออเดอร์พิเศษ (Special Orders)

---

## 📋 สารบัญ

1. [ภาพรวมทั้ง 3 ประเภทออเดอร์](#ภาพรวมทั้ง-3-ประเภทออเดอร์)
2. [ออเดอร์จัดเส้นทาง (Route Planning Orders)](#1-ออเดอร์จัดเส้นทาง-route-planning-orders)
3. [ออเดอร์ส่งรายชิ้น (Express Orders / Face Sheets)](#2-ออเดอร์ส่งรายชิ้น-express-orders--face-sheets)
4. [ออเดอร์พิเศษ (Special Orders / Bonus Face Sheets)](#3-ออเดอร์พิเศษ-special-orders--bonus-face-sheets)
5. [ตารางเปรียบเทียบ](#ตารางเปรียบเทียบ-3-ประเภทออเดอร์)
6. [แผนการพัฒนาระบบออเดอร์พิเศษ](#แผนการพัฒนาระบบออเดอร์พิเศษ)

---

## ภาพรวมทั้ง 3 ประเภทออเดอร์

### Order Types ในระบบ

```sql
CREATE TYPE order_type_enum AS ENUM (
  'route_planning',  -- จัดเส้นทาง (ต้องจัดสาย VRP)
  'express',         -- ส่งด่วน/ส่งรายชิ้น (ใช้ Face Sheet)
  'special'          -- สินค้าพิเศษ/ของแถม (ใช้ Bonus Face Sheet)
);
```

### ความแตกต่างหลัก

| ประเภท | การจัดเส้นทาง | เอกสารหยิบ | การจองสต็อก | UI Location |
|--------|--------------|-----------|------------|-------------|
| **Route Planning** | ✅ ใช้ VRP Algorithm | Picklist | ✅ อัตโนมัติ | `/receiving/routes` |
| **Express** | ❌ ไม่ต้องจัด | Face Sheet | ✅ อัตโนมัติ | `/receiving/picklists/face-sheets` |
| **Special** | ❌ ไม่ต้องจัด | Bonus Face Sheet | ❌ ยังไม่มี | `/receiving/picklists/bonus-face-sheets` |

---

## 1. ออเดอร์จัดเส้นทาง (Route Planning Orders)

### 🎯 ลักษณะ
- ออเดอร์ปกติที่ต้องจัดเส้นทางด้วย VRP (Vehicle Routing Problem)
- มีการรวมออเดอร์หลายๆ อันในเส้นทางเดียวกัน
- ต้องคำนึงถึงระยะทาง เวลา capacity รถ

### 📊 Database Schema

#### Tables
```sql
-- Main tables
wms_orders                          -- ออเดอร์หลัก
receiving_route_plans               -- แผนเส้นทาง
receiving_route_trips               -- Trip แต่ละเส้นทาง
receiving_route_stops               -- จุดหยุดในแต่ละ Trip
picklists                           -- ใบหยิบสินค้า
picklist_items                      -- รายการสินค้าในใบหยิบ
picklist_item_reservations          -- การจองสต็อก ⭐

-- Junction tables
receiving_route_plan_inputs         -- ออเดอร์ที่เข้าแผน
wms_loadlist_picklists              -- Picklist ที่โหลดแล้ว
```

### 🔄 Workflow ครบวงจร

#### Step 1: สร้างแผนเส้นทาง
```
User Actions:
1. เลือกออเดอร์ที่ต้องการจัดเส้นทาง (status = 'draft')
2. POST /api/route-plans
3. สร้าง receiving_route_plans (status = 'draft')
4. บันทึกออเดอร์ลง receiving_route_plan_inputs

Database Changes:
- INSERT receiving_route_plans
- INSERT receiving_route_plan_inputs
```

#### Step 2: จัดเส้นทางด้วย VRP
```
User Actions:
1. เปิดหน้า /receiving/routes/[id]
2. กำหนด parameters (จำนวนรถ, capacity, เวลา)
3. POST /api/route-plans/[id]/optimize

VRP Algorithm:
- Insertion Heuristic (แนะนำ)
- Clarke-Wright Savings
- Nearest Neighbor
- Local Search (2-opt, Or-opt)

Output:
- สร้าง Trips (receiving_route_trips)
- สร้าง Stops (receiving_route_stops)
- คำนวณระยะทาง เวลา sequence

Database Changes:
- INSERT receiving_route_trips
- INSERT receiving_route_stops
- UPDATE receiving_route_plans (status = 'optimizing')
```

#### Step 3: อนุมัติแผน
```
User Actions:
1. Review แผนที่สร้างขึ้น
2. PATCH /api/route-plans/[id]
   { status: 'published' }

Database Changes:
- UPDATE receiving_route_plans (status = 'published')
- Trigger: wms_orders status: draft → confirmed
```

#### Step 4: สร้างใบหยิบ (Picklist)
```
API: POST /api/picklists/create-from-trip
Input: { trip_id, loading_door_number }

Process:
1. ดึงออเดอร์ทั้งหมดใน Trip
2. Map SKU → Preparation Area → Zone → Locations
3. ตรวจสอบสต็อคว่าพอหรือไม่
4. สร้าง Picklist + Picklist Items
5. ✅ จองสต็อคอัตโนมัติ (FEFO + FIFO)

Stock Reservation Logic:
FOR EACH picklist_item:
  1. Query balances จาก preparation area (จำกัด source_location_id)
     ORDER BY expiry_date ASC (FEFO)
              production_date ASC (FIFO)
              created_at ASC

  2. จองสต็อคทีละ balance
     - UPDATE wms_inventory_balances
       SET reserved_piece_qty = reserved_piece_qty + qty

     - INSERT picklist_item_reservations
       (picklist_item_id, balance_id, reserved_piece_qty, status='reserved')

Database Changes:
- INSERT picklists (status = 'pending')
- INSERT picklist_items
- INSERT picklist_item_reservations ⭐
- UPDATE wms_inventory_balances (reserved_piece_qty ↑)
- INSERT stock_replenishment_alerts (ถ้าสต็อคไม่พอ)
```

#### Step 5: มอบหมายใบหยิบ
```
API: PATCH /api/picklists/[id]
Input: { status: 'assigned', assigned_to_employee_id }

Process:
1. ตรวจสอบว่ามี reservations แล้วหรือไม่
2. ถ้ายังไม่มี → จองสต็อคเพิ่ม (backward compatibility)

Database Changes:
- UPDATE picklists (status = 'assigned')
- Trigger: wms_orders status: confirmed → in_picking
```

#### Step 6: หยิบสินค้า (Mobile Pick) ⭐
```
Mobile UI: /mobile/pick/[id]
API: POST /api/mobile/pick/scan

Input:
{
  picklist_id: 123,
  item_id: 456,
  quantity_picked: 10,
  scanned_code: "PL-20251201-001",
  checker_ids: [1, 2],
  picker_ids: [3, 4]
}

Process:
1. ตรวจสอบ QR Code
2. ดึง reservations ที่จองไว้ (status = 'reserved')
3. FOR EACH reservation:
   - ดึง balance_id ที่จองไว้ (ไม่ query FEFO/FIFO ใหม่)
   - ลด reserved_piece_qty
   - ลด total_piece_qty จาก source_location
   - บันทึก Ledger: OUT from Preparation Area

4. เพิ่มสต็อคที่ Dispatch (match วันที่)
   - หา balance ที่ Dispatch (match production_date, expiry_date, lot_no)
   - ถ้ามี → อัปเดตยอด
   - ถ้าไม่มี → สร้างใหม่ (copy วันที่จาก source)
   - บันทึก Ledger: IN to Dispatch

5. อัปเดตสถานะ
   - UPDATE picklist_items (status = 'picked', quantity_picked)
   - UPDATE picklist_item_reservations (status = 'picked')
   - ถ้าหยิบครบทั้งหมด:
     - UPDATE picklists (status = 'completed', picker_employee_ids, checker_employee_ids)

Database Changes:
- UPDATE wms_inventory_balances (source_location)
  - reserved_piece_qty ↓
  - total_piece_qty ↓
- UPSERT wms_inventory_balances (Dispatch)
  - total_piece_qty ↑
- INSERT wms_inventory_ledger (OUT + IN)
- UPDATE picklist_items (status = 'picked')
- UPDATE picklist_item_reservations (status = 'picked')
- UPDATE picklists (status → 'completed')
- Trigger: wms_orders status: in_picking → picked
- Trigger: receiving_route_plans status: published → ready_to_load
```

#### Step 7: สร้างใบโหลด (Loadlist)
```
API: POST /api/loadlists
Input: {
  picklist_ids: [1, 2, 3],
  vehicle_type: 'truck',
  checker_employee_id: 1
}

Process:
1. ตรวจสอบว่า picklists status = 'completed'
2. สร้าง loadlist
3. Link picklists

Database Changes:
- INSERT loadlists (status = 'pending')
- INSERT wms_loadlist_picklists
```

#### Step 8: โหลดสินค้า (Mobile Loading)
```
Mobile UI: /mobile/loading
API: POST /api/mobile/loading/complete

Input:
{
  loadlist_id: 1,
  scanned_code: "LD-20251201-0001"
}

Process:
1. ตรวจสอบ QR Code
2. ดึง picklists + items ทั้งหมด
3. FOR EACH item:
   - ตรวจสอบสต็อคที่ Dispatch
   - ถ้าสต็อคพอ:
     - ลดสต็อคจาก Dispatch
     - เพิ่มสต็อคที่ Delivery-In-Progress (copy วันที่)
     - บันทึก Ledger: OUT + IN
   - ถ้าสต็อคไม่พอ:
     - สร้าง alert
     - ข้ามรายการนี้

4. อัปเดตสถานะ loadlist

Database Changes:
- UPDATE wms_inventory_balances (Dispatch)
  - total_piece_qty ↓
- UPSERT wms_inventory_balances (Delivery-In-Progress)
  - total_piece_qty ↑
- INSERT wms_inventory_ledger (OUT + IN)
- INSERT stock_replenishment_alerts (ถ้าสต็อคไม่พอ)
- UPDATE loadlists (status = 'loaded')
- Trigger: wms_orders status: picked → loaded
- Trigger: receiving_route_plans status: ready_to_load → in_transit
```

#### Step 9: จัดส่งสำเร็จ
```
(อัปเดตจากระบบอื่นหรือ manual)
UPDATE wms_orders SET status = 'delivered'

Database Changes:
- UPDATE wms_orders (status = 'delivered')
- Trigger: ถ้าทุก Order ใน Route delivered
  → receiving_route_plans status: in_transit → completed
```

### 🔑 Key Points

#### การจองสต็อก (Stock Reservation)
- ✅ จองตอนสร้าง Picklist (อัตโนมัติ)
- ✅ จำกัดเฉพาะ `source_location_id` (preparation area)
- ✅ ใช้ FEFO (First Expiry First Out) + FIFO
- ✅ เก็บ `balance_id` ใน `picklist_item_reservations`
- ✅ อัปเดต `reserved_piece_qty` ใน `wms_inventory_balances`

#### การย้ายสต็อก (Stock Movement)
```
Flow: Preparation Area → Dispatch → Delivery-In-Progress

1. Pick (Step 6):
   Source: Preparation Area (use balance_id from reservation)
   Target: Dispatch (match วันที่)
   Ledger: OUT + IN

2. Load (Step 8):
   Source: Dispatch
   Target: Delivery-In-Progress (match วันที่)
   Ledger: OUT + IN
```

#### การ Match Balance
- Match ด้วย: `sku_id`, `production_date`, `expiry_date`, `lot_no`
- ไม่ผสมสินค้าคนละ lot/วันผลิต/วันหมดอายุ
- Copy วันที่ไปตลอด flow

#### Preparation Area Mapping
```
master_sku.default_location (e.g., 'PK001')
  ↓
preparation_area.area_code = 'PK001'
preparation_area.zone = 'Picking Zone A'
  ↓
master_location.zone = 'Picking Zone A'
  ↓
Query สต็อคจากทุก location ใน zone
```

---

## 2. ออเดอร์ส่งรายชิ้น (Express Orders / Face Sheets)

### 🎯 ลักษณะ
- ออเดอร์ส่งด่วน ส่งทีละรายการ
- ไม่ต้องจัดเส้นทาง (skip VRP)
- ใช้ Face Sheet แทน Picklist
- Logic เหมือน Route Planning แต่ไม่มีขั้นตอนจัดเส้นทาง

### 📊 Database Schema

#### Tables
```sql
-- Main tables
wms_orders                    -- ออเดอร์หลัก (order_type = 'express')
face_sheets                   -- ใบปะหน้า Express
face_sheet_packages           -- แพ็คสินค้าแต่ละแพ็ค
face_sheet_items              -- รายการสินค้า ⭐ (enhanced)
face_sheet_item_reservations  -- การจองสต็อก ⭐

-- Junction tables
loadlist_face_sheets          -- Face Sheet ที่โหลดแล้ว
```

#### Enhanced Columns

**face_sheets:**
```sql
checker_employee_ids          BIGINT[]     -- พนักงานเช็ค
picker_employee_ids           BIGINT[]     -- พนักงานจัดสินค้า
picking_started_at            TIMESTAMP
picking_completed_at          TIMESTAMP
```

**face_sheet_items:**
```sql
sku_id                        VARCHAR      -- รหัสสินค้า
source_location_id            VARCHAR      -- preparation area
quantity_to_pick              NUMERIC      -- จำนวนที่ต้องหยิบ
quantity_picked               NUMERIC      -- จำนวนที่หยิบแล้ว
status                        VARCHAR      -- pending, picking, picked
picked_at                     TIMESTAMP
uom                           VARCHAR      -- หน่วยนับ
```

### 🔄 Workflow ครบวงจร

#### Step 1: สร้าง Face Sheet
```
UI: /receiving/picklists/face-sheets
API: POST /api/face-sheets/generate

Input:
{
  warehouse_id: 'WH001',
  created_by: 'User123',
  delivery_date: '2025-12-03',
  order_ids: [3820, 3821]  // optional: เลือกเฉพาะออเดอร์
}

Validation:
1. ตรวจสอบ customer มี Hub หรือไม่
2. RPC: validate_express_orders_for_face_sheet()

Process:
1. Query ออเดอร์ express (delivery_date)
2. RPC: create_face_sheet_packages()
   - สร้าง face_sheets
   - สร้าง face_sheet_packages (1 package per order)
   - สร้าง face_sheet_items (รายการสินค้า)
3. Trigger: trigger_reserve_stock_after_face_sheet_created ⭐
   - เรียก reserve_stock_for_face_sheet_items()
4. อัปเดต order status: draft → confirmed

Database Changes:
- INSERT face_sheets (status = 'generated')
- INSERT face_sheet_packages
- INSERT face_sheet_items (with sku_id, source_location_id)
- Trigger: จองสต็อคอัตโนมัติ
  - INSERT face_sheet_item_reservations
  - UPDATE wms_inventory_balances (reserved_piece_qty ↑)
- UPDATE wms_orders (status = 'confirmed')
```

#### Step 2: จองสต็อกอัตโนมัติ (Trigger)
```
Trigger: ON INSERT face_sheets (status = 'generated')
Function: reserve_stock_for_face_sheet_items()

Process:
1. ดึง face_sheet_items
2. FOR EACH item:
   - Map preparation area → zone → locations
   - Query balances (FEFO + FIFO, limited by source_location_id)
   - จองสต็อค:
     - UPDATE wms_inventory_balances (reserved_piece_qty ↑)
     - INSERT face_sheet_item_reservations (store balance_id)

Logic เหมือน Picklist 100%
```

#### Step 3: หยิบสินค้า (Mobile Pick)
```
Mobile UI: /mobile/face-sheet/[id]
API: POST /api/mobile/face-sheet/scan

Input:
{
  face_sheet_id: 54,
  item_id: 456,
  quantity_picked: 12,
  scanned_code: "FS-20251202-001",
  checker_ids: [1],
  picker_ids: [2]
}

Process เหมือน Picklist:
1. ตรวจสอบ QR Code
2. ดึง reservations (use balance_id)
3. ลดสต็อคจาก Preparation Area
4. เพิ่มสต็อคที่ Dispatch (copy วันที่)
5. บันทึก Ledger (OUT + IN)
6. อัปเดตสถานะ

Database Changes:
- UPDATE wms_inventory_balances (source_location)
  - reserved_piece_qty ↓
  - total_piece_qty ↓
- UPSERT wms_inventory_balances (Dispatch)
  - total_piece_qty ↑
- INSERT wms_inventory_ledger (OUT + IN)
- UPDATE face_sheet_items (status = 'picked')
- UPDATE face_sheet_item_reservations (status = 'picked')
- UPDATE face_sheets (status → 'completed', employee IDs)
```

#### Step 4-6: โหลดและจัดส่ง (เหมือน Route Planning)
```
เหมือนกันทุกอย่าง:
- สร้าง Loadlist
- โหลดสินค้า (Dispatch → Delivery-In-Progress)
- อัปเดต status: picked → loaded → delivered
```

### 🔑 Key Points

#### ข้อแตกต่างจาก Route Planning
1. ❌ ไม่มีขั้นตอนจัดเส้นทาง (skip VRP)
2. ✅ ใช้ Face Sheet แทน Picklist
3. ✅ จองสต็อคผ่าน Trigger (แทนใน API)
4. ✅ UI แยกหน้า `/receiving/picklists/face-sheets`

#### ข้อเหมือนกับ Route Planning
1. ✅ การจองสต็อก (FEFO + FIFO, limited by location)
2. ✅ การย้ายสต็อก (Prep Area → Dispatch → Delivery)
3. ✅ การ Match Balance (match วันที่)
4. ✅ Mobile Pick UI pattern
5. ✅ Ledger recording (OUT + IN)

---

## 3. ออเดอร์พิเศษ (Special Orders / Bonus Face Sheets)

### 🎯 ลักษณะ
- สินค้าของแถมที่ส่งให้ลูกค้า
- ไม่ผูกกับระบบสต็อกปกติ (ไม่มี SKU ใน master_sku)
- อัปโหลดจากไฟล์ Excel
- **ยังไม่มีระบบจองและย้ายสต็อก** ⚠️

### 📊 Database Schema (Current)

#### Tables
```sql
-- Main tables
wms_orders                    -- ออเดอร์หลัก (order_type = 'special')
bonus_face_sheets             -- ใบปะหน้าของแถม
bonus_face_sheet_packages     -- แพ็คสินค้าของแถม
bonus_face_sheet_items        -- รายการสินค้าของแถม
```

#### Table Structure

**bonus_face_sheets:**
```sql
id                      BIGSERIAL PRIMARY KEY
face_sheet_no           VARCHAR(50)              -- เช่น BFS-20251202-001
warehouse_id            VARCHAR(20)
status                  VARCHAR(20)              -- draft, generated, picking, completed, cancelled
delivery_date           DATE
created_date            DATE
created_by              VARCHAR(100)
total_packages          INTEGER
total_items             INTEGER
total_orders            INTEGER
notes                   TEXT
created_at              TIMESTAMP
updated_at              TIMESTAMP

-- ⚠️ ยังไม่มี columns เหล่านี้:
-- checker_employee_ids   BIGINT[]
-- picker_employee_ids    BIGINT[]
-- picking_started_at     TIMESTAMP
-- picking_completed_at   TIMESTAMP
```

**bonus_face_sheet_packages:**
```sql
id                      BIGSERIAL PRIMARY KEY
face_sheet_id           BIGINT                   -- FK to bonus_face_sheets
package_number          INTEGER
barcode_id              VARCHAR(100)
order_id                BIGINT                   -- FK to wms_orders (nullable)
order_no                VARCHAR(100)
customer_id             VARCHAR(50)
shop_name               VARCHAR(255)
address                 TEXT
province                VARCHAR(100)
contact_info            VARCHAR(200)
phone                   VARCHAR(50)
hub                     VARCHAR(100)
delivery_type           VARCHAR(50)
remark                  TEXT
sales_territory         VARCHAR(100)
trip_number             VARCHAR(50)
total_items             INTEGER
created_at              TIMESTAMP
```

**bonus_face_sheet_items:**
```sql
id                      BIGSERIAL PRIMARY KEY
face_sheet_id           BIGINT                   -- FK to bonus_face_sheets
package_id              BIGINT                   -- FK to bonus_face_sheet_packages
order_item_id           BIGINT                   -- FK to wms_order_items (nullable)
product_code            VARCHAR(100)
product_name            TEXT
quantity                NUMERIC(15,3)
unit                    VARCHAR(20)
weight                  NUMERIC(15,3)
created_at              TIMESTAMP

-- ⚠️ ยังไม่มี columns เหล่านี้:
-- sku_id                VARCHAR
-- source_location_id    VARCHAR
-- quantity_to_pick      NUMERIC
-- quantity_picked       NUMERIC
-- status                VARCHAR
-- picked_at             TIMESTAMP
-- uom                   VARCHAR
```

**⚠️ ยังไม่มีตาราง:**
```sql
bonus_face_sheet_item_reservations  -- ไม่มี!
```

### 🔄 Workflow ปัจจุบัน (ไม่สมบูรณ์)

#### Step 1: อัปโหลด Excel
```
UI: /receiving/picklists/bonus-face-sheets
API: POST /api/bonus-face-sheets/upload

Input:
{
  excelData: [
    {
      เลขที่ใบสั่งส่ง: 'IV25120001',
      แพ็คที่: '1',
      รหัสสินค้า: 'GIFT-001',
      ชื่อสินค้า: 'ของแถม A',
      จำนวน: 10,
      ชื่อร้านค้า: 'ร้านค้า A',
      รหัสลูกค้า: 'C001',
      ที่อยู่: '123 ถนน...',
      ประเภทจัดส่ง: 'express',
      หมายเหตุ: '-'
    },
    // ...
  ]
}

Process:
1. จัดกลุ่มข้อมูลตาม Order_No + Pack_No
2. Return packages array

Output:
{
  success: true,
  packages: [...],
  total_packages: 10,
  total_items: 25
}

⚠️ ไม่มีการตรวจสอบสต็อก
⚠️ ไม่มีการ validate กับ master_sku
```

#### Step 2: สร้าง Bonus Face Sheet
```
API: POST /api/bonus-face-sheets

Input:
{
  warehouse_id: 'WH001',
  created_by: 'User123',
  delivery_date: '2025-12-03',
  packages: [...]  // from upload
}

Process:
1. Generate face_sheet_no (RPC)
2. สร้าง bonus_face_sheets
3. FOR EACH package:
   - สร้าง bonus_face_sheet_packages
   - สร้าง bonus_face_sheet_items

Database Changes:
- INSERT bonus_face_sheets (status = 'generated')
- INSERT bonus_face_sheet_packages
- INSERT bonus_face_sheet_items

⚠️ ไม่มีการจองสต็อก
⚠️ ไม่มี trigger
⚠️ ไม่อัปเดต wms_orders status
```

#### Step 3-6: ⚠️ ยังไม่มี!
```
❌ ไม่มี Mobile Pick
❌ ไม่มีการจองสต็อก
❌ ไม่มีการย้ายสต็อค
❌ ไม่มี Loadlist integration
❌ ไม่มี Ledger recording
```

### 🎯 สิ่งที่มีอยู่แล้ว (ใช้ได้)

#### ✅ หน้า UI
- `/receiving/picklists/bonus-face-sheets` - หน้าหลัก
- อัปโหลด Excel ✅
- แสดงรายการ Bonus Face Sheets ✅
- ฟิลเตอร์ตาม status, date ✅

#### ✅ API Endpoints
- `GET /api/bonus-face-sheets` - ดึงรายการ
- `POST /api/bonus-face-sheets/upload` - อัปโหลด Excel
- `POST /api/bonus-face-sheets` - สร้าง Face Sheet
- `GET /api/bonus-face-sheets/[id]` - ดูรายละเอียด
- `GET /api/bonus-face-sheets/orders` - ดึงออเดอร์ special

#### ✅ Database Function
- `generate_bonus_face_sheet_no()` - สร้างเลขที่ใบปะหน้า

### ⚠️ สิ่งที่ยังไม่มี (ต้องพัฒนา)

#### ❌ Database Schema
1. **bonus_face_sheet_items** ขาด columns:
   - `sku_id` - รหัสสินค้า
   - `source_location_id` - preparation area
   - `quantity_to_pick` - จำนวนที่ต้องหยิบ
   - `quantity_picked` - จำนวนที่หยิบแล้ว
   - `status` - สถานะการหยิบ
   - `picked_at` - เวลาที่หยิบ
   - `uom` - หน่วยนับ

2. **bonus_face_sheets** ขาด columns:
   - `checker_employee_ids` - พนักงานเช็ค
   - `picker_employee_ids` - พนักงานจัดสินค้า
   - `picking_started_at` - เวลาเริ่มหยิบ
   - `picking_completed_at` - เวลาหยิบเสร็จ

3. **ตารางใหม่:**
   - `bonus_face_sheet_item_reservations` - จองสต็อก

#### ❌ Database Functions
1. `reserve_stock_for_bonus_face_sheet_items()` - จองสต็อก
2. `trigger_reserve_stock_after_bonus_face_sheet_created()` - trigger function

#### ❌ API Endpoints
1. `POST /api/mobile/bonus-face-sheet/scan` - หยิบสินค้า
2. `GET /api/mobile/bonus-face-sheet/tasks/[id]` - ดึงรายละเอียด

#### ❌ Frontend Pages
1. `/mobile/bonus-face-sheet/[id]` - Mobile Pick UI

#### ❌ Workflow Integration
1. การจองสต็อกอัตโนมัติ
2. การย้ายสต็อค (Prep Area → Dispatch)
3. Integration กับ Loadlist
4. การโหลด (Dispatch → Delivery-In-Progress)
5. Ledger recording

---

## ตารางเปรียบเทียบ 3 ประเภทออเดอร์

### 📊 ภาพรวม

| Feature | Route Planning | Express | Special |
|---------|----------------|---------|---------|
| **Order Type** | `route_planning` | `express` | `special` |
| **เอกสารหยิบ** | Picklist | Face Sheet | Bonus Face Sheet |
| **การจัดเส้นทาง** | ✅ VRP Algorithm | ❌ ไม่ต้อง | ❌ ไม่ต้อง |
| **การจองสต็อก** | ✅ อัตโนมัติ | ✅ อัตโนมัติ | ❌ ยังไม่มี |
| **Mobile Pick** | ✅ มี | ✅ มี | ❌ ยังไม่มี |
| **Stock Movement** | ✅ ครบถ้วน | ✅ ครบถ้วน | ❌ ยังไม่มี |
| **Ledger Recording** | ✅ มี | ✅ มี | ❌ ยังไม่มี |
| **UI Location** | `/receiving/routes` | `/receiving/picklists/face-sheets` | `/receiving/picklists/bonus-face-sheets` |
| **สถานะ** | ✅ ใช้งานได้ | ✅ ใช้งานได้ | ⚠️ ไม่สมบูรณ์ |

### 📋 Database Tables

| Component | Route Planning | Express | Special |
|-----------|----------------|---------|---------|
| **Main Table** | `picklists` | `face_sheets` | `bonus_face_sheets` |
| **Items Table** | `picklist_items` | `face_sheet_items` | `bonus_face_sheet_items` |
| **Packages Table** | - | `face_sheet_packages` | `bonus_face_sheet_packages` |
| **Reservations Table** | `picklist_item_reservations` | `face_sheet_item_reservations` | ❌ ยังไม่มี |
| **Order Link** | `receiving_route_plan_inputs` | `face_sheet_packages.order_id` | `bonus_face_sheet_packages.order_id` |
| **Loadlist Link** | `wms_loadlist_picklists` | `loadlist_face_sheets` | ❌ ยังไม่มี |

### 🔄 Workflow Comparison

| Step | Route Planning | Express | Special (Current) | Special (Target) |
|------|----------------|---------|-------------------|------------------|
| **1. Create Document** | Create Route Plan | Upload/Create | Upload Excel | ✅ เหมือน Express |
| **2. VRP Optimization** | ✅ Required | ❌ Skip | ❌ Skip | ❌ Skip |
| **3. Approve Plan** | ✅ Publish | ❌ Skip | ❌ Skip | ❌ Skip |
| **4. Create Pick Doc** | Create Picklist | Create Face Sheet | Create Bonus FS | ✅ เหมือน Express |
| **5. Reserve Stock** | ✅ Auto (API) | ✅ Auto (Trigger) | ❌ ไม่มี | ✅ Auto (Trigger) |
| **6. Mobile Pick** | ✅ /mobile/pick/[id] | ✅ /mobile/face-sheet/[id] | ❌ ไม่มี | ✅ /mobile/bonus-face-sheet/[id] |
| **7. Stock Movement** | ✅ Prep→Dispatch | ✅ Prep→Dispatch | ❌ ไม่มี | ✅ Prep→Dispatch |
| **8. Create Loadlist** | ✅ มี | ✅ มี | ❌ ไม่มี | ✅ มี |
| **9. Mobile Load** | ✅ Dispatch→Delivery | ✅ Dispatch→Delivery | ❌ ไม่มี | ✅ Dispatch→Delivery |
| **10. Ledger** | ✅ OUT + IN | ✅ OUT + IN | ❌ ไม่มี | ✅ OUT + IN |

### 🔑 Stock Reservation Logic

| Aspect | Route Planning | Express | Special (Target) |
|--------|----------------|---------|------------------|
| **Trigger Point** | API (create-from-trip) | Trigger (after INSERT) | Trigger (after INSERT) |
| **FEFO/FIFO** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Location Limited** | ✅ source_location_id | ✅ source_location_id | ✅ source_location_id |
| **Store balance_id** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Prep Area Mapping** | ✅ Yes | ✅ Yes | ✅ Yes |

### 🎯 Mobile Pick API

| Feature | Route Planning | Express | Special (Target) |
|---------|----------------|---------|------------------|
| **API Path** | `/api/mobile/pick/scan` | `/api/mobile/face-sheet/scan` | `/api/mobile/bonus-face-sheet/scan` |
| **Input** | picklist_id, item_id | face_sheet_id, item_id | bonus_face_sheet_id, item_id |
| **QR Validation** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Use Reservation** | ✅ balance_id | ✅ balance_id | ✅ balance_id |
| **Stock Movement** | Prep→Dispatch | Prep→Dispatch | Prep→Dispatch |
| **Copy Dates** | ✅ production/expiry/lot | ✅ production/expiry/lot | ✅ production/expiry/lot |
| **Ledger** | OUT + IN | OUT + IN | OUT + IN |
| **Employee Tracking** | ✅ checker/picker | ✅ checker/picker | ✅ checker/picker |

---

## แผนการพัฒนาระบบออเดอร์พิเศษ

### 🎯 เป้าหมาย
พัฒนาระบบ Bonus Face Sheets ให้มีความสามารถเทียบเท่า Face Sheets (Express Orders) ทุกประการ

### ✅ สิ่งที่ใช้ได้แล้ว
1. ✅ หน้า UI สำหรับอัปโหลดและจัดการ
2. ✅ API อัปโหลด Excel
3. ✅ API สร้าง Bonus Face Sheet
4. ✅ Tables: bonus_face_sheets, bonus_face_sheet_packages, bonus_face_sheet_items

### 🔨 สิ่งที่ต้องพัฒนา (แบ่งเป็น Phase)

---

### 📍 Phase 1: Database Schema Enhancement

#### Migration 1: Enhance bonus_face_sheet_items
```sql
-- File: supabase/migrations/100_enhance_bonus_face_sheet_items.sql

ALTER TABLE bonus_face_sheet_items
  ADD COLUMN sku_id VARCHAR(100),
  ADD COLUMN source_location_id VARCHAR(50),
  ADD COLUMN quantity_to_pick NUMERIC(15,3),
  ADD COLUMN quantity_picked NUMERIC(15,3) DEFAULT 0,
  ADD COLUMN status VARCHAR(20) DEFAULT 'pending',
  ADD COLUMN picked_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN uom VARCHAR(20) DEFAULT 'ชิ้น';

-- Add check constraint
ALTER TABLE bonus_face_sheet_items
  ADD CONSTRAINT bonus_face_sheet_items_status_check
  CHECK (status IN ('pending', 'picking', 'picked', 'shortage', 'substituted'));

-- Add indexes
CREATE INDEX idx_bonus_face_sheet_items_status
  ON bonus_face_sheet_items(status);
CREATE INDEX idx_bonus_face_sheet_items_sku
  ON bonus_face_sheet_items(sku_id);

-- Add foreign key (ถ้ามี master_sku)
-- ALTER TABLE bonus_face_sheet_items
--   ADD CONSTRAINT fk_bonus_face_sheet_items_sku
--   FOREIGN KEY (sku_id) REFERENCES master_sku(sku_id);

COMMENT ON COLUMN bonus_face_sheet_items.sku_id IS 'รหัสสินค้า (FK to master_sku)';
COMMENT ON COLUMN bonus_face_sheet_items.source_location_id IS 'พื้นที่เตรียมสินค้า (preparation area)';
COMMENT ON COLUMN bonus_face_sheet_items.quantity_to_pick IS 'จำนวนที่ต้องหยิบ';
COMMENT ON COLUMN bonus_face_sheet_items.quantity_picked IS 'จำนวนที่หยิบแล้ว';
COMMENT ON COLUMN bonus_face_sheet_items.status IS 'สถานะ: pending, picking, picked, shortage, substituted';
COMMENT ON COLUMN bonus_face_sheet_items.picked_at IS 'วันเวลาที่หยิบเสร็จ';
```

#### Migration 2: Enhance bonus_face_sheets
```sql
-- File: supabase/migrations/101_enhance_bonus_face_sheets.sql

ALTER TABLE bonus_face_sheets
  ADD COLUMN checker_employee_ids BIGINT[],
  ADD COLUMN picker_employee_ids BIGINT[],
  ADD COLUMN picking_started_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN picking_completed_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN bonus_face_sheets.checker_employee_ids IS 'รายการ employee_id ของพนักงานเช็ค (array)';
COMMENT ON COLUMN bonus_face_sheets.picker_employee_ids IS 'รายการ employee_id ของพนักงานจัดสินค้า (array)';
COMMENT ON COLUMN bonus_face_sheets.picking_started_at IS 'วันเวลาที่เริ่มหยิบ';
COMMENT ON COLUMN bonus_face_sheets.picking_completed_at IS 'วันเวลาที่หยิบเสร็จ';
```

#### Migration 3: Create Reservation Table
```sql
-- File: supabase/migrations/102_create_bonus_face_sheet_reservations.sql

CREATE TABLE IF NOT EXISTS bonus_face_sheet_item_reservations (
  reservation_id BIGSERIAL PRIMARY KEY,
  bonus_face_sheet_item_id BIGINT NOT NULL,
  balance_id BIGINT NOT NULL,
  reserved_piece_qty NUMERIC(15,3) NOT NULL DEFAULT 0,
  reserved_pack_qty NUMERIC(15,3) NOT NULL DEFAULT 0,
  reserved_by VARCHAR(100),
  reserved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) DEFAULT 'reserved',
  picked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_bonus_face_sheet_item
    FOREIGN KEY (bonus_face_sheet_item_id)
    REFERENCES bonus_face_sheet_items(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_inventory_balance
    FOREIGN KEY (balance_id)
    REFERENCES wms_inventory_balances(balance_id)
    ON DELETE RESTRICT,

  CONSTRAINT bonus_face_sheet_reservations_status_check
    CHECK (status IN ('reserved', 'picked', 'cancelled'))
);

-- Indexes
CREATE INDEX idx_bonus_fs_reservations_item
  ON bonus_face_sheet_item_reservations(bonus_face_sheet_item_id);
CREATE INDEX idx_bonus_fs_reservations_balance
  ON bonus_face_sheet_item_reservations(balance_id);
CREATE INDEX idx_bonus_fs_reservations_status
  ON bonus_face_sheet_item_reservations(status);

-- Comments
COMMENT ON TABLE bonus_face_sheet_item_reservations IS 'การจองสต็อคสำหรับรายการสินค้าในใบปะหน้าของแถม';
COMMENT ON COLUMN bonus_face_sheet_item_reservations.balance_id IS 'รหัส Balance ที่จองไว้ (ใช้ตอนหยิบ)';
COMMENT ON COLUMN bonus_face_sheet_item_reservations.status IS 'สถานะ: reserved (จองแล้ว), picked (หยิบแล้ว), cancelled (ยกเลิก)';
```

---

### 📍 Phase 2: Database Functions & Triggers

#### Function 1: Reserve Stock
```sql
-- File: supabase/migrations/103_add_bonus_fs_stock_reservation.sql

CREATE OR REPLACE FUNCTION reserve_stock_for_bonus_face_sheet_items(
  p_bonus_face_sheet_id BIGINT,
  p_warehouse_id VARCHAR DEFAULT 'WH001',
  p_reserved_by VARCHAR DEFAULT 'System'
)
RETURNS TABLE (
  success BOOLEAN,
  items_reserved INTEGER,
  message TEXT
) LANGUAGE plpgsql AS $$
DECLARE
  v_item RECORD;
  v_prep_area RECORD;
  v_location RECORD;
  v_balance RECORD;
  v_items_count INTEGER := 0;
  v_items_reserved INTEGER := 0;
  v_location_ids TEXT[];
  v_remaining_qty NUMERIC;
  v_qty_to_reserve NUMERIC;
  v_pack_to_reserve NUMERIC;
  v_qty_per_pack NUMERIC;
BEGIN
  -- ดึงรายการสินค้าทั้งหมด
  FOR v_item IN
    SELECT
      bfsi.id,
      bfsi.sku_id,
      bfsi.source_location_id,
      bfsi.quantity_to_pick,
      ms.qty_per_pack
    FROM bonus_face_sheet_items bfsi
    LEFT JOIN master_sku ms ON bfsi.sku_id = ms.sku_id
    WHERE bfsi.face_sheet_id = p_bonus_face_sheet_id
      AND bfsi.quantity_to_pick > 0
      AND bfsi.sku_id IS NOT NULL
    ORDER BY bfsi.id
  LOOP
    v_items_count := v_items_count + 1;
    v_qty_per_pack := COALESCE(v_item.qty_per_pack, 1);

    -- Map preparation area → zone → locations
    SELECT zone INTO v_prep_area
    FROM preparation_area
    WHERE area_code = v_item.source_location_id;

    IF v_prep_area.zone IS NULL THEN
      RAISE WARNING 'Preparation area not found for: %', v_item.source_location_id;
      CONTINUE;
    END IF;

    -- ดึง location_ids ทั้งหมดใน zone
    SELECT ARRAY_AGG(location_id) INTO v_location_ids
    FROM master_location
    WHERE zone = v_prep_area.zone
      AND warehouse_id = p_warehouse_id;

    IF v_location_ids IS NULL OR ARRAY_LENGTH(v_location_ids, 1) = 0 THEN
      RAISE WARNING 'No locations found in zone: %', v_prep_area.zone;
      CONTINUE;
    END IF;

    -- จองสต็อค (FEFO + FIFO)
    v_remaining_qty := v_item.quantity_to_pick;

    FOR v_balance IN
      SELECT
        balance_id,
        location_id,
        total_piece_qty,
        reserved_piece_qty,
        total_pack_qty,
        reserved_pack_qty,
        production_date,
        expiry_date,
        lot_no
      FROM wms_inventory_balances
      WHERE warehouse_id = p_warehouse_id
        AND location_id = ANY(v_location_ids)
        AND sku_id = v_item.sku_id
        AND (total_piece_qty - reserved_piece_qty) > 0
      ORDER BY
        expiry_date ASC NULLS LAST,
        production_date ASC NULLS LAST,
        created_at ASC
    LOOP
      EXIT WHEN v_remaining_qty <= 0;

      v_qty_to_reserve := LEAST(
        v_balance.total_piece_qty - v_balance.reserved_piece_qty,
        v_remaining_qty
      );

      v_pack_to_reserve := v_qty_to_reserve / v_qty_per_pack;

      -- อัปเดต reserved_piece_qty
      UPDATE wms_inventory_balances
      SET
        reserved_piece_qty = reserved_piece_qty + v_qty_to_reserve,
        reserved_pack_qty = reserved_pack_qty + v_pack_to_reserve,
        updated_at = CURRENT_TIMESTAMP
      WHERE balance_id = v_balance.balance_id;

      -- บันทึกการจอง
      INSERT INTO bonus_face_sheet_item_reservations (
        bonus_face_sheet_item_id,
        balance_id,
        reserved_piece_qty,
        reserved_pack_qty,
        reserved_by,
        status
      ) VALUES (
        v_item.id,
        v_balance.balance_id,
        v_qty_to_reserve,
        v_pack_to_reserve,
        p_reserved_by,
        'reserved'
      );

      v_remaining_qty := v_remaining_qty - v_qty_to_reserve;
    END LOOP;

    IF v_remaining_qty <= 0 THEN
      v_items_reserved := v_items_reserved + 1;
    ELSE
      RAISE WARNING 'Insufficient stock for item %: remaining %', v_item.id, v_remaining_qty;
    END IF;
  END LOOP;

  RETURN QUERY SELECT
    TRUE,
    v_items_reserved,
    format('Reserved stock for %s/%s items', v_items_reserved, v_items_count);
END;
$$;

COMMENT ON FUNCTION reserve_stock_for_bonus_face_sheet_items IS 'จองสต็อคสำหรับรายการสินค้าในใบปะหน้าของแถม (FEFO + FIFO)';
```

#### Trigger: Auto Reserve on Insert
```sql
-- File: supabase/migrations/104_add_bonus_fs_reservation_trigger.sql

CREATE OR REPLACE FUNCTION trigger_reserve_stock_after_bonus_face_sheet_created()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_result RECORD;
BEGIN
  -- เรียกใช้ function จองสต็อค
  SELECT * INTO v_result
  FROM reserve_stock_for_bonus_face_sheet_items(
    NEW.id,
    NEW.warehouse_id,
    NEW.created_by
  );

  RAISE NOTICE 'Stock reservation result: %', v_result;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_bonus_face_sheet_reserve_stock
  AFTER INSERT ON bonus_face_sheets
  FOR EACH ROW
  WHEN (NEW.status = 'generated')
  EXECUTE FUNCTION trigger_reserve_stock_after_bonus_face_sheet_created();

COMMENT ON TRIGGER trigger_bonus_face_sheet_reserve_stock ON bonus_face_sheets IS 'อัตโนมัติจองสต็อคเมื่อสร้างใบปะหน้าของแถม';
```

---

### 📍 Phase 3: API Development

#### API 1: Mobile Pick Scan
```typescript
// File: app/api/mobile/bonus-face-sheet/scan/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const {
      bonus_face_sheet_id,
      item_id,
      quantity_picked,
      scanned_code,
      checker_ids = [],
      picker_ids = []
    } = body;

    // [ใช้ logic เหมือน /api/mobile/face-sheet/scan ทุกอย่าง]
    // Copy code จาก face-sheet/scan และแก้ไข:
    // 1. เปลี่ยน table names (face_sheet → bonus_face_sheet)
    // 2. เปลี่ยน field names ที่ต่างกัน
    // 3. Logic การย้ายสต็อคเหมือนกัน 100%

    return NextResponse.json({
      success: true,
      message: 'หยิบสินค้าสำเร็จ'
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

#### API 2: Get Task Details
```typescript
// File: app/api/mobile/bonus-face-sheet/tasks/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const id = parseInt(params.id);

    // [ใช้ logic เหมือน /api/mobile/face-sheet/tasks/[id]]

    return NextResponse.json({
      success: true,
      data: bonusFaceSheet
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

---

### 📍 Phase 4: Frontend Development

#### Page: Mobile Pick UI
```typescript
// File: app/mobile/bonus-face-sheet/[id]/page.tsx

'use client';
import { useState, useEffect } from 'react';
// [Copy structure from /mobile/face-sheet/[id]/page.tsx]
// แก้ไข API calls และ data structure

export default function MobileBonusFaceSheetPickPage({ params }: { params: { id: string } }) {
  // ... implementation
}
```

---

### 📍 Phase 5: Loadlist Integration

#### Migration: Junction Table
```sql
-- File: supabase/migrations/105_add_loadlist_bonus_face_sheets.sql

CREATE TABLE IF NOT EXISTS loadlist_bonus_face_sheets (
  loadlist_id BIGINT NOT NULL,
  bonus_face_sheet_id BIGINT NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (loadlist_id, bonus_face_sheet_id),

  CONSTRAINT fk_loadlist
    FOREIGN KEY (loadlist_id)
    REFERENCES loadlists(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_bonus_face_sheet
    FOREIGN KEY (bonus_face_sheet_id)
    REFERENCES bonus_face_sheets(id)
    ON DELETE CASCADE
);

CREATE INDEX idx_loadlist_bonus_fs_loadlist
  ON loadlist_bonus_face_sheets(loadlist_id);
CREATE INDEX idx_loadlist_bonus_fs_bonus_fs
  ON loadlist_bonus_face_sheets(bonus_face_sheet_id);
```

#### API: Update Loadlist Creation
```typescript
// File: app/api/loadlists/route.ts

// เพิ่มรองรับ bonus_face_sheet_ids ใน input
const { picklist_ids, face_sheet_ids, bonus_face_sheet_ids } = body;

// Insert junction records
if (bonus_face_sheet_ids && bonus_face_sheet_ids.length > 0) {
  const records = bonus_face_sheet_ids.map(id => ({
    loadlist_id: loadlist.id,
    bonus_face_sheet_id: id
  }));

  await supabase
    .from('loadlist_bonus_face_sheets')
    .insert(records);
}
```

#### API: Update Loading Complete
```typescript
// File: app/api/mobile/loading/complete/route.ts

// Query bonus face sheet items เพิ่มเติม
const { data: bonusFaceSheetItems } = await supabase
  .from('loadlist_bonus_face_sheets')
  .select(`
    bonus_face_sheets!inner (
      id,
      bonus_face_sheet_items (
        id,
        sku_id,
        quantity_picked
      )
    )
  `)
  .eq('loadlist_id', loadlist_id);

// ย้ายสต็อค Dispatch → Delivery-In-Progress
// [ใช้ logic เดียวกับ picklist/face sheet items]
```

---

### 📍 Phase 6: Testing & Documentation

#### Test Cases
1. ✅ สร้าง Bonus Face Sheet
2. ✅ จองสต็อคอัตโนมัติ
3. ✅ หยิบสินค้า (Mobile)
4. ✅ โหลดสินค้า (Mobile)
5. ✅ ตรวจสอบ Inventory Balance
6. ✅ ตรวจสอบ Ledger

#### Documentation
1. Update `CLAUDE.md`
2. Create `docs/BONUS_FACE_SHEET_IMPLEMENTATION.md`
3. Update `docs/COMPLETE_ORDER_TYPE_ANALYSIS.md`

---

## 📝 Implementation Checklist

### Phase 1: Database Schema
- [ ] Migration 100: Enhance bonus_face_sheet_items
- [ ] Migration 101: Enhance bonus_face_sheets
- [ ] Migration 102: Create reservation table

### Phase 2: Functions & Triggers
- [ ] Migration 103: Reserve stock function
- [ ] Migration 104: Auto reserve trigger

### Phase 3: API
- [ ] POST /api/mobile/bonus-face-sheet/scan
- [ ] GET /api/mobile/bonus-face-sheet/tasks/[id]

### Phase 4: Frontend
- [ ] /mobile/bonus-face-sheet/[id] page

### Phase 5: Loadlist Integration
- [ ] Migration 105: Junction table
- [ ] Update /api/loadlists (create)
- [ ] Update /api/mobile/loading/complete

### Phase 6: Testing
- [ ] Test reservation
- [ ] Test mobile pick
- [ ] Test loading
- [ ] Test ledger

---

## 🎯 Key Implementation Notes

### 1. Copy จาก Face Sheet
ระบบ Bonus Face Sheet ควรใช้ logic เดียวกันกับ Face Sheet ทุกอย่าง:
- ✅ Stock reservation (FEFO + FIFO)
- ✅ Mobile pick flow
- ✅ Stock movement pattern
- ✅ Ledger recording
- ✅ Employee tracking

### 2. ไม่กระทบระบบเดิม
- ✅ แยก tables (bonus_face_sheet_*)
- ✅ แยก APIs (/api/mobile/bonus-face-sheet/*)
- ✅ แยก UI (/mobile/bonus-face-sheet/*)
- ✅ ใช้ junction table แยก (loadlist_bonus_face_sheets)

### 3. Excel Upload Workflow
- ✅ Keep existing upload/preview flow
- ✅ Map product_code → sku_id (validate against master_sku)
- ✅ Map address/shop → source_location_id (default prep area)
- ✅ Populate enhanced columns before insert

### 4. Validation
- ⚠️ ต้อง validate SKU กับ master_sku
- ⚠️ ต้อง validate source_location กับ preparation_area
- ⚠️ ต้องตรวจสอบสต็อคก่อนจอง

---

## 🔗 Related Documentation

- `docs/PICKLIST_STOCK_RESERVATION_FLOW.md` - Picklist reference
- `docs/FACE_SHEET_STOCK_RESERVATION_COMPLETE.md` - Face Sheet reference
- `docs/fixes/WORKFLOW_FIX_SUMMARY.md` - Workflow summary
- `CLAUDE.md` - Project overview

---

**จัดทำโดย:** Kiro AI Assistant
**วันที่:** 2 ธันวาคม 2025
**เวอร์ชัน:** 1.0 (Complete Analysis)
