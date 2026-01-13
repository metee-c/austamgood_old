# ภารกิจ: วิเคราะห์หน้า Preparation Area Inventory และออกแบบโครงสร้างใหม่

## ⛔ กฎเหล็ก

1. **ต้อง** ตรวจสอบ dependencies ทั้งหมดก่อนแก้ไข
2. **ต้อง** วิเคราะห์ผลกระทบต่อทุกส่วนที่เกี่ยวข้อง
3. **ต้อง** Backup ข้อมูลก่อนทำการเปลี่ยนแปลง
4. **ต้อง** ออกแบบ Migration Plan ที่ปลอดภัย
5. **ห้าม** ทำให้ข้อมูลเดิมหาย
6. **ห้าม** Break ส่วนอื่นที่ใช้งานอยู่

---

## 🎯 ปัญหาปัจจุบัน

| ปัญหา | รายละเอียด |
|-------|------------|
| โหลดช้า | ข้อมูลเยอะ ต้องกรองทุกครั้ง |
| 4 แท็บ | ใช้ตารางเดียวกัน กรองด้วยโค้ด |
| Performance | Query ดึงข้อมูลทั้งหมดแล้วค่อยกรอง |

**แนวคิดที่ต้องการ:** แยกตารางฐานข้อมูลตามแท็บเมนู

---

## Phase 0: ตรวจสอบโครงสร้างปัจจุบันอย่างละเอียด

### 0.1 ตรวจสอบหน้า Page และ Components
```bash
# หาไฟล์ page.tsx
find . -path "*preparation-area-inventory*" -name "*.tsx" 2>/dev/null

# ดูโครงสร้างโฟลเดอร์
ls -la app/warehouse/preparation-area-inventory/

# หา components ที่ใช้
grep -r "import" app/warehouse/preparation-area-inventory/page.tsx | head -20
```

### 0.2 อ่านโค้ด Page หลัก
```bash
# ดูโค้ดทั้งหมด
cat app/warehouse/preparation-area-inventory/page.tsx

# หา 4 แท็บที่ใช้
grep -n "tab\|Tab\|แท็บ" app/warehouse/preparation-area-inventory/page.tsx
```

### 0.3 ระบุ 4 แท็บเมนู

**บันทึกชื่อแท็บ:**
```
Tab 1: _______________
Tab 2: _______________
Tab 3: _______________
Tab 4: _______________
```

### 0.4 ตรวจสอบ API ที่ใช้
```bash
# หา API endpoints ที่หน้านี้เรียก
grep -r "fetch\|api\|/api" app/warehouse/preparation-area-inventory/page.tsx

# หา API files
find . -path "*api*preparation*" -name "route.ts" 2>/dev/null
find . -path "*api*warehouse*" -name "route.ts" 2>/dev/null | xargs grep -l "preparation\|staging"
```

---

## Phase 1: ตรวจสอบฐานข้อมูลด้วย MCP

### 1.1 ดูตารางที่เกี่ยวข้อง
```sql
-- หาตารางที่เกี่ยวข้องกับ preparation area
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (
    table_name LIKE '%preparation%'
    OR table_name LIKE '%staging%'
    OR table_name LIKE '%dispatch%'
    OR table_name LIKE '%inventory%'
  )
ORDER BY table_name;
```

### 1.2 ดูโครงสร้างตารางหลัก
```sql
-- ดูโครงสร้างตาราง (แก้ชื่อตารางตามที่พบ)
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'wms_inventory_balances'  -- หรือตารางที่ใช้จริง
ORDER BY ordinal_position;
```

### 1.3 นับจำนวนข้อมูลในแต่ละ "แท็บ"
```sql
-- นับจำนวนข้อมูลตาม location/status ที่แต่ละแท็บใช้
-- (ปรับตาม logic จริงที่หน้าใช้)

SELECT 
  'Tab 1: ___' as tab_name,
  COUNT(*) as record_count
FROM wms_inventory_balances b
JOIN master_locations l ON l.location_id = b.location_id
WHERE l.location_code LIKE '___'  -- condition ของ tab 1

UNION ALL

SELECT 
  'Tab 2: ___' as tab_name,
  COUNT(*) as record_count
FROM wms_inventory_balances b
JOIN master_locations l ON l.location_id = b.location_id
WHERE l.location_code LIKE '___'  -- condition ของ tab 2

UNION ALL

SELECT 
  'Tab 3: ___' as tab_name,
  COUNT(*) as record_count
FROM wms_inventory_balances b
JOIN master_locations l ON l.location_id = b.location_id
WHERE l.location_code LIKE '___'  -- condition ของ tab 3

UNION ALL

SELECT 
  'Tab 4: ___' as tab_name,
  COUNT(*) as record_count
FROM wms_inventory_balances b
JOIN master_locations l ON l.location_id = b.location_id
WHERE l.location_code LIKE '___';  -- condition ของ tab 4
```

### 1.4 วิเคราะห์ Performance ของ Query ปัจจุบัน
```sql
-- ดู query plan
EXPLAIN ANALYZE
SELECT 
  b.*,
  p.product_code,
  p.product_name,
  l.location_code
FROM wms_inventory_balances b
JOIN master_products p ON p.product_id = b.product_id
JOIN master_locations l ON l.location_id = b.location_id
WHERE l.location_code LIKE 'PREP%'  -- หรือ condition จริง
ORDER BY b.created_at DESC;
```

### 1.5 ดู Indexes ที่มีอยู่
```sql
-- ดู indexes
SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('wms_inventory_balances', 'master_locations')
ORDER BY tablename, indexname;
```

---

## Phase 2: ตรวจสอบ Dependencies อย่างละเอียด

### 2.1 หาทุกที่ที่ใช้ตาราง/API นี้
```bash
# หาทุกไฟล์ที่ใช้ตาราง wms_inventory_balances
grep -r "wms_inventory_balances\|inventory_balances" --include="*.ts" --include="*.tsx" app/ | grep -v node_modules

# หาทุกไฟล์ที่เรียก API preparation
grep -r "preparation-area\|preparation_area" --include="*.ts" --include="*.tsx" app/
```

### 2.2 สร้าง Dependency Map
```bash
# สร้าง list ของไฟล์ที่เกี่ยวข้อง
echo "=== Files using wms_inventory_balances ===" > /tmp/dependencies.txt
grep -rl "wms_inventory_balances" --include="*.ts" --include="*.tsx" app/ >> /tmp/dependencies.txt

echo "=== Files using preparation API ===" >> /tmp/dependencies.txt
grep -rl "preparation" --include="*.ts" --include="*.tsx" app/api/ >> /tmp/dependencies.txt

cat /tmp/dependencies.txt
```

### 2.3 ตรวจสอบ Triggers และ Functions ที่เกี่ยวข้อง
```sql
-- ดู triggers บนตาราง
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'wms_inventory_balances';

-- ดู functions ที่ใช้ตาราง
SELECT 
  p.proname as function_name,
  pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND pg_get_functiondef(p.oid) LIKE '%wms_inventory_balances%';
```

### 2.4 ตรวจสอบ Foreign Keys
```sql
-- ดู foreign keys ที่ชี้เข้ามา
SELECT 
  tc.table_name as referencing_table,
  kcu.column_name as referencing_column,
  ccu.table_name as referenced_table,
  ccu.column_name as referenced_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND (ccu.table_name = 'wms_inventory_balances' OR tc.table_name = 'wms_inventory_balances');
```

---

## Phase 3: วิเคราะห์ Logic แต่ละแท็บ

### 3.1 สรุป Logic การกรองของแต่ละแท็บ

**บันทึก:**
```
Tab 1: _______________
- Filter: _______________
- ตัวอย่าง: location_code LIKE 'PK%'
- จำนวนข้อมูล: ___ records

Tab 2: _______________
- Filter: _______________
- ตัวอย่าง: location_code LIKE 'DISPATCH%'
- จำนวนข้อมูล: ___ records

Tab 3: _______________
- Filter: _______________
- ตัวอย่าง: status = 'reserved'
- จำนวนข้อมูล: ___ records

Tab 4: _______________
- Filter: _______________
- ตัวอย่าง: location_code LIKE 'STAGING%'
- จำนวนข้อมูล: ___ records
```

### 3.2 ตรวจสอบว่าแต่ละแท็บมี Overlap กันหรือไม่
```sql
-- ตรวจสอบว่ามี records ที่อยู่หลายแท็บหรือไม่
WITH tab1 AS (
  SELECT balance_id FROM wms_inventory_balances b
  JOIN master_locations l ON l.location_id = b.location_id
  WHERE l.location_code LIKE 'TAB1_CONDITION%'
),
tab2 AS (
  SELECT balance_id FROM wms_inventory_balances b
  JOIN master_locations l ON l.location_id = b.location_id
  WHERE l.location_code LIKE 'TAB2_CONDITION%'
),
tab3 AS (
  SELECT balance_id FROM wms_inventory_balances b
  JOIN master_locations l ON l.location_id = b.location_id
  WHERE l.location_code LIKE 'TAB3_CONDITION%'
),
tab4 AS (
  SELECT balance_id FROM wms_inventory_balances b
  JOIN master_locations l ON l.location_id = b.location_id
  WHERE l.location_code LIKE 'TAB4_CONDITION%'
)
SELECT 
  'Tab1 ∩ Tab2' as overlap,
  COUNT(*) as count
FROM tab1 t1
JOIN tab2 t2 ON t1.balance_id = t2.balance_id

UNION ALL

SELECT 
  'Tab1 ∩ Tab3' as overlap,
  COUNT(*) as count
FROM tab1 t1
JOIN tab3 t3 ON t1.balance_id = t3.balance_id

-- ... เพิ่ม combinations อื่นๆ
;
```

---

## Phase 4: ออกแบบโครงสร้างใหม่

### 4.1 Option A: แยกเป็น 4 ตารางใหม่
```sql
-- สร้างตารางใหม่สำหรับแต่ละแท็บ

-- Tab 1: Picking Area
CREATE TABLE IF NOT EXISTS wms_picking_area_inventory (
  id SERIAL PRIMARY KEY,
  balance_id INTEGER REFERENCES wms_inventory_balances(balance_id),
  product_id INTEGER REFERENCES master_products(product_id),
  location_id INTEGER REFERENCES master_locations(location_id),
  pallet_id INTEGER REFERENCES wms_pallets(pallet_id),
  total_pack_qty DECIMAL(15,4) DEFAULT 0,
  total_piece_qty DECIMAL(15,4) DEFAULT 0,
  reserved_pack_qty DECIMAL(15,4) DEFAULT 0,
  reserved_piece_qty DECIMAL(15,4) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'available',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tab 2: Dispatch Area
CREATE TABLE IF NOT EXISTS wms_dispatch_area_inventory (
  -- โครงสร้างเหมือนกัน
);

-- Tab 3: Reserved Items
CREATE TABLE IF NOT EXISTS wms_reserved_inventory (
  -- โครงสร้างเหมือนกัน
);

-- Tab 4: Staging Area
CREATE TABLE IF NOT EXISTS wms_staging_area_inventory (
  -- โครงสร้างเหมือนกัน
);
```

### 4.2 Option B: ใช้ Materialized Views
```sql
-- สร้าง Materialized View สำหรับแต่ละแท็บ (เร็วกว่า query ปกติ)

CREATE MATERIALIZED VIEW mv_picking_area_inventory AS
SELECT 
  b.balance_id,
  b.product_id,
  p.product_code,
  p.product_name,
  b.location_id,
  l.location_code,
  b.pallet_id,
  pal.pallet_code,
  b.total_pack_qty,
  b.total_piece_qty,
  b.reserved_pack_qty,
  b.reserved_piece_qty,
  b.created_at,
  b.updated_at
FROM wms_inventory_balances b
JOIN master_products p ON p.product_id = b.product_id
JOIN master_locations l ON l.location_id = b.location_id
LEFT JOIN wms_pallets pal ON pal.pallet_id = b.pallet_id
WHERE l.location_code LIKE 'PK%'  -- condition ของ tab 1
WITH DATA;

-- สร้าง index
CREATE INDEX idx_mv_picking_area_product ON mv_picking_area_inventory(product_id);
CREATE INDEX idx_mv_picking_area_location ON mv_picking_area_inventory(location_id);

-- Refresh function
CREATE OR REPLACE FUNCTION refresh_picking_area_inventory()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_picking_area_inventory;
END;
$$ LANGUAGE plpgsql;
```

### 4.3 Option C: เพิ่ม Index และ Partitioning
```sql
-- สร้าง Indexes ที่เหมาะสม
CREATE INDEX IF NOT EXISTS idx_balances_location_type 
ON wms_inventory_balances(location_id) 
INCLUDE (product_id, total_pack_qty, total_piece_qty);

-- หรือใช้ Partitioning by location type
-- (ถ้า PostgreSQL version รองรับ)
```

---

## Phase 5: วางแผน Migration

### 5.1 สร้าง Migration Plan
```
Step 1: สร้างตาราง/view ใหม่ (ไม่กระทบของเดิม)
Step 2: สร้าง Triggers เพื่อ Sync ข้อมูล
Step 3: Migrate ข้อมูลเดิมเข้าตารางใหม่
Step 4: สร้าง API ใหม่ที่อ่านจากตารางใหม่
Step 5: ทดสอบ API ใหม่
Step 6: เปลี่ยน Frontend ไปใช้ API ใหม่
Step 7: Monitor และ cleanup
```

### 5.2 สร้าง Sync Triggers
```sql
-- Trigger เพื่อ sync ข้อมูลไปตารางใหม่เมื่อ balance เปลี่ยน
CREATE OR REPLACE FUNCTION sync_preparation_area_tables()
RETURNS TRIGGER AS $$
DECLARE
  v_location_code VARCHAR(50);
BEGIN
  -- หา location code
  SELECT location_code INTO v_location_code
  FROM master_locations
  WHERE location_id = COALESCE(NEW.location_id, OLD.location_id);

  -- Sync ไปตารางที่เหมาะสม
  IF v_location_code LIKE 'PK%' THEN
    -- Insert/Update to picking area table
    IF TG_OP = 'DELETE' THEN
      DELETE FROM wms_picking_area_inventory WHERE balance_id = OLD.balance_id;
    ELSE
      INSERT INTO wms_picking_area_inventory (balance_id, product_id, location_id, ...)
      VALUES (NEW.balance_id, NEW.product_id, NEW.location_id, ...)
      ON CONFLICT (balance_id) DO UPDATE SET
        total_pack_qty = EXCLUDED.total_pack_qty,
        updated_at = NOW();
    END IF;
  ELSIF v_location_code LIKE 'DISPATCH%' THEN
    -- Insert/Update to dispatch area table
    -- ...
  -- ... เพิ่มสำหรับ location types อื่นๆ
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_preparation_area
AFTER INSERT OR UPDATE OR DELETE ON wms_inventory_balances
FOR EACH ROW EXECUTE FUNCTION sync_preparation_area_tables();
```

---

## Phase 6: ประเมินผลกระทบ

### 6.1 รายการส่วนที่อาจได้รับผลกระทบ

**บันทึก:**
```
1. APIs ที่ใช้ตาราง wms_inventory_balances:
   - /api/warehouse/inventory: ___
   - /api/warehouse/preparation-area: ___
   - /api/___: ___

2. Pages ที่แสดงข้อมูล:
   - /warehouse/preparation-area-inventory: ___
   - /warehouse/inventory: ___
   - /___: ___

3. Mobile Apps:
   - /mobile/pick: ___
   - /mobile/move: ___
   - /___: ___

4. Reports:
   - ___

5. Triggers/Functions:
   - ___
```

### 6.2 Impact Assessment Matrix

| ส่วนที่ได้รับผลกระทบ | Severity | Action Required |
|--------------------|----------|-----------------|
| API xxx | High/Medium/Low | ___ |
| Page xxx | High/Medium/Low | ___ |
| Function xxx | High/Medium/Low | ___ |

---

## Output ที่ต้องการ

### รายงานสรุป
```
=== Preparation Area Inventory Analysis Report ===
วันที่วิเคราะห์: ___

1. โครงสร้างปัจจุบัน:
   - ตารางหลัก: ___
   - 4 แท็บ: ___, ___, ___, ___
   - จำนวนข้อมูลรวม: ___ records
   - จำนวนต่อแท็บ: Tab1=___, Tab2=___, Tab3=___, Tab4=___

2. Performance Analysis:
   - Query Time ปัจจุบัน: ___ ms
   - Bottleneck: ___
   - Indexes ที่มี: ___

3. Dependencies:
   - APIs ที่ใช้: ___ files
   - Pages ที่ใช้: ___ files
   - Functions/Triggers: ___

4. ข้อเสนอแนะ:
   - Option A (แยกตาราง): ___
   - Option B (Materialized View): ___
   - Option C (เพิ่ม Index): ___
   - **แนะนำ:** ___

5. Risk Assessment:
   - High Risk: ___
   - Medium Risk: ___
   - Low Risk: ___

6. Migration Plan:
   - ระยะเวลาโดยประมาณ: ___
   - Downtime Required: ___
   - Rollback Plan: ___
```

---

## Checklist
```
Phase 0: ตรวจสอบโครงสร้างปัจจุบัน
□ 0.1 ตรวจสอบ Page และ Components
□ 0.2 อ่านโค้ด Page หลัก
□ 0.3 ระบุ 4 แท็บเมนู
□ 0.4 ตรวจสอบ API ที่ใช้

Phase 1: ตรวจสอบฐานข้อมูล
□ 1.1 ดูตารางที่เกี่ยวข้อง
□ 1.2 ดูโครงสร้างตารางหลัก
□ 1.3 นับจำนวนข้อมูลแต่ละแท็บ
□ 1.4 วิเคราะห์ Query Performance
□ 1.5 ดู Indexes ที่มี

Phase 2: ตรวจสอบ Dependencies
□ 2.1 หาทุกที่ที่ใช้ตาราง/API
□ 2.2 สร้าง Dependency Map
□ 2.3 ตรวจสอบ Triggers/Functions
□ 2.4 ตรวจสอบ Foreign Keys

Phase 3: วิเคราะห์ Logic แต่ละแท็บ
□ 3.1 สรุป Filter ของแต่ละแท็บ
□ 3.2 ตรวจสอบ Overlap

Phase 4: ออกแบบโครงสร้างใหม่
□ 4.1 Option A: แยกตาราง
□ 4.2 Option B: Materialized Views
□ 4.3 Option C: เพิ่ม Index

Phase 5: วางแผน Migration
□ 5.1 สร้าง Migration Plan
□ 5.2 สร้าง Sync Triggers

Phase 6: ประเมินผลกระทบ
□ 6.1 รายการส่วนที่ได้รับผลกระทบ
□ 6.2 Impact Assessment Matrix

Final
□ สรุปรายงาน
□ เลือก Option ที่เหมาะสม
□ วางแผนดำเนินการ
```

---

เริ่มจาก **Phase 0** ก่อน!
ตรวจสอบอย่างละเอียดทุกขั้นตอน!
รายงานผลก่อนดำเนินการแก้ไขใดๆ!