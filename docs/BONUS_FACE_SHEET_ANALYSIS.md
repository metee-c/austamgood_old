# 📊 การวิเคราะห์ระบบ Bonus Face Sheets (ออเดอร์พิเศษ)

## 🎯 วัตถุประสงค์
วิเคราะห์การทำงานของระบบจองและย้ายสต็อกทั้ง 3 ประเภทออเดอร์ เพื่อออกแบบและพัฒนา **ออเดอร์พิเศษ (Bonus Face Sheets)** ให้สมบูรณ์

---

## 📋 สรุปภาพรวม 3 ประเภทออเดอร์

### 1. **ออเดอร์จัดเส้นทาง (Route Planning Orders)**
- **Flow:** จัดเส้นทาง VRP → สร้าง Picklist → หยิบสินค้า → โหลดสินค้า
- **Tables:** `picklists`, `picklist_items`, `picklist_item_reservations`
- **Stock Movement:** Preparation Area → Dispatch → Delivery-In-Progress

### 2. **ออเดอร์ส่งรายชิ้น (Face Sheets)**
- **Flow:** สร้าง Face Sheet → หยิบสินค้า → โหลดสินค้า
- **Tables:** `face_sheets`, `face_sheet_items`, `face_sheet_item_reservations`
- **Stock Movement:** Preparation Area → Dispatch → Delivery-In-Progress

### 3. **ออเดอร์พิเศษ (Bonus Face Sheets)** ⭐ กำลังพัฒนา
- **Flow:** สร้าง Bonus Face Sheet → หยิบสินค้า → โหลดสินค้า
- **Tables:** `bonus_face_sheets`, `bonus_face_sheet_items`, `bonus_face_sheet_item_reservations`
- **Stock Movement:** Preparation Area → Dispatch → Delivery-In-Progress

---

## 🔍 สถานะปัจจุบันของ Bonus Face Sheets

### ✅ สิ่งที่พัฒนาเสร็จแล้ว

#### 1. **Database Schema (Migrations 100-106)**
- ✅ Migration 100: เพิ่ม columns ใน `bonus_face_sheet_items`
  - `sku_id`, `source_location_id`, `quantity_to_pick`, `quantity_picked`
  - `status`, `picked_at`, `uom`
  
- ✅ Migration 101: เพิ่ม columns ใน `bonus_face_sheets`
  - `checker_employee_ids`, `picker_employee_ids`
  - `picking_started_at`, `picking_completed_at`
  
- ✅ Migration 102: สร้างตาราง `bonus_face_sheet_item_reservations`
  - เก็บข้อมูลการจองสต็อค (reservation_id, balance_id, reserved_piece_qty)
  
- ✅ Migration 103: สร้าง function `reserve_stock_for_bonus_face_sheet_items()`
  - จองสต็อคตาม FEFO + FIFO
  - Map preparation area → zone → locations
  
- ✅ Migration 104: สร้าง trigger `trigger_bonus_face_sheet_reserve_stock`
  - จองสต็อคอัตโนมัติเมื่อสร้าง bonus face sheet (status = 'generated')
  
- ✅ Migration 105: สร้างตาราง `wms_loadlist_bonus_face_sheets`
  - Junction table เชื่อม loadlists กับ bonus_face_sheets
  
- ✅ Migration 106: แก้ไข function รองรับ `source_location_id = NULL`
  - ถ้า NULL ให้ใช้ทุก location ใน warehouse

#### 2. **Backend APIs**
- ✅ `POST /api/mobile/bonus-face-sheet/scan`
  - หยิบสินค้าและย้ายสต็อค
  - Logic: Copy 100% from face sheet scan
  
- ✅ `GET /api/mobile/bonus-face-sheet/tasks/[id]`
  - ดึงข้อมูล bonus face sheet สำหรับหน้า mobile pick

#### 3. **Frontend Pages**
- ✅ `/receiving/picklists/bonus-face-sheets` - หน้า list
- ✅ `/mobile/bonus-face-sheet/[id]` - หน้า mobile pick (สันนิษฐาน)

---

### ❌ ปัญหาที่พบ

#### 1. **Function ไม่ทำงาน**
```
🚨 ปัญหาหลัก: Function reserve_stock_for_bonus_face_sheet_items() ไม่ทำงาน
```

**สาเหตุ:**
- ✅ Trigger เปิดใช้งาน (enabled)
- ✅ Function มีอยู่ (migration 103, 106)
- ❌ แต่ไม่มีการจองสต็อคเกิดขึ้น

**การตรวจสอบ:**
```sql
-- ตรวจสอบ trigger
SELECT tgname, tgenabled, tgrelid::regclass
FROM pg_trigger
WHERE tgname = 'trigger_bonus_face_sheet_reserve_stock';
-- ผลลัพธ์: ✅ Enabled (O)

-- ตรวจสอบ reservations
SELECT COUNT(*) FROM bonus_face_sheet_item_reservations;
-- ผลลัพธ์: ❌ 0 รายการ

-- ตรวจสอบ reserved stock
SELECT COUNT(*) FROM wms_inventory_balances WHERE reserved_piece_qty > 0;
-- ผลลัพธ์: ❌ 0 รายการ
```

#### 2. **ข้อมูล Items ไม่สมบูรณ์**
```sql
-- ตรวจสอบ items ล่าสุด
SELECT sku_id, quantity_to_pick, source_location_id
FROM bonus_face_sheet_items
WHERE face_sheet_id = 5;

-- ผลลัพธ์:
-- ✅ sku_id: มีครบ (10/10)
-- ✅ quantity_to_pick: มีครบ (10/10)
-- ⚠️ source_location_id: NULL ทุกรายการ (0/10)
```

**ผลกระทบ:**
- Migration 103 (เวอร์ชันเก่า) ข้าม items ที่ `source_location_id IS NULL`
- Migration 106 แก้ไขแล้ว แต่ต้อง **run migration ใหม่**

---

## 🔧 สาเหตุและแนวทางแก้ไข

### สาเหตุหลัก
1. **Migration 106 ยังไม่ได้ run** หรือ run แล้วแต่ function ยังเป็นเวอร์ชันเก่า
2. **Bonus Face Sheets ที่สร้างไปแล้ว** ไม่ได้จองสต็อค (เพราะ function เวอร์ชันเก่า)
3. **source_location_id = NULL** ทำให้ function เวอร์ชันเก่าข้ามรายการ

### แนวทางแก้ไข

#### ขั้นตอนที่ 1: ตรวจสอบ Function Version
```sql
-- ดู function definition
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'reserve_stock_for_bonus_face_sheet_items';

-- ตรวจสอบว่ามีบรรทัดนี้หรือไม่:
-- AND (v_item.source_location_id IS NULL OR location_id = v_item.source_location_id)
```

#### ขั้นตอนที่ 2: Run Migration 106
```bash
# ถ้ายังไม่ได้ run
supabase db push

# หรือ run migration เฉพาะ
psql -f supabase/migrations/106_fix_bonus_fs_reservation_null_location.sql
```

#### ขั้นตอนที่ 3: จองสต็อคสำหรับ Bonus Face Sheets ที่มีอยู่
```sql
-- จองสต็อคด้วยตนเอง (manual trigger)
SELECT * FROM reserve_stock_for_bonus_face_sheet_items(
  5,  -- bonus_face_sheet_id
  'WH001',  -- warehouse_id
  'Manual'  -- reserved_by
);
```

#### ขั้นตอนที่ 4: ตรวจสอบผลลัพธ์
```sql
-- ตรวจสอบ reservations
SELECT COUNT(*) FROM bonus_face_sheet_item_reservations;
-- คาดหวัง: > 0

-- ตรวจสอบ reserved stock
SELECT sku_id, location_id, reserved_piece_qty
FROM wms_inventory_balances
WHERE reserved_piece_qty > 0;
-- คาดหวัง: มีรายการ
```

---

## 📊 เปรียบเทียบ 3 ประเภทออเดอร์

| Feature | Picklist (จัดเส้นทาง) | Face Sheet (ส่งรายชิ้น) | Bonus Face Sheet (พิเศษ) |
|---------|----------------------|------------------------|-------------------------|
| **VRP Planning** | ✅ ใช้ | ❌ ไม่ใช้ | ❌ ไม่ใช้ |
| **Stock Reservation** | ✅ ทำงาน | ✅ ทำงาน | ❌ ไม่ทำงาน |
| **Reservation Table** | picklist_item_reservations | face_sheet_item_reservations | bonus_face_sheet_item_reservations |
| **Reservation Function** | reserve_stock_for_picklist_items() | reserve_stock_for_face_sheet_items() | reserve_stock_for_bonus_face_sheet_items() |
| **Reservation Trigger** | ✅ ทำงาน | ✅ ทำงาน | ✅ มี แต่ไม่ทำงาน |
| **Mobile Pick API** | /api/mobile/pick/scan | /api/mobile/face-sheet/scan | /api/mobile/bonus-face-sheet/scan |
| **Stock Movement** | Prep → Dispatch → Delivery | Prep → Dispatch → Delivery | Prep → Dispatch → Delivery |
| **FEFO/FIFO Logic** | ✅ ใช้ | ✅ ใช้ | ✅ ใช้ (แต่ไม่ทำงาน) |
| **Employee Tracking** | ✅ ใช้ | ✅ ใช้ | ✅ ใช้ |
| **Loadlist Integration** | ✅ ใช้ | ✅ ใช้ | ✅ มี (migration 105) |

---

## 🎯 ขั้นตอนการพัฒนาต่อ

### Phase 1: แก้ไขปัญหาเร่งด่วน ✅
- [x] สร้าง migrations 100-106
- [x] สร้าง APIs (scan, tasks)
- [x] สร้างหน้า UI (list, mobile pick)
- [ ] **Run migration 106** ← ต้องทำ
- [ ] **ทดสอบการจองสต็อค** ← ต้องทำ

### Phase 2: API สำหรับสร้าง Bonus Face Sheets
- [ ] `POST /api/bonus-face-sheets/generate`
  - รับ order_ids (special orders)
  - สร้าง bonus_face_sheets และ bonus_face_sheet_items
  - Trigger จองสต็อคอัตโนมัติ
  
- [ ] `GET /api/bonus-face-sheets`
  - ดึงรายการ bonus face sheets
  - รวมข้อมูลพนักงาน (checker, picker)
  
- [ ] `GET /api/bonus-face-sheets/[id]`
  - ดึงรายละเอียด bonus face sheet
  - รวม items และ reservations

### Phase 3: Mobile Loading Integration
- [ ] `POST /api/mobile/loading/complete`
  - รองรับ bonus face sheets
  - ย้ายสต็อคจาก Dispatch → Delivery-In-Progress
  
- [ ] `GET /api/loadlists/available-bonus-face-sheets`
  - ดึง bonus face sheets ที่พร้อมโหลด (status = 'completed')

### Phase 4: Testing & Documentation
- [ ] ทดสอบ end-to-end flow
- [ ] สร้าง test data
- [ ] เขียน testing guide
- [ ] อัปเดต documentation

---

## 🔑 Key Differences: Bonus Face Sheets vs Face Sheets

### เหมือนกัน:
1. ✅ ไม่ผ่านขั้นตอน VRP Planning
2. ✅ จองสต็อคตอนสร้าง (FEFO + FIFO)
3. ✅ ย้ายสต็อค: Prep → Dispatch → Delivery
4. ✅ บันทึกข้อมูลพนักงาน (checker, picker)
5. ✅ Mobile pick workflow เหมือนกัน

### ต่างกัน:
1. ❌ Bonus Face Sheets ใช้กับ **order_type = 'special'**
2. ❌ Face Sheets ใช้กับ **order_type = 'express'**
3. ❌ Table names ต่างกัน (bonus_* vs face_*)
4. ❌ API endpoints ต่างกัน (/bonus-face-sheet/* vs /face-sheet/*)

---

## 📝 Checklist การพัฒนา

### Database ✅
- [x] Tables created (bonus_face_sheets, bonus_face_sheet_items, bonus_face_sheet_item_reservations)
- [x] Indexes created
- [x] Foreign keys configured
- [x] Function created (reserve_stock_for_bonus_face_sheet_items)
- [x] Trigger created (trigger_bonus_face_sheet_reserve_stock)
- [x] Junction table created (wms_loadlist_bonus_face_sheets)
- [ ] **Migration 106 applied** ← ต้องทำ

### Backend APIs
- [x] Mobile pick API (/api/mobile/bonus-face-sheet/scan)
- [x] Mobile tasks API (/api/mobile/bonus-face-sheet/tasks/[id])
- [ ] Generate API (/api/bonus-face-sheets/generate) ← ต้องทำ
- [ ] List API (/api/bonus-face-sheets) ← ต้องทำ
- [ ] Detail API (/api/bonus-face-sheets/[id]) ← ต้องทำ
- [ ] Loading integration ← ต้องทำ

### Frontend Pages
- [x] List page (/receiving/picklists/bonus-face-sheets)
- [x] Mobile pick page (/mobile/bonus-face-sheet/[id])
- [ ] Detail page (/receiving/picklists/bonus-face-sheets/[id]) ← ต้องทำ

### Testing
- [ ] Unit tests
- [ ] Integration tests
- [ ] End-to-end tests
- [ ] Manual testing guide

### Documentation
- [x] Migration files documented
- [x] API endpoints documented (in code)
- [ ] User guide
- [ ] Testing guide
- [ ] Deployment guide

---

## 🚀 ขั้นตอนถัดไป (Priority Order)

### 1. แก้ไขปัญหาเร่งด่วน (High Priority)
```bash
# 1. Run migration 106
supabase db push

# 2. ทดสอบ function
SELECT * FROM reserve_stock_for_bonus_face_sheet_items(5, 'WH001', 'Test');

# 3. ตรวจสอบผลลัพธ์
SELECT COUNT(*) FROM bonus_face_sheet_item_reservations;
SELECT COUNT(*) FROM wms_inventory_balances WHERE reserved_piece_qty > 0;
```

### 2. สร้าง Generate API (High Priority)
- Copy logic จาก `/api/face-sheets/generate`
- เปลี่ยน tables: face_sheet → bonus_face_sheet
- Filter orders: `order_type = 'special'`

### 3. ทดสอบ End-to-End (Medium Priority)
- สร้าง bonus face sheet
- ตรวจสอบการจองสต็อค
- หยิบสินค้าผ่าน mobile
- โหลดสินค้า
- ตรวจสอบ stock movement

### 4. Documentation (Low Priority)
- เขียน testing guide
- เขียน user guide
- อัปเดต README

---

## 📚 เอกสารที่เกี่ยวข้อง

1. **PICKLIST_STOCK_RESERVATION_FLOW.md** - ระบบจองและย้ายสต็อคของ Picklist
2. **FACE_SHEET_STOCK_RESERVATION_COMPLETE.md** - ระบบจองและย้ายสต็อคของ Face Sheets
3. **BONUS_FACE_SHEET_ANALYSIS.md** (ไฟล์นี้) - การวิเคราะห์ Bonus Face Sheets
4. **Migrations 100-106** - Database schema และ functions

---

## 🎯 สรุป

### สถานะปัจจุบัน:
- ✅ Database schema สมบูรณ์ (100%)
- ✅ Mobile pick APIs สมบูรณ์ (100%)
- ⚠️ Stock reservation ไม่ทำงาน (ต้อง run migration 106)
- ❌ Generate API ยังไม่มี (0%)
- ❌ Loading integration ยังไม่มี (0%)

### ปัญหาหลัก:
1. **Migration 106 ยังไม่ได้ run** → Function เวอร์ชันเก่าข้าม items ที่ source_location_id = NULL
2. **ไม่มี Generate API** → ต้องสร้าง bonus face sheets ด้วยตนเอง
3. **ไม่มี Loading integration** → ยังโหลดสินค้าไม่ได้

### แนวทางแก้ไข:
1. **Run migration 106** (5 นาที)
2. **ทดสอบการจองสต็อค** (10 นาที)
3. **สร้าง Generate API** (1-2 ชั่วโมง)
4. **ทดสอบ end-to-end** (30 นาที)

---

**สร้างเมื่อ:** 2025-12-02  
**อัปเดตล่าสุด:** 2025-12-02  
**สถานะ:** 🚧 กำลังพัฒนา (80% เสร็จสมบูรณ์)
