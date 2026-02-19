# Face Sheet Creation Workflow Analysis

## สรุปการทำงานของระบบสร้างใบปะหน้า (Face Sheet)

### 1. หน้า UI: `/receiving/picklists/face-sheets`

**ไฟล์:** `app/receiving/picklists/face-sheets/page.tsx`

**ฟังก์ชันหลัก:**
- แสดงรายการใบปะหน้าที่สร้างแล้วทั้งหมด
- สร้างใบปะหน้าใหม่จากออเดอร์ประเภท "ส่งด่วน" (express)
- พิมพ์ใบปะหน้า, ใบเช็คสินค้า, เอกสารส่งมอบ
- ลบใบปะหน้า (เฉพาะผู้ใช้ที่มีสิทธิ์)

**ขั้นตอนการสร้างใบปะหน้า:**

1. **เลือกวันส่งของ** → ระบบดึงออเดอร์ที่มี `order_type = 'express'` และ `delivery_date` ตรงกับวันที่เลือก
2. **เลือกออเดอร์** → ผู้ใช้สามารถเลือกออเดอร์ที่ต้องการสร้างใบปะหน้า (สูงสุด 60 ออเดอร์ต่อครั้ง)
3. **กดสร้าง** → เรียก API `POST /api/face-sheets/generate`

---

### 2. API Endpoint: `POST /api/face-sheets/generate`

**ไฟล์:** `app/api/face-sheets/generate/route.ts`

**Input Parameters:**
```typescript
{
  warehouse_id: string,      // คลังสินค้า (default: 'WH001')
  created_by: string,        // ผู้สร้าง
  delivery_date: string,     // วันส่งของ (YYYY-MM-DD)
  order_ids: number[]        // รายการ order_id ที่เลือก (optional)
}
```

**ขั้นตอนการทำงาน:**

#### 2.1 Validation
- ตรวจสอบว่ามี `delivery_date`
- ตรวจสอบว่า `order_ids` มีค่าและไม่เกิน 60 ออเดอร์
- กรองออเดอร์ที่มีใบปะหน้าอยู่แล้วออก (ป้องกันการสร้างซ้ำ)

#### 2.2 Validate Customer Data
- เรียก `validate_express_orders_for_face_sheet()` เพื่อตรวจสอบ:
  - ลูกค้าต้องมีข้อมูลใน `master_customer`
  - ลูกค้าต้องมีข้อมูล `hub` (ถ้าไม่มี → แสดง Modal ให้กรอก)

#### 2.3 Create Face Sheet (Atomic Transaction)
เรียก **Database Function**: `create_face_sheet_with_reservation()`

**Parameters:**
```sql
p_warehouse_id VARCHAR,
p_delivery_date DATE,
p_order_ids INTEGER[],
p_created_by VARCHAR
```

**Return:**
```typescript
{
  success: boolean,
  face_sheet_id: bigint,
  face_sheet_no: string,
  total_packages: integer,
  small_size_count: integer,
  large_size_count: integer,
  items_reserved: integer,
  message: string,
  error_details: jsonb
}
```

---

### 3. Database Function: `create_face_sheet_with_reservation()`

**ไฟล์:** `supabase/migrations/221_create_atomic_face_sheet_creation.sql`

**ขั้นตอนการทำงาน (Atomic Transaction):**

#### Step 1: Validate Input
- ตรวจสอบว่ามี `p_delivery_date`
- ตรวจสอบว่ามีออเดอร์ที่ตรงกับเงื่อนไข

#### Step 2: Generate Face Sheet Number (with Advisory Lock)
- เรียก `generate_face_sheet_no_with_lock()`
- ใช้ Advisory Lock (key = 1001) เพื่อป้องกัน duplicate number
- Format: `FS-YYYYMMDD-XXX` (เช่น `FS-20260219-001`)

#### Step 3: Create Face Sheet Header
- Insert ลงตาราง `face_sheets`:
```sql
INSERT INTO face_sheets (
  face_sheet_no,
  warehouse_id,
  delivery_date,
  status,           -- 'generated'
  created_by,
  created_at
)
```

#### Step 4: Create Face Sheet Items
- Insert ลงตาราง `face_sheet_items` จากออเดอร์:
```sql
INSERT INTO face_sheet_items (
  face_sheet_id,
  order_id,
  order_item_id,
  sku_id,
  quantity,
  uom,
  package_size,     -- 'small' (≤7kg) หรือ 'large' (>7kg)
  hub,
  customer_id,
  status,           -- 'pending'
  created_at
)
SELECT ...
FROM wms_orders o
JOIN wms_order_items oi ON oi.order_id = o.order_id
JOIN master_sku ms ON ms.sku_id = oi.sku_id
LEFT JOIN master_customer mc ON mc.customer_id = o.customer_id
WHERE o.order_type = 'express'
AND o.delivery_date = p_delivery_date
AND (p_order_ids IS NULL OR o.order_id = ANY(p_order_ids))
AND o.status IN ('draft', 'confirmed')
```

#### Step 5: Update Face Sheet Header with Counts
```sql
UPDATE face_sheets
SET 
  total_packages = v_total_packages,
  small_size_count = v_small_size_count,
  large_size_count = v_large_size_count
WHERE id = v_face_sheet_id
```

#### Step 6: Reserve Stock (CRITICAL)
- เรียก `reserve_stock_for_face_sheet_items(v_face_sheet_id, p_warehouse_id, p_created_by)`
- ถ้าจองสต็อคไม่สำเร็จ → **ROLLBACK ทั้งหมด**

#### Step 7: Update Order Status
```sql
UPDATE wms_orders
SET 
  status = 'confirmed',
  updated_at = CURRENT_TIMESTAMP
WHERE order_type = 'express'
AND delivery_date = p_delivery_date
AND (p_order_ids IS NULL OR order_id = ANY(p_order_ids))
AND status = 'draft'
```

---

### 4. ตารางฐานข้อมูลที่เกี่ยวข้อง

#### 4.1 `face_sheets` (Header)
```sql
- id (bigint, PK)
- face_sheet_no (varchar, unique)
- warehouse_id (varchar)
- delivery_date (date)
- status (varchar)           -- 'generated', 'picking', 'completed', 'cancelled'
- total_packages (integer)
- small_size_count (integer)
- large_size_count (integer)
- created_by (varchar)
- created_at (timestamp)
```

#### 4.2 `face_sheet_items` (Items)
```sql
- id (bigint, PK)
- face_sheet_id (bigint, FK → face_sheets)
- order_id (bigint, FK → wms_orders)
- order_item_id (bigint, FK → wms_order_items)
- sku_id (varchar, FK → master_sku)
- quantity (numeric)
- uom (varchar)
- package_size (varchar)     -- 'small' หรือ 'large'
- hub (varchar)
- customer_id (varchar)
- status (varchar)           -- 'pending', 'picked', 'completed'
- created_at (timestamp)
```

#### 4.3 `wms_inventory_balances` (Stock Reservation)
```sql
- balance_id (bigint, PK)
- warehouse_id (varchar)
- location_id (varchar)
- sku_id (varchar)
- lot_no (varchar)
- pallet_id (varchar)
- quantity_available (numeric)
- quantity_reserved (numeric)
- is_reserved_split (boolean)           -- TRUE = split จากการจอง
- reserved_for_document_type (varchar)  -- 'face_sheet'
- reserved_for_document_id (bigint)     -- face_sheet_id
- reservation_status (varchar)          -- 'reserved', 'picked', 'loaded'
```

#### 4.4 `wms_inventory_ledger` (Stock Movement Log)
```sql
- ledger_id (bigint, PK)
- warehouse_id (varchar)
- location_id (varchar)
- sku_id (varchar)
- lot_no (varchar)
- pallet_id (varchar)
- transaction_type (varchar)  -- 'reservation', 'pick', 'loading'
- quantity (numeric)
- direction (varchar)         -- 'IN' หรือ 'OUT'
- reference_no (varchar)      -- face_sheet_no
- created_by (varchar)
- created_at (timestamp)
```

---

### 5. Triggers ที่เกี่ยวข้อง

#### 5.1 Migration 302: Split Balance on Reservation
- เมื่อจองสต็อก → สร้าง balance ใหม่ที่ `is_reserved_split = TRUE`
- แยก `quantity_reserved` ออกจาก `quantity_available`

---

### 6. Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. UI: เลือกวันส่งของ + เลือกออเดอร์                            │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. API: POST /api/face-sheets/generate                          │
│    - Validate input                                              │
│    - Filter ออเดอร์ที่มี face sheet แล้ว                        │
│    - Validate customer data (hub)                                │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Database Function: create_face_sheet_with_reservation()      │
│    ┌─────────────────────────────────────────────────────────┐  │
│    │ BEGIN TRANSACTION (Atomic)                              │  │
│    │                                                         │  │
│    │ Step 1: Generate face_sheet_no (with Advisory Lock)    │  │
│    │         → FS-20260219-001                               │  │
│    │                                                         │  │
│    │ Step 2: INSERT INTO face_sheets                        │  │
│    │         → status = 'generated'                          │  │
│    │                                                         │  │
│    │ Step 3: INSERT INTO face_sheet_items                   │  │
│    │         → จาก wms_orders + wms_order_items             │  │
│    │         → package_size = 'small' / 'large'             │  │
│    │                                                         │  │
│    │ Step 4: UPDATE face_sheets (counts)                    │  │
│    │                                                         │  │
│    │ Step 5: reserve_stock_for_face_sheet_items()           │  │
│    │         → Split balance (is_reserved_split = TRUE)     │  │
│    │         → reserved_for_document_type = 'face_sheet'    │  │
│    │         → reservation_status = 'reserved'              │  │
│    │         → บันทึก ledger (transaction_type = 'reservation') │
│    │                                                         │  │
│    │ Step 6: UPDATE wms_orders (status = 'confirmed')       │  │
│    │                                                         │  │
│    │ COMMIT (ถ้าทุก step สำเร็จ)                            │  │
│    │ ROLLBACK (ถ้า ANY step fail)                           │  │
│    └─────────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Return Success                                                │
│    - face_sheet_no                                               │
│    - total_packages                                              │
│    - items_reserved                                              │
└─────────────────────────────────────────────────────────────────┘
```

---

### 7. สรุปการทำงาน

**API ที่ใช้:**
- `POST /api/face-sheets/generate` - สร้างใบปะหน้า
- `GET /api/face-sheets/generate` - ดึงรายการใบปะหน้า
- `GET /api/face-sheets/{id}` - ดูรายละเอียดใบปะหน้า
- `PATCH /api/face-sheets/{id}` - อัปเดตสถานะ
- `DELETE /api/face-sheets/{id}/delete` - ลบใบปะหน้า

**Database Functions:**
- `create_face_sheet_with_reservation()` - สร้างใบปะหน้าแบบ atomic
- `generate_face_sheet_no_with_lock()` - สร้างเลขที่ใบปะหน้าพร้อม lock
- `reserve_stock_for_face_sheet_items()` - จองสต็อก
- `validate_express_orders_for_face_sheet()` - ตรวจสอบข้อมูลลูกค้า

**Triggers:**
- Migration 302: Split Balance on Reservation

**ตารางที่เกี่ยวข้อง:**
- `face_sheets` - Header
- `face_sheet_items` - Items
- `wms_orders` - ออเดอร์
- `wms_order_items` - รายการสินค้าในออเดอร์
- `wms_inventory_balances` - ยอดสต็อก + การจอง
- `wms_inventory_ledger` - บันทึกการเคลื่อนไหว
- `master_sku` - ข้อมูลสินค้า
- `master_customer` - ข้อมูลลูกค้า

**จุดสำคัญ:**
1. ใช้ **Atomic Transaction** - ถ้า ANY step fail → ROLLBACK ทั้งหมด
2. ใช้ **Advisory Lock** - ป้องกัน duplicate face sheet number
3. ใช้ **Split Balance** - แยก balance ที่จองออกจาก available
4. บันทึก **Ledger** - ทุกการเคลื่อนไหวสต็อก
5. อัปเดต **Order Status** - จาก 'draft' → 'confirmed'

---

### 8. ความแตกต่างจาก Picklist

| Feature | Face Sheet | Picklist |
|---------|-----------|----------|
| ประเภทออเดอร์ | Express (ส่งด่วน) | Normal (ส่งปกติ) |
| การจัดกลุ่ม | ตาม package_size (small/large) | ตาม trip + route |
| การจองสต็อก | จองทันทีเมื่อสร้าง | จองทันทีเมื่อสร้าง |
| Location | Preparation Area → Dispatch | Preparation Area → Dispatch |
| Document No | FS-YYYYMMDD-XXX | PL-YYYYMMDD-XXX |

---

**สร้างเมื่อ:** 2026-02-19  
**ผู้สร้าง:** Kiro AI Assistant
