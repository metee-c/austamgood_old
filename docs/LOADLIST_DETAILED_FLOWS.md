# Loadlist Page - Detailed Flows (โฟลการทำงานละเอียด)

## 1. Flow: เปิดหน้า Loadlists

```
┌─────────────────────────────────────────────────────────────────────────┐
│ User เปิด /receiving/loadlists                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ useEffect() ทำงาน                                                        │
│ ├── fetchLoadlists()     → GET /api/loadlists                           │
│ ├── fetchEmployees()     → GET /api/employees                           │
│ └── fetchVehicles()      → GET /api/master-vehicle                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ GET /api/loadlists                                                       │
│ ├── Query loadlists พร้อม relations:                                    │
│ │   ├── checker_employee, helper_employee                               │
│ │   ├── route_plan (plan_code, plan_date)                               │
│ │   ├── wms_loadlist_picklists → picklists → picklist_items → orders   │
│ │   ├── loadlist_face_sheets → face_sheets                              │
│ │   └── wms_loadlist_bonus_face_sheets → bonus_face_sheets              │
│ ├── Fetch trip data (trip_code, daily_trip_number)                      │
│ ├── Fetch vehicle data (plate_number, model)                            │
│ ├── Fetch driver data (first_name, last_name)                           │
│ └── Transform data → Return JSON                                        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ แสดงตาราง Loadlists                                                      │
│ ├── รหัสใบโหลด (loadlist_code)                                          │
│ ├── รหัสแผนส่ง (route_plan.plan_code)                                   │
│ ├── คันที่ (trip.daily_trip_number)                                     │
│ ├── เลขงานจัดส่ง (delivery_number / face_sheet_no)                      │
│ ├── ประตูโหลด (loading_door_number) - Dropdown แก้ไขได้                 │
│ ├── คิว (loading_queue_number) - Dropdown แก้ไขได้                      │
│ ├── ผู้เช็คโหลด (checker_employee)                                      │
│ ├── ประเภทรถ (vehicle_type) - Dropdown แก้ไขได้                         │
│ ├── ทะเบียนรถ (vehicle.plate_number) - Dropdown แก้ไขได้                │
│ ├── คนขับ (driver) - Dropdown แก้ไขได้                                  │
│ ├── วันที่สร้าง (created_at)                                            │
│ ├── สถานะ (status badge)                                                │
│ └── ปุ่มดำเนินการ (พิมพ์, หยิบ, ยืนยัน)                                  │
└─────────────────────────────────────────────────────────────────────────┘
```


## 2. Flow: สร้างใบโหลดใหม่ (Create Loadlist)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ User คลิกปุ่ม "สร้างใบโหลดใหม่"                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ handleOpenCreateModal()                                                  │
│ ├── setIsCreateModalOpen(true)                                          │
│ ├── fetchAvailablePicklists()    → GET /api/loadlists/available-picklists│
│ ├── fetchAvailableFaceSheets()   → GET /api/loadlists/available-face-sheets│
│ ├── fetchAvailableBonusFaceSheets() → GET /api/loadlists/available-bonus-face-sheets│
│ └── fetchAllPicklistsForDropdown() → GET /api/picklists (for bonus mapping)│
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Modal แสดง 3 Tabs:                                                       │
│ ├── Tab 1: ใบจัดสินค้า (Picklists)                                      │
│ ├── Tab 2: ใบปะหน้า (Face Sheets)                                       │
│ └── Tab 3: ใบปะหน้าของแถม (Bonus Face Sheets)                           │
└─────────────────────────────────────────────────────────────────────────┘
```


### 2.1 Flow: เลือก Picklists

```
┌─────────────────────────────────────────────────────────────────────────┐
│ GET /api/loadlists/available-picklists                                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. ดึง picklist_ids ที่ใช้แล้วจาก wms_loadlist_picklists                │
│ 2. Query picklists WHERE status='completed' AND id NOT IN (used_ids)    │
│ 3. ดึงข้อมูล trip (vehicle_id, driver_id, trip_code)                    │
│ 4. ดึงข้อมูล provinces จาก stops → orders                               │
│ 5. ดึง total_stops, total_weight จาก trips                              │
│ 6. Return transformed data                                               │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ User เลือก Picklist (checkbox)                                           │
│ ├── handleTogglePicklist(picklist_id)                                   │
│ │   └── อัปเดต selectedPicklists state                                  │
│ └── useEffect ทำงาน (auto-fill)                                         │
│     ├── ดึงข้อมูลจาก picklist แรกที่เลือก                               │
│     ├── setLoadingDoorNumber(picklist.loading_door_number)              │
│     ├── setVehicleId(picklist.trip.vehicle_id)                          │
│     └── setDriverEmployeeId(picklist.trip.driver_id)                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ User กรอกข้อมูลเพิ่มเติมในแต่ละ row:                                     │
│ ├── ผู้เช็ค (checkerEmployeeId)                                         │
│ ├── ประเภทรถ (vehicleType)                                              │
│ ├── ทะเบียนรถ (vehicleId) → auto-fill คนขับจาก vehicle.model            │
│ ├── คนขับ (driverEmployeeId)                                            │
│ ├── ประตูโหลด (loadingDoorNumber)                                       │
│ ├── คิว (loadingQueueNumber)                                            │
│ └── เลขงานจัดส่ง (deliveryNumber)                                       │
│                                                                          │
│ ข้อมูลเก็บใน picklistFormData[picklist_id]                              │
└─────────────────────────────────────────────────────────────────────────┘
```


### 2.2 Flow: เลือก Face Sheets

```
┌─────────────────────────────────────────────────────────────────────────┐
│ GET /api/loadlists/available-face-sheets                                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. Query face_sheets WHERE status='completed'                            │
│ 2. ดึงข้อมูลการใช้งานจาก loadlist_face_sheets                           │
│ 3. สำหรับแต่ละ face_sheet:                                              │
│    ├── ดึง packages → order_ids                                         │
│    ├── หา trips จาก receiving_route_stops                               │
│    └── ดึง daily_trip_numbers                                           │
│ 4. Return enriched data พร้อม is_used flag                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ User เลือก Face Sheet (checkbox)                                         │
│ ├── อัปเดต selectedFaceSheets state                                     │
│ └── เลือกผู้เช็คโหลด (ใช้ร่วมกันทุก face sheet)                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Flow: เลือก Bonus Face Sheets

```
┌─────────────────────────────────────────────────────────────────────────┐
│ GET /api/loadlists/available-bonus-face-sheets                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. Query bonus_face_sheets WHERE status='completed'                      │
│ 2. ดึง packages ที่ยังไม่ได้โหลด (storage_location IS NOT NULL)         │
│ 3. กรองเฉพาะ BFS ที่มี unloaded packages                                │
│ 4. สำหรับแต่ละ BFS:                                                     │
│    ├── แยก packages: mapped (มี trip_number) vs unmapped                │
│    ├── นับ items, orders เฉพาะ mapped packages                          │
│    ├── Parse trip_number → หา daily_trip_number                         │
│    └── ดึง vehicle plate_number                                         │
│ 5. แยกเป็น 2 กลุ่ม: with_trip / no_trip                                 │
│ 6. Return enriched data                                                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ User เลือก Bonus Face Sheet และแมพข้อมูล:                                │
│ ├── เลือก BFS (checkbox)                                                │
│ ├── เลือก Picklist ที่จะแมพ (dropdown)                                  │
│ ├── เลือก Face Sheet ที่จะแมพ (dropdown)                                │
│ └── เลือกผู้เช็คโหลด                                                    │
│                                                                          │
│ ข้อมูลเก็บใน:                                                            │
│ ├── selectedBonusFaceSheets[]                                           │
│ ├── bonusFaceSheetMappings[bfs_id] = {picklist_id, face_sheet_id}       │
│ └── bonusFaceSheetCheckers[bfs_id] = employee_id                        │
└─────────────────────────────────────────────────────────────────────────┘
```


### 2.4 Flow: บันทึกใบโหลด

```
┌─────────────────────────────────────────────────────────────────────────┐
│ User คลิกปุ่ม "สร้างใบโหลด"                                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ handleCreateLoadlist()                                                   │
│ ├── Validate: ต้องเลือกอย่างน้อย 1 รายการ                               │
│ ├── สำหรับ Picklists: สร้าง loadlist แยกแต่ละ picklist                  │
│ ├── สำหรับ Face Sheets: สร้าง loadlist รวม                              │
│ └── สำหรับ Bonus Face Sheets: สร้าง loadlist แยกแต่ละ BFS               │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ POST /api/loadlists                                                      │
│ Request Body:                                                            │
│ {                                                                        │
│   picklist_ids: [1, 2, 3],           // หรือ                            │
│   face_sheet_ids: [1, 2],            // หรือ                            │
│   bonus_face_sheet_ids: [1],                                            │
│   bonus_face_sheet_mappings: [{picklist_id, face_sheet_id}],            │
│   checker_employee_id: 123,                                              │
│   vehicle_type: "4 ล้อ",                                                │
│   delivery_number: "S003295",                                            │
│   vehicle_id: "V001",                                                    │
│   driver_employee_id: 456,                                               │
│   loading_queue_number: "Q-01",                                          │
│   loading_door_number: "D06"                                             │
│ }                                                                        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ API Processing:                                                          │
│ 1. Validate required fields                                              │
│ 2. ดึง plan_id, trip_id จาก picklist แรก (ถ้ามี)                        │
│ 3. Generate loadlist_code:                                               │
│    ├── ดึง plan_date จาก route_plan หรือ delivery_date จาก face_sheet   │
│    ├── Format: LD-YYYYMMDD-####                                         │
│    └── Sequence number เพิ่มอัตโนมัติ                                   │
│ 4. INSERT INTO loadlists                                                 │
│ 5. Link documents:                                                       │
│    ├── INSERT INTO wms_loadlist_picklists                               │
│    ├── INSERT INTO loadlist_face_sheets                                 │
│    └── INSERT INTO wms_loadlist_bonus_face_sheets                       │
│ 6. ถ้ามี bonus_face_sheet_mappings:                                     │
│    ├── Link mapped face_sheets                                          │
│    ├── Link mapped picklists                                            │
│    └── อัปเดต trip_id จาก picklist                                      │
│ 7. Return created loadlist                                               │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Success:                                                                 │
│ ├── ปิด Modal                                                           │
│ ├── fetchLoadlists() - รีเฟรชข้อมูล                                     │
│ └── แสดง alert "สร้างใบโหลดสำเร็จ"                                      │
└─────────────────────────────────────────────────────────────────────────┘
```


## 3. Flow: แก้ไขข้อมูลใบโหลด (Inline Edit)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ User เปลี่ยนค่าใน Dropdown (เช่น ประตูโหลด, รถ, คนขับ)                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ onChange Event Handler                                                   │
│ ├── ดึงค่าใหม่จาก e.target.value                                        │
│ └── เรียก PUT /api/loadlists/[id]                                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ PUT /api/loadlists/[id]                                                  │
│ Request Body: { loading_door_number: "D05" }                             │
│ หรือ: { vehicle_id: "V001" }                                            │
│ หรือ: { driver_employee_id: 123 }                                       │
│ หรือ: { loading_queue_number: "Q-02" }                                  │
│ หรือ: { vehicle_type: "6 ล้อ" }                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ API Processing:                                                          │
│ 1. UPDATE loadlists SET ... WHERE id = ?                                 │
│ 2. SET updated_at = NOW()                                                │
│ 3. Return updated record                                                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Success:                                                                 │
│ └── fetchLoadlists() - รีเฟรชข้อมูลทั้งตาราง                            │
└─────────────────────────────────────────────────────────────────────────┘
```


## 4. Flow: พิมพ์ใบโหลด (Print Loadlist)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ User คลิกปุ่มพิมพ์ (Printer icon)                                        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ handlePrintLoadlist(loadlist)                                            │
│ ├── ตรวจสอบประเภทเอกสาร:                                                │
│ │   ├── hasPicklists = loadlist.picklists?.length > 0                   │
│ │   ├── hasFaceSheets = loadlist.face_sheets?.length > 0                │
│ │   └── hasBonusFaceSheets = loadlist.bonus_face_sheets?.length > 0     │
│ └── ถ้าไม่มีเอกสารเลย → alert แจ้งเตือน                                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
              ▼                     ▼                     ▼
┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐
│ Bonus Face Sheets   │ │ Face Sheets         │ │ Picklists           │
│ (ลำดับความสำคัญ 1)  │ │ (ลำดับความสำคัญ 2)  │ │ (ลำดับความสำคัญ 3)  │
└─────────────────────┘ └─────────────────────┘ └─────────────────────┘
          │                       │                       │
          ▼                       ▼                       ▼
┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐
│ เปิด Modal เลือก    │ │ เปิด URL:           │ │ Render component:   │
│ Face Sheet ที่จะปริ้น│ │ /api/face-sheets/   │ │ DeliveryOrder       │
│                     │ │ delivery-document   │ │ Document            │
│ fetch mapped        │ │ ?face_sheet_ids=... │ │                     │
│ face sheets         │ │                     │ │ เปิด print window   │
└─────────────────────┘ └─────────────────────┘ └─────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ User เลือก Face Sheets ที่ต้องการปริ้น                                   │
│ └── handlePrintBonusFaceSheetByFaceSheets()                             │
│     └── เปิด URL: /api/bonus-face-sheets/print?id=...&face_sheet_id=... │
└─────────────────────────────────────────────────────────────────────────┘
```


## 5. Flow: พิมพ์ใบหยิบสินค้า (Print Pick List)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ User คลิกปุ่มพิมพ์ใบหยิบ (FileText icon)                                 │
│ (แสดงเฉพาะ loadlist ที่มี bonus_face_sheets)                            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ handlePrintPickList(loadlist)                                            │
│ ├── ตรวจสอบว่ามี bonus_face_sheets                                      │
│ ├── setPrintingPickListId(loadlist.id) - แสดง loading                   │
│ └── fetch /api/bonus-face-sheets/pick-list?id=...&loadlist_id=...       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ GET /api/bonus-face-sheets/pick-list                                     │
│ ├── ดึงข้อมูล bonus_face_sheet                                          │
│ ├── ดึง packages ที่มี trip_number                                      │
│ ├── จัดกลุ่มตาม trip_number                                             │
│ ├── ดึงรายละเอียด items ในแต่ละ package                                 │
│ └── Return: { face_sheet_no, trip_groups, loadlist_code }               │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Render BonusPickListDocument component                                   │
│ ├── สร้าง temp container                                                │
│ ├── createRoot().render(<BonusPickListDocument ... />)                  │
│ ├── รอ 300ms ให้ render เสร็จ                                           │
│ ├── เปิด print window                                                   │
│ ├── เขียน HTML + CSS                                                    │
│ └── เรียก window.print()                                                │
└─────────────────────────────────────────────────────────────────────────┘
```


## 6. Flow: ยืนยันหยิบของแถมไปจุดพักรอโหลด

```
┌─────────────────────────────────────────────────────────────────────────┐
│ User คลิกปุ่มยืนยันหยิบ (CheckCircle icon)                               │
│ (แสดงเฉพาะ loadlist ที่มี bonus_face_sheets)                            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ handleConfirmPickToStaging(loadlist)                                     │
│ ├── ตรวจสอบว่ามี bonus_face_sheets                                      │
│ ├── fetch pick-list API เพื่อนับ packages ที่มี trip_number             │
│ ├── ถ้าไม่มี packages ที่แมพ → alert แจ้งเตือน                          │
│ └── แสดง confirm dialog                                                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ User ยืนยัน                                                              │
│ └── POST /api/bonus-face-sheets/confirm-pick-to-staging                 │
│     Request Body: { loadlist_id, bonus_face_sheet_id }                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ API Processing:                                                          │
│ 1. ดึง packages ที่มี trip_number และ storage_location                  │
│ 2. สำหรับแต่ละ package:                                                 │
│    ├── ย้ายสต็อกจาก PQ01-PQ10 → PQTD                                    │
│    ├── ย้ายสต็อกจาก MR01-MR10 → MRTD                                    │
│    ├── อัปเดต inventory_ledger                                          │
│    └── อัปเดต inventory_balance                                         │
│ 3. อัปเดต package.storage_location = null (หมายถึงหยิบแล้ว)             │
│ 4. Return success message                                                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Success:                                                                 │
│ ├── alert แสดงผลสำเร็จ                                                  │
│ └── fetchLoadlists() - รีเฟรชข้อมูล                                     │
└─────────────────────────────────────────────────────────────────────────┘
```


## 7. Flow: ค้นหาและกรองข้อมูล

```
┌─────────────────────────────────────────────────────────────────────────┐
│ User พิมพ์ในช่องค้นหา                                                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ SearchInput onChange                                                     │
│ └── setSearchTerm(value)                                                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ useMemo: filteredLoadlists                                               │
│ ├── กรองตาม searchTerm:                                                 │
│ │   ├── loadlist_code                                                   │
│ │   ├── vehicle.plate_number                                            │
│ │   ├── driver.first_name + last_name                                   │
│ │   └── delivery_number                                                 │
│ └── เรียงลำดับตาม sortConfig (column, direction)                        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ แสดงผลลัพธ์ที่กรองแล้ว                                                   │
│ ├── Pagination: แบ่งหน้า (pageSize = 20)                                │
│ └── แสดง PaginationBar                                                  │
└─────────────────────────────────────────────────────────────────────────┘
```

## 8. Flow: เรียงลำดับข้อมูล (Sort)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ User คลิกหัวคอลัมน์ (loadlist_code หรือ created_at)                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ handleSort(column)                                                       │
│ ├── ถ้าคอลัมน์เดิม: สลับ direction (asc ↔ desc)                         │
│ └── ถ้าคอลัมน์ใหม่: ตั้งค่า direction = 'asc'                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ useMemo: filteredLoadlists                                               │
│ └── sort ตาม sortConfig                                                 │
│     ├── loadlist_code: เรียงตามตัวอักษร                                 │
│     └── created_at: เรียงตามวันที่                                      │
└─────────────────────────────────────────────────────────────────────────┘
```


## 9. State Management Summary

### 9.1 Data States

| State | Type | Description |
|-------|------|-------------|
| `loadlists` | `Loadlist[]` | รายการใบโหลดทั้งหมด |
| `availablePicklists` | `AvailablePicklist[]` | Picklists ที่พร้อมใช้ |
| `availableFaceSheets` | `AvailableFaceSheet[]` | Face sheets ที่พร้อมใช้ |
| `availableBonusFaceSheets` | `AvailableBonusFaceSheet[]` | Bonus face sheets ที่พร้อมใช้ |
| `employees` | `Employee[]` | รายชื่อพนักงาน |
| `vehicles` | `Vehicle[]` | รายการรถ |
| `drivers` | `Employee[]` | รายชื่อคนขับ |

### 9.2 Selection States

| State | Type | Description |
|-------|------|-------------|
| `selectedPicklists` | `number[]` | IDs ของ picklists ที่เลือก |
| `selectedFaceSheets` | `number[]` | IDs ของ face sheets ที่เลือก |
| `selectedBonusFaceSheets` | `number[]` | IDs ของ bonus face sheets ที่เลือก |

### 9.3 Form States

| State | Type | Description |
|-------|------|-------------|
| `picklistFormData` | `Record<number, PicklistFormData>` | ข้อมูลฟอร์มแยกตาม picklist |
| `bonusFaceSheetCheckers` | `Record<number, number>` | ผู้เช็คแยกตาม BFS |
| `bonusFaceSheetMappings` | `Record<number, {picklist_id, face_sheet_id}>` | การแมพ BFS |
| `checkerEmployeeId` | `number \| ''` | ผู้เช็ค (สำหรับ face sheets) |
| `vehicleType` | `string` | ประเภทรถ |
| `vehicleId` | `string` | รหัสรถ |
| `driverEmployeeId` | `number \| ''` | รหัสคนขับ |
| `deliveryNumber` | `string` | เลขงานจัดส่ง |
| `loadingDoorNumber` | `string` | ประตูโหลด |
| `loadingQueueNumber` | `string` | คิว |

### 9.4 UI States

| State | Type | Description |
|-------|------|-------------|
| `loading` | `boolean` | กำลังโหลดข้อมูล |
| `error` | `string \| null` | ข้อความ error |
| `isCreateModalOpen` | `boolean` | Modal สร้างใบโหลด |
| `isCreating` | `boolean` | กำลังสร้างใบโหลด |
| `activeTab` | `'picklists' \| 'face-sheets' \| 'bonus-face-sheets'` | Tab ที่เลือก |
| `isPrintModalOpen` | `boolean` | Modal พิมพ์ |
| `isBonusPrintModalOpen` | `boolean` | Modal เลือก face sheet สำหรับปริ้น |
| `printingPickListId` | `number \| null` | ID ที่กำลังปริ้นใบหยิบ |
| `confirmingPickId` | `number \| null` | ID ที่กำลังยืนยันหยิบ |
| `searchTerm` | `string` | คำค้นหา |
| `currentPage` | `number` | หน้าปัจจุบัน |
| `sortConfig` | `{column, direction}` | การเรียงลำดับ |


## 10. API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/loadlists` | ดึงรายการใบโหลดทั้งหมด |
| POST | `/api/loadlists` | สร้างใบโหลดใหม่ |
| PUT | `/api/loadlists/[id]` | อัปเดตใบโหลด (by ID) |
| PATCH | `/api/loadlists/[id]` | อัปเดตใบโหลด (by code) |
| GET | `/api/loadlists/available-picklists` | ดึง picklists ที่พร้อมใช้ |
| GET | `/api/loadlists/available-face-sheets` | ดึง face sheets ที่พร้อมใช้ |
| GET | `/api/loadlists/available-bonus-face-sheets` | ดึง bonus face sheets ที่พร้อมใช้ |
| GET | `/api/employees` | ดึงรายชื่อพนักงาน |
| GET | `/api/master-vehicle` | ดึงรายการรถ |
| GET | `/api/bonus-face-sheets/pick-list` | ดึงข้อมูลใบหยิบสินค้า |
| GET | `/api/bonus-face-sheets/mapped-face-sheets` | ดึง face sheets ที่แมพกับ BFS |
| POST | `/api/bonus-face-sheets/confirm-pick-to-staging` | ยืนยันหยิบไปจุดพัก |
| GET | `/api/face-sheets/delivery-document` | ดึงเอกสารส่งสินค้า |
| GET | `/api/bonus-face-sheets/print` | ปริ้นใบปะหน้าของแถม |

## 11. Database Tables Involved

| Table | Role |
|-------|------|
| `loadlists` | ตารางหลักใบโหลด |
| `wms_loadlist_picklists` | Junction: loadlist ↔ picklist |
| `loadlist_face_sheets` | Junction: loadlist ↔ face_sheet |
| `wms_loadlist_bonus_face_sheets` | Junction: loadlist ↔ bonus_face_sheet |
| `picklists` | ข้อมูลใบจัดสินค้า |
| `picklist_items` | รายการสินค้าในใบจัด |
| `face_sheets` | ข้อมูลใบปะหน้า |
| `face_sheet_packages` | แพ็คในใบปะหน้า |
| `bonus_face_sheets` | ข้อมูลใบปะหน้าของแถม |
| `bonus_face_sheet_packages` | แพ็คในใบปะหน้าของแถม |
| `bonus_face_sheet_items` | รายการสินค้าในแพ็คของแถม |
| `master_employee` | ข้อมูลพนักงาน |
| `master_vehicle` | ข้อมูลรถ |
| `receiving_route_plans` | แผนส่งสินค้า |
| `receiving_route_trips` | เที่ยวรถ |
| `receiving_route_stops` | จุดส่ง |
| `wms_orders` | ออเดอร์ |
| `inventory_ledger` | บันทึกการเคลื่อนไหวสต็อก |
| `inventory_balance` | ยอดคงเหลือสต็อก |

---

*สร้างเมื่อ: 10 มกราคม 2569*
