# รายงานวิเคราะห์หน้า Loadlists (ใบโหลดสินค้า)

## 1. Overview (ภาพรวม)

หน้า **Loadlists** (`/receiving/loadlists`) เป็นหน้าจัดการ "ใบโหลดสินค้า" ซึ่งเป็นเอกสารที่ใช้ในการรวบรวมสินค้าที่พร้อมส่งขึ้นรถ โดยรองรับ 3 ประเภทเอกสาร:

1. **Picklists (ใบจัดสินค้า)** - สินค้าปกติที่หยิบจากคลัง
2. **Face Sheets (ใบปะหน้า)** - สินค้าที่จัดเป็นแพ็คตามออเดอร์
3. **Bonus Face Sheets (ใบปะหน้าของแถม)** - สินค้าของแถมที่แยกจัดต่างหาก

### ฟังก์ชันหลัก:
- แสดงรายการใบโหลดทั้งหมด พร้อมข้อมูลรถ, คนขับ, ประตูโหลด
- สร้างใบโหลดใหม่โดยเลือกจาก Picklists/Face Sheets/Bonus Face Sheets
- แก้ไขข้อมูลใบโหลด (ประตูโหลด, คิว, รถ, คนขับ) แบบ inline
- พิมพ์เอกสารใบโหลด (Delivery Order Document)
- พิมพ์ใบหยิบสินค้า (Pick List) สำหรับของแถม
- ยืนยันหยิบของแถมไปจุดพักรอโหลด (PQTD/MRTD)

---

## 2. File Structure (โครงสร้างไฟล์)

```
app/
├── receiving/
│   └── loadlists/
│       └── page.tsx                    # หน้าหลัก (2,433 lines)
│
├── api/
│   └── loadlists/
│       ├── route.ts                    # GET: ดึงรายการ, POST: สร้างใหม่
│       ├── [id]/
│       │   └── route.ts                # PUT/PATCH: อัปเดตใบโหลด
│       ├── available-picklists/
│       │   └── route.ts                # GET: ดึง picklists ที่พร้อมใช้
│       ├── available-face-sheets/
│       │   └── route.ts                # GET: ดึง face sheets ที่พร้อมใช้
│       └── available-bonus-face-sheets/
│           └── route.ts                # GET: ดึง bonus face sheets ที่พร้อมใช้

components/
└── receiving/
    └── DeliveryOrderDocument.tsx       # Component สำหรับพิมพ์เอกสาร
```

---

## 3. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER INTERFACE                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    LoadlistsPage (page.tsx)                          │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │   │
│  │  │ Loadlist     │  │ Create Modal │  │ Print Modal              │  │   │
│  │  │ Table        │  │ (3 tabs)     │  │ (DeliveryOrderDocument)  │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API LAYER                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ GET /api/loadlists                    → ดึงรายการใบโหลดทั้งหมด      │   │
│  │ POST /api/loadlists                   → สร้างใบโหลดใหม่             │   │
│  │ PUT /api/loadlists/[id]               → อัปเดตใบโหลด (by ID)        │   │
│  │ PATCH /api/loadlists/[id]             → อัปเดตใบโหลด (by code)      │   │
│  │ GET /api/loadlists/available-picklists     → ดึง picklists พร้อมใช้ │   │
│  │ GET /api/loadlists/available-face-sheets   → ดึง face sheets พร้อมใช้│   │
│  │ GET /api/loadlists/available-bonus-face-sheets → ดึง bonus FS พร้อมใช้│   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATABASE (Supabase)                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ loadlists                    ← ตารางหลักใบโหลด                      │   │
│  │ wms_loadlist_picklists       ← Junction: loadlist ↔ picklist       │   │
│  │ loadlist_face_sheets         ← Junction: loadlist ↔ face_sheet     │   │
│  │ wms_loadlist_bonus_face_sheets ← Junction: loadlist ↔ bonus_fs     │   │
│  │ picklists                    ← ข้อมูลใบจัดสินค้า                    │   │
│  │ face_sheets                  ← ข้อมูลใบปะหน้า                       │   │
│  │ bonus_face_sheets            ← ข้อมูลใบปะหน้าของแถม                 │   │
│  │ master_employee              ← ข้อมูลพนักงาน                        │   │
│  │ master_vehicle               ← ข้อมูลรถ                             │   │
│  │ receiving_route_trips        ← ข้อมูลเที่ยวรถ                       │   │
│  │ receiving_route_plans        ← ข้อมูลแผนส่ง                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Database Schema

### 4.1 ตาราง `loadlists` (ตารางหลัก)

| Column | Type | Description |
|--------|------|-------------|
| id | integer | Primary Key |
| loadlist_code | varchar | รหัสใบโหลด (LD-YYYYMMDD-####) |
| plan_id | integer | FK → receiving_route_plans |
| trip_id | integer | FK → receiving_route_trips |
| vehicle_id | varchar | FK → master_vehicle |
| driver_employee_id | integer | FK → master_employee |
| status | varchar | สถานะ: pending, loaded, cancelled |
| loading_door_number | varchar | ประตูโหลด (D01-D10) |
| loading_queue_number | varchar | คิว (Q-01 - Q-10) |
| checker_employee_id | integer | FK → master_employee (ผู้เช็ค) |
| helper_employee_id | integer | FK → master_employee (ผู้ช่วย) |
| vehicle_type | varchar | ประเภทรถ |
| delivery_number | varchar | เลขงานจัดส่ง |
| driver_phone | varchar | เบอร์โทรคนขับ |
| created_at | timestamp | วันที่สร้าง |
| updated_at | timestamp | วันที่อัปเดต |

### 4.2 Junction Tables

**wms_loadlist_picklists:**
| Column | Type | Description |
|--------|------|-------------|
| id | integer | Primary Key |
| loadlist_id | integer | FK → loadlists |
| picklist_id | integer | FK → picklists |
| sequence | integer | ลำดับ |
| loaded_at | timestamp | เวลาโหลดเสร็จ |

**loadlist_face_sheets:**
| Column | Type | Description |
|--------|------|-------------|
| loadlist_id | integer | FK → loadlists |
| face_sheet_id | integer | FK → face_sheets |
| added_at | timestamp | เวลาเพิ่ม |

**wms_loadlist_bonus_face_sheets:**
| Column | Type | Description |
|--------|------|-------------|
| id | integer | Primary Key |
| loadlist_id | integer | FK → loadlists |
| bonus_face_sheet_id | integer | FK → bonus_face_sheets |
| loaded_at | timestamp | เวลาโหลดเสร็จ |

### 4.3 Entity Relationship Diagram

```
                    ┌─────────────────┐
                    │   loadlists     │
                    │─────────────────│
                    │ id (PK)         │
                    │ loadlist_code   │
                    │ plan_id (FK)    │───────────┐
                    │ trip_id (FK)    │───────┐   │
                    │ vehicle_id (FK) │───┐   │   │
                    │ driver_id (FK)  │─┐ │   │   │
                    │ checker_id (FK) │ │ │   │   │
                    └────────┬────────┘ │ │   │   │
                             │          │ │   │   │
        ┌────────────────────┼──────────┼─┼───┼───┼────────────────────┐
        │                    │          │ │   │   │                    │
        ▼                    ▼          ▼ ▼   ▼   ▼                    ▼
┌───────────────┐  ┌───────────────┐  ┌─────────────┐  ┌───────────────────┐
│wms_loadlist_  │  │loadlist_      │  │master_      │  │receiving_route_   │
│picklists      │  │face_sheets    │  │employee     │  │plans/trips        │
│───────────────│  │───────────────│  │─────────────│  │───────────────────│
│loadlist_id(FK)│  │loadlist_id(FK)│  │employee_id  │  │plan_id/trip_id    │
│picklist_id(FK)│  │face_sheet_id  │  │first_name   │  │plan_code          │
└───────┬───────┘  └───────┬───────┘  │last_name    │  │trip_code          │
        │                  │          └─────────────┘  └───────────────────┘
        ▼                  ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────────────────┐
│  picklists    │  │ face_sheets   │  │wms_loadlist_bonus_face_   │
│───────────────│  │───────────────│  │sheets                     │
│id (PK)        │  │id (PK)        │  │───────────────────────────│
│picklist_code  │  │face_sheet_no  │  │loadlist_id (FK)           │
│status         │  │status         │  │bonus_face_sheet_id (FK)   │
│trip_id (FK)   │  │total_packages │  └─────────────┬─────────────┘
└───────────────┘  └───────────────┘                │
                                                    ▼
                                          ┌───────────────────┐
                                          │bonus_face_sheets  │
                                          │───────────────────│
                                          │id (PK)            │
                                          │face_sheet_no      │
                                          │status             │
                                          └───────────────────┘
```

---

## 5. Key Functions (ฟังก์ชันหลัก)

### 5.1 Frontend Functions (page.tsx)

| Function | Description |
|----------|-------------|
| `fetchLoadlists()` | ดึงรายการใบโหลดทั้งหมดจาก API |
| `fetchAvailablePicklists()` | ดึง picklists ที่ status=completed และยังไม่ถูกใช้ |
| `fetchAvailableFaceSheets()` | ดึง face sheets ที่ status=completed |
| `fetchAvailableBonusFaceSheets()` | ดึง bonus face sheets ที่พร้อมใช้ |
| `handleCreateLoadlist()` | สร้างใบโหลดใหม่ (POST /api/loadlists) |
| `handlePrintLoadlist()` | พิมพ์เอกสารใบโหลด |
| `handlePrintPickList()` | พิมพ์ใบหยิบสินค้าสำหรับของแถม |
| `handleConfirmPickToStaging()` | ยืนยันหยิบของแถมไป PQTD/MRTD |
| `handleTogglePicklist()` | เลือก/ยกเลิกเลือก picklist |
| `updatePicklistFormData()` | อัปเดตข้อมูลฟอร์มแต่ละ picklist |

### 5.2 API Functions

**GET /api/loadlists:**
- ดึงข้อมูลใบโหลดพร้อม relations (checker, helper, route_plan, trip, picklists, face_sheets, bonus_face_sheets)
- Transform data ให้อยู่ในรูปแบบที่ frontend ต้องการ

**POST /api/loadlists:**
- Validate required fields (checker_employee_id, vehicle_type, delivery_number)
- Generate loadlist_code (LD-YYYYMMDD-####)
- สร้าง loadlist record
- Link picklists/face_sheets/bonus_face_sheets ผ่าน junction tables

**PUT /api/loadlists/[id]:**
- อัปเดตข้อมูลใบโหลด (vehicle_id, driver_employee_id, loading_door_number, etc.)

---

## 6. Business Logic (กฎเกณฑ์ทางธุรกิจ)

### 6.1 การสร้างใบโหลด

1. **ต้องเลือกอย่างน้อย 1 รายการ** จาก Picklists, Face Sheets, หรือ Bonus Face Sheets
2. **Required Fields:**
   - ผู้เช็คโหลด (checker_employee_id)
   - ประเภทรถ (vehicle_type)
   - เลขงานจัดส่ง (delivery_number)

3. **Loadlist Code Generation:**
   - Format: `LD-YYYYMMDD-####`
   - ใช้ plan_date จาก Route Plan หรือ delivery_date จาก Face Sheet
   - Sequence number เพิ่มขึ้นอัตโนมัติต่อวัน

### 6.2 การเลือก Picklists

- แสดงเฉพาะ picklists ที่ `status = 'completed'`
- กรอง picklists ที่ถูกใช้ใน loadlist อื่นแล้วออก
- Auto-fill ข้อมูลจาก picklist แรกที่เลือก:
  - Loading door number
  - Vehicle ID
  - Driver ID

### 6.3 การเลือก Face Sheets

- แสดง face sheets ที่ `status = 'completed'` ทั้งหมด
- แสดงสถานะการใช้งาน (is_used, used_in_loadlist_id)
- แสดงเลขคัน (daily_trip_numbers) ที่เกี่ยวข้อง

### 6.4 การเลือก Bonus Face Sheets

- แสดงเฉพาะ bonus face sheets ที่มี packages ยังไม่ได้โหลด
- แยกแสดง 2 กลุ่ม:
  - **มีสายรถ (with_trip):** packages ที่มี trip_number
  - **ไม่ระบุสายรถ (no_trip):** packages ที่ยังไม่แมพสายรถ
- รองรับ partial loading (โหลดบางส่วนได้)

### 6.5 Status Flow

```
pending (รอโหลด) → loaded (โหลดเสร็จ)
                 → cancelled (ยกเลิก)
```

---

## 7. State Management

### 7.1 Main States

```typescript
// Data states
const [loadlists, setLoadlists] = useState<Loadlist[]>([]);
const [availablePicklists, setAvailablePicklists] = useState<AvailablePicklist[]>([]);
const [availableFaceSheets, setAvailableFaceSheets] = useState<AvailableFaceSheet[]>([]);
const [availableBonusFaceSheets, setAvailableBonusFaceSheets] = useState<AvailableBonusFaceSheet[]>([]);
const [employees, setEmployees] = useState<Employee[]>([]);
const [vehicles, setVehicles] = useState<Vehicle[]>([]);
const [drivers, setDrivers] = useState<Employee[]>([]);

// Selection states
const [selectedPicklists, setSelectedPicklists] = useState<number[]>([]);
const [selectedFaceSheets, setSelectedFaceSheets] = useState<number[]>([]);
const [selectedBonusFaceSheets, setSelectedBonusFaceSheets] = useState<number[]>([]);

// Form states (per picklist)
const [picklistFormData, setPicklistFormData] = useState<Record<number, PicklistFormData>>({});

// UI states
const [loading, setLoading] = useState(true);
const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
const [activeTab, setActiveTab] = useState<'picklists' | 'face-sheets' | 'bonus-face-sheets'>('picklists');
```

### 7.2 Form Data Structure

```typescript
interface PicklistFormData {
  checkerEmployeeId: number | '';
  vehicleType: string;
  vehicleId: string;
  driverEmployeeId: number | '';
  driverName: string;
  loadingDoorNumber: string;
  loadingQueueNumber: string;
  deliveryNumber: string;
}
```

---

## 8. Potential Issues (จุดที่อาจมีปัญหา)

### 8.1 Performance Issues

1. **ไฟล์ page.tsx ใหญ่เกินไป (2,433 lines)**
   - ควรแยก components ออกเป็นไฟล์ย่อย
   - แยก hooks สำหรับ data fetching

2. **N+1 Query Problem ใน available-bonus-face-sheets API**
   - มีการ query ซ้อนใน loop (Promise.all)
   - ควรใช้ batch query แทน

3. **ไม่มี Pagination ใน API**
   - GET /api/loadlists ดึงข้อมูลทั้งหมด
   - อาจช้าเมื่อมีข้อมูลมาก

### 8.2 Data Integrity Issues

1. **vehicle_id เป็น varchar ใน loadlists**
   - ควรเป็น integer เพื่อ FK constraint ที่ถูกต้อง

2. **ไม่มี unique constraint บน junction tables**
   - อาจเกิด duplicate records

3. **ไม่มี cascade delete**
   - ลบ loadlist แล้ว junction records ยังอยู่

### 8.3 UX Issues

1. **Auto-fill ทำงานเฉพาะ picklist แรก**
   - ถ้าเลือกหลาย picklists อาจสับสน

2. **ไม่มี confirmation ก่อนสร้าง loadlist**
   - อาจสร้างผิดพลาดได้

3. **Inline editing ไม่มี loading state**
   - ผู้ใช้ไม่รู้ว่ากำลังบันทึก

### 8.4 Code Quality Issues

1. **Type casting ด้วย `as any`**
   - ลดความปลอดภัยของ TypeScript

2. **Console.log ใน production code**
   - ควรใช้ proper logging

3. **Error handling ไม่ครอบคลุม**
   - บาง API calls ไม่มี try-catch

---

## 9. Recommendations (ข้อเสนอแนะ)

### 9.1 Short-term Fixes

1. เพิ่ม loading state สำหรับ inline editing
2. เพิ่ม confirmation dialog ก่อนสร้าง loadlist
3. ลบ console.log ที่ไม่จำเป็น

### 9.2 Medium-term Improvements

1. แยก page.tsx เป็น components ย่อย:
   - `LoadlistTable.tsx`
   - `CreateLoadlistModal.tsx`
   - `PicklistsTab.tsx`
   - `FaceSheetsTab.tsx`
   - `BonusFaceSheetsTab.tsx`

2. สร้าง custom hooks:
   - `useLoadlists.ts`
   - `useAvailableDocuments.ts`

3. เพิ่ม pagination ใน API

### 9.3 Long-term Refactoring

1. แก้ไข database schema:
   - เปลี่ยน vehicle_id เป็น integer
   - เพิ่ม unique constraints
   - เพิ่ม cascade delete

2. Optimize API queries:
   - ใช้ database views
   - ลด N+1 queries

---

## 10. Sample Data

### Loadlist Record
```json
{
  "id": 137,
  "loadlist_code": "LD-20260112-0008",
  "plan_id": null,
  "trip_id": null,
  "vehicle_id": null,
  "driver_employee_id": null,
  "status": "pending",
  "loading_door_number": null,
  "loading_queue_number": null,
  "checker_employee_id": 155,
  "vehicle_type": "N/A",
  "delivery_number": "BFS-1767951583181"
}
```

### Junction Table Records
```json
// wms_loadlist_picklists
{
  "id": 61,
  "loadlist_id": 100,
  "picklist_id": 232,
  "sequence": 1,
  "loaded_at": "2026-01-08T05:23:02.309Z"
}

// loadlist_face_sheets
{
  "loadlist_id": 77,
  "face_sheet_id": 71,
  "added_at": "2026-01-06T05:06:11.880Z"
}

// wms_loadlist_bonus_face_sheets
{
  "id": 10,
  "loadlist_id": 69,
  "bonus_face_sheet_id": 24,
  "loaded_at": "2026-01-06T03:43:10.236Z"
}
```

---

*รายงานนี้สร้างเมื่อ: 10 มกราคม 2569*
