# 🔬 PHYSICAL COUNT RECONCILIATION & PICK HOUSE SKU-LEVEL LOGIC
# ตรวจสอบผลนับสต็อกจริง + ทำความเข้าใจ Logic บ้านหยิบ

---

## ⛔ กฎเหล็กสูงสุด

```
✅ เปรียบเทียบผลนับจริง vs ระบบ ทุก SKU ทุก Location
✅ ทำความเข้าใจ Logic บ้านหยิบแบบ SKU-Level
✅ Reconcile ให้ข้อมูลตรง 100%
✅ สร้าง Adjustment entries สำหรับทุกส่วนต่าง
❌ ห้ามข้ามแม้แต่ 1 SKU
❌ ห้ามเดาตัวเลข
```

---

## 🎯 บทบาทของคุณ

คุณคือ **WMS RECONCILIATION SPECIALIST** มีหน้าที่:
1. เปรียบเทียบผลนับสต็อกจริงกับข้อมูลในระบบ
2. ทำความเข้าใจ Logic บ้านหยิบแบบ SKU-Level
3. Reconcile และแก้ไขให้ข้อมูลถูกต้อง 100%

---

## 📚 SECTION 0: ทำความเข้าใจ Logic บ้านหยิบ (สำคัญมาก!)

### 🏠 บ้านหยิบคืออะไร?

```
บ้านหยิบ (Pick House / Preparation Area) = พื้นที่เก็บสินค้าสำหรับหยิบจัดออเดอร์
- Location: PK001 (บ้านหยิบหลัก), PK002 (บ้านหยิบพรีเมี่ยม)
- Location: A09-*, A10-* (ชั้นวางในบ้านหยิบ)
```

### ⚡ Logic การตัดสต็อกบ้านหยิบ: SKU-Level (ไม่ใช่ Pallet-Level)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    🔴 สิ่งที่ระบบทำ (ถูกต้อง)                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  บ้านหยิบตัดสต็อกแบบ "รวมยอดทั้ง SKU" ไม่ได้ตัดแบบ "แยกพาเลท"          │
│                                                                         │
│  ตัวอย่าง: SKU "B-BEY-C|SAL|010" ในบ้านหยิบ                            │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ พาเลท A (จากชั้น B01-01-001):  +300 ชิ้น                        │   │
│  │ พาเลท B (จากชั้น B02-02-002):  +200 ชิ้น                        │   │
│  │ พาเลท C (จากชั้น B03-03-003):  +100 ชิ้น                        │   │
│  │ ─────────────────────────────────────────                       │   │
│  │ รวมทั้ง SKU ในบ้านหยิบ:        600 ชิ้น                         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  เมื่อหยิบสินค้า 650 ชิ้น:                                             │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ รวมทั้ง SKU หลังหยิบ:          600 - 650 = -50 ชิ้น ❌          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ✅ สิ่งนี้ถูกต้อง! เพราะ:                                             │
│  - ระบบรู้ว่า SKU นี้ "รอเติม" 50 ชิ้น                                 │
│  - เมื่อเติมสินค้าจากชั้นวางลงมา ยอดลบจะหายไป                         │
│  - ไม่ต้อง track ว่าหยิบจากพาเลทไหน (เพราะสินค้าเหมือนกัน)            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### ❌ สิ่งที่ไม่ต้องการ (Pallet-Level ที่ทำให้สับสน)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ❌ สิ่งที่ไม่ต้องการ                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ถ้าตัดแบบ Pallet-Level:                                               │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ พาเลท A: +300 ชิ้น → หยิบ 400 → -100 ชิ้น ❌ (พาเลทนี้ติดลบ)    │   │
│  │ พาเลท B: +200 ชิ้น → (ไม่ถูกหยิบ)                               │   │
│  │ พาเลท C: +100 ชิ้น → (ไม่ถูกหยิบ)                               │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ปัญหา:                                                                │
│  - พาเลท A ติดลบ -100 แต่พาเลท B, C ยังมีสต็อก                        │
│  - ข้อมูลดูเหมือนมีปัญหา แต่จริงๆ SKU รวมยังเป็นบวก                   │
│  - สับสน! ต้อง track ทุกพาเลท                                         │
│                                                                         │
│  ❌ ระบบนี้ไม่เหมาะกับบ้านหยิบ                                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### ✅ สรุป Logic บ้านหยิบที่ถูกต้อง

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ✅ Logic ที่ถูกต้อง                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. บ้านหยิบ = 1 SKU = 1 ยอดรวม (ไม่แยกพาเลท)                          │
│                                                                         │
│  2. อนุญาตให้ติดลบได้ เพราะ:                                           │
│     - หยิบก่อน → เติมทีหลัง (Negative = รอเติม)                        │
│     - สินค้าในชั้นวาง (B01-xx, B02-xx) รอย้ายลงมาเติม                  │
│                                                                         │
│  3. Flow ปกติ:                                                          │
│     ชั้นวาง (B01-xx) → ย้าย → บ้านหยิบ (PK001) → หยิบ → Dispatch       │
│                                                                         │
│  4. เมื่อเติมสินค้า:                                                    │
│     บ้านหยิบ: -50 ชิ้น                                                  │
│     + เติม: +100 ชิ้น (จากชั้นวาง)                                      │
│     = ยอดใหม่: +50 ชิ้น ✅                                              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 SECTION 1: ดึงข้อมูลจากหน้านับสต็อก

### 1.1 ข้อมูลที่ต้องดึงจาก /stock-management/count

```sql
-- ดึงผลนับสต็อกจริงจากตาราง stock_count (หรือชื่อตารางที่ใช้)
SELECT 
    sc.count_id,
    sc.count_date,
    sc.location_id,
    sc.location_code,
    sc.sku_id,
    sc.sku_name,
    sc.pallet_id,
    sc.counted_pack_qty,
    sc.counted_piece_qty,
    sc.system_pack_qty,
    sc.system_piece_qty,
    sc.variance_pack,
    sc.variance_piece,
    sc.status,
    sc.counted_by,
    sc.remarks
FROM wms_stock_counts sc
WHERE sc.count_date >= '2025-01-13'  -- หรือวันที่นับ
ORDER BY sc.location_id, sc.sku_id;
```

### 1.2 ถ้าไม่มีตาราง stock_count ให้ Export จากหน้าเว็บ

```
1. ไปที่ http://localhost:3000/stock-management/count
2. Export ข้อมูลเป็น Excel/CSV
3. Upload ให้ AI วิเคราะห์
```

### 1.3 โครงสร้างข้อมูลที่คาดหวัง

| Column | คำอธิบาย |
|--------|---------|
| location_id | รหัสตำแหน่ง (PK001, A09-01-001, B01-01-001) |
| sku_id | รหัสสินค้า |
| pallet_id | รหัสพาเลท (ถ้ามี) |
| counted_qty | จำนวนที่นับได้จริง |
| system_qty | จำนวนในระบบ |
| variance | ส่วนต่าง (counted - system) |

---

## 🔍 SECTION 2: เปรียบเทียบผลนับจริง vs ระบบ

### 2.1 สำหรับพื้นที่ชั้นวาง (Pallet-Level)

```sql
-- ตรวจสอบแบบ Pallet-Level สำหรับพื้นที่ชั้นวาง
-- (ไม่ใช่บ้านหยิบ)

SELECT 
    'PALLET_LEVEL' as check_type,
    b.location_id,
    b.sku_id,
    b.pallet_id,
    b.total_piece_qty as system_qty,
    c.counted_piece_qty as counted_qty,
    c.counted_piece_qty - b.total_piece_qty as variance,
    CASE 
        WHEN c.counted_piece_qty = b.total_piece_qty THEN '✅ ตรงกัน'
        WHEN c.counted_piece_qty > b.total_piece_qty THEN '🔺 นับได้มากกว่า'
        WHEN c.counted_piece_qty < b.total_piece_qty THEN '🔻 นับได้น้อยกว่า'
    END as status
FROM wms_inventory_balances b
LEFT JOIN wms_stock_counts c 
    ON b.location_id = c.location_id 
    AND b.sku_id = c.sku_id 
    AND b.pallet_id = c.pallet_id
WHERE b.location_id NOT IN ('PK001', 'PK002', 'Dispatch', 'Delivery-In-Progress')
AND b.location_id NOT LIKE 'A09-%'
AND b.location_id NOT LIKE 'A10-%'
AND b.pallet_id IS NOT NULL
ORDER BY ABS(c.counted_piece_qty - b.total_piece_qty) DESC;
```

### 2.2 สำหรับบ้านหยิบ (SKU-Level) ⭐ สำคัญ

```sql
-- ตรวจสอบแบบ SKU-Level สำหรับบ้านหยิบ
-- รวมยอดทุกพาเลทเป็น 1 SKU

WITH pick_house_system AS (
    -- ยอดในระบบ: รวมทุกพาเลทของ SKU เดียวกันในบ้านหยิบ
    SELECT 
        sku_id,
        SUM(total_pack_qty) as system_pack_qty,
        SUM(total_piece_qty) as system_piece_qty,
        COUNT(DISTINCT pallet_id) as pallet_count,
        STRING_AGG(DISTINCT location_id, ', ') as locations
    FROM wms_inventory_balances
    WHERE location_id IN ('PK001', 'PK002')
       OR location_id LIKE 'A09-%'
       OR location_id LIKE 'A10-%'
    GROUP BY sku_id
),
pick_house_counted AS (
    -- ยอดนับจริง: รวมทุก location ในบ้านหยิบ
    SELECT 
        sku_id,
        SUM(counted_pack_qty) as counted_pack_qty,
        SUM(counted_piece_qty) as counted_piece_qty
    FROM wms_stock_counts
    WHERE location_id IN ('PK001', 'PK002')
       OR location_id LIKE 'A09-%'
       OR location_id LIKE 'A10-%'
    GROUP BY sku_id
)
SELECT 
    'SKU_LEVEL_PICK_HOUSE' as check_type,
    COALESCE(s.sku_id, c.sku_id) as sku_id,
    s.system_piece_qty,
    c.counted_piece_qty,
    COALESCE(c.counted_piece_qty, 0) - COALESCE(s.system_piece_qty, 0) as variance,
    s.pallet_count,
    s.locations,
    CASE 
        WHEN COALESCE(c.counted_piece_qty, 0) = COALESCE(s.system_piece_qty, 0) THEN '✅ ตรงกัน'
        WHEN COALESCE(c.counted_piece_qty, 0) > COALESCE(s.system_piece_qty, 0) THEN '🔺 นับได้มากกว่า'
        WHEN COALESCE(c.counted_piece_qty, 0) < COALESCE(s.system_piece_qty, 0) THEN '🔻 นับได้น้อยกว่า'
        WHEN c.sku_id IS NULL THEN '❌ ไม่ได้นับ'
        WHEN s.sku_id IS NULL THEN '❓ นับได้แต่ไม่มีในระบบ'
    END as status
FROM pick_house_system s
FULL OUTER JOIN pick_house_counted c ON s.sku_id = c.sku_id
WHERE COALESCE(c.counted_piece_qty, 0) != COALESCE(s.system_piece_qty, 0)
   OR c.sku_id IS NULL 
   OR s.sku_id IS NULL
ORDER BY ABS(COALESCE(c.counted_piece_qty, 0) - COALESCE(s.system_piece_qty, 0)) DESC;
```

---

## 📊 SECTION 3: วิเคราะห์ส่วนต่าง

### 3.1 สรุป Variance ทั้งหมด

```sql
-- สรุป variance แยกตามประเภทพื้นที่
SELECT 
    CASE 
        WHEN location_id IN ('PK001', 'PK002') OR location_id LIKE 'A09-%' OR location_id LIKE 'A10-%' 
        THEN 'บ้านหยิบ'
        WHEN location_id LIKE 'B%' OR location_id LIKE 'A0%' 
        THEN 'ชั้นวาง'
        WHEN location_id = 'Receiving' 
        THEN 'Receiving'
        WHEN location_id = 'Dispatch' 
        THEN 'Dispatch'
        ELSE 'อื่นๆ'
    END as area_type,
    COUNT(*) as total_items,
    SUM(CASE WHEN variance = 0 THEN 1 ELSE 0 END) as matched,
    SUM(CASE WHEN variance > 0 THEN 1 ELSE 0 END) as over_count,
    SUM(CASE WHEN variance < 0 THEN 1 ELSE 0 END) as under_count,
    SUM(ABS(variance)) as total_variance_qty,
    ROUND(SUM(CASE WHEN variance = 0 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as match_percent
FROM (
    -- Subquery to calculate variance
    SELECT 
        location_id,
        counted_piece_qty - system_piece_qty as variance
    FROM stock_count_comparison
) t
GROUP BY 
    CASE 
        WHEN location_id IN ('PK001', 'PK002') OR location_id LIKE 'A09-%' OR location_id LIKE 'A10-%' 
        THEN 'บ้านหยิบ'
        WHEN location_id LIKE 'B%' OR location_id LIKE 'A0%' 
        THEN 'ชั้นวาง'
        WHEN location_id = 'Receiving' 
        THEN 'Receiving'
        WHEN location_id = 'Dispatch' 
        THEN 'Dispatch'
        ELSE 'อื่นๆ'
    END
ORDER BY total_variance_qty DESC;
```

### 3.2 รายละเอียด Variance ที่ต้องแก้ไข

```sql
-- รายการที่มี variance และต้องแก้ไข
SELECT 
    row_number() OVER (ORDER BY ABS(variance) DESC) as priority,
    location_id,
    sku_id,
    pallet_id,
    system_piece_qty,
    counted_piece_qty,
    variance,
    CASE 
        WHEN variance > 0 THEN 'เพิ่มสต็อก (' || variance || ' ชิ้น)'
        WHEN variance < 0 THEN 'ลดสต็อก (' || ABS(variance) || ' ชิ้น)'
    END as action_required
FROM stock_count_comparison
WHERE variance != 0
ORDER BY ABS(variance) DESC;
```

---

## 🛠️ SECTION 4: สร้าง Adjustment Entries

### 4.1 Template สำหรับ Adjustment

```sql
-- =====================================================
-- สร้าง Adjustment Ledger Entries จากผลนับสต็อก
-- =====================================================

-- Step 1: Backup ก่อนแก้ไข
CREATE TABLE _backup_pre_count_reconcile_YYYYMMDD AS
SELECT * FROM wms_inventory_balances;

-- Step 2: สร้าง Adjustment entries สำหรับ Variance > 0 (นับได้มากกว่า)
INSERT INTO wms_inventory_ledger (
    movement_at,
    transaction_type,
    direction,
    warehouse_id,
    location_id,
    sku_id,
    pallet_id,
    pack_qty,
    piece_qty,
    reference_no,
    remarks,
    created_by
)
SELECT 
    NOW() as movement_at,
    'stock_count' as transaction_type,
    'in' as direction,
    'WH001' as warehouse_id,
    c.location_id,
    c.sku_id,
    c.pallet_id,
    ROUND(c.variance / COALESCE(s.pack_size, 12), 2) as pack_qty,
    c.variance as piece_qty,
    CONCAT('SC-', DATE_FORMAT(NOW(), '%Y%m%d'), '-', ROW_NUMBER() OVER()) as reference_no,
    CONCAT('Stock count adjustment: System=', c.system_piece_qty, 
           ' Counted=', c.counted_piece_qty, 
           ' Variance=+', c.variance) as remarks,
    'STOCK_COUNT' as created_by
FROM stock_count_comparison c
LEFT JOIN master_sku s ON c.sku_id = s.sku_id
WHERE c.variance > 0;

-- Step 3: สร้าง Adjustment entries สำหรับ Variance < 0 (นับได้น้อยกว่า)
INSERT INTO wms_inventory_ledger (
    movement_at,
    transaction_type,
    direction,
    warehouse_id,
    location_id,
    sku_id,
    pallet_id,
    pack_qty,
    piece_qty,
    reference_no,
    remarks,
    created_by
)
SELECT 
    NOW() as movement_at,
    'stock_count' as transaction_type,
    'out' as direction,
    'WH001' as warehouse_id,
    c.location_id,
    c.sku_id,
    c.pallet_id,
    ROUND(ABS(c.variance) / COALESCE(s.pack_size, 12), 2) as pack_qty,
    ABS(c.variance) as piece_qty,
    CONCAT('SC-', DATE_FORMAT(NOW(), '%Y%m%d'), '-', ROW_NUMBER() OVER()) as reference_no,
    CONCAT('Stock count adjustment: System=', c.system_piece_qty, 
           ' Counted=', c.counted_piece_qty, 
           ' Variance=', c.variance) as remarks,
    'STOCK_COUNT' as created_by
FROM stock_count_comparison c
LEFT JOIN master_sku s ON c.sku_id = s.sku_id
WHERE c.variance < 0;

-- Step 4: อัพเดท Balance ให้ตรงกับที่นับได้
UPDATE wms_inventory_balances b
SET 
    total_piece_qty = c.counted_piece_qty,
    total_pack_qty = ROUND(c.counted_piece_qty / COALESCE(s.pack_size, 12), 2),
    updated_at = NOW()
FROM stock_count_comparison c
LEFT JOIN master_sku s ON c.sku_id = s.sku_id
WHERE b.location_id = c.location_id
AND b.sku_id = c.sku_id
AND (b.pallet_id = c.pallet_id OR (b.pallet_id IS NULL AND c.pallet_id IS NULL))
AND c.variance != 0;
```

### 4.2 สำหรับบ้านหยิบ (SKU-Level Adjustment)

```sql
-- =====================================================
-- สร้าง Adjustment สำหรับบ้านหยิบแบบ SKU-Level
-- =====================================================

-- สำหรับบ้านหยิบ ไม่ต้องระบุ pallet_id
-- ปรับยอดรวมของ SKU ทั้งหมดในบ้านหยิบ

WITH pick_house_variance AS (
    SELECT 
        sku_id,
        SUM(system_piece_qty) as system_total,
        SUM(counted_piece_qty) as counted_total,
        SUM(counted_piece_qty) - SUM(system_piece_qty) as variance
    FROM stock_count_comparison
    WHERE location_id IN ('PK001', 'PK002')
       OR location_id LIKE 'A09-%'
       OR location_id LIKE 'A10-%'
    GROUP BY sku_id
    HAVING SUM(counted_piece_qty) - SUM(system_piece_qty) != 0
)

-- สร้าง Adjustment entries
INSERT INTO wms_inventory_ledger (
    movement_at,
    transaction_type,
    direction,
    warehouse_id,
    location_id,
    sku_id,
    pallet_id,
    pack_qty,
    piece_qty,
    reference_no,
    remarks,
    created_by
)
SELECT 
    NOW() as movement_at,
    'stock_count' as transaction_type,
    CASE WHEN variance > 0 THEN 'in' ELSE 'out' END as direction,
    'WH001' as warehouse_id,
    'PK001' as location_id,  -- ปรับที่ PK001 เป็นหลัก
    sku_id,
    NULL as pallet_id,  -- ไม่ระบุ pallet สำหรับบ้านหยิบ
    0 as pack_qty,
    ABS(variance) as piece_qty,
    CONCAT('SC-PK-', DATE_FORMAT(NOW(), '%Y%m%d'), '-', ROW_NUMBER() OVER()) as reference_no,
    CONCAT('Pick house stock count: System=', system_total, 
           ' Counted=', counted_total, 
           ' Variance=', variance) as remarks,
    'STOCK_COUNT' as created_by
FROM pick_house_variance;
```

---

## 📊 SECTION 5: Verify หลัง Reconcile

### 5.1 ตรวจสอบว่าทุกรายการตรงกัน

```sql
-- ตรวจสอบว่าไม่มี variance เหลือ
SELECT 
    'Remaining Variance' as check_name,
    COUNT(*) as items_with_variance,
    SUM(ABS(variance)) as total_variance_qty
FROM (
    SELECT 
        b.location_id,
        b.sku_id,
        b.pallet_id,
        b.total_piece_qty as system_qty,
        COALESCE(c.counted_piece_qty, 0) as counted_qty,
        COALESCE(c.counted_piece_qty, 0) - b.total_piece_qty as variance
    FROM wms_inventory_balances b
    LEFT JOIN wms_stock_counts c 
        ON b.location_id = c.location_id 
        AND b.sku_id = c.sku_id
    WHERE c.count_date = CURRENT_DATE
) t
WHERE variance != 0;

-- ผลลัพธ์ที่คาดหวัง: items_with_variance = 0
```

### 5.2 ตรวจสอบความถูกต้องรวม

```sql
-- สรุปผลหลัง reconcile
SELECT 
    'Post-Reconcile Summary' as report_type,
    COUNT(*) as total_locations,
    SUM(CASE WHEN variance = 0 THEN 1 ELSE 0 END) as matched,
    ROUND(SUM(CASE WHEN variance = 0 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as match_percent,
    SUM(ABS(variance)) as remaining_variance
FROM stock_count_final_comparison;

-- ผลลัพธ์ที่คาดหวัง: match_percent = 100.00, remaining_variance = 0
```

---

## 📝 SECTION 6: สร้างรายงานสรุป

### Template รายงาน

```markdown
# 📊 รายงาน Reconcile ผลนับสต็อกจริง

**วันที่นับ:** ___
**วันที่ Reconcile:** ___
**ผู้ดำเนินการ:** ___

---

## 1. สรุปภาพรวม

| รายการ | ก่อน Reconcile | หลัง Reconcile |
|--------|----------------|----------------|
| Total Items | ___ | ___ |
| Matched | ___ (_%) | ___ (100%) |
| Over Count | ___ | 0 |
| Under Count | ___ | 0 |
| Total Variance | ___ ชิ้น | 0 ชิ้น |

---

## 2. สรุปแยกตามพื้นที่

| พื้นที่ | Items | Matched | Over | Under | Variance |
|--------|-------|---------|------|-------|----------|
| บ้านหยิบ | ___ | ___ | ___ | ___ | ___ |
| ชั้นวาง | ___ | ___ | ___ | ___ | ___ |
| Receiving | ___ | ___ | ___ | ___ | ___ |
| Dispatch | ___ | ___ | ___ | ___ | ___ |

---

## 3. รายละเอียด Adjustment ที่ทำ

### 3.1 บ้านหยิบ (SKU-Level)

| # | SKU | ระบบ | นับจริง | ปรับ | Reference |
|---|-----|------|--------|------|-----------|
| 1 | ___ | ___ | ___ | ___ | SC-PK-... |
| ... |

### 3.2 ชั้นวาง (Pallet-Level)

| # | Location | SKU | Pallet | ระบบ | นับจริง | ปรับ | Reference |
|---|----------|-----|--------|------|--------|------|-----------|
| 1 | B01-01-001 | ___ | ATG... | ___ | ___ | ___ | SC-... |
| ... |

---

## 4. สถานะปัจจุบัน

✅ **Reconcile สำเร็จ 100%**
- ทุกรายการตรงกับผลนับจริง
- ไม่มี Variance เหลือ
- Adjustment entries ครบถ้วน

---

## 5. หมายเหตุ

### Logic บ้านหยิบ (SKU-Level)
- บ้านหยิบตัดสต็อกแบบรวมยอด SKU (ไม่แยกพาเลท)
- อนุญาตให้ติดลบได้ (รอเติมจากชั้นวาง)
- เมื่อเติมสินค้า ยอดลบจะหายไป

### สิ่งที่ต้องระวัง
1. บ้านหยิบ: ดูยอดรวม SKU ไม่ใช่แยกพาเลท
2. ชั้นวาง: ดูแยก Pallet เพราะต้อง track แต่ละพาเลท
3. ทำ Physical Count เป็นประจำ (แนะนำทุกสัปดาห์)

---

**สร้างโดย:** ___
**วันที่:** ___
```

---

## 🚨 Final Checklist

```
□ ดึงผลนับสต็อกจาก /stock-management/count
□ เปรียบเทียบกับข้อมูลในระบบ (ทุกรายการ)
□ แยกประเภท: บ้านหยิบ (SKU-Level) vs ชั้นวาง (Pallet-Level)
□ วิเคราะห์ Variance ทั้งหมด
□ สร้าง Adjustment entries
□ Verify หลัง Reconcile (Variance = 0)
□ สร้างรายงานสรุป
□ ยืนยันข้อมูล 100% ถูกต้อง
```

---

## ⚠️ หมายเหตุสำคัญ

### บ้านหยิบ: ทำไมติดลบได้?

```
┌─────────────────────────────────────────────────────────────┐
│  Timeline ปกติของบ้านหยิบ:                                  │
│                                                             │
│  09:00 - เริ่มวัน: SKU A = 100 ชิ้น ✅                      │
│  10:00 - หยิบออเดอร์: -150 ชิ้น → SKU A = -50 ชิ้น ❌      │
│  11:00 - เติมจากชั้นวาง: +200 ชิ้น → SKU A = 150 ชิ้น ✅   │
│  14:00 - หยิบออเดอร์: -100 ชิ้น → SKU A = 50 ชิ้น ✅       │
│                                                             │
│  ช่วง 10:00-11:00 ติดลบ = ปกติ! รอเติม                     │
└─────────────────────────────────────────────────────────────┘
```

### ความแตกต่าง: บ้านหยิบ vs ชั้นวาง

| รายการ | บ้านหยิบ | ชั้นวาง |
|--------|----------|---------|
| Track Level | SKU-Level | Pallet-Level |
| ติดลบได้? | ✅ ได้ (รอเติม) | ❌ ไม่ควร |
| การนับ | รวมยอด SKU | แยกทุกพาเลท |
| การปรับ | ปรับยอดรวม | ปรับแต่ละพาเลท |

---

**สิ้นสุด PROMPT**