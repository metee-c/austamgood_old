# ภารกิจ: แก้ไขระบบ Loadlists ให้ทำงานถูกต้องตาม Business Logic

## บริบท
หน้า `/receiving/loadlists` เป็นระบบจัดการใบโหลดสินค้า ปัจจุบันมีปัญหาหลักคือ **การสร้าง Loadlist จาก Bonus Face Sheet (BFS)** ยังทำงานไม่ถูกต้องตาม Business Logic ที่ต้องการ

## สิ่งที่ต้องแก้ไข

---

### 1. การแมพ Bonus Face Sheet กับ Picklist/Face Sheet

#### ปัญหาปัจจุบัน:
- ระบบให้เลือกแมพ BFS กับ Picklist หรือ Face Sheet แบบ manual โดยไม่ได้ตรวจสอบความสัมพันธ์

#### สิ่งที่ต้องการ:
**การแมพต้องอิงจาก "รหัสลูกค้า" (Customer ID) ที่ตรงกัน**

##### กรณีแมพกับ Picklist:
1. ดึง packages ทั้งหมดจาก BFS ที่เลือก
2. ดึง orders ทั้งหมดจาก Picklist ที่เลือก
3. เปรียบเทียบ `customer_id` ของ packages ใน BFS กับ `customer_id` ของ orders ใน Picklist
4. **เอาเฉพาะ packages ที่ customer_id ตรงกันเท่านั้น** มาสร้าง loadlist
5. ถ้าไม่มี customer_id ตรงกันเลย → แจ้งเตือนว่าไม่สามารถสร้างได้

##### กรณีแมพกับ Face Sheet:
1. ดึง packages ทั้งหมดจาก BFS ที่เลือก
2. ดึง packages/orders ทั้งหมดจาก Face Sheet ที่เลือก
3. เปรียบเทียบ `customer_id` ของ packages ใน BFS กับ `customer_id` ของ orders ใน Face Sheet
4. **เอาเฉพาะ packages ที่ customer_id ตรงกันเท่านั้น** มาสร้าง loadlist
5. ถ้าไม่มี customer_id ตรงกันเลย → แจ้งเตือนว่าไม่สามารถสร้างได้

---

### 2. UI ฟอร์มเลือก Bonus Face Sheet - บังคับเลือกได้แค่อย่างเดียว

#### ปัญหาปัจจุบัน:
- สามารถเลือกทั้ง Picklist และ Face Sheet พร้อมกันได้

#### สิ่งที่ต้องการ:
**ต้องเลือกได้เพียงอย่างเดียว (Exclusive Selection)**

##### Logic:
```
ถ้าเลือก Picklist ในคอลัมน์แรก:
  → Dropdown ของ Face Sheet ต้อง disabled ทันที
  → Clear ค่า Face Sheet ที่เคยเลือก (ถ้ามี)

ถ้าเลือก Face Sheet ในคอลัมน์ที่สอง:
  → Dropdown ของ Picklist ต้อง disabled ทันที
  → Clear ค่า Picklist ที่เคยเลือก (ถ้ามี)

ถ้ายกเลิกการเลือก (เปลี่ยนเป็นค่าว่าง):
  → Enable อีกคอลัมน์กลับมา
```

##### UI ที่ต้องการ:
| เลือก BFS | Picklist (Dropdown) | Face Sheet (Dropdown) |
|-----------|---------------------|----------------------|
| ☑️ BFS-001 | [เลือก Picklist ▼] | [Disabled] |
| ☑️ BFS-002 | [Disabled] | [เลือก Face Sheet ▼] |
| ☑️ BFS-003 | [เลือก...] | [เลือก...] ← ยังไม่เลือกอะไร |

---

### 3. ข้อมูลที่ต้องกรอกเมื่อสร้าง Loadlist จาก BFS

#### Required Fields:
1. **ผู้เช็คโหลด** (checker_employee_id) - Dropdown เลือกพนักงาน
2. **ประเภทรถ** (vehicle_type) - Dropdown หรือ Input
3. **เลขงานจัดส่ง** (delivery_number) - Auto-generate หรือ Input
4. **เอกสารที่แมพ** - Picklist หรือ Face Sheet (อย่างใดอย่างหนึ่ง ตามข้อ 2)

#### Optional Fields:
- ทะเบียนรถ (vehicle_id)
- คนขับ (driver_employee_id)
- ประตูโหลด (loading_door_number)
- คิว (loading_queue_number)

---

### 4. Logic การสร้าง Loadlist จาก BFS
```
1. User เลือก BFS ที่ต้องการ (checkbox)
2. User เลือก Picklist หรือ Face Sheet ที่จะแมพ (dropdown - exclusive)
3. ระบบตรวจสอบ customer_id ที่ตรงกัน:
   
   IF แมพกับ Picklist:
     matched_packages = BFS.packages.filter(pkg => 
       Picklist.orders.some(order => order.customer_id === pkg.customer_id)
     )
   
   IF แมพกับ Face Sheet:
     matched_packages = BFS.packages.filter(pkg => 
       FaceSheet.packages.some(fsPkg => fsPkg.customer_id === pkg.customer_id)
     )

4. IF matched_packages.length === 0:
     → แสดง Error: "ไม่พบรหัสลูกค้าที่ตรงกัน ไม่สามารถสร้างใบโหลดได้"
     → ไม่สร้าง loadlist

5. IF matched_packages.length > 0:
     → สร้าง loadlist ด้วย matched_packages เท่านั้น
     → บันทึกข้อมูลการแมพ (mapped_picklist_id หรือ mapped_face_sheet_id)
     → บันทึก matched_package_ids
```

---

### 5. การพิมพ์เอกสาร Loadlist จาก BFS

#### สิ่งที่ต้องการ:
**ฟอร์มปริ้นต้องแยกตามประเภทเอกสารที่แมพ**

##### กรณีแมพกับ Picklist:
- หัวเอกสารแสดง: `BFS-XXXXX / PL-XXXXX`
- แสดงเฉพาะ packages ที่ customer_id ตรงกับ Picklist นั้น
- แสดงข้อมูล Picklist: รหัส, สายรถ, เที่ยว, จำนวน orders

##### กรณีแมพกับ Face Sheet:
- หัวเอกสารแสดง: `BFS-XXXXX / FS-XXXXX`
- แสดงเฉพาะ packages ที่ customer_id ตรงกับ Face Sheet นั้น
- แสดงข้อมูล Face Sheet: รหัส, วันที่ส่ง, จำนวน packages

---

### 6. Flow การย้ายสต็อก (Inventory Movement)

#### สร้าง Loadlist จาก Picklist หรือ Face Sheet:
```
สถานะ: Dispatch → Delivery-In-Progress
วิธีการ: ยืนยันโหลดที่หน้า /mobile/loading/{loadlist_code}
```

#### สร้าง Loadlist จาก Bonus Face Sheet:
```
ขั้นตอนที่ 1: กดปุ่ม "ยืนยันหยิบไปจุดรอพักโหลด"
  - ย้ายสต็อก: PQ01-PQ10 → PQTD
  - ย้ายสต็อก: MR01-MR10 → MRTD
  - ย้ายทั้ง package (ไม่ใช่แค่บาง items)
  - อัปเดต storage_location ของ package

ขั้นตอนที่ 2: ยืนยันโหลดที่หน้า /mobile/loading/{loadlist_code}
  - ต้องผ่านขั้นตอนที่ 1 ก่อนถึงจะทำได้
  - ย้ายสต็อก: PQTD/MRTD → Delivery-In-Progress
```

**สำคัญ:** ถ้ายังไม่ผ่านขั้นตอนที่ 1 → หน้า mobile/loading ต้องแสดงข้อความว่า "กรุณายืนยันหยิบไปจุดรอพักโหลดก่อน"

---

### 7. Database Schema ที่เกี่ยวข้อง (ตรวจสอบและแก้ไขถ้าจำเป็น)

#### ตาราง wms_loadlist_bonus_face_sheets:
อาจต้องเพิ่ม columns:
```sql
- mapped_picklist_id (integer, nullable) -- FK → picklists
- mapped_face_sheet_id (integer, nullable) -- FK → face_sheets
- matched_package_ids (jsonb หรือ text[]) -- IDs ของ packages ที่ match
- mapping_type (varchar) -- 'picklist' หรือ 'face_sheet'
```

#### CHECK constraint:
```sql
-- บังคับให้เลือกได้แค่อย่างเดียว
CHECK (
  (mapped_picklist_id IS NOT NULL AND mapped_face_sheet_id IS NULL) OR
  (mapped_picklist_id IS NULL AND mapped_face_sheet_id IS NOT NULL)
)
```

---

### 8. API Endpoints ที่ต้องแก้ไข

#### POST /api/loadlists (สร้าง loadlist)
- เพิ่ม logic ตรวจสอบ customer_id matching
- บันทึก mapping_type และ matched_package_ids
- Return error ถ้าไม่มี customer_id ตรงกัน

#### GET /api/loadlists/available-bonus-face-sheets
- เพิ่มข้อมูล customer_ids ของแต่ละ BFS
- ช่วยให้ frontend แสดง preview ว่าจะ match กับอะไรได้บ้าง

#### GET /api/bonus-face-sheets/check-matching
(API ใหม่ - optional)
```
Request: { bfs_id, picklist_id หรือ face_sheet_id }
Response: { 
  matched: true/false, 
  matched_count: 5,
  matched_package_ids: [...],
  matched_customer_ids: [...]
}
```

#### GET /api/bonus-face-sheets/print
- แก้ไขให้แสดงข้อมูลตาม mapping_type
- แสดงเฉพาะ matched packages

---

### 9. สรุป Checklist การแก้ไข

#### Frontend (page.tsx):
- [ ] แก้ไข UI dropdown ให้ exclusive (เลือกได้แค่อย่างเดียว)
- [ ] เพิ่ม validation ก่อนสร้าง loadlist (ตรวจสอบ customer_id matching)
- [ ] แสดง preview จำนวน packages ที่จะ match
- [ ] แสดง error message ถ้าไม่มี customer_id ตรงกัน
- [ ] แก้ไขการพิมพ์เอกสารตาม mapping type

#### Backend (API routes):
- [ ] แก้ไข POST /api/loadlists สำหรับ BFS
- [ ] เพิ่ม customer_id matching logic
- [ ] แก้ไข GET /api/bonus-face-sheets/print
- [ ] เพิ่ม API check-matching (optional)

#### Database:
- [ ] ตรวจสอบ/เพิ่ม columns ใน wms_loadlist_bonus_face_sheets
- [ ] เพิ่ม constraint ถ้าจำเป็น

---

### 10. ลำดับการทำงาน

1. **อ่านและทำความเข้าใจ** code ปัจจุบันทั้งหมดก่อน
2. **ตรวจสอบ database schema** ว่ามี columns ที่จำเป็นครบไหม
3. **แก้ไข API** ให้รองรับ logic ใหม่
4. **แก้ไข Frontend** ให้ UI ทำงานถูกต้อง
5. **ทดสอบ** ทุก flow ที่แก้ไข
6. **รายงานผล** สิ่งที่แก้ไขทั้งหมด

---

## คำสั่งค้นหาไฟล์ที่เกี่ยวข้อง
```bash
# ไฟล์หลัก
find . -path "*/receiving/loadlists/*" -name "*.tsx"
find . -path "*/api/loadlists/*" -name "*.ts"
find . -path "*/api/bonus-face-sheets/*" -name "*.ts"

# ค้นหา customer_id
grep -r "customer_id" --include="*.ts" --include="*.tsx" ./app

# ค้นหา mapping logic
grep -r "mapping" --include="*.ts" --include="*.tsx" ./app/receiving/loadlists
grep -r "mapping" --include="*.ts" ./app/api/loadlists
```

## MCP Database Commands
```sql
-- ดูโครงสร้าง tables ที่เกี่ยวข้อง
\d loadlists
\d wms_loadlist_bonus_face_sheets
\d bonus_face_sheets
\d bonus_face_sheet_packages

-- ดูตัวอย่างข้อมูล customer_id
SELECT id, customer_id FROM bonus_face_sheet_packages LIMIT 10;
SELECT DISTINCT customer_id FROM picklist_items pi 
  JOIN wms_orders o ON pi.order_id = o.id LIMIT 10;
```

---

เริ่มทำงานได้เลย และรายงานทุกการแก้ไขที่ทำ