# 🔍 รายงานการตรวจสอบ Workflow ระบบ WMS (Picking + Loading)

**วันที่ตรวจสอบ:** 28 พฤศจิกายน 2025  
**ผู้ตรวจสอบ:** Kiro AI Assistant  
**ขอบเขตการตรวจสอบ:** Picklist Creation → Picking → Loadlist Creation → Loading

---

## 📋 สรุปผลการตรวจสอบ

### ✅ จุดแข็งของระบบ
1. มี Trigger อัตโนมัติครบถ้วนสำหรับการเปลี่ยนสถานะ Order
2. มีการจองสต็อคตามหลัก FEFO + FIFO อย่างถูกต้อง
3. มีการย้ายสต็อคอัตโนมัติจาก Source Location → Dispatch → Delivery-In-Progress
4. มี RLS Policies และ Foreign Keys ครบถ้วน

### ⚠️ ปัญหาสำคัญที่พบ (CRITICAL ISSUES)

#### 🔴 **ปัญหาที่ 1: ไม่มี Mobile Pick API**
- **ตำแหน่ง:** `app/api/mobile/pick/` ไม่มีอยู่ในระบบ
- **ผลกระทบ:** พนักงานไม่สามารถสแกน QR Code เพื่อยืนยันการหยิบสินค้าได้
- **สถานะปัจจุบัน:** มีเพียงหน้า UI (`app/mobile/pick/page.tsx`) แต่ไม่มี API endpoint

#### 🔴 **ปัญหาที่ 2: Workflow การหยิบสินค้าไม่สมบูรณ์**
- **ขั้นตอนที่ขาดหาย:** การสแกน QR Code และยืนยันการหยิบ
- **ผลกระทบ:** ไม่มีการลดยอดจองและย้ายสต็อคจริงตามที่กำหนด

#### 🟡 **ปัญหาที่ 3: การจองสต็อคไม่ตรงกับ Location ที่กำหนด**
- **ตำแหน่ง:** `app/api/picklists/create-from-trip/route.ts` (บรรทัด 233-244)
- **ปัญหา:** จองสต็อคจากทั้งคลัง ไม่จำกัดเฉพาะ `source_location_id`
- **ผลกระทบ:** อาจจองสต็อคจาก location ที่ไม่ใช่ preparation area

---

## 📊 การวิเคราะห์แต่ละขั้นตอน


### 1️⃣ ขั้นตอนสร้างใบหยิบ (Picklist Creation)

**หน้าที่เกี่ยวข้อง:** `http://localhost:3000/receiving/picklists`  
**API Endpoint:** `POST /api/picklists/create-from-trip`

#### ✅ สิ่งที่ทำงานถูกต้อง
1. ดึงข้อมูลจากแผนส่งที่มีสถานะ "อนุมัติ" (published)
2. สร้าง picklist_code ตามรูปแบบ `PL-YYYYMMDD-XXX`
3. สร้าง picklist_items พร้อม `source_location_id` จาก `default_location` ของ SKU
4. **จองสต็อคอัตโนมัติ** เมื่อสร้างใบหยิบ (status = 'pending')
5. ใช้หลัก **FEFO + FIFO** ในการจองสต็อค
6. สร้าง replenishment alerts เมื่อสต็อคไม่เพียงพอ

#### ⚠️ ปัญหาที่พบ

**ปัญหา 1.1: การจองสต็อคไม่จำกัด Location**
```typescript
// ❌ ปัญหา: Query จากทั้งคลัง ไม่จำกัดเฉพาะ source_location_id
const { data: balances } = await supabase
  .from('wms_inventory_balances')
  .select('...')
  .eq('warehouse_id', warehouseId)
  .eq('location_id', item.source_location_id)  // ❌ ควรมีบรรทัดนี้
  .eq('sku_id', item.sku_id)
  .gt('total_piece_qty', 0)
```

**ผลกระทบ:**
- จองสต็อคจาก location อื่นที่ไม่ใช่ preparation area
- พนักงานไปหยิบที่ preparation area แต่ไม่มีสต็อค

**แนวทางแก้ไข:**
```typescript
// ✅ แก้ไข: เพิ่มเงื่อนไข location_id
const { data: balances } = await supabase
  .from('wms_inventory_balances')
  .select('...')
  .eq('warehouse_id', warehouseId)
  .eq('location_id', item.source_location_id)  // ✅ เพิ่มบรรทัดนี้
  .eq('sku_id', item.sku_id)
  .gt('total_piece_qty', 0)
```

**ปัญหา 1.2: การจองสต็อคเกิดขึ้นตั้งแต่ status = 'pending'**
- **ปัญหา:** จองสต็อคทันทีเมื่อสร้างใบหยิบ แม้ยังไม่ได้มอบหมายงาน
- **ผลกระทบ:** สต็อคถูกจองไว้นานเกินไป อาจทำให้ใบหยิบอื่นไม่สามารถใช้สต็อคได้
- **คำแนะนำ:** ควรจองสต็อคเมื่อเปลี่ยนเป็น 'assigned' แทน

---

### 2️⃣ ขั้นตอนมอบหมายใบหยิบ (Picklist Assignment)

**API Endpoint:** `PATCH /api/picklists/[id]` (status = 'assigned')

#### ✅ สิ่งที่ทำงานถูกต้อง
1. เปลี่ยนสถานะ picklist เป็น 'assigned'
2. อัปเดตสถานะ Orders เป็น 'in_picking' อัตโนมัติ
3. จองสต็อคตามหลัก FEFO + FIFO (ถ้ายังไม่เคยจอง)
4. ป้องกันการจองซ้ำด้วยการเช็ค `wasAlreadyAssigned`

#### ⚠️ ปัญหาที่พบ

**ปัญหา 2.1: การจองสต็อคซ้ำซ้อน**
- ถ้าสร้างใบหยิบแล้วจองสต็อคไว้ตั้งแต่ 'pending'
- เมื่อเปลี่ยนเป็น 'assigned' จะมีการจองซ้ำอีกครั้ง (แม้จะมี check แล้ว)
- **แนวทางแก้ไข:** ควรจองสต็อคเพียงครั้งเดียวเมื่อ 'assigned' เท่านั้น

**ปัญหา 2.2: ไม่มีการอัปเดต Inventory Balance ตามที่กำหนด**
- **ตามเอกสาร:** ต้องเพิ่มยอดจองใน `reserved_pack_qty` และ `reserved_piece_qty`
- **สถานะปัจจุบัน:** ✅ มีการอัปเดตแล้ว (บรรทัด 254-260 ใน route.ts)
- **ข้อสังเกต:** ทำงานถูกต้อง

---


### 3️⃣ ขั้นตอนพนักงานหยิบสินค้า (Picking Confirmation by QR Scan)

**หน้าที่เกี่ยวข้อง:** `http://localhost:3000/mobile/pick`  
**API Endpoint ที่ควรมี:** `POST /api/mobile/pick/scan` หรือ `POST /api/mobile/pick/confirm`

#### 🔴 **ปัญหาร้ายแรง: ไม่มี API Endpoint สำหรับการสแกนและยืนยันการหยิบ**

**สถานะปัจจุบัน:**
- ✅ มีหน้า UI: `app/mobile/pick/page.tsx` (แสดงรายการใบหยิบ)
- ❌ **ไม่มี API:** `app/api/mobile/pick/` ไม่มีในระบบ
- ❌ **ไม่มีหน้ารายละเอียด:** `app/mobile/pick/[id]/page.tsx` ไม่มี

**ผลกระทบ:**
1. พนักงานไม่สามารถสแกน QR Code เพื่อยืนยันการหยิบได้
2. ไม่มีการลดยอดจองใน Inventory Balance
3. ไม่มีการลดสต็อคจริงจาก Location ต้นทาง
4. ไม่มีการย้ายสต็อคไปที่ Dispatch
5. ไม่มีการบันทึกลง Inventory Ledger

**สิ่งที่ควรเกิดขึ้นตามเอกสาร:**

เมื่อพนักงานสแกน QR Code และยืนยันการหยิบ ระบบต้อง:

1. **ลดยอดจองใน Inventory Balance** (ที่ source_location_id)
   - ลด `reserved_pack_qty`
   - ลด `reserved_piece_qty`

2. **ลดสต็อคจริงจาก Location ต้นทาง** (source_location_id)
   - ลด `total_pack_qty`
   - ลด `total_piece_qty`

3. **เพิ่มสต็อคที่ Dispatch Location**
   - เพิ่ม `total_pack_qty`
   - เพิ่ม `total_piece_qty`

4. **บันทึกประวัติลง Inventory Ledger** (2 รายการ)
   - รายการที่ 1: OUT จาก source_location (direction='out', transaction_type='pick')
   - รายการที่ 2: IN ไปยัง Dispatch (direction='in', transaction_type='pick')

5. **อัปเดตสถานะ picklist_items**
   - เปลี่ยน status เป็น 'picked'
   - บันทึก `quantity_picked`

6. **อัปเดตสถานะ picklist**
   - เปลี่ยนเป็น 'picking' (ถ้ายังหยิบไม่ครบ)
   - เปลี่ยนเป็น 'completed' (ถ้าหยิบครบทุกรายการแล้ว)

**สถานะปัจจุบันของระบบ:**

มีเพียง API สำหรับ Complete Picklist (`POST /api/picklists/[id]/complete`) ซึ่ง:
- ✅ เปลี่ยนสถานะเป็น 'completed'
- ✅ ปลดจองสต็อค (unreserve)
- ✅ ย้ายสต็อคจาก source_location → Dispatch ผ่าน Move Service
- ✅ บันทึก Inventory Ledger

**แต่ขาดขั้นตอนกลาง:**
- ❌ ไม่มีการสแกนรายการทีละรายการ
- ❌ ไม่มีการยืนยันจำนวนที่หยิบจริง
- ❌ ไม่มีการอัปเดต `quantity_picked` ในแต่ละ item

---

### 4️⃣ ขั้นตอนสร้างใบโหลด (Loadlist Creation)

**หน้าที่เกี่ยวข้อง:** `http://localhost:3000/receiving/loadlists`  
**API Endpoint:** `POST /api/loadlists`

#### ✅ สิ่งที่ทำงานถูกต้อง
1. ดึงเฉพาะ picklists ที่มีสถานะ 'completed' (`GET /api/loadlists/available-picklists`)
2. สร้าง loadlist_code ตามรูปแบบ `LD-YYYYMMDD-####`
3. เชื่อมโยง picklists กับ loadlist ผ่านตาราง `wms_loadlist_picklists`
4. สถานะเริ่มต้นเป็น 'pending' (รอโหลด)
5. มี Foreign Keys และ RLS Policies ครบถ้วน

#### ⚠️ ข้อสังเกต

**ข้อสังเกต 4.1: การกรองสถานะ picklist**
```typescript
// ✅ ถูกต้อง: ดึงเฉพาะ completed picklists
.eq('status', 'completed')
.not('id', 'in', `(${usedPicklistIds.join(',')})`)
```

**ข้อสังเกต 4.2: Loadlist Status Enum**
- Migration 043 ลดสถานะเหลือ 3 สถานะ: `pending`, `loaded`, `cancelled`
- ✅ เหมาะสมกับ workflow ที่กำหนด

---


### 5️⃣ ขั้นตอนสแกนโหลดสินค้า (Loading Confirmation by QR Scan)

**หน้าที่เกี่ยวข้อง:** `http://localhost:3000/mobile/loading`  
**API Endpoint:** `POST /api/mobile/loading/complete`

#### ✅ สิ่งที่ทำงานถูกต้อง
1. ตรวจสอบสถานะ loadlist (ต้องเป็น 'pending')
2. อัปเดตสถานะเป็น 'loaded' ทันทีเพื่อป้องกัน double processing
3. อัปเดต `loaded_at` ใน `wms_loadlist_picklists`
4. ดึงข้อมูล picklist_items และคำนวณจำนวนที่ต้องย้าย

#### ✅ การย้ายสต็อค (Stock Movement)

**จาก Dispatch → Delivery-In-Progress:**

1. **ลดยอดที่ Dispatch Location**
   ```typescript
   // ✅ ถูกต้อง: ลด total_pack_qty และ total_piece_qty
   const newPiece = dispatchBalance.total_piece_qty - qty;
   const newPack = Math.floor(newPiece / qtyPerPack);
   ```

2. **เพิ่มยอดที่ Delivery-In-Progress Location**
   ```typescript
   // ✅ ถูกต้อง: เพิ่ม total_pack_qty และ total_piece_qty
   const newPiece = deliveryBalance.total_piece_qty + qty;
   const newPack = Math.floor(newPiece / qtyPerPack);
   ```

3. **บันทึก Inventory Ledger** (2 รายการ)
   - ✅ OUT จาก Dispatch (direction='out', transaction_type='ship')
   - ✅ IN ไปยัง Delivery-In-Progress (direction='in', transaction_type='ship')

#### ⚠️ ปัญหาที่พบ

**ปัญหา 5.1: ไม่มีการตรวจสอบสต็อคที่ Dispatch**
```typescript
// ⚠️ ปัญหา: ไม่มีการตรวจสอบว่ามีสต็อคเพียงพอหรือไม่
if (dispatchBalance && dispatchBalance.total_piece_qty >= qty) {
  // ลดสต็อค
} else {
  // ❌ ไม่มีการจัดการกรณีสต็อคไม่พอ
}
```

**ผลกระทบ:**
- ถ้าสต็อคที่ Dispatch น้อยกว่าที่ต้องการ จะไม่มีการลดสต็อค
- แต่ยังคงเพิ่มสต็อคที่ Delivery-In-Progress → **ข้อมูลไม่สอดคล้องกัน**

**แนวทางแก้ไข:**
```typescript
if (dispatchBalance && dispatchBalance.total_piece_qty >= qty) {
  // ลดสต็อค
} else {
  // ✅ เพิ่ม: Log error และ skip item นี้
  console.error(`Insufficient stock at Dispatch for SKU ${item.sku_id}`);
  continue; // ข้ามไปรายการถัดไป
}
```

**ปัญหา 5.2: การคำนวณ pack_qty**
```typescript
// ⚠️ ปัญหา: ใช้ Math.floor อาจทำให้เศษหาย
const newPack = Math.floor(newPiece / qtyPerPack);
```

**ตัวอย่าง:**
- ถ้า newPiece = 25, qtyPerPack = 12
- newPack = Math.floor(25/12) = 2
- แต่ควรเป็น 2.08 (2 แพ็ค + 1 ชิ้น)

**แนวทางแก้ไข:**
```typescript
// ✅ แก้ไข: เก็บทศนิยมหรือแยกเป็น pack + piece
const fullPacks = Math.floor(newPiece / qtyPerPack);
const remainingPieces = newPiece % qtyPerPack;
```

**ปัญหา 5.3: ไม่มีการสแกน QR Code จริง**
- API รับเฉพาะ `loadlist_id` หรือ `loadlist_code`
- ไม่มีการตรวจสอบว่าสแกน QR Code จริงหรือไม่
- **คำแนะนำ:** ควรเพิ่ม parameter `scanned_code` เพื่อยืนยันการสแกน

---

## 🗄️ การตรวจสอบ Database Schema

### ตาราง `wms_inventory_balances`

**คอลัมน์ที่เกี่ยวข้อง:**
- ✅ `total_pack_qty` - จำนวนแพ็ครวม
- ✅ `total_piece_qty` - จำนวนชิ้นรวม
- ✅ `reserved_pack_qty` - จำนวนแพ็คจอง
- ✅ `reserved_piece_qty` - จำนวนชิ้นจอง
- ✅ `location_id` - FK to master_location
- ✅ `sku_id` - FK to master_sku
- ✅ `warehouse_id` - FK to master_warehouse

**Triggers:**
- ✅ `sync_inventory_ledger_to_balance()` - อัปเดต balance เมื่อมี ledger entry ใหม่

### ตาราง `wms_inventory_ledger`

**คอลัมน์ที่เกี่ยวข้อง:**
- ✅ `movement_at` - วันเวลาที่เคลื่อนไหว
- ✅ `transaction_type` - ประเภท (receive, pick, ship, etc.)
- ✅ `direction` - ทิศทาง (in/out)
- ✅ `warehouse_id` - คลัง
- ✅ `location_id` - โลเคชั่น
- ✅ `sku_id` - สินค้า
- ✅ `pack_qty` - จำนวนแพ็ค
- ✅ `piece_qty` - จำนวนชิ้น
- ✅ `reference_no` - เลขที่อ้างอิง (picklist_code, loadlist_code)
- ✅ `reference_doc_type` - ประเภทเอกสาร
- ✅ `reference_doc_id` - ID เอกสาร

**Triggers:**
- ✅ `trg_sync_inventory_ledger_to_balance` - Sync ไปยัง balance อัตโนมัติ

### ตาราง `picklists`

**คอลัมน์ที่เกี่ยวข้อง:**
- ✅ `picklist_code` - รหัสใบหยิบ
- ✅ `status` - สถานะ (pending, assigned, picking, completed, cancelled)
- ✅ `trip_id` - FK to receiving_route_trips
- ✅ `plan_id` - FK to receiving_route_plans
- ✅ `total_lines` - จำนวนรายการ
- ✅ `total_quantity` - จำนวนรวม
- ✅ `loading_door_number` - หมายเลขประตูโหลด

### ตาราง `picklist_items`

**คอลัมน์ที่เกี่ยวข้อง:**
- ✅ `picklist_id` - FK to picklists
- ✅ `sku_id` - FK to master_sku
- ✅ `source_location_id` - โลเคชั่นต้นทาง (preparation area)
- ✅ `quantity_to_pick` - จำนวนที่ต้องหยิบ
- ✅ `quantity_picked` - จำนวนที่หยิบจริง
- ✅ `status` - สถานะ (pending, picked, shortage, substituted)
- ✅ `order_id` - FK to wms_orders
- ✅ `order_item_id` - FK to wms_order_items

### ตาราง `loadlists`

**คอลัมน์ที่เกี่ยวข้อง:**
- ✅ `loadlist_code` - รหัสใบโหลด
- ✅ `status` - สถานะ (pending, loaded, cancelled)
- ✅ `plan_id` - FK to receiving_route_plans
- ✅ `trip_id` - FK to receiving_route_trips
- ✅ `vehicle_id` - FK to master_vehicle
- ✅ `driver_employee_id` - FK to master_employee
- ✅ `checker_employee_id` - FK to master_employee
- ✅ `helper_employee_id` - FK to master_employee

### ตาราง `wms_loadlist_picklists` (Junction Table)

**คอลัมน์ที่เกี่ยวข้อง:**
- ✅ `loadlist_id` - FK to loadlists
- ✅ `picklist_id` - FK to picklists
- ✅ `sequence` - ลำดับการโหลด
- ✅ `loaded_at` - วันเวลาที่โหลดเสร็จ
- ✅ `loaded_by_employee_id` - พนักงานที่โหลด

### ตาราง `master_location`

**Locations ที่เกี่ยวข้อง:**
- ✅ `Dispatch` - พื้นที่รอจัดส่ง (location_type='dispatch')
- ✅ `Delivery-In-Progress` - สินค้าระหว่างจัดส่ง (location_type='delivery')

**Migration:** 042_add_dispatch_delivery_locations.sql
- ✅ เพิ่ม location_type: 'dispatch' และ 'delivery'
- ✅ สร้าง Dispatch location
- ✅ สร้าง Delivery-In-Progress location

---


## 🔄 การตรวจสอบ Triggers และ Workflow Automation

### Trigger 1: Route Plan Publish → Orders Confirmed
**Function:** `update_orders_on_route_publish()`  
**Migration:** 027_create_workflow_status_triggers.sql

✅ **ทำงานถูกต้อง:**
- เมื่อ Route Plan เปลี่ยนเป็น 'published'
- อัปเดต Orders จาก 'draft' → 'confirmed'

### Trigger 2: Picklist Created → Orders In_Picking
**Function:** `update_orders_on_picklist_create()`  
**Migration:** 027_create_workflow_status_triggers.sql

✅ **ทำงานถูกต้อง:**
- เมื่อสร้าง Picklist ใหม่
- อัปเดต Orders จาก 'confirmed' → 'in_picking'

### Trigger 3: Picklist Completed → Orders Picked & Route Ready
**Function:** `update_orders_and_route_on_picklist_complete()`  
**Migration:** 027_create_workflow_status_triggers.sql

✅ **ทำงานถูกต้อง:**
- เมื่อ Picklist เปลี่ยนเป็น 'completed'
- อัปเดต Orders จาก 'in_picking' → 'picked'
- ถ้า Picklists ทั้งหมดเสร็จ → Route Plan เปลี่ยนเป็น 'ready_to_load'

### Trigger 4: Loadlist Item Added → Order Loaded
**Function:** `update_order_on_loadlist_scan()`  
**Migration:** 027_create_workflow_status_triggers.sql

⚠️ **ปัญหา:**
- Trigger นี้ทำงานกับตาราง `loadlist_items`
- แต่ระบบปัจจุบันใช้ `wms_loadlist_picklists` แทน
- **ผลกระทบ:** Trigger ไม่ทำงาน เพราะไม่มีการ INSERT ลง `loadlist_items`

**แนวทางแก้ไข:**
- ลบ Trigger เก่า หรือ
- สร้าง Trigger ใหม่สำหรับ `wms_loadlist_picklists`

### Trigger 5: Loadlist Departure → Orders In_Transit
**Function:** `update_orders_and_route_on_departure()`  
**Migration:** 027_create_workflow_status_triggers.sql

⚠️ **ปัญหา:**
- Trigger ดึง order_id จาก `loadlist_items`
- แต่ระบบใช้ `wms_loadlist_picklists` → `picklist_items` → `order_id`
- **ผลกระทบ:** Trigger ไม่ทำงาน

**แนวทางแก้ไข:**
```sql
-- ✅ แก้ไข: ดึง order_id จาก picklist_items
UPDATE wms_orders
SET status = 'in_transit', updated_at = NOW()
WHERE order_id IN (
  SELECT DISTINCT pi.order_id
  FROM wms_loadlist_picklists llp
  JOIN picklist_items pi ON pi.picklist_id = llp.picklist_id
  WHERE llp.loadlist_id = NEW.id
)
AND status = 'loaded';
```

### Trigger 6: Order Delivered → Loadlist & Route Completed
**Function:** `update_loadlist_and_route_on_delivery()`  
**Migration:** 027_create_workflow_status_triggers.sql

⚠️ **ปัญหา:**
- Trigger ดึง loadlist_id จาก `loadlist_items`
- แต่ระบบใช้ `wms_loadlist_picklists`
- **ผลกระทบ:** Trigger ไม่ทำงาน

---

## 📊 สรุปปัญหาและผลกระทบ

### 🔴 ปัญหาวิกฤต (Critical Issues)

| # | ปัญหา | ผลกระทบ | ความสำคัญ |
|---|-------|---------|-----------|
| 1 | **ไม่มี Mobile Pick API** | พนักงานไม่สามารถสแกนและยืนยันการหยิบได้ | 🔴 สูงมาก |
| 2 | **Workflow การหยิบไม่สมบูรณ์** | ไม่มีการลดยอดจอง ไม่มีการย้ายสต็อค | 🔴 สูงมาก |
| 3 | **Triggers ไม่ทำงาน** | สถานะ Orders ไม่อัปเดตอัตโนมัติ | 🔴 สูงมาก |

### 🟡 ปัญหาสำคัญ (Major Issues)

| # | ปัญหา | ผลกระทบ | ความสำคัญ |
|---|-------|---------|-----------|
| 4 | **การจองสต็อคไม่จำกัด Location** | จองสต็อคจาก location ที่ไม่ถูกต้อง | 🟡 ปานกลาง |
| 5 | **ไม่มีการตรวจสอบสต็อคที่ Dispatch** | อาจเกิดข้อมูลไม่สอดคล้องกัน | 🟡 ปานกลาง |
| 6 | **การคำนวณ pack_qty ไม่แม่นยำ** | เศษชิ้นอาจหายไป | 🟡 ปานกลาง |

### 🟢 ข้อเสนอแนะ (Recommendations)

| # | ข้อเสนอแนะ | ประโยชน์ | ความสำคัญ |
|---|-----------|---------|-----------|
| 7 | **จองสต็อคเมื่อ assigned แทน pending** | ลดเวลาที่สต็อคถูกจองไว้ | 🟢 ต่ำ |
| 8 | **เพิ่มการตรวจสอบ QR Code** | เพิ่มความปลอดภัยและความถูกต้อง | 🟢 ต่ำ |

---

## 🛠️ แนวทางแก้ไขที่แนะนำ

### แก้ไขเร่งด่วน (Priority 1)

#### 1. สร้าง Mobile Pick API

**สร้างไฟล์:** `app/api/mobile/pick/scan/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { picklist_id, item_id, quantity_picked, scanned_code } = await request.json();

    // 1. ตรวจสอบ picklist และ item
    const { data: item, error: itemError } = await supabase
      .from('picklist_items')
      .select(`
        *,
        picklists!inner(status, plan_id, trip_id),
        master_sku(qty_per_pack)
      `)
      .eq('id', item_id)
      .eq('picklist_id', picklist_id)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // 2. ตรวจสอบสถานะ picklist
    if (item.picklists.status !== 'assigned' && item.picklists.status !== 'picking') {
      return NextResponse.json(
        { error: 'Picklist must be assigned or picking' },
        { status: 400 }
      );
    }

    // 3. ดึง warehouse_id
    const { data: planData } = await supabase
      .from('receiving_route_plans')
      .select('warehouse_id')
      .eq('plan_id', item.picklists.plan_id)
      .single();

    const warehouseId = planData?.warehouse_id;
    if (!warehouseId) {
      return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 });
    }

    // 4. ดึง Dispatch location
    const { data: dispatchLocation } = await supabase
      .from('master_location')
      .select('location_id')
      .eq('location_code', 'Dispatch')
      .eq('warehouse_id', warehouseId)
      .single();

    if (!dispatchLocation) {
      return NextResponse.json({ error: 'Dispatch location not found' }, { status: 404 });
    }

    const qtyPerPack = item.master_sku?.qty_per_pack || 1;
    const packQty = Math.floor(quantity_picked / qtyPerPack);
    const now = new Date().toISOString();

    // 5. ลดยอดจองและสต็อคจาก source_location (ตามหลัก FEFO + FIFO)
    const { data: balances } = await supabase
      .from('wms_inventory_balances')
      .select('balance_id, total_piece_qty, reserved_piece_qty, total_pack_qty, reserved_pack_qty')
      .eq('warehouse_id', warehouseId)
      .eq('location_id', item.source_location_id)
      .eq('sku_id', item.sku_id)
      .gt('reserved_piece_qty', 0)
      .order('expiry_date', { ascending: true, nullsFirst: false })
      .order('production_date', { ascending: true, nullsFirst: false });

    let remainingQty = quantity_picked;
    const ledgerEntries = [];

    for (const balance of balances || []) {
      if (remainingQty <= 0) break;

      const qtyToDeduct = Math.min(balance.reserved_piece_qty, remainingQty);
      const packToDeduct = Math.floor(qtyToDeduct / qtyPerPack);

      // ลดยอดจองและสต็อคจริง
      await supabase
        .from('wms_inventory_balances')
        .update({
          reserved_piece_qty: Math.max(0, balance.reserved_piece_qty - qtyToDeduct),
          reserved_pack_qty: Math.max(0, balance.reserved_pack_qty - packToDeduct),
          total_piece_qty: Math.max(0, balance.total_piece_qty - qtyToDeduct),
          total_pack_qty: Math.max(0, balance.total_pack_qty - packToDeduct),
          updated_at: now
        })
        .eq('balance_id', balance.balance_id);

      // บันทึก ledger: OUT จาก source_location
      ledgerEntries.push({
        movement_at: now,
        transaction_type: 'pick',
        direction: 'out',
        warehouse_id: warehouseId,
        location_id: item.source_location_id,
        sku_id: item.sku_id,
        pack_qty: packToDeduct,
        piece_qty: qtyToDeduct,
        reference_no: item.picklists.picklist_code,
        reference_doc_type: 'picklist',
        reference_doc_id: picklist_id,
        remarks: `Pick from ${item.source_location_id}`
      });

      remainingQty -= qtyToDeduct;
    }

    // 6. เพิ่มสต็อคที่ Dispatch
    const { data: dispatchBalance } = await supabase
      .from('wms_inventory_balances')
      .select('balance_id, total_piece_qty, total_pack_qty')
      .eq('warehouse_id', warehouseId)
      .eq('location_id', dispatchLocation.location_id)
      .eq('sku_id', item.sku_id)
      .maybeSingle();

    if (dispatchBalance) {
      await supabase
        .from('wms_inventory_balances')
        .update({
          total_piece_qty: dispatchBalance.total_piece_qty + quantity_picked,
          total_pack_qty: dispatchBalance.total_pack_qty + packQty,
          updated_at: now
        })
        .eq('balance_id', dispatchBalance.balance_id);
    } else {
      await supabase
        .from('wms_inventory_balances')
        .insert({
          warehouse_id: warehouseId,
          location_id: dispatchLocation.location_id,
          sku_id: item.sku_id,
          total_pack_qty: packQty,
          total_piece_qty: quantity_picked,
          reserved_pack_qty: 0,
          reserved_piece_qty: 0,
          last_movement_at: now
        });
    }

    // บันทึก ledger: IN ไปยัง Dispatch
    ledgerEntries.push({
      movement_at: now,
      transaction_type: 'pick',
      direction: 'in',
      warehouse_id: warehouseId,
      location_id: dispatchLocation.location_id,
      sku_id: item.sku_id,
      pack_qty: packQty,
      piece_qty: quantity_picked,
      reference_no: item.picklists.picklist_code,
      reference_doc_type: 'picklist',
      reference_doc_id: picklist_id,
      remarks: `Pick to Dispatch`
    });

    // 7. บันทึก ledger entries
    await supabase.from('wms_inventory_ledger').insert(ledgerEntries);

    // 8. อัปเดต picklist_item
    await supabase
      .from('picklist_items')
      .update({
        quantity_picked: quantity_picked,
        status: 'picked',
        updated_at: now
      })
      .eq('id', item_id);

    // 9. เช็คว่าหยิบครบทุก item หรือยัง
    const { data: allItems } = await supabase
      .from('picklist_items')
      .select('status')
      .eq('picklist_id', picklist_id);

    const allPicked = allItems?.every(i => i.status === 'picked');

    // 10. อัปเดตสถานะ picklist
    await supabase
      .from('picklists')
      .update({
        status: allPicked ? 'completed' : 'picking',
        updated_at: now
      })
      .eq('id', picklist_id);

    return NextResponse.json({
      success: true,
      message: 'Item picked successfully',
      picklist_completed: allPicked
    });

  } catch (error) {
    console.error('Pick scan error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```


#### 2. แก้ไข Triggers ให้ทำงานกับ wms_loadlist_picklists

**สร้างไฟล์:** `supabase/migrations/044_fix_loadlist_triggers.sql`

```sql
-- ============================================================
-- Migration 044: Fix Loadlist Triggers
-- แก้ไข Triggers ให้ทำงานกับ wms_loadlist_picklists แทน loadlist_items
-- ============================================================

-- 1. ลบ Trigger เก่าที่ใช้ loadlist_items
DROP TRIGGER IF EXISTS trigger_loadlist_item_update_order ON loadlist_items;
DROP TRIGGER IF EXISTS trigger_departure_update_orders_and_route ON loadlists;
DROP TRIGGER IF EXISTS trigger_delivery_update_loadlist_and_route ON wms_orders;

-- 2. สร้าง Function ใหม่สำหรับ Loadlist Completion
CREATE OR REPLACE FUNCTION update_orders_on_loadlist_complete()
RETURNS TRIGGER AS $
BEGIN
    -- เมื่อ Loadlist เปลี่ยนเป็น 'loaded'
    IF NEW.status = 'loaded' AND (OLD.status IS NULL OR OLD.status != 'loaded') THEN
        
        -- อัปเดต Orders จาก 'picked' → 'loaded'
        UPDATE wms_orders
        SET status = 'loaded', updated_at = NOW()
        WHERE order_id IN (
            SELECT DISTINCT pi.order_id
            FROM wms_loadlist_picklists llp
            JOIN picklist_items pi ON pi.picklist_id = llp.picklist_id
            WHERE llp.loadlist_id = NEW.id
            AND pi.order_id IS NOT NULL
        )
        AND status = 'picked';
        
        RAISE NOTICE 'Loadlist % completed. Updated orders to loaded.', NEW.loadlist_code;
    END IF;
    
    RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- 3. สร้าง Trigger ใหม่
CREATE TRIGGER trigger_loadlist_complete_update_orders
    AFTER UPDATE ON loadlists
    FOR EACH ROW
    EXECUTE FUNCTION update_orders_on_loadlist_complete();

COMMENT ON FUNCTION update_orders_on_loadlist_complete() IS 
'เมื่อ Loadlist loaded → Orders: picked→loaded';

-- 4. แก้ไข Function สำหรับ Order Delivered
CREATE OR REPLACE FUNCTION update_loadlist_and_route_on_delivery()
RETURNS TRIGGER AS $
DECLARE
    v_loadlist_id BIGINT;
    v_plan_id BIGINT;
    v_all_delivered BOOLEAN;
    v_all_loadlists_completed BOOLEAN;
BEGIN
    -- เมื่อ Order เปลี่ยนเป็น 'delivered'
    IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') THEN

        -- หา Loadlist ที่ Order นี้อยู่ (ผ่าน picklist_items)
        SELECT DISTINCT llp.loadlist_id INTO v_loadlist_id
        FROM picklist_items pi
        JOIN wms_loadlist_picklists llp ON llp.picklist_id = pi.picklist_id
        WHERE pi.order_id = NEW.order_id
        LIMIT 1;

        IF v_loadlist_id IS NOT NULL THEN
            -- ตรวจสอบว่า Orders ทั้งหมดใน Loadlist ส่งถึงหรือยัง
            SELECT NOT EXISTS (
                SELECT 1
                FROM wms_orders o
                JOIN picklist_items pi ON pi.order_id = o.order_id
                JOIN wms_loadlist_picklists llp ON llp.picklist_id = pi.picklist_id
                WHERE llp.loadlist_id = v_loadlist_id
                AND o.status != 'delivered'
            ) INTO v_all_delivered;

            -- ถ้าส่งถึงหมดแล้ว → Loadlist completed (ไม่ใช้ในระบบปัจจุบัน)
            -- เพราะ loadlist มีแค่ 'pending', 'loaded', 'cancelled'
            -- แต่เก็บไว้สำหรับอนาคต
            
            IF v_all_delivered THEN
                -- อัปเดต Route Plan ถ้าจำเป็น
                SELECT plan_id INTO v_plan_id
                FROM loadlists
                WHERE id = v_loadlist_id;

                IF v_plan_id IS NOT NULL THEN
                    SELECT NOT EXISTS (
                        SELECT 1
                        FROM wms_orders o
                        JOIN picklist_items pi ON pi.order_id = o.order_id
                        JOIN picklists p ON p.id = pi.picklist_id
                        WHERE p.plan_id = v_plan_id
                        AND o.status != 'delivered'
                    ) INTO v_all_loadlists_completed;

                    IF v_all_loadlists_completed THEN
                        UPDATE receiving_route_plans
                        SET status = 'completed', updated_at = NOW()
                        WHERE plan_id = v_plan_id
                        AND status = 'in_transit';

                        RAISE NOTICE 'All orders delivered for Route Plan ID %. Status changed to completed.', v_plan_id;
                    END IF;
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- 5. สร้าง Trigger ใหม่
CREATE TRIGGER trigger_delivery_update_route
    AFTER UPDATE ON wms_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_loadlist_and_route_on_delivery();

COMMENT ON FUNCTION update_loadlist_and_route_on_delivery() IS 
'เมื่อ Order delivered → Route: in_transit→completed (ถ้าทุก Order ส่งถึง)';
```

#### 3. แก้ไขการจองสต็อคให้จำกัด Location

**แก้ไขไฟล์:** `app/api/picklists/create-from-trip/route.ts`

```typescript
// บรรทัด 233-244
// ❌ เดิม: Query จากทั้งคลัง
const { data: balances } = await supabase
  .from('wms_inventory_balances')
  .select('...')
  .eq('warehouse_id', warehouseId)
  // ❌ ขาดบรรทัดนี้
  .eq('sku_id', item.sku_id)
  .gt('total_piece_qty', 0)

// ✅ แก้ไข: เพิ่มเงื่อนไข location_id
const { data: balances } = await supabase
  .from('wms_inventory_balances')
  .select('...')
  .eq('warehouse_id', warehouseId)
  .eq('location_id', item.source_location_id)  // ✅ เพิ่มบรรทัดนี้
  .eq('sku_id', item.sku_id)
  .gt('total_piece_qty', 0)
```

**แก้ไขไฟล์:** `app/api/picklists/[id]/route.ts`

```typescript
// บรรทัด 233 (ใน PATCH handler)
// ❌ เดิม: Query จากทั้งคลัง
const { data: balances } = await supabase
  .from('wms_inventory_balances')
  .select('...')
  .eq('warehouse_id', warehouseId)
  .eq('sku_id', item.sku_id)

// ✅ แก้ไข: ต้องดึง source_location_id จาก picklist_items ก่อน
const { data: picklistItems } = await supabase
  .from('picklist_items')
  .select('id, sku_id, source_location_id, quantity_to_pick')
  .eq('picklist_id', id);

for (const item of picklistItems) {
  if (!item.source_location_id) continue;
  
  const { data: balances } = await supabase
    .from('wms_inventory_balances')
    .select('...')
    .eq('warehouse_id', warehouseId)
    .eq('location_id', item.source_location_id)  // ✅ เพิ่มบรรทัดนี้
    .eq('sku_id', item.sku_id)
    .gt('total_piece_qty', 0)
  
  // ... จองสต็อค
}
```

---

### แก้ไขสำคัญ (Priority 2)

#### 4. เพิ่มการตรวจสอบสต็อคที่ Dispatch

**แก้ไขไฟล์:** `app/api/mobile/loading/complete/route.ts`

```typescript
// บรรทัด 115-130
// ❌ เดิม: ไม่มีการตรวจสอบสต็อค
if (dispatchBalance && dispatchBalance.total_piece_qty >= qty) {
  // ลดสต็อค
}

// ✅ แก้ไข: เพิ่มการจัดการกรณีสต็อคไม่พอ
if (dispatchBalance && dispatchBalance.total_piece_qty >= qty) {
  const newPiece = dispatchBalance.total_piece_qty - qty;
  const newPack = Math.floor(newPiece / qtyPerPack);

  await supabase
    .from('wms_inventory_balances')
    .update({
      total_pack_qty: newPack,
      total_piece_qty: newPiece,
      updated_at: now
    })
    .eq('balance_id', dispatchBalance.balance_id);
} else {
  // ✅ เพิ่ม: Log error และข้ามรายการนี้
  console.error(`❌ Insufficient stock at Dispatch for SKU ${item.sku_id}`);
  console.error(`Required: ${qty}, Available: ${dispatchBalance?.total_piece_qty || 0}`);
  
  // สร้าง alert หรือ notification
  await supabase.from('stock_alerts').insert({
    alert_type: 'insufficient_stock',
    location_id: dispatchLocation.location_id,
    sku_id: item.sku_id,
    required_qty: qty,
    available_qty: dispatchBalance?.total_piece_qty || 0,
    reference_no: loadlist.loadlist_code,
    created_at: now
  });
  
  continue; // ข้ามไปรายการถัดไป
}
```

#### 5. ปรับปรุงการคำนวณ pack_qty

**แก้ไขไฟล์:** `app/api/mobile/loading/complete/route.ts`

```typescript
// ❌ เดิม: ใช้ Math.floor อาจทำให้เศษหาย
const newPack = Math.floor(newPiece / qtyPerPack);

// ✅ แก้ไข: เก็บทศนิยมหรือแยกเป็น pack + piece
// Option 1: เก็บเป็นทศนิยม (แนะนำ)
const newPack = newPiece / qtyPerPack;

// Option 2: แยกเป็น full packs + remaining pieces
const fullPacks = Math.floor(newPiece / qtyPerPack);
const remainingPieces = newPiece % qtyPerPack;

// อัปเดต balance
await supabase
  .from('wms_inventory_balances')
  .update({
    total_pack_qty: fullPacks,
    total_piece_qty: newPiece,  // เก็บ piece_qty ที่แม่นยำ
    updated_at: now
  })
  .eq('balance_id', balance.balance_id);
```

---

### ปรับปรุงเพิ่มเติม (Priority 3)

#### 6. เปลี่ยนการจองสต็อคจาก pending → assigned

**แก้ไขไฟล์:** `app/api/picklists/create-from-trip/route.ts`

```typescript
// บรรทัด 211-280
// ❌ เดิม: จองสต็อคทันทีเมื่อสร้างใบหยิบ (status = 'pending')

// ✅ แก้ไข: ลบการจองสต็อคออกจาก create-from-trip
// ให้จองสต็อคเมื่อเปลี่ยนเป็น 'assigned' แทน (ใน PATCH /api/picklists/[id])

// ลบโค้ดตั้งแต่บรรทัด 211-280
// และย้ายไปไว้ใน PATCH handler เท่านั้น
```

#### 7. เพิ่มการตรวจสอบ QR Code

**แก้ไขไฟล์:** `app/api/mobile/pick/scan/route.ts` (ที่สร้างใหม่)

```typescript
// เพิ่มการตรวจสอบ scanned_code
const { picklist_id, item_id, quantity_picked, scanned_code } = await request.json();

// ตรวจสอบว่า scanned_code ตรงกับ picklist_code หรือไม่
const { data: picklist } = await supabase
  .from('picklists')
  .select('picklist_code')
  .eq('id', picklist_id)
  .single();

if (scanned_code !== picklist.picklist_code) {
  return NextResponse.json(
    { error: 'Invalid QR code. Please scan the correct picklist.' },
    { status: 400 }
  );
}
```

**แก้ไขไฟล์:** `app/api/mobile/loading/complete/route.ts`

```typescript
// เพิ่มการตรวจสอบ scanned_code
const { loadlist_id, loadlist_code, scanned_code } = await request.json();

// ตรวจสอบว่า scanned_code ตรงกับ loadlist_code หรือไม่
if (scanned_code && scanned_code !== loadlist.loadlist_code) {
  return NextResponse.json(
    { error: 'Invalid QR code. Please scan the correct loadlist.' },
    { status: 400 }
  );
}
```

---


## 📈 สรุปการตรวจสอบ Consistency

### Inventory Balance vs Inventory Ledger

#### ✅ Trigger Sync ทำงานถูกต้อง
**Function:** `sync_inventory_ledger_to_balance()`  
**Migration:** 004_add_inventory_balance_sync_trigger.sql

**การทำงาน:**
1. เมื่อมี INSERT ลง `wms_inventory_ledger`
2. Trigger จะอัปเดต `wms_inventory_balances` อัตโนมัติ
3. ถ้า direction='in' → เพิ่มยอด
4. ถ้า direction='out' → ลดยอด

**ข้อสังเกต:**
- ✅ Trigger ทำงานถูกต้อง
- ✅ มีการ COALESCE สำหรับ NULL values
- ✅ ใช้ GREATEST(0, ...) เพื่อป้องกันค่าติดลบ

#### ⚠️ ปัญหาที่อาจเกิดขึ้น

**ปัญหา: Race Condition**
- ถ้ามีการ INSERT ledger หลายรายการพร้อมกัน
- อาจเกิด race condition ในการอัปเดต balance
- **แนวทางแก้ไข:** ใช้ Transaction หรือ Row-level Locking

**ปัญหา: Reserved Quantity**
- Trigger ไม่จัดการ `reserved_pack_qty` และ `reserved_piece_qty`
- ต้องอัปเดตแยกใน Application Code
- **สถานะปัจจุบัน:** ✅ มีการอัปเดตใน API แล้ว

---

## 🎯 แผนการดำเนินการ (Action Plan)

### Phase 1: แก้ไขเร่งด่วน (1-2 วัน)

| ลำดับ | งาน | ไฟล์ที่เกี่ยวข้อง | ผู้รับผิดชอบ |
|------|-----|------------------|-------------|
| 1 | สร้าง Mobile Pick API | `app/api/mobile/pick/scan/route.ts` | Backend Dev |
| 2 | สร้างหน้ารายละเอียด Picklist | `app/mobile/pick/[id]/page.tsx` | Frontend Dev |
| 3 | แก้ไข Triggers | `supabase/migrations/044_fix_loadlist_triggers.sql` | Database Dev |
| 4 | ทดสอบ Workflow ทั้งหมด | - | QA Team |

### Phase 2: แก้ไขสำคัญ (3-5 วัน)

| ลำดับ | งาน | ไฟล์ที่เกี่ยวข้อง | ผู้รับผิดชอบ |
|------|-----|------------------|-------------|
| 5 | แก้ไขการจองสต็อคให้จำกัด Location | `app/api/picklists/create-from-trip/route.ts`<br>`app/api/picklists/[id]/route.ts` | Backend Dev |
| 6 | เพิ่มการตรวจสอบสต็อคที่ Dispatch | `app/api/mobile/loading/complete/route.ts` | Backend Dev |
| 7 | ปรับปรุงการคำนวณ pack_qty | `app/api/mobile/loading/complete/route.ts` | Backend Dev |
| 8 | สร้าง Stock Alert System | `supabase/migrations/045_create_stock_alerts.sql` | Database Dev |

### Phase 3: ปรับปรุงเพิ่มเติม (1 สัปดาห์)

| ลำดับ | งาน | ไฟล์ที่เกี่ยวข้อง | ผู้รับผิดชอบ |
|------|-----|------------------|-------------|
| 9 | เปลี่ยนการจองสต็อคจาก pending → assigned | `app/api/picklists/create-from-trip/route.ts` | Backend Dev |
| 10 | เพิ่มการตรวจสอบ QR Code | `app/api/mobile/pick/scan/route.ts`<br>`app/api/mobile/loading/complete/route.ts` | Backend Dev |
| 11 | สร้าง Dashboard สำหรับ Monitor | `app/dashboard/inventory/page.tsx` | Frontend Dev |
| 12 | เขียน Unit Tests | `__tests__/` | QA Team |

---

## 📝 Checklist สำหรับการทดสอบ

### ✅ Picklist Creation
- [ ] สร้างใบหยิบจากแผนส่งที่อนุมัติแล้ว
- [ ] ตรวจสอบ picklist_code ถูกต้อง (PL-YYYYMMDD-XXX)
- [ ] ตรวจสอบ picklist_items มี source_location_id
- [ ] ตรวจสอบการจองสต็อคใน Inventory Balance
- [ ] ตรวจสอบ reserved_pack_qty และ reserved_piece_qty
- [ ] ตรวจสอบการสร้าง replenishment alerts (ถ้าสต็อคไม่พอ)

### ✅ Picklist Assignment
- [ ] เปลี่ยนสถานะเป็น 'assigned'
- [ ] ตรวจสอบ Orders เปลี่ยนเป็น 'in_picking'
- [ ] ตรวจสอบการจองสต็อค (ถ้ายังไม่เคยจอง)
- [ ] ตรวจสอบไม่มีการจองซ้ำ

### ✅ Picking Process (ต้องสร้าง API ใหม่)
- [ ] สแกน QR Code จากเอกสารใบหยิบ
- [ ] ตรวจสอบ scanned_code ตรงกับ picklist_code
- [ ] ลดยอดจองใน Inventory Balance (source_location)
- [ ] ลดสต็อคจริงจาก source_location
- [ ] เพิ่มสต็อคที่ Dispatch
- [ ] บันทึก Inventory Ledger (2 รายการ: OUT + IN)
- [ ] อัปเดต picklist_items (quantity_picked, status='picked')
- [ ] อัปเดต picklist status ('picking' หรือ 'completed')

### ✅ Loadlist Creation
- [ ] ดึงเฉพาะ picklists ที่ status='completed'
- [ ] สร้าง loadlist_code ถูกต้อง (LD-YYYYMMDD-####)
- [ ] เชื่อมโยง picklists ผ่าน wms_loadlist_picklists
- [ ] สถานะเริ่มต้นเป็น 'pending'

### ✅ Loading Process
- [ ] สแกน QR Code จากเอกสารใบโหลด
- [ ] ตรวจสอบ scanned_code ตรงกับ loadlist_code
- [ ] ตรวจสอบสต็อคที่ Dispatch เพียงพอ
- [ ] ลดสต็อคจาก Dispatch
- [ ] เพิ่มสต็อคที่ Delivery-In-Progress
- [ ] บันทึก Inventory Ledger (2 รายการ: OUT + IN)
- [ ] อัปเดต loaded_at ใน wms_loadlist_picklists
- [ ] อัปเดต loadlist status เป็น 'loaded'
- [ ] ตรวจสอบ Orders เปลี่ยนเป็น 'loaded' (ผ่าน Trigger)

### ✅ Inventory Consistency
- [ ] ตรวจสอบ Inventory Balance = sum(Ledger entries)
- [ ] ตรวจสอบ reserved_qty <= total_qty
- [ ] ตรวจสอบไม่มีค่าติดลบ
- [ ] ตรวจสอบ pack_qty สอดคล้องกับ piece_qty

---

## 🔍 SQL Queries สำหรับการตรวจสอบ

### ตรวจสอบ Inventory Balance vs Ledger

```sql
-- ตรวจสอบความสอดคล้องระหว่าง Balance และ Ledger
WITH ledger_summary AS (
  SELECT
    warehouse_id,
    location_id,
    sku_id,
    SUM(CASE WHEN direction = 'in' THEN piece_qty ELSE -piece_qty END) AS calculated_qty
  FROM wms_inventory_ledger
  GROUP BY warehouse_id, location_id, sku_id
),
balance_summary AS (
  SELECT
    warehouse_id,
    location_id,
    sku_id,
    total_piece_qty
  FROM wms_inventory_balances
)
SELECT
  COALESCE(l.warehouse_id, b.warehouse_id) AS warehouse_id,
  COALESCE(l.location_id, b.location_id) AS location_id,
  COALESCE(l.sku_id, b.sku_id) AS sku_id,
  l.calculated_qty AS ledger_qty,
  b.total_piece_qty AS balance_qty,
  COALESCE(l.calculated_qty, 0) - COALESCE(b.total_piece_qty, 0) AS difference
FROM ledger_summary l
FULL OUTER JOIN balance_summary b
  ON l.warehouse_id = b.warehouse_id
  AND l.location_id = b.location_id
  AND l.sku_id = b.sku_id
WHERE COALESCE(l.calculated_qty, 0) != COALESCE(b.total_piece_qty, 0)
ORDER BY ABS(COALESCE(l.calculated_qty, 0) - COALESCE(b.total_piece_qty, 0)) DESC;
```

### ตรวจสอบการจองสต็อค

```sql
-- ตรวจสอบว่า reserved_qty ไม่เกิน total_qty
SELECT
  warehouse_id,
  location_id,
  sku_id,
  total_piece_qty,
  reserved_piece_qty,
  total_piece_qty - reserved_piece_qty AS available_qty
FROM wms_inventory_balances
WHERE reserved_piece_qty > total_piece_qty
ORDER BY reserved_piece_qty - total_piece_qty DESC;
```

### ตรวจสอบ Picklist Status

```sql
-- ตรวจสอบ Picklists ที่มีปัญหา
SELECT
  p.id,
  p.picklist_code,
  p.status,
  COUNT(pi.id) AS total_items,
  COUNT(CASE WHEN pi.status = 'picked' THEN 1 END) AS picked_items,
  COUNT(CASE WHEN pi.status = 'pending' THEN 1 END) AS pending_items
FROM picklists p
LEFT JOIN picklist_items pi ON pi.picklist_id = p.id
WHERE p.status IN ('assigned', 'picking', 'completed')
GROUP BY p.id, p.picklist_code, p.status
HAVING
  (p.status = 'completed' AND COUNT(CASE WHEN pi.status != 'picked' THEN 1 END) > 0)
  OR (p.status = 'picking' AND COUNT(CASE WHEN pi.status = 'picked' THEN 1 END) = 0)
ORDER BY p.created_at DESC;
```

### ตรวจสอบ Stock Movement

```sql
-- ตรวจสอบการเคลื่อนไหวสต็อคของ Picklist
SELECT
  l.movement_at,
  l.transaction_type,
  l.direction,
  l.location_id,
  ml.location_code,
  l.sku_id,
  l.piece_qty,
  l.reference_no,
  l.remarks
FROM wms_inventory_ledger l
LEFT JOIN master_location ml ON ml.location_id = l.location_id
WHERE l.reference_no LIKE 'PL-%'
ORDER BY l.movement_at DESC, l.reference_no, l.direction
LIMIT 100;
```

---

## 📚 เอกสารอ้างอิง

### API Endpoints

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| POST | `/api/picklists/create-from-trip` | สร้างใบหยิบจากแผนส่ง | ✅ มีอยู่ |
| GET | `/api/picklists` | ดึงรายการใบหยิบ | ✅ มีอยู่ |
| GET | `/api/picklists/[id]` | ดึงรายละเอียดใบหยิบ | ✅ มีอยู่ |
| PATCH | `/api/picklists/[id]` | อัปเดตใบหยิบ (assign) | ✅ มีอยู่ |
| POST | `/api/picklists/[id]/complete` | ยืนยันการหยิบเสร็จ | ✅ มีอยู่ |
| POST | `/api/mobile/pick/scan` | สแกนและยืนยันการหยิบ | ❌ **ต้องสร้างใหม่** |
| GET | `/api/loadlists/available-picklists` | ดึง picklists ที่พร้อมโหลด | ✅ มีอยู่ |
| POST | `/api/loadlists` | สร้างใบโหลด | ✅ มีอยู่ |
| GET | `/api/loadlists` | ดึงรายการใบโหลด | ✅ มีอยู่ |
| POST | `/api/mobile/loading/complete` | ยืนยันการโหลดเสร็จ | ✅ มีอยู่ |

### Database Tables

| Table | Description | Status |
|-------|-------------|--------|
| `picklists` | ใบหยิบสินค้า | ✅ |
| `picklist_items` | รายการสินค้าในใบหยิบ | ✅ |
| `loadlists` | ใบโหลดสินค้า | ✅ |
| `wms_loadlist_picklists` | เชื่อม loadlist กับ picklist | ✅ |
| `wms_inventory_balances` | ยอดสต็อคคงเหลือ | ✅ |
| `wms_inventory_ledger` | ประวัติการเคลื่อนไหวสต็อค | ✅ |
| `master_location` | ข้อมูลโลเคชั่น | ✅ |
| `wms_orders` | ข้อมูลออเดอร์ | ✅ |

### Migrations

| Migration | Description | Status |
|-----------|-------------|--------|
| 001 | Full schema | ✅ |
| 004 | Inventory balance sync trigger | ✅ |
| 026 | Workflow status enums | ✅ |
| 027 | Workflow status triggers | ⚠️ ต้องแก้ไข |
| 038 | wms_loadlist_picklists table | ✅ |
| 042 | Dispatch & Delivery locations | ✅ |
| 043 | Simplify loadlist status | ✅ |
| 044 | Fix loadlist triggers | ❌ **ต้องสร้างใหม่** |

---

## ✅ สรุปผลการตรวจสอบ

### จุดแข็ง (Strengths)
1. ✅ Database schema ออกแบบดี มี Foreign Keys และ RLS ครบถ้วน
2. ✅ มี Triggers อัตโนมัติสำหรับ sync inventory
3. ✅ มีการจองสต็อคตามหลัก FEFO + FIFO
4. ✅ มีการย้ายสต็อคอัตโนมัติผ่าน Move Service
5. ✅ มี Locations พิเศษ (Dispatch, Delivery-In-Progress)

### จุดอ่อน (Weaknesses)
1. ❌ **ไม่มี Mobile Pick API** - ขาดขั้นตอนสำคัญในการหยิบสินค้า
2. ❌ **Triggers ไม่ทำงาน** - ใช้ตาราง loadlist_items ที่ไม่มีในระบบ
3. ⚠️ **การจองสต็อคไม่จำกัด Location** - อาจจองจาก location ผิด
4. ⚠️ **ไม่มีการตรวจสอบสต็อคที่ Dispatch** - อาจเกิดข้อมูลไม่สอดคล้อง

### คะแนนความสมบูรณ์ของ Workflow

| ขั้นตอน | คะแนน | หมายเหตุ |
|---------|-------|----------|
| 1. Picklist Creation | 85/100 | ⚠️ การจองสต็อคไม่จำกัด location |
| 2. Picklist Assignment | 90/100 | ✅ ทำงานถูกต้อง |
| 3. Picking Process | 20/100 | ❌ **ไม่มี API สำหรับสแกนและยืนยัน** |
| 4. Loadlist Creation | 95/100 | ✅ ทำงานถูกต้อง |
| 5. Loading Process | 75/100 | ⚠️ ไม่มีการตรวจสอบสต็อค |
| **รวม** | **73/100** | **ต้องแก้ไขเร่งด่วน** |

---

## 🎯 ข้อเสนอแนะสุดท้าย

### ความเร่งด่วนสูงสุด (Must Fix)
1. **สร้าง Mobile Pick API** - ไม่มีจะทำให้ระบบใช้งานไม่ได้
2. **แก้ไข Triggers** - สถานะ Orders ไม่อัปเดตอัตโนมัติ

### ควรแก้ไขโดยเร็ว (Should Fix)
3. **จำกัดการจองสต็อคตาม Location** - ป้องกันการจองผิด location
4. **เพิ่มการตรวจสอบสต็อค** - ป้องกันข้อมูลไม่สอดคล้อง

### แนะนำให้ปรับปรุง (Nice to Have)
5. **เปลี่ยนการจองสต็อค** - จองเมื่อ assigned แทน pending
6. **เพิ่มการตรวจสอบ QR Code** - เพิ่มความปลอดภัย

---

**จัดทำโดย:** Kiro AI Assistant  
**วันที่:** 28 พฤศจิกายน 2025  
**เวอร์ชัน:** 1.0

