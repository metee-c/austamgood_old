# วิเคราะห์หน้า Warehouse Inbound - เพื่อพัฒนาหน้ามือถือ
## 📱 สรุปรายละเอียดทุกมิติลอจิสติกส์ 100%

---

## 🎯 1. ภาพรวมระบบ Inbound

### วัตถุประสงค์หลัก
หน้า Warehouse Inbound (/warehouse/inbound) เป็นระบบจัดการการรับสินค้าเข้าคลัง (Inbound Management) ที่ครอบคลุมตั้งแต่การสร้างเอกสารรับเข้า การจัดการพาเลท การสแกนบาร์โค้ด การจัดเก็บ และการติดตามสถานะ

### Use Cases หลัก
1. **สร้างเอกสารรับสินค้าใหม่** - บันทึกการรับสินค้าจากผู้จำหน่าย/ลูกค้า
2. **ค้นหาและกรองเอกสาร** - หาเอกสารรับเข้าตามเงื่อนไขต่างๆ
3. **ดูรายละเอียดและติดตามสถานะ** - ดูข้อมูลสินค้าในแต่ละเอกสาร
4. **สแกนพาเลทภายนอก** - บันทึกรหัสพาเลทจากผู้จำหน่าย
5. **พิมพ์ลาเบลพาเลท** - พิมพ์สติ๊กเกอร์ติดพาเลท (4x6 นิ้ว)
6. **แก้ไขเอกสาร** - ปรับปรุงข้อมูลการรับสินค้า

---

## 🗄️ 2. โครงสร้างข้อมูล (Data Structure)

### 2.1 ตาราง wms_receives (Header)
```typescript
interface ReceiveHeader {
  receive_id: number;           // PK: รหัสอ้างอิง
  receive_no: string;           // เลขที่เอกสารรับ (เช่น RCV-2025-001)
  receive_type: ReceiveType;    // ประเภทการรับ
  reference_doc?: string;        // เลขที่อ้างอิง (PO, DO, ฯลฯ)
  supplier_id?: string;          // FK: ผู้จำหน่าย
  customer_id?: string;          // FK: ลูกค้า
  warehouse_id: string;          // FK: คลังสินค้า (Required)
  receive_date: string;          // วันที่รับสินค้า
  received_by?: number;          // FK: พนักงานผู้รับ (master_employee)
  status: ReceiveStatus;         // สถานะเอกสาร
  notes?: string;                // หมายเหตุ
  receive_images?: string[];     // URLs รูปภาพ
  receive_image_names?: string[]; // ชื่อไฟล์รูปภาพ
  receive_image_count?: number;  // จำนวนรูปภาพ
  created_by?: number;           // FK: ผู้สร้างเอกสาร
  created_at: string;            // วันเวลาที่สร้าง
  updated_at: string;            // วันเวลาที่แก้ไข
}
```

### 2.2 ตาราง wms_receive_items (Line Items)
```typescript
interface ReceiveItem {
  item_id: number;               // PK: รหัสรายการ
  receive_id: number;            // FK: เชื่อมกับ wms_receives
  sku_id: string;                // FK: รหัสสินค้า (master_sku)
  product_name?: string;         // ชื่อสินค้า (cache)
  barcode?: string;              // บาร์โค้ด (cache)
  production_date?: string;      // วันที่ผลิต (MFG)
  expiry_date?: string;          // วันหมดอายุ (EXP)
  pack_quantity: number;         // จำนวนแพ็ค
  piece_quantity: number;        // จำนวนชิ้น
  weight_kg?: number;            // น้ำหนัก (กก.)
  pallet_id?: string;            // รหัสพาเลทภายใน (ระบบสร้าง)
  pallet_id_external?: string;   // รหัสพาเลทภายนอก (จากผู้จำหน่าย)
  pallet_scan_status: PalletScanStatus; // สถานะการสแกน
  location_id?: string;          // FK: ตำแหน่งจัดเก็บ
  received_date?: string;        // วันที่รับจริง
  created_by?: number;           // ผู้สร้างรายการ
  created_at: string;            // วันเวลาที่สร้าง
  updated_at: string;            // วันเวลาที่แก้ไข
}
```

### 2.3 ENUM Types
```typescript
// ประเภทการรับสินค้า (5 ประเภท)
type ReceiveType =
  | 'รับสินค้าปกติ'         // Normal goods receipt
  | 'รับสินค้าชำรุด'         // Damaged goods
  | 'รับสินค้าหมดอายุ'       // Expired goods
  | 'รับสินค้าคืน'           // Return from customer
  | 'รับสินค้าตีกลับ';       // Rejected goods

// สถานะเอกสาร (4 สถานะ)
type ReceiveStatus =
  | 'รอรับเข้า'              // Pending receipt
  | 'รับเข้าแล้ว'            // Received
  | 'กำลังตรวจสอบ'          // Under inspection
  | 'สำเร็จ';                // Completed

// สถานะการสแกนพาเลท (3 สถานะ)
type PalletScanStatus =
  | 'ไม่จำเป็น'              // Not required
  | 'รอดำเนินการ'           // Pending scan
  | 'สแกนแล้ว';             // Scanned
```

### 2.4 Relations (Foreign Keys)
```
wms_receives
├── master_supplier (supplier_id)           // ผู้จำหน่าย
├── master_customer (customer_id)           // ลูกค้า
├── master_warehouse (warehouse_id)         // คลังสินค้า
├── master_employee (received_by)           // พนักงานผู้รับ
└── master_employee (created_by)            // ผู้สร้างเอกสาร

wms_receive_items
├── wms_receives (receive_id)               // เอกสารรับ
├── master_sku (sku_id)                     // สินค้า
├── master_location (location_id)           // ตำแหน่งจัดเก็บ
└── master_employee (created_by)            // ผู้สร้างรายการ
```

---

## 🎨 3. UI Components & Layout

### 3.1 Header Section
```
┌─────────────────────────────────────────────────────┐
│ 📦 รับสินค้าเข้าคลัง (Inbound)  [+ สร้างใบรับใหม่] │
└─────────────────────────────────────────────────────┘
```
- Title: "รับสินค้าเข้าคลัง (Inbound)"
- Primary Action: "สร้างใบรับใหม่" (เปิด Modal AddReceiveForm)

### 3.2 Search & Filter Bar
```
┌────────────────────────────────────────────────────────────────┐
│ 🔍 [ค้นหา...] | [วันเริ่ม] [วันสิ้นสุด] | [ประเภท] [สถานะ] │
└────────────────────────────────────────────────────────────────┘
```

**Filters:**
1. **Search Box** - ค้นหา:
   - เลข PO (reference_doc)
   - รหัสรับ (receive_no)
   - ผู้จำหน่าย (supplier_name)
   - คลังสินค้า (warehouse_name)

2. **Date Range:**
   - Start Date (startDate)
   - End Date (endDate)

3. **Receive Type Dropdown:**
   - ทั้งหมด (all)
   - รับสินค้าปกติ
   - รับสินค้าชำรุด
   - รับสินค้าหมดอายุ
   - รับสินค้าคืน
   - รับสินค้าตีกลับ

4. **Status Dropdown:**
   - ทั้งหมด (all)
   - รอรับเข้า
   - รับเข้าแล้ว
   - กำลังตรวจสอบ
   - สำเร็จ

### 3.3 Main Table (Summary View)
**14 คอลัมน์:**

| # | Column | Description | Sortable | Data Type |
|---|--------|-------------|----------|-----------|
| 1 | รหัสรับ | receive_no + expand icon | ✓ | String (font-mono) |
| 2 | อ้างอิง | reference_doc | ✓ | String (font-mono) |
| 3 | ประเภท | receive_type | ✓ | Badge |
| 4 | SKU | sku_id (รายการแรก) | ✓ | String (font-mono) |
| 5 | ชื่อสินค้า | product_name + count | ✓ | String |
| 6 | บาร์โค้ด | barcode | ✓ | String (font-mono) |
| 7 | ชิ้น | Total piece_quantity | ✓ | Number (blue) |
| 8 | แพ็ค | Total pack_quantity | ✓ | Number (green) |
| 9 | ผู้ส่ง | supplier_name | ✓ | String |
| 10 | ลูกค้า | customer_name | ✓ | String |
| 11 | วันรับ | receive_date | ✓ | Date (Thai format) |
| 12 | สถานะ | status | ✓ | Badge |
| 13 | ผู้รับ | employee name | ✓ | String |
| 14 | การดำเนินการ | Actions (Eye, Edit) | ✗ | Buttons |

**Visual Indicators:**
- 🟠 **Amber highlight** - แถวที่มี pending scans (pallet_scan_status = 'รอดำเนินการ')
- 🔵 **Blue text** - รหัสรับ (clickable)
- ⏬ **Chevron icon** - Expand/Collapse detail
- 🏷️ **"รอสแกน" badge** - แสดงเมื่อมี pending scans

### 3.4 Expanded Detail Table (Item Level)
เมื่อกดแถวจะขยายแสดง **13 คอลัมน์รายละเอียดสินค้า:**

| # | Column | Description | Input Type |
|---|--------|-------------|------------|
| 1 | # | Index (1, 2, 3...) | Display |
| 2 | SKU | sku_id | Display (font-mono) |
| 3 | ชื่อสินค้า | product_name (from master_sku) | Display |
| 4 | บาร์โค้ด | barcode | Display (font-mono) |
| 5 | จำนวนชิ้น | piece_quantity | Display (blue) |
| 6 | จำนวนแพ็ค | pack_quantity | Display (green) |
| 7 | รหัสพาเลท | pallet_id (internal) | Display (blue, font-mono) |
| 8 | วันที่ผลิต | production_date (MFG) | Display |
| 9 | วันหมดอายุ | expiry_date (EXP) | Display (Thai date) |
| 10 | สถานะสแกน | pallet_scan_status | Badge |
| 11 | พาเลทภายนอก | pallet_id_external | **Input** + Save button |
| 12 | ที่จัดเก็บ | location_code | Display |
| 13 | พิมพ์ลาเบล | Print pallet label | **Button** (Printer icon) |

**Summary Bar:**
```
รายละเอียดสินค้าทั้งหมด (X รายการ) | พาเลท Y | แพ็ค Z | ชิ้น W
```

### 3.5 External Pallet Scan Input
**เงื่อนไข:** แสดงเมื่อ `pallet_scan_status === 'รอดำเนินการ'`

```
┌──────────────────────────────────────────────┐
│ [QR Icon] [input: "สแกนรหัสภายนอก"] [บันทึก] │
└──────────────────────────────────────────────┘
```

**Workflow:**
1. User สแกนหรือพิมพ์รหัสพาเลทภายนอก
2. กดปุ่ม "บันทึก"
3. API Call: `POST /api/receive/update-external-pallet`
   ```json
   {
     "itemId": 123,
     "externalPalletId": "EXT-PALLET-001"
   }
   ```
4. หลังบันทึกสำเร็จ:
   - `pallet_scan_status` → 'สแกนแล้ว'
   - `pallet_id_external` → บันทึกรหัส
   - Input field → Display only
5. Alert + Refetch data

---

## 🖨️ 4. Pallet Label Printing System

### 4.1 Label Specifications
- **Size:** 4 x 6 inches (10.16 x 15.24 cm)
- **Format:** HTML window.print()
- **Barcode:** CODE128 (via JsBarcode library)
- **Fonts:** Arial, Sarabun, Courier New
- **Colors:** Black and white only

### 4.2 Label Layout Structure
```
┌─────────────────────────────────────┐
│ ┌─────────────────────────────────┐ │ 1. Barcode Section
│ │ [CODE128 BARCODE GRAPHIC]       │ │    - SVG Barcode (45px height)
│ │ ATG202511200000001               │ │    - Text below (16px, bold)
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ วันที่รับสินค้า : 20/11/2025        │ 2. Main Info Table
│ SKU : B-BEY-C|LAM|010               │    - Receive date (14px)
│ Name : Buzz Beyond แมวโต รสแกะ...  │    - SKU (17px, bold)
│ ┌──────────────┬─────────────────┐  │    - Product name (14px)
│ │ จำนวนแพ็ค    │ จำนวนชิ้น       │  │    - Quantities (32px, bold)
│ │      17      │      200        │  │
│ └──────────────┴─────────────────┘  │
├─────────────────────────────────────┤
│ รายละเอียดวันรับ/วันหมดอายุ        │ 3. Dates Section
│ วันที่ผลิต : 08/11/2025 (24px)     │    - MFG date (24px, bold)
│ วันที่หมดอายุ : 29/11/2025 (24px)  │    - EXP date (24px, bold)
├─────────────────────────────────────┤
│ ชื่อผู้รับ : สมชาย ใจดี (18px)     │ 4. Receiver Section
│                ..................   │    - Name (18px)
└─────────────────────────────────────┘    - Dotted underline
```

### 4.3 Label Data Mapping
```typescript
interface PalletLabelData {
  barcode: string;              // pallet_id_external OR pallet_id OR sku.barcode
  sku_id: string;               // item.sku_id
  product_name: string;         // master_sku.sku_name OR item.product_name
  pack_quantity: number;        // item.pack_quantity
  piece_quantity: number;       // item.piece_quantity
  production_date?: string;     // วันที่รับสินค้า (receive date)
  manufacture_date?: string;    // วันที่ผลิต (item.production_date)
  expiry_date?: string;         // วันหมดอายุ (item.expiry_date)
  pallet_id_external?: string;  // รหัสพาเลทภายนอก
  receiver_name?: string;       // received_by_employee (first_name + last_name)
}
```

**Date Formatting:**
- Input: ISO 8601 (YYYY-MM-DD)
- Output: Thai format (DD/MM/YYYY)
- Empty values: "-"

### 4.4 Print Workflow
1. Click printer icon (Printer component from lucide-react)
2. Generate barcode SVG using JsBarcode
3. Open new window with print content
4. Auto-print after 250ms delay
5. Auto-close window after print

---

## 📊 5. Sorting System

### Sortable Fields (13 fields)
All columns except "การดำเนินการ" are sortable:

```typescript
const sortFields = {
  'receive_no': 'String comparison',
  'reference_doc': 'String comparison',
  'receive_type': 'String comparison',
  'sku_id': 'String comparison (first item)',
  'product_name': 'String comparison (first item)',
  'barcode': 'String comparison (first item)',
  'piece_quantity': 'Number comparison (sum of all items)',
  'pack_quantity': 'Number comparison (sum of all items)',
  'supplier_name': 'String comparison',
  'customer_name': 'String comparison',
  'receive_date': 'Date comparison',
  'status': 'String comparison',
  'employee_name': 'String comparison (first_name + last_name)'
};
```

**Sort Icons:**
- ⏸️ No sort: `ChevronsUpDown`
- ⬆️ Ascending: `ChevronUp`
- ⬇️ Descending: `ChevronDown`

**Sort Logic:**
1. Click column header → Toggle sort
2. First click → Ascending
3. Second click → Descending
4. Third click → Back to ascending (no clear)
5. Sorting is client-side (after data fetch)

---

## 🔄 6. State Management

### 6.1 Component State (14 states)
```typescript
const [searchTerm, setSearchTerm] = useState('');
const [selectedType, setSelectedType] = useState<ReceiveType | 'all'>('all');
const [selectedStatus, setSelectedStatus] = useState<ReceiveStatus | 'all'>('all');
const [startDate, setStartDate] = useState('');
const [endDate, setEndDate] = useState('');
const [showAddModal, setShowAddModal] = useState(false);
const [showEditModal, setShowEditModal] = useState(false);
const [selectedReceive, setSelectedReceive] = useState<ReceiveWithItems | null>(null);
const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});
const [externalPalletIds, setExternalPalletIds] = useState<Record<string, string>>({});
const [savingPalletIds, setSavingPalletIds] = useState<Record<string, boolean>>({});
const [sortField, setSortField] = useState<string>('');
const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
```

### 6.2 Data Fetching (SWR-based)
```typescript
// Main data hook
const { data: receives, loading, error, refetch } = useReceives(filters);

// Dashboard stats hook
const { data: dashboardData, loading: dashboardLoading } = useReceiveDashboard();
```

**API Endpoint:** `GET /api/receives?{filters}`

**Query Parameters:**
- `receive_type` - ประเภทการรับ
- `status` - สถานะ
- `searchTerm` - ค้นหา
- `startDate` - วันเริ่มต้น
- `endDate` - วันสิ้นสุด

---

## 🛠️ 7. API Endpoints

### 7.1 GET /api/receives
**Purpose:** ดึงรายการเอกสารรับทั้งหมด

**Query Parameters:**
```typescript
interface QueryParams {
  receive_type?: ReceiveType;
  status?: ReceiveStatus;
  warehouse_id?: string;
  startDate?: string;      // ISO date
  endDate?: string;        // ISO date
  searchTerm?: string;     // Search in receive_no, reference_doc
}
```

**Response:**
```typescript
{
  data: ReceiveWithItems[];
  error: null | string;
}

type ReceiveWithItems = ReceiveHeader & {
  wms_receive_items: (ReceiveItem & {
    master_sku?: { sku_name: string; barcode: string; };
    master_location?: { location_code: string; location_name?: string; };
  })[];
  master_supplier: { supplier_name: string } | null;
  master_customer: { customer_name: string } | null;
  received_by_employee: { first_name: string; last_name: string } | null;
  created_by_employee: { first_name: string; last_name: string } | null;
};
```

**Query Details:**
```sql
SELECT *,
  wms_receive_items(*, master_sku(sku_name, barcode), master_location(location_code, location_name)),
  master_supplier(supplier_name),
  master_customer(customer_name),
  master_warehouse(warehouse_name),
  received_by_employee:master_employee!received_by(first_name, last_name),
  created_by_employee:master_employee!created_by(first_name, last_name)
FROM wms_receives
ORDER BY receive_date DESC
```

### 7.2 POST /api/receives
**Purpose:** สร้างเอกสารรับใหม่

**Request Body:**
```typescript
interface CreateReceivePayload {
  // Header
  receive_type: ReceiveType;
  reference_doc?: string;
  supplier_id?: string;
  customer_id?: string;
  warehouse_id: string;           // Required
  receive_date: string;           // Required
  received_by?: number;
  status: ReceiveStatus;
  notes?: string;
  receive_images?: string[];
  receive_image_names?: string[];
  created_by?: number;

  // Items (min 1 item required)
  items: Array<{
    sku_id: string;                // Required
    piece_quantity: number;        // Required
    pack_quantity: number;
    production_date?: string;
    expiry_date?: string;
    weight_kg?: number;
    pallet_id?: string;
    pallet_id_external?: string;
    pallet_scan_status: PalletScanStatus;
    location_id?: string;
  }>;
}
```

**Response:**
```typescript
{
  data: ReceiveHeader;
  error: null | string;
}
```

### 7.3 PATCH /api/receives/[id]
**Purpose:** แก้ไขเอกสารรับ

**Request Body:**
```typescript
Partial<ReceiveHeader> // Any field from ReceiveHeader
```

### 7.4 POST /api/receive/update-external-pallet
**Purpose:** บันทึกรหัสพาเลทภายนอก

**Request Body:**
```typescript
{
  itemId: number;                 // wms_receive_items.item_id
  externalPalletId: string;       // รหัสพาเลทภายนอก
}
```

**Process:**
1. Update `pallet_id_external` = externalPalletId
2. Update `pallet_scan_status` = 'สแกนแล้ว'
3. Return success/error

**Response:**
```typescript
{
  data: boolean;
  error: null | string;
}
```

### 7.5 GET /api/receives/dashboard
**Purpose:** ดึงสถิติภาพรวม

**Response:**
```typescript
{
  data: {
    totalToday: number;
    byType: Record<ReceiveType, number>;
    byStatus: Record<ReceiveStatus, number>;
  };
  error: null | string;
}
```

### 7.6 POST /api/receives/generate-pallet-id
**Purpose:** สร้างรหัสพาเลทอัตโนมัติ

**Request Body (Optional):**
```typescript
{
  count?: number;  // จำนวนพาเลทที่ต้องการสร้าง
}
```

**Response:**
```typescript
{
  data: string | string[];  // Single ID or array of IDs
  error: null | string;
}
```

### 7.7 GET /api/receives/latest-pallet-id
**Purpose:** ดึงรหัสพาเลทล่าสุด

**Response:**
```typescript
{
  data: string;  // เช่น "ATG202511200000001"
  error: null | string;
}
```

---

## 📝 8. Form - Add/Edit Receive

### 8.1 Form Structure (AddReceiveForm Component)

**Form Fields (Total: 20+ fields)**

#### Header Section:
1. **receive_type** (Required) - ประเภทการรับ
   - Type: Select dropdown
   - Options: 5 types (รับสินค้าปกติ, รับสินค้าชำรุด, etc.)

2. **reference_doc** (Optional) - เลขที่อ้างอิง
   - Type: Text input
   - Example: PO-2025-001, DO-12345

3. **supplier_id** (Optional) - ผู้จำหน่าย
   - Type: ComboBox (searchable)
   - Can add new supplier inline

4. **customer_id** (Optional) - ลูกค้า
   - Type: ComboBox (searchable)

5. **warehouse_id** (Required) - คลังสินค้า
   - Type: Select dropdown
   - Data from: master_warehouse

6. **receive_date** (Required) - วันที่รับสินค้า
   - Type: Date input
   - Default: Today

7. **received_by** (Optional) - พนักงานผู้รับ
   - Type: Select dropdown
   - Data from: master_employee (system_users)

8. **status** (Required) - สถานะ
   - Type: Select dropdown
   - Default: 'รอรับเข้า'
   - Options: 4 statuses

9. **notes** (Optional) - หมายเหตุ
   - Type: Textarea

10. **receive_images** (Optional) - รูปภาพ
    - Type: File upload (multiple)
    - Support: Image files
    - Display: Thumbnail preview with delete option

#### Pallet Configuration:
11. **pallet_box_option** - ตัวเลือกพาเลท
    - Type: Radio buttons
    - Options:
      * ไม่สร้าง_Pallet_ID
      * สร้าง_Pallet_ID
      * สร้าง_Pallet_ID_รวม
      * สร้าง_Pallet_ID_และ_Box_ID
      * สร้าง_Pallet_ID_และ_สแกน_Pallet_ID_ภายนอก

12. **pallet_calculation_method** - วิธีคำนวณ
    - Type: Radio buttons
    - Options:
      * ใช้จำนวนจากมาสเตอร์สินค้า
      * กำหนดจำนวนเอง

13. **mixed_pallet_mode** - โหมด Mixed Pallet
    - Type: Checkbox
    - Purpose: สินค้าหลายรายการต่อพาเลท

14. **custom_pieces_per_pallet** (Optional)
    - Type: Number input
    - Condition: When pallet_calculation_method = 'กำหนดจำนวนเอง'

15. **pieces_per_box** (Optional)
    - Type: Number input

16. **external_pallet_id** (Optional)
    - Type: Text input

#### Items Section (Array of Items):
**Dynamic field array** - เพิ่ม/ลบได้

Per Item Fields (10 fields):
17. **sku_id** (Required) - รหัสสินค้า
    - Type: ComboBox (searchable)
    - Data from: master_sku

18. **product_name** (Auto-filled) - ชื่อสินค้า
    - Type: Display (from master_sku)

19. **barcode** (Auto-filled) - บาร์โค้ด
    - Type: Display (from master_sku)

20. **production_date** (Optional) - วันที่ผลิต
    - Type: Date input

21. **expiry_date** (Optional) - วันหมดอายุ
    - Type: Date input

22. **pack_quantity** (Required) - จำนวนแพ็ค
    - Type: Number input
    - Min: 0

23. **piece_quantity** (Required) - จำนวนชิ้น
    - Type: Number input
    - Min: 0

24. **weight_kg** (Optional) - น้ำหนัก
    - Type: Number input
    - Unit: กก.

25. **location_id** (Optional) - ตำแหน่งจัดเก็บ
    - Type: ComboBox (searchable)
    - Data from: master_location

26. **pallet_id** (Auto-generated) - รหัสพาเลทภายใน
    - Type: Display (system-generated)

27. **pallet_id_external** (Optional) - รหัสพาเลทภายนอก
    - Type: Text input

28. **pallet_scan_status** (Auto-set) - สถานะการสแกน
    - Type: Hidden/Auto
    - Logic:
      * 'ไม่จำเป็น' - ถ้าไม่เลือกสแกน
      * 'รอดำเนินการ' - ถ้าเลือกสแกนแต่ยังไม่สแกน
      * 'สแกนแล้ว' - ถ้าสแกนแล้ว

29. **generate_pallet** (Checkbox) - สร้างพาเลทให้รายการนี้
    - Type: Checkbox
    - Per item option

### 8.2 Form Validation Schema (Zod)
```typescript
const receiveFormSchema = z.object({
  // Header validation
  receive_type: z.enum([...]),
  warehouse_id: z.string().min(1, 'กรุณาเลือกคลังสินค้า'),
  receive_date: z.string().min(1, 'กรุณาเลือกวันที่รับสินค้า'),
  status: z.enum([...]).default('รอรับเข้า'),

  // Items validation (min 1 item)
  items: z.array(
    z.object({
      sku_id: z.string().min(1, 'กรุณาเลือก SKU'),
      pack_quantity: z.number().min(0, 'จำนวนแพ็คต้องไม่น้อยกว่า 0'),
      piece_quantity: z.number().min(0, 'จำนวนชิ้นต้องไม่น้อยกว่า 0'),
      // ... other item fields
    })
  ).min(1, 'กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ'),

  // Optional fields...
});
```

### 8.3 Form Actions

**Add Mode (isEditMode = false):**
1. Empty form with default values
2. Submit → POST /api/receives
3. On success:
   - Close modal
   - Refetch data
   - Show success message

**Edit Mode (isEditMode = true):**
1. Pre-fill form with editData
2. Submit → PATCH /api/receives/[id]
3. On success:
   - Close modal
   - Refetch data
   - Show success message

**Field Array Operations:**
- Add Item: `append({ sku_id: '', ... })`
- Remove Item: `remove(index)`
- Update Item: `setValue('items.${index}.field', value)`

**Pallet Generation:**
- Trigger: Based on `pallet_box_option`
- API: POST /api/receives/generate-pallet-id
- Result: Assign `pallet_id` to each item
- Preview: Show generated IDs before submit

---

## 🎯 9. Business Logic & Workflows

### 9.1 Normal Receive Workflow
```
1. สร้างเอกสารรับ (Create Document)
   ↓
2. เลือกประเภท + กรอกข้อมูล Header
   ↓
3. เพิ่มรายการสินค้า (Add Items)
   ↓
4. เลือกตัวเลือกพาเลท (Pallet Options)
   ├─ ไม่สร้าง → บันทึกโดยไม่มี pallet_id
   ├─ สร้าง_Pallet_ID → Generate pallet_id อัตโนมัติ
   ├─ สร้าง_Pallet_ID_รวม → สร้าง pallet_id เดียวใช้ร่วม
   ├─ สร้าง_Pallet_ID_และ_Box_ID → สร้างทั้งพาเลทและบ็อกซ์
   └─ สร้าง_Pallet_ID_และ_สแกน → สร้างพาเลท + ต้องสแกนภายนอก
   ↓
5. บันทึกเอกสาร (Save)
   ↓
6. [ถ้าเลือกสแกน] สแกนพาเลทภายนอก
   ├─ Status: รอดำเนินการ (Pending)
   ├─ User สแกนรหัส
   ├─ บันทึกรหัสภายนอก
   └─ Status: สแกนแล้ว (Scanned)
   ↓
7. [Optional] พิมพ์ลาเบลพาเลท
   ↓
8. [Optional] จัดเก็บสินค้า (Putaway)
   ├─ กำหนด location_id
   └─ Update inventory balance
   ↓
9. เปลี่ยนสถานะเป็น "สำเร็จ"
```

### 9.2 Pallet ID Generation Logic

**Format:** `ATG + YYYYMMDD + Sequential (7 digits)`
- Example: `ATG202511200000001`
- ATG: Prefix (Austamgood)
- 20251120: Date (20 Nov 2025)
- 0000001: Sequential number

**Calculation Methods:**

**A. ใช้จำนวนจากมาสเตอร์สินค้า:**
```typescript
// จาก master_sku
const piecesPerPallet = sku.pieces_per_pallet || 100;
const numberOfPallets = Math.ceil(item.piece_quantity / piecesPerPallet);

// สร้างพาเลทตามจำนวน
for (let i = 0; i < numberOfPallets; i++) {
  generatePalletId();
}
```

**B. กำหนดจำนวนเอง:**
```typescript
// ใช้ custom_pieces_per_pallet จาก form
const piecesPerPallet = form.custom_pieces_per_pallet;
const numberOfPallets = Math.ceil(item.piece_quantity / piecesPerPallet);
```

**Mixed Pallet Mode:**
- สินค้าหลายรายการอยู่ในพาเลทเดียว
- ใช้ shared_pallet_id ร่วมกัน
- ลดการสร้างพาเลทซ้ำซ้อน

### 9.3 External Pallet Scan Workflow
```
Start: item.pallet_scan_status = 'รอดำเนินการ'
  ↓
1. แสดง Input field + QR Icon
  ↓
2. User สแกนหรือพิมพ์รหัส
  ↓
3. Input value → state: externalPalletIds[item_id]
  ↓
4. กดปุ่ม "บันทึก"
  ↓
5. Validation:
   - ตรวจสอบ input ไม่ว่าง
   - Trim whitespace
  ↓
6. API Call: POST /api/receive/update-external-pallet
   Body: { itemId, externalPalletId }
  ↓
7. Database Update:
   - pallet_id_external = input value
   - pallet_scan_status = 'สแกนแล้ว'
   - updated_at = NOW()
  ↓
8. Frontend Update:
   - Show success alert
   - Refetch data
   - Input → Display only
   - Badge: รอดำเนินการ → สแกนแล้ว
  ↓
End
```

### 9.4 Inventory Ledger Integration
เมื่อบันทึกเอกสารรับ → สร้าง Inventory Ledger Entry อัตโนมัติ

**Trigger:** `receive_to_ledger` database trigger

**Ledger Entry:**
```sql
INSERT INTO wms_inventory_ledger (
  sku_id,
  warehouse_id,
  location_id,
  transaction_type,       -- 'รับเข้า'
  transaction_date,       -- receive_date
  quantity_change,        -- + piece_quantity
  reference_doc_type,     -- 'wms_receives'
  reference_doc_no,       -- receive_no
  reference_doc_id,       -- receive_id
  notes,
  created_at
) VALUES (...);
```

---

## 🔍 10. Badge System (Visual Status Indicators)

### 10.1 Receive Type Badges
```typescript
const receiveTypeBadges = {
  'รับสินค้าปกติ':      { variant: 'info',    color: 'blue'   },
  'รับสินค้าชำรุด':     { variant: 'danger',  color: 'red'    },
  'รับสินค้าหมดอายุ':   { variant: 'warning', color: 'yellow' },
  'รับสินค้าคืน':       { variant: 'warning', color: 'yellow' },
  'รับสินค้าตีกลับ':    { variant: 'default', color: 'gray'   }
};
```

### 10.2 Status Badges
```typescript
const statusBadges = {
  'รอรับเข้า':         { variant: 'default', color: 'gray'   },
  'รับเข้าแล้ว':       { variant: 'info',    color: 'blue'   },
  'กำลังตรวจสอบ':     { variant: 'warning', color: 'yellow' },
  'สำเร็จ':            { variant: 'success', color: 'green'  }
};
```

### 10.3 Pallet Scan Status Badges
```typescript
const palletScanBadges = {
  'ไม่จำเป็น':        { variant: 'secondary', color: 'gray'   },
  'รอดำเนินการ':      { variant: 'warning',   color: 'amber'  },
  'สแกนแล้ว':         { variant: 'success',   color: 'green'  }
};
```

### 10.4 Row Highlighting
```typescript
// Amber background for pending scans
if (hasPendingScans) {
  className = 'bg-amber-50/30 border-l-2 border-amber-400';
}

// Gray background for expanded row
if (isExpanded) {
  className = 'bg-gray-50';
}
```

---

## 📐 11. Responsive Design & Styling

### 11.1 Layout Structure
```
Container (h-screen, overflow-hidden)
├── Header (flex-shrink-0)
├── Search & Filters (flex-shrink-0)
└── Table Container (flex-1, min-h-0)
    ├── Table Header (sticky top-0)
    ├── Table Body (overflow-y-auto)
    │   ├── Summary Rows
    │   └── Expanded Detail Rows
    └── Empty State
```

### 11.2 Key CSS Classes

**Colors:**
```css
/* Primary colors */
blue-600       /* Links, receive_no */
green-600      /* Pack quantity */
blue-600       /* Piece quantity */
amber-50/30    /* Pending scan highlight */
gray-50        /* Expanded row background */

/* Text colors */
thai-gray-900  /* Title */
thai-gray-700  /* Normal text */
thai-gray-600  /* Secondary text */
thai-gray-400  /* Placeholder, disabled */
```

**Fonts:**
```css
font-thai      /* Sarabun, Noto Sans Thai */
font-mono      /* Courier New (codes, IDs) */
font-semibold  /* Bold text */
font-bold      /* Extra bold */
```

**Spacing:**
```css
px-2 py-0.5    /* Table cell padding */
px-4 py-3      /* Detail section padding */
gap-2, gap-3   /* Space between elements */
space-x-0.5    /* Action button spacing */
```

**Borders:**
```css
border-gray-100     /* Table cell borders */
border-gray-200     /* Section borders */
border-l-2          /* Left accent border */
rounded-lg          /* Rounded corners */
```

### 11.3 Table Styling
- **Sticky header:** `position: sticky; top: 0;`
- **Horizontal scroll:** Custom scrollbar
- **Row hover:** `hover:bg-blue-50/30`
- **Font size:** `text-[11px]` (body), `text-xs` (header)
- **Compact padding:** `px-2 py-0.5`

---

## ⚡ 12. Performance Considerations

### 12.1 Data Fetching
- **SWR caching** - Automatic revalidation
- **Conditional fetching** - Only when filters change
- **Optimistic updates** - UI updates before API response

### 12.2 Rendering Optimization
- **React.memo** - Prevent unnecessary re-renders
- **useMemo** - Memoize sorted data
- **useCallback** - Memoize event handlers
- **Conditional rendering** - Only render expanded rows when needed

### 12.3 Large Dataset Handling
- **Pagination** - (Not yet implemented, but recommended for >1000 records)
- **Virtual scrolling** - (Not yet implemented, but recommended)
- **Server-side sorting** - (Currently client-side)

---

## 🚨 13. Error Handling

### 13.1 Loading States
```typescript
if (receivesLoading) {
  return <LoadingSpinner />; // Skeleton UI
}
```

### 13.2 Error States
```typescript
if (receivesError) {
  return <ErrorMessage message={receivesError} />;
}
```

### 13.3 Empty States
```typescript
if (receives.length === 0) {
  return (
    <EmptyState
      icon={Package}
      title="ไม่พบรายการรับสินค้า"
      description="เริ่มต้นโดยการกดปุ่ม 'สร้างใบรับใหม่'"
    />
  );
}
```

### 13.4 Validation Errors
- **Form validation** - Zod schema
- **API errors** - Alert messages
- **Network errors** - Try-catch blocks

---

## 📱 14. สรุปสำหรับพัฒนาหน้ามือถือ (Mobile Development Summary)

### 14.1 Core Features ที่ต้องมี (Must-Have)
1. ✅ **ดูรายการเอกสารรับ** - List view with filters
2. ✅ **ค้นหาเอกสาร** - Search by receive_no, reference_doc
3. ✅ **ดูรายละเอียดเอกสาร** - Detail view with items
4. ✅ **สแกนพาเลทภายนอก** - QR/Barcode scanner input
5. ✅ **บันทึกรหัสพาเลท** - Update pallet_id_external
6. ✅ **ดูสถานะการสแกน** - Visual status indicators
7. ✅ **พิมพ์ลาเบลพาเลท** - Mobile-optimized print

### 14.2 Nice-to-Have Features
1. ⭕ สร้างเอกสารรับใหม่ (Simplified form)
2. ⭕ แก้ไขข้อมูลพื้นฐาน
3. ⭕ อัพโหลดรูปภาพ (Camera integration)
4. ⭕ เปลี่ยนสถานะเอกสาร
5. ⭕ แจ้งเตือนพาเลทรอสแกน (Push notifications)

### 14.3 Mobile UI Recommendations

**A. List View:**
```
┌─────────────────────────────────────┐
│ 🔍 [Search...]        [Filter: ▼]  │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ 📦 RCV-2025-001     [รอสแกน]   │ │
│ │ รับสินค้าปกติ • 20/11/2025      │ │
│ │ Supplier: ABC Co.               │ │
│ │ 17 แพ็ค • 200 ชิ้น • 3 พาเลท   │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ 📦 RCV-2025-002     [สำเร็จ]    │ │
│ │ รับสินค้าปกติ • 19/11/2025      │ │
│ │ Supplier: XYZ Ltd.              │ │
│ │ 50 แพ็ค • 1,000 ชิ้น • 10 พาเลท │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

**B. Detail View:**
```
┌─────────────────────────────────────┐
│ ← RCV-2025-001                      │
├─────────────────────────────────────┤
│ ประเภท: รับสินค้าปกติ               │
│ วันที่: 20/11/2025                  │
│ ผู้จำหน่าย: ABC Company Ltd.       │
│ สถานะ: [รับเข้าแล้ว]                │
├─────────────────────────────────────┤
│ รายการสินค้า (3)                    │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 1. B-BEY-C|LAM|010              │ │
│ │    Buzz Beyond แมวโต รสแกะ...   │ │
│ │    แพ็ค: 17 | ชิ้น: 200         │ │
│ │    ┌─────────────┬────────────┐  │ │
│ │    │ พาเลท:      │ ATG2025... │  │ │
│ │    │ สถานะ:      │ [รอสแกน]   │  │ │
│ │    └─────────────┴────────────┘  │ │
│ │    [📷 สแกนพาเลทภายนอก]         │ │
│ │    [🖨️ พิมพ์ลาเบล]              │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

**C. Scan View:**
```
┌─────────────────────────────────────┐
│ ← สแกนพาเลทภายนอก                   │
├─────────────────────────────────────┤
│         📹 Camera View              │
│    ┌─────────────────────────┐      │
│    │                         │      │
│    │    [Scanning Area]      │      │
│    │                         │      │
│    └─────────────────────────┘      │
│                                     │
│ หรือพิมพ์รหัสด้วยมือ:               │
│ [____________________________]      │
│                                     │
│ [✓ บันทึกรหัสพาเลท]                │
└─────────────────────────────────────┘
```

### 14.4 Mobile-Specific Considerations

**Touch Targets:**
- Minimum size: 48x48px
- Spacing: 8px between interactive elements

**Input Methods:**
1. **QR/Barcode Scanner** - Primary input
2. **Keyboard** - Fallback input
3. **Camera** - Image upload (optional)

**Offline Capability:**
- Cache recent data
- Queue updates when offline
- Sync when back online

**Performance:**
- Limit initial load: 50 items
- Infinite scroll for more
- Optimize images (thumbnails)
- Minimize API calls

### 14.5 API Usage for Mobile

**Priority Endpoints:**
1. `GET /api/receives?status=รับเข้าแล้ว` - ดูรายการรับเข้าล่าสุด
2. `GET /api/receives?searchTerm={scan}` - ค้นหาด้วย QR code
3. `POST /api/receive/update-external-pallet` - บันทึกการสแกน
4. `GET /api/receives/{id}` - ดูรายละเอียด

**Optional Endpoints:**
5. `POST /api/receives` - สร้างเอกสารใหม่
6. `PATCH /api/receives/{id}` - แก้ไขเอกสาร
7. `GET /api/receives/dashboard` - Dashboard stats

### 14.6 Data Sync Strategy

**Pull Strategy:**
```typescript
// เมื่อเปิดแอพ
onAppOpen() {
  fetchPendingReceives(); // สถานะ: รับเข้าแล้ว, กำลังตรวจสอบ
  fetchPendingScan();     // pallet_scan_status: รอดำเนินการ
}

// Real-time updates (optional)
useSWR('/api/receives', {
  refreshInterval: 30000  // 30 seconds
});
```

**Push Strategy:**
```typescript
// หลังสแกนสำเร็จ
onScanSuccess(externalPalletId) {
  updateExternalPallet(itemId, externalPalletId);
  invalidateCache();
  refetchData();
}
```

### 14.7 User Flow for Mobile

**Main Workflow:**
```
1. Login
   ↓
2. หน้าหลัก (Dashboard)
   - แสดงเอกสารที่รอสแกน
   - แสดงสถิติวันนี้
   ↓
3. เลือกเอกสาร
   ↓
4. ดูรายละเอียดสินค้า
   ↓
5. เลือกรายการที่รอสแกน
   ↓
6. สแกนพาเลทภายนอก
   ├─ เปิดกล้อง
   ├─ สแกน QR/Barcode
   └─ ยืนยันบันทึก
   ↓
7. อัพเดทสถานะ
   ↓
8. [Optional] พิมพ์ลาเบล
   ↓
9. กลับไปหน้ารายการ
```

---

## 📊 15. Database Schema Summary

### Tables Involved:
```
1. wms_receives            (Header table)
2. wms_receive_items       (Line items)
3. master_sku              (Product master)
4. master_supplier         (Supplier master)
5. master_customer         (Customer master)
6. master_warehouse        (Warehouse master)
7. master_location         (Storage location)
8. master_employee         (Employee/User)
9. wms_inventory_ledger    (Inventory tracking)
```

### Key Indexes (Recommended):
```sql
-- For filtering and sorting
CREATE INDEX idx_receives_date ON wms_receives(receive_date DESC);
CREATE INDEX idx_receives_status ON wms_receives(status);
CREATE INDEX idx_receives_type ON wms_receives(receive_type);
CREATE INDEX idx_receives_no ON wms_receives(receive_no);

-- For searching
CREATE INDEX idx_receives_reference ON wms_receives(reference_doc);
CREATE INDEX idx_receives_supplier ON wms_receives(supplier_id);

-- For items lookup
CREATE INDEX idx_items_receive ON wms_receive_items(receive_id);
CREATE INDEX idx_items_sku ON wms_receive_items(sku_id);
CREATE INDEX idx_items_pallet ON wms_receive_items(pallet_id);
CREATE INDEX idx_items_scan_status ON wms_receive_items(pallet_scan_status);
```

---

## 🎓 16. คำศัพท์และความหมาย (Glossary)

| ภาษาไทย | English | ความหมาย |
|---------|---------|----------|
| รับสินค้าเข้าคลัง | Inbound | การรับสินค้าเข้าคลัง |
| เอกสารรับ | Receive Document | ใบรับสินค้าเข้า |
| รหัสรับ | Receive No | เลขที่เอกสารรับ |
| เลขที่อ้างอิง | Reference Doc | เลข PO, DO, หรือเอกสารอ้างอิง |
| ผู้จำหน่าย | Supplier | บริษัทที่ส่งสินค้าให้ |
| ลูกค้า | Customer | ลูกค้าที่ส่งสินค้าคืน |
| พาเลท | Pallet | แพลตฟอร์มวางสินค้า |
| รหัสพาเลทภายใน | Internal Pallet ID | รหัสที่ระบบสร้างให้ |
| รหัสพาเลทภายนอก | External Pallet ID | รหัสจากผู้จำหน่าย |
| การสแกน | Scanning | การอ่านบาร์โค้ด/QR Code |
| จำนวนชิ้น | Piece Quantity | จำนวนหน่วยเล็กสุด |
| จำนวนแพ็ค | Pack Quantity | จำนวนกล่อง/แพ็ค |
| วันที่ผลิต | Manufacturing Date | วันที่ผลิตสินค้า (MFG) |
| วันหมดอายุ | Expiry Date | วันที่หมดอายุ (EXP) |
| ที่จัดเก็บ | Storage Location | ตำแหน่งเก็บในคลัง |
| ลาเบล | Label | สติ๊กเกอร์ติดพาเลท |

---

## ✅ 17. Checklist สำหรับการพัฒนาหน้ามือถือ

### Phase 1: Core Features
- [ ] API Integration
  - [ ] GET /api/receives (with filters)
  - [ ] GET /api/receives/{id}
  - [ ] POST /api/receive/update-external-pallet

- [ ] UI Components
  - [ ] List View (รายการเอกสาร)
  - [ ] Detail View (รายละเอียด)
  - [ ] Search & Filter
  - [ ] Status Badges

- [ ] Scanner Integration
  - [ ] QR Code Scanner
  - [ ] Barcode Scanner
  - [ ] Manual Input Fallback

- [ ] Pallet Management
  - [ ] Display Pallet Info
  - [ ] Scan External Pallet
  - [ ] Update Scan Status
  - [ ] Show Scan Progress

### Phase 2: Enhanced Features
- [ ] Label Printing
  - [ ] Mobile-optimized print layout
  - [ ] Bluetooth printer support (optional)

- [ ] Offline Mode
  - [ ] Cache recent data
  - [ ] Queue updates
  - [ ] Sync when online

- [ ] Notifications
  - [ ] Pending scan alerts
  - [ ] New receive documents
  - [ ] Scan completion feedback

### Phase 3: Advanced Features
- [ ] Create New Receive (Simplified)
- [ ] Quick Edit
- [ ] Image Upload (Camera)
- [ ] Dashboard/Statistics
- [ ] Multi-language (Thai/English)

---

## 📝 18. สรุปท้ายสุด

หน้า **Warehouse Inbound** เป็นระบบที่ครอบคลุมทุกด้านของการรับสินค้าเข้าคลัง ตั้งแต่การสร้างเอกสาร การจัดการพาเลท การสแกนบาร์โค้ด ไปจนถึงการพิมพ์ลาเบล

**จุดเด่นหลัก:**
1. ✅ ระบบจัดการเอกสารรับที่สมบูรณ์
2. ✅ รองรับหลายประเภทการรับ (5 ประเภท)
3. ✅ ติดตามสถานะตั้งแต่เริ่มต้นจนเสร็จสิ้น
4. ✅ ระบบพาเลทที่ยืดหยุ่น (5 ตัวเลือก)
5. ✅ การสแกนพาเลทภายนอกแบบ real-time
6. ✅ พิมพ์ลาเบลมาตรฐาน 4x6 นิ้ว
7. ✅ ค้นหาและกรองข้อมูลได้หลากหลาย
8. ✅ เรียงลำดับข้อมูลได้ทุกคอลัมน์
9. ✅ แสดงรายละเอียดสินค้าแบบ expandable
10. ✅ บูรณาการกับ inventory ledger

**สำหรับการพัฒนาหน้ามือถือ:**
- เน้นที่ **การสแกนพาเลท** และ **การดูรายละเอียด** เป็นหลัก
- ใช้ **Camera API** สำหรับสแกน QR/Barcode
- ออกแบบ **UI ที่เหมาะกับการใช้งานในคลังสินค้า** (ขนาดใหญ่ ชัดเจน)
- รองรับ **Offline mode** สำหรับใช้งานในพื้นที่สัญญาณไม่ดี
- เพิ่ม **Audio feedback** เมื่อสแกนสำเร็จ/ล้มเหลว

---

**เอกสารนี้สรุปทุกมิติของระบบ Inbound 100% พร้อมสำหรับการพัฒนาหน้ามือถือ** 🎯📱✨
