# การวิเคราะห์ระบบ Import Orders

วันที่: 6 พฤศจิกายน 2025

---

## ภาพรวมระบบ

ระบบรองรับการนำเข้าออเดอร์ 3 ประเภท:

1. **Route Planning** - ออเดอร์สายรถ (ต้องจัดสาย)
2. **Express** - ออเดอร์ส่งด่วนชิ้นเดียว
3. **Special** - ออเดอร์พิเศษ/สินค้าแถม (ยังไม่รองรับใน API)

---

## โครงสร้างฐานข้อมูล

### ตาราง `wms_orders`

| Column | Type | Description |
|--------|------|-------------|
| `order_id` | BIGINT | Primary Key (Auto) |
| `order_no` | VARCHAR(100) | เลขที่ออเดอร์ (Unique) |
| **`order_type`** | ENUM | `'route_planning'`, `'express'`, `'special'` |
| `order_date` | DATE | วันที่สั่งซื้อ |
| `sequence_no` | VARCHAR(50) | ลำดับที่ (สำหรับ express) |
| `warehouse_id` | VARCHAR(50) | รหัสคลังสินค้า |
| `customer_id` | VARCHAR(50) | รหัสลูกค้า |
| `shop_name` | VARCHAR(255) | ชื่อร้านค้า |
| `province` | VARCHAR(100) | จังหวัด |
| `phone` | VARCHAR(50) | เบอร์โทร |
| `payment_type` | ENUM | `'cash'`, `'credit'` |
| `pickup_datetime` | TIMESTAMP | วันเวลารับสินค้า (route_planning) |
| `delivery_date` | DATE | วันที่ส่ง |
| `matched_trip_id` | BIGINT | เที่ยวรถที่แมพ (สำหรับ special) |
| `status` | VARCHAR | `'draft'`, `'confirmed'`, etc. |
| `total_items` | INTEGER | จำนวนรายการ |
| `total_qty` | NUMERIC | ปริมาณรวม |
| `total_weight` | NUMERIC | น้ำหนักรวม |
| `total_pack_all` | INTEGER | แพ็ครวม |
| `pack_12_bags` | INTEGER | แพ็ค 12 ถุง |
| `pack_4` | INTEGER | แพ็ค 4 |
| `pack_6` | INTEGER | แพ็ค 6 |
| `pack_2` | INTEGER | แพ็ค 2 |
| `pack_1` | INTEGER | แพ็ค 1 |
| `notes` | TEXT | หมายเหตุ |
| `import_file_name` | VARCHAR | ชื่อไฟล์ที่ import |
| `import_file_type` | VARCHAR | ประเภทไฟล์ที่ import |

### ตาราง `wms_order_items`

| Column | Type | Description |
|--------|------|-------------|
| `order_item_id` | BIGINT | Primary Key (Auto) |
| `order_id` | BIGINT | FK to wms_orders |
| `line_no` | INTEGER | ลำดับรายการ |
| `sku_id` | VARCHAR(50) | รหัสสินค้า |
| `sku_name` | VARCHAR(255) | ชื่อสินค้า |
| `number_field_additional_1` | NUMERIC | ฟิลด์เพิ่มเติม 1 |
| `order_qty` | NUMERIC | จำนวนสั่ง |
| `order_weight` | NUMERIC | น้ำหนัก |
| `pack_all` | INTEGER | แพ็ครวม |
| `pack_12_bags` | INTEGER | แพ็ค 12 ถุง |
| `pack_4` | INTEGER | แพ็ค 4 |
| `pack_6` | INTEGER | แพ็ค 6 |
| `pack_2` | INTEGER | แพ็ค 2 |
| `pack_1` | INTEGER | แพ็ค 1 |
| `picked_qty` | NUMERIC | จำนวนจัดแล้ว |

---

## โครงสร้างไฟล์ CSV

### 1. Route Planning CSV

**Columns (21 คอลัมน์):**

| Index | Column Name | Example | Used In |
|-------|-------------|---------|---------|
| 0 | วันที่สั่ง | `14 10 2025` | `order_date` |
| 1 | คลังสินค้า | `WH01` | `warehouse_id` |
| 2 | ประเภทชำระเงิน | `เครดิต` / `เงินสด` | `payment_type` |
| 3 | เลขที่ออเดอร์ | `ORD-2025-001` | `order_no` |
| 4 | รหัสลูกค้า | `CUST001` | `customer_id` |
| 5 | ชื่อร้านค้า | `ร้านค้าตัวอย่าง` | `shop_name` |
| 6 | จังหวัด | `กรุงเทพ` | `province` |
| 7 | รหัสสินค้า | `SKU001` | `sku_id` |
| 8 | ชื่อสินค้า | `สินค้าตัวอย่าง` | `sku_name` |
| 9 | ฟิลด์เพิ่มเติม | `100.00` | `number_field_additional_1` |
| 10 | จำนวน | `50.00` | `order_qty` |
| 11 | น้ำหนัก | `25.50` | `order_weight` |
| 12 | แพ็ครวม | `10` | `pack_all` |
| 13 | แพ็ค 12 ถุง | `2` | `pack_12_bags` |
| 14 | แพ็ค 4 | `1` | `pack_4` |
| 15 | แพ็ค 6 | `1` | `pack_6` |
| 16 | แพ็ค 1 | `5` | `pack_1` |
| 17 | ฟิลด์ข้อความยาว 1 | `...` | `text_field_long_1` |
| 18 | ฟิลด์ข้อความเพิ่มเติม 4 | `...` | `text_field_additional_4` |
| 19 | วันเวลารับสินค้า | `2025-10-15 08:00:00` | `pickup_datetime` |
| 20 | หมายเหตุ | `...` | `notes` |

**ตัวอย่าง CSV:**
```csv
วันที่,คลัง,ชำระเงิน,เลขที่ออเดอร์,รหัสลูกค้า,ชื่อร้าน,จังหวัด,รหัสสินค้า,ชื่อสินค้า,ฟิลด์เพิ่มเติม,จำนวน,น้ำหนัก,แพ็ครวม,แพ็ค12ถุง,แพ็ค4,แพ็ค6,แพ็ค1,ข้อความยาว1,ข้อความเพิ่มเติม4,วันเวลารับ,หมายเหตุ
14 10 2025,WH01,เครดิต,ORD-001,CUST001,ร้านตัวอย่าง,กรุงเทพ,SKU001,สินค้าA,100,50,25.5,10,2,1,1,5,ข้อมูล1,ข้อมูล2,2025-10-15 08:00:00,หมายเหตุ
14 10 2025,WH01,เครดิต,ORD-001,CUST001,ร้านตัวอย่าง,กรุงเทพ,SKU002,สินค้าB,150,30,15.0,5,1,0,0,3,ข้อมูล1,ข้อมูล2,2025-10-15 08:00:00,หมายเหตุ
```

### 2. Express CSV

**Columns (23 คอลัมน์):**

| Index | Column Name | Example | Used In |
|-------|-------------|---------|---------|
| 0 | ลำดับ/วันที่ | `1` / `14 10 2025` | `sequence_no` / `order_date` |
| 1 | ประเภทชำระเงิน | `เครดิต` / `เงินสด` | `payment_type` |
| 2 | เลขที่ออเดอร์ | `EXP-001` | `order_no` |
| 3 | รหัสลูกค้า | `CUST002` | `customer_id` |
| 4 | ชื่อร้านค้า | `ร้านด่วน` | `shop_name` |
| 5 | จังหวัด | `ปทุมธานี` | `province` |
| 6 | รหัสสินค้า | `SKU003` | `sku_id` |
| 7 | ชื่อสินค้า | `สินค้าด่วน` | `sku_name` |
| 8 | ฟิลด์เพิ่มเติม | `200.00` | `number_field_additional_1` |
| 9 | จำนวน | `20.00` | `order_qty` |
| 10 | น้ำหนัก | `10.00` | `order_weight` |
| 11 | แพ็ครวม | `5` | `pack_all` |
| 12 | แพ็ค 12 ถุง | `1` | `pack_12_bags` |
| 13 | แพ็ค 4 | `0` | `pack_4` |
| 14 | แพ็ค 6 | `0` | `pack_6` |
| 15 | แพ็ค 2 | `0` | `pack_2` |
| 16 | แพ็ค 1 | `2` | `pack_1` |
| 17 | ฟิลด์ข้อความยาว 1 | `...` | `text_field_long_1` |
| 18 | ฟิลด์ข้อความเพิ่มเติม 1 | `...` | `text_field_additional_1` |
| 19 | เบอร์โทร | `0812345678` | `phone` |
| 20 | ฟิลด์ข้อความเพิ่มเติม 4 | `...` | `text_field_additional_4` |
| 21 | หมายเหตุ | `...` | `notes` |
| 22 | หมายเหตุเพิ่มเติม | `...` | `notes_additional` |

**ตัวอย่าง CSV:**
```csv
ลำดับ,ชำระเงิน,เลขที่ออเดอร์,รหัสลูกค้า,ชื่อร้าน,จังหวัด,รหัสสินค้า,ชื่อสินค้า,ฟิลด์เพิ่มเติม,จำนวน,น้ำหนัก,แพ็ครวม,แพ็ค12ถุง,แพ็ค4,แพ็ค6,แพ็ค2,แพ็ค1,ข้อความยาว1,ข้อความเพิ่มเติม1,เบอร์โทร,ข้อความเพิ่มเติม4,หมายเหตุ,หมายเหตุเพิ่มเติม
1,เงินสด,EXP-001,CUST002,ร้านด่วน,ปทุมธานี,SKU003,สินค้าด่วน,200,20,10,5,1,0,0,0,2,ข้อมูล1,ข้อมูล2,0812345678,ข้อมูล3,หมายเหตุ1,หมายเหตุ2
```

### 3. Special CSV (ออเดอร์พิเศษ) - ⚠️ ยังไม่รองรับ

**โครงสร้างที่แนะนำ (คล้าย Express แต่มีฟิลด์เพิ่มเติม):**

| Index | Column Name | Example | Used In |
|-------|-------------|---------|---------|
| 0 | วันที่ | `14 10 2025` | `order_date` |
| 1 | คลังสินค้า | `WH01` | `warehouse_id` |
| 2 | เลขที่ออเดอร์ | `SPEC-001` | `order_no` |
| 3 | รหัสลูกค้า | `CUST003` | `customer_id` |
| 4 | ชื่อร้านค้า | `ร้านพิเศษ` | `shop_name` |
| 5 | จังหวัด | `นนทบุรี` | `province` |
| 6 | วันที่ส่ง | `15 10 2025` | `delivery_date` |
| 7 | รหัสสินค้า | `SKU-SPEC-001` | `sku_id` |
| 8 | ชื่อสินค้า | `สินค้าแถม` | `sku_name` |
| 9 | จำนวน | `10.00` | `order_qty` |
| 10 | น้ำหนัก | `5.00` | `order_weight` |
| 11 | แพ็ครวม | `2` | `pack_all` |
| 12 | หมายเหตุ | `สินค้าแถม` | `notes` |

**ตัวอย่าง CSV:**
```csv
วันที่,คลัง,เลขที่ออเดอร์,รหัสลูกค้า,ชื่อร้าน,จังหวัด,วันที่ส่ง,รหัสสินค้า,ชื่อสินค้า,จำนวน,น้ำหนัก,แพ็ครวม,หมายเหตุ
14 10 2025,WH01,SPEC-001,CUST003,ร้านพิเศษ,นนทบุรี,15 10 2025,SKU-SPEC-001,สินค้าแถม,10,5,2,สินค้าแถมสำหรับลูกค้า
```

---

## Logic การ Import

### 1. การอ่านไฟล์ CSV
```javascript
function parseCSV(text: string): string[][] {
  // แยก lines
  // จัดการ quoted fields
  // Return array of rows
}
```

### 2. การ Parse วันที่
```javascript
function parseDate(dateStr: string): string | null {
  // รองรับรูปแบบ: "14 10 2025", "14/10/2025", "2025-10-14"
  // Return: "YYYY-MM-DD"
}
```

### 3. การจัดกลุ่มออเดอร์
- Group ตาม `order_no`
- รวม items ทั้งหมดของออเดอร์เดียวกัน
- คำนวณ totals (qty, weight, packs)

### 4. การตรวจสอบ Duplicate
- เช็คว่ามี `order_no` ซ้ำในระบบหรือไม่
- ถ้าซ้ำ → เปรียบเทียบ items
  - ถ้า items เหมือนกัน → ข้ามไป (duplicate)
  - ถ้า items ต่างกัน → แจ้ง conflict

### 5. การบันทึกลงฐานข้อมูล
1. สร้าง order header (`wms_orders`)
2. สร้าง order items (`wms_order_items`)
3. ถ้าสร้าง items ไม่สำเร็จ → ลบ order header

---

## API Endpoint

### `POST /api/orders/import`

**Request:**
```javascript
FormData {
  file: File,                    // CSV file
  fileType: 'route_planning' | 'express' | 'special',
  defaultWarehouseId?: string,   // Required for express & special
  deliveryDate?: string          // Optional delivery date override
}
```

**Response (Success):**
```json
{
  "data": {
    "message": "Import completed: 10 created, 2 duplicates skipped, 0 errors",
    "successCount": 10,
    "duplicateCount": 2,
    "errorCount": 0,
    "totalOrders": 12
  },
  "error": null
}
```

**Response (Conflicts):**
```json
{
  "data": {
    "hasConflicts": true,
    "conflicts": [
      {
        "order_no": "ORD-001",
        "existing": { /* existing order data */ },
        "new": { /* new order data */ }
      }
    ],
    "orders": [ /* all parsed orders */ ],
    "stats": {
      "total": 12,
      "new": 10,
      "duplicates": 2,
      "conflicts": 1
    }
  },
  "error": null
}
```

---

## สถานะปัจจุบัน

### ✅ รองรับแล้ว
- ✅ Route Planning import
- ✅ Express import
- ✅ Duplicate detection
- ✅ Conflict detection

### ❌ ยังไม่รองรับ
- ❌ Special order import
- ❌ หน้า UI สำหรับ import (`/receiving/orders`)
- ❌ การแมพออเดอร์พิเศษกับเที่ยวรถอัตโนมัติ
- ❌ Template CSV download

---

## แผนการพัฒนา

### Phase 1: เพิ่มการรองรับ Special Orders
1. อัพเดต API `/api/orders/import` ให้รองรับ `fileType: 'special'`
2. เพิ่ม logic สำหรับ parse Special CSV
3. Test import

### Phase 2: สร้างหน้า UI
1. สร้างหน้า `/receiving/orders`
2. Form สำหรับเลือกประเภทและอัพโหลดไฟล์
3. แสดงผลลัพธ์การ import
4. จัดการ conflicts

### Phase 3: ฟีเจอร์เพิ่มเติม
1. Download CSV template
2. แมพออเดอร์พิเศษกับเที่ยวรถอัตโนมัติ
3. แสดงประวัติการ import

---

**หมายเหตุ:** เอกสารนี้จัดทำจากการวิเคราะห์โค้ดที่มีอยู่ โครงสร้าง CSV อาจแตกต่างไปจากไฟล์จริงที่ใช้งาน
