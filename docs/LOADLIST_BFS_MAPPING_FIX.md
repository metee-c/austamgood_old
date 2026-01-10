# รายงานการแก้ไข: Loadlist BFS Mapping

## สรุปการแก้ไข

แก้ไขระบบ Loadlists ให้รองรับ Business Logic ใหม่สำหรับ Bonus Face Sheet (BFS) ตามที่ระบุใน `docs/edit01.md`

---

## 1. Database Migration

**ไฟล์:** `supabase/migrations/196_add_mapping_columns_to_loadlist_bonus_face_sheets.sql`

เพิ่ม columns ใหม่ใน `wms_loadlist_bonus_face_sheets`:
- `mapped_picklist_id` - FK → picklists (nullable)
- `mapped_face_sheet_id` - FK → face_sheets (nullable)
- `matched_package_ids` - JSONB เก็บ IDs ของ packages ที่ customer_id ตรงกัน
- `mapping_type` - varchar('picklist' หรือ 'face_sheet')

**Constraint:** `chk_exclusive_mapping` - บังคับให้เลือกได้แค่อย่างเดียว

---

## 2. API ใหม่: Check Matching

**ไฟล์:** `app/api/bonus-face-sheets/check-matching/route.ts`

**Endpoint:** `POST /api/bonus-face-sheets/check-matching`

**Request:**
```json
{
  "bonus_face_sheet_id": 123,
  "picklist_id": 456,      // หรือ
  "face_sheet_id": 789     // เลือกอย่างใดอย่างหนึ่ง
}
```

**Response:**
```json
{
  "success": true,
  "matched": true,
  "matched_count": 5,
  "total_bfs_packages": 10,
  "matched_package_ids": [1, 2, 3, 4, 5],
  "matched_customer_ids": ["B2404003", "B2205718"],
  "mapping_type": "picklist",
  "message": "พบ 5 packages ที่ตรงกัน จาก 10 packages ทั้งหมด"
}
```

---

## 3. แก้ไข API: POST /api/loadlists

**ไฟล์:** `app/api/loadlists/route.ts`

**การเปลี่ยนแปลง:**
1. รองรับ `bonus_face_sheet_mappings` array ที่มี `bonus_face_sheet_id`, `picklist_id`, `face_sheet_id`
2. ตรวจสอบ exclusive mapping (ไม่ให้เลือกทั้ง Picklist และ Face Sheet พร้อมกัน)
3. ดึง customer_ids จาก BFS packages และเปรียบเทียบกับ target
4. บันทึก `matched_package_ids` ลง database
5. Return error ถ้าไม่มี customer_id ตรงกัน

---

## 4. แก้ไข Frontend: Loadlists Page

**ไฟล์:** `app/receiving/loadlists/page.tsx`

### 4.1 Exclusive Dropdown Selection
- เมื่อเลือก Picklist → Face Sheet dropdown จะ disabled และ clear ค่า
- เมื่อเลือก Face Sheet → Picklist dropdown จะ disabled และ clear ค่า
- แสดง visual feedback (สีเทา) เมื่อ dropdown ถูก disabled

### 4.2 Pre-validation ก่อนสร้าง Loadlist
- ตรวจสอบว่าเลือกผู้เช็คโหลดแล้ว
- ตรวจสอบว่าเลือก Picklist หรือ Face Sheet อย่างใดอย่างหนึ่ง
- เรียก `/api/bonus-face-sheets/check-matching` เพื่อตรวจสอบ customer_id matching
- แสดง error message ถ้าไม่มี customer_id ตรงกัน

### 4.3 ✅ NEW: Preview จำนวน Packages ที่จะ Match
- เมื่อเลือก Picklist หรือ Face Sheet จะเรียก check-matching API อัตโนมัติ
- แสดงผลลัพธ์ใต้ dropdown: `✓ 5/10 แพ็ค` (สีเขียว) หรือ `✗ ไม่พบรายการที่ตรงกัน` (สีแดง)
- แสดง loading indicator ขณะตรวจสอบ

---

## 5. ✅ NEW: แก้ไข API: GET /api/bonus-face-sheets/print

**ไฟล์:** `app/api/bonus-face-sheets/print/route.ts`

**การเปลี่ยนแปลง:**
1. รองรับ parameter `picklist_id` สำหรับกรองตาม customer_id matching
2. รองรับ parameter `face_sheet_id` สำหรับกรองตาม customer_id matching
3. แสดงหัวเอกสารตาม mapping_type:
   - แมพกับใบหยิบ: แสดง `BFS-XXXXX / PL-XXXXX` (สีน้ำเงิน)
   - แมพกับใบปะหน้า: แสดง `BFS-XXXXX / FS-XXXXX` (สีส้ม)
4. แสดงจำนวนลูกค้าที่ตรงกัน

---

## 6. ✅ Validation ที่หน้า Mobile Loading สำหรับ BFS

**ไฟล์:** `app/api/mobile/loading/complete/route.ts`

**มีอยู่แล้ว:** API ตรวจสอบว่า packages ที่มี trip_number ได้ถูกย้ายไป staging (PQTD/MRTD) แล้วหรือยัง
- ถ้ายังไม่ได้ย้าย → Return error: `กรุณากด "ยืนยันหยิบไปพักรอโหลด" ก่อนยืนยันโหลด`

---

## 7. Flow การทำงานใหม่

```
1. User เลือก BFS ที่ต้องการ (checkbox)
2. User เลือก Picklist หรือ Face Sheet (dropdown - exclusive)
   - ถ้าเลือก Picklist → Face Sheet dropdown disabled
   - ถ้าเลือก Face Sheet → Picklist dropdown disabled
   - ✅ NEW: แสดง preview จำนวน packages ที่จะ match ทันที
3. User เลือกผู้เช็คโหลด
4. User กดปุ่ม "สร้างใบโหลด"
5. Frontend เรียก check-matching API
   - ถ้า matched = false → แสดง error, ไม่สร้าง loadlist
   - ถ้า matched = true → ดำเนินการต่อ
6. Frontend เรียก POST /api/loadlists
7. API สร้าง loadlist และบันทึก mapping data
8. แสดงผลสำเร็จ
```

---

## 8. Checklist ที่ทำเสร็จแล้ว

### Frontend:
- [x] แก้ไข UI dropdown ให้ exclusive (เลือกได้แค่อย่างเดียว)
- [x] เพิ่ม validation ก่อนสร้าง loadlist (ตรวจสอบ customer_id matching)
- [x] แสดง error message ถ้าไม่มี customer_id ตรงกัน
- [x] ✅ NEW: แสดง preview จำนวน packages ที่จะ match ใน UI

### Backend:
- [x] แก้ไข POST /api/loadlists สำหรับ BFS
- [x] เพิ่ม customer_id matching logic
- [x] เพิ่ม API check-matching
- [x] ✅ NEW: แก้ไข GET /api/bonus-face-sheets/print ให้แสดงตาม mapping_type

### Database:
- [x] เพิ่ม columns ใน wms_loadlist_bonus_face_sheets
- [x] เพิ่ม constraint exclusive mapping

### Mobile:
- [x] Validation ที่หน้า mobile/loading สำหรับ BFS (มีอยู่แล้วใน API)

---

## 9. ตัวอย่างการใช้งาน

### กรณีที่ 1: แมพ BFS กับ Picklist
```
BFS-001 มี packages:
- Package 1: customer_id = "B2404003"
- Package 2: customer_id = "B2205718"
- Package 3: customer_id = "B2507014"

Picklist PL-001 มี orders:
- Order 1: customer_id = "B2404003"
- Order 2: customer_id = "B2205718"

ผลลัพธ์: matched_packages = [Package 1, Package 2]
UI แสดง: ✓ 2/3 แพ็ค
```

### กรณีที่ 2: ไม่มี customer_id ตรงกัน
```
BFS-002 มี packages:
- Package 1: customer_id = "B9999999"

Picklist PL-002 มี orders:
- Order 1: customer_id = "B1111111"

ผลลัพธ์: Error "ไม่พบรหัสลูกค้าที่ตรงกัน"
UI แสดง: ✗ ไม่พบรายการที่ตรงกัน
```

---

*อัปเดตเมื่อ: 10 มกราคม 2569*
