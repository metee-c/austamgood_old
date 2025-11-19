# 📋 แผนการพัฒนาระบบนำเข้าสต็อกจากระบบเก่า

**วันที่สร้าง:** 19 พฤศจิกายน 2025
**วัตถุประสงค์:** พัฒนาระบบนำเข้าข้อมูลสต็อกจากระบบเก่า (Excel/CSV) เข้าสู่ระบบ WMS ใหม่

---

## 📊 1. การวิเคราะห์ข้อมูลจากระบบเก่า

### ข้อมูลที่ได้รับจากระบบเก่า (คอลัมน์):

```
Location_ID           - รหัสตำแหน่ง (A01-01-001)
Zone                  - ประเภทชั้นวาง (Selective Rack)
Row                   - แถว (A01)
Level                 - ระดับชั้น (1)
Loc                   - หมายเลขช่อง (1)
SKU Pick Face         - (ว่างเปล่า)
Max_Weight            - น้ำหนักสูงสุด (1000 กก.)
Max_Pallet            - จำนวนพาเลทสูงสุด (1)
Max_High              - ความสูงสูงสุด (1800 มม.)
Status                - สถานะตำแหน่ง (ว่าง, เก็บสินค้า)
Pallet_ID_Check       - รหัสพาเลทตรวจสอบ (ATG2500010721)
Pallet_ID             - รหัสพาเลทจริง (ATG2500014400)
Last_Updated_Check    - วันที่อัปเดตตรวจสอบ
Last_Updated_Check_2  - วันที่อัปเดตตรวจสอบ 2 (A01-01-003)
Last_Updated          - วันที่อัปเดตล่าสุด
SKU                   - รหัส SKU (TT-NET-C|FNC|0005)
Product_Name          - ชื่อสินค้า
แพ็ค                  - จำนวนแพ็ค (30.00)
ชิ้น                  - จำนวนชิ้น (1,500.00)
น้ำหนัก               - น้ำหนัก (75.00 กก.)
Lot                   - Lot Number (ว่างเปล่า)
Received_Date         - วันที่รับสินค้า (27/8/2025)
Expiration_Date       - วันหมดอายุ (26/9/2026)
Barcode               - บาร์โค้ด (ว่างเปล่า)
Name_edit             - ชื่อผู้แก้ไข (กิตตินันท์ มั่นจิต)
Status                - สถานะสินค้า (ปกติ)
สีพาเลท               - สีของพาเลท (เขียว)
หมายเหตุ              - หมายเหตุ (ติดส่วนลด15%)
```

### ข้อมูลตัวอย่าง:

**แถวที่ 1 - ตำแหน่งว่าง:**
```
A01-01-001, Selective Rack, A01, 1, 1, , 1000, 1, 1800, ว่าง, ATG2500010721, , ...
```

**แถวที่ 3 - ตำแหน่งมีสินค้า:**
```
A01-01-003, Selective Rack, A01, 1, 3, , 1000, 1, 1800, เก็บสินค้า,
ATG2500014400, ATG2500014400, 10/10/2025 8:35:17, A01-01-003,
10/10/2025 8:35:17, TT-NET-C|FNC|0005,
Tester | Buzz Netura แมวโตและลูก ปลาและไก่ | 50 กรัม,
30.00, 1,500.00, 75.00, , 27/8/2025, 26/9/2026, ,
กิตตินันท์ มั่นจิต, ปกติ, เขียว, ติดส่วนลด15%
```

---

## 🗄️ 2. โครงสร้าง Database ใหม่

### 2.1 ตารางที่จะได้รับการอัพเดท

#### **master_location** (ตำแหน่งจัดเก็บ)
```sql
location_id           VARCHAR(50)      PK
warehouse_id          VARCHAR(50)      NOT NULL
location_code         VARCHAR(50)      NOT NULL
location_name         VARCHAR(255)
location_type         VARCHAR(20)      DEFAULT 'rack'
max_capacity_qty      INTEGER          DEFAULT 0
max_capacity_weight_kg NUMERIC(10,3)   DEFAULT 0
current_qty           INTEGER          DEFAULT 0  ← อัพเดทจากการนำเข้า
current_weight_kg     NUMERIC(10,3)    DEFAULT 0  ← อัพเดทจากการนำเข้า
zone                  VARCHAR(50)
aisle                 VARCHAR(50)
rack                  VARCHAR(50)
shelf                 VARCHAR(50)
bin                   VARCHAR(50)
active_status         VARCHAR(20)      DEFAULT 'active'
```

#### **wms_inventory_balances** (ยอดสต็อกคงเหลือ)
```sql
balance_id            BIGINT           PK
warehouse_id          VARCHAR(50)      NOT NULL
location_id           VARCHAR(50)      → master_location
sku_id                VARCHAR(50)      NOT NULL → master_sku
pallet_id             VARCHAR(100)     ← รหัสพาเลทภายใน
pallet_id_external    VARCHAR(100)     ← รหัสพาเลทจากระบบเก่า (Pallet_ID)
lot_no                VARCHAR(100)     ← Lot Number
production_date       DATE             ← Received_Date
expiry_date           DATE             ← Expiration_Date
total_pack_qty        NUMERIC(18,2)    ← แพ็ค
total_piece_qty       NUMERIC(18,2)    ← ชิ้น
reserved_pack_qty     NUMERIC(18,2)    DEFAULT 0
reserved_piece_qty    NUMERIC(18,2)    DEFAULT 0
last_move_id          BIGINT
last_movement_at      TIMESTAMP
created_at            TIMESTAMP
updated_at            TIMESTAMP
```

#### **wms_inventory_ledger** (ประวัติการเคลื่อนไหวสต็อก)
```sql
ledger_id             BIGINT           PK
movement_at           TIMESTAMP        NOT NULL
transaction_type      VARCHAR(50)      = 'import' (ใหม่)
direction             ENUM             = 'in'
move_item_id          BIGINT           NULL (ไม่มีใบงานย้าย)
receive_item_id       BIGINT           NULL (ไม่มีใบรับ)
warehouse_id          VARCHAR(50)      NOT NULL
location_id           VARCHAR(50)      → master_location
sku_id                VARCHAR(50)      NOT NULL
pallet_id             VARCHAR(100)     ← รหัสพาเลทภายใน
pallet_id_external    VARCHAR(100)     ← Pallet_ID
production_date       DATE             ← Received_Date
expiry_date           DATE             ← Expiration_Date
pack_qty              NUMERIC(18,2)    ← แพ็ค
piece_qty             NUMERIC(18,2)    ← ชิ้น
reference_no          VARCHAR(100)     ← 'IMPORT-YYYYMMDD-XXX'
remarks               TEXT             ← หมายเหตุจากระบบเก่า
created_by            BIGINT           ← User ID ผู้นำเข้า
```

---

## 🔄 3. Field Mapping (ระบบเก่า → ระบบใหม่)

### 3.1 Location Mapping

| ระบบเก่า | ระบบใหม่ (master_location) | หมายเหตุ |
|----------|---------------------------|----------|
| Location_ID | location_id | PK - ใช้เหมือนเดิม |
| Location_ID | location_code | ใช้เหมือนเดิม |
| Zone | zone | Selective Rack → zone |
| Row | aisle | A01 → aisle |
| Level | shelf | 1 → shelf |
| Loc | bin | 1 → bin |
| Max_Weight | max_capacity_weight_kg | 1000 → 1000.000 |
| Max_Pallet | max_capacity_qty | 1 พาเลท → คำนวณจาก SKU |
| Max_High | remarks | บันทึกใน remarks: "Max Height: 1800mm" |
| Status | active_status | "ว่าง"/"เก็บสินค้า" → 'active' |
| - | warehouse_id | **ต้องระบุในการนำเข้า** |
| - | location_type | ระบุ 'rack' (default) |
| - | current_qty | คำนวณจาก ชิ้น |
| - | current_weight_kg | คำนวณจาก น้ำหนัก |

### 3.2 Inventory Balance Mapping

| ระบบเก่า | ระบบใหม่ (wms_inventory_balances) | หมายเหตุ |
|----------|----------------------------------|----------|
| - | warehouse_id | **ต้องระบุในการนำเข้า** |
| Location_ID | location_id | FK → master_location |
| SKU | sku_id | FK → master_sku (ต้องมีอยู่แล้ว) |
| Pallet_ID | pallet_id_external | ATG2500014400 |
| - | pallet_id | สร้างใหม่ภายใน |
| Lot | lot_no | ถ้ามี |
| Received_Date | production_date | แปลงวันที่ 27/8/2025 → 2025-08-27 |
| Expiration_Date | expiry_date | แปลงวันที่ 26/9/2026 → 2026-09-26 |
| แพ็ค | total_pack_qty | 30.00 |
| ชิ้น | total_piece_qty | 1500.00 |
| - | reserved_pack_qty | 0 (default) |
| - | reserved_piece_qty | 0 (default) |
| Last_Updated | last_movement_at | แปลงวันที่/เวลา |

### 3.3 Inventory Ledger Mapping

| ระบบเก่า | ระบบใหม่ (wms_inventory_ledger) | หมายเหตุ |
|----------|--------------------------------|----------|
| Last_Updated | movement_at | วันที่/เวลาที่นำเข้า |
| - | transaction_type | 'import' (ค่าคงที่) |
| - | direction | 'in' (ค่าคงที่) |
| - | warehouse_id | **ต้องระบุในการนำเข้า** |
| Location_ID | location_id | FK → master_location |
| SKU | sku_id | FK → master_sku |
| Pallet_ID | pallet_id_external | ATG2500014400 |
| Received_Date | production_date | 2025-08-27 |
| Expiration_Date | expiry_date | 2026-09-26 |
| แพ็ค | pack_qty | 30.00 |
| ชิ้น | piece_qty | 1500.00 |
| - | reference_no | 'IMPORT-20251119-001' |
| หมายเหตุ + Name_edit + สีพาเลท | remarks | รวมข้อมูลเพิ่มเติม |

---

## ⚠️ 4. Validation Rules & Business Logic

### 4.1 การตรวจสอบก่อนนำเข้า

**ข้อมูล Master Data (ต้องมีอยู่แล้ว):**
- ✅ `warehouse_id` - ต้องมีในตาราง `master_warehouse`
- ✅ `location_id` - ตรวจสอบว่ามีใน `master_location` หรือไม่
  - ถ้าไม่มี → **สร้างใหม่**
  - ถ้ามี → **อัพเดต current_qty และ current_weight_kg**
- ✅ `sku_id` - **ต้องมีใน master_sku ก่อน** (จะไม่สร้างใหม่)
  - ถ้าไม่มี → **ข้าม record นี้และบันทึก error**

**ข้อมูลที่ต้องมี (Required):**
- ✅ Location_ID (ต้องไม่ว่าง)
- ✅ SKU (ต้องไม่ว่างและต้องมีใน master_sku)
- ✅ ชิ้น (total_piece_qty > 0)
- ✅ warehouse_id (จากการเลือกในหน้า Import)

**การแปลงข้อมูล:**
- 📅 วันที่: `DD/MM/YYYY` หรือ `DD/MM/YYYY HH:mm:ss` → `YYYY-MM-DD` หรือ `YYYY-MM-DD HH:mm:ss`
- 🔢 ตัวเลข: ลบ comma `1,500.00` → `1500.00`
- 📝 สถานะ: "ว่าง" → `active`, "เก็บสินค้า" → `active`

### 4.2 การจัดการข้อมูลซ้ำ (Duplicate Handling)

**กรณี Balance ซ้ำ** (location_id + sku_id + pallet_id_external เหมือนกัน):
1. **รวมจำนวน** (SUM quantities)
2. **เลือก production_date ที่เก่าที่สุด** (MIN)
3. **เลือก expiry_date ที่ใหม่ที่สุด** (MAX)
4. **อัพเดต last_movement_at เป็นล่าสุด**

**กรณี Location ซ้ำ** (location_id มีอยู่แล้ว):
1. **ไม่สร้างใหม่**
2. **อัพเดต current_qty += ชิ้นที่นำเข้า**
3. **อัพเดต current_weight_kg += น้ำหนักที่นำเข้า**

### 4.3 Transaction Logic

**การนำเข้าต้องเป็น Transaction:**
```
BEGIN TRANSACTION

1. Validate ข้อมูลทั้งหมด
   - ถ้ามี error → ROLLBACK ทั้งหมด

2. สร้าง/อัพเดต master_location (ถ้าจำเป็น)

3. สร้าง/อัพเดต wms_inventory_balances
   - ถ้ามี balance อยู่แล้ว → UPDATE (เพิ่มจำนวน)
   - ถ้าไม่มี → INSERT

4. สร้าง wms_inventory_ledger
   - INSERT เสมอ (audit trail)

5. อัพเดต master_location.current_qty และ current_weight_kg

COMMIT TRANSACTION
```

---

## 🛠️ 5. Technical Implementation Plan

### 5.1 Database Schema (Staging Table)

สร้างตาราง staging สำหรับเก็บข้อมูลก่อนนำเข้าจริง:

```sql
CREATE TABLE wms_stock_import_staging (
  staging_id BIGSERIAL PRIMARY KEY,
  import_batch_id VARCHAR(100) NOT NULL,

  -- ข้อมูลจากไฟล์
  location_id VARCHAR(50),
  zone VARCHAR(50),
  row_code VARCHAR(50),
  level_code VARCHAR(50),
  loc_code VARCHAR(50),
  max_weight NUMERIC(10,3),
  max_pallet INTEGER,
  max_high VARCHAR(50),
  location_status VARCHAR(50),
  pallet_id_check VARCHAR(100),
  pallet_id_external VARCHAR(100),
  last_updated_check VARCHAR(100),
  last_updated_check_2 VARCHAR(100),
  last_updated VARCHAR(100),
  sku_id VARCHAR(50),
  product_name TEXT,
  pack_qty NUMERIC(18,2),
  piece_qty NUMERIC(18,2),
  weight_kg NUMERIC(10,3),
  lot_no VARCHAR(100),
  received_date VARCHAR(50),
  expiration_date VARCHAR(50),
  barcode VARCHAR(100),
  name_edit VARCHAR(255),
  stock_status VARCHAR(50),
  pallet_color VARCHAR(50),
  remarks TEXT,

  -- ข้อมูลเพิ่มเติม
  warehouse_id VARCHAR(50),

  -- สถานะการประมวลผล
  processing_status VARCHAR(20) DEFAULT 'pending',
  -- 'pending', 'validated', 'processed', 'error'

  validation_errors TEXT,
  processed_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by BIGINT
);

CREATE INDEX idx_import_staging_batch
  ON wms_stock_import_staging(import_batch_id);

CREATE INDEX idx_import_staging_status
  ON wms_stock_import_staging(processing_status);
```

### 5.2 Import Batch Tracking

```sql
CREATE TABLE wms_stock_import_batches (
  batch_id VARCHAR(100) PRIMARY KEY,
  batch_name VARCHAR(255),
  warehouse_id VARCHAR(50) NOT NULL,

  file_name VARCHAR(255),
  file_size BIGINT,
  total_rows INTEGER,

  validated_rows INTEGER DEFAULT 0,
  error_rows INTEGER DEFAULT 0,
  processed_rows INTEGER DEFAULT 0,

  status VARCHAR(20) DEFAULT 'uploading',
  -- 'uploading', 'validating', 'validated', 'processing', 'completed', 'failed'

  started_at TIMESTAMP,
  completed_at TIMESTAMP,

  created_by BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  validation_summary JSONB,
  processing_summary JSONB
);
```

### 5.3 API Endpoints

#### **POST /api/stock-import/upload**
- Upload CSV/Excel file
- Create import batch
- Parse and insert to staging table
- Return batch_id

#### **POST /api/stock-import/validate**
- Validate staging data
- Check SKU existence
- Check warehouse/location
- Update validation_errors
- Return validation summary

#### **POST /api/stock-import/process**
- Process validated records
- Update master_location
- Insert/Update wms_inventory_balances
- Insert wms_inventory_ledger
- Update processing_status
- Return processing summary

#### **GET /api/stock-import/batches**
- List import batches
- Filter by status, warehouse, date range

#### **GET /api/stock-import/batches/:id**
- Get batch details
- Show validation errors
- Show processing summary

#### **DELETE /api/stock-import/batches/:id**
- Delete batch และ staging records (เฉพาะที่ยังไม่ processed)

### 5.4 Service Layer

**`lib/database/stock-import.ts`**

```typescript
class StockImportService {
  // Upload & Parse
  async uploadImportFile(file, warehouseId, userId): batch
  async parseCSV(file): rows[]
  async insertToStaging(batch_id, rows, warehouseId, userId)

  // Validation
  async validateStagingData(batch_id): validationResult
  async checkSKUExists(sku_id): boolean
  async checkWarehouseExists(warehouse_id): boolean
  async checkLocationExists(location_id): location | null

  // Processing
  async processImportBatch(batch_id, userId): processResult
  async upsertLocation(locationData): location
  async upsertInventoryBalance(balanceData): balance
  async insertInventoryLedger(ledgerData): ledger
  async updateLocationQuantity(location_id, qty_delta, weight_delta)

  // Utilities
  async generateImportBatchId(): string // 'IMP-20251119-001'
  async parseDateString(dateStr): Date | null
  async parseNumberString(numStr): number
}
```

### 5.5 UI Components

**หน้า `/stock-management/import`**

```
┌─────────────────────────────────────────────────┐
│ 📦 นำเข้าสต็อกจากระบบเก่า                      │
├─────────────────────────────────────────────────┤
│                                                 │
│  ⚙️ ขั้นตอนที่ 1: เลือกคลังและไฟล์             │
│  ┌─────────────────────────────────────┐        │
│  │ คลัง: [Dropdown: WH-001]           │        │
│  │ ไฟล์: [Choose File] stock_data.csv │        │
│  │       [📤 อัพโหลด]                  │        │
│  └─────────────────────────────────────┘        │
│                                                 │
│  ⚙️ ขั้นตอนที่ 2: ตรวจสอบข้อมูล                │
│  ┌─────────────────────────────────────┐        │
│  │ Batch: IMP-20251119-001             │        │
│  │ ทั้งหมด: 150 แถว                    │        │
│  │ ✅ ถูกต้อง: 145                     │        │
│  │ ❌ ผิดพลาด: 5                       │        │
│  │                                     │        │
│  │ [📋 ดูรายละเอียด Error]             │        │
│  │ [✔️ ตรวจสอบข้อมูล]                 │        │
│  └─────────────────────────────────────┘        │
│                                                 │
│  ⚙️ ขั้นตอนที่ 3: นำเข้าข้อมูล                 │
│  ┌─────────────────────────────────────┐        │
│  │ [🚀 เริ่มนำเข้าข้อมูล]              │        │
│  │                                     │        │
│  │ กำลังประมวลผล... 45/145            │        │
│  │ [████████░░░░] 31%                  │        │
│  └─────────────────────────────────────┘        │
│                                                 │
│  📊 ประวัติการนำเข้า                            │
│  ┌─────────────────────────────────────┐        │
│  │ │Batch ID│วันที่│คลัง│จำนวน│สถานะ│ │        │
│  │ │IMP-001│19/11│WH-01│150│สำเร็จ│  │        │
│  │ │IMP-002│18/11│WH-01│80│สำเร็จ│   │        │
│  └─────────────────────────────────────┘        │
└─────────────────────────────────────────────────┘
```

**Components:**
- `StockImportUploader.tsx` - File upload component
- `StockImportValidator.tsx` - Validation results display
- `StockImportProcessor.tsx` - Processing progress
- `StockImportHistory.tsx` - Import batch history

---

## ✅ 6. Testing Plan

### 6.1 Unit Tests
- [ ] Date parsing functions
- [ ] Number parsing functions
- [ ] SKU validation
- [ ] Location code generation
- [ ] Duplicate detection logic

### 6.2 Integration Tests
- [ ] Upload CSV file → staging table
- [ ] Validate staging data
- [ ] Process import → update all tables
- [ ] Rollback on error

### 6.3 Test Cases

**Test Case 1: นำเข้า Location ใหม่ + Balance ใหม่**
```
Input: Location ยังไม่มีในระบบ, SKU มีอยู่แล้ว
Expected:
- สร้าง master_location ใหม่
- สร้าง wms_inventory_balances
- สร้าง wms_inventory_ledger
- อัพเดต current_qty และ current_weight_kg
```

**Test Case 2: นำเข้า Balance เพิ่มในตำแหน่งเดิม**
```
Input: Location มีอยู่แล้ว, Balance มีอยู่แล้ว (SKU + Location + Pallet เหมือนกัน)
Expected:
- ไม่สร้าง master_location
- UPDATE wms_inventory_balances (เพิ่มจำนวน)
- INSERT wms_inventory_ledger (audit trail)
- อัพเดต master_location current_qty และ current_weight_kg
```

**Test Case 3: SKU ไม่มีในระบบ**
```
Input: SKU ที่ไม่มีใน master_sku
Expected:
- บันทึก validation error
- ไม่นำเข้า record นี้
- แสดง error ในหน้า validation
```

**Test Case 4: วันที่ไม่ถูกต้อง**
```
Input: วันที่รูปแบบผิด "32/13/2025"
Expected:
- บันทึก validation error
- แปลงเป็น NULL ถ้าเป็นได้
- แสดง warning
```

---

## 📝 7. Migration Checklist

- [x] วิเคราะห์โครงสร้างข้อมูลจากระบบเก่า
- [ ] สร้าง database migration script
  - [ ] `wms_stock_import_staging` table
  - [ ] `wms_stock_import_batches` table
  - [ ] Indexes
- [ ] สร้าง TypeScript types
  - [ ] `StockImportStaging`
  - [ ] `StockImportBatch`
  - [ ] `ImportValidationResult`
- [ ] สร้าง Service Layer (`lib/database/stock-import.ts`)
- [ ] สร้าง API Routes
  - [ ] `/api/stock-import/upload`
  - [ ] `/api/stock-import/validate`
  - [ ] `/api/stock-import/process`
  - [ ] `/api/stock-import/batches`
- [ ] สร้าง UI Components
  - [ ] `StockImportUploader`
  - [ ] `StockImportValidator`
  - [ ] `StockImportProcessor`
  - [ ] `StockImportHistory`
- [ ] สร้างหน้า `/stock-management/import`
- [ ] เพิ่ม menu ใน Sidebar
- [ ] เขียน Unit Tests
- [ ] เขียน Integration Tests
- [ ] ทดสอบด้วยข้อมูลจริง
- [ ] Documentation

---

## 🎯 8. Success Criteria

### การนำเข้าสำเร็จต้อง:
1. ✅ อัพเดต `wms_inventory_balances` ถูกต้อง
2. ✅ สร้าง `wms_inventory_ledger` ครบทุก record
3. ✅ อัพเดต `master_location.current_qty` และ `current_weight_kg`
4. ✅ Transaction rollback เมื่อมี error
5. ✅ แสดง error message ที่ชัดเจน
6. ✅ สามารถ download error report เป็น CSV

### การตรวจสอบหลังนำเข้า:
```sql
-- 1. ตรวจสอบ Inventory Balances
SELECT COUNT(*) FROM wms_inventory_balances
WHERE created_at >= 'วันที่นำเข้า';

-- 2. ตรวจสอบ Inventory Ledger
SELECT COUNT(*) FROM wms_inventory_ledger
WHERE transaction_type = 'import'
AND movement_at >= 'วันที่นำเข้า';

-- 3. ตรวจสอบ Location Current Qty
SELECT location_id, current_qty, current_weight_kg
FROM master_location
WHERE updated_at >= 'วันที่นำเข้า';

-- 4. ตรวจสอบความถูกต้องของจำนวน
SELECT
  ib.location_id,
  SUM(ib.total_piece_qty) as balance_qty,
  ml.current_qty as location_qty,
  SUM(ib.total_piece_qty) - ml.current_qty as difference
FROM wms_inventory_balances ib
JOIN master_location ml ON ml.location_id = ib.location_id
GROUP BY ib.location_id, ml.current_qty
HAVING SUM(ib.total_piece_qty) <> ml.current_qty;
```

---

**สร้างโดย:** Claude Code
**วันที่:** 19 พฤศจิกายน 2025
**เวอร์ชัน:** 1.0
