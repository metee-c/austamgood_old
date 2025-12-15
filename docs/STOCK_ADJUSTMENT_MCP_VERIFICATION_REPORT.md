# รายงานการตรวจสอบระบบปรับสต็อก (Stock Adjustment) ด้วย MCP Database Tools

**วันที่สร้างรายงาน:** 15 ธันวาคม 2025  
**ผู้ตรวจสอบ:** Kiro AI Assistant  
**วัตถุประสงค์:** ตรวจสอบความพร้อมของฐานข้อมูลสำหรับระบบปรับสต็อก (Stock Adjustment System)

---

## สรุปผลการตรวจสอบ (Executive Summary)

### ✅ สิ่งที่พร้อมใช้งาน
1. ตาราง `wms_inventory_ledger` มีโครงสร้างครบถ้วน (23 คอลัมน์) รวมถึง `skip_balance_sync` flag
2. ตาราง `wms_inventory_balances` มี CHECK constraints ป้องกันค่าติดลบ
3. Trigger functions พร้อมใช้งาน: `sync_inventory_ledger_to_balance()` และ `sync_location_qty_from_balance()`
4. Enum types รองรับ 'adjustment' transaction type และ 'in'/'out' directions
5. Foreign key relationships ถูกต้องครบถ้วน
6. Permission modules สำหรับ stock adjustment มีอยู่แล้ว (module_ids 211-215)

### ❌ สิ่งที่ยังขาดและต้องสร้าง
1. **ไม่มีโลเคชั่น ADJ-LOSS** (Virtual/System location สำหรับบันทึกการปรับสต็อก)
2. **ไม่มีตาราง `wms_stock_adjustments`** (Header table)
3. **ไม่มีตาราง `wms_stock_adjustment_items`** (Line items table)
4. **ไม่มีตาราง `wms_adjustment_reasons`** (Reason codes table)
5. **ไม่มี location_type 'system' หรือ 'virtual'** ในระบบปัจจุบัน

### ⚠️ ข้อควรระวัง
1. Trigger ออกแบบสำหรับ dual-entry bookkeeping (IN+OUT pairs) แต่ adjustment เป็น single-entry
2. ไม่มีการตรวจสอบป้องกันการปรับสต็อกที่ถูก reserve ไว้
3. ยังไม่มีธุรกรรม adjustment ใดๆ ในระบบ (ตาราง ledger ว่างเปล่า)

---

## การตรวจสอบรายละเอียด (Detailed Verification)


### 1. ตรวจสอบตาราง `wms_inventory_ledger`

**คำถาม:** ตาราง wms_inventory_ledger มีคอลัมน์ skip_balance_sync หรือไม่?

**ผลการตรวจสอบ:** ✅ **มี**

```sql
-- MCP Query: mcp_supabase_execute_sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'wms_inventory_ledger'
ORDER BY ordinal_position;
```

**ผลลัพธ์:** ตาราง `wms_inventory_ledger` มี **23 คอลัมน์** ดังนี้:

| Column Name | Data Type | Nullable | Default |
|------------|-----------|----------|---------|
| ledger_id | bigint | NO | nextval('wms_inventory_ledger_ledger_id_seq') |
| movement_at | timestamp with time zone | NO | CURRENT_TIMESTAMP |
| transaction_type | inventory_movement_type | NO | - |
| direction | movement_direction_enum | NO | - |
| receive_id | bigint | YES | NULL |
| receive_item_id | bigint | YES | NULL |
| move_id | bigint | YES | NULL |
| move_item_id | bigint | YES | NULL |
| warehouse_id | character varying | NO | - |
| location_id | character varying | YES | NULL |
| sku_id | character varying | NO | - |
| pallet_id | character varying | YES | NULL |
| pallet_id_external | character varying | YES | NULL |
| lot_no | character varying | YES | NULL |
| production_date | date | YES | NULL |
| expiry_date | date | YES | NULL |
| pack_qty | integer | NO | 0 |
| piece_qty | integer | NO | 0 |
| reference_no | character varying | YES | NULL |
| remarks | text | YES | NULL |
| **skip_balance_sync** | **boolean** | **YES** | **false** |
| created_by | bigint | YES | NULL |
| created_at | timestamp with time zone | NO | CURRENT_TIMESTAMP |

**สรุป:** คอลัมน์ `skip_balance_sync` มีอยู่แล้ว พร้อมใช้งานสำหรับควบคุมการ sync ไปยัง balance table

---

### 2. ตรวจสอบตาราง `wms_inventory_balances`

**คำถาม:** ตาราง wms_inventory_balances มี CHECK constraints ป้องกันค่าติดลบหรือไม่?

**ผลการตรวจสอบ:** ✅ **มี**

```sql
-- MCP Query: mcp_supabase_execute_sql
SELECT conname, pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'wms_inventory_balances'::regclass
AND contype = 'c';
```

**ผลลัพธ์:** พบ CHECK constraints ดังนี้:

1. `wms_inventory_balances_available_pack_qty_check`
   - `CHECK (available_pack_qty >= 0)`

2. `wms_inventory_balances_available_piece_qty_check`
   - `CHECK (available_piece_qty >= 0)`

3. `wms_inventory_balances_reserved_pack_qty_check`
   - `CHECK (reserved_pack_qty >= 0)`

4. `wms_inventory_balances_reserved_piece_qty_check`
   - `CHECK (reserved_piece_qty >= 0)`

5. `wms_inventory_balances_total_pack_qty_check`
   - `CHECK (total_pack_qty >= 0)`

6. `wms_inventory_balances_total_piece_qty_check`
   - `CHECK (total_piece_qty >= 0)`

**สรุป:** ระบบป้องกันค่าติดลบครบถ้วน ทั้ง total, available, และ reserved quantities

---

### 3. ตรวจสอบ Trigger Functions

**คำถาม:** มี trigger function sync_inventory_ledger_to_balance() และจัดการ skip_balance_sync อย่างไร?

**ผลการตรวจสอบ:** ✅ **มีและทำงานถูกต้อง**

```sql
-- MCP Query: mcp_supabase_execute_sql
SELECT 
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname IN ('sync_inventory_ledger_to_balance', 'sync_location_qty_from_balance')
AND n.nspname = 'public';
```

**ผลลัพธ์:**

#### Function 1: `sync_inventory_ledger_to_balance()`
- **Purpose:** Auto-sync จาก ledger ไปยัง balance table
- **Trigger:** AFTER INSERT ON wms_inventory_ledger
- **Key Logic:**
  ```sql
  -- ตรวจสอบ skip_balance_sync flag
  IF NEW.skip_balance_sync = true THEN
    RETURN NEW;
  END IF;
  
  -- จัดการ NULL location_id ด้วย COALESCE
  COALESCE(NEW.location_id, 'UNKNOWN')
  ```

#### Function 2: `sync_location_qty_from_balance()`
- **Purpose:** Auto-update location current_qty จาก balance
- **Trigger:** AFTER INSERT OR UPDATE OR DELETE ON wms_inventory_balances
- **Key Logic:**
  ```sql
  -- คำนวณ total piece_qty ทั้งหมดใน location
  UPDATE master_location
  SET current_qty = (
    SELECT COALESCE(SUM(total_piece_qty), 0)
    FROM wms_inventory_balances
    WHERE location_id = NEW.location_id
  )
  ```

**สรุป:** Trigger functions พร้อมใช้งาน รองรับ skip_balance_sync และจัดการ NULL location_id ได้

---

### 4. ตรวจสอบ Enum Types

**คำถาม:** Enum types รองรับ 'adjustment' transaction type หรือไม่?

**ผลการตรวจสอบ:** ✅ **รองรับ**

```sql
-- MCP Query: mcp_supabase_execute_sql
SELECT 
  t.typname as enum_name,
  e.enumlabel as enum_value
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname IN ('inventory_movement_type', 'movement_direction_enum')
ORDER BY t.typname, e.enumsortorder;
```

**ผลลัพธ์:**

#### `inventory_movement_type` enum:
- `receive`
- `putaway`
- `transfer`
- `replenishment`
- **`adjustment`** ✅
- `pick`
- `pack`
- `ship`

#### `movement_direction_enum` enum:
- **`in`** ✅
- **`out`** ✅

**สรุป:** Enum types รองรับ adjustment และ directional movements ครบถ้วน

---

### 5. ตรวจสอบ Foreign Key Relationships

**คำถาม:** Foreign keys ระหว่าง ledger, balance, และ location ถูกต้องหรือไม่?

**ผลการตรวจสอบ:** ✅ **ถูกต้องครบถ้วน**

```sql
-- MCP Query: mcp_supabase_execute_sql
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_name IN ('wms_inventory_ledger', 'wms_inventory_balances')
ORDER BY tc.table_name, tc.constraint_name;
```

**ผลลัพธ์:**

#### `wms_inventory_ledger` Foreign Keys:
1. `fk_ledger_warehouse` → `master_warehouse(warehouse_id)`
2. `fk_ledger_location` → `master_location(location_id)`
3. `fk_ledger_sku` → `master_sku(sku_id)`
4. `fk_ledger_move` → `wms_moves(move_id)`
5. `fk_ledger_move_item` → `wms_move_items(move_item_id)`
6. `fk_ledger_receive` → `wms_receives(receive_id)`
7. `fk_ledger_receive_item` → `wms_receive_items(receive_item_id)`
8. `fk_ledger_created_by` → `master_system_user(user_id)`

#### `wms_inventory_balances` Foreign Keys:
1. `fk_balance_warehouse` → `master_warehouse(warehouse_id)`
2. `fk_balance_location` → `master_location(location_id)`
3. `fk_balance_sku` → `master_sku(sku_id)`
4. `fk_balance_last_move` → `wms_moves(move_id)`

**สรุป:** Foreign key relationships ครบถ้วนและถูกต้อง


---

### 6. ตรวจสอบโลเคชั่น ADJ-LOSS

**คำถาม:** มีโลเคชั่น ADJ-LOSS (Virtual/System location) สำหรับบันทึกการปรับสต็อกหรือไม่?

**ผลการตรวจสอบ:** ❌ **ไม่มี**

```sql
-- MCP Query: mcp_supabase_execute_sql
SELECT location_id, location_code, location_name, location_type, active_status
FROM master_location
WHERE location_code LIKE '%ADJ%' OR location_name LIKE '%adjustment%'
OR location_type = 'system' OR location_type = 'virtual';
```

**ผลลัพธ์:** ไม่พบโลเคชั่นใดๆ ที่เกี่ยวข้องกับ adjustment

**Location Types ที่มีในระบบ:**
```sql
SELECT DISTINCT location_type FROM master_location;
```
- `bulk`
- `delivery`
- `dispatch`
- `floor`
- `rack`

**ไม่มี:** `system`, `virtual`, `adjustment`

**สรุป:** ⚠️ **ต้องสร้างโลเคชั่น ADJ-LOSS และเพิ่ม location_type 'system' หรือ 'virtual'**

---

### 7. ตรวจสอบตาราง Stock Adjustment

**คำถาม:** มีตาราง wms_stock_adjustments และ wms_stock_adjustment_items หรือไม่?

**ผลการตรวจสอบ:** ❌ **ไม่มี**

```sql
-- MCP Query: mcp_supabase_list_tables
-- schemas: ['public']
```

**ผลลัพธ์:** ไม่พบตารางดังนี้:
- `wms_stock_adjustments` (Header table)
- `wms_stock_adjustment_items` (Line items table)
- `wms_adjustment_reasons` (Reason codes table)

**ตารางที่มีในระบบ:**
- `wms_inventory_ledger` ✅
- `wms_inventory_balances` ✅
- `wms_moves` ✅
- `wms_move_items` ✅
- `wms_receives` ✅
- `wms_receive_items` ✅
- `master_location` ✅
- `master_sku` ✅
- `master_warehouse` ✅

**สรุป:** ⚠️ **ต้องสร้างตารางสำหรับ Stock Adjustment ทั้งหมด**

---

### 8. ตรวจสอบ Permission Modules

**คำถาม:** มี permission modules สำหรับ stock adjustment หรือไม่?

**ผลการตรวจสอบ:** ✅ **มีอยู่แล้ว**

```sql
-- MCP Query: mcp_supabase_execute_sql
SELECT module_id, module_key, module_name_th, module_name_en, parent_module_id
FROM master_permission_module
WHERE module_key LIKE 'stock.adjustment%'
ORDER BY module_id;
```

**ผลลัพธ์:**

| Module ID | Module Key | Name (TH) | Name (EN) | Parent |
|-----------|-----------|-----------|-----------|--------|
| 211 | stock.adjustment.view | ดูข้อมูลปรับสต็อก | View Stock Adjustments | 210 |
| 212 | stock.adjustment.create | สร้างปรับสต็อก | Create Stock Adjustment | 210 |
| 213 | stock.adjustment.edit | แก้ไขปรับสต็อก | Edit Stock Adjustment | 210 |
| 214 | stock.adjustment.delete | ลบปรับสต็อก | Delete Stock Adjustment | 210 |
| 215 | stock.adjustment.approve | อนุมัติปรับสต็อก | Approve Stock Adjustment | 210 |

**Parent Module (210):**
- `stock.adjustment` - "ปรับสต็อก" / "Stock Adjustment"

**สรุป:** Permission modules พร้อมใช้งาน ไม่ต้องสร้างใหม่

---

### 9. ตรวจสอบธุรกรรม Adjustment ที่มีอยู่

**คำถาม:** มีธุรกรรม adjustment ในระบบหรือไม่?

**ผลการตรวจสอบ:** ❌ **ไม่มี**

```sql
-- MCP Query: mcp_supabase_execute_sql
SELECT COUNT(*) as adjustment_count
FROM wms_inventory_ledger
WHERE transaction_type = 'adjustment';
```

**ผลลัพธ์:** `0` รายการ

```sql
-- ตรวจสอบ transaction types ทั้งหมดที่มี
SELECT transaction_type, COUNT(*) as count
FROM wms_inventory_ledger
GROUP BY transaction_type
ORDER BY count DESC;
```

**ผลลัพธ์:** ตาราง `wms_inventory_ledger` ว่างเปล่า (ยังไม่มีธุรกรรมใดๆ)

**สรุป:** ระบบยังไม่เคยมีการใช้งาน adjustment มาก่อน

---

### 10. ตรวจสอบ Reserved Stock Validation

**คำถาม:** มีการตรวจสอบป้องกันการปรับสต็อกที่ถูก reserve ไว้หรือไม่?

**ผลการตรวจสอบ:** ⚠️ **ไม่มีในระดับ Database**

```sql
-- MCP Query: mcp_supabase_execute_sql
-- ตรวจสอบ triggers และ constraints ที่เกี่ยวข้องกับ reserved_qty
SELECT 
  tgname as trigger_name,
  tgtype,
  pg_get_triggerdef(oid) as trigger_definition
FROM pg_trigger
WHERE tgrelid = 'wms_inventory_balances'::regclass
AND tgname LIKE '%reserve%';
```

**ผลลัพธ์:** ไม่พบ trigger ที่ตรวจสอบ reserved quantities

**ข้อมูลที่มี:**
- `wms_inventory_balances` มีคอลัมน์ `reserved_pack_qty` และ `reserved_piece_qty`
- มี CHECK constraints ป้องกันค่าติดลบ
- **แต่ไม่มี** validation ป้องกันการปรับสต็อกที่ถูก reserve

**สรุป:** ⚠️ **ต้องเพิ่ม validation logic ใน application layer หรือ database trigger**

---

### 11. ตรวจสอบ Audit Trail

**คำถาม:** มีตารางสำหรับ audit trail ของการปรับสต็อกหรือไม่?

**ผลการตรวจสอบ:** ⚠️ **มีบางส่วน**

**ตารางที่มี:**
1. `wms_inventory_ledger` - บันทึกทุก movement (รวม adjustment)
   - มีคอลัมน์ `created_by`, `created_at`
   - มีคอลัมน์ `remarks` สำหรับบันทึกเหตุผล

2. `master_audit_log` - General audit log
   ```sql
   SELECT COUNT(*) FROM master_audit_log;
   ```
   **ผลลัพธ์:** มีตารางนี้อยู่

**ตารางที่ไม่มี:**
- `wms_stock_adjustment_audit` - Specific audit for adjustments
- `wms_adjustment_approvals` - Approval workflow tracking

**สรุป:** ⚠️ **Audit trail พื้นฐานมีใน ledger แต่อาจต้องเพิ่มตารางเฉพาะสำหรับ approval workflow**

---

### 12. ตรวจสอบ Reason Codes

**คำถาม:** มีตาราง reason codes สำหรับการปรับสต็อกหรือไม่?

**ผลการตรวจสอบ:** ❌ **ไม่มี**

```sql
-- MCP Query: mcp_supabase_list_tables
-- ค้นหาตารางที่เกี่ยวข้องกับ reason
```

**ผลลัพธ์:** ไม่พบตารางดังนี้:
- `wms_adjustment_reasons`
- `master_adjustment_reason_codes`
- `wms_stock_adjustment_reason`

**สรุป:** ⚠️ **ต้องสร้างตาราง reason codes สำหรับจัดหมวดหมู่การปรับสต็อก**

**Reason Codes ที่แนะนำ:**
- `DAMAGED` - สินค้าเสียหาย
- `EXPIRED` - สินค้าหมดอายุ
- `LOST` - สินค้าสูญหาย
- `FOUND` - พบสินค้าเพิ่ม
- `COUNT_ERROR` - ข้อผิดพลาดในการนับ
- `SYSTEM_ERROR` - ข้อผิดพลาดของระบบ
- `QUALITY_ISSUE` - ปัญหาคุณภาพ
- `RETURN_TO_SUPPLIER` - คืนสินค้าให้ซัพพลายเออร์
- `OTHER` - อื่นๆ

---

### 13. ตรวจสอบ Approval Workflow

**คำถาม:** มี workflow สำหรับการอนุมัติการปรับสต็อกหรือไม่?

**ผลการตรวจสอบ:** ⚠️ **มี Permission แต่ไม่มี Workflow Table**

**ที่มี:**
- Permission module: `stock.adjustment.approve` (module_id: 215)

**ที่ไม่มี:**
- ตาราง `wms_stock_adjustment_approvals`
- Status field สำหรับ approval workflow (draft, pending_approval, approved, rejected)
- Approval history tracking

**สรุป:** ⚠️ **ต้องออกแบบและสร้าง approval workflow**

---

### 14. ตรวจสอบ Batch Adjustment Support

**คำถาม:** ระบบรองรับการปรับสต็อกแบบ batch (หลาย SKU พร้อมกัน) หรือไม่?

**ผลการตรวจสอบ:** ⚠️ **ไม่มีโครงสร้างรองรับ**

**ที่ต้องการ:**
- Header-Detail structure (1 adjustment document → many items)
- Transaction management สำหรับ batch operations

**ที่มีในระบบปัจจุบัน:**
- `wms_moves` และ `wms_move_items` มี header-detail structure
- สามารถใช้เป็น pattern ได้

**สรุป:** ⚠️ **ต้องสร้างโครงสร้าง header-detail สำหรับ adjustment**

---

### 15. ตรวจสอบ Integration กับ Move Service

**คำถาม:** Move service รองรับ adjustment type หรือไม่?

**ผลการตรวจสอบ:** ✅ **รองรับบางส่วน**

**จากไฟล์ `lib/database/move.ts`:**

```typescript
export type MoveType = 'putaway' | 'transfer' | 'replenishment' | 'adjustment';
```

**ฟังก์ชันที่เกี่ยวข้อง:**
1. `createMove()` - รองรับ move_type = 'adjustment'
2. `recordInventoryMovement()` - บันทึก ledger entries
3. `updateInventoryBalance()` - อัพเดท balance

**ปัญหาที่พบ:**
1. **Dual-entry assumption:** Move service ออกแบบสำหรับ from_location → to_location
   - Adjustment ควรเป็น single-entry (location ↔ ADJ-LOSS)
   
2. **ไม่มี validation สำหรับ reserved stock:**
   ```typescript
   // ไม่มีการตรวจสอบ reserved_qty ก่อน adjustment
   ```

3. **ไม่มี reason code support:**
   ```typescript
   // ไม่มี field สำหรับ adjustment_reason_id
   ```

**สรุป:** ⚠️ **Move service รองรับ adjustment type แต่ต้องปรับปรุง logic สำหรับ single-entry และ validation**


---

## แผนการพัฒนา (Implementation Roadmap)

### Phase 1: Database Schema (สูง - ต้องทำก่อน)

#### 1.1 สร้าง Location Type และ ADJ-LOSS Location
```sql
-- Migration: 148_create_adj_loss_location.sql

-- เพิ่ม location_type 'system' (ถ้ายังไม่มี enum)
-- หรือใช้ location_type ที่มีอยู่แล้ว เช่น 'bulk' แต่ทำเครื่องหมายพิเศษ

-- สร้างโลเคชั่น ADJ-LOSS
INSERT INTO master_location (
  location_id,
  location_code,
  location_name,
  location_type,
  warehouse_id,
  active_status,
  is_system_location, -- เพิ่มคอลัมน์นี้ถ้าจำเป็น
  max_capacity_qty,
  max_capacity_weight_kg,
  current_qty,
  current_weight_kg,
  remarks
) VALUES (
  'LOC-ADJ-LOSS',
  'ADJ-LOSS',
  'Virtual Location for Stock Adjustments',
  'bulk', -- หรือ 'system' ถ้าเพิ่ม enum แล้ว
  'WH001', -- warehouse_id หลัก
  'active',
  true, -- ระบุว่าเป็น system location
  999999999, -- ไม่จำกัดความจุ
  999999999,
  0,
  0,
  'Virtual location for recording stock adjustments (increase/decrease)'
);
```

#### 1.2 สร้างตาราง Adjustment Reasons
```sql
-- Migration: 149_create_adjustment_reasons.sql

CREATE TABLE wms_adjustment_reasons (
  reason_id SERIAL PRIMARY KEY,
  reason_code VARCHAR(50) NOT NULL UNIQUE,
  reason_name_th VARCHAR(255) NOT NULL,
  reason_name_en VARCHAR(255) NOT NULL,
  reason_type VARCHAR(20) NOT NULL CHECK (reason_type IN ('increase', 'decrease', 'both')),
  requires_approval BOOLEAN DEFAULT false,
  active_status VARCHAR(20) DEFAULT 'active' CHECK (active_status IN ('active', 'inactive')),
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default reason codes
INSERT INTO wms_adjustment_reasons (reason_code, reason_name_th, reason_name_en, reason_type, requires_approval, display_order) VALUES
('DAMAGED', 'สินค้าเสียหาย', 'Damaged Goods', 'decrease', true, 1),
('EXPIRED', 'สินค้าหมดอายุ', 'Expired Goods', 'decrease', true, 2),
('LOST', 'สินค้าสูญหาย', 'Lost/Missing', 'decrease', true, 3),
('FOUND', 'พบสินค้าเพิ่ม', 'Found/Surplus', 'increase', true, 4),
('COUNT_ERROR', 'ข้อผิดพลาดในการนับ', 'Count Error', 'both', true, 5),
('SYSTEM_ERROR', 'ข้อผิดพลาดของระบบ', 'System Error', 'both', true, 6),
('QUALITY_ISSUE', 'ปัญหาคุณภาพ', 'Quality Issue', 'decrease', true, 7),
('RETURN_SUPPLIER', 'คืนสินค้าให้ซัพพลายเออร์', 'Return to Supplier', 'decrease', false, 8),
('SAMPLE', 'ตัวอย่างสินค้า', 'Sample', 'decrease', false, 9),
('OTHER', 'อื่นๆ', 'Other', 'both', true, 99);

CREATE INDEX idx_adjustment_reasons_active ON wms_adjustment_reasons(active_status);
CREATE INDEX idx_adjustment_reasons_type ON wms_adjustment_reasons(reason_type);
```

#### 1.3 สร้างตาราง Stock Adjustments (Header)
```sql
-- Migration: 150_create_stock_adjustments.sql

CREATE TABLE wms_stock_adjustments (
  adjustment_id BIGSERIAL PRIMARY KEY,
  adjustment_no VARCHAR(50) NOT NULL UNIQUE,
  adjustment_type VARCHAR(20) NOT NULL CHECK (adjustment_type IN ('increase', 'decrease')),
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'completed', 'cancelled')),
  warehouse_id VARCHAR(50) NOT NULL REFERENCES master_warehouse(warehouse_id),
  reason_id INTEGER NOT NULL REFERENCES wms_adjustment_reasons(reason_id),
  adjustment_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  reference_no VARCHAR(100),
  remarks TEXT,
  
  -- User tracking
  created_by BIGINT REFERENCES master_system_user(user_id),
  approved_by BIGINT REFERENCES master_system_user(user_id),
  approved_at TIMESTAMP WITH TIME ZONE,
  completed_by BIGINT REFERENCES master_system_user(user_id),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  CONSTRAINT fk_adjustment_warehouse FOREIGN KEY (warehouse_id) REFERENCES master_warehouse(warehouse_id),
  CONSTRAINT fk_adjustment_reason FOREIGN KEY (reason_id) REFERENCES wms_adjustment_reasons(reason_id),
  CONSTRAINT fk_adjustment_created_by FOREIGN KEY (created_by) REFERENCES master_system_user(user_id),
  CONSTRAINT fk_adjustment_approved_by FOREIGN KEY (approved_by) REFERENCES master_system_user(user_id),
  CONSTRAINT fk_adjustment_completed_by FOREIGN KEY (completed_by) REFERENCES master_system_user(user_id)
);

CREATE INDEX idx_adjustments_no ON wms_stock_adjustments(adjustment_no);
CREATE INDEX idx_adjustments_status ON wms_stock_adjustments(status);
CREATE INDEX idx_adjustments_type ON wms_stock_adjustments(adjustment_type);
CREATE INDEX idx_adjustments_warehouse ON wms_stock_adjustments(warehouse_id);
CREATE INDEX idx_adjustments_date ON wms_stock_adjustments(adjustment_date);
CREATE INDEX idx_adjustments_created_by ON wms_stock_adjustments(created_by);

-- Auto-update updated_at
CREATE TRIGGER update_adjustments_updated_at
  BEFORE UPDATE ON wms_stock_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

#### 1.4 สร้างตาราง Stock Adjustment Items (Detail)
```sql
-- Migration: 151_create_stock_adjustment_items.sql

CREATE TABLE wms_stock_adjustment_items (
  adjustment_item_id BIGSERIAL PRIMARY KEY,
  adjustment_id BIGINT NOT NULL REFERENCES wms_stock_adjustments(adjustment_id) ON DELETE CASCADE,
  line_no INTEGER NOT NULL,
  
  -- SKU and Location
  sku_id VARCHAR(50) NOT NULL REFERENCES master_sku(sku_id),
  location_id VARCHAR(50) NOT NULL REFERENCES master_location(location_id),
  pallet_id VARCHAR(100),
  pallet_id_external VARCHAR(100),
  
  -- Lot tracking
  lot_no VARCHAR(100),
  production_date DATE,
  expiry_date DATE,
  
  -- Quantities (before adjustment)
  before_pack_qty INTEGER DEFAULT 0,
  before_piece_qty INTEGER DEFAULT 0,
  
  -- Adjustment quantities
  adjustment_pack_qty INTEGER DEFAULT 0,
  adjustment_piece_qty INTEGER NOT NULL,
  
  -- Quantities (after adjustment)
  after_pack_qty INTEGER DEFAULT 0,
  after_piece_qty INTEGER DEFAULT 0,
  
  -- Ledger reference (after completion)
  ledger_id BIGINT REFERENCES wms_inventory_ledger(ledger_id),
  
  -- Item-level remarks
  remarks TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  CONSTRAINT fk_adjustment_item_adjustment FOREIGN KEY (adjustment_id) REFERENCES wms_stock_adjustments(adjustment_id) ON DELETE CASCADE,
  CONSTRAINT fk_adjustment_item_sku FOREIGN KEY (sku_id) REFERENCES master_sku(sku_id),
  CONSTRAINT fk_adjustment_item_location FOREIGN KEY (location_id) REFERENCES master_location(location_id),
  CONSTRAINT fk_adjustment_item_ledger FOREIGN KEY (ledger_id) REFERENCES wms_inventory_ledger(ledger_id),
  CONSTRAINT uq_adjustment_item_line UNIQUE (adjustment_id, line_no),
  
  -- Validation: adjustment_piece_qty cannot be zero
  CONSTRAINT chk_adjustment_qty_not_zero CHECK (adjustment_piece_qty != 0)
);

CREATE INDEX idx_adjustment_items_adjustment ON wms_stock_adjustment_items(adjustment_id);
CREATE INDEX idx_adjustment_items_sku ON wms_stock_adjustment_items(sku_id);
CREATE INDEX idx_adjustment_items_location ON wms_stock_adjustment_items(location_id);
CREATE INDEX idx_adjustment_items_pallet ON wms_stock_adjustment_items(pallet_id);
CREATE INDEX idx_adjustment_items_ledger ON wms_stock_adjustment_items(ledger_id);

-- Auto-update updated_at
CREATE TRIGGER update_adjustment_items_updated_at
  BEFORE UPDATE ON wms_stock_adjustment_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

#### 1.5 สร้าง Validation Trigger สำหรับ Reserved Stock
```sql
-- Migration: 152_create_adjustment_validation_trigger.sql

CREATE OR REPLACE FUNCTION validate_adjustment_reserved_stock()
RETURNS TRIGGER AS $$
DECLARE
  v_reserved_qty INTEGER;
  v_available_qty INTEGER;
  v_adjustment_type VARCHAR(20);
BEGIN
  -- ดึง adjustment_type จาก header
  SELECT adjustment_type INTO v_adjustment_type
  FROM wms_stock_adjustments
  WHERE adjustment_id = NEW.adjustment_id;
  
  -- ตรวจสอบเฉพาะกรณี decrease
  IF v_adjustment_type = 'decrease' THEN
    -- ดึงข้อมูล reserved และ available จาก balance
    SELECT 
      COALESCE(reserved_piece_qty, 0),
      COALESCE(available_piece_qty, 0)
    INTO v_reserved_qty, v_available_qty
    FROM wms_inventory_balances
    WHERE warehouse_id = (SELECT warehouse_id FROM wms_stock_adjustments WHERE adjustment_id = NEW.adjustment_id)
      AND location_id = NEW.location_id
      AND sku_id = NEW.sku_id
      AND (pallet_id = NEW.pallet_id OR (pallet_id IS NULL AND NEW.pallet_id IS NULL));
    
    -- ถ้าไม่พบ balance record ให้ใช้ค่า 0
    IF v_reserved_qty IS NULL THEN
      v_reserved_qty := 0;
      v_available_qty := 0;
    END IF;
    
    -- ตรวจสอบว่า adjustment quantity ไม่เกิน available quantity
    IF ABS(NEW.adjustment_piece_qty) > v_available_qty THEN
      RAISE EXCEPTION 'Cannot adjust stock: Adjustment quantity (%) exceeds available quantity (%). Reserved quantity: %',
        ABS(NEW.adjustment_piece_qty), v_available_qty, v_reserved_qty;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- สร้าง trigger
CREATE TRIGGER trg_validate_adjustment_reserved_stock
  BEFORE INSERT OR UPDATE ON wms_stock_adjustment_items
  FOR EACH ROW
  EXECUTE FUNCTION validate_adjustment_reserved_stock();
```

---

### Phase 2: Backend Services (สูง)

#### 2.1 สร้าง Stock Adjustment Service
**ไฟล์:** `lib/database/stock-adjustment.ts`

**ฟังก์ชันหลัก:**
```typescript
class StockAdjustmentService {
  // Generate adjustment number (ADJ-YYYYMM-XXXX)
  async generateAdjustmentNo(): Promise<string>
  
  // Create adjustment document (draft)
  async createAdjustment(payload: CreateAdjustmentPayload): Promise<AdjustmentRecord>
  
  // Get adjustments with filters
  async getAdjustments(filters?: AdjustmentFilters): Promise<AdjustmentRecord[]>
  
  // Get single adjustment by ID
  async getAdjustmentById(id: number): Promise<AdjustmentRecord>
  
  // Update adjustment (only draft status)
  async updateAdjustment(id: number, payload: UpdateAdjustmentPayload): Promise<AdjustmentRecord>
  
  // Submit for approval
  async submitForApproval(id: number, userId: number): Promise<AdjustmentRecord>
  
  // Approve adjustment
  async approveAdjustment(id: number, userId: number): Promise<AdjustmentRecord>
  
  // Reject adjustment
  async rejectAdjustment(id: number, userId: number, reason: string): Promise<AdjustmentRecord>
  
  // Complete adjustment (record to ledger)
  async completeAdjustment(id: number, userId: number): Promise<AdjustmentRecord>
  
  // Cancel adjustment
  async cancelAdjustment(id: number, userId: number, reason: string): Promise<AdjustmentRecord>
  
  // Validate reserved stock before adjustment
  async validateReservedStock(items: AdjustmentItem[]): Promise<ValidationResult>
  
  // Record adjustment to inventory ledger
  async recordAdjustmentToLedger(adjustment: AdjustmentRecord): Promise<void>
}
```

#### 2.2 สร้าง API Routes
**ไฟล์ที่ต้องสร้าง:**
- `app/api/stock-adjustment/route.ts` - GET (list), POST (create)
- `app/api/stock-adjustment/[id]/route.ts` - GET (detail), PUT (update), DELETE (cancel)
- `app/api/stock-adjustment/[id]/submit/route.ts` - POST (submit for approval)
- `app/api/stock-adjustment/[id]/approve/route.ts` - POST (approve)
- `app/api/stock-adjustment/[id]/reject/route.ts` - POST (reject)
- `app/api/stock-adjustment/[id]/complete/route.ts` - POST (complete)
- `app/api/stock-adjustment/reasons/route.ts` - GET (list reasons)

---

### Phase 3: Frontend UI (กลาง)

#### 3.1 แก้ไข Stock Adjustment Page
**ไฟล์:** `app/stock-management/adjustment/page.tsx`

**Features:**
- แสดงรายการ adjustments (ตาราง)
- Filter: status, type, date range, warehouse
- Search: adjustment_no, reference_no
- Actions: Create, View, Edit, Delete, Submit, Approve, Reject

#### 3.2 สร้าง Adjustment Form Components
**ไฟล์ที่ต้องสร้าง:**
- `components/stock-adjustment/CreateAdjustmentModal.tsx`
- `components/stock-adjustment/AdjustmentItemsTable.tsx`
- `components/stock-adjustment/AdjustmentReasonSelect.tsx`
- `components/stock-adjustment/AdjustmentApprovalModal.tsx`
- `components/stock-adjustment/AdjustmentDetailModal.tsx`

#### 3.3 สร้าง Custom Hooks
**ไฟล์:** `hooks/useStockAdjustment.ts`

```typescript
export function useStockAdjustments(filters?: AdjustmentFilters)
export function useStockAdjustment(id: number)
export function useCreateAdjustment()
export function useUpdateAdjustment()
export function useSubmitAdjustment()
export function useApproveAdjustment()
export function useRejectAdjustment()
export function useCompleteAdjustment()
export function useAdjustmentReasons()
```

---

### Phase 4: Testing & Validation (กลาง)

#### 4.1 Unit Tests
- Test adjustment service functions
- Test validation logic
- Test ledger recording

#### 4.2 Integration Tests
- Test complete adjustment workflow
- Test approval workflow
- Test reserved stock validation

#### 4.3 User Acceptance Testing
- Test UI/UX
- Test permission controls
- Test mobile responsiveness

---

### Phase 5: Documentation (ต่ำ)

#### 5.1 Technical Documentation
- API documentation
- Database schema documentation
- Service layer documentation

#### 5.2 User Documentation
- User manual (Thai)
- Training materials
- FAQ

---

## ข้อแนะนำสำหรับการพัฒนา (Development Guidelines)

### 1. Single-Entry Bookkeeping สำหรับ Adjustment

**Increase (เพิ่มสต็อก):**
```
Direction: IN
From: ADJ-LOSS (virtual location)
To: Actual Location (where stock increases)
```

**Decrease (ลดสต็อก):**
```
Direction: OUT
From: Actual Location (where stock decreases)
To: ADJ-LOSS (virtual location)
```

### 2. Ledger Entry Pattern

```typescript
// Increase Example
{
  transaction_type: 'adjustment',
  direction: 'in',
  location_id: 'LOC-A-01-01', // actual location
  sku_id: 'SKU001',
  piece_qty: 100,
  reference_no: 'ADJ-202512-0001',
  remarks: 'Found surplus during cycle count'
}

// Decrease Example
{
  transaction_type: 'adjustment',
  direction: 'out',
  location_id: 'LOC-A-01-01', // actual location
  sku_id: 'SKU001',
  piece_qty: 50,
  reference_no: 'ADJ-202512-0002',
  remarks: 'Damaged goods'
}
```

### 3. Reserved Stock Validation

```typescript
// Before decrease adjustment
const balance = await getInventoryBalance(warehouseId, locationId, skuId, palletId);

if (balance.reserved_piece_qty > 0) {
  const availableQty = balance.total_piece_qty - balance.reserved_piece_qty;
  
  if (adjustmentQty > availableQty) {
    throw new Error(
      `Cannot adjust: ${balance.reserved_piece_qty} pieces are reserved. ` +
      `Available for adjustment: ${availableQty} pieces.`
    );
  }
}
```

### 4. Approval Workflow States

```
draft → pending_approval → approved → completed
                        ↓
                    rejected
```

**Rules:**
- Only `draft` can be edited
- Only `draft` can be submitted for approval
- Only `pending_approval` can be approved/rejected
- Only `approved` can be completed
- Any status except `completed` can be cancelled

### 5. Permission Checks

```typescript
// Create/Edit: stock.adjustment.create or stock.adjustment.edit
// Submit: stock.adjustment.create
// Approve: stock.adjustment.approve
// Complete: stock.adjustment.approve or stock.adjustment.create
// View: stock.adjustment.view
// Delete: stock.adjustment.delete
```

---

## สรุปและข้อเสนอแนะ (Conclusion & Recommendations)

### ✅ จุดแข็งของระบบปัจจุบัน
1. โครงสร้างพื้นฐาน (ledger, balance, triggers) แข็งแรงและพร้อมใช้งาน
2. Permission modules ครบถ้วน
3. Enum types รองรับ adjustment
4. Foreign key relationships ถูกต้อง
5. มี `skip_balance_sync` flag สำหรับควบคุม trigger

### ❌ สิ่งที่ต้องพัฒนาเพิ่มเติม
1. **สร้างโลเคชั่น ADJ-LOSS** (ความสำคัญสูงสุด)
2. **สร้างตารางสำหรับ adjustment** (header, items, reasons)
3. **สร้าง validation trigger** สำหรับ reserved stock
4. **พัฒนา service layer** และ API routes
5. **สร้าง UI components** สำหรับ adjustment workflow

### 🎯 ลำดับความสำคัญในการพัฒนา
1. **Phase 1 (Database)** - ต้องทำก่อนทุกอย่าง
2. **Phase 2 (Backend)** - ทำหลัง Phase 1 เสร็จ
3. **Phase 3 (Frontend)** - ทำควบคู่กับ Phase 2
4. **Phase 4 (Testing)** - ทำหลัง Phase 2-3 เสร็จ
5. **Phase 5 (Documentation)** - ทำตลอดทุก Phase

### ⏱️ ประมาณการเวลาพัฒนา
- **Phase 1:** 1-2 วัน (Database migrations)
- **Phase 2:** 3-4 วัน (Backend services + APIs)
- **Phase 3:** 3-4 วัน (Frontend UI)
- **Phase 4:** 2-3 วัน (Testing)
- **Phase 5:** 1-2 วัน (Documentation)
- **รวม:** 10-15 วันทำการ

### 📋 Checklist ก่อนเริ่มพัฒนา
- [ ] Review และ approve database schema design
- [ ] ตัดสินใจเรื่อง approval workflow (required หรือ optional)
- [ ] กำหนด business rules สำหรับ adjustment
- [ ] เตรียม test data และ test scenarios
- [ ] Setup development environment
- [ ] Create feature branch: `feature/stock-adjustment`

---

## ภาคผนวก (Appendix)

### A. SQL Queries ที่ใช้ในการตรวจสอบ

```sql
-- 1. ตรวจสอบโครงสร้างตาราง ledger
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'wms_inventory_ledger'
ORDER BY ordinal_position;

-- 2. ตรวจสอบ CHECK constraints
SELECT conname, pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'wms_inventory_balances'::regclass
AND contype = 'c';

-- 3. ตรวจสอบ trigger functions
SELECT p.proname, pg_get_functiondef(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname IN ('sync_inventory_ledger_to_balance', 'sync_location_qty_from_balance')
AND n.nspname = 'public';

-- 4. ตรวจสอบ enum types
SELECT t.typname, e.enumlabel
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname IN ('inventory_movement_type', 'movement_direction_enum')
ORDER BY t.typname, e.enumsortorder;

-- 5. ตรวจสอบ foreign keys
SELECT tc.constraint_name, tc.table_name, kcu.column_name,
       ccu.table_name AS foreign_table_name,
       ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_name IN ('wms_inventory_ledger', 'wms_inventory_balances');

-- 6. ตรวจสอบ permission modules
SELECT module_id, module_key, module_name_th, module_name_en
FROM master_permission_module
WHERE module_key LIKE 'stock.adjustment%'
ORDER BY module_id;

-- 7. ตรวจสอบ location types
SELECT DISTINCT location_type FROM master_location;

-- 8. ตรวจสอบธุรกรรม adjustment
SELECT COUNT(*) FROM wms_inventory_ledger
WHERE transaction_type = 'adjustment';
```

### B. TypeScript Type Definitions

```typescript
// types/stock-adjustment-schema.ts

export type AdjustmentType = 'increase' | 'decrease';
export type AdjustmentStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'completed' | 'cancelled';

export interface AdjustmentReason {
  reason_id: number;
  reason_code: string;
  reason_name_th: string;
  reason_name_en: string;
  reason_type: 'increase' | 'decrease' | 'both';
  requires_approval: boolean;
  active_status: 'active' | 'inactive';
}

export interface StockAdjustment {
  adjustment_id: number;
  adjustment_no: string;
  adjustment_type: AdjustmentType;
  status: AdjustmentStatus;
  warehouse_id: string;
  reason_id: number;
  adjustment_date: string;
  reference_no?: string;
  remarks?: string;
  created_by?: number;
  approved_by?: number;
  approved_at?: string;
  completed_by?: number;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface StockAdjustmentItem {
  adjustment_item_id: number;
  adjustment_id: number;
  line_no: number;
  sku_id: string;
  location_id: string;
  pallet_id?: string;
  pallet_id_external?: string;
  lot_no?: string;
  production_date?: string;
  expiry_date?: string;
  before_pack_qty: number;
  before_piece_qty: number;
  adjustment_pack_qty: number;
  adjustment_piece_qty: number;
  after_pack_qty: number;
  after_piece_qty: number;
  ledger_id?: number;
  remarks?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateAdjustmentPayload {
  adjustment_type: AdjustmentType;
  warehouse_id: string;
  reason_id: number;
  reference_no?: string;
  remarks?: string;
  created_by?: number;
  items: CreateAdjustmentItemInput[];
}

export interface CreateAdjustmentItemInput {
  sku_id: string;
  location_id: string;
  pallet_id?: string;
  pallet_id_external?: string;
  lot_no?: string;
  production_date?: string;
  expiry_date?: string;
  adjustment_piece_qty: number; // positive for increase, negative for decrease
  remarks?: string;
}
```

---

**จัดทำโดย:** Kiro AI Assistant  
**วันที่:** 15 ธันวาคม 2025  
**เวอร์ชัน:** 1.0  
**สถานะ:** ✅ Complete - Ready for Implementation

